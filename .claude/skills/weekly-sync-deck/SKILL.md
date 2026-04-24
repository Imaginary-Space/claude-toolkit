---
name: weekly-sync-deck
description: >-
  Builds a weekly client/management sync slide deck from Linear + Supabase via
  MCP connectors, renders a PDF with Marp, and prepares content for Google Drive
  upload. Use for Thursday (or any) recurring syncs, roadmap-vs-reality
  updates, sprint shipped summaries, demo slots, blockers/asks, and close-out.
---

# Weekly sync deck (AI agency, fast ship cadence)

Use this skill when a cloud (or local) session must produce a **single PDF deck** for stakeholders: management timeline check, what shipped, demos, discussion, clean close.

Further context: [`docs/presentations.md`](../../../docs/presentations.md).

## Principles

- **One headline per slide**; bullets are evidence (links, IDs, numbers), not prose essays.
- **Shipped = verifiable** (Linear issues/PRs). **Metrics = read-only** Supabase pulls—never mutate client data from this workflow.
- **Demos get explicit owner slides** so engineers know what to screen-share.
- **Discussion slide** separates blockers, asks, and open debate—client-facing clarity.

## Slide order (target 8–12 slides)

| # | Slide | Source / notes |
| --- | --- | --- |
| 1 | Title | Team/client name, meeting date. |
| 2 | Roadmap vs reality | Roadmap doc or agreed milestones vs actual progress; call out drift. |
| 3 | Shipped this sprint | Linear: completed in current cycle or last ~7 days (team convention). |
| 4 | In flight & blocked | Linear: in progress; blocked or needs decision (labels/state). |
| 5 | Live metrics | Supabase: 2–4 KPIs the client cares about (use agreed tables/views only). |
| 6–n | Demo slots | One slide per demo; name owner, what, how to show (URLs, env, feature flag). |
| n+1 | Discussion | Blockers; asks (access, scope, budget); open debate. |
| n+2 | Next week | Concrete commitments (owner + outcome). |
| n+3 | Close-out | Decisions captured; links to Linear project, dashboard, recording. |

Collapse extra demo slides if only one demo; never drop Discussion or Close-out.

## Data pull contract

### Linear (via MCP connector)

1. Identify the **active cycle / project** the team uses for this client (from routine context or `CLAUDE.md` / org defaults).
2. Pull:
   - **Shipped:** issues moved to a “Done”/completed state during the cycle (or last 7 days if cycle boundary is unclear)—include identifier, title, URL.
   - **In progress:** issues actively worked; include assignee if useful.
   - **Blocked / needs decision:** blocked state, waiting-on-client labels, or explicit “needs discussion” items.
3. If the connector cannot filter precisely, pull a slightly larger set and **curate in the deck**—do not invent issues.

### Supabase (via MCP connector)

1. Run **read-only** queries against the ops / reporting project (e.g. Imaginary Spaces Ops)—tables or views the team has agreed are safe for client readouts.
2. Prefer **small aggregates** (counts, week-over-week deltas, funnel step) over raw row dumps.
3. If schema or access is missing, leave the metrics table with explicit “data unavailable this run” and one-line reason—**do not** guess numbers.

## Output contract

1. Ensure `out/` exists under the repo root.
2. Copy [`.claude/skills/weekly-sync-deck/templates/deck.md`](templates/deck.md) to **`out/deck.md`** (keep Marp frontmatter `theme: weekly-sync`).
3. Replace every `REPLACE_*` token with real content; remove unused demo slides if fewer than two demos (delete whole slide sections including `---` separators; keep valid Marp structure).
4. Run from repo root:

   ```bash
   ./scripts/build-deck.sh out/deck.md out/deck.pdf
   ```

5. **Google Drive (via MCP connector):** create folder `Thursday - YYYY-MM-DD` (meeting Thursday’s date in agreed timezone) under the team’s presentations parent folder if missing; upload **`out/deck.pdf`** and optionally **`out/deck.md`** source for diffability.
6. End the session with **links** to the uploaded files and a short **changelog** of what was pulled vs what fell back to placeholders.

## Definition of done

- [ ] `out/deck.pdf` renders without Marp errors.
- [ ] Deck reflects real Linear + Supabase pulls where connectors succeeded.
- [ ] Drive upload path matches the routine’s configured parent folder + `Thursday - <date>` convention.
- [ ] Session output lists any data gaps or manual follow-ups.

## Non-goals

- No git commits from this workflow unless the human routine explicitly asks for template updates.
- No schema migrations or writes to production Supabase from this deck flow.
- No editing Linear issue state unless a separate instruction says so.
