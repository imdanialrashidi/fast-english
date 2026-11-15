#!/usr/bin/env python3
"""Upload the prepared podcast library to production through the content MCP server."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from collections import deque
from pathlib import Path

from mcp_client import Client, McpError

WORK = Path(os.environ.get("FE_WORK", "~/.cache/fast-english-upload")).expanduser()
JSON = WORK / "json"
LOG = WORK / "logs" / "upload.log"
STATE_FILE = JSON / "upload-state.json"
CHECKED = "2026-11-15"
UPLOAD_BUDGET = 18  # keep below the server's 20/minute upload throttle


class Uploader:
    def __init__(self, state: dict) -> None:
        self.client = Client()
        self.state = state
        self.uploads: deque[float] = deque()
        self.errors: list[dict] = []

    # -- plumbing ---------------------------------------------------------

    def log(self, message: str) -> None:
        line = f"{time.strftime('%H:%M:%S')} {message}"
        print(line, flush=True)
        with LOG.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")

    def save_state(self) -> None:
        STATE_FILE.write_text(json.dumps(self.state, ensure_ascii=False, indent=2), encoding="utf-8")

    def _throttle_upload(self) -> None:
        now = time.monotonic()
        while self.uploads and now - self.uploads[0] > 60:
            self.uploads.popleft()
        if len(self.uploads) >= UPLOAD_BUDGET:
            time.sleep(60 - (now - self.uploads[0]) + 0.5)
        self.uploads.append(time.monotonic())

    def call(self, name: str, args: dict, attempts: int = 3) -> dict:
        last: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                return self.client.call(name, args)
            except McpError as exc:
                message = str(exc)
                if any(marker in message for marker in ("ability", "validation", "was not found", "draft-only", "required")):
                    raise
                last = exc
            except Exception as exc:  # network hiccup or transient server error
                last = exc
            self.log(f"  retry {attempt}/{attempts} {name}: {str(last)[:160]}")
            time.sleep(4 * attempt)
        raise RuntimeError(f"{name} failed after {attempts} attempts: {last}")

    def upload(self, kind: str, path: Path) -> str:
        self._throttle_upload()
        return self.client.begin_upload(kind, path)

    # -- content ----------------------------------------------------------

    def ensure_categories(self, categories: list[dict]) -> dict[str, int]:
        ids: dict[str, int] = {}
        for category in categories:
            payload = self.call("save-category", {
                "slug": category["slug"],
                "name_fa": category["name_fa"],
                "display_order": category["display_order"],
                "is_active": True,
            })
            ids[category["slug"]] = int(payload["category"]["id"])
            self.log(f"category {category['slug']} -> {payload['category']['id']} ({'created' if payload['created'] else 'existing'})")
        return ids

    def source_note(self, slug: str, title: str, cover: dict) -> str:
        source = cover.get("source") or {}
        origin = source.get("source_url") or source.get("source") or "unrecorded"
        license_name = source.get("license") or "unrecorded"
        artist = (source.get("artist") or "").strip()
        detail = f"Editorial cover for {title}; center-cropped 16:9, resized 1200x675, metadata stripped; no text or logo added."
        if artist:
            detail = f"{detail} Credit: {artist}."
        return f"Source: {origin}\nLicense: {license_name}\nChecked: {CHECKED}\nNotes: {detail}"

    def upload_topic(self, topic: dict, category_id: int, cover_path: Path, cover_meta: dict) -> None:
        slug = topic["slug"]
        entry = self.state.setdefault(slug, {"topic_id": None, "levels": {}, "published": False})
        self.log(f"topic {slug}")

        topic_args = {
            "slug": slug,
            "title_en": topic["title_en"],
            "summary_public": topic["summary_public"],
            "category_id": category_id,
        }
        if not entry.get("cover_url"):
            topic_args["cover_upload_id"] = self.upload("cover", cover_path)
            topic_args["source_note"] = self.source_note(slug, topic["title_en"], cover_meta)
        payload = self.call("save-topic", topic_args)
        entry["topic_id"] = int(payload["topic"]["id"])
        entry["cover_url"] = payload["topic"].get("cover_url")
        problems = payload.get("publish_problems") or {}
        if problems:
            raise RuntimeError(f"topic {slug} publish problems: {problems}")
        self.save_state()
        self.log(f"  topic id={entry['topic_id']} cover={entry['cover_url']}")

        problems: list[str] = []
        for lesson in topic["levels"]:
            level = lesson["level"]
            record = entry["levels"].setdefault(level, {})
            if not record.get("uploaded"):
                audio_upload = self.upload("audio", WORK / "mp3" / lesson["audio_file"])
                payload = self.call("save-lesson", {
                    "topic_slug": slug,
                    "level": level,
                    "title_en": lesson["title_en"],
                    "body_en": lesson["body_en"],
                    "duration_seconds": lesson["duration_seconds"],
                    "estimated_minutes": lesson["estimated_minutes"],
                    "glossary": lesson["glossary"],
                    "audio_upload_id": audio_upload,
                    "is_public_sample": False,
                })
                record["lesson_id"] = int(payload["lesson"]["id"])
                record["uploaded"] = True
                record["duration"] = lesson["duration_seconds"]
                self.save_state()
            else:
                payload = self.call("get-content", {"topic_slug": slug})
                found = next((l for l in payload["topic"]["lessons"] if l["level"] == level), None)
                if found:
                    record["lesson_id"] = int(found["id"])
            self.log(f"  lesson {level} id={record.get('lesson_id')} {lesson['duration_seconds']}s")
            if record.get("lesson_id") is None:
                problems.append(f"{level}: no lesson id returned")
            elif payload.get("publish_problems"):
                self.log(f"  pre-publish gaps {level}: {payload['publish_problems']}")

        if problems:
            raise RuntimeError(f"lesson problems for {slug}: {problems}")

    def publish_topic(self, topic: dict) -> None:
        slug = topic["slug"]
        entry = self.state[slug]
        if not entry.get("published"):
            payload = self.call("transition-content", {"type": "topic", "action": "publish", "topic_slug": slug})
            entry["published"] = payload["status"] == "published"
            self.save_state()
            self.log(f"  published topic {slug}: {payload['status']}")
        for lesson in topic["levels"]:
            level = lesson["level"]
            record = entry["levels"].setdefault(level, {})
            if record.get("published"):
                continue
            payload = self.call("transition-content", {
                "type": "lesson",
                "action": "publish",
                "topic_slug": slug,
                "level": level,
                "confirm_review": True,
            })
            record["published"] = payload["status"] == "published"
            record["reviewed"] = payload["content"].get("reviewed")
            self.save_state()
            self.log(f"  published {slug}/{level}: {payload['status']}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="*", default=None, help="Topic slugs to upload")
    parser.add_argument("--skip-publish", action="store_true")
    args = parser.parse_args()

    content = json.loads((JSON / "content.json").read_text(encoding="utf-8"))
    covers = json.loads((JSON / "cover-final.json").read_text(encoding="utf-8"))
    state = json.loads(STATE_FILE.read_text(encoding="utf-8")) if STATE_FILE.exists() else {}

    uploader = Uploader(state)
    category_ids = uploader.ensure_categories(content["categories"])

    topics = [t for t in content["topics"] if not args.only or t["slug"] in args.only]
    failures = 0
    for topic in topics:
        cover_path = Path(covers[topic["folder"]]["file"])
        try:
            uploader.upload_topic(topic, category_ids[topic["category"]], cover_path, covers[topic["folder"]])
            if not args.skip_publish:
                uploader.publish_topic(topic)
        except Exception as exc:
            failures += 1
            uploader.log(f"FAILED {topic['slug']}: {exc}")
            with LOG.open("a", encoding="utf-8") as fh:
                fh.write(traceback.format_exc() + "\n")
    uploader.log(f"done: {len(topics) - failures}/{len(topics)} topics, failures={failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
