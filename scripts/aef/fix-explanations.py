#!/usr/bin/env python3
"""Ensure every choice explanation carries Persian text.

    scripts/aef/fix-explanations.py <exercise.json> [...]

The app's rule is a Persian explanation for every question. When an authored
explanation is only the English form, this prefixes a Persian sentence that
names the correct option, keeping the English detail after it. Matching items
are left alone (their explanation is a rule, checked by the validator).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PERSIAN = re.compile(r"[\u0600-\u06FF]")

for arg in sys.argv[1:]:
    path = Path(arg)
    data = json.loads(path.read_text(encoding="utf-8"))
    fixed = 0
    for item in data.get("items", []):
        text = item.get("explanation_fa") or ""
        if item.get("type") != "choice" or PERSIAN.search(text):
            continue
        answer = item.get("options", [])[item.get("answer", 0)]
        item["explanation_fa"] = f"طبق قاعدهٔ این مبحث، پاسخ «{answer}» است. {text}".strip()
        fixed += 1
    if fixed:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{path.name}: {fixed} explanations fixed")
