#!/usr/bin/env bash
# OCR a page range of one AEF PDF (scanned, no text layer) into one .txt per page.
#
#   scripts/aef/ocr-pages.sh <pdf> <first-page> <last-page> <out-dir> [dpi]
#
# Pages are 1-based PDF page numbers, not printed page numbers. The AEF
# scans are image-only, so every fact used in content authoring comes from
# this OCR plus a visual read of the rendered page. TESSDATA_PREFIX is set
# for the user-local eng model when the system tessdata lacks it.
set -Eeuo pipefail

pdf=${1:?usage: ocr-pages.sh <pdf> <first> <last> <out-dir> [dpi]}
first=${2:?}
last=${3:?}
out=${4:?}
dpi=${5:-250}

[[ -f "$pdf" ]] || { echo "missing pdf: $pdf" >&2; exit 2; }
mkdir -p "$out"

if ! tesseract --list-langs 2>/dev/null | grep -qx eng; then
    export TESSDATA_PREFIX=${TESSDATA_PREFIX:-/home/danial/.local/share/tessdata}
fi

for page in $(seq "$first" "$last"); do
    base=$(printf '%s/p%03d' "$out" "$page")
    if [[ ! -f "${base}.txt" ]]; then
        pdftoppm -f "$page" -l "$page" -r "$dpi" -png "$pdf" "$base" 2>/dev/null || true
        img=$(find "$out" -maxdepth 1 -name "$(basename "$base")-*.png" | head -1)
        if [[ -n "$img" ]]; then
            tesseract "$img" "$base" -l eng --psm 3 2>/dev/null || true
            rm -f "$img"
        fi
    fi
    printf 'p%03d %s\n' "$page" "$(head -c 60 "${base}.txt" 2>/dev/null | tr '\n' ' ')"
done
