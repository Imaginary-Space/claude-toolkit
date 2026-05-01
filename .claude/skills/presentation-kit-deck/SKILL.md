---
name: presentation-kit-deck
description: >-
  Builds a client presentation with scripts/presentation-kit by pulling Linear,
  IMS ops Supabase meetings and decisions, rendering the React deck to PPTX, and
  uploading artifacts to Google Drive. Use for Landible tests, weekly client
  updates, roadmap readouts, decision reviews, or any routine that should turn
  live project data into a polished deck.
---

# Presentation-kit deck (standalone routine)

This skill is the complete instruction set for a stateless cloud routine that
creates one client deck from live data. It reads from Linear and IMS ops
Supabase, writes local JSON/PPTX artifacts, then uploads to Drive.

**What this routine does in one sentence:** discover the right client/project,
pull recent decisions, meetings, and Linear work, compose a
`Presentation` JSON view-model, render it through `scripts/presentation-kit`,
and upload the PowerPoint deck plus JSON source to Drive.

**Hard boundary:** no writes to Linear or Supabase. Google Drive upload is the
only external write.

## Required prompt inputs

The saved routine prompt should include:

- `client_name` — required, e.g. `Landible`.
- `drive_parent_folder` — optional when
  `GOOGLE_DRIVE_PRESENTATIONS_FOLDER_ID` is set; otherwise required Google
  Drive parent folder ID or URL.
- `lookback_days` — optional, default `7`.
- `linear_hint` — optional team, project, cycle, or workspace wording.
- `meeting_date` — optional, default today in `America/Argentina/Buenos_Aires`.

If `client_name` is missing, stop and ask the user for it. Resolve the Drive
parent from `drive_parent_folder` first, then
`GOOGLE_DRIVE_PRESENTATIONS_FOLDER_ID`. Do not render a deck without a Drive
destination.

## Required connectors

The routine needs MCP access to:

1. **Supabase** — read-only SQL against IMS ops project `jcuymodyrjbzwmyjzwee`.
2. **Linear** — read issues, projects, cycles, teams, comments.
3. **Slack** — read client-facing and internal project channels for recent
   relationship context, decisions, asks, blockers, and sentiment.

Drive upload does **not** use the Google Drive MCP connector because large deck
uploads through base64 tool payloads are unreliable. Instead, Drive upload uses
`scripts/drive-upload.mjs`, which streams bytes to the Google Drive API with a
service account.

Required settings for Drive upload:

- `GOOGLE_SERVICE_ACCOUNT_JSON_B64` — base64-encoded full service account JSON.
- `GOOGLE_DRIVE_PRESENTATIONS_FOLDER_ID` — default parent folder ID, unless the
  prompt provides `drive_parent_folder`.

The Drive API must be enabled for the service account's Google Cloud project,
and the target parent folder must be shared with the service account email.

## Local output contract

Use these paths from repo root:

- JSON source: `out/<client-slug>-<YYYY-MM-DD>.json`
- PPTX deck: `out/<client-slug>-<YYYY-MM-DD>.pptx`
- HTML preview: generated automatically beside the PPTX

The final Drive deck artifact must be the native editable `.pptx`. Do not upload
a PDF as the final client deck; only create PDFs as explicitly requested
local/reference exports. Do not rasterize PDF/HTML into PowerPoint and do not
write one-off PPTX builders under `out/`; the presentation-kit renderer already
creates editable PowerPoint text, shapes, chart-like objects, lines, and images.

Render command:

```bash
./scripts/build-presentation.sh out/<client-slug>-<YYYY-MM-DD>.json out/<client-slug>-<YYYY-MM-DD>.pptx
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

## Step 5 — Pull Slack relationship context

Use the Slack MCP connector when it is attached. The goal is not to dump chat
into the deck; it is to understand the relationship, open loops, tone, and
client-visible commitments so the recommendations and asks are current.

Channel discovery:

1. Search channel names for normalized `client_name`, project name, Linear team
   key, and common slug variants:
   - lowercase
   - spaces/underscores removed
   - spaces converted to hyphens
   - client aliases from IMS ops, if available
2. Prefer exact or near-exact client/project channels, especially shared/client
   channels like `#client-name`, `#client-name-project`, `#proj-client-name`, or
   account/team-specific variants.
