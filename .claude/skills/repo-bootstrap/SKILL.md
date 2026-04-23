---
name: repo-bootstrap
description: >-
  Installs or links claude-toolkit assets into another repository so Claude Code
  picks up shared skills and hooks. Use when onboarding a new service repo or
  when the user asks to sync the toolkit into an existing codebase.
---

# Repo bootstrap

## Preferred: installer script

From a checkout of `claude-toolkit`:

```bash
./scripts/install.sh /path/to/target-repo
```

Dry run:

```bash
./scripts/install.sh --dry-run /path/to/target-repo
```

## What gets installed

- Symlinks `.claude` from this toolkit into the target repo **unless** the target already has `.claude` (never overwrite without confirmation).

## Follow-up

- Ensure the target repo documents its own `CLAUDE.md` for product context; this toolkit is **tooling**, not product memory.
