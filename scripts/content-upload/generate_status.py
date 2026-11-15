#!/usr/bin/env python3
"""Write the non-destructive upload status report into the source folder."""
from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path

SRC = Path("/home/danial/Documents/Projects/FastEnglish - Eps")
WORK = Path("/home/danial/.cache/fast-english-upload")
JSON = WORK / "json"
STATUS = SRC / "_Upload-Status"
BASE = "https://fastenglishpodcast.ir"

SAMPLES = {
    ("an-awkward-moment-danish-state-banquet", "A2"),
    ("an-awkward-moment-danish-state-banquet", "B1"),
}

MISSING_REASON = {
    ("an-awkward-moment-danish-state-banquet", "C1"): "فایل صوتی در منبع وجود ندارد (c1.wav ساخته نشده است).",
    ("the-next-un-leader", "B1"): "فایل b1.wav خالی است (۱٫۹ کیلوبایت، ۰٫۰۴ ثانیه)؛ صدای سالمی ندارد.",
    ("us-russia-diesel-deal", "A2"): "فایل a2.wav خالی است (۱٫۹ کیلوبایت، ۰٫۰۴ ثانیه)؛ صدای سالمی ندارد.",
}


def fa_num(value: int | float) -> str:
    return str(value).translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))


def main() -> int:
    content = json.loads((JSON / "content.json").read_text(encoding="utf-8"))
    state = json.loads((JSON / "upload-state.json").read_text(encoding="utf-8"))
    verify = json.loads((JSON / "verify-report.json").read_text(encoding="utf-8")) if (JSON / "verify-report.json").exists() else {"errors": []}
    covers = json.loads((JSON / "cover-final.json").read_text(encoding="utf-8"))
    categories = {c["slug"]: c["name_fa"] for c in content["categories"]}
    generated = datetime.now().strftime("%Y-%m-%d %H:%M")
    errors = verify.get("errors") or []

    STATUS.mkdir(exist_ok=True)
    rows: list[dict] = []
    summaries: list[dict] = []

    for topic in content["topics"]:
        slug = topic["slug"]
        entry = state.get(slug, {})
        topic_published = bool(entry.get("published"))
        folder = SRC / next(d.name for d in SRC.iterdir() if d.is_dir() and d.name.replace(" ", "_") == topic["folder"])
        cover = covers[topic["folder"]]
        topic_summary = {
            "folder": folder.name,
            "title": topic["title_en"],
            "slug": slug,
            "category": categories[topic["category"]],
            "url": f"{BASE}/app/topics/{slug}",
            "published": topic_published,
            "levels": [],
        }
        for level in topic["levels"]:
            record = entry.get("levels", {}).get(level["level"], {})
            published = bool(record.get("published"))
            rows.append({
                "episode_folder": folder.name,
                "topic_title": topic["title_en"],
                "topic_slug": slug,
                "category_fa": categories[topic["category"]],
                "level": level["level"],
                "status": "published" if published else "uploaded_not_published",
                "is_public_sample": "yes" if (slug, level["level"]) in SAMPLES else "no",
                "duration_seconds": level["duration_seconds"],
                "estimated_minutes": level["estimated_minutes"],
                "glossary_entries": len(level["glossary"]),
                "audio_source_file": f"{level['level']}.wav",
                "mp3_file": level["audio_file"],
                "mp3_bytes": level["audio_bytes"],
                "mp3_sha256": level["audio_sha256"],
                "public_url": f"{BASE}/app/topics/{slug}?level={level['level']}",
                "cover_license": (cover.get("source") or {}).get("license"),
                "cover_source": (cover.get("source") or {}).get("source_url"),
            })
            topic_summary["levels"].append({
                "level": level["level"],
                "published": published,
                "duration": level["duration_seconds"],
            })
        missing = [lvl for lvl in ["A1", "A2", "B1", "B2", "C1", "C2"] if lvl not in {l["level"] for l in topic["levels"]}]
        for level in missing:
            reason = MISSING_REASON.get((slug, level), "فایل صوتی در منبع موجود نیست.")
            rows.append({
                "episode_folder": folder.name,
                "topic_title": topic["title_en"],
                "topic_slug": slug,
                "category_fa": categories[topic["category"]],
                "level": level,
                "status": "missing_audio",
                "is_public_sample": "no",
                "duration_seconds": "",
                "estimated_minutes": "",
                "glossary_entries": "",
                "audio_source_file": f"{level}.wav",
                "mp3_file": "",
                "mp3_bytes": "",
                "mp3_sha256": "",
                "public_url": f"{BASE}/app/topics/{slug}",
                "cover_license": (cover.get("source") or {}).get("license"),
                "cover_source": (cover.get("source") or {}).get("source_url"),
                "note": reason,
            })
            topic_summary["levels"].append({"level": level, "published": False, "duration": None, "missing": reason})

        order = {lvl: i for i, lvl in enumerate(["A1", "A2", "B1", "B2", "C1", "C2"])}
        topic_summary["levels"].sort(key=lambda item: order.get(item["level"], 99))
        summaries.append(topic_summary)

        lines = [
            f"# وضعیت آپلود — {topic['title_en']}",
            "",
            f"- اسلاگ: `{slug}`",
            f"- دسته: {categories[topic['category']]}",
            f"- آدرس سایت: {BASE}/app/topics/{slug}",
            f"- وضعیت: {'منتشرشده روی سایت' if topic_published else 'آپلود نشده'}",
            f"- کاور: {((cover.get('source') or {}).get('license')) or '—'} — {(cover.get('source') or {}).get('source_url')}",
            "",
            "| سطح | مدت (ثانیه) | وضعیت |",
            "| --- | --- | --- |",
        ]
        for item in topic_summary["levels"]:
            if item.get("missing"):
                lines.append(f"| {item['level']} | — | آپلود نشد: {item['missing']} |")
            else:
                label = "منتشرشده" if item["published"] else "آپلودشده، منتشرنشده"
                if (slug, item["level"]) in SAMPLES:
                    label += " — نمونهٔ رایگان صفحهٔ اصلی"
                lines.append(f"| {item['level']} | {fa_num(item['duration'])} | {label} |")
        if slug == "us-says-no-to-iran-plan":
            lines += [
                "",
                "یادداشت: متن این اپیزود در پوشه نبود و از نسخهٔ ارسالی در Downloads بازیابی و در همین پوشه کپی شد.",
            ]
        lines += [
            "",
            "این فایل خودکار توسط ابزار آپلود تولید شده است؛ آن را پاک نکنید تا سابقه وضعیت بماند.",
            "",
        ]
        (folder / "UPLOAD-STATUS.md").write_text("\n".join(lines), encoding="utf-8")

    csv_path = STATUS / "upload-manifest.csv"
    fields = [
        "episode_folder", "topic_title", "topic_slug", "category_fa", "level", "status", "is_public_sample",
        "duration_seconds", "estimated_minutes", "glossary_entries", "audio_source_file",
        "mp3_file", "mp3_bytes", "mp3_sha256", "public_url", "cover_license", "cover_source", "note",
    ]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, restval="")
        writer.writeheader()
        writer.writerows(rows)

    published_lessons = sum(1 for r in rows if r["status"] == "published")
    missing_rows = [r for r in rows if r["status"] == "missing_audio"]
    report = {
        "generated_at": generated,
        "site": BASE,
        "topics_total": len(content["topics"]),
        "topics_published": sum(1 for s in summaries if s["published"]),
        "lessons_total": len(rows),
        "lessons_published": published_lessons,
        "lessons_missing_audio": len(missing_rows),
        "missing": [{"topic": r["topic_slug"], "level": r["level"], "reason": r["note"]} for r in missing_rows],
        "verification_errors": errors,
        "topics": summaries,
    }
    (STATUS / "upload-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    readme = f"""# وضعیت آپلود پادکست‌ها

این پوشه وضعیت آپلود محتوای پوشهٔ FastEnglish - Eps روی سایت را نگه می‌دارد.
تاریخ ساخت گزارش: {generated}

## خلاصه

- اپیزودها: {fa_num(report['topics_published'])} از {fa_num(report['topics_total'])} منتشر شده‌اند.
- درس‌ها (سطح‌ها): {fa_num(published_lessons)} از {fa_num(len(rows))} منتشر شده‌اند.
- سطح‌های بدون صوت سالم: {fa_num(len(missing_rows))}
- نمونهٔ رایگان صفحهٔ اصلی: «An Awkward Moment at a Danish State Banquet» در سطح‌های A2 و B1

## فایل‌ها

- `upload-manifest.csv` — یک ردیف برای هر سطح: وضعیت، مدت، حجم، هش فایل، لایسنس کاور و آدرس سایت.
- `upload-report.json` — همان داده‌ها به‌صورت ماشین‌خوان برای اتوماسیون.
- `verify-report.json` — نتیجهٔ بررسی نهایی سرور (وضعیت، مدت، هش صوت، کاور).
- `covers-preview.jpg` — پیش‌نمایش همهٔ کاورهای منتشرشده.
- `UPLOAD-STATUS.md` داخل هر پوشهٔ اپیزود — خلاصهٔ همان اپیزود.

## سطح‌های آپلودنشده

{chr(10).join(f"- `{r['topic_slug']}` / {r['level']} — {r['note']}" for r in missing_rows) or '- موردی نیست.'}

برای تکمیل، فایل WAV سالم را با همان نام سطح داخل پوشهٔ اپیزود بگذارید و همین ابزار آپلود را دوباره اجرا کنید؛ متن و سایر سطح‌ها دست‌نخورده می‌مانند.

## وضعیت بررسی خودکار

{"- همهٔ بررسی‌ها بدون خطا گذشت." if not errors else chr(10).join(f"- {e}" for e in errors)}
"""
    (STATUS / "README.md").write_text(readme, encoding="utf-8")

    print(json.dumps({
        "topics": report["topics_total"],
        "published": report["topics_published"],
        "lessons": len(rows),
        "published_lessons": published_lessons,
        "missing": len(missing_rows),
        "errors": len(errors),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
