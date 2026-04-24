# Presentations from code (for fast-shipping teams)

## Why [Marp](https://github.com/marp-team/marp-cli) here

- **Markdown source** — easy for humans and agents to edit, diff, and review in git.
- **One command to PDF** — `@marp-team/marp-cli` renders PDF (and optionally PPTX/HTML) with sensible defaults; PDF supports **outlines** and **presenter notes** for live reads.
- **Theming** — CSS-based themes (see `.claude/skills/weekly-sync-deck/templates/theme.css`) keep decks on-brand without proprietary slide builders.
- **Fits cloud routines** — Marp is warmed via [`setup.sh`](../setup.sh) (called from a **SessionStart** hook in cloud — see [`docs/routines.md`](routines.md)); no OAuth required for **rendering** (upload is separate via the Google Drive connector).

CLI examples (from repo root):

```bash
./scripts/build-deck.sh out/deck.md out/deck.pdf
```

## Weekly sync narrative (AI agency shape)

Optimized for **weekly client + engineering** syncs:

1. **Roadmap vs reality** — where we are on the timeline we committed to, and why.
2. **Shipped** — what actually landed (issue/PR-backed).
3. **Demos** — reserved slides with owner + steps (reduces “who shares screen?” chaos).
4. **Discussion** — blockers, asks, and explicit **open debate** with the client (decisions, scope, priorities).
5. **Next week + close** — commitments and links so the meeting resolves, not drifts.

The `**weekly-sync-deck`** skill encodes this structure and the Linear + Supabase pull contract.

## Alternatives (when to revisit)


| Approach              | Pros                                                        | Cons                                                             |
| --------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| **Google Slides API** | Native collaborative editing, pixel-perfect brand templates | OAuth/service account complexity; heavier agent loop for layout  |
| **Reveal.js / HTML**  | Great for engineering-only or embedded web                  | Client may expect a PDF in Drive; print/export story is separate |


Stick with **Marp → PDF** until you need live co-editing in Slides or a hosted HTML deck as the primary artifact.