#!/usr/bin/env python3
"""Assemble the final, validated upload payload: topics, levels, summaries, audio map."""
from __future__ import annotations

import json
import os
import math
import re
from pathlib import Path

WORK = Path(os.environ.get("FE_WORK", "~/.cache/fast-english-upload")).expanduser()
JSON = WORK / "json"
LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
PERSIAN = re.compile(r"[\u0600-\u06FF]")

CATEGORIES = [
    {"slug": "news-politics", "name_fa": "اخبار و سیاست", "display_order": 1},
    {"slug": "film-tv", "name_fa": "سینما و تلویزیون", "display_order": 2},
    {"slug": "music-celebrity", "name_fa": "موسیقی و سلبریتی", "display_order": 3},
    {"slug": "literature", "name_fa": "ادبیات و کتاب", "display_order": 4},
]

TOPICS = [
    {
        "folder": "an_awkward_moment",
        "slug": "an-awkward-moment-danish-state-banquet",
        "title_en": "An Awkward Moment at a Danish State Banquet",
        "category": "news-politics",
        "summary_public": "در ضیافت رسمی کپنهاگ، ولیعهد ۲۱ساله دانمارک دستش را برای دست‌دادن دراز کرد و چند مهمان ویتنامی بدون دست‌دادن از کنارش گذشتند. ویدئوی این لحظه در اینترنت پخش شد و دلیل ماجرا هنوز تأیید نشده است.",
    },
    {
        "folder": "china_EU_trade_deal",
        "slug": "china-eu-trade-deal",
        "title_en": "China-EU Trade Deal",
        "category": "news-politics",
        "summary_public": "اتحادیه اروپا و چین به توافق تجاری‌ای رسیده‌اند که می‌تواند صادرات خودروهای هیبریدی چین به اروپا را در چهار سال بیش از نصف کم کند. دو طرف درباره کاهش عوارض برخی کالاهای اروپایی هم گفت‌وگو کرده‌اند.",
    },
    {
        "folder": "daler_mehndi",
        "slug": "daler-mehndi-interrupted-performance",
        "title_en": "Daler Mehndi's Interrupted Performance",
        "category": "music-celebrity",
        "summary_public": "یک وزیر ایالتی در جشنواره‌ای در اوتاراکند اجرای دالر مهندی را روی صحنه متوقف کرد و او را به نوشیدن الکل متهم کرد. مایک سینگ، برادر خواننده، ادعا را رد کرد و گفت برادرش به‌تازگی جراحی سنگین کرده بود.",
    },
    {
        "folder": "drake_1M",
        "slug": "drake-1m-birthday-bash",
        "title_en": "Drake's $1M Birthday Bash",
        "category": "music-celebrity",
        "summary_public": "دریک چهلمین سالگرد تولدش را با مهمانی‌ای با حدود ۴۰۰ مهمان در منهتن جشن گرفت. به گفته یک حاضرجلسه، مهمانان کیف‌های طراح و جایزه نقدی تا یک میلیون دلار گرفتند و بک‌استریت بویز اجرا کردند.",
    },
    {
        "folder": "DREW_BARRYMOR",
        "slug": "drew-and-kristen-go-makeup-free",
        "title_en": "Drew and Kristen Go Makeup-Free",
        "category": "music-celebrity",
        "summary_public": "درو بریمور و کریستن بل در برنامه درو بریمور آرایش و اکستنشن مویشان را برداشتند و درباره زیبایی و شبکه‌های اجتماعی گفت‌وگو کردند. بل گفت می‌خواهد به دخترانش نشان دهد آرایش یک انتخاب است، نه اجبار.",
    },
    {
        "folder": "ghosts_button",
        "slug": "ghosts-tops-uk-ireland-box-office",
        "title_en": "Ghosts Film Tops the UK-Ireland Box Office",
        "category": "film-tv",
        "summary_public": "فیلم Ghosts: The Possession of Button House در نخستین آخر هفته اکران، صدر جدول فروش بریتانیا و ایرلند را گرفت و از ۶۴۲ سینما ۲٫۴ میلیون پوند فروخت. این فیلم اقتباسی از سریال کمدی بی‌بی‌سی است.",
    },
    {
        "folder": "halloween",
        "slug": "celebrity-halloween-costumes",
        "title_en": "Celebrity Halloween Costumes",
        "category": "music-celebrity",
        "summary_public": "مجله کاسموپولیتن فهرست لباس‌های هالووین سلبریتی‌ها را آغاز کرده است؛ از کیم کارداشیان در نقش دخترش تا ویکتوریا جاستیس در نقش زامبی. این فهرست تا روز هالووین کامل‌تر می‌شود.",
    },
    {
        "folder": "HUNGER_GAMES",
        "slug": "hunger-games-first-reactions",
        "title_en": "First Reactions to the New Hunger Games Film",
        "category": "film-tv",
        "summary_public": "نخستین واکنش‌ها به فیلم The Hunger Games: Sunrise on the Reaping در نمایش لندن بیشتر مثبت بود و بازی جوزف زادا در نقش هایمیچِ جوان تحسین شد. این فیلم اقتباسی از رمان ۲۰۲۵ سوزان کالینز است.",
    },
    {
        "folder": "JAMes_gunn",
        "slug": "who-will-be-the-next-batman",
        "title_en": "Who Will Be the Next Batman?",
        "category": "film-tv",
        "summary_public": "جیمز گان می‌گوید انتخاب بازیگر نقش بتمن در دنیای سینمایی دی‌سی «چندان دور نیست»، اما هنوز هیچ بازیگری رسماً انتخاب نشده است. به گفته او، بازیگر احتمالی هم‌سن سوپرمن خواهد بود.",
    },
    {
        "folder": "mass_proteset_in_french",
        "slug": "mass-protests-in-france",
        "title_en": "Mass Protests in France",
        "category": "news-politics",
        "summary_public": "هزاران نفر در فرانسه در اعتراض به گرانی هزینه زندگی تظاهرات کردند و خواستار افزایش دستمزد، بهبود مستمری و خدمات عمومی قوی‌تر شدند. بیشتر تجمع‌ها مسالمت‌آمیز بود، اما در چند شهر از جمله پاریس درگیری رخ داد.",
    },
    {
        "folder": "nocturne",
        "slug": "nocturne-quiet-town-dangerous-killer",
        "title_en": "Nocturne: A Quiet Town, a Dangerous Killer",
        "category": "film-tv",
        "summary_public": "سریال جنایی ناکترن از ۳۰ اکتبر در اپل تی‌وی پخش می‌شود؛ کارآگاه پلیسی که برای زندگی آرام‌تر به شهرکی در پنسیلوانیا رفته است، با یک قاتل زنجیره‌ای روبه‌رو می‌شود. لیو شریبر و استیون گراهام بازیگران اصلی آن هستند.",
    },
    {
        "folder": "pride_and_prejudice",
        "slug": "pride-and-prejudice-returns",
        "title_en": "Pride and Prejudice: A Classic Story Returns",
        "category": "literature",
        "summary_public": "نتفلیکس تریلر سریال تازه غرور و تعصب را بر اساس رمان جین آستین منتشر کرده است. داستان الیزابت بنت و آقای دارسی با بازیگران و قواعد اجتماعی تازه به تصویر کشیده می‌شود.",
    },
    {
        "folder": "the_next_UN",
        "slug": "the-next-un-leader",
        "title_en": "The Next UN Leader",
        "category": "news-politics",
        "summary_public": "رقابت برای انتخاب دبیرکل بعدی سازمان ملل بالا گرفته است و ربکا گرینسپن، معاون پیشین رئیس‌جمهور کاستاریکا، یکی از نامزدهاست. شورای امنیت یک نامزد را پیشنهاد می‌دهد و مجمع عمومی او را منصوب می‌کند.",
    },
    {
        "folder": "US-Russia_Diesel_Deal",
        "slug": "us-russia-diesel-deal",
        "title_en": "US-Russia Diesel Deal",
        "category": "news-politics",
        "summary_public": "دونالد ترامپ اعلام کرد آمریکا گازوئیل از روسیه می‌خرد و روسیه و اوکراین حمله به تاسیسات انرژی را متوقف می‌کنند، اما اوکراین حملات را از سر گرفت. زلنسکی به این توافق انتقاد کرد و رهبران اروپا در بروکسل از اوکراین حمایت کردند.",
    },
    {
        "folder": "us_says_no_to_iran",
        "slug": "us-says-no-to-iran-plan",
        "title_en": "US Says No to Iran Plan",
        "category": "news-politics",
        "summary_public": "دونالد ترامپ طرح ایران درباره تنگه هرمز را رد کرده است. ایران می‌گوید در صورت توافق، این تنگه می‌تواند تا هفت روز دیگر باز شود؛ پیشنهاد از طریق قطر به آمریکا رسیده بود.",
    },
]

