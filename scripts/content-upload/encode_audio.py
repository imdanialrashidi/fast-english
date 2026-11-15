#!/usr/bin/env python3
"""Encode the episode WAVs to normalized MP3 masters and record verification data."""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

SRC = Path(os.environ.get("FE_SOURCE", "~/Documents/Projects/FastEnglish - Eps")).expanduser()
WORK = Path(os.environ.get("FE_WORK", "~/.cache/fast-english-upload")).expanduser()
OUT = WORK / "mp3"
LOG = WORK / "logs" / "encode.log"
MANIFEST = WORK / "json" / "audio-manifest.json"

TARGET_I = -16.0
TARGET_TP = -1.5
TARGET_LRA = 11.0
LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
SKIP = {
    ("the next UN", "B1"),
    ("US-Russia Diesel Deal", "A2"),
    ("an awkward moment", "C1"),
}


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def probe(path: Path) -> dict:
    p = run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,size,bit_rate:stream=codec_name,sample_rate,channels",
        "-of", "json", str(path),
    ])
    try:
        return json.loads(p.stdout or "{}")
    except json.JSONDecodeError:
        return {}


def measure(path: Path) -> float | None:
    p = run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
        "-filter_complex", "ebur128", "-f", "null", "-",
    ])
    m = re.findall(r"I:\s+(-?\d+\.\d+)\s+LUFS", p.stderr)
    return float(m[-1]) if m else None


def loudnorm_pass1(src: Path) -> dict:
    p = run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(src),
        "-af", f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}:print_format=json",
        "-f", "null", "-",
    ])
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S)
    if not m:
        raise RuntimeError("loudnorm analysis failed")
    return json.loads(m.group(0))


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    topics = [d for d in sorted(SRC.iterdir()) if d.is_dir()]
    with LOG.open("w", encoding="utf-8") as log:
        for topic in topics:
            title = topic.name
            for level in LEVELS:
                if (title, level) in SKIP:
                    rows.append({"folder": title, "level": level, "status": "skipped-source-missing"})
                    continue
                candidates = [p for p in topic.glob("*") if p.suffix.lower() == ".wav" and p.stem.upper() == level]
                if not candidates:
                    rows.append({"folder": title, "level": level, "status": "skipped-no-file"})
                    continue
                src = candidates[0]
                dur = float((probe(src).get("format", {}) or {}).get("duration") or 0)
                if dur < 1.0:
                    rows.append({
                        "folder": title, "level": level, "status": "skipped-empty-source",
                        "source_bytes": src.stat().st_size, "source_seconds": dur,
                    })
                    continue

                slug = re.sub(r"[^a-z0-9]+", "-", f"{title} {level}".lower()).strip("-")
                dest = OUT / f"{slug}.mp3"
                stats = loudnorm_pass1(src)
                af2 = (
                    f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}"
                    f":measured_I={stats['input_i']}:measured_TP={stats['input_tp']}"
                    f":measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}"
                    f":offset={stats['target_offset']}:linear=true"
                )
                cmd = [
                    "ffmpeg", "-y", "-hide_banner", "-nostats", "-i", str(src),
                    "-af", af2, "-ar", "44100", "-ac", "1",
                    "-c:a", "libmp3lame", "-b:a", "96k",
                    "-write_id3v2", "1", "-id3v2_version", "3",
                    "-metadata", f"title={title} — {level}",
                    "-metadata", "artist=Fast English",
                    "-metadata", f"album={title}",
                    "-metadata", f"track={LEVELS.index(level) + 1}/{len(LEVELS)}",
                    "-metadata", "genre=Education",
                    "-metadata", "date=2026",
                    "-metadata", f"comment=Fast English podcast, {level} level",
                    str(dest),
                ]
                res = run(cmd)
                if res.returncode != 0 or not dest.exists():
                    log.write(f"FAIL {title} {level}\n{res.stderr[-1500:]}\n")
                    rows.append({"folder": title, "level": level, "status": "failed"})
                    continue
                info = probe(dest)
                fmt = info.get("format", {}) or {}
                stream = (info.get("streams") or [{}])[0]
                rows.append({
                    "folder": title,
                    "level": level,
                    "status": "encoded",
                    "slug": slug,
                    "source_file": src.name,
                    "source_bytes": src.stat().st_size,
                    "source_sha256": sha256(src),
                    "source_seconds": round(dur, 3),
                    "source_lufs": float(stats["input_i"]),
                    "mp3": dest.name,
                    "mp3_bytes": dest.stat().st_size,
                    "mp3_sha256": sha256(dest),
                    "mp3_seconds": round(float(fmt.get("duration") or 0), 3),
                    "mp3_bit_rate": int(fmt.get("bit_rate") or 0),
                    "codec": stream.get("codec_name"),
                    "sample_rate": int(stream.get("sample_rate") or 0),
                    "channels": int(stream.get("channels") or 0),
                    "lufs_out": measure(dest),
                })
                print(f"ok {slug} {dur:.1f}s -> {dest.stat().st_size//1024}KB", flush=True)
    MANIFEST.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"done: {sum(1 for r in rows if r['status']=='encoded')} encoded")
    return 0


if __name__ == "__main__":
    sys.exit(main())
