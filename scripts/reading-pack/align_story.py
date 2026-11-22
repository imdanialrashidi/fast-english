#!/usr/bin/env python3
"""Build one story chapter pack from a reviewed transcript and its audio.

The pipeline does not invent text or timing. It aligns the reviewed page
text to the real narration with faster-whisper word timestamps and writes
the same document shape `php artisan library:import` validates. A sentence
without a confident match gets no timing, so the reader leaves its
highlight off instead of guessing.

Input JSON:
    {
      "chapter": {"id": "ch1", "title_en": "Chapter 1"},
      "pages": [
        {"id": "p1", "number": 1, "text_en": "...", "panel_index": 1,
         "words": [{"word": "jogger", "meaning_fa": "دونده"}]}
      ]
    }

Usage:
    python scripts/reading-pack/align_story.py \
      --pages chapter.json --audio track.mp3 \
      --slug story/a2/police-tv --title-en "Police TV" --title-fa "پلیس تلویزیون" \
      --level A2 --cover /images/books/story/police-tv.webp \
      --out /tmp/police-tv-pack
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

TOKEN = re.compile(r"[A-Za-z0-9\u2019']+")
CURLY = str.maketrans({"\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"'})


def utf16_len(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def normalise(token: str) -> str:
    return token.translate(CURLY).strip(".,!?;:\"'()").lower()


def words_with_offsets(text: str) -> list[tuple[str, int, int]]:
    result: list[tuple[str, int, int]] = []
    for match in TOKEN.finditer(text):
        raw = match.group(0)
        result.append((raw, utf16_len(text[: match.start()]), utf16_len(text[: match.end()])))
    return result


def sentence_spans(text: str) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    start = 0
    for match in re.finditer(r"(?<=[.!?])\s+", text):
        spans.append((start, match.start()))
        start = match.end()
    if start < len(text):
        spans.append((start, len(text)))

    return [(utf16_len(text[:a]), utf16_len(text[:b])) for a, b in spans if b > a]


def align(known: list[str], heard: list[str]) -> dict[int, int]:
    matcher = difflib.SequenceMatcher(None, known, heard, autojunk=False)
    mapping: dict[int, int] = {}
    for block in matcher.get_matching_blocks():
        for index in range(block.size):
            mapping[block.a + index] = block.b + index

    return mapping


def transcribe(audio: Path, model_name: str) -> list[dict]:
    from faster_whisper import WhisperModel

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(str(audio), word_timestamps=True, vad_filter=True)
    words: list[dict] = []
    for segment in segments:
        for word in segment.words or []:
            words.append(
                {
                    "word": word.word.strip(),
                    "start": float(word.start) * 1000,
                    "end": float(word.end) * 1000,
                }
            )
    print(f"heard {len(words)} words in {info.duration:.1f}s", file=sys.stderr)

    return words


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=Path, required=True)
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--title-en", required=True)
    parser.add_argument("--title-fa", default=None)
    parser.add_argument("--level", default=None)
    parser.add_argument("--track", default="story", choices=["story", "inside_reading"])
    parser.add_argument("--cover", default=None)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--model", default="base.en")
    parser.add_argument("--panel-columns", type=int, default=2)
    parser.add_argument("--panel-rows", type=int, default=3)
    parser.add_argument("--sheet", default=None, help="sheet filename in the pack images/ folder")
    args = parser.parse_args()

    data = json.loads(args.pages.read_text(encoding="utf-8"))
    pages = data["pages"]
    chapter = data.get("chapter", {"id": "ch1", "title_en": "Chapter 1"})

    heard = transcribe(args.audio, args.model)
    heard_norm = [normalise(word["word"]) for word in heard]
    heard_norm = [word for word in heard_norm if word]

    # Align the whole chapter once. A per-page pass can match a repeated
    # name to an earlier page and make a later page start before an earlier
    # one; the global pass keeps the spoken order and maps back to the pages.
    page_tokens: list[list[tuple[str, int, int]]] = []
    flat: list[tuple[int, int]] = []
    flat_norm: list[str] = []
    for page_index, page in enumerate(pages):
        tokens = words_with_offsets(page["text_en"])
        page_tokens.append(tokens)
        for local_index, (raw, _, _) in enumerate(tokens):
            flat.append((page_index, local_index))
            flat_norm.append(normalise(raw))

    mapping = align(flat_norm, heard_norm)
    per_page: dict[int, dict[int, int]] = {index: {} for index in range(len(pages))}
    for flat_index, heard_index in mapping.items():
        page_index, local_index = flat[flat_index]
        per_page[page_index][local_index] = heard_index

    out_pages = []
    total_known = len(flat_norm)
    total_matched = len(mapping)
    last_start = -1

    for page_index, page in enumerate(pages):
        text = page["text_en"]
        known = page_tokens[page_index]
        page_map = per_page[page_index]

        timings: dict[int, tuple[float, float]] = {
            local_index: (heard[heard_index]["start"], heard[heard_index]["end"])
            for local_index, heard_index in page_map.items()
        }

        sentences = []
        for start, end in sentence_spans(text):
            inside = [
                index
                for index, (_, w_start, w_end) in enumerate(known)
                if w_start >= start and w_end <= end and index in timings
            ]
            if not inside:
                sentences.append({"start_utf16": start, "end_utf16": end, "start_ms": None, "end_ms": None, "text_fa": None})
                continue
            sentences.append(
                {
                    "start_utf16": start,
                    "end_utf16": end,
                    "start_ms": round(min(timings[index][0] for index in inside)),
                    "end_ms": round(max(timings[index][1] for index in inside)),
                    "text_fa": None,
                }
            )

        timed_pages = [sentence for sentence in sentences if sentence["start_ms"] is not None]
        page_start = min((s["start_ms"] for s in timed_pages), default=None)
        page_end = max((s["end_ms"] for s in timed_pages), default=None)
        if page_start is not None and page_start < last_start:
            print(f"warning: {page['id']} starts before the previous page", file=sys.stderr)
        last_start = max(last_start, page_start or last_start)

        words = []
        for word in page.get("words", []):
            raw = word["word"]
            found = None
            if " " in raw:
                phrase = re.search(re.escape(raw), text, re.IGNORECASE)
                if phrase is not None:
                    found = (utf16_len(text[: phrase.start()]), utf16_len(text[: phrase.end()]))
            else:
                for raw_token, start, end in known:
                    if raw_token.lower() == raw.lower():
                        found = (start, end)
                        break
            if found is None:
                print(f"warning: word not in page text: {raw}", file=sys.stderr)
                continue
            words.append(
                {
                    "word": raw,
                    "meaning_fa": word.get("meaning_fa"),
                    "definition_en": word.get("definition_en"),
                    "part_of_speech": word.get("part_of_speech"),
                    "start_utf16": found[0],
                    "end_utf16": found[1],
                    "audio": None,
                }
            )

        coverage = len(page_map) / max(1, len(known))
        out_pages.append(
            {
                "id": page["id"],
                "number": page.get("number"),
                "label": page.get("label"),
                "text_en": text,
                "text_fa": page.get("text_fa"),
                "panel_index": page.get("panel_index"),
                "image": None,
                "alt_fa": page.get("alt_fa"),
                "audio": {"start_ms": page_start, "end_ms": page_end},
                "sync_confidence": round(coverage, 3),
                "words": words,
                "sentences": sentences,
            }
        )
        print(f"{page['id']}: alignment {coverage:.0%} · {page_start}–{page_end}ms", file=sys.stderr)

    duration = float(
        subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(args.audio)],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    )

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "audio").mkdir(exist_ok=True)
    shutil.copyfile(args.audio, args.out / "audio" / "ch1.mp3")

    sheet = None
    if args.sheet is not None:
        sheet = {
            "file": args.sheet,
            "columns": args.panel_columns,
            "rows": args.panel_rows,
            "alt_fa": None,
        }

    document = {
        "schema_version": "1.0",
        "meta": {
            "kind": args.track,
            "level_cefr": args.level,
            "sheet": sheet,
            "sync": {
                "model": args.model,
                "matched": total_matched,
                "known": total_known,
                "coverage": round(total_matched / max(1, total_known), 3),
            },
        },
        "chapters": [
            {
                "id": chapter.get("id", "ch1"),
                "title_en": chapter.get("title_en"),
                "title_fa": chapter.get("title_fa"),
                "audio": {"file": "ch1.mp3", "duration_ms": round(duration * 1000)},
                "pages": out_pages,
            }
        ],
    }

    pack = {
        "schema_version": "1.0",
        "track": args.track,
        "node": {
            "slug": args.slug,
            "title_en": args.title_en,
            "title_fa": args.title_fa,
            "level": args.level,
            "cover": args.cover,
        },
        "document": document,
    }

    (args.out / "pack.json").write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {args.out / 'pack.json'} · overall {total_matched}/{total_known} matched", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
