#!/usr/bin/env bash
# Render a Marp markdown deck to PDF (run from anywhere; paths default to repo root).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

input="${1:?usage: build-deck.sh <path-to-deck.md> [output.pdf]}"
output="${2:-out/deck.pdf}"

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

mkdir -p "$(dirname "$outpath")"

THEME="$ROOT/.claude/skills/weekly-sync-deck/templates/theme.css"

cd "$ROOT"
npx --yes @marp-team/marp-cli@^4 "$inpath" \
  --pdf \
  --pdf-outlines \
  --allow-local-files \
  --theme "$THEME" \
  -o "$outpath"

echo "[build-deck] wrote $outpath"
