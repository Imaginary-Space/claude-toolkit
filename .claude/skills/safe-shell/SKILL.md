---
name: safe-shell
description: >-
  Reduces risk from shell commands in autonomous sessions by preferring dry-runs,
  scoped paths, and the bundled safe_run helper. Use before destructive file
  operations, mass find/replace, or when the user asks for cautious command execution.
---

# Safe shell

## Principles

- Prefer **read-only** inspection (`git diff`, `rg`, `ls`) before mutation.
- Avoid `sudo`, `rm -rf`, `dd if=/dev/*`, and broad globs on system paths.
- When deleting, delete the **smallest** path that works; confirm with `git status`.

## Helper

For extra guardrails on user-supplied commands, prefer:

```bash
./.claude/skills/safe-shell/scripts/safe_run.sh -- git status
```

`safe_run.sh` blocks a small set of known-dangerous patterns and prints the command before execution.
