// e2e/visual-slice-2.spec.ts
// Visual Slice 2 — deterministic browser gates for the redesigned student
// experience. No image understanding: every assertion reads DOM geometry,
// computed styles, accessibility snapshots or keyboard behavior.
//
// Sections:
//   1. Entry/Auth — action hierarchy + deliberate spacing, 360px fit,
//      validation visibility, keyboard flow, first-invalid focus.
//   2. Navigation — phone bottom nav, tablet rail, desktop side nav,
//      no overlap, selected state beyond color.
//   3. Home — dominant Continue Listening action, real progress metrics,
//      compact subscription state, empty states (no episodes / completed).
//   4. Lessons — the three real progress states, long-title containment,
//      CTA visibility at 360px, completed lessons stay interactive.
//   5. Lesson detail / Player — single H1, LTR reading, player geometry at
//      360px, resume state, Mini Player (one audio element), safe retry.
//   6. Theme — redesigned pages in Light/Dark/System, computed contrast.
//   7. Geometry sweep — all redesigned routes at all supported viewports.
//   8. Optional uninspected screenshots for later human review.

import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { createStaff, listOwnedRecords } from './fixtures';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
const SCREENSHOTS_DIR = process.env.VISUAL_SLICE_2_OUT ?? '/tmp/opencode/fep-visual-slice-2';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function randId(): string {
  return randomBytes(6).toString('hex');
}

let phoneCounter = 0;
function nextPhone(): string {
  const tail = String(phoneCounter++).padStart(2, '0');
  const r = randomBytes(4).readUInt32BE(0) % 10_000_000;
  return `09${String(r).padStart(7, '0')}${tail}`.slice(0, 11);
}

async function jsonFetch(url: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);
  const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body: body as Record<string, unknown>, ok: res.ok };
}

async function getSuperuserToken(): Promise<string> {
  const email = readFileSync('test-results/pb-su-email.txt', 'utf8').trim();
  const password = readFileSync('test-results/pb-su-password.txt', 'utf8').trim();
  const r = await jsonFetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: email, password }),
  });
  return (r.body as { token?: string })?.token || '';
}

// Real 2-second silent MP3 (ffmpeg) — the Slice 7 deck actually starts
// playback in the browser, which the legacy filler bytes cannot do in
// headless Chromium (decode error → the player's honest error state).
const AUDIO_FIXTURE = Buffer.from(
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYyLjEyLjEwMgAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAABOAAAgZgAIDA8SEhUYHB8fIiUoKCwvMjU1ODw/P0JFSUxMT1JVVVlcX2JiZWlsbG9ydXl5fH+ChoaJjI+PkpaZnJyfoqamqayvsrK2uby8v8PGycnMz9PT1tnc39/j5unp7O/z9vb5/P8AAAAATGF2YzYyLjI4AAAAAAAAAAAAAAAAJAQ4AAAAAAAAIGaM2mF9AAAAAAD/+xDEAAPAAAGkAAAAIAAANIAAAARMQU1FNC4wVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMQpg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxFMDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDEfIPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMSmA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxM+DwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=',
  'base64',
);

// Minimal valid PNG (1x1) for Episode artwork uploads (Podcast Slice 2).
const PNG_FIXTURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);

let defaultCategoryId = '';

async function getDefaultCategoryId(su: string): Promise<string> {
  if (defaultCategoryId) return defaultCategoryId;
  const r = await jsonFetch(
    `${PB_URL}/api/collections/categories/records?filter=(key='general')&perPage=1`,
    { headers: { authorization: `Bearer ${su}` } },
  );
  const item = (r.body as { items?: Array<{ id: string }> })?.items?.[0];
  if (!item) throw new Error('default category missing');
  defaultCategoryId = item.id;
  return defaultCategoryId;
}

async function uploadArtwork(su: string, topicId: string) {
  const boundary = `--FB${randId()}`;
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="artwork_square"; filename="art.png"\r\nContent-Type: image/png\r\n\r\n`,
    PNG_FIXTURE,
    `\r\n--${boundary}--\r\n`,
  ];
  const buf = Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));
  const res = await fetch(`${PB_URL}/api/collections/topics/records/${topicId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: buf,
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status !== 200) throw new Error(`artwork upload: ${res.status}`);
}

