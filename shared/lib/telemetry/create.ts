// shared/lib/telemetry/create.ts
// Factory for telemetry facade — single source for app and landing.
// Keeps RING_LIMIT, RingBuffer/Beacon/Console sinks, and window.__fepTelemetry shape in one place.
// Privacy: all fields pass through sanitize before buffering/beacon.

import type { TelemetryEvent, TelemetryFields, TelemetryLevel } from './events';
import { sanitizeMessage } from './redact';
import { BeaconSink, RingBufferSink, type TelemetrySink } from './sinks';

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
  sinks: TelemetrySink[];
  buffer: RingBufferSink;
}

export function createTelemetry(opts: CreateTelemetryOpts): TelemetryHandle {
  const version = opts.version ?? '0.0.0-dev';
  const buildTime = opts.buildTime ?? '';
  const endpoint = opts.endpoint ?? '';
  const shouldRedact = opts.redact ?? true;

  const buffer = new RingBufferSink(200);
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
        snapshot: () => buffer.snapshot(),
      };
      // Mirror previous behaviour: set surface from window location if available
      try {
        if (typeof window !== 'undefined' && window.location) {
          surface = window.location.pathname || '';
        }
      } catch {}
    } catch {}
  }

  return { track, initTelemetry, sinks, buffer };
}
