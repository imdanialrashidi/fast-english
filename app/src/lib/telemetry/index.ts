// app/src/lib/telemetry/index.ts — thin adapter over the shared telemetry module.
// The deep module is shared/lib/telemetry/create.ts; this file only adds
// app-specific event vocab (FUNNEL_EVENTS, MediaFailure) and funnel helpers.

export { redactPath, sanitizeMessage, truncate } from '../../../../shared/lib/telemetry/redact';

import { createTelemetry as createSharedTelemetry } from '../../../../shared/lib/telemetry/create';
import type { MediaFailureKind, TelemetryLevel } from '../../../../shared/lib/telemetry/events';
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

// Deep module delegation — interface is the test surface; no duplicated baseEvent.
export const track = sharedHandle.track;
export const setSurface = sharedHandle.setSurface;
export const getDiagnosticSnapshot = sharedHandle.getSnapshot;
export const initTelemetry = sharedHandle.initTelemetry;
export const _resetTelemetryForTests = sharedHandle._resetForTests;
export const _setSinksForTests = sharedHandle._setSinksForTests;

// ---------------------------------------------------------------------------
// App-specific funnel / operational helpers (vocab lives here, transport lives in shared).
// ---------------------------------------------------------------------------

export function trackFunnel(name: string, fields: Record<string, unknown> = {}): void {
  track(name, 'info', fields as Record<string, string | number | boolean | null | undefined>);
}

export function reportError(
  err: unknown,
  fields: Record<string, unknown> = {},
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
    } as Record<string, string | number | boolean | null | undefined>);
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

export type { MediaFailureKind } from '../../../../shared/lib/telemetry/events';
export {
  classifyMediaError,
  FUNNEL_EVENTS,
  shouldFireMilestone,
} from '../../../../shared/lib/telemetry/events';
