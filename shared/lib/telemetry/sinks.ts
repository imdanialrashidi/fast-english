// shared/lib/telemetry/sinks.ts
// Shared telemetry sinks — single source for Bounded ring buffer + Beacon + Console.
// Used by both app and landing via factory (shared/lib/telemetry/create.ts).
// RING_LIMIT 200 is the privacy/boundedness contract.

import type { TelemetryEvent } from './events';

export const RING_LIMIT = 200;

export interface TelemetrySink {
  readonly name?: string;
  emit(event: TelemetryEvent): void;
  flush?(): void;
}

export class RingBufferSink implements TelemetrySink {
  readonly name = 'ring-buffer';
  private readonly events: TelemetryEvent[] = [];

  constructor(private readonly limit: number = RING_LIMIT) {}

  emit(event: TelemetryEvent): void {
    this.events.push(event);
    if (this.events.length > this.limit) {
      this.events.splice(0, this.events.length - this.limit);
    }
  }

  snapshot(): TelemetryEvent[] {
    return this.events.map((e) => ({ ...e, fields: { ...e.fields } }));
  }

  clear(): void {
    this.events.length = 0;
  }
}

export class ConsoleSink implements TelemetrySink {
  readonly name = 'console';
  constructor(private readonly enabled: boolean) {}
  emit(event: TelemetryEvent): void {
    if (!this.enabled) return;
    // eslint-disable-next-line no-console
    console.debug(`[telemetry:${event.level}] ${event.name}`, event.fields);
  }
}

export class BeaconSink implements TelemetrySink {
  readonly name = 'beacon';
  private batch: TelemetryEvent[] = [];
  private readonly endpoint: string;
  private readonly maxBatch: number;
  private timer: number | null = null;
  private readonly flushOnHide = () => this.flush();
  private readonly flushOnVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') this.flush();
  };

  constructor(endpoint: string, opts: { maxBatch?: number; flushIntervalMs?: number } = {}) {
    this.endpoint = endpoint;
    this.maxBatch = opts.maxBatch ?? 20;
    const flushIntervalMs = opts.flushIntervalMs ?? 30_000;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      this.timer = window.setInterval(() => this.flush(), flushIntervalMs);
      window.addEventListener('pagehide', this.flushOnHide);
      document.addEventListener('visibilitychange', this.flushOnVisibility);
    }
  }

  emit(event: TelemetryEvent): void {
    this.batch.push(event);
    if (this.batch.length >= this.maxBatch) this.flush();
  }

  flush(): void {
    if (this.batch.length === 0) return;
    const payload = JSON.stringify(this.batch);
    this.batch = [];
    try {
      if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
      const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
      navigator.sendBeacon(this.endpoint, blob);
    } catch {
      // swallow
    }
  }

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