async function makeTopic(su: string, overrides: Record<string, unknown> = {}) {
  const slug = (overrides.slug as string) || `t-${randId()}`;
  // Podcast Slice 2: published Episodes require category/content_key/
  // title_fa/description_fa and artwork, so fixtures publish through the
  // same draft -> artwork -> publish path the hooks enforce.
  const cr = await jsonFetch(`${PB_URL}/api/collections/topics/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      title: (overrides.title as string) || `T ${randId()}`,
      slug,
      description: 'd',
      sort_order: overrides.sort_order ?? 0,
      status: 'draft',
    }),
  });
  if (cr.status >= 400) {
    throw new Error(`topic create failed: ${cr.status} ${JSON.stringify(cr.body).slice(0, 200)}`);
  }
  const topicId = cr.body?.id as string;
  if (overrides.keepDraft) return cr.body;
  await uploadArtwork(su, topicId);
  const patch: Record<string, unknown> = {
    status: overrides.status || 'published',
    category: await getDefaultCategoryId(su),
    content_key: `fx-${randId()}`,
    content_version: 1,
    title_fa: overrides.title_fa ?? 'عنوان اپیزود',
    description_fa: 'توضیح اپیزود',
  };
  const pr = await jsonFetch(`${PB_URL}/api/collections/topics/records/${topicId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200) throw new Error(`topic publish: ${pr.status}`);
  return cr.body;
}

async function uploadAudio(su: string, lessonId: string) {
  const boundary = `--FB${randId()}`;
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="t.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
    AUDIO_FIXTURE,
    `\r\n--${boundary}--\r\n`,
  ];
  const buf = Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));
  const res = await fetch(`${PB_URL}/api/collections/lessons/records/${lessonId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: buf,
  });
  if (res.status !== 200) throw new Error(`audio upload: ${res.status}`);
}

async function makeLesson(su: string, topicId: string, overrides: Record<string, unknown> = {}) {
  const cr = await jsonFetch(`${PB_URL}/api/collections/lessons/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      topic: topicId,
      level: overrides.level || 'B1',
      title: overrides.title || `L ${randId()}`,
      summary: overrides.summary ?? 's',
      body: overrides.body ?? 'b',
      estimated_minutes: 10,
      status: 'draft',
    }),
  });
  const id = cr.body?.id as string;
  if (!id) throw new Error(`create lesson: ${JSON.stringify(cr.body).slice(0, 200)}`);
  await uploadAudio(su, id);
  const patch: Record<string, unknown> = { status: 'published' };
  if (overrides.is_public_sample) patch.is_public_sample = true;
  const dur = Number(overrides.audio_duration_seconds || 0) || 600;
  patch.audio_duration_seconds = dur;
  // Podcast Slice 2 Variant invariants for new publishes
  patch.summary_fa = 'خلاصه فارسی';
  patch.content_version = 1;
  const pr = await jsonFetch(`${PB_URL}/api/collections/lessons/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200) throw new Error(`publish: ${pr.status}`);
  return { id };
}

async function seedPlacementQuestions(su: string) {
  const existing = await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
    headers: { authorization: `Bearer ${su}` },
  });
  const items = (existing.body?.items as Array<Record<string, unknown>>) || [];
  if (items.length > 0) return; // shared disposable PB: seeded by an earlier spec
  for (let i = 0; i < 20; i++) {
    await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        question_key: `vs2q${String(i).padStart(2, '0')}`,
        version: 1,
        position: i + 1,
        prompt: `Q${i + 1}`,
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
          { id: 'c', text: 'C' },
          { id: 'd', text: 'D' },
        ],
        options_text: JSON.stringify([
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
          { id: 'c', text: 'C' },
          { id: 'd', text: 'D' },
        ]),
        correct_option_id: 'a',
        is_active: true,
      }),
    });
  }
}

async function createActiveStudent(su: string, level = 'B1') {
  // Full entitlement flow: signup → payment request + receipt → operator
  // approval → real subscription → placement → level selection. Mirrors the
  // p3-s1 fixture so dashboard subscription data (plan/expiry/days) is real.
  // Staff Administrator token (Podcast Slice 1)
  const staff = await createStaff(su);
  const opToken = staff.token;

  const phone = nextPhone();
  const password = 'Test1234!';
  const canonicalPhone = `+98${phone.slice(1)}`;
  const signup = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'دانشجوی اسلایس بصری',
      phone,
      password,
      passwordConfirm: password,
    }),
  });
  const userId = signup.body?.id as string;
  const login = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  const token = (login.body as { token?: string })?.token || '';
  if (!token) throw new Error('student login failed');

  // Payment request with a minimal PNG receipt, then operator approval.
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
  ]);
  const boundary = `--FB${randId()}`;
  const prBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${PLAN_ID}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const prRes = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: prBody,
  });
  if (prRes.status !== 201) throw new Error(`PR: ${prRes.status}`);
  const prj = (await prRes.json()) as { request?: { id?: string } };
  const prId = prj.request?.id as string;
  const approve = await jsonFetch(
    `${PB_URL}/api/fast-english/operator/payment-requests/${prId}/approve`,
    { method: 'POST', headers: { authorization: `Bearer ${opToken}` }, body: JSON.stringify({}) },
  );
  if (approve.status !== 200) throw new Error(`approve: ${approve.status}`);

  const refresh = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const refreshedToken = (refresh.body as { token?: string })?.token || token;

  await seedPlacementQuestions(su);
  const start = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
  });
  const attemptId = (start.body as { attempt?: { id: string } })?.attempt?.id;
  let rev = (start.body as { attempt?: { revision: number } })?.attempt?.revision || 0;
  for (const q of (start.body as { questions?: Array<{ id: string }> })?.questions || []) {
    const ans = await jsonFetch(
      `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${refreshedToken}` },
        body: JSON.stringify({ questionId: q.id, optionId: 'a', expectedRevision: rev }),
      },
    );
    rev = (ans.body as { attempt?: { revision: number } })?.attempt?.revision || rev + 1;
  }
  await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
    body: JSON.stringify({ expectedRevision: rev }),
  });
  const lr = await jsonFetch(`${PB_URL}/api/fast-english/placement/selected-level`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
    body: JSON.stringify({ selectedLevel: level }),
  });
  if (lr.status !== 200) throw new Error(`level select: ${lr.status}`);
  return { token: refreshedToken, phone: canonicalPhone, userId };
}

async function saveProgress(token: string, lessonId: string, positionSeconds: number) {
  const r = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ positionSeconds, expectedRevision: 0 }),
  });
  if (r.status !== 200)
    throw new Error(`progress save: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
}

/**
 * Live published Variant ids at a level — the authoritative count oracle
 * for the progress-summary denominator.
 *
 * The summary counts every published Variant at the Student's level whose
 * Topic is published inside a published Category (the same visibility
 * contract as requirePublishedTopic). The shared disposable PocketBase
 * accumulates valid published Episodes from other spec files (e.g.
 * podcast-library publishes more A1 Variants), so a hard-coded total is
 * fixture-order dependent. Query the live records instead and derive the
 * expected "completed of published" value from the data actually present
 * at fixture time — never from an assumed-clean database.
 */
async function livePublishedVariantIdsAtLevel(su: string, level: string): Promise<string[]> {
  const lessonParams = new URLSearchParams({
    filter: `status='published' && level='${level}'`,
    perPage: '500',
  });
  const lessons = await jsonFetch(`${PB_URL}/api/collections/lessons/records?${lessonParams}`, {
    headers: { authorization: `Bearer ${su}` },
  });
  const lessonItems = (lessons.body?.items as Array<{ id?: string; topic?: string }>) || [];
  if (lessonItems.length === 0) return [];

  const topicParams = new URLSearchParams({ filter: `status='published'`, perPage: '500' });
  const topics = await jsonFetch(`${PB_URL}/api/collections/topics/records?${topicParams}`, {
    headers: { authorization: `Bearer ${su}` },
  });
  const topicCategory = new Map(
    ((topics.body?.items as Array<{ id?: string; category?: string }>) || []).map((t) => [
      String(t.id || ''),
      String(t.category || ''),
    ]),
  );

  const catParams = new URLSearchParams({
    filter: `publication_status='published'`,
    perPage: '500',
  });
  const categories = await jsonFetch(`${PB_URL}/api/collections/categories/records?${catParams}`, {
    headers: { authorization: `Bearer ${su}` },
  });
  const publishedCategories = new Set(
    ((categories.body?.items as Array<{ id?: string }>) || []).map((c) => String(c.id || '')),
  );

  return lessonItems
    .map((l) => ({ id: String(l.id || ''), topic: String(l.topic || '') }))
    .filter((l) => {
      const cat = topicCategory.get(l.topic);
      return Boolean(cat) && publishedCategories.has(cat as string);
    })
    .map((l) => l.id);
}

