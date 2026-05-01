#!/usr/bin/env bash
# Render a presentation-kit JSON deck to PPTX or PDF (run from anywhere; paths default to repo root).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

input="${1:?usage: build-presentation.sh <input.json> [output.pptx|output.pdf]}"
output="${2:-out/presentation.pptx}"

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
  *.pdf) htmlpath="${outpath%.pdf}.html" ;;
  *.pptx) htmlpath="${outpath%.pptx}.html" ;;
  *) echo "output must end in .pptx or .pdf" >&2; exit 1 ;;
esac

cd "$ROOT/scripts/presentation-kit"

if command -v bun >/dev/null 2>&1; then
  bun install --frozen-lockfile >/dev/null
  bun run render "$inpath" --out "$outpath" --html "$htmlpath"
else
  npm install --no-audit --no-fund
  npx tsx src/cli.tsx "$inpath" --out "$outpath" --html "$htmlpath"
fi

echo "[build-presentation] wrote $outpath"
