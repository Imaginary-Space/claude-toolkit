---
name: meeting-hourly-sweep
description: >-
  Standalone hourly routine that scans Read.ai for meetings in a rolling lookback window
  and lands them in the IMS ops Supabase (`jcuymodyrjbzwmyjzwee`) with a queue state
  (`pending` / `skipped_internal` / `skipped_no_actions` / `awaiting_readai`). Fully
  self-contained for a stateless cloud Claude Code session: schema, SQL, triage rules,
  and Slack failure-alert path are inline. Idempotent via upsert on `read_ai_id`;
  observable via `automation_runs`; pausable via the `system_config` kill switch. Use
  when a scheduler fires the routine, or when a user says "run the meeting sweep",
  "sweep Read.ai", "hourly meeting routine", "check for new meetings", or similar.
---

# Meeting hourly sweep (standalone routine)

This skill is the complete instruction set for a scheduled, unattended run. Everything needed is inline — no cross-skill references, no assumed project knowledge.

**What this routine does in one sentence:** pulls Read.ai meetings from the last N hours, saves each to Supabase with link-back fields, sets a queue state (`pending` / `skipped_*` / `awaiting_readai`), and logs the run. Nothing else.

**Transcript is the source of truth — always.** Read.ai's auto-extracted `action_items` are noisy and frequently wrong (missing items, hallucinated items, missing owners). They are treated as a **hint only**. On every meeting this routine expands the full `transcript` and the agent reads it end-to-end to extract its own list of explicit, owner-attributed commitments. That agent-derived list — not Read.ai's — is what gets written to `action_items` and what drives the triage decision. This is non-optional and applies to every meeting, every run.

**What this routine explicitly does NOT do:** no Linear writes, no Slack writes (except a single failure alert), no client-facing DB writes, no deletes, no updates to meetings already in a terminal state.

## Context (read once — minimal by design)

- **Company:** Imaginary Space (IMS) — software agency
- **Ops database:** Supabase project ID `jcuymodyrjbzwmyjzwee`
- **Meeting source:** Read.ai — the org records most client and internal calls there
- **Source of truth for config:** the `system_config` table (see Step 0)
- **Timezone for `meeting_date`:** `America/Argentina/Buenos_Aires` (team is in Buenos Aires)

## Preflight: required connectors

This routine fails fast if any of these are not available. The runner must have MCP access to:

1. `Supabase:execute_sql` — for all DB reads/writes
2. `Read:list_meetings` and `Read:get_meeting_by_id` — for pulling meeting data

Optional:

3. `Slack:slack_send_message` — only used for failure alerts. If unavailable, still run; log errors and rely on the user checking `automation_runs`.

If a required connector is missing, write a `failed` row to `automation_runs` (if Supabase is reachable) with `notes = 'missing required connector: <name>'` and exit.

## Execution discipline (cloud)

Cloud runs hit **per-turn tool limits** if the model batches work. Follow these rules literally:

- **Strictly sequential Read.ai detail:** issue at most **one** `Read:get_meeting_by_id` per round. For each ULID, complete **4a → 4a.1 (transcript read, in-model, no tool calls) → 4b (in-memory only, using the cached projects snapshot) → 4c → 4d → 4e** before calling `get_meeting_by_id` again. **Never** fire multiple `get_meeting_by_id` calls in parallel.
- **Transcript reading is in-model:** Step 4a.1 happens inside the same turn as 4a's response — no extra tool calls, no re-fetching. The agent reads the `transcript` field that came back in 4a.
- **One projects snapshot:** run the Step 4b SQL **at most once** per run, immediately before the first **Process** meeting (after any process-queue cap). Cache rows in memory for every meeting; **do not** re-query per meeting unless the first query failed.
- **No task / todo UI:** do not create or update task lists for this routine.
- **`Read:list_meetings` pagination:** fetch pages **in order** using `cursor` from the previous response only. **Never** request multiple list pages in parallel.
- **Supabase:** prefer **one** `execute_sql` per logical step (config read, run open, bulk status read, each upsert, run close). Do not split one step across many tiny calls unless required for correctness.

---

## Schema reference (inline — do not look this up elsewhere)

