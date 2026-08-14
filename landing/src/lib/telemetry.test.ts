// landing/src/lib/telemetry.test.ts
// Contract tests for the landing acquisition-telemetry facade:
//   1. events are one-shot acquisition intents with no PII — the only
//      field values are fixed site identifiers and redacted surfaces;
//   2. failure isolation — telemetry never throws, broken sinks are
//      isolated, ring buffer stays bounded;
//   3. the default sink is the in-memory ring buffer (no network).
import { afterEach, describe, expect, it } from 'vitest';
import {
  _resetTelemetryForTests,
  _setSinksForTests,
  ACQUISITION_EVENTS,
  CTA_PLACES,
  getDiagnosticSnapshot,
  redactPath,
  setSurface,
  track,
  trackCollaborationIntent,
  trackDownloadIntent,
  trackInstallIntent,
  trackSignupIntent,
} from './telemetry';
import { RingBufferSink, type TelemetrySink } from './telemetry/sinks';

function capture(): RingBufferSink {
  const sink = new RingBufferSink(200);
  _setSinksForTests([sink]);
  return sink;
}

afterEach(() => {
  _resetTelemetryForTests();
});

describe('acquisition event vocabulary', () => {
  it('exposes the documented landing acquisition events', () => {
    expect(ACQUISITION_EVENTS).toEqual({
      routeChange: 'route_change',
      signupIntent: 'signup_intent',
      installIntent: 'install_intent',
      downloadIntent: 'download_intent',
      collaborationIntent: 'collaboration_intent',
    });
    // Shared with the Student App contract where the names overlap.
    expect(ACQUISITION_EVENTS.routeChange).toBe('route_change');
    expect(ACQUISITION_EVENTS.installIntent).toBe('install_intent');
  });

  it('CTA places are fixed identifiers, never free text', () => {
    const places = Object.values(CTA_PLACES);
    expect(places.length).toBeGreaterThanOrEqual(9);
    for (const place of places) {
      expect(place).toMatch(/^[a-z-]+$/);
    }
  });
});

describe('redactPath', () => {
  it('keeps only the pathname, stripping query/hash', () => {
    expect(redactPath('/install?utm_source=test#top')).toBe('/install');
    expect(redactPath('/')).toBe('/');
  });

  it('falls back safely on malformed input', () => {
    expect(redactPath('')).toBe('/');
  });
});

describe('acquisition intents', () => {
  it('tracks signup intent with the fixed CTA place and no PII fields', () => {
    const sink = capture();
    setSurface('/');
    trackSignupIntent(CTA_PLACES.hero);
    const events = sink.snapshot();
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('signup_intent');
    expect(events[0].surface).toBe('/');
    expect(events[0].fields).toEqual({ where: 'hero' });
  });

  it('tracks install, download and collaboration intents with no fields', () => {
    const sink = capture();
    trackInstallIntent();
    trackDownloadIntent();
    trackCollaborationIntent();
    const names = sink.snapshot().map((e) => e.name);
    expect(names).toEqual(['install_intent', 'download_intent', 'collaboration_intent']);
  });

  it('never forwards the incoming query string into events', () => {
    // Campaign params are preserved only on the app CTA href
    // (lib/campaign.ts); telemetry events must never carry them.
    const sink = capture();
    setSurface('/?utm_campaign=launch&ref=partner');
    trackSignupIntent(CTA_PLACES.header);
    const event = sink.snapshot()[0];
    expect(event.surface).toBe('/');
    expect(JSON.stringify(event)).not.toMatch(/utm_|ref|partner|launch/);
  });

  it('route_change carries the redacted surface', () => {
    const sink = capture();
    setSurface('/how-it-works?x=1');
    track(ACQUISITION_EVENTS.routeChange, 'info', {});
    const event = sink.snapshot()[0];
    expect(event.name).toBe('route_change');
    expect(event.surface).toBe('/how-it-works');
  });
});

describe('failure isolation and ring buffer', () => {
  it('a throwing sink never breaks other sinks or the facade', () => {
    const sink = capture();
    const broken: TelemetrySink = {
      emit: () => {
        throw new Error('sink exploded');
      },
    };
    _setSinksForTests([broken, sink]);
    expect(() => track('signup_intent', 'info', { where: 'hero' })).not.toThrow();
    expect(sink.snapshot()).toHaveLength(1);
  });

  it('the diagnostic snapshot returns the captured events', () => {
    const sink = capture();
    trackSignupIntent(CTA_PLACES.final);
    const snapshot = getDiagnosticSnapshot();
    expect(snapshot.events).toEqual(sink.snapshot());
    expect(snapshot.appVersion).toBeTruthy();
  });

  it('ring buffer stays bounded at the configured limit', () => {
    const sink = new RingBufferSink(5);
    _setSinksForTests([sink]);
    for (let i = 0; i < 50; i += 1) {
      track('signup_intent', 'info', { where: 'hero' });
    }
    expect(sink.snapshot()).toHaveLength(5);
  });
});
