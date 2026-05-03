#!/usr/bin/env bash
# Render a presentation-kit JSON deck to native Google Slides (run from anywhere; paths default to repo root).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

input="${1:?usage: build-presentation.sh <input.json> [metadata.json] [--parent <folder-id>] [--title <deck-name>]}"
shift || true
if [[ $# -gt 0 && "${1:-}" != --* ]]; then
  output="$1"
  shift || true
else
  output="out/presentation.slides.json"
fi

if [[ "$input" = /* ]]; then
  inpath="$input"
else
  inpath="$ROOT/$input"
fi

if [[ "$output" = /* ]]; then
  outpath="$output"
else
  outpath="$ROOT/$output"
fi

case "$outpath" in
  *.json) htmlpath="${outpath%.json}.html" ;;
  *) echo "output metadata must end in .json" >&2; exit 1 ;;
esac

cd "$ROOT/scripts/presentation-kit"

if command -v bun >/dev/null 2>&1; then
  bun install --frozen-lockfile >/dev/null
  bun run render "$inpath" --slides --out "$outpath" --html "$htmlpath" "$@"
else
  npm install --no-audit --no-fund
  npx tsx src/cli.tsx "$inpath" --slides --out "$outpath" --html "$htmlpath" "$@"
fi

echo "[build-presentation] wrote $outpath"
