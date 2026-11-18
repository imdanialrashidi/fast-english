#!/usr/bin/env python3
"""Generate Woof audio for one AEF unit deck.

    scripts/aef/generate-audio.py <deck.json> <out-dir> [--force]

The deck file is the same one `flashcards:import-aef` reads. Each card is
spoken as its headword with a period so the model closes the take; the
mastered MP3 keeps the required "Voice by Underdog Woof" credit. Output is
one `<external_id>.mp3` per card in <out-dir>.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

WOOF_ROOT = Path("/home/danial/Documents/Projects/Kido-Talks-Flashcards")
WOOF_PY = WOOF_ROOT / ".venv/bin/python"
GENERATOR = WOOF_ROOT / "tools/generate_woof_audio.py"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("deck", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--tempo", type=float, default=0.85)
    args = parser.parse_args()

    deck = json.loads(args.deck.read_text(encoding="utf-8"))
    slug = deck["book"]["slug"]
    number = int(deck["unit"]["number"])
    cards = deck["cards"]

    args.out.mkdir(parents=True, exist_ok=True)
    missing = [c for c in cards if not (args.out / f"{c['external_id']}.mp3").exists()]
    if not missing and not args.force:
        print(f"audio up to date: {len(cards)} clips")
        return 0

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        content = {
            "book": {"slug": slug},
            "units": [{
                "number": number,
                "folder": f"u{number:02d}",
                "cards": [{"cardKey": c["external_id"], "word": c["word"] + "."} for c in cards],
            }],
        }
        source = tmp / "content.json"
        source.write_text(json.dumps(content, ensure_ascii=False), encoding="utf-8")
        flashcards = tmp / "flashcards"

        command = [str(WOOF_PY), str(GENERATOR), "--source", str(source), "--flashcards", str(flashcards), "--tempo", str(args.tempo)]
        if args.force:
            command.append("--force")
        subprocess.run(command, cwd=WOOF_ROOT, check=True)

        produced = flashcards / slug / f"u{number:02d}" / "assets" / "audio"
        for card in cards:
            src = produced / f"{card['external_id']}.mp3"
            if not src.is_file():
                print(f"missing take: {card['external_id']}", file=sys.stderr)
                return 1
            shutil.copyfile(src, args.out / f"{card['external_id']}.mp3")

    print(f"audio ready: {len(cards)} clips in {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