3. If multiple plausible channels exist, read small samples from each and choose
   the one with the clearest recent client/project discussion. If still
   ambiguous, use the safest exact match and add a data gap:
   `Slack channel match ambiguous for <client_name>; used <channel>`.
4. If no Slack connector or no plausible channel exists, continue and add a gap:
   `Slack context unavailable for <client_name>`.

Message pull:

1. Pull recent channel messages for the same `lookback_days` window, plus a
   small buffer (up to 14 days total) if the channel is quiet.
2. If threads are available, expand only threads that mention blockers,
   decisions, approvals, access, deliverables, timelines, client feedback, or
   launch risk.
3. Keep the read bounded: collect enough context to identify the relationship
   state and open loops, not full chat history.
4. Do not write to Slack from this routine.

Extract into internal notes:

- `relationship_pulse`: tone, confidence, urgency, and whether the client seems
  aligned, confused, blocked, waiting, or escalating.
- `client_asks`: questions or requests from the client that need answers.
- `ims_asks`: requests IMS has made of the client that are still open.
- `commitments`: dates, follow-ups, or deliverables promised in Slack.
- `risks`: anything that could affect trust, timing, scope, approvals, access,
  or launch readiness.
- `useful_links`: Slack-shared links to Looms, docs, previews, builds, Drive,
  Vercel, Linear, or other artifacts.

Use Slack context carefully:

- Let it inform `asks_data`, `recommendations_data`, and speaker/evidence notes.
- Only put client-safe, non-sensitive summaries into visible slide text.
- Do not quote private/internal Slack messages verbatim unless the message is
  clearly client-facing and appropriate for the deck.
- If Slack conflicts with Linear or Supabase, prefer the source of record for
  status numbers, but mention the mismatch in data gaps or internal notes.

## Step 6 — Compose Presentation JSON

Write a JSON object matching
`scripts/presentation-kit/src/types/presentation.ts`.

The deck always renders the **seven-slide tech-sync layout**: cover, timeline,
numbers, this-week, recommendations, asks, closing. Slides 2–6 share a small-caps
ribbon (`footer_label`) such as `LANDIBLE · CYCLE 21 · APR 30, 2026`; the CLI
derives one from `client.company` / `cycle_name` / `meeting_date` if you omit
it.

Content guardrails:

- Timeline is a broad status narrative: where we are, where we are going, and
  what stage the project is in. Do not break it down into individual Linear
  issues, implementation tasks, or ticket-sized rows.
- Timeline should show 3-5 tracks maximum. Each track is a durable workstream
  or phase, not a feature checklist. Avoid color-key-heavy Gantt charts.
- Use short, plain titles. Aim for 3-6 words for slide titles and 1-3 words for
  timeline row labels; never pack status, dates, and details into the title.
- Let details live in speaker notes, JSON evidence fields, links, or the
  recommendations/asks slides. The visible deck should read like an executive
  sync, not a task export.

Required top-level shape:

```json
{
  "id": "landible-2026-04-30",
  "title": "Landible Cycle 21 Tech Sync",
  "project_id": "<ops project id or client slug>",
  "linear_cycle_id": null,
  "sprint_name": null,
  "meeting_date": "2026-04-30",
  "meeting_type": "Tech Sync",
  "cycle_name": "Cycle 21",
  "footer_label": "LANDIBLE · CYCLE 21 · APR 30, 2026",
  "cover_data": {},
  "timeline_data": {},
  "numbers_data": {},
  "workstreams_data": {},
  "recommendations_data": {},
  "asks_data": {},
  "closing_data": {},
  "created_at": "<ISO timestamp>",
  "client": null
}
```

Mapping rules:

- `cover_data`: `heroText` is the client name in caps, `team` is
  `IMAGINARY SPACE × <CLIENT>`, `date` is the meeting date in caps, and
  `cycle` is a one-line cycle/phase descriptor (e.g.
  `CYCLE 21 · TECH SYNC · PHASE 2 · WEEK 2 OF 4`). The top-right image slot is
  optional but preferred; fill `coverImageUrl` and `coverImagePrompt` via Step 6.
