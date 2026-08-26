// shared/lib/telemetry/create.ts
// Factory for telemetry facade — single source for app and landing.
// Keeps RING_LIMIT, RingBuffer/Beacon/Console sinks, and window.__fepTelemetry shape in one place.
// Privacy: all fields pass through sanitize before buffering/beacon.

import type { TelemetryEvent, TelemetryFields, TelemetryLevel } from './events';
import { redactPath, sanitizeMessage } from './redact';
import { BeaconSink, RING_LIMIT, RingBufferSink, type TelemetrySink } from './sinks';

export interface CreateTelemetryOpts {
  version: string;
  buildTime?: string;
  endpoint?: string;
  // When true, sanitize fields via redact (always true for prod; kept as option for tests)
  redact?: boolean;
}

export interface TelemetryHandle {
  track: (name: string, level?: TelemetryLevel, fields?: TelemetryFields) => void;
  initTelemetry: () => void;
  /** Redact and remember the current route surface for subsequent events. */
  setSurface: (pathname: string) => void;
  /** Snapshot for diagnostics (window.__fepTelemetry). */
  getSnapshot: () => { appVersion: string; buildTime: string; events: TelemetryEvent[] };
  sinks: TelemetrySink[];
  buffer: RingBufferSink;
  /** Test helpers — not part of the public contract. */
  _resetForTests: () => void;
  _setSinksForTests: (next: TelemetrySink[]) => void;
}

export function createTelemetry(opts: CreateTelemetryOpts): TelemetryHandle {
  const version = opts.version ?? '0.0.0-dev';
  const buildTime = opts.buildTime ?? '';
  const endpoint = opts.endpoint ?? '';
  const shouldRedact = opts.redact ?? true;

  const buffer = new RingBufferSink(RING_LIMIT);
  const sinks: TelemetrySink[] = [buffer];

  // Dev console sink is caller-managed; shared factory keeps only the buffer + beacon.

  if (endpoint && typeof endpoint === 'string' && endpoint.length > 0) {
    try {
      sinks.push(new BeaconSink(endpoint));
    } catch {
      // factory never throws
    }
  }

  let surface = '';

  function setSurface(pathname: string): void {
    try {
      surface = redactPath(pathname);
    } catch {}
  }

  function getSnapshot(): { appVersion: string; buildTime: string; events: TelemetryEvent[] } {
    try {
      const ring = sinks.find(
        (s) => typeof (s as unknown as { snapshot?: unknown }).snapshot === 'function',
      ) as unknown as { snapshot: () => TelemetryEvent[] } | undefined;
      const events = ring ? ring.snapshot() : buffer.snapshot();
      return { appVersion: version, buildTime, events };
    } catch {
      return { appVersion: version, buildTime, events: [] };
    }
  }

  function baseEvent(name: string, level: TelemetryLevel, fields: TelemetryFields): TelemetryEvent {
    const safeFields: TelemetryFields = {};
    for (const [k, v] of Object.entries(fields ?? {})) {
      if (typeof v === 'string' && shouldRedact) {
        safeFields[k] = sanitizeMessage(v).slice(0, 2000);
      } else {
        safeFields[k] = v as string | number | boolean | null | undefined;
      }
    }
    return {
      name,
      level,
      ts: Date.now(),
      surface,
      appVersion: version,
      buildTime,
      fields: safeFields,
    };
  }

  function track(name: string, level: TelemetryLevel = 'info', fields: TelemetryFields = {}): void {
    try {
      const event = baseEvent(name, level, fields);
      for (const s of sinks) {
        try {
          s.emit(event);
        } catch {}
      }
    } catch {}
  }

  function initTelemetry(): void {
    try {
      const g = globalThis as unknown as { __fepTelemetry?: unknown };
      g.__fepTelemetry = {
        buffer,
        track,
        sinks,
        snapshot: () => getSnapshot().events,
        getSnapshot,
      };
      try {
        if (typeof window !== 'undefined' && window.location) {
          setSurface(window.location.pathname || '');
        }
      } catch {}
      if (typeof window !== 'undefined') {
        try {
          Object.defineProperty(window, '__fepTelemetry', {
            configurable: true,
            value: () => getSnapshot(),
          });
        } catch {}
      }
    } catch {}
  }

  function _resetForTests(): void {
    buffer.clear();
    sinks.length = 0;
    sinks.push(buffer);
  }

  function _setSinksForTests(next: TelemetrySink[]): void {
    sinks.length = 0;
    for (const s of next) sinks.push(s);
  }

  return {
    track,
    initTelemetry,
    setSurface,
    getSnapshot,
    sinks,
    buffer,
    _resetForTests,
    _setSinksForTests,
  };
}
