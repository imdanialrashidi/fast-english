#!/usr/bin/env python3
"""Crop, resize, and record the chosen cover candidates (16:9, 1200x675, <2 MB)."""
from __future__ import annotations

import json
import os
from pathlib import Path

from PIL import Image

WORK = Path(os.environ.get("FE_WORK", "~/.cache/fast-english-upload")).expanduser()

# episode folder -> candidate filename chosen after the visual review
CHOICES = {
    "an_awkward_moment": "02",
    "china_EU_trade_deal": "03",
    "daler_mehndi": "05",
    "drake_1M": "05",
    "DREW_BARRYMOR": "02",
    "ghosts_button": "01",
    "halloween": "01",
    "HUNGER_GAMES": "09",
    "JAMes_gunn": "09",
    "mass_proteset_in_french": "06",
    "nocturne": "03",
    "pride_and_prejudice": "01",
    "the_next_UN": "01",
    "US-Russia_Diesel_Deal": "08",
    "us_says_no_to_iran": "01",
}

TARGET = (1200, 675)
RATIO = TARGET[0] / TARGET[1]


def main() -> int:
    manifest = json.loads((WORK / "json" / "cover-candidates.json").read_text(encoding="utf-8"))
    outdir = WORK / "covers" / "final"
    outdir.mkdir(parents=True, exist_ok=True)
    notes: dict[str, dict] = {}

    for slug, index in CHOICES.items():
        source = WORK / "covers" / "candidates" / slug / f"{index}.jpg"
        meta = next((m for m in manifest[slug] if m.get("local", "").endswith(f"/{index}.jpg")), None)
        image = Image.open(source).convert("RGB")
        width, height = image.size
        if width / height > RATIO:
            new_width = int(height * RATIO)
            left = (width - new_width) // 2
            box = (left, 0, left + new_width, height)
        else:
            new_height = int(width / RATIO)
            top = (height - new_height) // 2
            box = (0, top, width, top + new_height)
        image = image.crop(box).resize(TARGET, Image.LANCZOS)
        destination = outdir / f"{slug}.jpg"
        image.save(destination, "JPEG", quality=86, optimize=True, progressive=True)
        notes[slug] = {
            "file": str(destination),
            "bytes": destination.stat().st_size,
            "source": meta,
        }
        print(f"{slug:28s} {destination.stat().st_size // 1024:4d} KB  {(meta or {}).get('license')}")

    (WORK / "json" / "cover-final.json").write_text(
        json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
