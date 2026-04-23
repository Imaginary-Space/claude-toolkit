---
name: pr-workflow
description: >-
  Guides branching, commits, pushes, and GitHub pull requests using gh and git.
  Use when creating or updating a PR, syncing with the base branch, or when the
  user mentions pull request, merge, review, or CI on a branch.
---

# PR workflow

## Defaults

- Branch from latest `main` (or the repo’s default): `git fetch origin && git checkout -b claude/<short-slug>`.
- Prefer **small commits** with clear messages (see `.claude/rules/commit-style.md`).
- Open PRs with `gh pr create` when available; include summary, test plan, and risk notes.

## Commands (adapt names if your default branch differs)

```bash
git status
git diff
git add -A && git commit -m "feat: ..."
git push -u origin HEAD
gh pr create --fill
```

## After the PR exists

- For sustained triage (comments, CI, conflicts), delegate to the **`pr-babysitter`** subagent when appropriate.
- If CI is red, reproduce locally with the narrowest test command before pushing speculative fixes.
