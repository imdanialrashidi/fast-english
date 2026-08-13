// app/src/lib/telemetry/runtime.ts
// Global runtime instrumentation: uncaught errors, unhandled promise
// rejections, and app/build version diagnostics.
//
// Called once from main.tsx before render. All listeners are wrapped and
// only ever observe — they never mutate or throw.

import { initTelemetry, reportError, setSurface } from './index';

export function instrumentRuntime(): void {
  try {
    initTelemetry();
  } catch {
    // Observability must never break the app.
    return;
  }
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message, { kind: 'uncaught' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, { kind: 'unhandled_rejection' });
  });
}

export { setSurface };
