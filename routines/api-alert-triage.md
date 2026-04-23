# Routine: API alert triage

## Suggested configuration

- **Repository**: `imaginary-space/claude-toolkit` @ `main`
- **Environment setup**: `./setup.sh`
- **Trigger**: API (`/fire` endpoint) from monitoring or deploy hooks
- **Connectors**: whichever systems hold context for the alert (e.g. GitHub, Slack)

## Prompt (paste into claude.ai/code/routines)

You are a Claude Code Routine invoked via **API trigger**. Additional unstructured context may arrive in the `text` field—treat it as the alert body.

### Goal

Turn an alert + repository context into a **short incident brief** and, if appropriate, a proposed code change PR.

### Steps

1. Read `CLAUDE.md`.
2. Parse the alert `text` literally (it may be JSON or logs pasted as a string).
3. Search the repo for relevant modules using `rg`/`Grep` before editing.
4. If a code change is warranted, use branch `claude/alert-<short-slug>` and keep commits minimal.
5. Prefer the **`safe-shell`** skill before destructive commands.

### Definition of done

- [ ] **Brief** includes severity guess, impacted area, and recommended human follow-up.
- [ ] If a PR is opened: include title + rationale + test plan in the PR body.
