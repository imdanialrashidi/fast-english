// landing/src/lib/releaseMetadata.ts
// Runtime Android release metadata — validated same-origin source of truth.
//
// The production APK is published as an immutable file under `/releases/`
// on the canonical host `https://fastenglishpodcast.com`. The current
// release's identity lives in `/releases/release-metadata.json`, which is
// fetched at runtime so a new APK+metadata publish can update the download
// without rebuilding the Landing.
//
// Security contract (mirrors siteConfig's build-time validation):
//   - The download is ALWAYS derived as the same-origin path
//     `/releases/${fileName}` — any `url`/`downloadUrl` field inside the
//     JSON is IGNORED so a compromised metadata cannot redirect to an
//     arbitrary external origin, localhost, or debug build.
//   - `fileName` must match the immutable release pattern
//     `fast-english-podcast-vX.Y.Z.apk`, must not contain slashes or
//     traversal, must not contain `debug`, and must match `versionName`.
//   - `packageId` must be the expected `com.fastenglishpodcast.app`.
//   - `sha256` and `signingCertificateSha256` must be 64 hex chars.
//   - `sizeBytes` when present must be a sane positive integer.
//   - `versionName` must be semver X.Y.Z, `versionCode` positive int.
//   - Any extra or malformed payload → unavailable (honest state, never a
//     broken or fabricated link).

export const RELEASE_METADATA_PATH = '/releases/release-metadata.json';
export const RELEASES_BASE_PATH = '/releases/';
export const CANONICAL_RELEASE_ORIGIN = 'https://fastenglishpodcast.com';
export const EXPECTED_PACKAGE_ID = 'com.fastenglishpodcast.app';

const FILENAME_RE = /^fast-english-podcast-v(\d+\.\d+\.\d+)\.apk$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const HEX64_RE = /^[a-fA-F0-9]{64}$/;

export interface ReleaseMetadata {
  versionName: string;
  versionCode: number;
  packageId: string;
  fileName: string;
  sizeBytes: number | null;
  sha256: string;
  signingCertificateSha256: string;
  minimumAndroidApi: number | null;
  targetAndroidApi: number | null;
  builtAt: string | null;
  /** Same-origin relative path: `/releases/${fileName}` */
  downloadPath: string;
  /** Canonical absolute URL: `https://fastenglishpodcast.com/releases/${fileName}` */
  downloadUrl: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toPositiveInt(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) return null;
  return v;
}

/**
 * Validate raw JSON from `/releases/release-metadata.json`.
 * Returns a sanitized ReleaseMetadata or null when the payload is
 * incomplete, malformed, or would produce an unsafe download.
 * NEVER trusts an external URL field from the payload.
 */
