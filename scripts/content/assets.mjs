// scripts/content/assets.mjs
// Podcast Slice 3 — programmatic media inspection:
//   - images: signature + dimensions (image-size) + type rules;
//   - audio:  signature + bounded metadata read (music-metadata) with a
//     deterministic frame-parser fallback so synthetic test fixtures and
//     unusual encodings still yield an authoritative duration;
//   - transcripts: UTF-8 read + normalization + safety checks.
//
// The duration logic mirrors server/pb_hooks/content_import_core.pb.js —
// the server is authoritative; the smoke suite asserts CLI/server parity.

import { imageSize } from 'image-size';
import { parseBuffer } from 'music-metadata';
import {
  ARTWORK_MAX_BYTES,
  AUDIO_MAX_BYTES,
  PRONUNCIATION_MAX_BYTES,
  TRANSCRIPT_FORBIDDEN_PATTERNS,
  TRANSCRIPT_MAX_BYTES,
  TRANSCRIPT_MAX_CHARS,
} from '../../shared/content-package/constants.ts';
import {
  normalizeTranscriptText,
  transcriptIsEffectivelyEmpty,
} from '../../shared/content-package/normalize.ts';
import {
  ContentPackagePathError,
  readAssetBytes,
  readAssetText,
  resolveAssetPath,
} from './paths.mjs';

// --- Image inspection -------------------------------------------------------

const IMAGE_SIGNATURES = [
  { kind: 'jpeg', mime: 'image/jpeg', exts: ['jpg', 'jpeg'], sig: [0xff, 0xd8, 0xff] },
  {
    kind: 'png',
    mime: 'image/png',
    exts: ['png'],
    sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    kind: 'webp',
    mime: 'image/webp',
    exts: ['webp'],
    sig: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
];

function detectSignature(bytes, table) {
  for (const entry of table) {
    let ok = entry.sig.length <= bytes.length;
    if (!ok) continue;
    for (let i = 0; i < entry.sig.length && ok; i++) {
      if (entry.sig[i] !== null && bytes[i] !== entry.sig[i]) ok = false;
    }
    if (ok) return entry;
  }
  return null;
}

/** Inspects an image asset. Returns {mimeType, width, height} or throws. */
export function inspectImage(root, assetPath, { maxBytes = ARTWORK_MAX_BYTES } = {}) {
  const bytes = readAssetBytes(root, assetPath, maxBytes);
  const detected = detectSignature(bytes, IMAGE_SIGNATURES);
  if (!detected) {
    throw new ContentPackagePathError('IMAGE_UNSUPPORTED_TYPE', assetPath);
  }
  const lower = assetPath.toLowerCase();
  const extOk = detected.exts.some((e) => lower.endsWith(`.${e}`));
  if (!extOk) {
    throw new ContentPackagePathError('IMAGE_EXTENSION_MISMATCH', assetPath);
  }
  let dims;
  try {
    dims = imageSize(bytes);
  } catch {
    throw new ContentPackagePathError('IMAGE_CORRUPT', assetPath);
  }
  if (!dims?.width || !dims?.height || dims.width < 1 || dims.height < 1) {
    throw new ContentPackagePathError('IMAGE_CORRUPT', assetPath);
  }
  return { mimeType: detected.mime, width: dims.width, height: dims.height };
}

// --- Audio duration (deterministic parsers, mirror of the server hooks) -----

const MPEG_SAMPLE_RATES = [44100, 48000, 32000, 0];
const MPEG1_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]; // kbps
const MPEG2_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]; // kbps
const _MPEG_SAMPLES = [384, 1152, 1152]; // layer I, II, III (MPEG1)

/**
 * MP3 duration in whole seconds. Handles ID3v2 skip, Xing/Info (VBR) and
 * CBR frame counting. Returns 0 when the duration cannot be determined.
 */
