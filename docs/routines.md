# Cloud routines and this repository

Official reference: [Automate work with routines](https://code.claude.com/docs/en/routines).

Routines are configured in the Claude UI at [claude.ai/code/routines](https://claude.ai/code/routines): **saved prompt**, **repositories**, **environment** (setup script, env vars, network), **connectors** (MCP), and **triggers** (schedule, API, GitHub). That configuration is **not** stored in this git repo.

This repo is what the routine **clones and loads** on every run.

## What loads automatically

Each cloud routine run:

1. **Clones** the selected repo on its default branch (stateless; no memory from prior runs).
2. Applies your selected **cloud environment** snapshot (network, env vars, and that environment’s **setup script** — see below).
3. Starts a full **Claude Code** session with the **UI prompt** plus any **connectors** you attached.
4. **Discovers** committed project config: [`CLAUDE.md`](../CLAUDE.md), [`.claude/skills/`](../.claude/skills/), [`.claude/agents/`](../.claude/agents/), [`.claude/rules/`](../.claude/rules/), [`.claude/output-styles/`](../.claude/output-styles/), and [`.claude/settings.json`](../.claude/settings.json). A **SessionStart** hook in this repo runs [`setup.sh`](../setup.sh) when `CLAUDE_CODE_REMOTE=true` so tooling runs **from the clone** (not from the cloud-environment script, which may not have the repo as the current directory).

So the durable surface for a routine is: **`setup.sh`**, **`.claude/**`**, and **`scripts/**`**. Put workflows in **skills** and thin **shell helpers**; keep the saved UI prompt short.

## Thin prompt principle

The prompt in the Claude UI should:

- Name the **skill** or **script** to follow (e.g. invoke the `weekly-sync-deck` skill, run `./scripts/build-deck.sh`).
- List **connectors** the run needs (and remove unused ones in the routine form—[routines docs](https://code.claude.com/docs/en/routines) recommend scoping connectors).
- State **success criteria** (e.g. PDF uploaded to a given Drive path).
- Stay **self-contained** (no reliance on prior chat).

Heavy instructions, slide structure, and data contracts belong in **git** (skills + docs), not duplicated in long UI prompts.

## Environment setup (two different places)

### Cloud environment (Default) — **do not** use `./setup.sh` here

The **Update cloud environment** dialog runs its setup script **before** Claude Code starts, and it is **not** tied to your repository’s working directory. A line like `./setup.sh` fails with **exit code 127** (“No such file or directory”) because `setup.sh` from your clone is not available on `$PWD` at that stage.

Use that field only for **global** prep (extra apt packages, image-wide tools). Leave it empty or minimal if you do not need that. Official guidance: [Setup scripts vs SessionStart hooks](https://code.claude.com/docs/en/claude-code-on-the-web#setup-scripts-vs-sessionstart-hooks) — project-level install belongs in the **repo**, not the cloud-environment box.

### This repository — `setup.sh` via SessionStart (already wired)

[`setup.sh`](../setup.sh) makes helper scripts executable, runs `scripts/validate.py` when Python is available, and warms installs (e.g. Marp CLI). In cloud sessions it is invoked from [`.claude/hooks/scripts/run-remote-setup.sh`](../.claude/hooks/scripts/run-remote-setup.sh) on **SessionStart** when `CLAUDE_CODE_REMOTE=true`, so paths resolve to **`$CLAUDE_PROJECT_DIR`**. Keep `setup.sh` **idempotent** and fast.

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
