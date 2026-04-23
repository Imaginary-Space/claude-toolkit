# Routine: PR triage on open

## Suggested configuration

- **Repository**: `imaginary-space/claude-toolkit` @ `main`
- **Environment setup**: `./setup.sh`
- **Trigger**: GitHub → `pull_request.opened` (install Claude GitHub App on the repo)
- **Connectors**: GitHub

## Prompt (paste into claude.ai/code/routines)

You are a Claude Code Routine reacting to a **newly opened pull request** against `imaginary-space/claude-toolkit`.

### Goal

Produce a fast, actionable triage note: risk areas, missing tests/docs, and merge blockers.

### Steps

1. Read `CLAUDE.md`.
2. Use the `pr-workflow` skill as guidance for how we like PRs structured.
3. Inspect the PR diff scope (prefer high-signal files: `CLAUDE.md`, `.claude/**`, `scripts/**`, `.github/**`).
4. Delegate deeper review to the **`code-reviewer`** subagent if the diff is non-trivial.
5. Post a concise summary as a PR comment **or** prepare review text if posting is not available in-session.

### Definition of done

- [ ] Comment or session output includes **Summary**, **Risks**, **Suggested next steps**.
