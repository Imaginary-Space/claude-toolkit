---
name: presentation-kit-deck
description: >-
  Builds a client presentation with scripts/presentation-kit by pulling Linear,
  IMS ops Supabase meetings and decisions, rendering the React deck to PDF, and
  uploading artifacts to Google Drive. Use for Landible tests, weekly client
  updates, roadmap readouts, decision reviews, or any routine that should turn
  live project data into a polished deck.
---

# Presentation-kit deck (standalone routine)

This skill is the complete instruction set for a stateless cloud routine that
creates one client deck from live data. It reads from Linear and IMS ops
Supabase, writes local JSON/PDF artifacts, then uploads to Drive.

**What this routine does in one sentence:** discover the right client/project,
pull recent decisions, meetings, and Linear work, compose a
`Presentation` JSON view-model, render it through `scripts/presentation-kit`,
and upload the PDF plus JSON source to Drive.

**Hard boundary:** no writes to Linear or Supabase. Google Drive upload is the
only external write.

## Required prompt inputs

The saved routine prompt should include:

- `client_name` — required, e.g. `Landible`.
- `drive_parent_folder` — required Google Drive parent folder ID or URL.
- `lookback_days` — optional, default `7`.
- `linear_hint` — optional team, project, cycle, or workspace wording.
- `meeting_date` — optional, default today in `America/Argentina/Buenos_Aires`.

If `client_name` or `drive_parent_folder` is missing, stop and ask the user for
it. Do not render a deck without a Drive destination.

## Required connectors

The routine needs MCP access to:

1. **Supabase** — read-only SQL against IMS ops project `jcuymodyrjbzwmyjzwee`.
2. **Linear** — read issues, projects, cycles, teams, comments.
3. **Google Drive** — create/find folder and upload files.

If a connector is unavailable, continue only for optional data. Missing Drive is
fatal because upload is part of the output contract.

## Local output contract

Use these paths from repo root:

- JSON source: `out/<client-slug>-<YYYY-MM-DD>.json`
- PDF deck: `out/<client-slug>-<YYYY-MM-DD>.pdf`
- HTML preview: generated automatically beside the PDF

Render command:

```bash
./scripts/build-presentation.sh out/<client-slug>-<YYYY-MM-DD>.json out/<client-slug>-<YYYY-MM-DD>.pdf
```

## Step 0 — Normalize run inputs

1. Slugify `client_name` for filenames: lowercase, alphanumeric and hyphens.
2. Resolve `lookback_start = meeting_date - lookback_days`.
3. Use timezone `America/Argentina/Buenos_Aires` for date labels.
4. Keep a `data_gaps` list in memory. Every unavailable source becomes one
   concise gap; never fill numbers or decisions from guesses.

## Step 1 — Discover IMS ops schema

Use Supabase read-only SQL against project `jcuymodyrjbzwmyjzwee`.

First discover relevant tables/columns:

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    table_name ilike '%client%'
    or table_name ilike '%project%'
    or table_name ilike '%meeting%'
    or table_name ilike '%decision%'
    or table_name ilike '%presentation%'
  )
order by table_name, ordinal_position;
```

Then identify:

- Client/project tables (`clients`, `projects`, or equivalent).
- Meetings table. The meeting sweep uses `meetings` with `project_id`,
  `meeting_date`, `title`, `summary`, `action_items`, `commitments`,
  `report_url`, and `processing_status`.
- Decisions table(s), if present. Prefer rows with project/client references,
  status, decision text, owner, source meeting, and timestamps.

If a decisions table exists in the IMS ops dashboard but the naming differs,
infer it from columns, not from table names alone.

## Step 2 — Resolve client/project

Use discovered schema to find the target client:

1. Match `client_name` case-insensitively against client/project names and
   aliases when available.
2. If multiple matches exist, choose the closest exact company/client match.
3. Cache the resolved `client_id`, `project_id`, display name, company, and any
   Linear metadata columns.
4. If no match exists, continue with Linear-only data and add a gap:
   `IMS ops client/project not found for <client_name>`.

## Step 3 — Pull Supabase meetings and decisions

Pull only small, deck-ready rows for the resolved project/client and lookback.

Meetings query shape:

```sql
select id, project_id, meeting_date, title, summary, action_items,
       commitments, report_url, processing_status, created_at
from public.meetings
where meeting_date >= <lookback_start>
  and (<project/client predicate>)
