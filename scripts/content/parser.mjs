// scripts/content/parser.mjs
// Podcast Slice 3 — full local Package validation.
//
// Order: schema validation → structural/identity checks → safe path
// resolution → asset inspection (images/audio/transcripts) → editorial
// copy checks → checksums → deterministic fingerprint. Returns a
// ValidationResult with stable diagnostics; never touches the database.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canonicalJson,
  packageFingerprint,
  sha256Hex,
} from '../../shared/content-package/checksums.ts';
import { isUnsafeAssetPath } from '../../shared/content-package/constants.ts';
import {
  editorialDiagnostics,
  transcriptDiagnostics,
} from '../../shared/content-package/editorial.ts';
import { contentKeyFromParts, isValidSlug } from '../../shared/content-package/normalize.ts';
import { validateManifestSchema } from '../../shared/content-package/schema.ts';
import { inspectAudio, inspectImage, inspectTranscript } from './assets.mjs';
import { ContentPackagePathError, packageRoot } from './paths.mjs';

const diag = (code, severity, path, message, suggestion) => ({
  code,
  severity,
  path,
  message,
  suggestion,
});
const error = (code, path, message, suggestion) => diag(code, 'error', path, message, suggestion);
const warn = (code, path, message, suggestion) => diag(code, 'warning', path, message, suggestion);

/** Reads and parses the manifest file (episode.json) at the package root. */
export function loadManifest(root) {
  const raw = readFileSync(join(root, 'episode.json'), 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw error('MANIFEST_INVALID_JSON', 'episode.json', 'episode.json is not valid JSON.');
  }
  return { manifest: parsed, manifestText: raw };
}

/**
 * Validates a package directory. Returns a ValidationResult; when valid,
 * `package` carries the manifest, assets (with checksums, geometry,
 * durations) and the deterministic fingerprint.
 */
