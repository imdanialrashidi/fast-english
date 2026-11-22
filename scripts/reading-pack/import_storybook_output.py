#!/usr/bin/env python3
"""Convert the Kidotalks storybook-output v2 packs into Fast English packs.

The pipeline already did the expensive work: verified frame text, original
per-frame narration, word timings and vocabulary. This converter only maps
frames to reader pages, joins highlight groups into sentence windows, maps
the 2x3 sheet panels, and copies the audio. It never invents text or timing.

Usage:
    python scripts/reading-pack/import_storybook_output.py \
      --source /home/danial/Documents/Projects/kido-talks-storybook/storybook-output \
      --out storage/app/private/library-imports/storybook \
      --ready-only
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

STAGES = {"A2": "Starter", "B1": "Stage 1", "B2": "Stage 2", "C1": "Stage 3", "C2": "Stage 4"}
BANDS = {"A2": ["A2", "B1"], "B1": ["B1", "B2"], "B2": ["B2", "C1"], "C1": ["C1", "C2"], "C2": ["C1", "C2"]}
SLUGS = {
    "a2-a-pretty-face": "story/a2/a-pretty-face",
    "a2-drive-into-danger": "story/a2/drive-into-danger",
    "a2-girl-on-a-motorcycle": "story/a2/girl-on-a-motorcycle",
    "a2-police-tv": "story/a2/police-tv",
    "b1-a-ghost-in-love": "story/b1/a-ghost-in-love",
    "b1-goodbye-mr-hollywood": "story/b1/goodbye-mr-hollywood",
    "b1-london": "story/b1/london",
    "b1-love-or-money": "story/b1/love-or-money",
    "b2-alice-in-wonderland": "story/b2/alices-adventures-in-wonderland",
    "b2-anne-of-green-gables": "story/b2/anne-of-green-gables",
    "b2-cries-from-the-heart": "story/b2/cries-from-the-heart",
    "b2-henry-viii": "story/b2/henry-viii-and-his-six-wives",
    "c1-ethan-frome": "story/c1/ethan-frome",
    "c1-goldfish": "story/c1/goldfish",
    "c1-a-christmas-carol": "story/c1/a-christmas-carol",
    "c1-as-the-inspector-said": "story/c1/as-the-inspector-said",
    "c2-lorna-doone": "story/c2/lorna-doone",
    "c2-a-tale-of-two-cities": "story/c2/a-tale-of-two-cities",
    "c2-disaster": "story/c2/disasters",
    "c2-the-african-queen": "story/c2/the-african-queen",
}

SENTENCE_END = re.compile(r'(?<=[.!?])[\u2019\u201d"]?\s+|\n{2,}')


def utf16_len(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def sentence_spans(text: str) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    start = 0
    for match in SENTENCE_END.finditer(text):
        if match.start() > start:
            spans.append((start, match.start()))
        start = match.end()
    if start < len(text):
        spans.append((start, len(text)))

    return [(utf16_len(text[:a]), utf16_len(text[:b])) for a, b in spans if b > a]


def find_offsets(text: str, word: str) -> tuple[int, int] | None:
    pattern = re.compile(r"(?<![A-Za-z0-9])" + re.escape(word) + r"(?![A-Za-z0-9])", re.IGNORECASE)
    match = pattern.search(text)
    if match is None:
        match = re.search(re.escape(word), text, re.IGNORECASE)
    if match is None:
        return None

    return utf16_len(text[: match.start()]), utf16_len(text[: match.end()])


def probe_duration(path: Path) -> int:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()

    return round(float(out) * 1000)


def convert(source: Path, out: Path, entry: dict, report: dict) -> bool:
    book_id = entry["book_id"]
    slug = SLUGS.get(book_id)
    if slug is None:
        print(f"SKIP {book_id}: no app slug", file=sys.stderr)
        return False

    book_dir = (source / entry["book_path"]).parent
    book = json.loads((source / entry["book_path"]).read_text(encoding="utf-8"))
    cefr = (book.get("book", {}).get("cefr") or entry.get("cefr") or "").upper()
    if cefr not in STAGES:
        print(f"SKIP {book_id}: unknown CEFR {cefr}", file=sys.stderr)
        return False

    assets = {asset["id"]: asset for asset in book.get("assets", [])}
    vocab_by_id = {word["id"]: word for word in book.get("vocabulary", [])}
    sets_by_frame: dict[str, list[dict]] = defaultdict(list)
    for vocabulary_set in book.get("vocabulary_sets", []):
        frame_id = vocabulary_set.get("before_frame_id")
        if not frame_id:
            continue
        for vocab_id in vocabulary_set.get("vocabulary_ids", []):
            word = vocab_by_id.get(vocab_id)
            if word is not None:
                sets_by_frame[frame_id].append(word)

    chapters_raw = sorted(book.get("chapters", []), key=lambda chapter: chapter.get("order", 0))
    frames_by_chapter: dict[str, list[dict]] = defaultdict(list)
    for frame in book.get("frames", []):
        frames_by_chapter[frame.get("chapter_id")].append(frame)
    for frames in frames_by_chapter.values():
        frames.sort(key=lambda frame: frame.get("order", 0))

    image_jobs = {}
    if (book_dir / "image-jobs.json").exists():
        image_jobs = json.loads((book_dir / "image-jobs.json").read_text(encoding="utf-8"))

    panel_map: dict[str, tuple[int, str | None]] = {}
    for panel in image_jobs.get("panels", []):
        for frame_id in panel.get("frame_ids", []):
            if frame_id not in panel_map:
                panel_map[frame_id] = (int(panel.get("panel_index", 0)), panel.get("alt_fa"))

    sheet_source = None
    expected = image_jobs.get("expected_filename")
    for candidate in [
        book_dir / "assets" / "images" / expected if expected else None,
        book_dir / "assets" / "images" / "sheet.webp",
        book_dir / "assets" / "images" / "sheet.png",
        book_dir / "assets" / "images" / "sheet.jpg",
    ]:
        if candidate is not None and candidate.is_file():
            sheet_source = candidate
            break

    target = out / book_id
    if target.exists():
        shutil.rmtree(target)
    (target / "audio").mkdir(parents=True)
    if sheet_source is not None:
        (target / "images").mkdir(parents=True)
        shutil.copyfile(sheet_source, target / "images" / "sheet.webp")

    pages: list[dict] = []
    number = 0
    copied_audio = 0
    for chapter in chapters_raw:
        chapter_id = chapter.get("id")
        chapter_pages = []
        for frame in frames_by_chapter.get(chapter_id, []):
            number += 1
            text = (frame.get("text_en") or "").strip()
            if text == "":
                continue

            sync = frame.get("audio_sync") or {}
            duration = int(sync.get("duration_ms") or 0)
            audio_file = None
            audio_asset_id = frame.get("audio_asset_id")
            asset = assets.get(audio_asset_id)
            if asset is not None and asset.get("relative_path"):
                source_audio = book_dir / asset["relative_path"]
                if source_audio.is_file():
                    audio_file = f"{frame['id']}.mp3"
                    shutil.copyfile(source_audio, target / "audio" / audio_file)
                    copied_audio += 1
                    if duration <= 0:
                        duration = probe_duration(source_audio)

            group_times = {
                group["id"]: (int(group.get("start_ms", 0)), int(group.get("end_ms", 0)))
                for group in (sync.get("groups") or [])
            }
            highlight_groups = frame.get("highlight_groups") or []
            sentences = []
            for start, end in sentence_spans(text):
                overlapping = [
                    group
                    for group in highlight_groups
                    if group.get("start_utf16", -1) < end
                    and group.get("end_utf16", -1) > start
                    and group.get("id") in group_times
                ]
                if overlapping:
                    starts = [group_times[group["id"]][0] for group in overlapping]
                    ends = [group_times[group["id"]][1] for group in overlapping]
                    start_ms = min(starts)
                    end_ms = max(ends)
                    if end_ms <= start_ms:
                        start_ms = None
                        end_ms = None
                    sentences.append(
                        {
                            "start_utf16": start,
                            "end_utf16": end,
                            "start_ms": start_ms,
                            "end_ms": end_ms,
                            "text_fa": None,
                        }
                    )
                else:
                    sentences.append(
                        {
                            "start_utf16": start,
                            "end_utf16": end,
                            "start_ms": None,
                            "end_ms": None,
                            "text_fa": None,
                        }
                    )

            words = []
            seen: set[str] = set()
            for word in sets_by_frame.get(frame["id"], []):
                raw = (word.get("word_en") or "").strip()
                meaning = (word.get("meaning_fa") or "").strip()
                key = raw.lower()
                if raw == "" or meaning == "" or key in seen:
                    continue
                seen.add(key)
                offsets = find_offsets(text, raw)
                item = {
                    "word": raw,
                    "meaning_fa": meaning,
                    "definition_en": None,
                    "part_of_speech": None,
                    "audio": None,
                }
                if offsets is not None:
                    item["start_utf16"] = offsets[0]
                    item["end_utf16"] = offsets[1]
                words.append(item)
                if len(words) >= 5:
                    break

            panel = panel_map.get(frame["id"])
            page = {
                "id": frame["id"],
                "number": number,
                "label": None,
                "text_en": text,
                "text_fa": None,
                "panel_index": panel[0] if panel is not None and sheet_source is not None else None,
                "image": None,
                "alt_fa": panel[1] if panel is not None and sheet_source is not None else None,
                "audio": {"file": audio_file, "start_ms": 0, "end_ms": duration} if audio_file else None,
                "sync_confidence": sync.get("confidence"),
                "words": words,
                "sentences": sentences,
            }
            chapter_pages.append(page)

        if chapter_pages:
            pages.extend(chapter_pages)

    if not pages:
        print(f"SKIP {book_id}: no pages", file=sys.stderr)
        return False

    if sheet_source is not None:
        sheet = {"file": "sheet.webp", "columns": 2, "rows": 3, "alt_fa": None}
    else:
        sheet = None

    source_meta = {
        "book_id": book_id,
        "content_revision": book.get("content_revision"),
        "pipeline": book.get("_pipeline") or "kidotalks-storybook-output-v2",
    }
    document = {
        "schema_version": "1.0",
        "meta": {
            "kind": "story",
            "level_cefr": cefr,
            "band": BANDS[cefr],
            "stage": STAGES[cefr],
            "author": book.get("book", {}).get("author"),
            "series": book.get("book", {}).get("series") or "Oxford Bookworms Library",
            "source": source_meta,
            "sheet": sheet,
            "credit": book.get("credit") or "صدای اصلی ناشر",
            "panel_map": [
                {"frame_id": frame_id, "panel_index": panel[0], "alt_fa": panel[1]}
                for frame_id, panel in sorted(panel_map.items())
            ]
            if sheet is None
            else None,
        },
        "chapters": [],
    }

    # Keep chapter order and only the chapters that actually produced pages.
    for chapter in chapters_raw:
        chapter_pages = [page for page in pages if page["id"] in {f["id"] for f in frames_by_chapter.get(chapter.get("id"), [])}]
        if chapter_pages:
            document["chapters"].append(
                {
                    "id": chapter.get("id"),
                    "title_en": chapter.get("title"),
                    "title_fa": None,
                    "audio": None,
                    "pages": chapter_pages,
                }
            )

    pack = {
        "schema_version": "1.0",
        "track": "story",
        "node": {
            "slug": slug,
            "level": cefr,
            "meta": {
                "author": book.get("book", {}).get("author"),
                "stage": STAGES[cefr],
                "series": book.get("book", {}).get("series") or "Oxford Bookworms Library",
                "source_book_id": book_id,
                "content_revision": book.get("content_revision"),
            },
        },
        "document": document,
    }
    (target / "pack.json").write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")

    report[book_id] = {
        "slug": slug,
        "cefr": cefr,
        "chapters": len(document["chapters"]),
        "pages": len(pages),
        "audio": copied_audio,
        "words": sum(len(page["words"]) for page in pages),
        "sentences_with_timing": sum(
            1 for page in pages for sentence in page["sentences"] if sentence["start_ms"] is not None
        ),
        "sheet": sheet_source is not None,
        "target": str(target),
    }
    print(
        f"{book_id:28} {cefr:2} pages={len(pages):3} audio={copied_audio:3} "
        f"words={sum(len(page['words']) for page in pages):3} sheet={'yes' if sheet_source else 'no'}",
        file=sys.stderr,
    )

    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--ready-only", action="store_true")
    parser.add_argument("--only", nargs="*", default=None)
    parser.add_argument("--report", type=Path, default=None)
    args = parser.parse_args()

    catalog = json.loads((args.source / "catalog.json").read_text(encoding="utf-8"))
    args.out.mkdir(parents=True, exist_ok=True)
    report: dict[str, dict] = {}
    skipped = []

    for entry in catalog.get("books", []):
        if args.only and entry["book_id"] not in args.only:
            continue
        if args.ready_only and not (
            entry.get("text_status") == "verified"
            and entry.get("audio_status") == "ready"
            and entry.get("highlight_status") == "ready"
        ):
            skipped.append(
                {
                    "book_id": entry["book_id"],
                    "text": entry.get("text_status"),
                    "audio": entry.get("audio_status"),
                    "highlight": entry.get("highlight_status"),
                }
            )
            continue
        convert(args.source, args.out, entry, report)

    report_path = args.report or (args.out / "report.json")
    report_path.write_text(
        json.dumps({"imported": report, "skipped": skipped}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"imported={len(report)} skipped={len(skipped)} report={report_path}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