export function validateReleaseMetadata(raw: unknown): ReleaseMetadata | null {
  if (!isRecord(raw)) return null;

  const versionName = typeof raw.versionName === 'string' ? raw.versionName.trim() : '';
  if (!SEMVER_RE.test(versionName)) return null;

  const versionCode = toPositiveInt(raw.versionCode);
  if (versionCode === null) return null;

  const packageId = typeof raw.packageId === 'string' ? raw.packageId.trim() : '';
  if (packageId !== EXPECTED_PACKAGE_ID) return null;

  const fileName = typeof raw.fileName === 'string' ? raw.fileName.trim() : '';
  // Strict pattern: no slashes, no debug, version must match versionName
  if (!FILENAME_RE.test(fileName)) return null;
  if (fileName.toLowerCase().includes('debug')) return null;
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) return null;
  const match = fileName.match(FILENAME_RE);
  if (!match || match[1] !== versionName) return null;

  const sha256 = typeof raw.sha256 === 'string' ? raw.sha256.trim() : '';
  if (!HEX64_RE.test(sha256)) return null;

  const signingCertificateSha256 =
    typeof raw.signingCertificateSha256 === 'string' ? raw.signingCertificateSha256.trim() : '';
  // Allow missing signing cert in older metadata, but if present must be valid
  if (signingCertificateSha256 !== '' && !HEX64_RE.test(signingCertificateSha256)) return null;
  // Require it for current releases — honest display needs it
  if (signingCertificateSha256 === '') return null;

  // sizeBytes: required for trustworthy display, but allow null → unavailable size
  let sizeBytes: number | null = null;
  if (raw.sizeBytes !== undefined && raw.sizeBytes !== null) {
    const s = toPositiveInt(raw.sizeBytes);
    if (s === null || s > 500 * 1024 * 1024) return null;
    sizeBytes = s;
  } else {
    // Missing size is treated as unavailable, not invalid, so the download
    // can still be offered without a size badge. Keep null.
    sizeBytes = null;
  }

  let minimumAndroidApi: number | null = null;
  if (raw.minimumAndroidApi !== undefined && raw.minimumAndroidApi !== null) {
    const n = toPositiveInt(raw.minimumAndroidApi);
    if (n === null || n < 21 || n > 36) return null;
    minimumAndroidApi = n;
  }
  let targetAndroidApi: number | null = null;
  if (raw.targetAndroidApi !== undefined && raw.targetAndroidApi !== null) {
    const n = toPositiveInt(raw.targetAndroidApi);
    if (n === null || n < 21 || n > 36) return null;
    targetAndroidApi = n;
  }

  let builtAt: string | null = null;
  if (typeof raw.builtAt === 'string' && raw.builtAt.trim().length > 0) {
    const d = Date.parse(raw.builtAt);
    if (Number.isNaN(d)) return null;
    builtAt = raw.builtAt.trim();
  }

  // Derive the download location SOLELY from the validated fileName.
  // Ignore any url/downloadUrl/apkUrl field even if the payload tries to
  // provide an external redirect. This is the same-origin guarantee.
  const downloadPath = `${RELEASES_BASE_PATH}${fileName}`;
  const downloadUrl = `${CANONICAL_RELEASE_ORIGIN}${downloadPath}`;

  // Final sanity: derived path must still be safe
  if (downloadPath.includes('..') || downloadPath.includes('\\')) return null;

  return {
    versionName,
    versionCode,
    packageId,
    fileName,
    sizeBytes,
    sha256: sha256.toLowerCase(),
    signingCertificateSha256: signingCertificateSha256.toUpperCase(),
    minimumAndroidApi,
    targetAndroidApi,
    builtAt,
    downloadPath,
    downloadUrl,
  };
}

/** Human-readable file size in Persian (reuses shared formatter pattern). */
export function formatReleaseSize(bytes: number | null): string | null {
  if (bytes === null || typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }
  if (bytes < 1024) return `${bytes.toLocaleString('fa-IR')} بایت`;
  const kb = bytes / 1024;
  if (kb < 1024) {
    const v = Math.round(kb * 10) / 10;
    return `${v.toLocaleString('fa-IR')} کیلوبایت`;
  }
  const mb = bytes / (1024 * 1024);
  const v = Math.round(mb * 10) / 10;
  return `${v.toLocaleString('fa-IR')} مگابایت`;
}

let cached: Promise<ReleaseMetadata | null> | null = null;

/**
 * Fetch and validate the current release metadata (same-origin).
 * Cached per page load; returns null on any failure → honest unavailable
 * state. Never throws. Never returns an external URL.
 */
export function fetchReleaseMetadata(signal?: AbortSignal): Promise<ReleaseMetadata | null> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const res = await fetch(RELEASE_METADATA_PATH, {
        headers: { accept: 'application/json' },
        signal: signal ?? AbortSignal.timeout(8_000),
      });
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') ?? '';
      // Tolerate missing content-type in dev, but reject obvious non-JSON
      if (
        ct !== '' &&
        !ct.includes('application/json') &&
        !ct.includes('text/json') &&
        !ct.includes('text/plain')
      ) {
        // Some servers serve JSON with text/plain — allow, but reject html
        if (ct.includes('text/html')) return null;
      }
      const raw = await res.json();
      return validateReleaseMetadata(raw);
    } catch {
      return null;
    }
  })();
  return cached;
}

/** Test helper: reset the module cache. */
export function resetReleaseMetadataCache(): void {
  cached = null;
}
