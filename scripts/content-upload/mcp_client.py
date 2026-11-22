#!/usr/bin/env python3
"""Minimal MCP Streamable-HTTP client for the Fast English content server."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import requests

ENDPOINT = os.environ.get("FE_MCP_ENDPOINT", "https://fastenglishpodcast.ir/mcp/content")
TOKEN_FILE = Path(os.environ.get("FE_MCP_TOKEN_FILE", "~/.config/fast-english/mcp-agent-token")).expanduser()
TIMEOUT = 120


class McpError(RuntimeError):
    pass


class Client:
    def __init__(self, endpoint: str = ENDPOINT, token: str | None = None) -> None:
        self.endpoint = endpoint
        self.token = token or TOKEN_FILE.read_text(encoding="utf-8").strip()
        self.session = requests.Session()
        # The host has a SOCKS proxy in its environment; direct TLS is what the
        # production origin expects and proxying large uploads caused resets.
        self.session.trust_env = False
        self.session.headers.update({
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "User-Agent": "FastEnglishContentAgent/1.0",
        })
        self._id = 0
        self.remaining: str | None = None
        self._last_upload = 0.0
        self.initialize()

    def _post(self, payload: dict, attempts: int = 6) -> dict:
        last: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                r = self.session.post(self.endpoint, json=payload, timeout=TIMEOUT)
                break
            except Exception as exc:  # connection reset, TLS EOF, timeout
                last = exc
                time.sleep(min(30, 3 * attempt))
        else:
            raise McpError(f"MCP transport failed after {attempts} attempts: {last}")
        if r.status_code >= 500:
            raise McpError(f"HTTP {r.status_code}: {r.text[:300]}")
        if r.status_code >= 400:
            raise McpError(f"HTTP {r.status_code}: {r.text[:400]}")
        if "text/event-stream" in r.headers.get("Content-Type", ""):
            for line in r.text.splitlines():
                if line.startswith("data: "):
                    return json.loads(line[6:])
            raise McpError(f"empty SSE response: {r.text[:200]}")
        return r.json()

    def _rpc(self, method: str, params: dict | None = None) -> dict:
        self._id += 1
        body = {"jsonrpc": "2.0", "id": self._id, "method": method, "params": params or {}}
        data = self._post(body)
        if "error" in data:
            raise McpError(str(data["error"]))
        return data.get("result", {})

    def initialize(self) -> None:
        self._rpc("initialize", {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "fast-english-content-agent", "version": "1.0"},
        })

    def tools(self) -> list[dict]:
        return self._rpc("tools/list").get("tools", [])

    def call(self, name: str, arguments: dict) -> dict:
        result = self._rpc("tools/call", {"name": name, "arguments": arguments})
        if result.get("structuredContent") is not None:
            payload = result["structuredContent"]
        else:
            texts = [c.get("text", "") for c in result.get("content", []) if c.get("type") == "text"]
            raw = "\n".join(texts)
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                payload = {"ok": not result.get("isError", False), "raw": raw}
        if payload.get("ok") is False:
            raise McpError(f"{name}: {payload.get('message')} {payload.get('errors') or ''}".strip())
        return payload

    def begin_upload(self, kind: str, path: Path, attempts: int = 6) -> str:
        size = path.stat().st_size
        last_error = ""
        for attempt in range(1, attempts + 1):
            # Pace uploads under the server's 20/minute binary throttle.
            gap = time.monotonic() - self._last_upload
            if gap < 4.5:
                time.sleep(4.5 - gap)
            payload = self.call("begin-upload", {"kind": kind, "size_bytes": size, "filename": path.name})
            upload = payload["upload"]
            with path.open("rb") as fh:
                r = self.session.put(
                    upload["url"],
                    data=fh,
                    headers={
                        "X-Upload-Token": upload["headers"]["X-Upload-Token"],
                        "Content-Type": "application/octet-stream",
                        "User-Agent": "FastEnglishContentAgent/1.0",
                    },
                    timeout=TIMEOUT,
                )
            self._last_upload = time.monotonic()
            self.remaining = r.headers.get("X-RateLimit-Remaining")
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After") or 30)
                last_error = f"HTTP 429 (retry after {wait}s)"
                time.sleep(wait + 2)
                continue
            # 499 (client closed request) is what the host network returns on large PUTs;
            # the standard treats it as a transport error and retries with backoff.
            if r.status_code >= 500 or r.status_code in (408, 499):
                last_error = f"HTTP {r.status_code}"
                time.sleep(5 * attempt)
                continue
            if r.status_code >= 400:
                raise McpError(f"upload PUT {path.name}: HTTP {r.status_code} {r.text[:300]}")
            return upload["upload_id"]
        raise McpError(f"upload PUT {path.name} failed: {last_error}")
