#!/usr/bin/env python3
"""Verify the production upload against the local manifest and database."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import requests

from mcp_client import Client

WORK = Path(os.environ.get("FE_WORK", "~/.cache/fast-english-upload")).expanduser()
JSON = WORK / "json"
FE_HOST = os.environ.get("FE_HOST", "root@185.226.119.68")
FE_KEY = os.environ.get("FE_KEY", str(Path("~/.ssh/fe_fastenglishpodcast").expanduser()))
APP_FILTER = os.environ.get("FE_APP_FILTER", "app-uerwghnhy5ezsd3ghxo96ugl")
DB_FILTER = os.environ.get("FE_DB_FILTER", "db-uerwghnhy5ezsd3ghxo96ugl")
SSH = ["ssh", "-i", FE_KEY, "-o", "BatchMode=yes", "-o", "ConnectTimeout=25", FE_HOST]
# Exactly the levels that must carry the free-sample flag (see pipeline §10).
SAMPLES = {
    ("an-awkward-moment-danish-state-banquet", "A2"),
    ("an-awkward-moment-danish-state-banquet", "B1"),
}


def remote_sql(sql: str) -> str:
    script = (
        'D=$(docker ps --filter name=db-uerwghnhy5ezsd3ghxo96ugl --format "{{.Names}}" | head -1); '
        'P=$(docker exec "$D" printenv POSTGRES_PASSWORD); '
        'docker exec -i -e PGPASSWORD="$P" "$D" psql -U fast_english -d fast_english -tA -v ON_ERROR_STOP=1'
    )
    proc = subprocess.run([*SSH, script], input=sql, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[-500:])
    return proc.stdout


def remote_hashes(paths: list[str]) -> dict[str, str]:
    if not paths:
        return {}
    script = (
        'C=$(docker ps --filter name=app-uerwghnhy5ezsd3ghxo96ugl --format "{{.Names}}" | head -1); '
        'docker exec "$C" sh -c "cd /var/www/html/storage/app/private && sha256sum ' + " ".join(paths) + '"'
    )
    proc = subprocess.run([*SSH, script], capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[-500:])
    out = {}
    for line in proc.stdout.splitlines():
        parts = line.split(maxsplit=1)
        if len(parts) == 2:
            out[parts[1].strip()] = parts[0]
    return out


def main() -> int:
    content = json.loads((JSON / "content.json").read_text(encoding="utf-8"))
    state = json.loads((JSON / "upload-state.json").read_text(encoding="utf-8"))
    client = Client()

    sql = """
    select json_agg(row_to_json(t)) from (
      select tp.slug, tp.title_en, tp.status, c.slug as category,
             l.id, l.level, l.status as lesson_status, l.audio_path, l.duration_seconds,
             l.estimated_minutes, l.audio_revision, l.reviewed_by, l.reviewed_at,
             l.is_public_sample, jsonb_array_length(coalesce(l.glossary,'[]'::jsonb)) as glossary_count
      from topics tp left join lessons l on l.topic_id = tp.id
      left join categories c on c.id = tp.category_id
      order by tp.id, l.level
    ) t;
    """
    rows = json.loads(remote_sql(sql).strip() or "[]")
    db = {}
    for row in rows:
        db.setdefault(row["slug"], {"status": row["status"], "category": row["category"], "title": row["title_en"], "lessons": []})
        if row["id"] is not None:
            db[row["slug"]]["lessons"].append(row)

    errors: list[str] = []
    checked: list[dict] = []
    audio_paths: list[str] = []

    for topic in content["topics"]:
        slug = topic["slug"]
        row = db.get(slug)
        if row is None:
            errors.append(f"{slug}: missing from database")
            continue
        if row["status"] != "published":
            errors.append(f"{slug}: topic status {row['status']}")
        if (row["category"] or None) != topic["category"]:
            errors.append(f"{slug}: category {row['category']} != {topic['category']}")
        if row["title"] != topic["title_en"]:
            errors.append(f"{slug}: title mismatch")
        by_level = {l["level"]: l for l in row["lessons"]}
        for lesson in topic["levels"]:
            level = lesson["level"]
            rec = by_level.get(level)
            if rec is None:
                errors.append(f"{slug}/{level}: missing lesson row")
                continue
            if rec["lesson_status"] != "published":
                errors.append(f"{slug}/{level}: status {rec['lesson_status']}")
            if rec["duration_seconds"] != lesson["duration_seconds"]:
                errors.append(f"{slug}/{level}: duration {rec['duration_seconds']} != {lesson['duration_seconds']}")
            if rec["estimated_minutes"] != lesson["estimated_minutes"]:
                errors.append(f"{slug}/{level}: minutes mismatch")
            if rec["glossary_count"] != len(lesson["glossary"]):
                errors.append(f"{slug}/{level}: glossary {rec['glossary_count']} != {len(lesson['glossary'])}")
            if rec["reviewed_by"] is None or rec["reviewed_at"] is None:
                errors.append(f"{slug}/{level}: no review recorded")
            if bool(rec["is_public_sample"]) != ((slug, level) in SAMPLES):
                errors.append(f"{slug}/{level}: public sample flag {rec['is_public_sample']} != expected {(slug, level) in SAMPLES}")
            if rec["audio_revision"] != 1:
                errors.append(f"{slug}/{level}: audio revision {rec['audio_revision']}")
            audio_paths.append(rec["audio_path"])
            checked.append({
                "topic": slug, "level": level, "lesson_id": rec["id"], "duration": rec["duration_seconds"],
                "audio_path": rec["audio_path"], "status": rec["lesson_status"], "reviewed": True,
            })

        expected_levels = {l["level"] for l in topic["levels"]}
        extras = set(by_level) - expected_levels
        if extras:
            errors.append(f"{slug}: unexpected levels {sorted(extras)}")

    hashes = remote_hashes(audio_paths)
    manifest = {}
    for topic in content["topics"]:
        for lesson in topic["levels"]:
            manifest[(topic["slug"], lesson["level"])] = lesson

    for item in checked:
        lesson = manifest[(item["topic"], item["level"])]
        remote = hashes.get(item["audio_path"])
        if not remote:
            errors.append(f"{item['topic']}/{item['level']}: stored audio not hashed ({item['audio_path']})")
        elif remote != lesson["audio_sha256"]:
            errors.append(f"{item['topic']}/{item['level']}: stored audio hash differs")

    covers = json.loads((JSON / "cover-final.json").read_text(encoding="utf-8"))
    cover_checks = []
    for topic in content["topics"]:
        slug = topic["slug"]
        mcp = client.call("get-content", {"topic_slug": slug})
        t = mcp["topic"]
        cover_url = t.get("cover_url") or ""
        if not cover_url.startswith("/storage/covers/"):
            errors.append(f"{slug}: cover path {cover_url}")
            continue
        url = "https://fastenglishpodcast.ir" + cover_url
        r = requests.get(url, timeout=60)
        if r.status_code != 200 or not r.content.startswith(b"\xff\xd8\xff"):
            errors.append(f"{slug}: cover HTTP {r.status_code}")
            continue
        cover_checks.append({"slug": slug, "url": url, "bytes": len(r.content)})
        if len(r.content) >= 2 * 1024 * 1024:
            errors.append(f"{slug}: cover >= 2MB")
        for l in t["lessons"]:
            if l["status"] != "published" or not l["reviewed"] or not l["audio_ready"]:
                errors.append(f"{slug}/{l['level']}: MCP reports status={l['status']} reviewed={l['reviewed']} audio_ready={l['audio_ready']}")

    counts = client.call("list-content", {"limit": 200})["counts"]
    report = {
        "checked_topics": len(content["topics"]),
        "checked_lessons": len(checked),
        "counts": counts,
        "covers": cover_checks,
        "errors": errors,
    }
    (JSON / "verify-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "covers"}, ensure_ascii=False, indent=1))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