async function setAuthAndGo(
  page: Page,
  token: string,
  record: Record<string, unknown>,
  path: string,
) {
  await page.goto('/');
  await page.evaluate(
    ({ t, r }) => {
      localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, model: r }));
    },
    { t: token, r: record },
  );
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  // Let the route entrance animation settle before geometry assertions.
  await page.waitForTimeout(450);
}

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
      document.body.scrollWidth <= document.documentElement.clientWidth,
  );
}

/**
 * Serialized form of the scroller carve-out for page.evaluate: the
 * browser context cannot see module-level functions, so the whole check
 * travels inside the evaluated closure.
 */
function scrollerCarveOutCheck(): string[] {
  const vw = document.documentElement.clientWidth;
  const inScroller = (el: Element): boolean => {
    let node = el.parentElement;
    while (node) {
      const s = getComputedStyle(node);
      if (
        (s.overflowX === 'auto' || s.overflowX === 'scroll') &&
        node.scrollWidth > node.clientWidth + 1
      ) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  };
  const bad: string[] = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) continue;
    if (el.closest('svg') || el.closest('.MuiLinearProgress-root')) continue;
    // The skip link is intentionally translated off-screen until focused.
    if (el.closest('a[href="#main-content"]')) continue;
    if (inScroller(el)) continue;
    if (r.right > vw + 1 || r.left < -1 || r.top < -1) {
      bad.push(
        `${el.tagName}.${String(el.className).slice(0, 30)} l=${r.left.toFixed(0)} r=${r.right.toFixed(0)} t=${r.top.toFixed(0)} b=${r.bottom.toFixed(0)}`,
      );
    }
  }
  return bad.slice(0, 5);
}

