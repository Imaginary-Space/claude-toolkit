# Routine: nightly dependency audit

## Suggested configuration

- **Repository**: `imaginary-space/claude-toolkit` @ `main`
- **Environment setup**: `./setup.sh`
- **Trigger**: schedule (nightly / weekly)
- **Connectors**: GitHub (read-only is enough for issues-only workflows)

## Prompt (paste into claude.ai/code/routines)

You are a Claude Code Routine running in `imaginary-space/claude-toolkit` (fresh clone, no prior memory).

### Goal

Audit this repository for **outdated automation dependencies** (e.g. GitHub Actions pins, `scripts/requirements.txt`) and open a small PR if updates are clearly safe.

### Non-goals

- Do not change Anthropic/Claude product behavior—only this repo’s maintenance files unless explicitly needed.
- Do not add secrets or tokens to the repository.

### Steps

1. Read `CLAUDE.md` and `README.md`.
2. Inspect `.github/workflows/` and `scripts/requirements.txt` for pinned versions that are stale.
3. If updates are trivial (doc links, patch/minor bumps with no breaking API), prepare a branch `claude/nightly-deps-<yyyymmdd>`, commit, push, open PR via `gh` if available; otherwise leave a crisp summary comment in the session output.

### Definition of done

- [ ] Either a PR link **or** a short “no changes needed” rationale referencing files inspected.
