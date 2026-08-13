// app/src/lib/telemetry/telemetry-env.d.ts
// Build-time telemetry globals (injected by vite.app.config.ts `define`).
declare const __APP_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

interface ImportMetaEnv {
  /** Optional production telemetry endpoint (sendBeacon sink). Off by
   *  default — see docs/OBSERVABILITY.md. */
  readonly VITE_TELEMETRY_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /** Read-only diagnostic snapshot for support sessions. */
  __fepTelemetry?: () => {
    appVersion: string;
    buildTime: string;
    events: unknown[];
  };
}
