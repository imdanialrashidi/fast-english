// shared/content-package/zipPackage.ts
// Podcast Slice 4 — assemble a Slice 3 content package from parsed ZIP
// entries, reusing the SAME shared validation modules the CLI pipeline
// uses (JSON Schema via schema.ts, editorial + transcript diagnostics,
// transcript normalization, path safety, canonical identity rules).
//
// The server stays authoritative: the Admin UI sends the resulting
// manifest + asset inventory to the existing Staff plan/execute routes,
// which re-validate everything from the actual bytes. No second
// validation implementation exists — the shared modules here are the
// CLI's own browser-safe layers.

import { sha256Hex } from './checksums.ts';
import {
  AUDIO_MIME_TYPES,
  PRONUNCIATION_MIME_TYPES,
  TRANSCRIPT_FORBIDDEN_PATTERNS,
  TRANSCRIPT_MAX_CHARS,
} from './constants.ts';
import { editorialDiagnostics, transcriptDiagnostics } from './editorial.ts';
import { contentKeyFromParts, isSafeAssetPath, normalizeTranscriptText } from './normalize.ts';
import { validateManifestSchema } from './schema.ts';
import type { ContentDiagnostic, EpisodeManifest } from './types.ts';
import type { ZipEntry } from './zip.ts';
import { zipBasename } from './zip.ts';

export type ZipAssetKind =
  | 'artworkSquare'
  | 'heroImageWide'
  | 'audio'
  | 'transcript'
  | 'pronunciationAudio';

export interface ZipAsset {
  path: string;
  kind: ZipAssetKind;
  sizeBytes: number;
  sha256: string;
  bytes: Uint8Array;
  /** Multipart MIME derived from the extension (mirror of the CLI). */
  mimeType: string;
}

export interface ZipPackageResult {
  ok: boolean;
  errors: ContentDiagnostic[];
  warnings: ContentDiagnostic[];
  manifest?: EpisodeManifest;
  manifestText?: string;
  assets?: ZipAsset[];
  /** Normalized transcript text per variant level. */
  transcripts?: Record<string, string>;
}

const d = (
  code: string,
  severity: ContentDiagnostic['severity'],
  path: string,
  message: string,
  suggestion?: string,
): ContentDiagnostic => ({ code, severity, path, message, suggestion });

function findEntry(entries: ZipEntry[], declaredPath: string): ZipEntry | null {
  for (const e of entries) {
    if (e.path === declaredPath) return e;
  }
  for (const e of entries) {
    if (e.path.endsWith(`/${declaredPath}`)) return e;
  }
  return null;
}

function mimeForPath(path: string, kind: ZipAssetKind): string {
  const lower = path.toLowerCase();
  if (kind === 'transcript') return 'text/markdown';
  if (kind === 'audio' || kind === 'pronunciationAudio') {
    if (lower.endsWith('.mp3')) return 'audio/mpeg';
    if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
    return '';
  }
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return '';
}

/** Declared asset set with kinds (mirror of the CLI/server declaredAssets). */
function declaredAssetsOf(manifest: EpisodeManifest): Array<{ path: string; kind: ZipAssetKind }> {
  const out: Array<{ path: string; kind: ZipAssetKind }> = [];
  out.push({ path: manifest.episode.artworkSquare, kind: 'artworkSquare' });
  if (manifest.episode.heroImageWide) {
    out.push({ path: manifest.episode.heroImageWide, kind: 'heroImageWide' });
  }
  for (const v of manifest.variants) {
    out.push({ path: v.audio, kind: 'audio' });
    out.push({ path: v.transcript, kind: 'transcript' });
    for (const e of v.vocabulary) {
      if (e.pronunciationAudio) {
        out.push({ path: e.pronunciationAudio, kind: 'pronunciationAudio' });
      }
    }
  }
  return out;
}

/**
 * Assembles a validated package from ZIP entries. `ok` is true only when
 * there are no errors (warnings never block). The result mirrors the CLI's
 * ValidationResult semantics so the Admin report matches the CLI report.
 */
