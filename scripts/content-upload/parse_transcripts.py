#!/usr/bin/env python3
"""Parse the three transcript layouts in the FastEnglish source folder into one JSON shape."""
from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
from pathlib import Path

SRC = Path(os.environ.get("FE_SOURCE", "~/Documents/Projects/FastEnglish - Eps")).expanduser()
WORK = Path(os.environ.get("FE_WORK", "~/.cache/fast-english-upload")).expanduser()
OUT = WORK / "json"

LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
PERSIAN = re.compile(r"[\u0600-\u06FF]")
HTML = re.compile(r"<[a-zA-Z/][^>]*>")
SEPARATOR = re.compile(r"^\s*={5,}\s*$")
VOCAB_HEAD = re.compile(r"^\s*(VOCABULARY|Vocabulary|VOCAB)\s*$")
BODY_HEAD = re.compile(r"^\s*(PODCAST|Podcast)\s*$")
TITLE_LINE = re.compile(r"^\s*TITLE:\s*(.+?)\s*$")
LEVEL_LINE = re.compile(r"^\s*LEVEL:\s*([ABC][12])\s*$", re.IGNORECASE)
BANNER_LEVEL = re.compile(r"^(?P<title>.+?)\s+—\s+(?P<level>[ABC][12])\s*$")
DASH = re.compile(r"\s+[—–-]\s+")

SKIP_LINE = re.compile(
    r"^\s*(A1[–-]C2 CLEAN PODCAST TEXT|Vocabulary banks and full podcast scripts|"
    r"\(Repeat-after-me lines.*|LEVEL:.*|TITLE:.*)$",
    re.IGNORECASE,
)


def split_blocks(text: str) -> list[tuple[str, str, str | None]]:
    """Return [(level, title_from_marker, block_text)]."""
    lines = text.splitlines()
    markers: list[tuple[int, str, str | None]] = []
    for i, line in enumerate(lines):
        m = LEVEL_LINE.match(line)
        if m:
            markers.append((i, m.group(1).upper(), None))
            continue
        m = BANNER_LEVEL.match(line)
        if m and not line.strip().startswith("Level"):
            markers.append((i, m.group("level"), m.group("title").strip()))

    blocks = []
    for idx, (start, level, title) in enumerate(markers):
        end = markers[idx + 1][0] if idx + 1 < len(markers) else len(lines)
        block = "\n".join(lines[start + 1 : end])
        blocks.append((level, title, block))
    return blocks


def parse_block(block: str) -> tuple[list[dict], str]:
    lines = block.splitlines()
    glossary: list[dict] = []
    body: list[str] = []
    mode = "pre"
    for line in lines:
        if SEPARATOR.match(line) or SKIP_LINE.match(line):
            continue
        if VOCAB_HEAD.match(line):
            mode = "vocab"
            continue
        if BODY_HEAD.match(line):
            mode = "body"
            continue
        if mode == "pre":
            continue
        if mode == "vocab":
            if line.strip() == "":
                continue
            m = DASH.split(line, maxsplit=1)
            if len(m) == 2:
                word = m[0].strip(" .;:")
                meaning = m[1].strip()
                if word and meaning:
                    glossary.append({"word": word, "meaning_fa": meaning})
            continue
        body.append(line)

    paragraphs = []
    current: list[str] = []
    for line in body:
        if line.strip() == "":
            if current:
                paragraphs.append(" ".join(current).strip())
                current = []
            continue
        if SEPARATOR.match(line):
            continue
        current.append(line.strip())
    if current:
        paragraphs.append(" ".join(current).strip())
    paragraphs = [p for p in paragraphs if p]

    return glossary, "\n\n".join(paragraphs)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(SRC.glob("*/*.txt"))
    # Optional transcript recovered from outside the folder (batch 2026-11-15 kept one
    # Iran transcript in Downloads). Set FE_EXTRA_TRANSCRIPT="<path>|<episode folder>".
    extra_spec = os.environ.get("FE_EXTRA_TRANSCRIPT", "")
    entries = [(f, f.parent.name) for f in files]
    if extra_spec and "|" in extra_spec:
        extra_path, extra_folder = (part.strip() for part in extra_spec.split("|", 1))
        extra = Path(extra_path).expanduser()
        if extra.exists():
            entries.append((extra, extra_folder))

    report = []
    for path, folder in entries:
        text = unicodedata.normalize("NFC", path.read_text(encoding="utf-8-sig"))
        blocks = split_blocks(text)
        seen = {}
        for level, title, block in blocks:
            if level in seen:
                report.append({"folder": folder, "problem": f"duplicate {level} block"})
                continue
            glossary, body = parse_block(block)
            seen[level] = {
                "glossary": glossary,
                "body": body,
                "title_marker": title,
                "body_chars": len(body),
                "paragraphs": body.count("\n\n") + 1 if body else 0,
                "persian_in_body": bool(PERSIAN.search(body)),
                "html_in_body": bool(HTML.search(body)),
                "vocab_count": len(glossary),
                "non_persian_meanings": sum(
                    1 for g in glossary if not PERSIAN.search(g["meaning_fa"])
                ),
            }
        payload = {"folder": folder, "source_file": str(path), "levels": seen}
        (OUT / f"{folder.replace(' ', '_')}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        for level in LEVELS:
            d = seen.get(level)
            if not d:
                report.append({"folder": folder, "level": level, "status": "MISSING"})
                continue
            flags = []
            if d["persian_in_body"]:
                flags.append("PERSIAN_IN_BODY")
            if d["html_in_body"]:
                flags.append("HTML")
            if d["vocab_count"] > 12:
                flags.append(f"VOCAB>{12}({d['vocab_count']})")
            if d["vocab_count"] == 0:
                flags.append("NO_VOCAB")
            if d["non_persian_meanings"]:
                flags.append(f"MEANING_NOT_FA({d['non_persian_meanings']})")
            if d["body_chars"] < 80:
                flags.append("SHORT_BODY")
            report.append(
                {
                    "folder": folder,
                    "level": level,
                    "status": "ok" if not flags else ",".join(flags),
                    "vocab": d["vocab_count"],
                    "body_chars": d["body_chars"],
                    "paragraphs": d["paragraphs"],
                }
            )

    print(json.dumps(report, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
