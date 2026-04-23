#!/usr/bin/env bash
# Shared helpers for toolkit scripts.
set -euo pipefail

die() {
  echo "error: $*" >&2
  exit 1
}

toolkit_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  printf '%s\n' "$here"
}
