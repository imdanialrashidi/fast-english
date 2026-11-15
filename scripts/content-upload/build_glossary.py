#!/usr/bin/env python3
"""Build validated glossary lists from source vocabulary banks (Persian-only meanings)."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

WORK = Path(os.environ.get("FE_WORK", "~/.cache/fast-english-upload")).expanduser()
JSON = WORK / "json"
PERSIAN = re.compile(r"[\u0600-\u06FF]")
LATIN = re.compile(r"[A-Za-z]")


def clean_word(word: str) -> str:
    w = re.sub(r"\s+", " ", word.strip(" .;:،"))
    if not w:
        return w
    return w[0].upper() + w[1:]


def clean_meaning(word: str, meaning: str) -> str | None:
    m = re.sub(r"\s+", " ", meaning.strip())
    if PERSIAN.search(m) and LATIN.search(m):
        # Bilingual source: English definition first; Persian follows a dash or slash.
        parts = [p.strip() for p in re.split(r"\s+(?:[—–]|/)\s+", m) if p.strip()]
        fa = [p for p in parts if PERSIAN.search(p)]
        if fa:
            m = fa[-1]
    m = m.strip(" .;،")
    if not PERSIAN.search(m):
        return None
    # Allow only proper nouns to stay in Latin script (e.g. "Clayface").
    for token in LATIN.findall(m) or []:
        pass
    if LATIN.search(re.sub(r"\b[A-Z][A-Za-z0-9'’-]*\b", "", m)):
        return None
    return m


def main() -> int:
    fa_map = json.loads((JSON / "fa-meanings.json").read_text(encoding="utf-8"))
    fa_map = {re.sub(r"\s+", " ", k.strip()): v for k, v in fa_map.items()}
    missing: dict[str, list[str]] = {}
    stats = {"persian": 0, "translated": 0, "unresolved": 0, "deduped": 0, "trimmed": 0}

    for path in sorted(JSON.glob("*.json")):
        if path.name in {"parse-report.json", "audio-manifest.json", "fa-meanings.json", "english-meanings.json"}:
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        for level, entry in payload["levels"].items():
            out: list[dict] = []
            seen: set[str] = set()
            for item in entry["glossary"]:
                word = clean_word(item["word"])
                key = word.casefold()
                if not word or key in seen:
                    stats["deduped"] += 1
                    continue
                raw = re.sub(r"\s+", " ", item["meaning_fa"].strip())
                if PERSIAN.search(raw):
                    meaning = clean_meaning(word, raw)
                    if meaning is None:
                        stats["unresolved"] += 1
                        missing.setdefault(word, []).append(raw)
                        continue
                    stats["persian"] += 1
                else:
                    meaning = fa_map.get(raw) or fa_map.get(next((k for k in fa_map if k.casefold() == raw.casefold()), ""), None)
                    if not meaning:
                        stats["unresolved"] += 1
                        missing.setdefault(word, []).append(raw)
                        continue
                    stats["translated"] += 1
                seen.add(key)
                out.append({"word": word, "meaning_fa": meaning})
            if len(out) > 12:
                stats["trimmed"] += len(out) - 12
                out = out[:12]
            entry["glossary_fa"] = out
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({"stats": stats, "missing": missing}, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