export async function assemblePackageFromZip(entries: ZipEntry[]): Promise<ZipPackageResult> {
  const errors: ContentDiagnostic[] = [];
  const warnings: ContentDiagnostic[] = [];

  const manifestFiles = entries.filter((e) => zipBasename(e.path) === 'episode.json');
  if (manifestFiles.length === 0) {
    return {
      ok: false,
      errors: [
        d(
          'MANIFEST_NOT_FOUND',
          'error',
          '$',
          'فایل episode.json در بسته پیدا نشد.',
          'بسته باید شامل فایل episode.json باشد.',
        ),
      ],
      warnings: [],
    };
  }
  if (manifestFiles.length > 1) {
    return {
      ok: false,
      errors: [
        d(
          'MANIFEST_AMBIGUOUS',
          'error',
          '$',
          'بیش از یک فایل episode.json در بسته وجود دارد.',
          'فقط یک فایل episode.json مجاز است.',
        ),
      ],
      warnings: [],
    };
  }

  let manifest: EpisodeManifest;
  let manifestText: string;
  try {
    manifestText = new TextDecoder().decode(manifestFiles[0].bytes);
    manifest = JSON.parse(manifestText) as EpisodeManifest;
  } catch {
    return {
      ok: false,
      errors: [
        d(
          'MANIFEST_INVALID_JSON',
          'error',
          'episode.json',
          'episode.json معتبر نیست.',
          'محتوا باید JSON معتبر باشد.',
        ),
      ],
      warnings: [],
    };
  }

  // 1. JSON Schema (shared Ajv validator — the CLI's own gate).
  const schema = validateManifestSchema(manifest);
  for (const diag of schema.diagnostics) {
    if (diag.severity === 'warning') warnings.push(diag);
    else errors.push(diag);
  }

  // 2. Identity contract (mirror of the server structural check).
  if (
    typeof manifest.contentKey === 'string' &&
    typeof manifest.categoryKey === 'string' &&
    manifest.episode &&
    typeof manifest.episode.slug === 'string'
  ) {
    const expected = contentKeyFromParts(manifest.categoryKey, manifest.episode.slug);
    if (manifest.contentKey !== expected) {
      errors.push(
        d(
          'CONTENT_KEY_MISMATCH',
          'error',
          'contentKey',
          `contentKey باید برابر «${expected}» باشد.`,
          'contentKey را با فرمت «دستهبندی.شناسه» هماهنگ کنید.',
        ),
      );
    }
  }

  // 3. Asset presence + path safety + media format hints.
  const declared = manifest.variants ? declaredAssetsOf(manifest) : [];
  const assets: ZipAsset[] = [];
  const seenAudio = new Set<string>();
  if (manifest.variants && manifest.episode) {
    for (const decl of declared) {
      if (!isSafeAssetPath(decl.path)) {
        errors.push(
          d(
            'ASSET_PATH_UNSAFE',
            'error',
            decl.path,
            'مسیر فایل ناامن است.',
            'فقط مسیرهای نسبی ساده مجاز هستند.',
          ),
        );
        continue;
      }
      const entry = findEntry(entries, decl.path);
      if (!entry) {
        errors.push(
          d(
            'ASSET_MISSING',
            'error',
            decl.path,
            `فایل «${decl.path}» در بسته پیدا نشد.`,
            'همه فایلهای معرفیشده در episode.json باید داخل بسته باشند.',
          ),
        );
        continue;
      }
      if (decl.kind === 'audio' || decl.kind === 'pronunciationAudio') {
        if (seenAudio.has(decl.path)) {
          errors.push(
            d(
              'AUDIO_PATH_REUSED',
              'error',
              decl.path,
              'یک فایل صوتی برای بیش از یک نسخه استفاده شده است.',
            ),
          );
          continue;
        }
        seenAudio.add(decl.path);
      }
      const mime = mimeForPath(decl.path, decl.kind);
      if (!mime) {
        const code =
          decl.kind === 'audio' || decl.kind === 'pronunciationAudio'
            ? 'AUDIO_UNSUPPORTED_TYPE'
            : 'IMAGE_EXTENSION_MISMATCH';
        errors.push(
          d(
            code,
            'error',
            decl.path,
            decl.kind === 'audio' || decl.kind === 'pronunciationAudio'
              ? 'فایل صوتی باید MP3 یا M4A باشد.'
              : 'تصویر باید JPEG، PNG یا WebP باشد.',
          ),
        );
        continue;
      }
      const allowed =
        decl.kind === 'audio' || decl.kind === 'pronunciationAudio'
          ? decl.kind === 'pronunciationAudio'
            ? PRONUNCIATION_MIME_TYPES
            : AUDIO_MIME_TYPES
          : ['image/jpeg', 'image/png', 'image/webp'];
      if (decl.kind !== 'transcript' && !(allowed as readonly string[]).includes(mime)) {
        errors.push(
          d('ASSET_MIME_MISMATCH', 'error', decl.path, 'نوع فایل با مجوزهای بسته هماهنگ نیست.'),
        );
        continue;
      }
      assets.push({
        path: decl.path,
        kind: decl.kind,
        sizeBytes: entry.sizeBytes,
        sha256: sha256Hex(entry.bytes),
        bytes: entry.bytes,
        mimeType: mime,
      });
    }
  }

  // 4. Transcripts: normalize + forbidden constructs + length + thresholds.
  const transcripts: Record<string, string> = {};
  if (manifest.variants) {
    for (const v of manifest.variants) {
      if (!v.transcript) continue;
      const asset = assets.find((a) => a.path === v.transcript);
      if (!asset) continue;
      let raw: string;
      try {
        raw = new TextDecoder().decode(asset.bytes);
      } catch {
        raw = '';
      }
      const normalized = normalizeTranscriptText(raw);
      transcripts[v.level] = normalized;
      if (normalized.length > TRANSCRIPT_MAX_CHARS) {
        errors.push(
          d('TRANSCRIPT_TOO_LONG', 'error', v.transcript, 'متن اپیزود از ۵۰٬۰۰۰ نویسه بلندتر است.'),
        );
      }
      for (const f of TRANSCRIPT_FORBIDDEN_PATTERNS) {
        if (f.pattern.test(normalized)) {
          errors.push(d(f.code, 'error', v.transcript, 'متن اپیزود شامل ساختار غیرمجاز است.'));
          break;
        }
      }
      for (const diag of transcriptDiagnostics(v.level, normalized, raw.length)) {
        if (diag.severity === 'warning') warnings.push(diag);
        else errors.push(diag);
      }
    }
  }

  // 5. Editorial copy checks (shared with the CLI).
  if (manifest.episode && manifest.variants) {
    for (const diag of editorialDiagnostics(manifest)) {
      if (diag.severity === 'warning') warnings.push(diag);
      else errors.push(diag);
    }
  }

  const ok = errors.length === 0 && !!manifest && !!manifest.episode && !!manifest.variants;
  return {
    ok,
    errors,
    warnings,
    manifest: manifest as EpisodeManifest,
    manifestText,
    assets: assets.length > 0 ? assets : undefined,
    transcripts,
  };
}
