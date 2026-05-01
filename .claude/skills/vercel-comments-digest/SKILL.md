---
name: vercel-comments-digest
description: >-
  Daily routine that scans Vercel's Slack mirror, maps comment threads to IMS
  projects via Supabase, files each thread under the current weekly Linear
  holding issue, and replies once in Slack with the tracking link. Use when a
  scheduler runs the Vercel comments digest, or when asked to process
  #vercel-pings, Vercel feedback, or Slack-mirrored Vercel comments.
---

# Vercel comments digest

**What this routine does:** reads new Vercel comment threads from
`#vercel-pings`, maps each Vercel project slug to an IMS project/client, upserts
each comment into `public.vercel_feedback`, creates or updates one Linear issue
per Vercel thread under this week's holding issue, and replies in the Slack
thread once with the Linear link.

## Context

- **Ops database:** Supabase project ID `jcuymodyrjbzwmyjzwee`
- **Slack source channel:** `#vercel-pings`, channel ID `C0B13QEA86M`
- **Vercel Slack bot user:** `U0B09EFA43H`
- **Slack source is the source of truth:** parse parent messages and read Slack
  thread replies; do not call the Vercel API.
- **Linear grouping:** one holding issue per resolved Linear team per ISO week,
  titled `Vercel Comments - Week of YYYY-MM-DD` where the date is Monday.
- **Durable memory:** `vercel_feedback` is the per-thread source of truth;
  `system_config` stores only compact run cursors and refresh intervals.

## Preflight: required connectors

Required: `Supabase:execute_sql`, `Slack:slack_read_channel`,
`Slack:slack_read_thread`, `Slack:slack_send_message`, and Linear read/write
tools for teams, projects, issues, and issue updates. Optional:
`Slack:slack_search_users` for failure alerts.

If a required connector is missing, write a `failed` row to `automation_runs`
when Supabase is reachable, with `notes = 'missing required connector: <name>'`,
then exit.

## Execution discipline (cloud)

Cloud runs can hit per-turn tool limits. Follow these rules literally:

- Process Slack parent messages in stable timestamp order.
- Issue at most one `Slack:slack_read_thread` per turn. For each parent, finish
  parsing replies, resolving Linear, creating/updating Linear, replying in
  Slack, and upserting Supabase before reading the next thread.
- Load project/client/team-member mapping rows from Supabase once per run.
- Load existing `vercel_feedback` rows once per run, then update local memory
  after each upsert.
- Fast-path already-tracked threads before reading Slack replies when the
  existing row is complete and freshly synced.
- Load Linear teams/projects once per run and cache them.
- Do not create task/todo UI during a scheduled run.
- Keep successful scheduled output terse.

---

## Schema reference

Use only Supabase project `jcuymodyrjbzwmyjzwee`.

- `project_vercel_links`: `id`, `project_id`, unique `vercel_slug`,
  optional `vercel_project_id`, `is_primary`, `notes`, `created_at`.
- `projects`: `id`, `name`, `client_id`, `status`, `dev_lead_id`, `pm_id`,
  `vercel_url`, `github_url`.
- `clients`: `id`, `name`.
- `team_members`: `id`, `name`, `role`, `email`.
- `automation_runs`: standard routine log columns (`routine_name`, timestamps,
  status, counters, `error_details`, `notes`).
- `system_config`: read the `vercel_comments_digest.*` keys listed in Step 0.

### `vercel_feedback` table

This table is the idempotency surface. If it does not exist, fail before Slack
or Linear writes. Required columns: `id`, `project_id`,
`vercel_project_name`, `deployment_url`, `page_url`, `comment`, `author_name`,
`author_email`, `screenshot_url`, `status`, `priority`, unique `external_id`,
`raw_payload`, `submitted_at`, `resolved_at`, `created_at`, `updated_at`.
Use `external_id = vercelThreadId`; store Slack timestamps, Linear issue IDs,
reply counts, stale flags, environment, and parse details in `raw_payload`.