order by meeting_date desc
limit 12;
```

Decision query shape depends on discovered columns. Prefer:

- text/title/body of the decision
- status (`open`, `decided`, `needs_client`, etc.)
- owner or assignee
- source meeting/report URL
- project/client foreign key
- created/decided date

If there is no decisions table, mine `meetings.summary`, `meetings.commitments`,
and structured `action_items` for explicit decisions/asks. Label these as
`meeting-derived` in internal notes; do not present them as formal decisions.

## Step 4 — Pull Linear

Use Linear MCP read-only operations.

1. Resolve team/project/cycle using `linear_hint`, client name, project name, or
   issue labels.
2. Pull active cycle if available; otherwise pull issues updated/completed in
   the lookback window.
3. Categorize:
   - `shipped`: completed/done during lookback, include identifier, title, URL,
     estimate/story points, and impact if the issue includes useful context.
   - `in_progress`: active/in review/in progress issues.
   - `blocked`: blocked, waiting on client/vendor, or needs decision.
   - `demo_slots`: issues/comments with Loom, YouTube, Vimeo, or demo links.
4. Prefer exact filters. If exact filtering is unavailable, pull a wider set and
   curate; never invent issues.

## Step 5 — Compose Presentation JSON

Write a JSON object matching
`scripts/presentation-kit/src/types/presentation.ts`.

Required top-level shape:

```json
{
  "id": "landible-2026-04-30",
  "title": "Landible Weekly Update",
  "project_id": "<ops project id or client slug>",
  "linear_cycle_id": null,
  "sprint_name": null,
  "meeting_date": "2026-04-30",
  "meeting_type": "Client update",
  "cycle_name": null,
  "cover_data": {},
  "timeline_data": {},
  "velocity_data": {},
  "sprint_scope_data": {},
  "recap_data": {},
  "dev_updates_data": {},
  "closing_data": {},
  "created_at": "<ISO timestamp>",
  "client": null
}
```

Mapping rules:

- `cover_data`: `heroText` as week/cycle label, `team` as `Imaginary Space ×
  <Client>`, `date`, and `cycle`.
- `timeline_data`: roadmap milestones when present in Linear projects or ops
  tables. Omit entirely if no trustworthy milestones exist.
- `velocity_data`: story-point totals and weekday cumulative arrays. If Linear
  estimates are absent, omit this block and add a gap.
- `sprint_scope_data`: done/in-progress points, new mid-sprint points, remaining
  plus next-cycle points, and a short `newItems` list.
- `recap_data.shipped`: top 3-5 shipped Linear items with impact.
- `recap_data.blockers`: blocked Linear issues plus decisions/asks needing
  client action. Use `pill: "client"` for client asks, `pill: "vendor"` for
  vendor/external waits.
- `dev_updates_data.slots`: up to two video/demo links from Linear comments or
  meeting notes. Omit if no real URLs exist.
- `closing_data`: `heroText`, `thankYou`, `teamLine`, and `dateLine`.

Keep slide text short. Prefer identifiers and evidence links in JSON fields
over long paragraphs.

## Step 6 — Render

Run:

```bash
./scripts/build-presentation.sh out/<client-slug>-<YYYY-MM-DD>.json out/<client-slug>-<YYYY-MM-DD>.pdf
```

If rendering fails, inspect the local error, fix the JSON shape or missing
required fields, and retry once. If it still fails, report the failure and do
not upload a broken artifact.

## Step 7 — Upload to Drive

In `drive_parent_folder`, create or reuse:

```text
<Client Name> - YYYY-MM-DD
```

Upload:

1. `out/<client-slug>-<YYYY-MM-DD>.pdf`
2. `out/<client-slug>-<YYYY-MM-DD>.json`
3. optional `out/<client-slug>-<YYYY-MM-DD>.html` if useful for debugging

Return Drive links in the final response.

## Landible test prompt

Use this saved prompt for the first test routine:

```text
Run the presentation-kit-deck skill for client Landible.
Lookback: 7 days.
Drive parent folder: <LANDIBLE_PRESENTATIONS_FOLDER_ID_OR_URL>.
Connectors: Linear, Supabase (IMS ops jcuymodyrjbzwmyjzwee), Google Drive.
Success criteria: PDF and JSON uploaded to Drive; final response includes links
and a short changelog of data pulled vs gaps.
```

Expected first-run gaps to report, not guess around:

- Missing or invalid Landible Drive parent folder.
- No exact Landible match in IMS ops client/project tables.
- Decisions schema exists under an unexpected table name and needs schema
  discovery before querying.
- No Linear team/project/cycle match for Landible without `linear_hint`.
- Linear estimates/story points unavailable, which means omit `velocity_data`
  and note the gap instead of fabricating velocity.

## Definition of done

- `out/<client-slug>-<YYYY-MM-DD>.pdf` renders successfully.
- PDF and JSON are uploaded to Drive under the dated client folder.
- Final response includes Drive links and a concise data-gap changelog.
- No Linear or Supabase writes were performed.
