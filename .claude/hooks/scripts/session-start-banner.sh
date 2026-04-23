#!/usr/bin/env bash
# SessionStart: short reminder injected into context (stdout).
set -euo pipefail

cat <<'EOF'
**claude-toolkit session**: This repo is the toolkit. Prefer branches `claude/<slug>` for PRs. Routines are stateless—re-read `CLAUDE.md` each run. Use `.claude/skills/` before improvising long workflows.
EOF

exit 0
