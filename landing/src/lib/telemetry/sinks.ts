// landing/src/lib/telemetry/sinks.ts
// Telemetry sinks for the landing surface — the same contract as the
// Student App (`app/src/lib/telemetry/sinks.ts`), implemented locally so
// the landing stays a fully separate build surface (no cross-surface
// imports, per shared/build-boundary.test.ts).
//
// Default sink: bounded in-memory ring buffer (zero network egress).
// A batching `sendBeacon` sink is attached only when
// `VITE_TELEMETRY_ENDPOINT` is set at build time (off by default —
// the production endpoint decision belongs to the owner, see
// docs/OBSERVABILITY.md). Every sink is failure-isolated: telemetry can
// never throw or change page behavior.

import type { TelemetryEvent } from './events';

export interface TelemetrySink {
  emit(event: TelemetryEvent): void;
}

/** Bounded in-memory ring buffer; the default sink. */
export class RingBufferSink implements TelemetrySink {
  private readonly buffer: TelemetryEvent[] = [];
  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  emit(event: TelemetryEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.limit) {
      this.buffer.splice(0, this.buffer.length - this.limit);
    }
  }

  /** Read-only snapshot for support sessions / tests. */
  snapshot(): TelemetryEvent[] {
    return this.buffer.slice();
  }
}

/** Development-only console sink (never active in production builds). */
export class ConsoleSink implements TelemetrySink {
  private readonly verbose: boolean;

  constructor(verbose: boolean) {
    this.verbose = verbose;
  }

  emit(event: TelemetryEvent): void {
    if (this.verbose) {
      console.debug('[fep-landing]', event.name, event.fields);
    }
  }
}

/**
 * Optional batched beacon sink (used only when VITE_TELEMETRY_ENDPOINT
 * is configured at build time). Batches ≤20 events as a `text/plain`
 * POST (preflight-free) and flushes on `pagehide`/`visibilitychange`
 * hidden and every 30 s. Failures are swallowed.
 */
export class BeaconSink implements TelemetrySink {
  private readonly endpoint: string;
  private readonly batch: TelemetryEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(endpoint: string) {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('telemetry endpoint must be http(s)');
    }
    this.endpoint = parsed.toString();
    this.attachPageLifetimeHooks();
  }

  emit(event: TelemetryEvent): void {
    this.batch.push(event);
    if (this.batch.length >= 20) {
      this.flush();
      return;
    }
    if (this.timer === null) {
      this.timer = setInterval(() => this.flush(), 30_000);
    }
  }

  private attachPageLifetimeHooks(): void {
    if (typeof window === 'undefined') return;
    const flush = () => this.flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  private flush(): void {
    if (this.batch.length === 0) return;
    const payload = this.batch.splice(0);
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    try {
      const body = payload.map((e) => JSON.stringify(e)).join('\n');
      navigator.sendBeacon(this.endpoint, new Blob([body], { type: 'text/plain' }));
    } catch {
      // A failed flush must never affect the page.
    }
  }
}