export async function validatePackage(dir) {
  const all = [];

  let root;
  try {
    root = packageRoot(dir);
  } catch (err) {
    return {
      valid: false,
      errors: [error('PACKAGE_DIR_MISSING', '.', String(err.message))],
      warnings: [],
    };
  }

  // 1. Manifest JSON + schema.
  let manifestText = '';
  let manifest = null;
  try {
    const loaded = loadManifest(root);
    manifestText = loaded.manifestText;
    manifest = loaded.manifest;
  } catch (err) {
    return {
      valid: false,
      errors: [
        err?.code
          ? err
          : error('MANIFEST_UNREADABLE', 'episode.json', 'episode.json could not be read.'),
      ],
      warnings: [],
    };
  }
  const schemaResult = validateManifestSchema(manifest);
  all.push(...schemaResult.diagnostics);
  if (!schemaResult.valid) {
    return splitResult(all);
  }
  const typed = manifest;

  // 2. Identity contract: contentKey must equal '<categoryKey>.<slug>'.
  const expectedKey = contentKeyFromParts(typed.categoryKey, typed.episode.slug);
  if (typed.contentKey !== expectedKey) {
    all.push(
      error(
        'CONTENT_KEY_MISMATCH',
        'contentKey',
        `contentKey must equal '<categoryKey>.<episode.slug>' (expected "${expectedKey}").`,
      ),
    );
    return splitResult(all);
  }
  if (!isValidSlug(typed.episode.slug)) {
    all.push(
      error(
        'EPISODE_SLUG_INVALID',
        'episode.slug',
        'Episode slug must match ^[a-z0-9]+(-[a-z0-9]+)*$.',
      ),
    );
    return splitResult(all);
  }

  // 3. Collect every declared asset path (structural check).
  const declared = new Map(); // path -> kind
  declared.set(typed.episode.artworkSquare, 'artworkSquare');
  if (typed.episode.heroImageWide) declared.set(typed.episode.heroImageWide, 'heroImageWide');
  for (const v of typed.variants) {
    declared.set(v.audio, 'audio');
    declared.set(v.transcript, 'transcript');
    for (const entry of v.vocabulary) {
      if (entry.pronunciationAudio) declared.set(entry.pronunciationAudio, 'pronunciationAudio');
    }
  }
  for (const [path] of declared) {
    if (isUnsafeAssetPath(path)) {
      all.push(
        error('PACKAGE_PATH_UNSAFE', path, 'Asset path is unsafe (traversal/absolute/encoded).'),
      );
    }
  }
  if (all.some((d) => d.severity === 'error')) {
    return splitResult(all);
  }

  // 4. Asset inspection (kind-specific, bounded, symlink-safe).
  const assets = [];
  const transcripts = {};
  const audioPaths = new Set();
  for (const [path, kind] of declared) {
    try {
      if (kind === 'artworkSquare' || kind === 'heroImageWide') {
        const info = inspectImage(root, path);
        const bytes = readFileSync(join(root, path));
        const asset = {
          path,
          kind,
          sizeBytes: bytes.length,
          sha256: sha256Hex(bytes),
          mimeType: info.mimeType,
          width: info.width,
          height: info.height,
        };
        assets.push(asset);
        all.push(...artworkDiagnostics(asset, kind));
      } else if (kind === 'audio') {
        const info = await inspectAudio(root, path);
        const bytes = readFileSync(join(root, path));
        if (audioPaths.has(path)) {
          all.push(
            error(
              'AUDIO_PATH_REUSED',
              path,
              'The same audio file is used by more than one Variant.',
            ),
          );
        }
        audioPaths.add(path);
        assets.push({
          path,
          kind,
          sizeBytes: bytes.length,
          sha256: sha256Hex(bytes),
          mimeType: info.mimeType,
          durationSeconds: info.durationSeconds,
        });
      } else if (kind === 'pronunciationAudio') {
        const info = await inspectAudio(root, path, { maxBytes: 2 * 1024 * 1024 });
        const bytes = readFileSync(join(root, path));
        assets.push({
          path,
          kind,
          sizeBytes: bytes.length,
          sha256: sha256Hex(bytes),
          mimeType: info.mimeType,
          durationSeconds: info.durationSeconds,
        });
      } else {
        const info = inspectTranscript(root, path);
        transcripts[path] = info.normalized;
        const bytes = readFileSync(join(root, path));
        assets.push({
          path,
          kind,
          sizeBytes: bytes.length,
          sha256: sha256Hex(bytes),
          mimeType: 'text/markdown',
        });
        const level = path.split('/').pop()?.replace(/\.md$/, '') ?? '';
        all.push(...transcriptDiagnostics(level, info.normalized, info.rawLength));
      }
    } catch (err) {
      if (err instanceof ContentPackagePathError) {
        all.push(error(err.code, err.path ?? path, err.message));
      } else {
        all.push(error('PACKAGE_ASSET_INSPECT_FAILED', path, String(err.message)));
      }
    }
  }
  if (all.some((d) => d.severity === 'error')) {
    return splitResult(all);
  }

  // 5. Editorial copy checks.
  all.push(...editorialDiagnostics(typed));

  // 6. Build the deterministic fingerprint from canonical manifest + assets.
  const sortedAssets = [...assets].sort((a, b) => (a.path < b.path ? -1 : 1));
  const fingerprint = packageFingerprint(
    canonicalJson(typed),
    sortedAssets.map((a) => ({ path: a.path, sizeBytes: a.sizeBytes, sha256: a.sha256 })),
  );

  const result = splitResult(all);
  if (result.valid) {
    result.package = {
      manifest: typed,
      manifestText,
      manifestCanonical: canonicalJson(typed),
      fingerprint,
      assets: sortedAssets,
      transcripts,
    };
  }
  return result;
}

function splitResult(all) {
  return {
    valid: !all.some((d) => d.severity === 'error'),
    errors: all.filter((d) => d.severity === 'error'),
    warnings: all.filter((d) => d.severity === 'warning'),
  };
}

function artworkDiagnostics(asset, kind) {
  const out = [];
  if (!asset.width || !asset.height) return out;
  if (kind === 'artworkSquare') {
    if (Math.abs(asset.width - asset.height) > 8) {
      out.push(
        warn(
          'ARTWORK_NOT_SQUARE',
          asset.path,
          `Square artwork must be square (got ${asset.width}x${asset.height}).`,
        ),
      );
    }
    const minDim = Math.min(asset.width, asset.height);
    if (minDim < 512) {
      out.push(
        warn(
          'ARTWORK_TOO_SMALL',
          asset.path,
          `Square artwork smaller than 512px (got ${minDim}px).`,
        ),
      );
    }
  } else {
    if (asset.height > asset.width) {
      out.push(
        warn(
          'HERO_NOT_LANDSCAPE',
          asset.path,
          `Hero image must be landscape (got ${asset.width}x${asset.height}).`,
        ),
      );
    }
    if (asset.width > 0 && asset.height > 0) {
      const ratio = asset.width / asset.height;
      if (ratio < 1.4 || ratio > 2.1) {
        out.push(
          warn(
            'HERO_RATIO_UNUSUAL',
            asset.path,
            `Hero aspect ratio is far from 16:9 (got ${ratio.toFixed(2)}).`,
          ),
        );
      }
    }
  }
  return out;
}