### `meetings` table (Supabase project `jcuymodyrjbzwmyjzwee`, schema `public`)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | PK |
| project_id | uuid | FK → projects.id, nullable |
| meeting_date | date | NOT NULL |
| title | text | |
| attendees | text[] | |
| summary | text | |
| action_items | jsonb | |
| commitments | text | |
| read_ai_score | numeric | |
| sentiment | numeric | |
| engagement | numeric | |
| **read_ai_id** | **text** | **Unique, partial index where NOT NULL. Upsert key.** |
| **report_url** | **text** | Read.ai report URL |
| **platform_id** | **text** | Google Meet code, etc. |
| **start_time** | **timestamptz** | |
| **end_time** | **timestamptz** | |
| **owner_email** | **text** | |
| **processing_status** | **text** | Check constraint: `awaiting_readai`, `pending`, `skipped_internal`, `skipped_no_actions`, `processed`, `errored` |
| **processed_at** | **timestamptz** | |
| **processing_notes** | **text** | |
| created_at | timestamptz | Auto |

### `automation_runs` table

| Column | Type |
| --- | --- |
| id | uuid, default gen_random_uuid() |
| routine_name | text, NOT NULL |
| started_at | timestamptz, default now() |
| completed_at | timestamptz |
| status | text (`running`, `success`, `partial_success`, `failed`, `killed`) |
| items_checked | integer |
| items_new | integer |
| items_queued | integer |
| items_skipped | integer |
| items_errored | integer |
| error_details | jsonb |
| notes | text |

### `system_config` table

| Column | Type |
| --- | --- |
| key | text, PK |
| value | jsonb, NOT NULL |
| description | text |
| updated_at | timestamptz |

Keys this routine reads:

- `meeting_hourly_sweep.enabled` — jsonb bool
- `meeting_hourly_sweep.lookback_hours` — jsonb int (default 12 if missing)
- `meeting_hourly_sweep.skip_titles` — jsonb array of strings

### `projects` table (read-only for this routine)

| Column | Type |
| --- | --- |
| id | uuid, PK |
| name | text |
| status | text (`active`, `paused`, `completed`, `cancelled`, `onboarding`) |

Only needed for project_id lookup in Step 4b.

---

## Step 0 — Kill switch and config

Run this single query first:

```sql
select key, value from system_config where key in (
  'meeting_hourly_sweep.enabled',
  'meeting_hourly_sweep.lookback_hours',
  'meeting_hourly_sweep.skip_titles'
);
```

Parse into local variables:

- `enabled` (bool, default `false` if row missing — fail safe)
- `lookback_hours` (int, default `12`)
- `skip_titles` (array of strings, default `[]`)

**Semantics:** `enabled: true` means the sweep **runs**. `enabled: false` means **exit** after writing the killed run row below (do not confuse “kill switch on” with “enabled on”).

If `enabled` is `false`:

```sql
insert into automation_runs (routine_name, started_at, completed_at, status, notes)
values ('meeting_hourly_sweep', now(), now(), 'killed', 'kill switch disabled');
```

Output: `⏸️ meeting_hourly_sweep.enabled is false. Exiting.` and stop.

---

## Step 1 — Open a run log

```sql
insert into automation_runs (routine_name, started_at, status)
values ('meeting_hourly_sweep', now(), 'running')
returning id;
```

Keep the returned `id` as `$run_id`. All counters (`items_checked`, `items_new`, `items_queued`, `items_skipped`, `items_errored`) start at 0 locally. Update the row at the end.

---

## Step 2 — List recent meetings from Read.ai

Compute the lookback window:

- `start_iso = (now() - lookback_hours * 3600 seconds).toISOString()`

Call:

```text
Read:list_meetings(
  start_datetime_gte = "<start_iso>",
  limit = 10,
  expand = ["metrics"]
)
```

