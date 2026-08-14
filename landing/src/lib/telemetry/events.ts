// landing/src/lib/telemetry/events.ts
// Landing acquisition-telemetry event shapes and vocabulary.
//
// Follows the repository telemetry contract (docs/OBSERVABILITY.md): a
// deliberately small, one-shot, user-meaningful event set — never
// per-render, per-second, or per-save telemetry. The `route_change` and
// `install_intent` names are shared with the Student App contract;
// `signup_intent`, `download_intent` and `collaboration_intent` are the
// landing acquisition additions.
//
// Privacy invariant: no event carries a phone, name, email, payment,
// receipt, token, media URL or free-text field. The only field values
// are fixed site identifiers (`where`) and redacted route surfaces.

export type TelemetryLevel = 'info' | 'warn' | 'error';

export type TelemetryFields = Record<string, string | number | boolean | null | undefined>;

export interface TelemetryEvent {
  /** Stable event name, e.g. `signup_intent`. */
  name: string;
  level: TelemetryLevel;
  /** Epoch milliseconds. */
  ts: number;
  /** Redacted route surface the event happened on ('' when unknown). */
  surface: string;
  appVersion: string;
  buildTime: string;
  fields: TelemetryFields;
}

// ---------------------------------------------------------------------------
// Landing acquisition event names. Keep docs/OBSERVABILITY.md in sync.
// ---------------------------------------------------------------------------

export const ACQUISITION_EVENTS = {
  routeChange: 'route_change',
  signupIntent: 'signup_intent',
  installIntent: 'install_intent',
  downloadIntent: 'download_intent',
  collaborationIntent: 'collaboration_intent',
} as const;

/** Fixed, non-personal identifiers for the CTA that produced an event. */
export const CTA_PLACES = {
  hero: 'hero',
  header: 'header',
  footer: 'footer',
  final: 'final',
  install: 'install',
  howItWorks: 'how-it-works',
  about: 'about',
  contact: 'contact',
  sample: 'sample',
  collaboration: 'collaboration',
} as const;

export type CtaPlace = (typeof CTA_PLACES)[keyof typeof CTA_PLACES];

/** Redact a route path for event surfaces: pathname only, no query/hash. */
export function redactPath(path: string): string {
  try {
    const url = new URL(path, 'https://fastenglishpodcast.com');
    return url.pathname.length > 1 ? url.pathname : '/';
  } catch {
    return '/';
  }
}