---

## Step 0 - Kill switch and config

Run this before any Slack or Linear call:

```sql
select key, value from system_config where key in (
  'vercel_comments_digest.enabled',
  'vercel_comments_digest.lookback_hours',
  'vercel_comments_digest.stale_threshold_hours',
  'vercel_comments_digest.linear_team_overrides',
  'vercel_comments_digest.skip_envs',
  'vercel_comments_digest.last_successful_parent_ts',
  'vercel_comments_digest.cursor_grace_minutes',
  'vercel_comments_digest.known_thread_refresh_hours'
);
```

Parse into local variables:

- `enabled` bool, default `false`
- `lookback_hours` int, default `24`
- `stale_threshold_hours` int, default `48`
- `linear_team_overrides` object, default `{}`
- `skip_envs` array of strings, default `[]`
- `last_successful_parent_ts` string or null, default `null`
- `cursor_grace_minutes` int, default `15`
- `known_thread_refresh_hours` int, default `24`

If `enabled` is false:

```sql
insert into automation_runs (routine_name, started_at, completed_at, status, notes)
values ('vercel_comments_digest', now(), now(), 'killed', 'kill switch disabled');
```

Output `vercel_comments_digest: killed` and stop.

## Step 0.1 - Schema guard

Before any Slack or Linear write, verify required tables exist:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('project_vercel_links', 'vercel_feedback', 'projects', 'clients', 'team_members');
```

If `project_vercel_links` or `vercel_feedback` is missing, insert a failed
`automation_runs` row and stop. Do not auto-migrate in this routine.

## Step 1 - Open a run log

```sql
insert into automation_runs (routine_name, started_at, status)
values ('vercel_comments_digest', now(), 'running')
returning id;
```

Keep the returned `id` as `$run_id`. Counters start at 0:

- `items_checked` - parsed Vercel parent messages
- `items_new` - new Linear sub-issues created
- `items_queued` - existing Linear sub-issues updated
- `items_skipped` - skipped or unmapped threads
- `items_errored` - thread-level failures
- `items_stale` - local-only counter included in notes/stdout

## Step 2 - Pull Slack source

Compute:

- `lookback_oldest = now() - lookback_hours hours`
- If `last_successful_parent_ts` is present, compute
  `cursor_oldest = last_successful_parent_ts - cursor_grace_minutes`.
- `oldest = max(lookback_oldest, cursor_oldest)` when a cursor exists;
  otherwise use `lookback_oldest`.

Call:

```text
Slack:slack_read_channel(
  channel_id = "C0B13QEA86M",
  oldest = "<oldest>",
  limit = 100
)
```

Keep only messages where:

- `user == "U0B09EFA43H"`
- `text` matches this regex:

```text
New thread on <https://vercel\.live/link/(?P<project>[^.]+)\.vercel\.app\?page=(?P<page_encoded>[^&]+)&vercelThreadId=(?P<thread_id>[^&]+)&via=slack\|\[(?P<env>[^\]]+)\]\s*(?P<page_pretty>[^>]+)>
```

Extract `vercel_slug = project`, `page_encoded`, `thread_id`, `env`, and
`page_pretty`. Drop messages where `env` is in `skip_envs`. Sort remaining
parents by ascending Slack `ts`. Set `items_checked = len(parents)`.

Track `max_seen_parent_ts` as the largest parsed parent Slack `ts`. If no
parents remain, go to Step 8 and close the run as success.

## Step 3 - Load mappings and idempotency rows

Build arrays:

```text
slugs = unique(parent.vercel_slug)
thread_ids = unique(parent.thread_id)
```

Load project mappings once:

```sql
select
  pvl.vercel_slug,
  pvl.vercel_project_id,
  pvl.is_primary,
  p.id as project_id,
  p.name as project_name,
  p.status as project_status,
  p.dev_lead_id,
  p.pm_id,
  c.id as client_id,
  c.name as client_name,
  dev.name as dev_lead_name,
  dev.email as dev_lead_email,
  pm.name as pm_name,
  pm.email as pm_email
