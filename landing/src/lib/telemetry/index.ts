// landing/src/lib/telemetry/index.ts — wrapper delegating to shared telemetry.
// Single source is shared/lib/telemetry (sinks, create) while keeping landing's acquisition event names.

export type { CtaPlace, TelemetryEvent, TelemetryFields, TelemetryLevel } from './events';
export { ACQUISITION_EVENTS, CTA_PLACES, redactPath } from './events';

import { createTelemetry as createSharedTelemetry } from '../../../../shared/lib/telemetry/create';
import type { CtaPlace, TelemetryEvent, TelemetryFields, TelemetryLevel } from './events';
import { ACQUISITION_EVENTS, redactPath } from './events';

declare const __LANDING_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const LANDING_VERSION = String(__LANDING_VERSION__ ?? '0.0.0-dev');
export const BUILD_TIME = String(__BUILD_TIME__ ?? '');

const sharedHandle = createSharedTelemetry({
  version: LANDING_VERSION,
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
    appVersion: LANDING_VERSION,
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

export function trackAcquisition(name: string, fields: TelemetryFields = {}): void {
  track(name, 'info', fields);
}

export function trackSignupIntent(place: CtaPlace): void {
  trackAcquisition(ACQUISITION_EVENTS.signupIntent, { where: place });
}

export function trackInstallIntent(): void {
  trackAcquisition(ACQUISITION_EVENTS.installIntent, {});
}

export function trackDownloadIntent(): void {
  trackAcquisition(ACQUISITION_EVENTS.downloadIntent, {});
}

export function trackCollaborationIntent(): void {
  trackAcquisition(ACQUISITION_EVENTS.collaborationIntent, {});
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
    return { appVersion: LANDING_VERSION, buildTime: BUILD_TIME, events };
  } catch {
    return { appVersion: LANDING_VERSION, buildTime: BUILD_TIME, events: [] };
  }
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

export function _resetTelemetryForTests(): void {
  sharedHandle.buffer.clear();
  sharedHandle.sinks.length = 0;
}

export function _setSinksForTests(next: typeof sharedHandle.sinks): void {
  sharedHandle.sinks.length = 0;
  for (const s of next) sharedHandle.sinks.push(s);
}
