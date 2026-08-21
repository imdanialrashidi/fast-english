// app/src/lib/telemetry/index.ts — wrapper delegating to shared telemetry.
// Single source is shared/lib/telemetry (sinks, redact, events, create).

export { redactPath, sanitizeMessage, truncate } from '../../../../shared/lib/telemetry/redact';

import { createTelemetry as createSharedTelemetry } from '../../../../shared/lib/telemetry/create';
import type {
  MediaFailureKind,
  TelemetryEvent,
  TelemetryFields,
  TelemetryLevel,
} from '../../../../shared/lib/telemetry/events';
import { redactPath, sanitizeMessage, truncate } from '../../../../shared/lib/telemetry/redact';

declare const __APP_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const APP_VERSION = String(__APP_VERSION__ ?? '0.0.0-dev');
export const BUILD_TIME = String(__BUILD_TIME__ ?? '');

const sharedHandle = createSharedTelemetry({
  version: APP_VERSION,
  buildTime: BUILD_TIME,
  endpoint:
    typeof import.meta !== 'undefined'
      ? (import.meta as unknown as { env?: { VITE_TELEMETRY_ENDPOINT?: string } }).env
          ?.VITE_TELEMETRY_ENDPOINT
      : undefined,
});

let surface = '';

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

export function track(
  name: string,
  level: TelemetryLevel = 'info',
  fields: TelemetryFields = {},
): void {
  try {
    const event = baseEvent(name, level, fields);
    for (const sink of sharedHandle.sinks) {
      try {
        sink.emit(event);
      } catch {}
    }
  } catch {}
}

export function trackFunnel(name: string, fields: TelemetryFields = {}): void {
  track(name, 'info', fields);
}

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
  } catch {}
}

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
  } catch {}
}

export function reportPlayerFailure(
  lessonId: string | null | undefined,
  code: MediaFailureKind,
): void {
  try {
    track('player_failure', 'warn', { lessonId: lessonId ?? '', code });
  } catch {}
}

export function setSurface(pathname: string): void {
  try {
    surface = redactPath(pathname);
  } catch {}
}

export function getDiagnosticSnapshot(): {
  appVersion: string;
  buildTime: string;
  events: TelemetryEvent[];
} {
  try {
    const ring = sharedHandle.sinks.find(
      (s) => typeof (s as unknown as { snapshot?: unknown }).snapshot === 'function',
    ) as unknown as { snapshot: () => TelemetryEvent[] } | undefined;
    const events = ring ? ring.snapshot() : sharedHandle.buffer.snapshot();
    return { appVersion: APP_VERSION, buildTime: BUILD_TIME, events };
  } catch {
    return { appVersion: APP_VERSION, buildTime: BUILD_TIME, events: [] };
  }
}

export function _resetTelemetryForTests(): void {
  sharedHandle.buffer.clear();
  sharedHandle.sinks.length = 0;
}

export function _setSinksForTests(next: typeof sharedHandle.sinks): void {
  sharedHandle.sinks.length = 0;
  for (const s of next) sharedHandle.sinks.push(s);
}

export function initTelemetry(): void {
  try {
    sharedHandle.initTelemetry();
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, '__fepTelemetry', {
        configurable: true,
        value: () => getDiagnosticSnapshot(),
      });
    }
  } catch {}
}

export type { MediaFailureKind } from '../../../../shared/lib/telemetry/events';
export {
  classifyMediaError,
  FUNNEL_EVENTS,
  shouldFireMilestone,
} from '../../../../shared/lib/telemetry/events';