Paginate using `cursor` (set to last meeting's `id` from the previous page) until `has_more = false` OR you've fetched 30 meetings — whichever comes first. **Never** request list pages in parallel; each page must wait for the prior response's `cursor`. If the window has more than 30 meetings, something is wrong upstream; cap the run, set `notes = 'lookback window exceeded cap of 30 — narrow lookback_hours'`, and continue processing what you have.

Collect all meeting objects into `candidates` array. Increment `items_checked` by `len(candidates)`.

If `candidates` is empty, go straight to Step 6 (close the run log with `notes = 'no meetings in lookback window'`).

---

## Step 3 — Filter out already-handled meetings

Build the array of ULIDs:

```text
ulids = [m.id for m in candidates]
```

Query current state for all of them in one shot:

```sql
select read_ai_id, processing_status from meetings where read_ai_id = any($1);
```

(Pass `ulids` as a text array.)

For each candidate, classify based on current DB state:

| Current `processing_status` | Action |
| --- | --- |
| `processed` | **Skip** — terminal, human handled it |
| `skipped_internal` | **Skip** — already triaged |
| `skipped_no_actions` | **Skip** — already triaged |
| `pending` | **Skip** — already in queue |
| `awaiting_readai` | **Process** — check if Read.ai is done now |
| `errored` | **Process** — retry |
| NULL or row doesn't exist | **Process** — new meeting |

Meetings to "Process" move to Step 4. "Skip" meetings are not touched further (`items_checked` already reflects them).

### Process queue cap (tool budget)

If more than **5** meetings are marked **Process**, only the **first 5** in stable `candidates` list order may receive `Read:get_meeting_by_id` and Steps 4a–4e this run. The rest are **deferred** (no Read fetch this run). When closing the run in Step 6, append to `notes` a clear fragment such as `deferred_3_meetings_to_next_run` where the number is how many Process ULIDs were skipped by this cap. The next hourly run will pick them up.

---

## Step 4 — For each meeting to process

**Hard requirement:** process **Process** ULIDs **one at a time** in stable list order (respecting the cap in “Process queue cap”). At most **one** `Read:get_meeting_by_id` per model turn; finish **4a → 4a.1 → 4b → 4c → 4d → 4e** for that ULID before issuing the next Read detail call. Never batch multiple `get_meeting_by_id` calls in parallel.

For each meeting ULID from Step 3 marked **Process** (after applying the cap), run Steps 4a–4e below. Wrap each in try/catch — any exception means `items_errored += 1` and push an error object to `error_details`. For Step 4a.1, an exception is anything that prevents producing a valid `action_items` list (malformed transcript, model refusal, etc.) — set `error_type = "transcript_extract"` and skip the upsert for that meeting:

```json
{
  "read_ai_id": "<ULID>",
  "title": "<title>",
  "error_type": "<fetch|transcript_extract|triage|upsert|project_lookup>",
  "error_message": "<message>",
  "step": "<which Step 4x>"
}
```

### Step 4a — Fetch full meeting data

Do **not** parallelize this step across meetings: **one** `get_meeting_by_id` invocation, then complete 4b–4e for this ULID before starting the next meeting.

```text
Read:get_meeting_by_id(
  id = "<ULID>",
  expand = ["summary", "action_items", "metrics", "key_questions", "transcript"]
)
```

`transcript` is **required**, not optional. If Read.ai omits it from the response (rare — usually means the transcript hasn't finished generating), treat the same as missing metrics → fall through to the `awaiting_readai` rule in Step 4c.

Extract:

- `read_ai_id` = response.id
- `report_url` = response.report_url
- `platform_id` = response.platform_id
- `title` = response.title
- `owner_email` = response.owner.email
- `start_time` = ISO from `response.start_time_ms`
- `end_time` = ISO from `response.end_time_ms`
- `meeting_date` = date portion of `start_time` converted to `America/Argentina/Buenos_Aires`
- `attendees` = `[p.name for p in response.participants if p.attended and p.name is not None]`
- `summary` = response.summary (may be null)
- `readai_action_items` = response.action_items (list, possibly null/empty — **hint only, do not write directly to DB**)
- `transcript` = response.transcript (list of utterances, each typically `{speaker, text, start_time_ms}` — full meeting transcript)
- `read_ai_score` = response.metrics?.read_score (may be null if still processing)
- `sentiment` = response.metrics?.sentiment
- `engagement` = response.metrics?.engagement

If Read.ai returns 404 / Not Found: record an error and continue to next meeting. Don't write anything.

### Step 4a.1 — Read the transcript and extract `action_items` (mandatory)

This step runs on **every** meeting, regardless of what `readai_action_items` contains. The agent reads the full `transcript` end-to-end and produces its own list of action items. The output of this step is what gets written to the DB column `action_items` in Step 4d.

**What counts as an action item:**

- An explicit commitment by a named person to do a specific thing.
- Verb + object (`"send the design doc"`, `"file the bug"`, `"draft the SOW"`), not vague intent (`"we should think about it"`, `"that sounds good"`).
- Owner is identifiable from the transcript — either the speaker who said `"I'll do X"` / `"I can do X"` / `"let me do X"`, or a person explicitly named (`"Maria, can you handle X?" → "yes"` → owner = Maria).
- Decisions that imply work (`"we'll go with option B"` → only an action item if a person also commits to executing it).

**What does NOT count:**

- Hypotheticals (`"we could maybe…"`, `"if X happens, then…"`).
- Aspirations without an owner (`"someone should look at that"`).
- Things already done (`"I sent it yesterday"`).
- Read.ai-hallucinated items not actually present in the transcript — drop them silently.

**How to use `readai_action_items`:** treat it as a hint. Cross-check each entry against the transcript. Keep entries that are real, fix or discard entries that aren't, and add anything Read.ai missed. Never copy `readai_action_items` to the DB unmodified.

**Output shape** (this is what goes into the `action_items` jsonb column):

```json
[
  {
    "action": "send updated SOW to Acme by EOD Friday",
    "owner": "Harry",
    "due": "2026-05-01",
    "source": "transcript",
    "evidence": "I'll get the SOW over to them by Friday."
  }
]
```

Field rules:

- `action` — short imperative phrase, required.
- `owner` — name as it appears in `attendees` when possible; null only if truly unattributed (rare — see triage rules).
- `due` — ISO date if explicitly stated in transcript, else null. Don't guess.
- `source` — always `"transcript"` for items the agent extracted; if you keep a Read.ai entry verbatim because it's accurate, use `"readai_confirmed"`.
- `evidence` — short verbatim quote (≤ ~140 chars) from the transcript that supports the item. Required. This is what reviewers use to audit the agent's extraction.

If the transcript contains zero qualifying action items, emit `[]` (empty list) — not null.

### Step 4b — Resolve `project_id` (best-effort, null is fine)

Run the query below **once** per run (before the first **Process** meeting after the cap), cache all rows in memory, and reuse for every meeting in Step 4. **Do not** re-run this SQL per meeting unless the first attempt failed.

```sql
select id, name from projects where status in ('active', 'onboarding', 'paused');
```

For each cached project row, check if the meeting `title` contains the project `name` (case-insensitive). Match rules:

- Zero matches → `project_id = null`
- Exactly one match → use that `id`
- Multiple matches → pick the longest-name match (more specific), set `processing_notes` to include a note like `ambiguous project match — picked {chosen_project_name}`

Title conventions that commonly match:

- `[Project] Tech Sync`
- `[Project] Sprint Review` / `Sprint Planning`
- `Dev Sync - [Project]`
- `Check-in Call: [Project]`
- `Project Kickoff: [Project]`

Do not attempt fuzzy matching or guessing beyond substring containment. Null is a valid, correct outcome.

### Step 4c — Triage → determine `processing_status`

Note: by this point `action_items` refers to the **agent-extracted** list from Step 4a.1, not Read.ai's raw output.

Apply rules in order — first match wins:

| Rule | Status | `processing_notes` |
| --- | --- | --- |
| `title` matches `skip_titles` from Step 0 (case-insensitive exact match OR meeting title starts with a skip title as prefix, e.g. "IMS Sync" matches "IMS Sync x Retro") | `skipped_internal` | `"internal meeting — skipped by config"` |
| `metrics` is null (i.e. `read_ai_score`, `sentiment`, `engagement` all null) **or** `transcript` was missing/empty in Step 4a | `awaiting_readai` | `"Read.ai processing incomplete at " + now()` |
| Agent-extracted `action_items` is empty (`[]`) after reading the full transcript | `skipped_no_actions` | `"transcript reviewed — no explicit owner-attributed commitments"` |
| Every entry in agent-extracted `action_items` has null `owner` | `skipped_no_actions` | `"transcript reviewed — commitments present but no owner attributable"` |
| Otherwise | `pending` | `"ready for review"` + (append `" \| unlinked meeting"` if `project_id` is null) + (append `" \| readai_action_items_diverged"` if Read.ai's hint list differed materially from the agent-extracted list — i.e. items added or removed beyond minor wording) |

### Step 4d — Upsert (with terminal-state guard)

`$6` (the `action_items` parameter below) **must** be the agent-extracted list from Step 4a.1 (jsonb-encoded), never `readai_action_items`. Use `'[]'::jsonb` for empty.

```sql
insert into meetings (
  project_id, meeting_date, title, attendees, summary, action_items, commitments,
  read_ai_id, report_url, platform_id, start_time, end_time, owner_email,
  read_ai_score, sentiment, engagement,
  processing_status, processing_notes
) values (
  $1, $2, $3, $4, $5, $6::jsonb, null,
  $7, $8, $9, $10::timestamptz, $11::timestamptz, $12,
  $13, $14, $15,
  $16, $17
)
on conflict (read_ai_id) do update set
  project_id        = coalesce(excluded.project_id, meetings.project_id),
  meeting_date      = excluded.meeting_date,
  title             = excluded.title,
  attendees         = excluded.attendees,
  summary           = coalesce(excluded.summary, meetings.summary),
  action_items      = case when jsonb_array_length(coalesce(excluded.action_items, '[]'::jsonb)) > 0
                           then excluded.action_items
                           else meetings.action_items end,
  report_url        = excluded.report_url,
  platform_id       = excluded.platform_id,
  start_time        = excluded.start_time,
  end_time          = excluded.end_time,
  owner_email       = excluded.owner_email,
  read_ai_score     = coalesce(excluded.read_ai_score, meetings.read_ai_score),
  sentiment         = coalesce(excluded.sentiment,     meetings.sentiment),
  engagement        = coalesce(excluded.engagement,    meetings.engagement),
  processing_status = excluded.processing_status,
  processing_notes  = excluded.processing_notes
where meetings.processing_status is null
   or meetings.processing_status in ('awaiting_readai', 'errored')
returning id, (xmax = 0) as inserted, processing_status;
```

`xmax = 0` is the Postgres trick for "was this an INSERT (not an UPDATE)" — use it to distinguish new rows from existing ones. The `WHERE` clause ensures we never regress a meeting that's in a terminal state (`processed`, `pending`, `skipped_*`) — those rows are left alone by the upsert.

### Step 4e — Update counters

Based on the `returning`:

- `inserted = true` → `items_new += 1`
- `processing_status = 'pending'` → `items_queued += 1`
- `processing_status` starts with `'skipped_'` → `items_skipped += 1`
- `processing_status = 'awaiting_readai'` → don't increment anything extra (retried next run)
- Zero rows returned (WHERE guard blocked the update) → don't increment anything; the existing row was already terminal

---

## Step 5 — Finalize status

Determine final `status` for the run log:

- `items_new + items_queued + items_skipped == 0 AND items_errored == 0` → `success` (with `notes = 'no new meetings to process'` when applicable)
- `items_errored == 0` → `success`
- `items_errored > 0 AND (items_new + items_queued) > 0` → `partial_success`
- `items_errored > 0 AND items_new == 0 AND items_queued == 0` → `failed`

---

## Step 6 — Close the run log

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

---

## Step 7 — Failure alert (only if status = `failed`)

Only on `status = 'failed'` — not on `partial_success`. Scheduled runs should be silent on success.

If `Slack:slack_send_message` is available:

Send a message to Harry's DM. Look up Harry's Slack user ID via:

```text
Slack:slack_search_users(query = "harry@imaginaryspace.ai")
```

Then:

```text
Slack:slack_send_message(
  channel_id = "<harry_user_id>",
  message = "⚠️ Meeting sweep failed. Run ID `<run_id>`. <items_errored> errors. Query: `select error_details from automation_runs where id = '<run_id>'`"
)
```

If Slack is unavailable: skip. The failed row in `automation_runs` is the backup signal.

---

## Step 8 — Output summary

For scheduled invocation, keep output minimal — the runner may parse stdout. Use this exact format:

```text
meeting_hourly_sweep: <status>
  run_id=<run_id>
  checked=<items_checked> new=<items_new> queued=<items_queued> skipped=<items_skipped> errored=<items_errored>
  duration=<seconds>s
```

For manual invocation (when a user triggers it from a chat), add a human summary line above:

- If nothing happened: `✅ Nothing new. Scanned <N> meetings in last <lookback_hours>h, all already handled.`
- Otherwise: `✅ Meeting sweep complete. <items_new> new / <items_queued> queued / <items_skipped> skipped / <items_errored> errored.`
- If `items_errored > 0`, show the first 3 errors inline.

---

## Operational notes (for future-me)

### How to pause the routine

```sql
update system_config set value = 'false'::jsonb, updated_at = now()
where key = 'meeting_hourly_sweep.enabled';
```

### How to expand the lookback (e.g. after an outage)

```sql
update system_config set value = '48'::jsonb, updated_at = now()
where key = 'meeting_hourly_sweep.lookback_hours';
```

### How to add a new always-skip meeting title

```sql
update system_config set value = value || '["New Meeting Title"]'::jsonb, updated_at = now()
where key = 'meeting_hourly_sweep.skip_titles';
```

### Queue state right now

```sql
select processing_status, count(*) from meetings
where meeting_date >= current_date - interval '14 days'
group by processing_status order by processing_status nulls last;
```

### Stuck in awaiting_readai for >2h (something's wrong upstream)

```sql
select title, meeting_date, created_at, read_ai_id from meetings
where processing_status = 'awaiting_readai'
  and created_at < now() - interval '2 hours';
```

### Last 7 days of runs

```sql
select date_trunc('day', started_at)::date as day,
       count(*) as runs,
       sum(items_new) as new_mtgs,
       sum(items_queued) as queued,
       sum(items_errored) as errors
from automation_runs
where routine_name = 'meeting_hourly_sweep'
  and started_at >= now() - interval '7 days'
group by 1 order by 1 desc;
```

---

## Hard rules

- **Never** create Linear issues. Not even "holding epics". That's a different skill's job.
- **Never** post to Slack except on `status = 'failed'`.
- **Never** write to `imdcpjjnydbhbixyhulj` (spaceship-control / client-facing DB). Only `jcuymodyrjbzwmyjzwee` (ops).
- **Never** delete or update meeting rows in terminal state (`processed`, `pending`, `skipped_*`). The `WHERE` guard on the upsert enforces this; don't bypass it.
- **Never** set `processing_status = 'processed'`. That's a human/review-skill decision only.
- **Never** guess a `project_id`. Null is valid and correct for internal/sales/prospect calls.
- **Always** expand `metrics` on every Read.ai call. This is the fix for the prior 60% coverage problem.
- **Always** expand `transcript` on every `get_meeting_by_id` call and read it end-to-end before triage. Read.ai's `action_items` is a hint, not a source of truth — never trust it without verifying against the transcript.
- **Always** write the agent-extracted `action_items` (with `source` and `evidence` per item) to the DB. Never write `readai_action_items` straight through.
- **Always** write an `automation_runs` row — even on kill-switch exit. Silent runs are unobservable runs.

## Definition of done

- [ ] Config read from `system_config`; kill switch respected with a `killed` run row if disabled.
- [ ] **Execution discipline:** no parallel `get_meeting_by_id`; list pages sequential; projects SQL at most once; no task/todo UI.
- [ ] If more than 5 **Process** meetings, cap applied and `notes` includes `deferred_N_meetings_to_next_run` when `N > 0`.
- [ ] Read.ai list + detail calls used with `expand` including `metrics` on list and `transcript` + full detail on get.
- [ ] For every processed meeting, the agent read the full transcript and emitted its own `action_items` (with `source` + `evidence` per item) — Read.ai's `action_items` was not written to the DB unmodified.
- [ ] Upsert applied only for non-terminal rows; counters and `automation_runs` final status match Step 5 logic.
- [ ] Slack alert sent only on `failed` (not `partial_success`), when Slack tools exist.
- [ ] Final stdout matches Step 8 format for scheduled runs.
