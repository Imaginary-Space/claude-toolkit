#!/usr/bin/env bash
# SessionStart: run repo setup.sh only in cloud (after clone, repo root is CLAUDE_PROJECT_DIR).
# Cloud *environment* setup scripts run before the repo is available — do not call ./setup.sh there.
set -euo pipefail

root="${CLAUDE_PROJECT_DIR:-}"
if [[ "${CLAUDE_CODE_REMOTE:-}" != "true" ]] || [[ -z "$root" ]]; then
  exit 0
fi

if [[ -x "$root/setup.sh" ]]; then
  "$root/setup.sh"
elif [[ -f "$root/setup.sh" ]]; then
  bash "$root/setup.sh"
else
  echo "[claude-toolkit] run-remote-setup: no setup.sh at $root" >&2
fi

exit 0