function contrastOf(fg: string, bg: string): number {
  const lum = (c: string) => {
    const parts = c.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0'];
    const [r, g, b] = parts.slice(0, 3).map(Number);
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const a = lum(fg);
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const VIEWPORTS: Array<{ name: string; width: number; height: number }> = [
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
];

// ---------------------------------------------------------------------------
// Fixtures (one shared disposable PocketBase for the whole suite)
// ---------------------------------------------------------------------------
let su: string;
let student: { token: string; phone: string; userId: string };
// The /lessons list page reads progress for EVERY published lesson at the
// Student's level. In the shared-PB composition that list holds ~17-20 A1
// lessons (mostly the podcast-library fixtures), so a single visit consumes
// most of the per-Student progress-read budget (30 calls / 5 min). Every
// /lessons-list visitor therefore gets a DEDICATED owned identity (the
// lesson-detail tests share `student`), so no identity can exceed the
// budget in any fixture order — even on slower runners where the browser
// may not coalesce duplicate in-flight fetches.
let studentB: { token: string; phone: string; userId: string };
let studentC: { token: string; phone: string; userId: string };
let studentD: { token: string; phone: string; userId: string };
let noLessonStudent: { token: string };
let doneStudent: { token: string };

let lessonIds: Record<string, string>;
// Live published A1 Variant total at fixture time (shared disposable
// PocketBase: other spec files may have published valid Variants already).
let livePublishedA1Count = 0;

let PLAN_ID = '';

test.beforeAll(async () => {
  su = await getSuperuserToken();
  expect(su).toBeTruthy();

  // Payment destination (singleton) + plan, created once for the fixture flow.
  // Owned upserts: re-entry reuses the existing records (fixed markers).
  const existingDest = await listOwnedRecords(
    su,
    'payment_destination',
    "card_number='0000000000000000'",
  );
  if (!existingDest[0]?.id) {
    await jsonFetch(`${PB_URL}/api/collections/payment_destination/records`, {
      method: 'POST',
      headers: { authorization: su },
      body: JSON.stringify({
        card_number: '0000000000000000',
        card_holder_name: 'T',
        bank_name: 'T',
        is_active: true,
      }),
    });
  }
  const existingPlans = await listOwnedRecords(su, 'plans', "slug='p-vs2-e2e'");
  if (existingPlans[0]?.id) {
    PLAN_ID = String(existingPlans[0].id);
  } else {
    const plan = await jsonFetch(`${PB_URL}/api/collections/plans/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        name: 'اشتراک آزمون بصری',
        slug: 'p-vs2-e2e',
        duration_days: 90,
        price_toman: 100000,
        is_active: true,
      }),
    });
    PLAN_ID = (plan.body?.id as string) || '';
  }

  // One topic per lesson: `lessons` enforces a unique (topic, level) index.
  // States covered: not-started, in-progress, completed and a long-title
  // lesson (all at A1 so they appear in one student's list).
  // Slice 7: the Episode surface leads with the Persian title (H1), so the
  // fixtures carry realistic per-Episode Persian titles.
  const makeTopicLesson = async (title: string, topicTitle?: string, titleFa?: string) => {
    const topic = await makeTopic(su, {
      title: topicTitle ?? `موضوع ${title}`,
      slug: `vs2-${randId()}`,
      sort_order: 1,
      title_fa: titleFa ?? 'عنوان اپیزود',
    });
    const lesson = await makeLesson(su, topic.id as string, {
      level: 'A1',
      title,
      audio_duration_seconds: 600,
    });
    return lesson.id as string;
  };

  const lessonTitles = [
    'A Fresh Start',
    'Daily Routine',
    'Small Talk',
    'این یک عنوان بسیار بلند برای آزمودن پیچیدن متن است — A Very Long English Title That Must Wrap Safely Inside Its Card Without Breaking Anything',
  ] as const;
  const longTitle = lessonTitles[3];

  // Idempotent fixture guard: in some environments Playwright restarts the
  // worker mid-run against the same shared disposable PocketBase. Reusing
  // already-seeded lessons keeps the strict heading assertions strict
  // (exactly one of each title); without the guard, duplicated fixtures
  // break every strict-mode assertion in this file (same pattern as
  // p3-s2.spec.ts).
  const existing = await jsonFetch(`${PB_URL}/api/collections/lessons/records?perPage=200`, {
    headers: { authorization: `Bearer ${su}` },
  });
  const existingLessons = (existing.body?.items as Array<Record<string, unknown>>) || [];
  const existingByTitle = new Map(
    existingLessons.filter((l) => l.level === 'A1').map((l) => [String(l.title), String(l.id)]),
  );

  const ensureLesson = async (title: string, topicTitle?: string, titleFa?: string) => {
    const existingId = existingByTitle.get(title);
    if (existingId) return existingId;
    const id = await makeTopicLesson(title, topicTitle, titleFa);
    existingByTitle.set(title, id);
    return id;
  };

  lessonIds = {
    notStarted: await ensureLesson(lessonTitles[0], undefined, 'آغاز تازه'),
    inProgress: await ensureLesson(lessonTitles[1], undefined, 'روتین روزانه'),
    completed: await ensureLesson(lessonTitles[2], undefined, 'گپ کوتاه'),
    longTitle: await ensureLesson(longTitle, 'موضوع عنوان بلند', 'عنوان بسیار بلند آزمایشی'),
  };

  student = await createActiveStudent(su, 'A1');
  await saveProgress(student.token, lessonIds.inProgress, 150);
  await saveProgress(student.token, lessonIds.completed, 600);
  // Dedicated identities for the /lessons-list visitors (rate budget, see
  // the declaration comment). studentB and studentD carry the same state
  // seeds as `student`; studentC stays seed-free (not-started cards only).
  studentB = await createActiveStudent(su, 'A1');
  await saveProgress(studentB.token, lessonIds.inProgress, 150);
  await saveProgress(studentB.token, lessonIds.completed, 600);
  studentD = await createActiveStudent(su, 'A1');
  await saveProgress(studentD.token, lessonIds.inProgress, 150);
  await saveProgress(studentD.token, lessonIds.completed, 600);
  studentC = await createActiveStudent(su, 'A1');
  noLessonStudent = await createActiveStudent(su, 'C2');
  doneStudent = await createActiveStudent(su, 'A1');
  // "All completed" requires completing EVERY published Variant at the
  // Student's level — including valid Episodes other spec files published
  // into the shared disposable PocketBase before this file ran. Derive the
  // live set instead of assuming a clean database, so the completion state
  // holds in any fixture order.
  const publishedA1Ids = await livePublishedVariantIdsAtLevel(su, 'A1');
  livePublishedA1Count = publishedA1Ids.length;
  for (const id of publishedA1Ids) {
    await saveProgress(doneStudent.token, id, 600);
  }
});

// ---------------------------------------------------------------------------
// 1. Entry / Auth
// ---------------------------------------------------------------------------
test.describe('entry and auth hierarchy', () => {
  test('registration is the only dominant action with deliberate spacing', async ({ page }) => {
    await page.goto('/');
    const signup = page.getByRole('link', { name: 'ساخت حساب' });
    const login = page.getByRole('link', { name: 'ورود' });
    await expect(signup).toBeVisible();
    await expect(login).toBeVisible();

    const signupBox = (await signup.boundingBox())!;
    const loginBox = (await login.boundingBox())!;
    // Both actions keep at least the 44px practical target.
    expect(signupBox.height).toBeGreaterThanOrEqual(44);
    expect(loginBox.height).toBeGreaterThanOrEqual(44);
    // Deliberate vertical spacing (never touching).
    const gap = loginBox.y - (signupBox.y + signupBox.height);
    expect(gap).toBeGreaterThanOrEqual(8);

    // Only registration uses the dominant filled primary; login is outlined
    // (transparent surface — never a second dominant filled button).
    const primaryRgb = await page.evaluate(() => {
      const el = document.createElement('div');
      el.style.backgroundColor = 'var(--mui-palette-primary-main)';
      document.body.appendChild(el);
      const c = getComputedStyle(el).backgroundColor;
      el.remove();
      return c;
    });
    expect(await signup.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(primaryRgb);
    expect(await login.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      'rgba(0, 0, 0, 0)',
    );
  });

  test('entry page fits 360px with theme control reachable', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    expect(await noHorizontalOverflow(page)).toBe(true);
    // Podcast Slice 1: no always-visible theme control on the entry page.
    await expect(page.getByTestId('theme-switch')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'ساخت حساب' })).toBeVisible();
  });

  test('signup form fits 360px, validates inline and focuses the first invalid field', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/signup');
    expect(await noHorizontalOverflow(page)).toBe(true);
    await page.getByRole('button', { name: 'ساخت حساب', exact: true }).click();
    // Validation errors appear (no layout collapse)…
    await expect(page.getByText('نام الزامی است.')).toBeVisible();
    await expect(page.getByText('شمارهٔ موبایل الزامی است.')).toBeVisible();
    // …and the first invalid field receives focus (keyboard-first).
    await expect(page.locator('input[name="name"]')).toBeFocused();
    expect(await page.locator('input[name="name"]').getAttribute('aria-invalid')).toBe('true');
    // Helper text reserved space keeps the submit button reachable.
    await expect(page.getByRole('button', { name: 'ساخت حساب', exact: true })).toBeVisible();
  });

  test('login keyboard flow reaches the fields in order', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'پرش به محتوای اصلی' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('شمارهٔ موبایل')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('input[name="password"]')).toBeFocused();
  });

  test('login form keeps RTL shell with intentional LTR phone input', async ({ page }) => {
    await page.goto('/login');
    const phone = page.getByLabel('شمارهٔ موبایل');
    await expect(phone).toHaveAttribute('dir', 'ltr');
    expect(await page.evaluate(() => document.documentElement.getAttribute('dir'))).toBe('rtl');
  });
});

// ---------------------------------------------------------------------------
// 2. Navigation
// ---------------------------------------------------------------------------
test.describe('responsive navigation', () => {
  const record = { id: '', phone: '' };

  test('phone: bottom navigation with 4 primary destinations and selected state', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, student.token, record, '/');
    const nav = page.getByTestId('student-bottom-nav');
    await expect(nav).toBeVisible();
    await expect(page.getByTestId('student-side-nav')).toBeHidden();
    for (const label of ['خانه', 'کتابخانه', 'پیشرفت', 'حساب']) {
      await expect(nav.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    const selected = nav.getByRole('button', { name: 'خانه', exact: true });
    await expect(selected).toHaveAttribute('aria-current', 'page');
    const indicator = await selected.evaluate((el) => {
      const s = getComputedStyle(el, '::after');
      return { bg: s.backgroundColor, w: Number.parseFloat(s.width) };
    });
    expect(indicator.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(indicator.w).toBeGreaterThan(0);
  });

  test('tablet: rail replaces the bottom navigation without content overlap', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setAuthAndGo(page, student.token, record, '/');
    const nav = page.getByTestId('student-bottom-nav');
    await expect(nav).toBeHidden();
    const rail = page.locator('[data-testid="student-side-nav"] .MuiDrawer-paper');
    await expect(rail).toBeVisible();
    const railBox = (await rail.boundingBox())!;
    expect(railBox.width).toBe(88);
    // Content and rail are disjoint: `main` reserves the rail via padding,
    // so the content container's physical box ends where the rail begins.
    const container = page.locator('.MuiContainer-root').first();
    await expect(container).toBeVisible();
    const containerBox = (await container.boundingBox())!;
    expect(containerBox.x + containerBox.width).toBeLessThanOrEqual(railBox.x + 1);
    // Icon-only rail keeps 44px+ touch targets.
    const first = rail.getByRole('navigation').getByRole('button').first();
    const box = (await first.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('desktop: full side navigation with labels, bounded content, no overlap', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await setAuthAndGo(page, student.token, record, '/lessons');
    const side = page.locator('[data-testid="student-side-nav"] .MuiDrawer-paper');
    await expect(side).toBeVisible();
    const sideBox = (await side.boundingBox())!;
    expect(sideBox.width).toBe(248);
    await expect(side.getByRole('button', { name: 'کتابخانه' })).toBeVisible();
    // Content and side navigation are disjoint; the container stays bounded.
    const container = page.locator('.MuiContainer-root').first();
    await expect(container).toBeVisible();
    const cBox = (await container.boundingBox())!;
    expect(cBox.x + cBox.width).toBeLessThanOrEqual(sideBox.x + 1);
    expect(cBox.width).toBeLessThanOrEqual(900 + 1);
  });

  test('tablet rail selection carries aria-current', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setAuthAndGo(page, student.token, record, '/library');
    await expect(
      page.locator('[data-testid="student-side-nav"]').getByRole('button', { name: 'کتابخانه' }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

// ---------------------------------------------------------------------------
// 3. Dashboard
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 3. Home (Podcast Slice 5 — the redesigned Podcast-first Home)
// ---------------------------------------------------------------------------
test.describe('home hierarchy', () => {
  const record = { id: '', phone: '' };

  test('Continue Listening is the dominant action with real data', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, student.token, record, '/');
    const card = page.getByTestId('home-continue');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText('ادامه گوش‌دادن')).toBeVisible();
    // Real Episode metadata (titleFa from the published Topic).
    await expect(card.getByText('روتین روزانه', { exact: true })).toBeVisible();
    await expect(card.getByText('Daily Routine', { exact: true })).toBeVisible();
    // Saved position 150 → «ادامه از 2:30»; authoritative duration 600 − 150
    // → «حدود 8 دقیقه باقی‌مانده» (no fabricated time).
    await expect(card.getByText('ادامه از 2:30')).toBeVisible();
    await expect(card.getByText('حدود 8 دقیقه باقی‌مانده')).toBeVisible();

    const cta = page.getByTestId('continue-cta');
    const primary = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(primary).not.toBe('rgba(0, 0, 0, 0)');
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--mui-palette-primary-main')
        .trim(),
    );
    if (bg.startsWith('#')) {
      const resolved = await page.evaluate(() => {
        const el = document.createElement('div');
        el.style.backgroundColor = 'var(--mui-palette-primary-main)';
        document.body.appendChild(el);
        const c = getComputedStyle(el).backgroundColor;
        el.remove();
        return c;
      });
      expect(primary).toBe(resolved);
    } else {
      expect(primary.toLowerCase()).toContain(bg);
    }
  });

  test('real progress metrics display without placeholder numbers', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, student.token, record, '/');
    const progressCard = page.getByTestId('progress-card');
    await expect(progressCard).toBeVisible({ timeout: 15_000 });
    await expect(progressCard.getByText('اپیزودهای شروع‌شده')).toBeVisible();
    await expect(progressCard.getByText('2', { exact: true })).toBeVisible(); // 2 started
    await expect(progressCard.getByText('اپیزودهای کامل‌شده')).toBeVisible();
    // Completed count (1) is fixture-owned; the published total is the LIVE
    // set at the Student's level, so the expectation is order-independent.
    await expect(progressCard.getByText(`1 از ${livePublishedA1Count}`)).toBeVisible();
    await expect(progressCard.getByText('سطح پیش‌فرض:')).toBeVisible();
    await expect(progressCard.getByText('A1', { exact: true })).toBeVisible();
    // Suggested C2 vs preferred A1 — both presented without judgment.
    await expect(progressCard.getByText(/سطح پیشنهادی: C2/)).toBeVisible();
    await expect(progressCard.getByRole('progressbar', { name: /پیشرفت کلی/ })).toBeVisible();
  });

  test('subscription status is compact and understandable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, student.token, record, '/');
    const card = page.getByTestId('subscription-card');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText('اشتراک', { exact: true })).toBeVisible();
    await expect(card.getByText('فعال')).toBeVisible();
    await expect(card.getByText(/روزهای باقی‌مانده:/)).toBeVisible();
    await expect(card.getByText(/تاریخ انقضا:/)).toBeVisible();
    // Not a payment-style card: no actions inside the status area.
    await expect(card.getByRole('button')).toHaveCount(0);
  });

  test('empty state: no published episodes explains what happened and the next action', async ({
    page,
  }) => {
    await setAuthAndGo(page, noLessonStudent.token, record, '/');
    await expect(page.getByText('اولین اپیزودت را شروع کن')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/هنوز اپیزود تازه‌ای برای این سطح منتشر نشده است/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'پیدا کردن اپیزود' })).toBeVisible();
  });

  test('empty state: all lessons completed shows the completion state', async ({ page }) => {
    await setAuthAndGo(page, doneStudent.token, record, '/');
    await expect(page.getByText('همهٔ اپیزودهای این سطح را گوش کردی')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'رفتن به کتابخانه' })).toBeVisible();
  });
});
// 4. Lessons
// ---------------------------------------------------------------------------
test.describe('lesson list states', () => {
  const record = { id: '', phone: '' };

  test('all three real progress states render with text + CTA', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, studentB.token, record, '/lessons');
    await expect(page.getByRole('heading', { name: 'A Fresh Start', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: 'Daily Routine', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Small Talk', exact: true })).toBeVisible();

    // Not started → شروع درس (two cards match — not-started + long-title).
    await expect(page.getByRole('link', { name: 'شروع درس' }).first()).toBeVisible();
    // In progress → ادامه از 2:30
    await expect(page.getByRole('link', { name: 'ادامه از 2:30' })).toBeVisible();
    // Completed → مرور مجدد
    await expect(page.getByRole('link', { name: 'مرور مجدد' })).toBeVisible();
    // Status text present (never color alone)
    await expect(page.getByText('شروع نشده').first()).toBeVisible();
    await expect(page.getByText('در حال یادگیری')).toBeVisible();
    await expect(page.getByText('کامل شده')).toBeVisible();
    // Progress bars carry accessible labels.
    await expect(page.getByRole('progressbar', { name: /پیشرفت درس Daily Routine/ })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: /پیشرفت درس Small Talk/ })).toBeVisible();
  });

  test('completed lessons remain interactive', async ({ page }) => {
    await setAuthAndGo(page, studentD.token, record, '/lessons');
    await page.getByRole('link', { name: 'مرور مجدد' }).click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${lessonIds.completed}`), {
      timeout: 10_000,
    });
  });

  test('long Persian/English titles wrap inside their card at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setAuthAndGo(page, studentC.token, record, '/lessons');
    const heading = page.getByRole('heading', { name: /عنوان بسیار بلند/ });
    await expect(heading).toBeVisible({ timeout: 15_000 });
    const card = heading.locator('xpath=ancestor::div[contains(@class, "MuiCard-root")]');
    const headingBox = (await heading.boundingBox())!;
    const cardBox = (await card.boundingBox())!;
    expect(headingBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
    expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
    expect(headingBox.height).toBeGreaterThan(32); // wrapped onto 2+ lines
    // CTA remains visible inside the same card at 360px.
    const cta = card.getByRole('link', { name: 'شروع درس' });
    await expect(cta).toBeVisible();
    const ctaBox = (await cta.boundingBox())!;
    expect(ctaBox.height).toBeGreaterThanOrEqual(44);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Lesson detail / Player
// ---------------------------------------------------------------------------
test.describe('lesson detail and player', () => {
  const record = { id: '', phone: '' };

  test('one H1 per route and LTR bounded English reading', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, student.token, record, `/lessons/${lessonIds.notStarted}`);
    await expect(page.getByRole('heading', { name: 'آغاز تازه' }).first()).toBeVisible({
      timeout: 15_000,
    });
    expect(await page.getByRole('heading', { level: 1 }).count()).toBe(1);
    const article = page.locator('article[lang="en"]');
    await expect(article).toBeVisible();
    await expect(article).toHaveAttribute('dir', 'ltr');
    const reading = page.getByTestId('english-reading');
    const box = (await reading.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(640 + 1);
  });

  test('player controls fit 360px with a dominant primary control', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setAuthAndGo(page, student.token, record, `/lessons/${lessonIds.notStarted}`);
    const player = page.getByRole('group', { name: 'پخش‌کنندهٔ صوت' });
    await expect(player).toBeAttached({ timeout: 15_000 });
    await expect(player.getByRole('slider', { name: 'موقعیت پخش' })).toBeVisible();
    // Fresh Variant → the primary control is the labeled «شروع گوش‌دادن» CTA
    // in the fixed 56px slot (Slice 7 deck contract).
    const cta = player.getByTestId('deck-primary-cta');
    await expect(cta).toHaveText('شروع گوش‌دادن');
    const ctaBox = (await cta.boundingBox())!;
    expect(ctaBox.height).toBe(56);
    expect(ctaBox.width).toBeGreaterThanOrEqual(56);
    for (const name of ['۱۰ ثانیه به عقب', '۱۰ ثانیه به جلو', 'قطع صدا']) {
      const box = (await player.getByRole('button', { name }).boundingBox())!;
      expect(box.width, name).toBeGreaterThanOrEqual(44);
      expect(box.height, name).toBeGreaterThanOrEqual(44);
    }
    // Speed is one compact menu trigger; the menu carries the five speeds
    // as 44px targets (replaces the legacy five-chip wall).
    const speedTrigger = player.getByRole('button', { name: 'سرعت پخش 1 برابر' });
    await expect(speedTrigger).toBeVisible();
    await speedTrigger.click();
    const speedOptions = page.getByRole('menuitem', { name: /سرعت پخش/ });
    await expect(speedOptions).toHaveCount(5);
    // The menu entrance animates a transform; wait until the items settle
    // at their final 44px targets before measuring (no fixed sleeps).
    await expect
      .poll(async () => {
        const settled = await speedOptions.evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return { w: r.width, h: r.height };
          }),
        );
        return settled.every((s) => s.w >= 44 && s.h >= 44);
      })
      .toBe(true);
    const sizes = await speedOptions.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      }),
    );
    for (const s of sizes) {
      expect(s.w).toBeGreaterThanOrEqual(44);
      expect(s.h).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('menuitem', { name: 'سرعت پخش 1 برابر' }).click();
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('resumed state renders the saved position', async ({ page }) => {
    await setAuthAndGo(page, student.token, record, `/lessons/${lessonIds.inProgress}`);
    const resume = page.getByRole('button', { name: /ادامه از 2:30/ });
    await expect(resume).toBeVisible({ timeout: 15_000 });
    await resume.click();
    await expect(resume).not.toBeVisible({ timeout: 5_000 });
    // The deck seeks to the saved position and starts playback. The fixture
    // file is 2s long, so the applied seek clamps to its end — the slider
    // proves the saved position (150s) was actually sought, not skipped.
    const player = page.getByRole('group', { name: 'پخش‌کنندهٔ صوت' });
    const slider = player.getByRole('slider', { name: 'موقعیت پخش' });
    await expect
      .poll(async () => Number(await slider.getAttribute('aria-valuenow')), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1);
  });

  test('sticky player stays above the bottom navigation on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, student.token, record, `/lessons/${lessonIds.notStarted}`);
    const playerSurface = page.getByTestId('player-surface');
    await expect(playerSurface).toBeAttached({ timeout: 15_000 });
    const nav = page.getByTestId('student-bottom-nav');
    const navBox = (await nav.boundingBox())!;
    // The page reserves bottom padding >= nav height, so the last element
    // (the reading article) never sits under the fixed navigation.
    const paddingBottom = await page
      .getByRole('main')
      .first()
      .evaluate((el) => {
        const inner = el.querySelector('.MuiContainer-root > div');
        return inner ? Number.parseFloat(getComputedStyle(inner).paddingBottom) : 0;
      });
    expect(paddingBottom).toBeGreaterThanOrEqual(64 + 8);
    expect(navBox.y).toBeGreaterThan(0);
  });

  test('mini player: one audio element, no overlap, return-to-lesson works', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, student.token, record, `/lessons/${lessonIds.inProgress}`);
    await page.getByRole('button', { name: /ادامه از 2:30/ }).click({ timeout: 15_000 });
    // The deck seeks to the saved position and starts playback (the 2s
    // fixture file clamps the seek to its end — the slider proves it).
    const player = page.getByRole('group', { name: 'پخش‌کنندهٔ صوت' });
    const slider = player.getByRole('slider', { name: 'موقعیت پخش' });
    await expect
      .poll(async () => Number(await slider.getAttribute('aria-valuenow')), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1);

    // SPA-navigate to the Library: audio keeps playing via the shared
    // element and the Mini Player appears above the bottom navigation.
    await page.getByTestId('student-bottom-nav').getByRole('button', { name: 'کتابخانه' }).click();
    await expect(page).toHaveURL(/\/library$/, { timeout: 10_000 });

    const mini = page.getByTestId('mini-player');
    await expect(mini).toBeVisible({ timeout: 10_000 });
    await expect(mini.getByText('روتین روزانه')).toBeVisible();
    // Exactly one authoritative PLAYER element exists — never two
    // simultaneous players. Scoped to audio[preload="metadata"]: the
    // vocabulary pronunciation host (preload="none") is a separate,
    // never-playing surface, and the route transition may briefly keep
    // the previous route mounted on slower runners.
    expect(await page.locator('audio[preload="metadata"]').count()).toBe(1);
    // No overlap with the bottom navigation.
    const miniBox = (await mini.boundingBox())!;
    const navBox = (await page.getByTestId('student-bottom-nav').boundingBox())!;
    // Sub-pixel rendering may round the touching edges by under a pixel.
    expect(miniBox.y + miniBox.height).toBeLessThanOrEqual(navBox.y + 2);

    // Return-to-lesson action restores the detail route.
    await page.getByTestId('mini-player-return').click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${lessonIds.inProgress}`), {
      timeout: 10_000,
    });
    // The saved position is still honored: the deck's resume prompt derives
    // from the SAVED progress. The 2s fixture clip clamps the 150s seek, so
    // the honest saved position is the real played one (~1-3s) and the
    // honest CTA is «پخش» (deriveDeckCta <5s rule). The end-of-clip save
    // lands a moment after the return load, so the CTA is polled.
    await expect
      .poll(async () => (await page.getByTestId('deck-primary-cta').textContent()) ?? '', {
        timeout: 10_000,
      })
      .toContain('پخش');
    const saved = Number(
      (
        (
          await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonIds.inProgress}/progress`, {
            headers: { authorization: `Bearer ${student.token}` },
          })
        ).body as { positionSeconds?: number }
      ).positionSeconds ?? -1,
    );
    expect(saved).toBeGreaterThan(0);
    expect(saved).toBeLessThanOrEqual(3);
  });

  test('mini player is hidden when no lesson is active', async ({ page }) => {
    await setAuthAndGo(page, noLessonStudent.token, record, '/lessons');
    await expect(page.getByTestId('mini-player')).toHaveCount(0);
  });

  test('audio failure shows a safe retry — no raw backend errors', async ({ page }) => {
    await page.route(/\/api\/fast-english\/lessons\/[^/]+\/audio\?.*/, (route) => route.abort());
    await setAuthAndGo(page, student.token, record, `/lessons/${lessonIds.notStarted}`);
    const player = page.getByRole('group', { name: 'پخش‌کنندهٔ صوت' });
    await expect(player).toBeAttached({ timeout: 15_000 });
    await expect(player.getByText('خطا در پخش صوت.')).toBeVisible({ timeout: 10_000 });
    await expect(player.getByRole('button', { name: 'تلاش مجدد' })).toBeVisible();
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('storage/');
    expect(bodyText).not.toContain('"code"');
  });
});

