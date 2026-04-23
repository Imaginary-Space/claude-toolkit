#!/usr/bin/env bash
# Optional guard wrapper: prints the command line, then execs it if patterns look safe.
set -euo pipefail

if [[ "${1:-}" != "--" ]]; then
  echo "usage: safe_run.sh -- <command...>" >&2
  exit 2
fi
shift

joined="$*"
case "$joined" in
  *'rm -rf /'*|*'sudo rm'*|*'dd if=/dev/'*|*'mkfs'*)
    echo "safe_run.sh: refusing dangerous pattern in: $joined" >&2
    exit 1
    ;;
esac

echo "+ $joined" >&2
exec "$@"
