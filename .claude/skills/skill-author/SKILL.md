---
name: skill-author
description: >-
  Explains how to add or edit a Claude Code skill in this repository with correct
  frontmatter, concise bodies, and progressive disclosure. Use when creating a
  new skill, renaming a skill, or improving skill descriptions for discovery.
---

# Skill author

## Location

- Project skills live in `.claude/skills/<skill-name>/SKILL.md` (this repo).

## Frontmatter (required)

- `name`: lowercase letters, digits, hyphens; max **64** characters.
- `description`: max **1024** characters; write in **third person**; include **what** it does and **when** to use it (trigger terms).

## Body

- Keep `SKILL.md` under **500 lines**; move long reference material to sibling files and link one level deep.
- Prefer checklists and copy-paste command templates over prose.
- If a skill ships scripts, document whether Claude should **execute** them or **read** them as reference.

## After edits

Run `python3 scripts/validate.py` from the repo root before pushing.