from project_vercel_links pvl
join projects p on p.id = pvl.project_id
left join clients c on c.id = p.client_id
left join team_members dev on dev.id = p.dev_lead_id
left join team_members pm on pm.id = p.pm_id
where pvl.vercel_slug = any($1);
```

Include paused projects in the mapping. Do not reject by `project_status`; Linear
triage may still be needed for paused work.

Load existing thread rows once:

```sql
select thread_id, parent_ts, linear_issue_id, linear_issue_url,
       linear_holding_epic_id, slack_reply_ts, processing_status,
       unmapped_reason, last_synced_at, status
from (
  select
    external_id as thread_id,
    raw_payload->>'parent_ts' as parent_ts,
    raw_payload->>'linear_issue_id' as linear_issue_id,
    raw_payload->>'linear_issue_url' as linear_issue_url,
    raw_payload->>'linear_holding_epic_id' as linear_holding_epic_id,
    raw_payload->>'slack_reply_ts' as slack_reply_ts,
    raw_payload->>'processing_status' as processing_status,
    raw_payload->>'unmapped_reason' as unmapped_reason,
    raw_payload->>'last_synced_at' as last_synced_at,
    status
  from vercel_feedback
  where external_id = any($1)
) existing_feedback;
```

Cache both result sets in memory.

## Step 3.1 - Load Linear snapshots

Load Linear teams and projects once, using the available Linear MCP tools. Cache
IDs, names, URLs, and team/project relationships.

Team resolution order for each mapped IMS project:

1. If `linear_team_overrides[client_name]` exists, exact-match that team name.
2. Exact-match `team.name == client_name`.
3. Case-insensitive single-hit substring match against `client_name`.
4. Exact-match a Linear project name to `project_name`, then use that project's
   team.

If no unique Linear team is resolved, mark the thread `unmapped`, upsert
`vercel_feedback`, log the reason, and skip Linear writes for that thread.

## Step 4 - Process each parent message

For every parent in stable timestamp order, wrap the whole step in try/catch.
On exception, increment `items_errored`, push a structured error into
`error_details`, upsert the feedback row when possible with
`raw_payload.processing_status = 'errored'`, and continue.

Before Step 4a, apply the known-thread fast path. If the cached
`vercel_feedback` row has all of the following, skip Slack thread reads, Linear
writes, and Supabase upsert for that parent:

- `linear_issue_id` is present.
- `slack_reply_ts` is present.
- `processing_status` is `tracked`, `updated`, or `skipped_known`.
- `unmapped_reason` is absent.
- `last_synced_at` is newer than `known_thread_refresh_hours`.

Increment a local `items_known` counter and continue. Do not fast-path rows with
missing Linear/Slack metadata, `processing_status = 'errored'`, an
`unmapped_reason`, or stale `last_synced_at`; those need a normal refresh.

### Step 4a - Read Slack thread

```text
Slack:slack_read_thread(
  channel_id = "C0B13QEA86M",
  message_ts = "<parent.ts>"
)
```

Classify replies:

- Vercel bot user is `U0B09EFA43H`.
- The original comment body is the first reply where `user != U0B09EFA43H`.
- `comment_author` is that reply's `user_profile.real_name`, `username`, or
  `user` fallback.
- `human_replies = replies where user != U0B09EFA43H`.
- `last_reply_ts = max(human_replies.ts)` or `parent.ts`.
- `reply_count = len(human_replies)`.

### Step 4b - Stale detection

```text
hours_since_last_human_reply = (now - last_reply_ts) / 3600
is_stale = hours_since_last_human_reply > stale_threshold_hours
           and reply_count <= 1