- `timeline_data`: section eyebrow is auto `01 · TIMELINE`. Set
  `title` (e.g. "Phase 2 progress"), `dates` (broad labels like `Now`, `Next`,
  `Then`, `Launch`), `todayColumn` (zero-indexed), and `sections[]` with 3-5
  track rows whose `cells` are `"done" | "ongoing" | "future" | "empty"`.
  Although the JSON property is named `tasks`, each row should be a track or
  stage like `Platform`, `QA`, `Launch prep`, or `Phase 3`, not an individual
  ticket. Use only one `ongoing` cell per track when possible so the slide reads
  as current status, not a dense schedule. Optional `callout` adds an "ON PACE"
  / status line at the bottom.
- `numbers_data`: section eyebrow is auto `02 · NUMBERS`. Provide `title` plus
  `stats[]` (4 cards of `{ value, label, context }` like
  `{"value":"8 / 27","label":"ISSUES COMPLETE","context":"30% of scope"}`).
  Optional `breakdownTitle` + `breakdown[]` renders status bars beneath. If
  Linear estimates are unavailable, omit `breakdown` and add a gap.
- `workstreams_data`: section eyebrow is auto `03 · THIS WEEK`. Provide `title`
  and `workstreams[]` of `{ id, name, impact, status, points }` for the 2–4
  active items. This slide should answer "what is moving right now," not list
  every ticket. Optional `callout` (e.g. `{"label":"TARGET","text":"Both QA
  streams shipping by Friday."}`).
- `recommendations_data`: section eyebrow is auto `04 · RECOMMENDATIONS`.
  Provide `title`, optional `subtitle`, and `recommendations[]` of
  `{ title, rationale, impact, priority }`. Use this for IMS guidance: tradeoff
  calls, sequencing advice, launch-readiness recommendations, and risk
  reduction. Incorporate Slack relationship context when it changes the client
  success risk, sequencing, or communication plan. Keep to 2–4 recommendations
  and make the first item the strongest / highest-leverage one. Optional
  `callout` is
  `{ "label": "WHY NOW", "text": "..." }`.
- `asks_data`: section eyebrow is auto `05 · ASKS`. Provide `title` and
  grouped `groups[]` such as urgent blockers, access needed, and upcoming
  input. Each group is `{ label, tone, summary, items }`, where `tone` is one of
  `urgent`, `access`, `upcoming`, or `default`, and each item is
  `{ ask, detail, owner, priority }`. Use flat `asks[]` only for legacy/simple
  decks. Source from open decisions, blocked Linear issues, Slack open loops,
  access requests, and upcoming client dependencies.
- `closing_data`: `heroText` (e.g. `LET'S BUILD`), `thankYou`, `teamLine`,
  and `dateLine`. The top-right image slot is optional but preferred; fill
  `closingImageUrl` and `closingImagePrompt` via Step 6.

Keep slide text short. Prefer identifiers and evidence links in JSON fields
over long paragraphs.

## Step 7 — Generate cover / closing images

If `FAL_AI_API_KEY` or `FAL_KEY` is available, use the bundled FAL image helper
for the cover and closing top-right image slots before rendering:

```bash
node scripts/presentation-images.mjs generate out/<client-slug>-<YYYY-MM-DD>.json \
  --client-context "<what the client does, their domain, and the product/workflow being built>"
```

The `--client-context` value should come from the data already gathered in this
routine: client/project description, meeting summaries, Linear project
description, active workstreams, and any user-provided context. If the context
is long, write it to `out/<client-slug>-context.txt` and pass
`--client-context-file out/<client-slug>-context.txt` instead.

The helper combines that business context with deck JSON, calls FAL
`fal-ai/nano-banana-2` by default, downloads generated images into
`out/<client-slug>-<YYYY-MM-DD>-assets/`, and patches:

- `cover_data.coverImageUrl`
- `cover_data.coverImagePrompt`
- `closing_data.closingImageUrl`
- `closing_data.closingImagePrompt`

Generated images are then inlined into the HTML/PPTX during render, so the final
PPTX is self-contained.

If you need to inspect or override prompts, print them first:

```bash
node scripts/presentation-images.mjs prompts out/<client-slug>-<YYYY-MM-DD>.json \
  --client-context "<what the client does, their domain, and the product/workflow being built>"
```

