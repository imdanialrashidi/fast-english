// app/src/lib/telemetry/events.ts
// Telemetry event shapes + pure decision helpers.
//
// The event vocabulary is deliberately small (see docs/OBSERVABILITY.md):
// funnel events are one-shot, user-meaningful moments — never per-render,
// per-second or per-save telemetry.

export type TelemetryLevel = 'info' | 'warn' | 'error';

export type TelemetryFields = Record<string, string | number | boolean | null | undefined>;

export interface TelemetryEvent {
  /** Stable event name, e.g. `episode_started`. */
  name: string;
  level: TelemetryLevel;
  /** Epoch milliseconds. */
  ts: number;
  /** Redacted route surface the event happened on ('' when unknown). */
  surface: string;
  appVersion: string;
  buildTime: string;
  fields: TelemetryFields;
}

// ---------------------------------------------------------------------------
// Funnel / listening event names (the full contract lives in
// docs/OBSERVABILITY.md — keep both in sync).
// ---------------------------------------------------------------------------

export const FUNNEL_EVENTS = {
  routeChange: 'route_change',
  signupCompleted: 'signup_completed',
  paymentRequestSubmitted: 'payment_request_submitted',
  placementSubmitted: 'placement_submitted',
  levelSelected: 'level_selected',
  episodeStarted: 'episode_started',
  listeningMilestone: 'listening_milestone',
  episodeCompleted: 'episode_completed',
  installIntent: 'install_intent',
} as const;

// ---------------------------------------------------------------------------
// Listening milestone decision (pure, unit-tested).
// ---------------------------------------------------------------------------

export type MilestoneResult = '50' | null;

/**
 * Decide whether a listening milestone should be emitted for this
 * position. Fires once per lesson session at the 50% crossing; returns
 * null for everything else (including already-fired milestones and
 * unknown durations).
 */
export function shouldFireMilestone(
  positionSeconds: number,
  durationSeconds: number,
  fired: boolean,
): MilestoneResult {
  if (fired) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) return null;
  if (positionSeconds / durationSeconds >= 0.5) return '50';
  return null;
}

/** Media error classification (operationally useful, no URLs or messages —
 *  `MediaError.message` can embed the failed URL and is never captured). */
export type MediaFailureKind =
  | 'media_err_aborted'
  | 'media_err_network'
  | 'media_err_decode'
  | 'media_err_src_not_supported'
  | 'media_err_unknown';

export function classifyMediaError(code: number | undefined | null): MediaFailureKind {
  switch (code) {
    case 1:
      return 'media_err_aborted';
    case 2:
      return 'media_err_network';
    case 3:
      return 'media_err_decode';
    case 4:
      return 'media_err_src_not_supported';
    default:
      return 'media_err_unknown';
  }
}