export function mp3DurationSeconds(bytes) {
  let off = 0;
  // Skip ID3v2.
  if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const size =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    const footer = bytes[5] & 0x10 ? 10 : 0;
    off = 10 + size + footer;
  }
  const MAX_FRAMES = 200_000;
  const MAX_SCAN_BYTES = bytes.length;
  let firstHeader = null;
  let frames = 0;
  let pos = off;
  let vbrFrames = 0;

  while (pos + 4 <= MAX_SCAN_BYTES && frames < MAX_FRAMES) {
    // Find the next frame sync (0xFF Ex/Fx).
    while (
      pos + 4 <= MAX_SCAN_BYTES &&
      !(bytes[pos] === 0xff && (bytes[pos + 1] & 0xe0) === 0xe0)
    ) {
      pos++;
    }
    if (pos + 4 > MAX_SCAN_BYTES) break;
    const b1 = bytes[pos + 1];
    const b2 = bytes[pos + 2];
    const _b3 = bytes[pos + 3];
    const version = (b1 >> 3) & 0x03; // 0=MPEG2.5, 1=reserved, 2=MPEG2, 3=MPEG1
    const layerBits = (b1 >> 1) & 0x03;
    const bitrateIdx = (b2 >> 4) & 0x0f;
    const sampleIdx = (b2 >> 2) & 0x03;
    const padding = (b2 >> 1) & 0x01;
    if (
      version === 1 ||
      layerBits === 0 ||
      bitrateIdx === 0 ||
      bitrateIdx === 15 ||
      sampleIdx === 3
    ) {
      pos++;
      continue;
    }
    const mpeg1 = version === 3;
    const layer = 4 - layerBits; // 1..3
    const bitrateKbps = mpeg1 ? MPEG1_BITRATES[bitrateIdx] : MPEG2_BITRATES[bitrateIdx];
    const sampleRate = mpeg1 ? MPEG_SAMPLE_RATES[sampleIdx] : MPEG_SAMPLE_RATES[sampleIdx] / 2;
    if (!bitrateKbps || !sampleRate) {
      pos++;
      continue;
    }
    const samplesPerFrame = layer === 3 ? (mpeg1 ? 1152 : 576) : layer === 2 ? 1152 : 384;
    const frameLen = Math.floor(((mpeg1 ? 144 : 72) * bitrateKbps * 1000) / sampleRate) + padding;
    if (frameLen < 24 || frameLen > 5000) {
      pos++;
      continue;
    }
    if (!firstHeader) {
      firstHeader = { bitrateKbps, sampleRate, samplesPerFrame };
      // Xing/Info header sits in the first frame payload.
      const payloadOff = pos + 4;
      if (payloadOff + 8 <= bytes.length) {
        const tag = String.fromCharCode(
          bytes[payloadOff],
          bytes[payloadOff + 1],
          bytes[payloadOff + 2],
          bytes[payloadOff + 3],
        );
        if (tag === 'Xing' || tag === 'Info') {
          const flags =
            (bytes[payloadOff + 4] << 24) |
            (bytes[payloadOff + 5] << 16) |
            (bytes[payloadOff + 6] << 8) |
            bytes[payloadOff + 7];
          const vpos = payloadOff + 8;
          if (flags & 0x01 && vpos + 4 <= bytes.length) {
            vbrFrames =
              (bytes[vpos] << 24) |
              (bytes[vpos + 1] << 16) |
              (bytes[vpos + 2] << 8) |
              bytes[vpos + 3];
          }
        } else if (tag === 'VBRI' && payloadOff + 18 <= bytes.length) {
          vbrFrames =
            (bytes[payloadOff + 14] << 24) |
            (bytes[payloadOff + 15] << 16) |
            (bytes[payloadOff + 16] << 8) |
            bytes[payloadOff + 17];
        }
      }
    }
    frames++;
    pos += frameLen;
  }
  if (!firstHeader) return 0;
  const total = vbrFrames > 0 ? vbrFrames : frames;
  if (total <= 0) return 0;
  return Math.round((total * firstHeader.samplesPerFrame) / firstHeader.sampleRate);
}

/**
 * M4A/MP4 duration in whole seconds from the moov/mvhd box. Returns 0
 * when the duration cannot be determined.
 */
