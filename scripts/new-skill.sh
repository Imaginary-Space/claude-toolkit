#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="${1:-}"

if [[ -z "$NAME" ]]; then
  echo "usage: new-skill.sh <skill-name>" >&2
  exit 2
fi

if [[ ! "$NAME" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "error: skill name must be lowercase kebab-case" >&2
  exit 1
fi

DEST="$ROOT/.claude/skills/$NAME"
if [[ -e "$DEST" ]]; then
  echo "error: already exists: $DEST" >&2
  exit 1
fi

mkdir -p "$DEST"
cat >"$DEST/SKILL.md" <<EOF
---
name: $NAME
description: >-
  TODO: third-person WHAT + WHEN (max 1024 chars). Include trigger terms so the
  agent can discover this skill automatically.
---

# $NAME

## Quick start

- TODO: minimal steps

## References

- TODO: link sibling files one level deep only

EOF

echo "new-skill.sh: created $DEST/SKILL.md"