SENTENCE = re.compile(r"(?<=[.!?])\s+")
ABBREVIATION = re.compile(r"\b(Mr|Mrs|Ms|Dr|Prof|St|No|vs|etc|Inc|Ltd|Co|Jr|Sr|Sen|Rep|Gov|Gen|Col|Capt|Lt|Sgt|Mt|Ft)\.$")


def split_sentences(text: str) -> list[str]:
    parts = SENTENCE.split(text)
    merged: list[str] = []
    for part in parts:
        if merged and ABBREVIATION.search(merged[-1]):
            merged[-1] = f"{merged[-1]} {part}"
        else:
            merged.append(part)
    return [p.strip() for p in merged if p.strip()]


def reflow_long_paragraphs(paragraphs: list[str], notes: list[str]) -> list[str]:
    out: list[str] = []
    changed = 0
    for para in paragraphs:
        if len(para) <= 700:
            out.append(para)
            continue
        chunk: list[str] = []
        size = 0
        for sentence in split_sentences(para):
            chunk.append(sentence)
            size += len(sentence) + 1
            if size >= 480:
                out.append(" ".join(chunk))
                chunk, size = [], 0
        if chunk:
            out.append(" ".join(chunk))
        changed += 1
    if changed:
        notes.append(f"reflowed {changed} long paragraph(s)")
    return out


