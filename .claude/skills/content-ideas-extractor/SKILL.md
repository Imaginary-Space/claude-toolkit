---
name: content-ideas-extractor
description: >-
  Extracts guarded content ideas from already-processed Read.ai meetings into
  the IMS ops Supabase. Use after process-meeting-queue succeeds, or when asked
  to extract content ideas, mine a meeting for content, or backfill content from
  meetings.
context: fork
agent: general-purpose
---

# Content ideas extractor

Mines processed IMS meeting transcripts for raw content material: quotable client
moments, before/after stories, surprising insights, teardown angles, and standout
stats. It writes structured rows to `public.content_ideas` in the IMS ops
Supabase project.

This is a downstream enrichment step. It must never block, reclassify, or
overwrite the core meeting extraction process.

## Operating contract

- **Project:** Supabase `jcuymodyrjbzwmyjzwee`
- **Source:** Read.ai meeting transcript via `meetings.read_ai_id`
- **Destination:** `public.content_ideas`
- **Run log:** `public.automation_runs` with `routine_name = 'content-ideas-extractor'`
- **Required connectors:** Supabase `execute_sql`, Read.ai `get_meeting_by_id`
- **Optional connector:** Slack only if the parent routine wants failure alerts

## Invocation modes

Support these modes:

- Single meeting by `meeting_id`
- Single meeting by `read_ai_id`
- Backfill processed meetings from the last N days
- Backfill processed meetings for a specific client

If invoked from `process-meeting-queue`, run only after the main meeting analysis
has completed successfully and the meeting row is already marked `processed`.

## Hard safety rules

1. **Non-blocking:** failures only update this extractor's `automation_runs` row.
   Do not change `meetings.processing_status`, `processed_at`, `action_items`,
   `commitments`, or other core meeting fields.
2. **Processed-only:** exit without extraction unless
   `meetings.processing_status = 'processed'`.
3. **Kill switch:** read `system_config.content_ideas_extractor.enabled` before
   doing work. If missing or false, log `status = 'killed'` and stop.
4. **Idempotent:** if rows already exist for `source_meeting_id`, skip unless an
   explicit force mode is requested.
5. **Internal meetings:** if attendees are all IMS/internal domains, write zero
   content ideas and log `skipped - internal meeting`.
6. **Consent first:** default `do_not_publish = true` unless an explicit client
   policy says content is publishable.
7. **Raw quotes stay raw:** `raw_quote` must be verbatim from the transcript. Do
   not clean, paraphrase, translate, or compress it.
8. **No drafting:** do not generate LinkedIn posts or long-form scripts. Store
   raw material only.

## Schema reference

### `meetings`

Read only:

| Column | Notes |
| --- | --- |
| `id` | Source meeting UUID |
| `read_ai_id` | Read.ai meeting identifier |
| `project_id` | Required for denormalized idea rows when available |
| `attendees` | Used for internal-meeting skip |
| `processing_status` | Must be `processed` |

### `projects`

Read only:

| Column | Notes |
| --- | --- |
| `id` | Joined from `meetings.project_id` |
| `client_id` | Used to find the client |
| `name` | Useful context for extraction |

### `clients`

Read only:

| Column | Notes |
| --- | --- |
| `id` | Denormalized into `content_ideas.client_id` |
| `name` | Denormalized into `content_ideas.client_name` |
| `primary_domain` | Helpful for internal/client attendee checks if present |

### `content_ideas`

Expected columns:

| Column | Notes |
| --- | --- |
| `source_meeting_id` | Required FK to `meetings.id` |
| `project_id` | From meeting |
| `client_id` | From project/client lookup |
| `client_name` | Stored for fast review |
| `idea_type` | `quote`, `story`, `insight`, `teardown`, or `stat` |
| `hook` | Required one-line opener |
| `raw_quote` | Verbatim transcript quote when available |
| `speaker` | Speaker name from transcript |
| `timestamp_in_meeting` | `HH:MM:SS` if available |
| `context` | Why the moment matters |
| `suggested_format` | `linkedin_post`, `youtube_short`, `tweet`, `long_video`, or `blog` |
| `status` | Default `new` |
| `priority` | Integer 1-5 |
| `do_not_publish` | Hard guard |
| `do_not_publish_reason` | Required when guarded |
| `extracted_by` | Invoker label, e.g. `process-meeting-queue` |

If a schema differs, inspect `information_schema.columns` once and adapt without
changing unrelated tables.

## Client publishing policy

Prefer explicit policy over name heuristics. Read
`system_config.content_ideas_extractor.client_policy` if it exists. Expected
shape:

```json
{
  "default_do_not_publish": true,
  "clients": {
    "FeltSense": {
      "do_not_publish": false,
      "reason": "approved for anonymized and named case-study content"
    },
    "53 Stations": {
      "do_not_publish": true,
      "reason": "no LinkedIn name-drops without written approval"
    }
  }
}
```

If the policy row is absent, malformed, or does not mention the client, use:

- `do_not_publish = true`
- `do_not_publish_reason = 'client consent unclear - confirm before publishing'`

Always guard these cases unless an explicit policy overrides them:

- Pritzker
- 53 Stations
- Financial services clients
- Meetings tagged or titled confidential

## Workflow