```

Increment local `items_stale` when true.

### Step 4c - Resolve Supabase mapping

Look up `vercel_slug` in the cached mapping.

If missing:

- Upsert `vercel_feedback` with `project_id = null`, `status = 'open'`,
  `external_id = thread_id`, the parsed `comment`, `vercel_project_name`, and
  latest Slack metadata in `raw_payload.unmapped_reason`.
- Append an error detail with `error_type = "unmapped_vercel_slug"`.
- `items_skipped += 1`.
- Continue to the next parent.

If present, keep `project_id`, `client_id`, `project_name`, `client_name`,
`dev_lead_name`, `dev_lead_email`, `pm_name`, `pm_email`, `vercel_project_id`,
and `is_primary` for Linear formatting.

### Step 4d - Resolve Linear team

Use the Step 3.1 resolution order. If unresolved:

- Upsert `vercel_feedback` with `status = 'open'` and
  `raw_payload.unmapped_reason = 'unresolved_linear_team'`.
- Append an error detail with `error_type = "unresolved_linear_team"`.
- `items_skipped += 1`.
- Continue.

### Step 4e - Linear issue handling

Find or create the weekly holding issue in the resolved Linear team only. Title
it `Vercel Comments - Week of <YYYY-MM-DD>`, where the date is the current ISO
week's Monday in UTC.

Create or update one child issue per `thread_id`. The description must include
an `<!--auto-start-->` / `<!--auto-end-->` block with the comment, author,
client, project, Vercel slug/project ID, Slack parent ts, Vercel thread URL,
reply count, last human activity, stale flag, dev lead, and PM. On updates,
preserve human content outside the auto block; if the Linear tool cannot safely
read/replace descriptions, add a Linear comment with the refreshed auto block
instead.

Use `vercel_feedback.raw_payload.linear_issue_id` for issue idempotency. Store
new Linear IDs/URLs in `raw_payload`; set `raw_payload.processing_status` to
`tracked` for new child issues or `updated` for existing child issues.

### Step 4f - Reply once in Slack

Only reply when `vercel_feedback.raw_payload.slack_reply_ts` is null and a
Linear issue URL exists.

```text
Slack:slack_send_message(
  channel_id = "C0B13QEA86M",
  thread_ts = "<parent.ts>",
  message = "Tracked in Linear: <linear_issue_url> - assigned to <dev_lead_name or 'the project team'>."
)
```

Capture the returned message timestamp as `slack_reply_ts`. If Slack send fails
after Linear succeeded, keep the Linear issue and mark the thread error detail
with `error_type = "slack_reply"`; do not retry inside the same run.

### Step 4g - Upsert `vercel_feedback`

Upsert after each thread on conflict `(external_id)`. Required column mapping:

- `external_id` = `thread_id`
- `project_id` = mapped IMS project ID, or `null` when unmapped
- `vercel_project_name` = parsed Vercel slug
- `deployment_url` = `https://vercel.live/link/<vercel_slug>.vercel.app`
- `page_url` = decoded `page_encoded` when available, otherwise `page_pretty`
- `comment` = parsed human comment body, or a short fallback when the body is unavailable
- `author_name` = parsed Slack profile real name, username, or user ID fallback
- `author_email` = parsed Slack profile email when available
- `status` = `open` for active feedback; set `resolved_at` only when closing feedback
- `submitted_at` = Slack parent timestamp converted to `timestamptz`
- `raw_payload` = merged metadata JSON

`raw_payload` must include `parent_ts`, `thread_id`, `env`, `page_pretty`,
`page_encoded`, `linear_issue_id`, `linear_issue_url`, `linear_holding_epic_id`,
`last_reply_ts`, `reply_count`, `is_stale`, `slack_reply_ts`, and
`last_synced_at`.

