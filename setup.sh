#!/usr/bin/env bash
# Routine / CI environment setup: run from repo root once per session.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "[claude-toolkit] setup.sh running from ${ROOT}"

find scripts .claude/hooks/scripts .claude/skills/safe-shell/scripts \
  -type f \( -name '*.sh' -o -name '*.py' \) 2>/dev/null \
  | while read -r f; do
  chmod +x "$f" || true
done

chmod +x setup.sh scripts/*.sh scripts/new-*.sh 2>/dev/null || true

if command -v python3 >/dev/null 2>&1; then
  python3 "$ROOT/scripts/validate.py" || {
    echo "[claude-toolkit] validate.py failed (non-fatal for setup if you are mid-edit)" >&2
  }
else
  echo "[claude-toolkit] python3 not found; skipping validate.py" >&2
fi

echo "[claude-toolkit] setup complete."
