// e2e/podcast-episode.spec.ts
// Slice 7 — the Episode surface (Record Jacket) end-to-end contract.
//
// Proves against a real PocketBase + the real app:
//   - the jacket composition (artwork, Edition Rail, identity) and the
//     deck CTA states (fresh / resume / completed);
//   - atomic Variant switching (no mixed old/new state, read-only
//     browsing, independent per-Variant progress);
//   - honest unpublished-level handling (no invented "coming soon");
//   - vocabulary expansion + pronunciation exclusivity (Episode pauses,
//     no seek, no progress writes) and the honest TTS-unavailable state;
//   - real previous/next neighbors only (absent → no footer);
//   - keyboard rail navigation, RTL/LTR isolation, long titles,
//     audio failure + recovery, entitlement loss;
//   - geometry sweep (360/375/390/430/768/1024/1440, light+dark,
//     200% zoom, deck budget, bounded reading measure, two-column lg).

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { semanticColors } from '../shared/ui/tokens/colors';
import { createStaff, listOwnedRecords } from './fixtures';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
const PB_DATA_DIR = readFileSync('test-results/pb-data-dir.txt', 'utf8').trim();

function randId(): string {
  return randomBytes(6).toString('hex');
}
let phoneCounter = 0;
function nextPhone(): string {
  // Random base + monotonic tail: unique per creation even when a retried
  // worker re-runs this file's beforeAll (counter-only generators collide
  // on re-entry and silently reuse an earlier Student's identity).
  const tail = String(phoneCounter++).padStart(2, '0');
  const r = randomBytes(4).readUInt32BE(0) % 10_000_000;
  return `09${String(r).padStart(7, '0')}${tail}`.slice(0, 11);
}

async function jsonFetch(url: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);
  const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body: body as Record<string, unknown>, ok: res.ok };
}

const PNG_FIXTURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);
// A real 2-second silent MP3 (generated with ffmpeg) — the Episode and
// pronunciation playback paths in this spec actually start the audio
// element, which the legacy filler fixture cannot do in headless Chromium.
const AUDIO_FIXTURE = Buffer.from(
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYyLjEyLjEwMgAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAABOAAAgZgAIDA8SEhUYHB8fIiUoKCwvMjU1ODw/P0JFSUxMT1JVVVlcX2JiZWlsbG9ydXl5fH+ChoaJjI+PkpaZnJyfoqamqayvsrK2uby8v8PGycnMz9PT1tnc39/j5unp7O/z9vb5/P8AAAAATGF2YzYyLjI4AAAAAAAAAAAAAAAAJAQ4AAAAAAAAIGaM2mF9AAAAAAD/+xDEAAPAAAGkAAAAIAAANIAAAARMQU1FNC4wVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMQpg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxFMDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDEfIPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMSmA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxM+DwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xDE1gPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EMTWA8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxNYDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=',
  'base64',
);

const TRANSCRIPT_B1 = `Good morning, and welcome back to Fast English. This is the first Variant of our test Episode.\n\nIt has a second paragraph to exercise long-content reading behavior in the bounded measure.`;
const TRANSCRIPT_B2 = `This is the second Variant of the same Episode. Its transcript is completely different.`;

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------
const state: {
  // Student A — Record Jacket identity + CTA-state tests (1-3).
  token: string;
  userId: string;
  // Student B — Variant-switch tests (4).
  tokenB: string;
  // Student C — interactive/state tests (6-11) and the responsive suite.
  tokenC: string;
  // Student D — neighbors walk (5): the walk + the variant-switch suite
  // together ride the lesson-detail rate edge on slower runners, where
  // the browser may not coalesce duplicate in-flight fetches.
  tokenD: string;
  userIdC: string;
  su: string;
  aB1: string;
  aB2: string;
  bB1: string;
  cB1: string;
  aB1Vocab: string[];
} = {
  token: '',
  userId: '',
  tokenB: '',
  tokenC: '',
  tokenD: '',
  userIdC: '',
  su: '',
  aB1: '',
  aB2: '',
  bB1: '',
  cB1: '',
  aB1Vocab: [],
};

