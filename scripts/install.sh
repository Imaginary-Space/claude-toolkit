#!/usr/bin/env bash
# Symlink .claude from claude-toolkit into a target repository (idempotent-ish).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=0

usage() {
  cat <<'USAGE'
usage: install.sh [--dry-run] <path/to/target-repo>

Symlinks <target-repo>/.claude -> <this-toolkit>/.claude unless .claude exists.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  shift
fi

TARGET="${1:-}"
[[ -n "$TARGET" ]] || {
  usage
  exit 2
}

TARGET="$(cd "$TARGET" && pwd)"
[[ -d "$TARGET" ]] || die "target is not a directory: $TARGET"

SRC_CLAUDE="$ROOT/.claude"
[[ -d "$SRC_CLAUDE" ]] || die "missing toolkit .claude at $SRC_CLAUDE"

DEST_CLAUDE="$TARGET/.claude"
if [[ -e "$DEST_CLAUDE" || -L "$DEST_CLAUDE" ]]; then
  echo "install.sh: $DEST_CLAUDE already exists; not modifying." >&2
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "dry-run: would ln -s \"$SRC_CLAUDE\" \"$DEST_CLAUDE\""
  exit 0
fi

ln -s "$SRC_CLAUDE" "$DEST_CLAUDE"
echo "install.sh: linked $DEST_CLAUDE -> $SRC_CLAUDE"
