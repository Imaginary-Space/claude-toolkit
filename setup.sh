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

# Warm Marp CLI for cloud routine environments (cached after first successful install).
if command -v npx >/dev/null 2>&1; then
  npx --yes @marp-team/marp-cli@^4 --version >/dev/null 2>&1 || true
fi

# Warm presentation-kit dependencies and Chromium for React-generated decks.
if [[ -f "$ROOT/scripts/presentation-kit/package.json" ]]; then
  echo "[claude-toolkit] warming presentation-kit dependencies"
  if command -v bun >/dev/null 2>&1; then
    (
      cd "$ROOT/scripts/presentation-kit"
      bun install --frozen-lockfile >/dev/null 2>&1
    ) || true
  elif command -v npm >/dev/null 2>&1; then
    (
      cd "$ROOT/scripts/presentation-kit"
      npm install --no-audit --no-fund >/dev/null 2>&1
    ) || true
  fi
fi

echo "[claude-toolkit] setup complete."
