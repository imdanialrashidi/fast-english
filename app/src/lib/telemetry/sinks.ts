// app/src/lib/telemetry/sinks.ts
// Telemetry sinks: where events go once they leave the app boundary.
//
// Default: a bounded in-memory ring buffer (zero network, zero cost).
// Optional: a sendBeacon sink gated at BUILD TIME by
// VITE_TELEMETRY_ENDPOINT (off by default — no vendor SDK, no endpoint
// decision made yet; see docs/OBSERVABILITY.md).
//
// Every sink is failure-isolated: a throwing sink can never break the
// Student experience (the facade wraps each sink in try/catch).

import type { TelemetryEvent } from './events';

export interface TelemetrySink {
  readonly name: string;
  emit(event: TelemetryEvent): void;
  flush?(): void;
}

/** Bounded in-memory ring buffer. Default sink: gives support sessions a
 *  structured, redacted window into recent client events without any
 *  network egress. */
export class RingBufferSink implements TelemetrySink {
  readonly name = 'ring-buffer';
  private readonly events: TelemetryEvent[] = [];

  constructor(private readonly limit: number) {}

  emit(event: TelemetryEvent): void {
    this.events.push(event);
    if (this.events.length > this.limit) {
      this.events.splice(0, this.events.length - this.limit);
    }
  }

  /** Copy of the buffered events (never the live array or live objects). */
  snapshot(): TelemetryEvent[] {
    return this.events.map((e) => ({ ...e, fields: { ...e.fields } }));
  }

  clear(): void {
    this.events.length = 0;
  }
}

/** Dev-oriented console sink (no-op outside DEV builds). */
export class ConsoleSink implements TelemetrySink {
  readonly name = 'console';

  constructor(private readonly enabled: boolean) {}

  emit(event: TelemetryEvent): void {
    if (!this.enabled) return;
    // eslint-disable-next-line no-console
    console.debug(`[telemetry:${event.level}] ${event.name}`, event.fields, {
      surface: event.surface,
      appVersion: event.appVersion,
      buildTime: event.buildTime,
    });
  }
}

/** sendBeacon-based network sink, only constructed when a production
 *  endpoint is configured (VITE_TELEMETRY_ENDPOINT). Batches events and
 *  flushes on `pagehide`/hidden and on a bounded interval. Failure is
 *  swallowed — telemetry must never affect the app. */
export class BeaconSink implements TelemetrySink {
  readonly name = 'beacon';
  private batch: TelemetryEvent[] = [];
  private readonly endpoint: string;
  private readonly maxBatch: number;
  private timer: number | null = null;
  private readonly flushOnHide = () => this.flush();
  private readonly flushOnVisibility = () => {
    if (document.visibilityState === 'hidden') this.flush();
  };

  constructor(endpoint: string, { maxBatch = 20, flushIntervalMs = 30_000 } = {}) {
    this.endpoint = endpoint;
    this.maxBatch = maxBatch;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      this.timer = window.setInterval(() => this.flush(), flushIntervalMs);
      window.addEventListener('pagehide', this.flushOnHide);
      document.addEventListener('visibilitychange', this.flushOnVisibility);
    }
  }

  emit(event: TelemetryEvent): void {
    this.batch.push(event);
    if (this.batch.length >= this.maxBatch) {
      this.flush();
    }
  }

  flush(): void {
    if (this.batch.length === 0) return;
    const payload = JSON.stringify(this.batch);
    this.batch = [];
    try {
      if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
      // Blob with text/plain keeps CORS preflight-free for simple
      // endpoints (sendBeacon with a string body is also fine).
      const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
      navigator.sendBeacon(this.endpoint, blob);
    } catch {
      // Telemetry failures are invisible to the app.
    }
  }

  /** Test/diagnostic access. */
  pendingCount(): number {
    return this.batch.length;
  }

  dispose(): void {
    if (this.timer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.timer);
      window.removeEventListener('pagehide', this.flushOnHide);
      document.removeEventListener('visibilitychange', this.flushOnVisibility);
    }
  }
}
