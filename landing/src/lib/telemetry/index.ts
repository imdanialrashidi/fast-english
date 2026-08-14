// landing/src/lib/telemetry/index.ts
// Minimal acquisition-telemetry facade for the static landing surface,
// following the repository telemetry contract (docs/OBSERVABILITY.md):
//   - a small set of one-shot acquisition events (signup/install/
//     download/collaboration intents + route surfaces);
//   - strict privacy: events carry no PII — only fixed site identifiers
//     and redacted route surfaces;
//   - hard failure isolation: every entry point and sink is wrapped —
//     telemetry can never throw or change the page;
//   - default sink: bounded in-memory ring buffer, exposed read-only as
//     `window.__fepTelemetry` (same name/shape as the Student App);
//   - optional `sendBeacon` sink attached only when
//     `VITE_TELEMETRY_ENDPOINT` is set at build time (off by default).
//
// No vendor SDK, no new dependency.

import type { CtaPlace, TelemetryEvent, TelemetryFields, TelemetryLevel } from './events';
import { ACQUISITION_EVENTS, redactPath } from './events';
import { BeaconSink, ConsoleSink, RingBufferSink, type TelemetrySink } from './sinks';

// Injected at build time by vite.landing.config.ts (define). Fallbacks
// keep tests and dev builds working (vitest.config.ts mirrors the app).
declare const __LANDING_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const LANDING_VERSION = String(__LANDING_VERSION__ ?? '0.0.0-dev');
export const BUILD_TIME = String(__BUILD_TIME__ ?? '');

const RING_LIMIT = 200;

let surface = '';
let sinks: TelemetrySink[] = [];

function createDefaultSinks(): TelemetrySink[] {
  const list: TelemetrySink[] = [new RingBufferSink(RING_LIMIT)];
  if (import.meta.env.DEV) {
    list.push(new ConsoleSink(true));
  }
  const endpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT;
  if (typeof endpoint === 'string' && endpoint.length > 0) {
    try {
      list.push(new BeaconSink(endpoint));
    } catch {
      // Sink construction must never fail the page.
    }
  }
  return list;
}

function baseEvent(name: string, level: TelemetryLevel, fields: TelemetryFields): TelemetryEvent {
  return {
    name,
    level,
    ts: Date.now(),
    surface,
    appVersion: LANDING_VERSION,
    buildTime: BUILD_TIME,
    fields,
  };
}

/** Emit an event to every sink. Never throws (per-sink isolation). */
export function track(
  name: string,
  level: TelemetryLevel = 'info',
  fields: TelemetryFields = {},
): void {
  try {
    const event = baseEvent(name, level, fields);
    for (const sink of sinks) {
      try {
        sink.emit(event);
      } catch {
        // A broken sink must not stop the others or the page.
      }
    }
  } catch {
    // The facade itself never throws.
  }
}

/** One-shot acquisition intent shorthand (info level). */
export function trackAcquisition(name: string, fields: TelemetryFields = {}): void {
  track(name, 'info', fields);
}

/** Signup/entry CTA intent — the primary acquisition event. */
export function trackSignupIntent(place: CtaPlace): void {
  trackAcquisition(ACQUISITION_EVENTS.signupIntent, { where: place });
}

/** PWA install intent (browser-native install prompt availability). */
export function trackInstallIntent(): void {
  trackAcquisition(ACQUISITION_EVENTS.installIntent, {});
}

/** Android APK download intent. */
export function trackDownloadIntent(): void {
  trackAcquisition(ACQUISITION_EVENTS.downloadIntent, {});
}

/** Collaboration contact intent. */
export function trackCollaborationIntent(): void {
  trackAcquisition(ACQUISITION_EVENTS.collaborationIntent, {});
}

/** Track the current route surface (redacted pathname) once per load. */
export function setSurface(pathname: string): void {
  try {
    surface = redactPath(pathname);
  } catch {
    // never throws
  }
}

/** Read-only diagnostic snapshot for support sessions. */
export function getDiagnosticSnapshot(): {
  appVersion: string;
  buildTime: string;
  events: TelemetryEvent[];
} {
  try {
    const ring = sinks.find((s): s is RingBufferSink => s instanceof RingBufferSink);
    return {
      appVersion: LANDING_VERSION,
      buildTime: BUILD_TIME,
      events: ring ? ring.snapshot() : [],
    };
  } catch {
    return { appVersion: LANDING_VERSION, buildTime: BUILD_TIME, events: [] };
  }
}

/** Attach the default sinks (called once per page entry before render). */
export function initTelemetry(): void {
  try {
    sinks = createDefaultSinks();
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, '__fepTelemetry', {
        configurable: true,
        value: () => getDiagnosticSnapshot(),
      });
    }
  } catch {
    // never throws
  }
}

/** Reset the sink registry (used by tests; harmless at runtime). */
export function _resetTelemetryForTests(): void {
  sinks = [];
}

/** Test-only: replace the sink registry (never used at runtime). */
export function _setSinksForTests(next: TelemetrySink[]): void {
  sinks = next;
}

export type { CtaPlace, TelemetryEvent, TelemetryFields, TelemetryLevel } from './events';
export { ACQUISITION_EVENTS, CTA_PLACES, redactPath } from './events';
