#!/usr/bin/env python3
"""Generate storybook frame narration with the owner's Underdog Woof model.

For books whose publisher audio does not exist, each frame is synthesised
sentence by sentence, concatenated with a measured gap, and given exact
sentence timings. The script writes a shadow book.json in the Kidotalks v2
shape and reuses `import_storybook_output.convert`, so the resulting pack
has the same validation, panel map, vocabulary and chapter layout as the
publisher-audio books.

Woof is CPU-only. Frames are independent, so a small process pool keeps all
cores busy; every frame is cached, so an interrupted run resumes.

Usage:
    python scripts/reading-pack/woof_story_frames.py \
      --source /home/danial/Documents/Projects/kido-talks-storybook/storybook-output \
      --out storage/app/private/library-imports/storybook-woof \
      --woof-dir /home/danial/Documents/Projects/Kido-Talks-Flashcards/work/underdog-woof \
      --book b2-henry-viii --workers 3
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import wave
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import import_storybook_output as iso  # noqa: E402

SENTENCE = re.compile(r'(?<=[.!?])[\u2019\u201d"]?\s+|\n{2,}')
SAMPLE_RATE = 24000
GAP_SECONDS = 0.32

TTS = None
SEED = 0


def utf16_len(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def sentences(text: str) -> list[tuple[int, int, str]]:
    spans: list[tuple[int, int, str]] = []
    start = 0
    for match in SENTENCE.finditer(text):
        if match.start() > start:
            spans.append((start, match.start(), text[start : match.start()]))
        start = match.end()
    if start < len(text):
        spans.append((start, len(text), text[start:]))

    return [(utf16_len(text[:a]), utf16_len(text[:b]), chunk) for a, b, chunk in spans if chunk.strip()]


def read_wav(path: Path) -> tuple[bytes, int]:
    with wave.open(str(path), "rb") as handle:
        if handle.getnchannels() != 1 or handle.getsampwidth() != 2:
            raise RuntimeError(f"{path} is not mono 16-bit")
        return handle.readframes(handle.getnframes()), handle.getframerate()


def write_wav(path: Path, frames: bytes, rate: int) -> None:
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(frames)


def master(wav: Path, mp3: Path, title: str) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "96k",
            "-metadata", "artist=Underdog Woof",
            "-metadata", "comment=Voice by Underdog Woof",
            "-metadata", f"title={title}",
            str(mp3),
        ],
        check=True,
    )


def init_worker(woof_dir: str, voice: str, seed: int) -> None:
    global TTS, SEED
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    sys.path.insert(0, woof_dir)
    from underdog_woof import Woof  # noqa: PLC0415

    TTS = Woof(voice=voice)
    SEED = seed


def synth_frame(task: tuple[str, str, str, str]) -> dict:
    frame_id, text, audio_dir, work_dir = task
    audio_dir_path = Path(audio_dir)
    mp3 = audio_dir_path / f"{frame_id}.mp3"
    sidecar = audio_dir_path / f"{frame_id}.json"

    if mp3.is_file() and sidecar.is_file():
        try:
            return json.loads(sidecar.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass

    parts = sentences(text)
    if not parts:
        return {"frame_id": frame_id, "duration_ms": 0, "groups": []}

    work = Path(work_dir)
    work.mkdir(parents=True, exist_ok=True)
    frames: list[bytes] = []
    rate = SAMPLE_RATE
    cursor = 0
    groups: list[dict] = []

    for index, (start, end, chunk) in enumerate(parts):
        wav = work / f"{frame_id}-{index:03d}.wav"
        if not wav.is_file():
            audio = TTS(chunk, seed=SEED)  # type: ignore[misc]
            TTS.save(str(wav), audio)  # type: ignore[union-attr]
        data, rate = read_wav(wav)
        if frames:
            silence = int(rate * GAP_SECONDS)
            frames.append(b"\x00\x00" * silence)
            cursor += silence
        start_ms = round(cursor / rate * 1000)
        frames.append(data)
        cursor += len(data) // 2
        end_ms = round(cursor / rate * 1000)
        groups.append(
            {
                "id": f"hg-{index + 1:02d}",
                "start_utf16": start,
                "end_utf16": end,
                "start_ms": start_ms,
                "end_ms": end_ms,
            }
        )

    combined = work / f"{frame_id}.wav"
    write_wav(combined, b"".join(frames), rate)
    audio_dir_path.mkdir(parents=True, exist_ok=True)
    master(combined, mp3, text[:60].replace("\n", " "))
    duration = round(cursor / rate * 1000)
    result = {"frame_id": frame_id, "duration_ms": duration, "groups": groups}
    sidecar.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    combined.unlink(missing_ok=True)

    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--woof-dir", type=Path, required=True)
    parser.add_argument("--book", action="append", required=True)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--voice", default="juno")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--max-frames", type=int, default=None)
    args = parser.parse_args()

    incoming = args.source / "incoming-images"
    args.out.mkdir(parents=True, exist_ok=True)

    for book_id in args.book:
        original_path = args.source / "books" / book_id / "book.json"
        if not original_path.is_file():
            print(f"SKIP {book_id}: no book.json", file=sys.stderr)
            continue

        book = json.loads(original_path.read_text(encoding="utf-8"))
        cefr = (book.get("book", {}).get("cefr") or "").upper()
        frames = book.get("frames", [])
        if args.max_frames is not None:
            frames = frames[: args.max_frames]

        shadow = args.out / ".shadow" / book_id
        if shadow.exists():
            shutil.rmtree(shadow)
        (shadow / "books" / book_id / "assets" / "audio").mkdir(parents=True)
        (shadow / "books" / book_id / "assets" / "images").mkdir(parents=True)

        source_book_dir = args.source / "books" / book_id
        image_jobs = {}
        if (source_book_dir / "image-jobs.json").is_file():
            image_jobs = json.loads((source_book_dir / "image-jobs.json").read_text(encoding="utf-8"))
            shutil.copyfile(source_book_dir / "image-jobs.json", shadow / "books" / book_id / "image-jobs.json")

        sheet = incoming / f"{book_id}-sheet.webp"
        expected = image_jobs.get("expected_filename") or f"{book_id}-sheet.webp"
        if sheet.is_file():
            shutil.copyfile(sheet, shadow / "books" / book_id / "assets" / "images" / expected)

        tasks = [
            (frame["id"], frame.get("text_en", ""), str(shadow / "books" / book_id / "assets" / "audio"), str(args.out / ".work" / book_id))
            for frame in frames
            if (frame.get("text_en") or "").strip()
        ]
        results: dict[str, dict] = {}
        print(f"{book_id}: synthesising {len(tasks)} frames with {args.workers} workers", file=sys.stderr)
        with ProcessPoolExecutor(
            max_workers=args.workers,
            initializer=init_worker,
            initargs=(str(args.woof_dir), args.voice, args.seed),
        ) as pool:
            for index, result in enumerate(pool.map(synth_frame, tasks), start=1):
                results[result["frame_id"]] = result
                if index % 5 == 0 or index == len(tasks):
                    print(f"  {index}/{len(tasks)} frames", file=sys.stderr)

        assets = book.setdefault("assets", [])
        existing = {asset.get("id") for asset in assets}
        for frame in frames:
            result = results.get(frame["id"])
            if result is None:
                continue
            asset_id = f"{book_id}-{frame['id']}-woof"
            frame["audio_asset_id"] = asset_id
            frame["audio_sync"] = {
                "asset_id": asset_id,
                "duration_ms": result["duration_ms"],
                "start_ms": 0,
                "end_ms": result["duration_ms"],
                "groups": [{"id": group["id"], "start_ms": group["start_ms"], "end_ms": group["end_ms"]} for group in result["groups"]],
                "method": "underdog-woof sentence concatenation",
                "confidence": 1.0,
                "source_segments": [],
            }
            frame["highlight_groups"] = [
                {"id": group["id"], "start_utf16": group["start_utf16"], "end_utf16": group["end_utf16"]}
                for group in result["groups"]
            ]
            if asset_id not in existing:
                mp3 = shadow / "books" / book_id / "assets" / "audio" / f"{frame['id']}.mp3"
                assets.append(
                    {
                        "id": asset_id,
                        "type": "audio",
                        "status": "ready",
                        "relative_path": f"assets/audio/{frame['id']}.mp3",
                        "mime_type": "audio/mpeg",
                        "sha256": hashlib.sha256(mp3.read_bytes()).hexdigest() if mp3.is_file() else None,
                        "role": "frame_audio",
                        "source": "Underdog Woof",
                    }
                )
                existing.add(asset_id)

        book["credit"] = "Voice by Underdog Woof"
        book["_pipeline"] = "underdog-woof-story-v1"
        (shadow / "books" / book_id / "book.json").write_text(
            json.dumps(book, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        report: dict[str, dict] = {}
        entry = {
            "book_id": book_id,
            "cefr": cefr,
            "book_path": f"books/{book_id}/book.json",
            "text_status": "verified",
            "audio_status": "ready",
            "highlight_status": "ready",
            "image_status": "ready" if sheet.is_file() else "pending",
        }
        iso.convert(shadow, args.out, entry, report)
        result = report.get(book_id, {})
        print(
            f"{book_id}: pages={result.get('pages')} audio={result.get('audio')} "
            f"words={result.get('words')} sheet={result.get('sheet')} → {result.get('target')}",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
