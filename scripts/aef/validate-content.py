#!/usr/bin/env python3
"""Validate AEF unit content before import.

    scripts/aef/validate-content.py database/seeders/fixtures/exercises \
        database/seeders/fixtures/aef

Checks the exercise v2 contract (topics, one right answer, valid feedback
keys, unique matching sides) and the card contract (required fields, unique
ids, audio present). Exit code 1 means at least one error; warnings print
but do not fail.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PERSIAN = re.compile(r"[\u0600-\u06FF]")
errors: list[str] = []
warnings: list[str] = []


def fail(path: Path, message: str) -> None:
    errors.append(f"{path.name}: {message}")


def check_exercises(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    topics = data.get("topics") or []
    items = data.get("items") or []
    keys = {t.get("key") for t in topics}

    if len(topics) < 1:
        fail(path, "no topics")
    if len(items) < 5:
        fail(path, "fewer than five questions")

    for topic in topics:
        if not PERSIAN.search(topic.get("use_fa", "")):
            fail(path, f"topic {topic.get('key')} has no Persian use text")
        if not topic.get("formulas") or not topic.get("examples"):
            fail(path, f"topic {topic.get('key')} lacks formulas/examples")

    seen_ids: set[str] = set()
    per_topic: dict[str, int] = {key: 0 for key in keys}
    for item in items:
        external = item.get("external_id", "")
        if external in seen_ids:
            fail(path, f"duplicate item id {external}")
        seen_ids.add(external)

        topic = item.get("topic")
        if topic not in keys:
            fail(path, f"{external} points at unknown topic {topic}")
        else:
            per_topic[topic] += 1

        if item.get("type") == "choice":
            options = item.get("options") or []
            answer = item.get("answer")
            if len(options) < 2:
                fail(path, f"{external} needs two options")
            if not isinstance(answer, int) or not 0 <= answer < len(options):
                fail(path, f"{external} has an invalid answer index")
            feedback = item.get("feedback") or {}
            for key in feedback:
                if not key.isdigit() or not 0 <= int(key) < len(options):
                    fail(path, f"{external} feedback key {key} is not an option")
            missing = [i for i in range(len(options)) if i != answer and str(i) not in feedback]
            if missing:
                warnings.append(f"{path.name}: {external} has no feedback for options {missing}")
        elif item.get("type") == "matching":
            pairs = item.get("pairs") or []
            if not 2 <= len(pairs) <= 6:
                fail(path, f"{external} needs 2-6 pairs")
            rights = [p.get("right") for p in pairs]
            if len(set(rights)) != len(rights):
                fail(path, f"{external} has duplicate right sides")
        else:
            fail(path, f"{external} has unknown type {item.get('type')}")

        if not PERSIAN.search(item.get("explanation_fa", "")):
            fail(path, f"{external} has no Persian explanation")

    for key, count in per_topic.items():
        if count == 0:
            warnings.append(f"{path.name}: topic {key} has no questions")

    if len(items) % 1 == 0:
        print(f"{path.name}: {len(topics)} topics, {len(items)} questions")


def check_cards(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    cards = data.get("cards") or []
    if len(cards) < 10:
        warnings.append(f"{path.name}: only {len(cards)} cards")
    seen: set[str] = set()
    required = ("external_id", "word", "phonetic", "translation_fa", "definition_en", "example_en", "audio")
    for card in cards:
        external = card.get("external_id", "")
        if external in seen:
            fail(path, f"duplicate card id {external}")
        seen.add(external)
        for field in required:
            if not str(card.get(field, "")).strip():
                fail(path, f"{external} missing {field}")
        if not PERSIAN.search(card.get("translation_fa", "")):
            fail(path, f"{external} has no Persian meaning")
    print(f"{path.name}: {len(cards)} cards")


def main() -> int:
    roots = [Path(arg) for arg in sys.argv[1:]] or [Path("database/seeders/fixtures")]
    files = [p for root in roots if root.exists() for p in sorted(root.glob("*.json"))]
    for path in files:
        if "cards" in path.name:
            check_cards(path)
        elif path.name.startswith("aef-3e"):
            check_exercises(path)
        elif path.name == "catalog.json":
            continue

    for warning in warnings:
        print(f"WARN  {warning}")
    for error in errors:
        print(f"ERROR {error}", file=sys.stderr)
    print(f"{len(files)} files, {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
