# Cloud routines and this repository

Official reference: [Automate work with routines](https://code.claude.com/docs/en/routines).

Routines are configured in the Claude UI at [claude.ai/code/routines](https://claude.ai/code/routines): **saved prompt**, **repositories**, **environment** (setup script, env vars, network), **connectors** (MCP), and **triggers** (schedule, API, GitHub). That configuration is **not** stored in this git repo.

This repo is what the routine **clones and loads** on every run.

## What loads automatically

Each cloud routine run:

1. **Clones** the selected repo on its default branch (stateless; no memory from prior runs).
2. Runs the routine **environment setup** once per cached environment (typically `./setup.sh` here).
3. Starts a full **Claude Code** session with the **UI prompt** plus any **connectors** you attached.
4. **Discovers** committed project config: [`CLAUDE.md`](../CLAUDE.md), [`.claude/skills/`](../.claude/skills/), [`.claude/agents/`](../.claude/agents/), [`.claude/rules/`](../.claude/rules/), [`.claude/output-styles/`](../.claude/output-styles/), and [`.claude/settings.json`](../.claude/settings.json).

So the durable surface for a routine is: **`setup.sh`**, **`.claude/**`**, and **`scripts/**`**. Put workflows in **skills** and thin **shell helpers**; keep the saved UI prompt short.

## Thin prompt principle

The prompt in the Claude UI should:

- Name the **skill** or **script** to follow (e.g. invoke the `weekly-sync-deck` skill, run `./scripts/build-deck.sh`).
- List **connectors** the run needs (and remove unused ones in the routine form—[routines docs](https://code.claude.com/docs/en/routines) recommend scoping connectors).
- State **success criteria** (e.g. PDF uploaded to a given Drive path).
- Stay **self-contained** (no reliance on prior chat).

Heavy instructions, slide structure, and data contracts belong in **git** (skills + docs), not duplicated in long UI prompts.

## Environment setup

Set the routine’s **environment setup** to:

```text
./setup.sh
```

[`setup.sh`](../setup.sh) makes helper scripts executable, runs `scripts/validate.py` when Python is available, and warms installs (e.g. Marp CLI) so the cloud **environment cache** can reuse them. Keep `setup.sh` **idempotent** and fast.

## Branch pushes

By default, cloud routines may only push branches prefixed with `claude/`. If your org enables **Allow unrestricted branch pushes**, still prefer `claude/<short-slug>` for agent branches and PRs.

## Standalone routine skills

Some automations are **one skill = one routine**: all schemas, SQL, triage rules, and success criteria live in a single skill (e.g. [`meeting-hourly-sweep`](../.claude/skills/meeting-hourly-sweep/SKILL.md)) so a **stateless** cloud run never needs prior chat or other skills.

**Pattern:**

1. Put the full workflow in **git** under `.claude/skills/<name>/SKILL.md`.
2. In the Claude Routines UI, keep the saved prompt **thin**: e.g. `Run the meeting-hourly-sweep skill.` and name **connectors** only (here: Supabase, Read.ai, optional Slack). Remove unused connectors in the routine form.
3. Prefer an **hourly** (or agreed) schedule trigger; no extra env vars are required when auth is via connectors.

Observable runs (e.g. `automation_runs` rows) and kill switches in config tables belong in the skill body so operators can pause or tune without editing the UI prompt.

## Further reading

- [`docs/architecture.md`](architecture.md) — project vs plugin layout; routines vs local sessions
- [`docs/presentations.md`](presentations.md) — code-generated decks (Marp) and the weekly sync example
