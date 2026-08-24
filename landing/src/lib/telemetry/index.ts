// landing/src/lib/telemetry/index.ts — thin adapter over the shared telemetry module.
// Keeps only landing acquisition vocab; transport, redaction, and ring live in shared.

export { redactPath } from '../../../../shared/lib/telemetry/redact';
export type { CtaPlace, TelemetryEvent, TelemetryFields, TelemetryLevel } from './events';
export { ACQUISITION_EVENTS, CTA_PLACES } from './events';

import { createTelemetry as createSharedTelemetry } from '../../../../shared/lib/telemetry/create';
import type { CtaPlace, TelemetryFields } from './events';
import { ACQUISITION_EVENTS } from './events';

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

export const track = sharedHandle.track;
export const setSurface = sharedHandle.setSurface;
export const getDiagnosticSnapshot = sharedHandle.getSnapshot;
export const initTelemetry = sharedHandle.initTelemetry;
export const _resetTelemetryForTests = sharedHandle._resetForTests;
export const _setSinksForTests = sharedHandle._setSinksForTests;

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
