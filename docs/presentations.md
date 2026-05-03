# Presentations from code (for fast-shipping teams)

## Why [Marp](https://github.com/marp-team/marp-cli) here

- **Markdown source** — easy for humans and agents to edit, diff, and review in git.
- **One command to PPTX** — `@marp-team/marp-cli` renders PPTX with sensible defaults for Drive uploads. PDF remains available when outlines are needed for live reads, but the final Drive deck should be the `.pptx`.
- **Theming** — CSS-based themes (see `.claude/skills/weekly-sync-deck/templates/theme.css`) keep decks on-brand without proprietary slide builders.
- **Fits cloud routines** — Marp is warmed via [`setup.sh`](../setup.sh) (called from a **SessionStart** hook in cloud — see [`docs/routines.md`](routines.md)); no OAuth required for **rendering** (upload is separate via the Google Drive connector).

CLI examples (from repo root):

```bash
./scripts/build-deck.sh out/deck.md out/deck.pptx
```

## React kit (rich client decks)

Use [`scripts/presentation-kit`](../scripts/presentation-kit) when the deck needs
the richer 1920x1080 slide system: branded cover/closing slides, velocity
charts, sprint scope, timelines, recap columns, and demo/video slots. The kit
renders from a typed JSON view-model (`Presentation`) to a native, editable
Google Slides deck plus a self-contained HTML preview:

```bash
./scripts/build-presentation.sh out/landible-2026-04-30.json out/landible-2026-04-30.slides.json --parent "$folder_id"
```

The `presentation-kit-deck` skill is the routine entry point. It pulls Linear,
IMS ops Supabase meetings/decisions, composes the JSON source, creates the
native Google Slides deck, and uploads the JSON source to Drive.

The Google Slides renderer creates native text boxes, shapes, lines, chart-like
objects, and images. Do not rasterize the HTML/PDF into Slides for final
delivery; that creates slide images instead of an editable client deck.

Saved prompt template for the first Landible test:

```text
Run the presentation-kit-deck skill for client Landible.
Lookback: 7 days.
Drive parent folder: <LANDIBLE_PRESENTATIONS_FOLDER_ID_OR_URL>.
Connectors: Linear, Supabase (IMS ops jcuymodyrjbzwmyjzwee), Google Drive.
Success criteria: native Google Slides deck and JSON uploaded to Drive; final response includes links
and a short changelog of data pulled vs gaps.
```

## Weekly sync narrative (AI agency shape)

Optimized for **weekly client + engineering** syncs:

1. **Roadmap vs reality** — where we are on the timeline we committed to, and why.
2. **Shipped** — what actually landed (issue/PR-backed).
3. **Demos** — reserved slides with owner + steps (reduces “who shares screen?” chaos).
4. **Discussion** — blockers, asks, and explicit **open debate** with the client (decisions, scope, priorities).
5. **Next week + close** — commitments and links so the meeting resolves, not drifts.

The `weekly-sync-deck` skill encodes this structure for the Marp track. Use
`presentation-kit-deck` when the richer React slide system should be the final
client artifact.

## Alternatives (when to revisit)


| Approach             | Pros                                       | Cons                                             |
| -------------------- | ------------------------------------------ | ------------------------------------------------ |
| **Reveal.js / HTML** | Great for engineering-only or embedded web | Client collaboration/editing story is separate   |
| **PPTX export**      | Useful for offline PowerPoint handoff      | Google Slides import can shift layout and fonts  |


Use **presentation-kit → native Google Slides** for rich client decks where the
Drive artifact is the source of truth.