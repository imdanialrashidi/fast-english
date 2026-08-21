// app/src/lib/telemetry/sinks.ts — wrapper delegating to shared telemetry.
// The single source is shared/lib/telemetry/sinks.ts (RING_LIMIT 200, RingBuffer/Beacon/Console).
// This file keeps the import path stable for existing tests while preserving the build boundary.
export * from '../../../../shared/lib/telemetry/sinks';