If FAL is unavailable but another image-generation tool exists, use the printed
prompts and attach the generated local file paths or hosted URLs:

```bash
node scripts/presentation-images.mjs attach out/<client-slug>-<YYYY-MM-DD>.json \
  --cover <generated-cover-path-or-url> \
  --closing <generated-closing-path-or-url>
```

Generated images use the fixed house prompt in `scripts/presentation-images.mjs`:
a hand-drawn isometric schematic diagram of the client's business context with
only 2-3 clean assets, lots of negative space, and the slide brand palette
(`#FFFFFF`, `#0A0A0A`, `#171717`, `#E5E5E5`, `#F05100`). Cover theme is energy
/ launch momentum; closing theme is "let's get to work" readiness. Do not
invent a separate image direction for this routine; only feed the helper the
client name and client-business context.

If image generation is unavailable, leave the image fields blank and continue;
do not block the deck.

## Step 8 — Render

Run:

```bash
./scripts/build-presentation.sh out/<client-slug>-<YYYY-MM-DD>.json out/<client-slug>-<YYYY-MM-DD>.pptx
```

If rendering fails, inspect the local error, fix the JSON shape or missing
required fields, and retry once. If it still fails, report the failure and do
not upload a broken artifact. Do not fall back to PDF-to-PPTX, HTML screenshots,
or full-slide image exports because those are not editable client decks.

## Step 9 — Upload to Drive

Never base64 encode PPTX, HTML, or JSON artifacts for upload. Do not create
`.b64` files and do not read encoded artifacts back into the model context.
Upload the native editable PowerPoint file as the final deck artifact; do not
substitute a PDF, screenshot deck, or image-only PPTX for Drive delivery.

Resolve `drive_parent_folder` from the prompt or
`GOOGLE_DRIVE_PRESENTATIONS_FOLDER_ID`. In that parent, create or reuse:

```text
<Client Name> - YYYY-MM-DD
```

Use the service-account uploader from repo root:

```bash
folder_json="$(node scripts/drive-upload.mjs ensure-folder --parent "$DRIVE_PARENT_FOLDER_ID" --name "<Client Name> - YYYY-MM-DD")"
folder_id="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<<"$folder_json")"

node scripts/drive-upload.mjs upload --file "out/<client-slug>-<YYYY-MM-DD>.pptx" --parent "$folder_id" --mime "application/vnd.openxmlformats-officedocument.presentationml.presentation"
node scripts/drive-upload.mjs upload --file "out/<client-slug>-<YYYY-MM-DD>.json" --parent "$folder_id" --mime "application/json"
```

The uploader prints Drive file JSON including `webViewLink`; capture those links
for the final response.

Upload:

1. `out/<client-slug>-<YYYY-MM-DD>.pptx`
2. `out/<client-slug>-<YYYY-MM-DD>.json`
3. optional `out/<client-slug>-<YYYY-MM-DD>.html` if useful for debugging

Return Drive links in the final response.

## Landible test prompt

Use this saved prompt for the first test routine:

```text
Run the presentation-kit-deck skill for client Landible.
Lookback: 7 days.
Drive parent folder: use GOOGLE_DRIVE_PRESENTATIONS_FOLDER_ID unless explicitly overridden.
Connectors: Linear, Supabase (IMS ops jcuymodyrjbzwmyjzwee).
Success criteria: PPTX and JSON uploaded to Drive; final response includes links
and a short changelog of data pulled vs gaps.
```

Expected first-run gaps to report, not guess around:

- Missing or invalid Landible Drive parent folder.
- No exact Landible match in IMS ops client/project tables.
- Decisions schema exists under an unexpected table name and needs schema
  discovery before querying.
- No Linear team/project/cycle match for Landible without `linear_hint`.
- Linear estimates/story points unavailable, which means omit
  `numbers_data.breakdown` (or the affected stat cards) and note the gap
  instead of fabricating numbers.

## Definition of done

- `out/<client-slug>-<YYYY-MM-DD>.pptx` renders successfully.
- PPTX and JSON are uploaded to Drive under the dated client folder.
- Final response includes Drive links and a concise data-gap changelog.
- No Linear or Supabase writes were performed.
