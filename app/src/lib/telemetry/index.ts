// app/src/lib/telemetry/index.ts
// Minimal production observability facade (no vendor SDK).
//
// Responsibilities:
//   - structured capture of uncaught errors, unhandled rejections,
//     important API/network failures, Player/media failures, route
//     surfaces, app/build version and funnel/listening events;
//   - strict privacy redaction at the boundary (see redact.ts and
//     docs/OBSERVABILITY.md): no passwords, tokens, receipt data,
//     private media URLs, phone numbers, names or raw payloads;
//   - hard failure isolation: every sink and every public entry point is
//     wrapped — observability can never break the Student experience.
//
// Default sink: bounded in-memory ring buffer (no network). A beacon sink
// is attached only when VITE_TELEMETRY_ENDPOINT is set at build time.
//
// The buffer is exposed read-only as window.__fepTelemetry for support
// sessions (a plain snapshot object — no live references).

import type { MediaFailureKind, TelemetryEvent, TelemetryFields, TelemetryLevel } from './events';
import { redactPath, sanitizeMessage, truncate } from './redact';
import { BeaconSink, ConsoleSink, RingBufferSink, type TelemetrySink } from './sinks';

// Injected at build time by vite.app.config.ts (define). Fallbacks keep
// tests and dev builds working.
declare const __APP_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const APP_VERSION = String(__APP_VERSION__ ?? '0.0.0-dev');
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
      // Sink construction must never fail the app.
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
    appVersion: APP_VERSION,
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
        // A broken sink must not stop the others or the app.
      }
    }
  } catch {
    // The facade itself never throws.
  }
}

/** Funnel event shorthand (info level). */
export function trackFunnel(name: string, fields: TelemetryFields = {}): void {
  track(name, 'info', fields);
}

/** Structured, redacted capture of a runtime error (uncaught exception or
 *  unhandled rejection). Never includes the message of auth/media errors
 *  that can embed URLs — free text is sanitized and bounded. */
export function reportError(
  err: unknown,
  fields: TelemetryFields = {},
  level: TelemetryLevel = 'error',
): void {
  try {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown error';
    const stack = err instanceof Error && err.stack ? err.stack : '';
    track('client_error', level, {
      ...fields,
      message: truncate(sanitizeMessage(message), 500),
      ...(stack ? { stack: truncate(sanitizeMessage(stack), 2000) } : {}),
    });
  } catch {
    // never throws
  }
}

/**
 * API/network failure reporting for the PocketBase wrapper. Only
 * server-side or transport failures (5xx, 429, network-level) are
 * reported here — 4xx business errors are expected, user-facing, and
 * would only add noise. Paths are redacted (ids + query strings);
 * request bodies are never captured.
 */
export function reportApiFailure(
  path: string,
  method: string,
  status: number,
  kind: 'http' | 'network',
): void {
  try {
    track('api_failure', kind === 'network' ? 'warn' : 'error', {
      path: redactPath(path),
      method: String(method).toUpperCase(),
      status,
      kind,
    });
  } catch {
    // never throws
  }
}

/** Player/media failure: only the classified media-error code and the
 *  lesson id (a non-personal record id) — never the media URL or the
 *  MediaError message. */
export function reportPlayerFailure(
  lessonId: string | null | undefined,
  code: MediaFailureKind,
): void {
  try {
    track('player_failure', 'warn', { lessonId: lessonId ?? '', code });
  } catch {
    // never throws
  }
}

/** Track the current route surface (redacted pathname) for context on
 *  every subsequent event. */
export function setSurface(pathname: string): void {
  try {
    surface = redactPath(pathname);
  } catch {
    // never throws
  }
}

/** Read-only diagnostic snapshot for support/debug sessions. */
export function getDiagnosticSnapshot(): {
  appVersion: string;
  buildTime: string;
  events: TelemetryEvent[];
} {
  try {
    const ring = sinks.find((s): s is RingBufferSink => s instanceof RingBufferSink);
    return {
      appVersion: APP_VERSION,
      buildTime: BUILD_TIME,
      events: ring ? ring.snapshot() : [],
    };
  } catch {
    return { appVersion: APP_VERSION, buildTime: BUILD_TIME, events: [] };
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

/** Attach the default sinks (called once from main.tsx before render). */
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

export type { MediaFailureKind } from './events';
export { classifyMediaError, FUNNEL_EVENTS, shouldFireMilestone } from './events';
export { redactPath, sanitizeMessage } from './redact';