export function mp4DurationSeconds(bytes) {
  let pos = 0;
  while (pos + 8 <= bytes.length) {
    const size =
      (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
    const type = String.fromCharCode(
      bytes[pos + 4],
      bytes[pos + 5],
      bytes[pos + 6],
      bytes[pos + 7],
    );
    const boxEnd = size > 0 ? pos + size : bytes.length;
    if (type === 'moov' && boxEnd > pos + 8) {
      // Search mvhd inside moov (children are 4-byte-aligned).
      let p = pos + 8;
      while (p + 8 <= boxEnd && p < bytes.length) {
        const childSize =
          (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
        const childType = String.fromCharCode(
          bytes[p + 4],
          bytes[p + 5],
          bytes[p + 6],
          bytes[p + 7],
        );
        if (childType === 'mvhd' && childSize >= 32 && p + 32 <= bytes.length) {
          const version = bytes[p + 8];
          if (version === 1 && p + 32 <= bytes.length) {
            const timescale =
              (bytes[p + 20] << 24) | (bytes[p + 21] << 16) | (bytes[p + 22] << 8) | bytes[p + 23];
            const durHi =
              (bytes[p + 24] << 24) | (bytes[p + 25] << 16) | (bytes[p + 26] << 8) | bytes[p + 27];
            const durLo =
              (bytes[p + 28] << 24) | (bytes[p + 29] << 16) | (bytes[p + 30] << 8) | bytes[p + 31];
            const duration = durHi * 0x100000000 + durLo;
            if (timescale > 0) return Math.round(duration / timescale);
          } else if (p + 24 <= bytes.length) {
            const timescale =
              (bytes[p + 12] << 24) | (bytes[p + 13] << 16) | (bytes[p + 14] << 8) | bytes[p + 15];
            const duration =
              (bytes[p + 16] << 24) | (bytes[p + 17] << 16) | (bytes[p + 18] << 8) | bytes[p + 19];
            if (timescale > 0) return Math.round(duration / timescale);
          }
          return 0;
        }
        if (childSize < 8) break;
        p += childSize;
      }
    }
    if (size <= 0) break;
    pos = boxEnd;
  }
  return 0;
}

/**
 * Inspects an audio asset (MP3/M4A). Returns {mimeType, durationSeconds}.
 * Duration is extracted from the bytes — never from the manifest.
 */
export async function inspectAudio(
  root,
  assetPath,
  { maxBytes = AUDIO_MAX_BYTES, mimeTypes = ['audio/mpeg', 'audio/mp4'] } = {},
) {
  const bytes = readAssetBytes(root, assetPath, maxBytes);
  const lower = assetPath.toLowerCase();
  let mimeType = null;
  let duration = 0;
  if (lower.endsWith('.mp3')) {
    mimeType = 'audio/mpeg';
    duration = mp3DurationSeconds(bytes);
  } else if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) {
    mimeType = 'audio/mp4';
    duration = mp4DurationSeconds(bytes);
  } else {
    throw new ContentPackagePathError('AUDIO_UNSUPPORTED_TYPE', assetPath);
  }
  if (!mimeTypes.includes(mimeType)) {
    throw new ContentPackagePathError('AUDIO_UNSUPPORTED_TYPE', assetPath);
  }
  if (duration <= 0) {
    // Fallback: the maintained metadata reader for unusual-but-valid files.
    try {
      const meta = await parseBuffer(bytes, { mimeType });
      if (meta?.format?.duration && meta.format.duration > 0) {
        duration = Math.max(1, Math.round(meta.format.duration));
      }
    } catch {
      duration = 0;
    }
  }
  if (duration <= 0) {
    throw new ContentPackagePathError('AUDIO_DURATION_UNREADABLE', assetPath);
  }
  return { mimeType, durationSeconds: duration };
}

// --- Transcript handling ----------------------------------------------------

const FORBIDDEN = TRANSCRIPT_FORBIDDEN_PATTERNS.map((e) => ({ ...e }));

/**
 * Reads and normalizes a transcript asset. Throws with a stable code when
 * the file is missing/oversized/forbidden/empty; returns the normalized
 * text otherwise.
 */
export function inspectTranscript(root, assetPath) {
  let raw;
  try {
    raw = readAssetText(root, assetPath, TRANSCRIPT_MAX_BYTES);
  } catch (err) {
    if (err instanceof ContentPackagePathError) throw err;
    throw new ContentPackagePathError('TRANSCRIPT_UNREADABLE', assetPath);
  }
  const normalized = normalizeTranscriptText(raw);
  if (normalized.length > TRANSCRIPT_MAX_CHARS) {
    throw new ContentPackagePathError('TRANSCRIPT_TOO_LONG', assetPath);
  }
  for (const entry of FORBIDDEN) {
    if (entry.pattern.test(normalized)) {
      throw new ContentPackagePathError(entry.code, assetPath);
    }
  }
  if (transcriptIsEffectivelyEmpty(normalized)) {
    throw new ContentPackagePathError('TRANSCRIPT_EMPTY', assetPath);
  }
  return { normalized, rawLength: raw.length };
}

/** Exists-check helper used by the parser. */
export function assetExists(root, assetPath) {
  try {
    resolveAssetPath(root, assetPath);
    return true;
  } catch {
    return false;
  }
}

export { PRONUNCIATION_MAX_BYTES };
