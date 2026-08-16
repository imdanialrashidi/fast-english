// landing/src/lib/siteConfig.ts
// Build-time configuration for the static landing surface.
//
// All values come from Vite environment variables (see `.env.example`)
// with safe, honest defaults. The Android APK is NEVER fabricated: when
// `VITE_ANDROID_APK_URL` is not configured the site shows an explicit
// "not released yet" state instead of a download link.

/** Default web app origin. Safe fallback; never points at local paths. */
export const DEFAULT_WEB_APP_URL = 'https://app.fastenglishpodcast.com';

/** Canonical origin of this landing site. */
export const SITE_URL = 'https://fastenglishpodcast.com';

export interface ApkState {
  /** Present only when a real release URL is configured. */
  url: string | null;
  /** Release version when configured (P4-S2 provides it). */
  version: string | null;
}

/**
 * Resolve the Android APK state from raw environment values.
 * A configured URL must be an https URL on a real domain; anything else
 * is treated as "not configured" so a debug APK or local path can never
 * become a public download link.
 */
export function resolveApkState(rawUrl: string | null, rawVersion: string | null): ApkState {
  const url = normalizeOptionalUrl(rawUrl);
  const version = rawVersion !== null && rawVersion.trim().length > 0 ? rawVersion.trim() : null;
  return { url, version };
}

/** True when the APK is available to download (an official URL is set). */
export function apkAvailable(state: ApkState): boolean {
  return state.url !== null;
}

/** Resolve the web app URL with the safe production default. */
export function resolveWebAppUrl(rawUrl: string | null): string {
  return normalizeOptionalUrl(rawUrl) ?? DEFAULT_WEB_APP_URL;
}

/** Accepts only absolute https URLs on a real host. Never local paths. */
function normalizeOptionalUrl(raw: string | null): string | null {
  if (raw === null) return null;
  const value = raw.trim();
  if (value.length === 0) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

// --- Build-time configuration -------------------------------------------

const env = import.meta.env as Record<string, string | undefined>;

export const webAppUrl: string = resolveWebAppUrl(env.VITE_WEB_APP_URL ?? null);

export const apkState: ApkState = resolveApkState(
  env.VITE_ANDROID_APK_URL ?? null,
  env.VITE_ANDROID_APK_VERSION ?? null,
);

/** Public sample lesson lives inside the web app (public route, no auth). */
export const publicSampleUrl: string = `${webAppUrl}/sample`;
