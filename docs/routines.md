# Routines playbook

Official reference: [Automate work with routines](https://code.claude.com/docs/en/routines).

## What you store in git vs the web UI

| Stored in **this repo** | Stored in **Claude Routines UI** |
| --- | --- |
| `CLAUDE.md`, `.claude/**`, `scripts/**`, `routines/*.md` | Triggers (schedule / API / GitHub), connector attachments, model choice |
| `setup.sh` entrypoint | Environment variables and network policy |

`routines/*.md` files are **prompt templates** you paste into the routine configuration. They are not executed magically—treat them like internal documentation that happens to mirror the saved prompt.

## Environment setup

Set **environment setup** to:

```text
./setup.sh
```

`setup.sh` makes hook/helper scripts executable and runs `scripts/validate.py` as a sanity check.

## Branch pushes

This org enables **unrestricted branch pushes** for some routines; still prefer `claude/<slug>` branches for readability and safer defaults if the setting changes later.

## Authoring a new routine template

1. Run `./scripts/new-routine.sh my-routine-name`.
2. Follow the **`routine-author`** skill in `.claude/skills/routine-author/SKILL.md`.
3. Open a PR using the **`pr-workflow`** skill.

## API triggers

API triggers are behind dated beta headers while in research preview—read the official docs before wiring production systems.
