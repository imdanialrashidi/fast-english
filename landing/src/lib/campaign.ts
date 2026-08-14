// landing/src/lib/campaign.ts
// Safe campaign/referral parameter preservation when crossing from the
// landing domain (fastenglishpodcast.com) to the Student web app
// (app.fastenglishpodcast.com).
//
// Only an explicit allowlist of standard marketing/referral parameters
// is forwarded; everything else (tokens, session ids, arbitrary query
// keys) is dropped. Values are trimmed, length-bounded and never logged
// or sent to telemetry. Purely functional — no `window` access — so the
// prerender build and unit tests get identical behavior.

/** Parameters that may be forwarded to the web app. */
const ALLOWED_CAMPAIGN_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
]);

const MAX_VALUE_LENGTH = 100;

/**
 * Append allowlisted campaign/referral parameters from `search`
 * (e.g. `window.location.search`) to `baseUrl`. Returns `baseUrl`
 * unchanged when the input is empty or contains nothing allowed.
 */
export function buildAppUrlWithCampaign(baseUrl: string, search: string): string {
  if (baseUrl.length === 0 || search.length === 0) {
    return baseUrl;
  }
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (raw.length === 0) {
    return baseUrl;
  }
  const incoming = new URLSearchParams(raw);
  const forwarded = new URLSearchParams();
  for (const [key, value] of incoming) {
    if (!ALLOWED_CAMPAIGN_KEYS.has(key)) continue;
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.length > MAX_VALUE_LENGTH) continue;
    forwarded.append(key, trimmed);
  }
  if (forwarded.size === 0) {
    return baseUrl;
  }
  // Never produce `…?x=1?utm_source=…` when the base URL already carries
  // its own query (or a hash): strip both before appending.
  const cleanBase = baseUrl.split(/[?#]/, 1)[0];
  const suffix = forwarded.toString();
  return `${cleanBase}?${suffix}`;
}

/**
 * Extract the current campaign parameters for the app URL.
 * SSR-safe: returns the bare base URL when `window` is unavailable
 * (static prerender), so server-rendered HTML and the first client
 * render always match.
 */
export function appUrlWithCurrentCampaign(baseUrl: string): string {
  if (typeof window === 'undefined') {
    return baseUrl;
  }
  return buildAppUrlWithCampaign(baseUrl, window.location.search);
}