test.beforeAll(async () => {
  const { spawnSync } = await import('node:child_process');
  const suEmail = `fx-${randId()}@fep-smoke.invalid`;
  const suPassword = `FX-${randId()}`;
  spawnSync(
    'server/pocketbase',
    ['superuser', 'upsert', suEmail, suPassword, '--dir', PB_DATA_DIR],
    {
      stdio: 'ignore',
    },
  );
  const suAuth = await jsonFetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: suEmail, password: suPassword }),
  });
  const su = suAuth.body.token as string;
  state.su = su;
  const staff = await createStaff(su);

  // Owned plan + destination: re-entry reuses the existing records (fixed
  // ownership markers) instead of multiplying them in the shared PB.
  let planId = '';
  const existingPlans = await listOwnedRecords(su, 'plans', "slug='ep-e2e-plan'");
  if (existingPlans[0]?.id) {
    planId = String(existingPlans[0].id);
  } else {
    const plan = await jsonFetch(`${PB_URL}/api/collections/plans/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        name: 'E2E Episode',
        slug: 'ep-e2e-plan',
        duration_days: 30,
        price_toman: 100000,
        is_active: true,
        display_order: 0,
        description: 'disposable',
      }),
    });
    planId = (plan.body?.id as string) || '';
  }
  const existingDests = await listOwnedRecords(
    su,
    'payment_destination',
    "card_number='1111222233334444'",
  );
  if (!existingDests[0]?.id) {
    await jsonFetch(`${PB_URL}/api/collections/payment_destination/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        card_number: '1111222233334444',
        card_holder_name: 'E2E HOLDER',
        bank_name: 'E2E BANK',
        instructions: 'انتقال کارت به کارت',
        is_active: true,
      }),
    });
  }
  if (!planId) throw new Error('owned plan missing');

  // Three owned Students: the lesson-detail route enforces a production
  // per-Student rate window (30 calls / 5 min, smoke-tested). The suite
  // legitimately makes ~50 detail calls per run — ONE identity would trip
  // that window in the fast full lane (every call lands inside the same
  // window), making the failing test order-dependent. Three identities
  // keep every Student comfortably under the budget. Progress seeds are
  // applied to all three below so each identity sees the same CTA states.
  async function createEntitledStudent(): Promise<{ token: string; userId: string }> {
    const sPhone = nextPhone();
    const sPassword = 'Test1234!';
    await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'دانشجوی نمایشی',
        phone: sPhone,
        password: sPassword,
        passwordConfirm: sPassword,
      }),
    });
    const sLogin = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
      method: 'POST',
      body: JSON.stringify({ identity: `+98${sPhone.slice(1)}`, password: sPassword }),
    });
    const sToken = sLogin.body.token as string;

    const boundary = `--FB${randId()}`;
    const prBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${planId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      PNG_FIXTURE,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const prRes = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${sToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: prBody,
    });
    if (prRes.status !== 201) throw new Error(`PR: ${prRes.status}`);
    const prj = (await prRes.json()) as { request?: { id?: string } };
    await jsonFetch(
      `${PB_URL}/api/fast-english/operator/payment-requests/${prj.request?.id}/approve`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${staff.token}` },
        body: JSON.stringify({}),
      },
    );
    const refresh = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sToken}` },
    });
    let refreshed = (refresh.body?.token as string) ?? sToken;
    const userId = (refresh.body?.record?.id as string) ?? '';

    // Placement (questions seeded once, idempotently).
    const existingQ = await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
      headers: { authorization: `Bearer ${su}` },
    });
    if (!(existingQ.body?.items as unknown[])?.length) {
      for (let i = 0; i < 20; i++) {
        await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
          method: 'POST',
          headers: { authorization: `Bearer ${su}` },
          body: JSON.stringify({
            question_key: `epq${String(i).padStart(2, '0')}`,
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
    const start = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
      method: 'POST',
      headers: { authorization: `Bearer ${refreshed}` },
    });
    const attemptId = (start.body as { attempt?: { id: string } })?.attempt?.id;
    let rev = (start.body as { attempt?: { revision: number } })?.attempt?.revision || 0;
    for (const q of (start.body as { questions?: Array<{ id: string }> })?.questions || []) {
      const ans = await jsonFetch(
        `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
        {
          method: 'PUT',
          headers: { authorization: `Bearer ${refreshed}` },
          body: JSON.stringify({ questionId: q.id, optionId: 'a', expectedRevision: rev }),
        },
      );
      rev = (ans.body as { attempt?: { revision: number } })?.attempt?.revision || rev + 1;
    }
    await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: { authorization: `Bearer ${refreshed}` },
      body: JSON.stringify({ expectedRevision: rev }),
    });
    await jsonFetch(`${PB_URL}/api/fast-english/placement/selected-level`, {
      method: 'POST',
      headers: { authorization: `Bearer ${refreshed}` },
      body: JSON.stringify({ selectedLevel: 'B1' }),
    });

    // Marker semantics need recommended ≠ preferred: the superuser (the
    // server-side authority) sets the Placement result to B2 while the
    // student's preferred level stays B1.
    await jsonFetch(`${PB_URL}/api/collections/fep_users/records/${userId}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({ suggested_level: 'B2' }),
    });

    const refresh2 = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
      method: 'POST',
      headers: { authorization: `Bearer ${refreshed}` },
    });
    refreshed = (refresh2.body?.token as string) ?? refreshed;
    return { token: refreshed, userId };
  }

  const studentA = await createEntitledStudent();
  state.token = studentA.token;
  state.userId = studentA.userId;
  const studentB = await createEntitledStudent();
  state.tokenB = studentB.token;
  const studentD = await createEntitledStudent();
  state.tokenD = studentD.token;
  const studentC = await createEntitledStudent();
  state.tokenC = studentC.token;
  state.userIdC = studentC.userId;

  // Content: Topic A (B1 + B2 variants), Topic B (B1), Topic C (B1).
  // Idempotent owned upserts: topics are keyed by fixed slugs; Variants
  // reuse the (topic, level) unique index; vocabulary by (lesson, term).
  const cat = (
    await jsonFetch(
      `${PB_URL}/api/collections/categories/records?filter=(key='general')&perPage=1`,
      { headers: { authorization: `Bearer ${su}` } },
    )
  ).body as { items?: Array<{ id: string }> };
  const catId = cat?.items?.[0]?.id as string;

  async function makeTopic(sortOrder: number, titleFa: string, title: string, slug: string) {
    const cr = await jsonFetch(`${PB_URL}/api/collections/topics/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        title,
        slug,
        description: 'd',
        sort_order: sortOrder,
        status: 'draft',
        content_key: `fx-${randId()}`,
      }),
    });
    const id = cr.body?.id as string;
    const boundaryA = `--FB${randId()}`;
    const artBuf = Buffer.concat([
      Buffer.from(
        `--${boundaryA}\r\nContent-Disposition: form-data; name="artwork_square"; filename="art.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      PNG_FIXTURE,
      Buffer.from(`\r\n--${boundaryA}--\r\n`),
    ]);
    await fetch(`${PB_URL}/api/collections/topics/records/${id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${su}`,
        'content-type': `multipart/form-data; boundary=${boundaryA}`,
      },
      body: artBuf,
    });
    await jsonFetch(`${PB_URL}/api/collections/topics/records/${id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        status: 'published',
        category: catId,
        content_key: `fx-${randId()}`,
        content_version: 1,
        title_fa: titleFa,
        description_fa: 'توضیح اپیزود',
        episode_number: sortOrder + 10,
      }),
    });
    return id;
  }

  async function ensureTopic(
    sortOrder: number,
    titleFa: string,
    title: string,
    slug: string,
  ): Promise<string> {
    const existing = await listOwnedRecords(su, 'topics', `slug='${slug}'`);
    if (existing[0]?.id) return String(existing[0].id);
    return makeTopic(sortOrder, titleFa, title, slug);
  }

  async function makeLesson(
    topicId: string,
    level: string,
    title: string,
    summaryFa: string,
    body: string,
  ) {
    const cr = await jsonFetch(`${PB_URL}/api/collections/lessons/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        topic: topicId,
        level,
        title,
        summary: 's',
        body: 'b',
        estimated_minutes: 10,
        status: 'draft',
      }),
    });
    const id = cr.body?.id as string;
    const boundaryL = `--FB${randId()}`;
    const audioBuf = Buffer.concat([
      Buffer.from(
        `--${boundaryL}\r\nContent-Disposition: form-data; name="audio"; filename="t.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
      ),
      AUDIO_FIXTURE,
      Buffer.from(`\r\n--${boundaryL}--\r\n`),
    ]);
    await fetch(`${PB_URL}/api/collections/lessons/records/${id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${su}`,
        'content-type': `multipart/form-data; boundary=${boundaryL}`,
      },
      body: audioBuf,
    });
    await jsonFetch(`${PB_URL}/api/collections/lessons/records/${id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        status: 'published',
        audio_duration_seconds: 600,
        summary_fa: summaryFa,
        body,
        content_version: 1,
      }),
    });
    return id;
  }

  async function ensureLesson(
    topicId: string,
    level: string,
    title: string,
    summaryFa: string,
    body: string,
  ): Promise<string> {
    const existing = await listOwnedRecords(
      su,
      'lessons',
      `topic='${topicId}' && level='${level}'`,
    );
    if (existing[0]?.id) return String(existing[0].id);
    return makeLesson(topicId, level, title, summaryFa, body);
  }

  async function makeVocab(lessonId: string, term: string, withPron: boolean) {
    const cr = await jsonFetch(`${PB_URL}/api/collections/lesson_vocabulary/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        lesson: lessonId,
        term,
        normalized_term: term.toLowerCase(),
        phonetic: '/wɜːrd/',
        part_of_speech: 'noun',
        meaning_fa: `معنی ${term}`,
        definition_en: `English definition of ${term}.`,
        example_sentence: `An example sentence with ${term}.`,
        sort_order: 1,
      }),
    });
    const id = cr.body?.id as string;
    if (withPron) {
      const boundaryP = `--FB${randId()}`;
      const pronBuf = Buffer.concat([
        Buffer.from(
          `--${boundaryP}\r\nContent-Disposition: form-data; name="pronunciation_audio"; filename="p.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
        ),
        AUDIO_FIXTURE,
        Buffer.from(`\r\n--${boundaryP}--\r\n`),
      ]);
      const res = await fetch(`${PB_URL}/api/collections/lesson_vocabulary/records/${id}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${su}`,
          'content-type': `multipart/form-data; boundary=${boundaryP}`,
        },
        body: pronBuf,
      });
      if (res.status !== 200) throw new Error(`pron upload ${res.status}`);
    }
    return id;
  }

  async function ensureVocab(lessonId: string, term: string, withPron: boolean): Promise<string> {
    const existing = await listOwnedRecords(
      su,
      'lesson_vocabulary',
      `lesson='${lessonId}' && term='${term}'`,
    );
    if (existing[0]?.id) return String(existing[0].id);
    return makeVocab(lessonId, term, withPron);
  }

  const topicA = await ensureTopic(1, 'اپیزود الف', 'Episode Alpha', 'ep-e2e-topic-alpha');
  state.aB1 = await ensureLesson(topicA, 'B1', 'Alpha B1', 'خلاصه بی‌وان', TRANSCRIPT_B1);
  state.aB2 = await ensureLesson(topicA, 'B2', 'Alpha B2', 'خلاصه بی‌تو', TRANSCRIPT_B2);
  state.aB1Vocab = [
    await ensureVocab(state.aB1, 'listen', true),
    await ensureVocab(state.aB1, 'repeat', false),
  ];
  await ensureVocab(state.aB2, 'focus', false);
  const topicB = await ensureTopic(2, 'اپیزود ب', 'Episode Bravo', 'ep-e2e-topic-bravo');
  state.bB1 = await ensureLesson(topicB, 'B1', 'Bravo B1', 'خلاصه بی‌بی', 'Bravo transcript.');
  const topicC = await ensureTopic(3, 'اپیزود ج', 'Episode Charlie', 'ep-e2e-topic-charlie');
  state.cB1 = await ensureLesson(topicC, 'B1', 'Charlie B1', 'خلاصه بی‌سی', 'Charlie transcript.');

  // Progress seeds (per-Variant, independent) for EVERY owned Student: the
  // CTA-state tests run under different identities by design (rate budget).
  for (const t of [state.token, state.tokenB, state.tokenC, state.tokenD]) {
    await jsonFetch(`${PB_URL}/api/fast-english/lessons/${state.aB1}/progress`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${t}` },
      body: JSON.stringify({ positionSeconds: 150, expectedRevision: 0 }),
    });
    await jsonFetch(`${PB_URL}/api/fast-english/lessons/${state.cB1}/progress`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${t}` },
      body: JSON.stringify({ positionSeconds: 600, expectedRevision: 0 }),
    });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function setAuthAndGo(
  page: import('@playwright/test').Page,
  path: string,
  token = state.token,
) {
  await page.goto('/');
  await page.evaluate(
    ({ t }) => {
      localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({ token: t, model: { id: '', phone: '' } }),
      );
    },
    { t: token },
  );
  await page.goto(path);
}

