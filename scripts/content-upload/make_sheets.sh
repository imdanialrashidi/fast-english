#!/usr/bin/env bash
set -euo pipefail
cd "${FE_WORK:-$HOME/.cache/fast-english-upload}"
mkdir -p covers/sheets
for d in covers/candidates/*/; do
  topic=$(basename "$d")
  files=("$d"*.jpg)
  [ -e "${files[0]}" ] || continue
  montage "${files[@]}" -label '%f' -tile 3x -geometry 420x236+6+6 -background '#222' -fill white -pointsize 22 "covers/sheets/${topic}.png" 2>/dev/null || true
done
ls covers/sheets | wc -l