def normalize_body(body: str, topic_title: str) -> tuple[str, list[str]]:
    notes: list[str] = []
    paragraphs = [re.sub(r"\s+", " ", p).strip() for p in body.split("\n\n")]
    kept = []
    for para in paragraphs:
        if not para:
            continue
        squashed = re.sub(r"[^a-z0-9]+", " ", para.lower()).strip()
        title_key = re.sub(r"[^a-z0-9]+", " ", topic_title.lower()).strip()
        if squashed == title_key or (len(para) < 90 and not re.search(r"[.!?]$", para) and title_key and squashed == title_key):
            notes.append("dropped leaked title line")
            continue
        kept.append(para)

    lengths = [len(p) for p in kept]
    if len(kept) >= 4 and sum(lengths) / len(lengths) < 200:
        joined = " ".join(kept)
        sentences = split_sentences(joined)
        grouped = []
        for i in range(0, len(sentences), 3):
            grouped.append(" ".join(sentences[i : i + 3]))
        notes.append(f"merged {len(kept)} short paragraphs into {len(grouped)}")
        kept = grouped

    kept = reflow_long_paragraphs(kept, notes)
    text = "\n\n".join(kept)
    if re.search(r"[ \t]{2,}", text):
        text = re.sub(r"[ \t]{2,}", " ", text)
        notes.append("collapsed extra spaces")
    return text.strip(), notes


def main() -> int:
    manifest = {
        (row["folder"].replace(" ", "_"), row["level"]): row
        for row in json.loads((JSON / "audio-manifest.json").read_text(encoding="utf-8"))
        if row.get("status") == "encoded"
    }
    content = {"categories": CATEGORIES, "topics": []}
    problems: list[dict] = []

    for topic in TOPICS:
        data = json.loads((JSON / f"{topic['folder']}.json").read_text(encoding="utf-8"))
        doc_title_line = ""
        levels = []
        for level in LEVELS:
            entry = data["levels"].get(level)
            if entry is None:
                problems.append({"topic": topic["slug"], "level": level, "issue": "no transcript"})
                continue
            body, notes = normalize_body(entry["body"], topic["title_en"])
            audio = manifest.get((topic["folder"], level))
            if audio is None:
                problems.append({"topic": topic["slug"], "level": level, "issue": "no validated audio"})
                continue
            if not body:
                problems.append({"topic": topic["slug"], "level": level, "issue": "empty body"})
                continue
            if PERSIAN.search(body):
                problems.append({"topic": topic["slug"], "level": level, "issue": "persian in body"})
                continue
            if "<" in body and ">" in body:
                problems.append({"topic": topic["slug"], "level": level, "issue": "possible html"})
                continue
            glossary = entry["glossary_fa"]
            if not (1 <= len(glossary) <= 12):
                problems.append({"topic": topic["slug"], "level": level, "issue": f"glossary size {len(glossary)}"})
                continue
            if any(not PERSIAN.search(g["meaning_fa"]) for g in glossary):
                problems.append({"topic": topic["slug"], "level": level, "issue": "non-persian glossary meaning"})
                continue
            duration = int(round(audio["mp3_seconds"]))
            levels.append({
                "level": level,
                "title_en": topic["title_en"],
                "body_en": body,
                "duration_seconds": duration,
                "estimated_minutes": max(2, math.ceil(duration / 60) + 1),
                "glossary": glossary,
                "audio_file": audio["mp3"],
                "audio_bytes": audio["mp3_bytes"],
                "audio_sha256": audio["mp3_sha256"],
                "audio_lufs": audio.get("lufs_out"),
                "normalization": notes,
            })
        content["topics"].append({**topic, "levels": levels})

    (JSON / "content.json").write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")

    report = {
        "topics": len(content["topics"]),
        "levels": sum(len(t["levels"]) for t in content["topics"]),
        "problems": problems,
        "per_topic": [
            {"slug": t["slug"], "levels": [l["level"] for l in t["levels"]]} for t in content["topics"]
        ],
    }
    print(json.dumps(report, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