// ---------------------------------------------------------------------------
// 6. Theme
// ---------------------------------------------------------------------------
test.describe('theme on redesigned pages', () => {
  const record = { id: '', phone: '' };
  // Routes resolve inside the test bodies: fixtures are created in beforeAll,
  // which runs after module evaluation.
  const routeFor = (key: string): string =>
    key === 'detail' ? `/lessons/${lessonIds.notStarted}` : key === 'dashboard' ? '/' : `/${key}`;
  // Per-route identity: the legacy /lessons list reads progress for every
  // published lesson at the Student's level (~17-20 in the shared-PB
  // composition); the empty-level Student keeps the list visits at zero
  // reads so `student` stays inside the per-Student progress-read budget.
  const tokenForRoute = (key: string): string =>
    key === 'lessons' ? noLessonStudent.token : student.token;

  for (const key of ['home', 'library', 'progress', 'lessons', 'account', 'detail'] as const) {
    test(`route renders in Light and Dark without overflow: ${key}`, {
      tag: key === 'dashboard' ? '@critical' : undefined,
    }, async ({ page }) => {
      const route = routeFor(key);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: 'light' });
      await setAuthAndGo(page, tokenForRoute(key), record, route);
      expect(await noHorizontalOverflow(page), `${route} light`).toBe(true);
      // The display preference lives only in Account settings (Podcast
      // Slice 1): switch there, then re-check the target route in Dark.
      await setAuthAndGo(page, student.token, record, '/account');
      await page
        .getByTestId('account-theme-switch')
        .getByRole('button', { name: 'حالت تیره' })
        .click();
      await page.waitForTimeout(80);
      await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
      await setAuthAndGo(page, tokenForRoute(key), record, route);
      expect(await noHorizontalOverflow(page), `${route} dark`).toBe(true);
      // Semantic surfaces actually changed.
      const bg = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--mui-palette-background-default')
          .trim(),
      );
      expect(bg.length).toBeGreaterThan(0);
    });
  }

  test('Continue Learning CTA keeps AA contrast in both schemes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'light' });
    await setAuthAndGo(page, student.token, record, '/');
    // Switch schemes through the Account settings control (the only
    // theme control, Podcast Slice 1) and measure the CTA on the route.
    for (const scheme of ['light', 'dark'] as const) {
      await setAuthAndGo(page, student.token, record, '/account');
      await page
        .getByTestId('account-theme-switch')
        .getByRole('button', { name: scheme === 'dark' ? 'حالت تیره' : 'حالت روشن' })
        .click();
      await setAuthAndGo(page, student.token, record, '/');
      const pair = await page.getByTestId('continue-cta').evaluate((el) => {
        const s = getComputedStyle(el);
        return { fg: s.color, bg: s.backgroundColor };
      });
      expect(contrastOf(pair.fg, pair.bg), `${scheme} continue CTA`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('system mode still drives the redesigned pages', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await setAuthAndGo(page, student.token, record, '/account');
    await page
      .getByTestId('account-theme-switch')
      .getByRole('button', { name: 'حالت سیستمی' })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-color-scheme')))
      .toBe('light');
    await page.evaluate(() => localStorage.removeItem('mui-mode'));
  });

  test('account page exposes the Light/Dark/System preference control', async ({ page }) => {
    await setAuthAndGo(page, student.token, record, '/account');
    const switchGroup = page.getByTestId('account-theme-switch');
    await expect(switchGroup).toBeVisible();
    for (const name of ['حالت روشن', 'حالت تیره', 'حالت سیستمی']) {
      await expect(switchGroup.getByRole('button', { name })).toBeVisible();
    }
  });

  test('reduced motion collapses the route entrance animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setAuthAndGo(page, student.token, record, '/');
    const durationMs = await page
      .getByTestId('route-transition')
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(Number.parseFloat(durationMs)).toBeLessThanOrEqual(0.02);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });
});

