# Conventions

## Skills (`.claude/skills/<name>/SKILL.md`)

- **`name`**: lowercase `kebab-case`, max **64** characters.
- **`description`**: max **1024** characters; **third person**; include **what** + **when** (trigger terms).
- **Body**: aim under **500 lines**; use sibling files for deep reference (link **one level** from `SKILL.md`).

## Subagents (`.claude/agents/<name>.md`)

- Required frontmatter: `name`, `description`.
- Optional: `tools`, `model`, hooks (see Claude Code docs).

## Rules (`.claude/rules/*.md`)

- Short, topic-scoped guidance; prefer bullets over prose.

## Routine templates (`routines/*.md`)

- Must remain **self-contained**; never assume prior chat context.
- Prefer delegating durable logic to skills; keep the routine prompt as orchestration.

## Scripts

- Bash scripts use `set -euo pipefail` unless there is a strong reason not to.
- Anything non-trivial should be exercised by `scripts/validate.py` or CI.