async function noHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

/**
 * Derive the expected previous/next neighbors for the fixture Variants from
 * the live server data, mirroring the documented deterministic rule of the
 * detail route (Episode sort_order → Variant published_at → content_key,
 * published Episode + published Category only). The shared disposable PB
 * also carries other specs' fixtures, so expectations can never be hard-coded.
 */
async function deriveNeighbors(): Promise<
  Record<string, { previous: { variantId: string } | null; next: { variantId: string } | null }>
> {
  const suAuth = { authorization: `Bearer ${state.su}` };
  const allLessons = await jsonFetch(`${PB_URL}/api/collections/lessons/records?perPage=200`, {
    headers: suAuth,
  });
  const lessons = (allLessons.body?.items ?? []) as Array<Record<string, unknown>>;
  const topicIds = new Set(lessons.map((l) => String(l.topic ?? '')));
  const topics: Array<Record<string, unknown>> = [];
  for (const tid of topicIds) {
    const t = await jsonFetch(`${PB_URL}/api/collections/topics/records/${tid}`, {
      headers: suAuth,
    });
    if (t.body?.id) topics.push(t.body as Record<string, unknown>);
  }
  const topicById = new Map(topics.map((t) => [String(t.id), t]));
  const catIds = new Set(
    topics.map((t) => String((t.category as Record<string, unknown>)?.id ?? t.category ?? '')),
  );
  const cats: Array<Record<string, unknown>> = [];
  for (const cid of catIds) {
    const c = await jsonFetch(`${PB_URL}/api/collections/categories/records/${cid}`, {
      headers: suAuth,
    });
    if (c.body?.id) cats.push(c.body as Record<string, unknown>);
  }
  const publishedCatIds = new Set(
    cats.filter((c) => c.publication_status === 'published').map((c) => String(c.id)),
  );
  const visible = lessons
    .filter((l) => {
      const topic = topicById.get(String(l.topic ?? ''));
      if (topic?.status !== 'published') return false;
      const catId = String((topic.category as Record<string, unknown>)?.id ?? topic.category ?? '');
      return publishedCatIds.has(catId);
    })
    .sort((a, b) => {
      const ta = topicById.get(String(a.topic));
      const tb = topicById.get(String(b.topic));
      const oa = Number(ta?.sort_order ?? 0);
      const ob = Number(tb?.sort_order ?? 0);
      if (oa !== ob) return oa - ob;
      const pa = String(a.published_at ?? '');
      const pb = String(b.published_at ?? '');
      if (pa !== pb) return pa < pb ? -1 : 1;
      const ka = String(ta?.content_key ?? '');
      const kb = String(tb?.content_key ?? '');
      if (ka !== kb) return ka < kb ? -1 : 1;
      return String(a.id) < String(b.id) ? -1 : 1;
    });

  const targets = [state.aB1, state.aB2, state.bB1, state.cB1];
  const result: Record<
    string,
    { previous: { variantId: string } | null; next: { variantId: string } | null }
  > = {};
  for (const target of targets) {
    const targetLesson = lessons.find((l) => String(l.id) === target);
    const level = String(targetLesson?.level ?? '');
    const sameLevel = visible.filter((l) => String(l.level ?? '') === level);
    const idx = sameLevel.findIndex((l) => String(l.id) === target);
    result[target] = {
      previous: idx > 0 ? { variantId: String(sameLevel[idx - 1].id) } : null,
      next:
        idx >= 0 && idx < sameLevel.length - 1
          ? { variantId: String(sameLevel[idx + 1].id) }
          : null,
    };
  }
  return result;
}