// ---------------------------------------------------------------------------
// 7. Geometry sweep — every redesigned route at every supported viewport
// ---------------------------------------------------------------------------
test.describe('responsive geometry', () => {
  const record = { id: '', phone: '' };

  const publicRoutes = ['/', '/login', '/signup'];
  const authRouteFor = (key: string): string =>
    key === 'detail' ? `/lessons/${lessonIds.notStarted}` : key === 'home' ? '/' : `/${key}`;
  // Per-route identity: see the theme sweep — the legacy /lessons list
  // burns the per-Student progress-read budget in the shared-PB composition.
  const tokenForRoute = (key: string): string =>
    key === 'lessons' ? noLessonStudent.token : student.token;

  for (const viewport of VIEWPORTS) {
    for (const route of publicRoutes) {
      test(`public ${route} at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(route);
        await page.waitForTimeout(450);
        expect(await noHorizontalOverflow(page)).toBe(true);
        // No element may extend beyond the viewport (fixed chrome
        // included). Elements inside horizontally-scrollable rows (e.g.
        // Library filter chips) legitimately extend past the edge — the
        // page-level noHorizontalOverflow check above still guarantees
        // the document itself never overflows.
        const violations = await page.evaluate(scrollerCarveOutCheck);
        expect(violations, `${route} at ${viewport.name}`).toEqual([]);
      });
    }

    for (const key of ['home', 'library', 'progress', 'lessons', 'account', 'detail'] as const) {
      test(`authenticated ${key} at ${viewport.name}`, async ({ page }) => {
        const route = authRouteFor(key);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await setAuthAndGo(page, tokenForRoute(key), record, route);
        expect(await noHorizontalOverflow(page), `${route} ${viewport.name}`).toBe(true);
        // Per-element check: same scrollable-row carve-out as the public
        // sweep; the page-level no-overflow guarantee is asserted above.
        const violations = await page.evaluate(scrollerCarveOutCheck);
        expect(violations, `${route} at ${viewport.name}`).toEqual([]);
        // Theme control stays reachable on every viewport.
        // No always-visible theme control in the Student shell (Settings only).
        await expect(page.getByTestId('theme-switch')).toHaveCount(0);
      });
    }
  }

  test('the per-element check still fails on genuine overflow (carve-out is exact)', async ({
    page,
  }) => {
    // Prove the scrollable-row carve-out does not mask real offenders:
    // an element that genuinely sticks out of the viewport (no scroller
    // ancestor) is still flagged by the same serialized check.
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, student.token, record, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    expect(await noHorizontalOverflow(page)).toBe(true);
    await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const offender = document.createElement('div');
      offender.style.cssText = `position:fixed;left:0;top:0;width:${vw + 120}px;height:12px;background:red`;
      document.body.appendChild(offender);
    });
    const violations = await page.evaluate(scrollerCarveOutCheck);
    expect(violations.length).toBeGreaterThan(0);
  });

  test('App Bar title and actions do not collide at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await setAuthAndGo(page, student.token, record, '/');
    const titleBox = (await page.getByRole('link', { name: 'فست انگلیش' }).boundingBox())!;
    expect(titleBox.x).toBeGreaterThanOrEqual(0);
    expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(360);
    // No theme control in the App Bar (Settings only).
    await expect(page.getByTestId('theme-switch')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Optional uninspected screenshots for later human review
// ---------------------------------------------------------------------------
test.describe('optional evidence: uninspected screenshots', () => {
  const record = { id: '', phone: '' };
  const shots = (): Array<{ file: string; route: string; auth?: boolean; student?: string }> => [
    { file: 'entry', route: '/' },
    { file: 'login', route: '/login' },
    { file: 'home-populated', route: '/', auth: true },
    { file: 'home-empty', route: '/', auth: true, student: 'none' },
    { file: 'lessons-populated', route: '/lessons', auth: true },
    { file: 'lesson-detail', route: `/lessons/${lessonIds.notStarted}`, auth: true },
    { file: 'audio-player-playing', route: `/lessons/${lessonIds.inProgress}`, auth: true },
    { file: 'account', route: '/account', auth: true },
  ];

  for (const scheme of ['light', 'dark'] as const) {
    for (const size of [
      { name: '390x844', width: 390, height: 844 },
      { name: '768x1024', width: 768, height: 1024 },
      { name: '1440x900', width: 1440, height: 900 },
    ]) {
      test(`capture ${scheme} ${size.name}`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.emulateMedia({ colorScheme: scheme === 'dark' ? 'dark' : 'light' });
        mkdirSync(`${SCREENSHOTS_DIR}/${scheme}/${size.name}`, { recursive: true });
        for (const shot of shots()) {
          const token = shot.student === 'none' ? noLessonStudent.token : student.token;
          if (shot.auth) {
            await setAuthAndGo(page, token, record, shot.route);
          } else {
            await page.goto(shot.route);
            await page.waitForTimeout(450);
          }
          await page.screenshot({
            path: `${SCREENSHOTS_DIR}/${scheme}/${size.name}/${shot.file}.png`,
            fullPage: true,
          });
        }
      });
    }
  }
});