Preserve any existing `raw_payload.slack_reply_ts` with
`coalesce(vercel_feedback.raw_payload->>'slack_reply_ts',
excluded.raw_payload->>'slack_reply_ts')` semantics so the routine never posts
duplicate acknowledgements. Update the in-memory cached row after the SQL
succeeds.

## Step 5 - Finalize status

Determine final run status:

- `items_checked = 0 and items_errored = 0` -> `success`
- `items_errored = 0` -> `success`
- `items_errored > 0 and (items_new + items_queued) > 0` -> `partial_success`
- `items_errored > 0 and items_new = 0 and items_queued = 0` -> `failed`

Unmapped threads count as skipped, not errored, unless Supabase upsert fails.
Known-thread fast paths count only in local `items_known`; they are not
unmapped/skipped failures.

## Step 6 - Close the run log

```sql
update automation_runs set
  completed_at = now(),
  status = $status,
  items_checked = $items_checked,
  items_new = $items_new,
  items_queued = $items_queued,
  items_skipped = $items_skipped,
  items_errored = $items_errored,
  error_details = $error_details::jsonb,
  notes = $notes
where id = $run_id;
```

Set `notes` to include `stale=<items_stale>` and `unmapped=<items_skipped>`
when nonzero. Include `known=<items_known>` when the fast path skipped already
tracked threads.

If final status is `success` or `partial_success`, and `max_seen_parent_ts` is
present, persist the cursor after closing the run log:

```sql
update system_config
set value = to_jsonb($max_seen_parent_ts::text)
where key = 'vercel_comments_digest.last_successful_parent_ts';
```

## Step 7 - Failure alert

Only on `status = 'failed'`. Do not alert on `partial_success`.

If Slack user search is available, DM Harry:
`Vercel comments digest failed. Run ID <run_id>. <items_errored> errors. Query:
select error_details from automation_runs where id = '<run_id>'`. If Slack user
search is unavailable, skip the alert.

## Step 8 - Output summary

For scheduled invocation, output exactly:

```text
vercel_comments_digest: <status>
  run_id=<run_id>
  checked=<items_checked> tracked=<items_new> updated=<items_queued> skipped=<items_skipped> stale=<items_stale> errored=<items_errored>
  duration=<seconds>s
```

For manual invocation, add one plain-English summary line above the scheduled
output and show the first three error details when errors exist.

---

## Operational notes

- Apply `project_vercel_links`, `vercel_feedback`, and config rows outside this
  routine before first run. The routine checks schema but never migrates.
- Enable by setting `system_config.vercel_comments_digest.enabled` to JSON
  `true`; pause by setting it to JSON `false`.
- To triage unmapped slugs: query `vercel_feedback` rows where
  `raw_payload->>'unmapped_reason' = 'unmapped_vercel_slug'`, grouped by
  `vercel_project_name`. These are slugs where neither exact nor prefix match
  was found. Add a `project_vercel_links` row with the **base** project slug
  (e.g. `sponsero`, not the full branch slug); prefix matching will then
  resolve all future staging branch deployments automatically.
- To audit recent runs: query `automation_runs where routine_name =
  'vercel_comments_digest' and started_at >= now() - interval '7 days'`.

## Hard rules

- Never write to `imdcpjjnydbhbixyhulj`. Only use ops Supabase project
  `jcuymodyrjbzwmyjzwee`.
- Never post more than one Slack acknowledgement per Vercel thread. The
  `raw_payload.slack_reply_ts` guard is lifetime idempotency.
- Never create a Linear issue for a slug with no exact or prefix match in
  `project_vercel_links`. Write an unmapped `vercel_feedback` row so humans can
  add the base slug to `project_vercel_links`.
- Never parallelize Slack thread reads or Linear writes.
- Never auto-create the weekly holding issue outside the resolved Linear team.
- Always preserve human Linear issue content outside the auto-managed block.
- Always write an `automation_runs` row, even on kill-switch exit.
- Always treat Slack as source of truth; do not call the Vercel API.
