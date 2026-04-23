#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="${1:-}"

if [[ -z "$NAME" ]]; then
  echo "usage: new-subagent.sh <agent-name>" >&2
  exit 2
fi

DEST="$ROOT/.claude/agents/${NAME}.md"
if [[ -e "$DEST" ]]; then
  echo "error: already exists: $DEST" >&2
  exit 1
fi

cat >"$DEST" <<EOF
---
name: $NAME
description: >-
  TODO: what this subagent does and when to delegate to it (third person).
tools: Read, Grep, Glob, Bash
---

# $NAME

## Instructions

- TODO

EOF

echo "new-subagent.sh: created $DEST"