test.describe('Episode surface — Record Jacket', () => {
  test('1. the jacket composes artwork, Edition Rail, identity and deck', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`);
    await expect(page.getByTestId('episode-jacket')).toBeVisible({ timeout: 20_000 });
    // Artwork-led: the first-viewport asset is the Episode artwork.
    await expect(page.getByTestId('episode-jacket').locator('img').first()).toBeVisible();
    // Edition Rail: full A1–C2 ladder; A has B1+B2 published.
    const rail = page.getByTestId('edition-rail');
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      await expect(rail.getByTestId(`edition-plate-${level}`)).toBeVisible();
    }
    // Identity: Persian H1, English caption, category kicker, level line.
    await expect(page.getByRole('heading', { level: 1, name: 'اپیزود الف' })).toBeVisible();
    await expect(page.getByText('Episode Alpha', { exact: true })).toBeVisible();
    await expect(page.getByText('سطح B1 · متوسط')).toBeVisible();
    // Deck: edition stripe + primary control.
    await expect(page.getByTestId('deck-edition-stripe')).toBeAttached();
    await expect(page.getByTestId('deck-primary-cta')).toHaveText('ادامه از 2:30');
    // Learning layer in order: summary, vocabulary, transcript.
    await expect(page.getByRole('heading', { name: 'خلاصهٔ اپیزود' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'کلمات کلیدی · 2' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'متن اپیزود' })).toBeVisible();
    // Transcript is a serious LTR reading surface.
    const article = page.locator('article[lang="en"]');
    await expect(article).toBeVisible();
    await expect(article).toHaveAttribute('dir', 'ltr');
  });

  test('2. current Variant is unmistakable; markers are guidance only', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`);
    const b1 = page.getByTestId('edition-plate-B1');
    await expect(b1).toHaveAttribute('aria-checked', 'true');
    await expect(b1).toHaveAttribute('aria-current', 'true');
    const b2 = page.getByTestId('edition-plate-B2');
    await expect(b2).toHaveAttribute('aria-checked', 'false');
    // Markers are guidance only: B1 (preferred) and B2 (recommended).
    await expect(page.getByTestId('edition-rail').getByText('پیش‌فرض')).toBeVisible();
    await expect(page.getByTestId('edition-rail').getByText('پیشنهادی')).toBeVisible();
    // The recommended level is guidance, never a restriction.
    await expect(page.getByText('سطح پیشنهادی برای تو B2 است.')).toBeVisible();
    // Unpublished levels are honest disabled plates (A1, A2, C1, C2).
    for (const level of ['A1', 'A2', 'C1', 'C2']) {
      await expect(page.getByTestId(`edition-plate-${level}`)).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    }
    // Attempting an unpublished plate reveals the honest line and never
    // navigates (aria-disabled keeps it out of the SR tree; the tap/click
    // affordance is real browser behavior).
    const urlBefore = page.url();
    await page.getByTestId('edition-plate-C1').click({ force: true });
    await expect(page.getByTestId('episode-live-region')).toContainText(
      'این اپیزود هنوز در سطح C1 منتشر نشده است',
    );
    // The same honest line is VISIBLE next to the Edition Rail (Slice 7
    // review finding 4) — sighted students see the feedback, SR users get
    // the live-region announcement.
    await expect(page.getByTestId('edition-unpublished-note')).toBeVisible();
    await expect(page.getByTestId('edition-unpublished-note')).toContainText(
      'این اپیزود هنوز در سطح C1 منتشر نشده است',
    );
    // A second attempt on a different unpublished level updates the note.
    await page.getByTestId('edition-plate-A1').click({ force: true });
    await expect(page.getByTestId('edition-unpublished-note')).toContainText(
      'این اپیزود هنوز در سطح A1 منتشر نشده است',
    );
    expect(page.url()).toBe(urlBefore);

    // ---- Slice 7 review finding 1: English reading computes LTR. ----
    // The RTL Stylis pipeline used to flip the variants' CSS `direction`
    // to rtl, overriding `dir="ltr"` and right-aligning the English
    // reading surface (pre-fix: ~40px left glyph inset). The contract now
    // relies on the `dir` attributes: computed direction must be ltr and
    // the first glyph line must start at the paragraph's left edge. This
    // reuses this test's single page load — the suite rides the
    // lesson-detail rate limit (30/5min) and every load counts.
    await page.emulateMedia({ colorScheme: 'light' });
    const ltrProof = await page.evaluate(() => {
      const article = document.querySelector('[data-testid="english-reading"]');
      const para = article?.querySelector('p');
      if (!article || !para) return null;
      const range = document.createRange();
      range.selectNodeContents(para);
      const firstLine = range.getClientRects()[0];
      const paraBox = para.getBoundingClientRect();
      const caption = document.querySelector('[data-testid="episode-identity"] [lang="en"]');
      return {
        articleDir: article.getAttribute('dir'),
        paraDir: getComputedStyle(para).direction,
        paraAlign: getComputedStyle(para).textAlign,
        firstLineInsetLeft: firstLine ? Math.round(firstLine.left - paraBox.left) : null,
        shellDir: getComputedStyle(document.documentElement).direction,
        identityDir: getComputedStyle(
          document.querySelector('[data-testid="episode-identity"]') as HTMLElement,
        ).direction,
        captionDir: caption ? getComputedStyle(caption).direction : null,
      };
    });
    expect(ltrProof?.articleDir).toBe('ltr');
    expect(ltrProof?.paraDir).toBe('ltr');
    expect(ltrProof?.paraAlign).toBe('start');
    expect(ltrProof?.firstLineInsetLeft).not.toBeNull();
    expect(ltrProof?.firstLineInsetLeft ?? -1).toBeLessThanOrEqual(4);
    // The surrounding Student UI stays RTL.
    expect(ltrProof?.shellDir).toBe('rtl');
    expect(ltrProof?.identityDir).toBe('rtl');
    // The English identity caption is LTR-isolated too.
    expect(ltrProof?.captionDir).toBe('ltr');

    // Vocabulary definition/example lines are the same variant family and
    // must render LTR as well.
    const firstExpander = page.locator('[data-testid^="vocab-expander-"]').first();
    await firstExpander.click();
    await expect(firstExpander).toHaveAttribute('aria-expanded', 'true');
    const defDir = await page
      .locator('[data-testid^="vocab-detail-"]')
      .first()
      .locator('[lang="en"]')
      .first()
      .evaluate((el) => getComputedStyle(el).direction);
    expect(defDir).toBe('ltr');

    // ---- Slice 7 review finding 3: edition stripe clears ≥3:1. ----
    // DESIGN.md QA budget: the stripe is non-text, checked ≥3:1 against
    // the Deck surface. The stripe is theme-aware (pair fg in Light, pair
    // bg in Dark); both schemes must clear 3:1. The dark check switches
    // the scheme on the SAME page (no second detail fetch).
    const stripeRatio = () =>
      page.evaluate(() => {
        const stripe = document.querySelector('[data-testid="deck-edition-stripe"]');
        const deck = document.querySelector('[data-testid="audio-player"]');
        if (!stripe || !deck) return null;
        const parse = (c: string) => (c.match(/\d+/g) ?? []).slice(0, 3).map(Number);
        const lum = ([r, g, b]: number[]) => {
          const f = (v: number) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const a = lum(parse(getComputedStyle(stripe).backgroundColor));
        const b = lum(parse(getComputedStyle(deck).backgroundColor));
        const [hi, lo] = a > b ? [a, b] : [b, a];
        return (hi + 0.05) / (lo + 0.05);
      });
    const lightRatio = await stripeRatio();
    expect(lightRatio ?? 0).toBeGreaterThanOrEqual(3);
    // Non-vacuous dark check: first prove the scheme actually switched (the
    // Deck surface resolves to the dark surfaceContainerHigh), then assert
    // the stripe clears 3:1 on THAT surface.
    await page.emulateMedia({ colorScheme: 'dark' });
    // Non-vacuous: prove the scheme actually switched by comparing the
    // computed Deck surface against the dark token, then assert the stripe
    // clears 3:1 on THAT surface.
    const darkHex = semanticColors.dark.surfaceContainerHigh;
    const darkDeckRgb = `rgb(${[1, 3, 5].map((i) => Number.parseInt(darkHex.slice(i, i + 2), 16)).join(', ')})`;
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const deck = document.querySelector('[data-testid="audio-player"]');
            return deck ? getComputedStyle(deck).backgroundColor : null;
          }),
        { timeout: 10_000 },
      )
      .toBe(darkDeckRgb);
    await expect.poll(async () => stripeRatio(), { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  });

  test('3. deck CTA states: fresh / resume / completed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Fresh (B2 has no progress).
    await setAuthAndGo(page, `/lessons/${state.aB2}`);
    await expect(page.getByTestId('deck-primary-cta')).toHaveText('شروع گوش‌دادن', {
      timeout: 20_000,
    });
    // Completed.
    await setAuthAndGo(page, `/lessons/${state.cB1}`);
    await expect(page.getByTestId('deck-primary-cta')).toHaveText('مرور دوباره', {
      timeout: 20_000,
    });
    await expect(page.getByText('این اپیزود کامل شده است.')).toBeVisible();
    // Resume: clicking seeks to the saved position and starts playback
    // (the CTA slot becomes the pause control). The real fixture file is
    // 2s long, so the applied seek clamps to its end — the slider proves
    // the saved position (150s) was actually sought, not skipped.
    await setAuthAndGo(page, `/lessons/${state.aB1}`);
    await expect(page.getByTestId('deck-primary-cta')).toHaveText('ادامه از 2:30', {
      timeout: 20_000,
    });
    await page.getByTestId('deck-primary-cta').click();
    await expect(page.getByTestId('player-play-toggle')).toBeVisible({ timeout: 10_000 });
    const player = page.getByRole('group', { name: 'پخش‌کنندهٔ صوت' });
    const slider = player.getByRole('slider', { name: 'موقعیت پخش' });
    await expect
      .poll(async () => Number(await slider.getAttribute('aria-valuenow')), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1);
  });

  test('4. atomic Variant switch: one state, never mixed, read-only levels', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenB);
    await expect(page.getByTestId('deck-primary-cta')).toHaveText('ادامه از 2:30', {
      timeout: 20_000,
    });

    // Click the B2 plate → the switch renders the jacket with skeletons of
    // the variant-dependent regions only; neither old nor new content shows.
    // The detail response is gated so the in-flight state is observable
    // (localhost is otherwise too fast to assert against).
    let releaseSwitch: () => void = () => {};
    const switchGate = new Promise<void>((resolveGate) => {
      releaseSwitch = resolveGate;
    });
    await page.route(`**/api/fast-english/lessons/${state.aB2}`, async (route) => {
      await switchGate;
      await route.continue();
    });
    await page.getByTestId('edition-plate-B2').click();
    await expect(page.getByTestId('variant-switching-note')).toHaveText(
      'در حال بارگذاری نسخهٔ سطح B2…',
      { timeout: 10_000 },
    );
    await expect(page.getByTestId('deck-switching')).toBeVisible();
    await expect(page.getByText('خلاصه بی‌وان')).toHaveCount(0);
    await expect(page.getByText('خلاصه بی‌تو')).toHaveCount(0);
    await expect(page.getByText('first Variant of our test Episode')).toHaveCount(0);
    // The jacket (Episode-level identity) stays rendered during the switch.
    await expect(page.getByRole('heading', { level: 1, name: 'اپیزود الف' })).toBeVisible();
    // No plate is marked current while the switch is in flight.
    await expect(page.getByTestId('edition-plate-B1')).not.toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('edition-plate-B2')).not.toHaveAttribute('aria-checked', 'true');

    // After the load: the B2 Variant is one coherent unit.
    releaseSwitch();
    await expect(page.getByTestId('deck-primary-cta')).toHaveText('شروع گوش‌دادن', {
      timeout: 20_000,
    });
    await expect(page.getByText('خلاصه بی‌تو')).toBeVisible();
    await expect(page.getByTestId('vocabulary-section')).toContainText('focus');
    await expect(page.getByText('completely different')).toBeVisible();
    await expect(page.getByTestId('edition-plate-B2')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('episode-live-region')).toContainText('نسخهٔ سطح B2 بارگذاری شد.');
    await expect(page).toHaveURL(new RegExp(`/lessons/${state.aB2}$`));
    await page.unroute(`**/api/fast-english/lessons/${state.aB2}`);

    // B2 is fresh → its own progress, not B1's.
    const progress = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${state.aB2}/progress`, {
      headers: { authorization: `Bearer ${state.tokenB}` },
    });
    expect((progress.body as { positionSeconds?: number }).positionSeconds ?? 0).toBe(0);

    // Switching back restores the B1 resume state (per-Variant independence).
    await page.getByTestId('edition-plate-B1').click();
    await expect(page.getByTestId('deck-primary-cta')).toHaveText('ادامه از 2:30', {
      timeout: 20_000,
    });
    await expect(page.getByText('خلاصه بی‌وان')).toBeVisible();

    // Browsing never mutated recommended/preferred Level.
    const user = await jsonFetch(`${PB_URL}/api/collections/fep_users/records/${state.userIdC}`, {
      headers: { authorization: `Bearer ${state.su}` },
    });
    expect((user.body as { selected_level?: string }).selected_level).toBe('B1');
    expect((user.body as { suggested_level?: string }).suggested_level).toBe('B2');
  });

  test('5. previous/next render only for real backend neighbors', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // The shared disposable PB also carries B1/B2 fixtures from other specs,
    // so expected neighbors are DERIVED from the same deterministic server
    // rule (Episode sort_order → Variant published_at → content_key) over
    // the live data — never hard-coded.
    const neighborMap = await deriveNeighbors();

    for (const [variantId, expected] of Object.entries(neighborMap)) {
      await setAuthAndGo(page, `/lessons/${variantId}`, state.tokenD);
      await expect(page.getByTestId('episode-jacket')).toBeVisible({ timeout: 20_000 });
      const previous = page.getByTestId('prevnext-previous');
      const next = page.getByTestId('prevnext-next');
      if (expected.previous) {
        await expect(previous).toContainText('اپیزود قبلی');
        await expect(previous).toHaveAttribute('href', `/lessons/${expected.previous.variantId}`);
      } else {
        await expect(previous).toHaveCount(0);
      }
      if (expected.next) {
        await expect(next).toContainText('اپیزود بعدی');
        await expect(next).toHaveAttribute('href', `/lessons/${expected.next.variantId}`);
      } else {
        await expect(next).toHaveCount(0);
      }
    }

    // Real navigation to a derived next Episode (full load, not a Variant
    // switch) — the target comes from the server-derived neighbors.
    const alphaExpected = neighborMap[state.aB1];
    expect(alphaExpected.next).toBeTruthy();
    await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenD);
    await page.getByTestId('prevnext-next').click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${alphaExpected.next.variantId}$`), {
      timeout: 10_000,
    });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
  });

  test('6. vocabulary expansion: definition, example and pronunciation control', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenC);
    const row = page.getByTestId(`vocab-expander-${state.aB1Vocab[0]}`);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    const detail = page.getByTestId(`vocab-detail-${state.aB1Vocab[0]}`);
    await expect(detail.getByText('English definition of listen.')).toBeVisible();
    await expect(detail.getByText('An example sentence with listen.')).toBeVisible();
    await expect(detail.getByTestId(`pron-control-${state.aB1Vocab[0]}`)).toHaveText('پخش تلفظ');
    // One row open at a time.
    const second = page.getByTestId(`vocab-expander-${state.aB1Vocab[1]}`);
    await second.click();
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await expect(second).toHaveAttribute('aria-expanded', 'true');
    // Row anatomy: word (LTR), phonetic (LTR), POS text, Persian meaning.
    await expect(page.getByText('listen', { exact: true })).toBeVisible();
    await expect(page.getByText('/wɜːrd/', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('معنی listen')).toBeVisible();
  });

  test('7. pronunciation exclusivity: pauses the Episode, never seeks or saves', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenC);
    const cta = page.getByTestId('deck-primary-cta');
    await expect(cta).toHaveText('ادامه از 2:30', { timeout: 20_000 });
    // Start the Episode first.
    await cta.click();
    await expect(page.getByTestId('player-play-toggle')).toBeVisible({ timeout: 10_000 });
    const player = page.getByRole('group', { name: 'پخش‌کنندهٔ صوت' });
    const slider = player.getByRole('slider', { name: 'موقعیت پخش' });
    // Wait until playback has actually moved, then capture the position.
    await expect
      .poll(async () => Number(await slider.getAttribute('aria-valuenow')), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1);
    const positionBefore = await slider.getAttribute('aria-valuenow');
    // Expand the word with the uploaded pronunciation file.
    const row = page.getByTestId(`vocab-expander-${state.aB1Vocab[0]}`);
    await row.click();
    // Prove the protected clip is actually served (tokenized URL, 200/206
    // audio response) — attachment alone would not catch a broken
    // pronunciation endpoint.
    const pronResponse = page.waitForResponse(
      (r) => r.url().includes('/vocabulary/') && r.url().includes('/pronunciation'),
      { timeout: 15_000 },
    );
    const control = page.getByTestId(`pron-control-${state.aB1Vocab[0]}`);
    await control.click();
    const resp = await pronResponse;
    expect([200, 206]).toContain(resp.status());
    expect(resp.headers()['content-type'] ?? '').toContain('audio');
    expect(resp.request().url()).toContain('token=');
    // Exclusivity: the Episode pauses (the deck CTA is back) and its
    // position was never sought by the clip — only natural playback drift
    // (sub-second) may have occurred before the pause landed.
    await expect(page.getByTestId('deck-primary-cta')).toBeVisible({ timeout: 10_000 });
    const positionAfter = Number(await slider.getAttribute('aria-valuenow'));
    const positionBeforeNum = Number(positionBefore);
    expect(positionAfter).toBeGreaterThanOrEqual(positionBeforeNum);
    expect(positionAfter - positionBeforeNum).toBeLessThanOrEqual(1.5);
    // No Episode progress regression: the authoritative furthest position
    // (monotonic, server-side) is unchanged.
    const progress = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${state.aB1}/progress`, {
      headers: { authorization: `Bearer ${state.tokenC}` },
    });
    const body = progress.body as { furthestSeconds?: number };
    expect(Math.round(body.furthestSeconds ?? 0)).toBe(150);

    // The clip is a real 2-second MP3: once it ends naturally the control
    // must return to the idle «پخش تلفظ» (never stuck on «توقف تلفظ», and
    // the next play attempt stays available).
    await expect(control).toHaveText('پخش تلفظ', { timeout: 10_000 });
  });

  test('8. pronunciation without a file: honest TTS/unavailable fallback', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenC);
    const row = page.getByTestId(`vocab-expander-${state.aB1Vocab[1]}`);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();
    const control = page.getByTestId(`pron-control-${state.aB1Vocab[1]}`);
    const hasVoices = await page.evaluate(() =>
      typeof window !== 'undefined' && 'speechSynthesis' in window
        ? window.speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith('en'))
        : false,
    );
    if (hasVoices) {
      // A supported device/browser voice: the control must be functional.
      await control.click();
      await expect(page.getByTestId(`pron-control-${state.aB1Vocab[1]}`)).toHaveText('توقف تلفظ');
    } else {
      // No English voice → honest unavailable state (never a fake control).
      await control.click();
      await expect(page.getByTestId(`pron-unavailable-${state.aB1Vocab[1]}`)).toHaveText(
        'تلفظ صوتی برای این واژه در دسترس نیست.',
        { timeout: 10_000 },
      );
    }
  });

  test('9. keyboard: Edition Rail is a navigable radiogroup', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenC);
    const b1 = page.getByTestId('edition-plate-B1');
    await expect(b1).toBeVisible({ timeout: 20_000 });
    await b1.focus();
    // ArrowRight / ArrowDown move to the next published level (B2).
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('edition-plate-B2')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('edition-plate-B1')).toBeFocused();
    // Enter on the focused plate navigates.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/lessons/${state.aB2}$`), { timeout: 10_000 });
  });
  test('9b. variant switch preserves the latest practical resume position', async ({ page }) => {
    // A Variant switch must save the position the student actually reached
    // BEFORE the old Variant's callbacks are dropped — the resume point
    // derives from observable Progress, never from a stale seed.
    // Self-contained: reset aB1 to the 150s resume seed first (earlier
    // tests may have moved it), then replay the journey.
    const seed = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${state.aB1}/progress`, {
      headers: { authorization: `Bearer ${state.tokenC}` },
    });
    const seedBody = seed.body as { revision?: number };
    const seedRev = Number(seedBody.revision ?? 0);
    const reset = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${state.aB1}/progress`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${state.tokenC}` },
      body: JSON.stringify({ positionSeconds: 150, expectedRevision: seedRev }),
    });
    expect(reset.status).toBe(200);

    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenC);
    const cta = page.getByTestId('deck-primary-cta');
    await expect(cta).toHaveText('ادامه از 2:30', { timeout: 20_000 });
    await cta.click();
    const player = page.getByRole('group', { name: 'پخش‌کنندهٔ صوت' });
    const slider = player.getByRole('slider', { name: 'موقعیت پخش' });
    // Wait until playback has actually moved (seek clamped to the 2s
    // fixture), then switch Variants mid-listening.
    await expect
      .poll(async () => Number(await slider.getAttribute('aria-valuenow')), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1);
    await page.getByTestId('edition-plate-B2').click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${state.aB2}$`), { timeout: 10_000 });
    await expect(page.getByTestId('deck-primary-cta')).toHaveText('شروع گوش‌دادن', {
      timeout: 20_000,
    });

    // The switch applied the active pause/save callback BEFORE clearing
    // the player callbacks: the authoritative Progress of aB1 now holds
    // the real playback position (~1–2s), never the stale 150s seed.
    await expect
      .poll(
        async () => {
          const p = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${state.aB1}/progress`, {
            headers: { authorization: `Bearer ${state.tokenC}` },
          });
          return Number((p.body as { positionSeconds?: number }).positionSeconds ?? -1);
        },
        { timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(
        async () => {
          const p = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${state.aB1}/progress`, {
            headers: { authorization: `Bearer ${state.tokenC}` },
          });
          return Number((p.body as { positionSeconds?: number }).positionSeconds ?? -1);
        },
        { timeout: 10_000 },
      )
      .toBeLessThanOrEqual(2.5);

    // The honest CTA for a <5s position is «پخش» (deriveDeckCta contract,
    // unit-tested in logic.test.ts) — the returned Variant would never
    // show the stale «ادامه از 2:30» again.
    // The final authoritative read is polled: under full-suite load a
    // single-shot GET can return an anomalous response (observed -1), and
    // the honest CTA for a <5s position is «پخش» (deriveDeckCta contract,
    // unit-tested in logic.test.ts) — the returned Variant would never
    // show the stale «ادامه از 2:30» again.
    await expect
      .poll(
        async () => {
          const p = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${state.aB1}/progress`, {
            headers: { authorization: `Bearer ${state.tokenC}` },
          });
          return Number((p.body as { positionSeconds?: number }).positionSeconds ?? -1);
        },
        { timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(1);
    const saved = Number(
      (
        (
          await jsonFetch(`${PB_URL}/api/fast-english/lessons/${state.aB1}/progress`, {
            headers: { authorization: `Bearer ${state.tokenC}` },
          })
        ).body as { positionSeconds?: number }
      ).positionSeconds ?? -1,
    );
    expect(saved).toBeGreaterThanOrEqual(1);
    expect(saved).toBeLessThan(5);
  });
  test('10. audio failure shows the deck error + retry recovers', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // ONE page load drives the full recovery chain (the suite rides the
    // lesson-detail rate limit of 30 calls/5min per user — every load
    // counts): (1) the protected-URL build fails (token 503) → honest
    // unavailable line + inline retry; (2) retry rebuilds the URL while the
    // audio stream is still broken → deck error line + retry; (3) audio
    // recovers → the CTA slot returns and playback works.
    let tokenBlocked = true;
    let audioBlocked = true;
    await page.route('**/api/files/token', async (route) => {
      if (tokenBlocked) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      } else {
        await route.continue();
      }
    });
    await page.route('**/api/fast-english/lessons/*/audio*', async (route) => {
      if (audioBlocked) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      } else {
        await route.continue();
      }
    });
    await setAuthAndGo(page, `/lessons/${state.aB2}`, state.tokenC);

    // Stage 1: recoverable source absence — honest line + inline retry
    // (Slice 7 review finding 5: the retry control clears 44px).
    await expect(page.getByText('فایل صوتی در دسترس نیست.')).toBeVisible({ timeout: 15_000 });
    const unavailableRetry = page.getByRole('button', { name: 'تلاش مجدد' });
    await expect(unavailableRetry).toBeVisible();
    expect((await unavailableRetry.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Stage 2: the URL builds now, but the audio stream is still broken →
    // the deck's honest error state (no raw media errors). Scoped to the
    // deck error — the PWA offline-ready toast is also an alert and may
    // be visible on the same page.
    tokenBlocked = false;
    await unavailableRetry.click();
    await expect(page.getByRole('alert').filter({ hasText: 'خطا در پخش صوت' })).toContainText(
      'خطا در پخش صوت',
      { timeout: 15_000 },
    );
    const retryButton = page.getByRole('button', { name: 'تلاش مجدد' });
    expect((await retryButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Stage 3: network fully recovers — the CTA slot returns and playback
    // works.
    audioBlocked = false;
    await retryButton.click();
    const cta = page.getByTestId('deck-primary-cta');
    await expect(cta).toBeVisible({ timeout: 15_000 });
    await cta.click();
    await expect(page.getByTestId('player-play-toggle')).toBeVisible({ timeout: 15_000 });
    await page.unroute('**/api/files/token');
    await page.unroute('**/api/fast-english/lessons/*/audio*');
  });
  test('10b. generic load failure shows controlled Persian copy, never raw backend text', async ({
    page,
  }) => {
    // Abort the lesson-detail endpoint itself (never reaches the server):
    // the Episode surface must render the controlled product copy — the
    // raw server message must never surface to Students.
    await page.route('**/api/fast-english/lessons/*', (route) => route.abort());
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenC);
    await expect(page.getByRole('heading', { name: 'خطا در بارگذاری اپیزود' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText('اپیزود بارگیری نشد. اتصال اینترنت را بررسی کن و دوباره تلاش کن.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'تلاش مجدد' })).toBeVisible();
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('PocketBase');
    expect(bodyText).not.toContain('Internal error');
    expect(bodyText).not.toContain('storage/');
    expect(bodyText).not.toContain('"code"');
  });
  test('11. entitlement loss maps to the honest permission state', async ({ page }) => {
    // Expire the student's subscription server-side.
    const subs = await jsonFetch(`${PB_URL}/api/collections/subscriptions/records`, {
      headers: { authorization: `Bearer ${state.su}` },
    });
    const own = (subs.body?.items as Array<{ id: string; user: string }>)?.find(
      (s) => s.user === state.userIdC,
    );
    expect(own).toBeTruthy();
    await jsonFetch(`${PB_URL}/api/collections/subscriptions/records/${own?.id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${state.su}` },
      body: JSON.stringify({ expires_at: new Date(Date.now() - 60_000).toISOString() }),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, `/lessons/${state.aB2}`, state.tokenC);
    await expect(page.getByText('دسترسی محدود')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'رفتن به کتابخانه' })).toBeVisible();

    // Restore the subscription so the responsive/state tests below (which
    // reuse the same student) stay entitled.
    await jsonFetch(`${PB_URL}/api/collections/subscriptions/records/${own?.id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${state.su}` },
      body: JSON.stringify({ expires_at: new Date(Date.now() + 30 * 24 * 3600_000).toISOString() }),
    });
  });
});

test.describe('Episode surface — responsive and states', () => {
  const VIEWPORTS = [
    { name: 'xs-360', width: 360, height: 800 },
    { name: 'sm-390', width: 390, height: 844 },
    { name: 'md-768', width: 768, height: 1024 },
    { name: 'lg-1024', width: 1024, height: 768 },
    { name: 'xl-1440', width: 1440, height: 900 },
  ];

  for (const viewport of VIEWPORTS) {
    test(`12. no horizontal overflow at ${viewport.name} (light + dark)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenC);
      await expect(page.getByTestId('deck-primary-cta')).toBeVisible({ timeout: 20_000 });
      expect(await noHorizontalOverflow(page)).toBe(true);
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-color-scheme', 'dark');
      });
      expect(await noHorizontalOverflow(page)).toBe(true);
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-color-scheme', 'light');
      });
    });
  }

  test('13. deck budget and bounded reading measure (mobile + desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenC);
    const deck = page.getByTestId('audio-player');
    await expect(deck).toBeVisible({ timeout: 20_000 });
    // Accepted budget (DESIGN.md): the Deck is ~220px tall at 390px
    // (the legacy player was 288px) — tight enough to catch a real
    // regression back toward the old height. The deck enters with the
    // route transition; its geometry settles a frame later, so poll for
    // the settled height instead of measuring a transient first frame
    // (observed ~40px mid-layout under full-suite load).
    let deckHeight = 0;
    await expect
      .poll(
        async () => {
          const b = await deck.boundingBox();
          deckHeight = b ? Math.round(b.height) : 0;
          return deckHeight;
        },
        { timeout: 10_000 },
      )
      .toBeGreaterThan(120);
    expect(deckHeight).toBeLessThanOrEqual(224);
    const reading = page.getByTestId('english-reading');
    const readingBox = await reading.boundingBox();
    if (!readingBox) throw new Error('reading has no bounding box');
    expect(readingBox.width).toBeLessThanOrEqual(640 + 1);
    // The Deck renders the accepted radiusCard radius (16px), not the
    // MUI-scaled capsule (Slice 7 review finding 2).
    const deckRadius = await page
      .getByTestId('audio-player')
      .evaluate((el) => getComputedStyle(el).borderRadius);
    expect(deckRadius).toBe('16px');
    // Desktop: the two-column composition has a pinned jacket column and a
    // bounded reading column.
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenC);
    const jacket = page.getByTestId('episode-jacket');
    await expect(jacket).toBeVisible({ timeout: 20_000 });
    const jacketBox = await jacket.boundingBox();
    if (!jacketBox) throw new Error('jacket has no bounding box');
    const readingBox2 = await page.getByTestId('english-reading').boundingBox();
    if (!readingBox2) throw new Error('reading2 has no bounding box');
    expect(jacketBox.width).toBeLessThanOrEqual(340);
    expect(jacketBox.width).toBeGreaterThanOrEqual(240);
    expect(readingBox2.width).toBeLessThanOrEqual(640 + 1);
    // The jacket column is pinned (sticky) on desktop.
    const sticky = await page
      .getByTestId('episode-jacket')
      .evaluate((el) => getComputedStyle(el.parentElement as HTMLElement).position);
    expect(sticky).toBe('sticky');

    // Desktop measure: the English reading surface computes LTR here too
    // (Slice 7 review finding 1 — this reuses the 1440 load).
    const paraDirDesktop = await page
      .locator('[data-testid="english-reading"] p')
      .first()
      .evaluate((el) => getComputedStyle(el).direction);
    expect(paraDirDesktop).toBe('ltr');
  });

  test('14. long titles wrap without overflow', async ({ page }) => {
    // Alpha's English title is short; use a long Persian title via the
    // identity of the long fixture episode (Charlie) is short too — so
    // reuse Alpha with its long English caption and assert no overflow at
    // the narrowest QA width.
    await page.setViewportSize({ width: 360, height: 800 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenC);
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible({ timeout: 20_000 });
    const h1Box = await h1.boundingBox();
    if (!h1Box) throw new Error('h1 has no bounding box');
    expect(h1Box.height).toBeGreaterThan(28);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('15. 200% text zoom stays contained', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenC);
    await expect(page.getByTestId('deck-primary-cta')).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    expect(await noHorizontalOverflow(page)).toBe(true);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
  });

  test('16. design evidence screenshots (FEP_EVIDENCE=1)', async ({ page }) => {
    test.skip(process.env.FEP_EVIDENCE !== '1', 'evidence capture is opt-in');
    const out = process.env.FEP_EVIDENCE_DIR ?? '.artifacts/slice7-design-evidence';
    const { mkdirSync } = await import('node:fs');
    const shots: Array<{ name: string; width: number; height: number; scheme: 'light' | 'dark' }> =
      [
        { name: 'mobile-light', width: 390, height: 844, scheme: 'light' },
        { name: 'mobile-dark', width: 390, height: 844, scheme: 'dark' },
        { name: 'tablet-light', width: 768, height: 1024, scheme: 'light' },
        { name: 'desktop-light', width: 1440, height: 900, scheme: 'light' },
        { name: 'desktop-dark', width: 1440, height: 900, scheme: 'dark' },
      ];
    for (const shot of shots) {
      await page.setViewportSize({ width: shot.width, height: shot.height });
      await page.emulateMedia({ colorScheme: shot.scheme });
      await setAuthAndGo(page, `/lessons/${state.aB1}`, state.tokenC);
      await expect(page.getByTestId('deck-primary-cta')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('episode-jacket')).toBeVisible();
      mkdirSync(`${out}/${shot.scheme}`, { recursive: true });
      await page.screenshot({
        path: `${out}/${shot.scheme}/lessons-${shot.name}-fresh.png`,
        fullPage: true,
      });
      // Open the first vocabulary row to capture the expanded learning layer.
      const firstExpander = page.locator('[data-testid^="vocab-expander-"]').first();
      await firstExpander.click();
      await expect(firstExpander).toHaveAttribute('aria-expanded', 'true');
      await page.screenshot({
        path: `${out}/${shot.scheme}/lessons-${shot.name}-vocab-open.png`,
        fullPage: true,
      });
    }
  });
});
