---
name: routine-author
description: >-
  Authors or updates Claude Code Routines prompt templates under routines/ with
  self-contained instructions, suggested triggers, and connector notes. Use when
  the user wants a new scheduled, API, or GitHub-triggered routine for this
  repository.
---

# Routine author

## Constraints (from Claude Code Routines)

- Routines are **stateless** cloud sessions: every run starts from a fresh clone of the default branch.
- The saved prompt must stand alone—do not rely on prior chat memory.
- Put durable logic in **skills** under `.claude/skills/`; keep the routine prompt a thin orchestration layer.

## File template

Create `routines/<name>.md` with:

1. **Metadata**: suggested trigger type (schedule / API / GitHub) + event filters.
2. **Connectors**: which MCP servers the routine should attach (if any).
3. **Prompt body**: numbered steps, explicit stop conditions, and which skills to invoke by name.
4. **Install footer**: how to paste into `claude.ai/code/routines` and select `imaginary-space/claude-toolkit`.

## House style

- Start with **Goal** and **Non-goals**.
- Include a **Definition of done** checklist the agent can verify without guessing.
