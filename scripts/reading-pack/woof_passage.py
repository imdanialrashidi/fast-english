#!/usr/bin/env python3
"""Build one IELTS/Inside Reading pack with Underdog Woof narration.

Woof is a local CPU model. Each sentence is synthesised separately, so the
sentence start/end in the concatenated paragraph MP3 is exact without an
ASR pass. Word clips are synthesised once per unique word; the app repeats
them. The script never writes a timing it did not measure.

Setup: the owner's Woof checkout (model + underdog_woof package) is passed
with --woof-dir. The generated MP3 carries the required credit metadata.

Input JSON:
    {
      "node": {"slug": "ielts/19/academic/test-1/passage-1",
               "title_en": "...", "title_fa": "..."},
      "passage": {"title_en": "...", "paragraphs": [
        {"id": "A", "label": "A", "text_en": "...",
         "words": [{"word": "mature", "definition_en": "fully grown",
                    "meaning_fa": "بالغ"}],
         "sentences_fa": ["...", "..."]}
      ]},
      "questions": [
        {"id": "q1", "number": 1, "type": "tfng", "prompt": "...",
         "options": [], "answer": "TRUE", "accepted": ["TRUE"],
         "explanation_fa": "...", "evidence_page": "A",
         "evidence_text": "A mature tree can lower the air temperature"}
      ]
    }
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

UTF16 = "utf-16-le"
SAMPLE_RATE = 24000
GAP_SECONDS = 0.35
TOKEN = re.compile(r"[A-Za-z0-9\u2019']+")


def utf16_len(text: str) -> int:
    return len(text.encode(UTF16)) // 2


def sentence_spans(text: str) -> list[tuple[int, int, str]]:
    """Split on sentence punctuation, keeping closing quotes and skipping
    abbreviations such as i.e./e.g. whose next word is lowercase."""
    spans: list[tuple[int, int, str]] = []
    start = 0
    for match in re.finditer(r"[.!?][\u2019\u201d\"]*\s+", text):
        end = match.end() - (len(match.group(0)) - len(match.group(0).rstrip()))
        following = text[match.end() : match.end() + 1]
        if not (following.isupper() or following.isdigit() or following in "\u2018\u201c\"'(\n"):
            continue
        if end > start:
            spans.append((start, end, text[start:end]))
        start = match.end()
    if start < len(text):
        spans.append((start, len(text), text[start:]))

    return [(utf16_len(text[:a]), utf16_len(text[:b]), chunk.strip()) for a, b, chunk in spans if chunk.strip()]


def find_span(text: str, needle: str) -> tuple[int, int] | None:
    index = text.find(needle)
    if index < 0:
        return None

    return utf16_len(text[:index]), utf16_len(text[: index + len(needle)])


def read_wav(path: Path) -> tuple[bytes, int]:
    with wave.open(str(path), "rb") as handle:
        if handle.getnchannels() != 1 or handle.getsampwidth() != 2:
            raise RuntimeError(f"{path} is not mono 16-bit")
        rate = handle.getframerate()

        return handle.readframes(handle.getnframes()), rate


def write_wav(path: Path, frames: bytes, rate: int) -> None:
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(frames)


def master_mp3(wav: Path, mp3: Path, title: str) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
            "-af", "silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak,"
            "areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak,"
            "areverse,adelay=60|60,apad=pad_dur=0.12,loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "96k",
            "-metadata", "artist=Underdog Woof",
            "-metadata", "comment=Voice by Underdog Woof",
            "-metadata", f"title={title}",
            str(mp3),
        ],
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--woof-dir", type=Path, default=Path("/home/danial/Documents/Projects/Kido-Talks-Flashcards/work/underdog-woof"))
    parser.add_argument("--voice", default="juno")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--limit", type=int, default=None, help="only the first N paragraphs (smoke test)")
    args = parser.parse_args()

    sys.path.insert(0, str(args.woof_dir))
    from underdog_woof import Woof  # noqa: PLC0415

    data = json.loads(args.input.read_text(encoding="utf-8"))
    node = data["node"]
    passage = data["passage"]
    paragraphs = passage["paragraphs"][: args.limit] if args.limit else passage["paragraphs"]

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "audio").mkdir(exist_ok=True)
    work = args.out / ".work"
    work.mkdir(exist_ok=True)

    tts = Woof(voice=args.voice)
    word_clips: dict[str, str] = {}
    word_index = 0
    out_paragraphs = []

    for paragraph in paragraphs:
        text = paragraph["text_en"]
        spans = sentence_spans(text)
        translations = paragraph.get("sentences_fa") or []
        frames: list[bytes] = []
        rate: int | None = None
        cursor = 0
        sentences = []

        for index, (start, end, chunk) in enumerate(spans):
            wav = work / f"{paragraph['id']}-{index:03d}.wav"
            if not wav.exists():
                audio = tts(chunk, seed=args.seed)
                tts.save(str(wav), audio)
            audio_frames, rate = read_wav(wav)
            if frames:
                frames.append(b"\x00\x00" * int(SAMPLE_RATE * GAP_SECONDS))
                cursor += int(SAMPLE_RATE * GAP_SECONDS)
            start_ms = round(cursor / SAMPLE_RATE * 1000)
            frames.append(audio_frames)
            cursor += len(audio_frames) // 2
            end_ms = round(cursor / SAMPLE_RATE * 1000)
            sentences.append(
                {
                    "start_utf16": start,
                    "end_utf16": end,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "text_fa": translations[index] if index < len(translations) else None,
                }
            )

        if rate is None:
            rate = SAMPLE_RATE
        combined = work / f"{paragraph['id']}.wav"
        write_wav(combined, b"".join(frames), rate)
        mp3 = args.out / "audio" / f"{paragraph['id']}.mp3"
        master_mp3(combined, mp3, f"{node['title_en']} — {paragraph.get('label', paragraph['id'])}")
        duration_ms = round(cursor / rate * 1000)

        words = []
        for word in paragraph.get("words", []):
            raw = word["word"]
            found = find_span(text, raw)
            if found is None and " " not in raw:
                for match in TOKEN.finditer(text):
                    if match.group(0).lower() == raw.lower():
                        found = (utf16_len(text[: match.start()]), utf16_len(text[: match.end()]))
                        break
            if found is None:
                print(f"warning: word not found in {paragraph['id']}: {raw}", file=sys.stderr)
                continue

            key = raw.lower()
            if key not in word_clips:
                word_index += 1
                word_wav = work / f"word-{word_index:04d}.wav"
                if not word_wav.exists():
                    tts.save(str(word_wav), tts(raw, seed=args.seed))
                word_mp3 = args.out / "audio" / f"w-{word_index:04d}.mp3"
                master_mp3(word_wav, word_mp3, raw)
                word_clips[key] = word_mp3.name

            words.append(
                {
                    "word": raw,
                    "definition_en": word.get("definition_en"),
                    "meaning_fa": word.get("meaning_fa"),
                    "part_of_speech": word.get("part_of_speech"),
                    "start_utf16": found[0],
                    "end_utf16": found[1],
                    "audio": {"file": word_clips[key]},
                }
            )

        out_paragraphs.append(
            {
                "id": paragraph["id"],
                "label": paragraph.get("label"),
                "text_en": text,
                "text_fa": paragraph.get("text_fa"),
                "audio": {"file": f"{paragraph['id']}.mp3", "duration_ms": duration_ms},
                "words": words,
                "sentences": sentences,
            }
        )
        print(f"{paragraph['id']}: {len(sentences)} sentences · {len(words)} words · {duration_ms}ms", file=sys.stderr)

    questions = []
    for question in data.get("questions", []):
        evidence_text = question.get("evidence_text")
        evidence_page = question.get("evidence_page")
        evidence = None
        if evidence_text is not None and evidence_page is not None:
            paragraph = next((p for p in out_paragraphs if p["id"] == evidence_page), None)
            if paragraph is not None:
                found = find_span(paragraph["text_en"], evidence_text)
                if found is not None:
                    evidence = {"page_key": evidence_page, "start_utf16": found[0], "end_utf16": found[1]}
        questions.append(
            {
                "id": question["id"],
                "number": question["number"],
                "number_end": question.get("number_end"),
                "weight": question.get("weight", 1),
                "type": question["type"],
                "instructions_fa": question.get("instructions_fa"),
                "prompt": question["prompt"],
                "options": question.get("options", []),
                "answer": question.get("answer"),
                "accepted": question.get("accepted", []),
                "word_limit": question.get("word_limit"),
                "max_answers": question.get("max_answers"),
                "explanation_fa": question.get("explanation_fa"),
                "why_wrong_fa": question.get("why_wrong_fa"),
                "evidence": evidence,
            }
        )

    pack = {
        "schema_version": "1.0",
        "track": "ielts",
        "node": node,
        "document": {
            "schema_version": "1.0",
            "meta": {"kind": "ielts", "credit": "Voice by Underdog Woof", "voice": args.voice},
            "passage": {
                "title_en": passage.get("title_en") or node["title_en"],
                "subtitle_fa": passage.get("subtitle_fa"),
                "paragraphs": out_paragraphs,
            },
            "questions": questions,
        },
    }
    (args.out / "pack.json").write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {args.out / 'pack.json'}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