### Step 1 - Open run log and read config

Read:

```sql
select key, value
from system_config
where key in (
  'content_ideas_extractor.enabled',
  'content_ideas_extractor.client_policy'
);
```

If `content_ideas_extractor.enabled` is missing or not `true`, insert a killed
`automation_runs` row and stop.

### Step 2 - Resolve candidate meetings

For a single meeting ID, load the meeting with project/client context:

```sql
select
  m.id,
  m.read_ai_id,
  m.project_id,
  m.attendees,
  m.title,
  m.processing_status,
  p.client_id,
  p.name as project_name,
  c.name as client_name,
  c.primary_domain
from meetings m
left join projects p on p.id = m.project_id
left join clients c on c.id = p.client_id
where m.id = $1;
```

For `read_ai_id`, use `where m.read_ai_id = $1`. For backfills, select only
processed meetings and exclude meetings that already have content ideas:

```sql
select m.id
from meetings m
where m.processing_status = 'processed'
  and m.processed_at >= now() - ($1::int * interval '1 day')
  and not exists (
    select 1 from content_ideas ci where ci.source_meeting_id = m.id
  )
order by m.processed_at desc
limit 25;
```

Process backfill meetings sequentially to avoid connector and token pressure.

### Step 3 - Preflight each meeting

For each candidate:

- If `processing_status != 'processed'`, skip with notes
  `skipped - meeting not processed`.
- If `read_ai_id` is empty, skip with notes `skipped - missing read_ai_id`.
- If attendees are all internal IMS addresses/domains, skip with notes
  `skipped - internal meeting`.
- If existing rows are found and force mode is not explicit, skip with notes
  `skipped - ideas already exist`.

Internal domains include `imaginaryspace.com` and obvious IMS team-only attendee
names when emails are unavailable.

### Step 4 - Fetch transcript

Call Read.ai `get_meeting_by_id` for the meeting's `read_ai_id`. Use the returned
transcript from that response. Do not call Read.ai twice for the same meeting in
one run.

If the transcript is missing or empty, log a failed item with notes
`missing transcript` and continue to the next candidate.

### Step 5 - Extract ideas

Read the transcript end-to-end and produce JSON only:

```json
{
  "ideas": [
    {
      "idea_type": "quote",
      "hook": "Founder of X just told us this on a call.",
      "raw_quote": "We used to spend three days a week just on research. Now Harry's agent does it in twelve minutes.",
      "speaker": "Jamie Patel",
      "timestamp_in_meeting": "00:14:32",
      "context": "Client described how the v2 deal sourcing build changed analyst workflow.",
      "suggested_format": "linkedin_post",
      "priority": 4
    }
  ]
}
```

Idea types:

- `quote`: client said something quotable about results, AI, or transformation
- `story`: concrete before/after narrative with a turning point
- `insight`: surprising technical or operational lesson
- `teardown`: workflow or build worth unpacking long-form
- `stat`: specific metric, time saved, cost reduced, or throughput change

Aim for 3-5 strong ideas per meeting. If nothing is strong, write zero rows.
Never pad.

### Step 6 - Validate rows

Reject an idea if:

- `idea_type` is not one of the five allowed values
- `hook` is empty
- `priority` is not an integer from 1 to 5
- `raw_quote` is present but not traceable to the transcript
- `suggested_format` is outside the allowed set

Apply the publishing policy to every accepted row:

- Set `do_not_publish`
- Set `do_not_publish_reason` whenever `do_not_publish = true`
- Copy `source_meeting_id`, `project_id`, `client_id`, and `client_name`
- Set `status = 'new'`
- Set `extracted_by` to the invoker label

Priority guide:

| Priority | Use when |
| --- | --- |
| 5 | Explicitly publishable, high-trust named client, very strong quote/stat |
| 4 | Strong stat, story, or quote from an active client |
| 3 | Solid niche insight or teardown |
| 2 | Weak but possibly useful |
| 1 | Usually avoid; only keep if clearly reviewable |

### Step 7 - Insert in one batch

Insert accepted ideas in one Supabase call per meeting. If force mode is explicit,
delete existing ideas for that `source_meeting_id` immediately before inserting
replacement rows. Do not delete unless force is explicitly requested.

### Step 8 - Close run log

Update `automation_runs` with:

- `status`: `success`, `partial_success`, `failed`, or `killed`
- `items_checked`: candidate meetings considered
- `items_new`: ideas inserted
- `items_skipped`: meetings or ideas skipped
- `items_errored`: failed meeting extractions
- `error_details`: structured error JSON when applicable
- `notes`: concise human-readable summary

## Standalone examples

```text
Run the content-ideas-extractor skill for meeting_id <uuid>.
Run the content-ideas-extractor skill for read_ai_id <read_ai_id>.
Run the content-ideas-extractor skill as a 30 day backfill.
Run the content-ideas-extractor skill for client FeltSense over the last 90 days.
Run the content-ideas-extractor skill for meeting_id <uuid> with force mode.
```

## What not to do

- Do not run on meetings that are not processed.
- Do not insert ideas for internal-only IMS meetings.
- Do not infer publishing consent from enthusiasm in the transcript.
- Do not draft final social posts.
- Do not mutate the meeting processing pipeline.
