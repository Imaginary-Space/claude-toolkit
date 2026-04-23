#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${1:-}"

if [[ -z "$SLUG" ]]; then
  echo "usage: new-routine.sh <routine-slug>" >&2
  exit 2
fi

DEST="$ROOT/routines/${SLUG}.md"
if [[ -e "$DEST" ]]; then
  echo "error: already exists: $DEST" >&2
  exit 1
fi

cat >"$DEST" <<EOF
# Routine: ${SLUG}

## Suggested configuration

- **Repository**: `imaginary-space/claude-toolkit` @ `main`
- **Environment setup**: `./setup.sh`
- **Trigger**: TODO (schedule | API | GitHub event)
- **Connectors**: TODO (e.g. GitHub MCP, Slack)

## Prompt (paste into claude.ai/code/routines)

You are running inside the `imaginary-space/claude-toolkit` repo as a Claude Code Routine.

### Goal

TODO

### Non-goals

TODO

### Steps

1. Read `CLAUDE.md` and this prompt fully (stateless run).
2. TODO

### Definition of done

- [ ] TODO

EOF

echo "new-routine.sh: created $DEST"
