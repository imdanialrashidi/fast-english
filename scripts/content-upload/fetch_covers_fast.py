#!/usr/bin/env python3
"""Fast, license-filtered cover candidate fetch (Commons primary, Openverse secondary)."""
from __future__ import annotations

import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

WORK = Path(os.environ.get("FE_WORK", "~/.cache/fast-english-upload")).expanduser()
CAND = WORK / "covers" / "candidates"
UA = "FastEnglishContentBot/1.0 (content covers; admin@fastenglishpodcast.ir)"
HEADERS = {"User-Agent": UA}
TIMEOUT = 20

QUERIES = {
    "an_awkward_moment": ["White House state dinner", "Christiansborg Palace", "state banquet table"],
    "china_EU_trade_deal": ["container terminal", "container ship port", "freight train"],
    "daler_mehndi": ["concert stage", "singer on stage", "music festival"],
    "drake_1M": ["birthday party", "champagne glasses", "concert crowd"],
    "DREW_BARRYMOR": ["makeup brushes", "dressing room mirror", "television studio"],
    "ghosts_button": ["cinema auditorium", "film projector", "movie theatre"],
    "halloween": ["jack-o'-lantern", "halloween pumpkin", "halloween decorations"],
    "HUNGER_GAMES": ["archery", "film premiere red carpet", "cinema screening"],
    "JAMes_gunn": ["film director", "movie camera", "film set"],
    "mass_proteset_in_french": ["demonstration Paris", "peaceful protest", "Place de la Republique"],
    "nocturne": ["forest at night", "small town street", "country road night"],
    "pride_and_prejudice": ["English country house", "old library books", "Jane Austen"],
    "the_next_UN": ["United Nations General Assembly hall", "United Nations building", "UN flags"],
    "US-Russia_Diesel_Deal": ["oil refinery", "fuel tanker", "diesel pump"],
    "us_says_no_to_iran": ["Strait of Hormuz", "oil tanker", "Persian Gulf"],
}

PD = re.compile(r"(^CC0|Public domain|^PD|PD-|PD_|No restrictions|Government work)", re.I)
BAD_TITLE = re.compile(r"(logo|clipart|icon|diagram|chart|map of|coat of arms|emblem|poster|screenshot|sign text)", re.I)


def strip_html(value: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", value or "")).strip()


def commons(query: str) -> list[dict]:
    params = {
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": f"filetype:bitmap {query}", "gsrnamespace": "6", "gsrlimit": "10",
        "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": "1600",
    }
    try:
        r = requests.get("https://commons.wikimedia.org/w/api.php", params=params, headers=HEADERS, timeout=TIMEOUT)
        pages = (r.json().get("query", {}) or {}).get("pages", {}) or {}
    except Exception:
        return []
    out = []
    for page in pages.values():
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {}) or {}
        license_name = strip_html(meta.get("LicenseShortName", {}).get("value"))
        title = page.get("title", "").removeprefix("File:")
        width, height = int(info.get("width") or 0), int(info.get("height") or 0)
        if not PD.search(license_name) or title.startswith("File:"):
            continue
        if BAD_TITLE.search(title) or width < 1200 or height < 500:
            continue
        if width / max(height, 1) < 1.2:
            continue
        out.append({
            "source": "Wikimedia Commons",
            "source_url": info.get("descriptionurl"),
            "file_url": info.get("thumburl") or info.get("url"),
            "license": license_name,
            "artist": strip_html(meta.get("Artist", {}).get("value"))[:180],
            "width": width, "height": height, "title": title,
        })
    return out


def openverse(query: str) -> list[dict]:
    params = {"q": query, "license": "cc0,pdm", "page_size": "10", "mature": "false", "extension": "jpg,jpeg"}
    try:
        r = requests.get("https://api.openverse.org/v1/images/", params=params, headers=HEADERS, timeout=TIMEOUT)
        results = (r.json() or {}).get("results", [])
    except Exception:
        return []
    out = []
    for item in results:
        width, height = int(item.get("width") or 0), int(item.get("height") or 0)
        if width < 1200 or height < 500 or width / max(height, 1) < 1.2:
            continue
        out.append({
            "source": f"Openverse / {item.get('source')}",
            "source_url": item.get("foreign_landing_url"),
            "file_url": item.get("url"),
            "license": (item.get("license") or "").upper(),
            "artist": (item.get("creator") or "")[:180],
            "width": width, "height": height, "title": (item.get("title") or "")[:160],
        })
    return out


def download(item: dict, dest: Path) -> bool:
    try:
        r = requests.get(item["file_url"], headers=HEADERS, timeout=TIMEOUT, stream=True)
        r.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        with dest.open("wb") as fh:
            for chunk in r.iter_content(1 << 16):
                fh.write(chunk)
        return dest.stat().st_size > 40_000
    except Exception:
        return False


def collect(slug: str) -> tuple[str, list[dict]]:
    items: list[dict] = []
    seen: set[str] = set()
    for query in QUERIES[slug]:
        for item in commons(query) + openverse(query):
            url = item.get("file_url") or ""
            if not url or url in seen:
                continue
            seen.add(url)
            items.append(item)
        if len(items) >= 10:
            break
    downloaded = []
    for index, item in enumerate(items[:10], start=1):
        dest = CAND / slug / f"{index:02d}.jpg"
        if download(item, dest):
            item["local"] = str(dest)
            downloaded.append(item)
    return slug, downloaded


def main() -> int:
    manifest: dict[str, list[dict]] = {}
    with ThreadPoolExecutor(max_workers=5) as pool:
        for slug, items in pool.map(collect, QUERIES):
            manifest[slug] = items
            print(f"{slug}: {len(items)}", flush=True)
    (WORK / "json" / "cover-candidates.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
