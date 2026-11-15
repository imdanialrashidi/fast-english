#!/usr/bin/env python3
"""Spot-check that each lesson MP3 actually speaks the matching transcript."""
from __future__ import annotations

import json
import os
import re
import sys
import tempfile
import wave
from pathlib import Path

WORK = Path(os.environ.get("FE_WORK", "~/.cache/fast-english-upload")).expanduser()
JSON = WORK / "json"
STOP = set("""a an the and or but if then than that this these those is are was were be been being am do does did
to of in on at by for from with as it its he she they them his her their we you your i my me our not no so
very just also more most some any what which who whom how when where why there here about into over under
after before while during between out up down have has had will would can could should may might""".split())


def words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z']+", text.lower()) if w not in STOP and len(w) > 2]


def main() -> int:
    from faster_whisper import WhisperModel

    content = json.loads((JSON / "content.json").read_text(encoding="utf-8"))
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    rows = []
    for topic in content["topics"]:
        level = next((l for l in topic["levels"] if l["level"] == "B1"), topic["levels"][0])
        mp3 = WORK / "mp3" / level["audio_file"]
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wav_path = Path(tmp.name)
        import subprocess
        start = max(0, level["duration_seconds"] - 45)
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-ss", str(start), "-t", "45", "-i", str(mp3),
            "-ar", "16000", "-ac", "1", str(wav_path),
        ], check=True)
        segments, info = model.transcribe(str(wav_path), beam_size=1, language="en", vad_filter=True)
        heard = " ".join(s.text for s in segments)
        wav_path.unlink(missing_ok=True)
        expected = set(words(level["body_en"]))
        spoken = set(words(heard))
        overlap = len(expected & spoken) / max(1, len(expected))
        rows.append({
            "topic": topic["slug"],
            "level": level["level"],
            "audio": level["audio_file"],
            "duration": level["duration_seconds"],
            "heard_chars": len(heard),
            "keyword_overlap": round(overlap, 3),
            "sample": heard[:220],
        })
        print(f"{topic['slug']:48s} {level['level']} overlap={overlap:.2f} heard={len(heard)}", flush=True)
    (JSON / "asr-check-tail.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
