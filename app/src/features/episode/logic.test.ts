// app/src/features/episode/logic.test.ts
// Slice 7 — pure derivations for the Episode surface.

import { describe, expect, it, vi } from 'vitest';
import { cefr, cefrLevels, deckStripeColor } from '../../../../shared/ui/tokens/cefr';
import {
  buildEditionRail,
  canUseTts,
  deriveDeckCta,
  nextOpenId,
  pickEnglishVoice,
  railEntryForVariant,
  vocabularyHeading,
  waitForEnglishVoice,
} from './logic';

describe('deckStripeColor', () => {
  // Slice 7 contract: the edition stripe clears ≥3:1 against the Deck
  // surface in both schemes (enforced durably in palette.contrast.test.ts);
  // here we pin the scheme mapping itself: the dark pair foreground in
  // Light, the pale pair background in Dark — only existing CEFR colors.
  it('uses the CEFR pair foreground in Light and background in Dark for every level', () => {
    for (const level of cefrLevels) {
      expect(deckStripeColor(level, 'light')).toBe(cefr[level].fg);
      expect(deckStripeColor(level, 'dark')).toBe(cefr[level].bg);
      expect(deckStripeColor(level, 'light')).not.toBe(deckStripeColor(level, 'dark'));
    }
  });
});

describe('buildEditionRail', () => {
  it('renders the full A1–C2 ladder with published Variants from the server', () => {
    const rail = buildEditionRail([
      { level: 'B1', variantId: 'v-b1', available: true, isRecommended: true, isPreferred: false },
      { level: 'C1', variantId: 'v-c1', available: true, isRecommended: false, isPreferred: false },
    ]);
    expect(rail.map((e) => e.level)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    expect(rail.find((e) => e.level === 'B1')).toEqual({
      level: 'B1',
      variantId: 'v-b1',
      isRecommended: true,
      isPreferred: false,
    });
    // Unpublished levels are honest disabled plates (variantId null), never
    // invented "coming soon" states.
    expect(rail.find((e) => e.level === 'A1')).toEqual({
      level: 'A1',
      variantId: null,
      isRecommended: false,
      isPreferred: false,
    });
  });

  it('handles an empty/missing server list (single Variant Episode)', () => {
    expect(buildEditionRail(undefined)).toHaveLength(6);
    expect(buildEditionRail([]).every((e) => e.variantId === null)).toBe(true);
  });
});

describe('railEntryForVariant', () => {
  it('finds the entry of the in-flight switch target', () => {
    const rail = buildEditionRail([
      { level: 'B1', variantId: 'v-b1', available: true, isRecommended: false, isPreferred: true },
    ]);
    expect(railEntryForVariant(rail, 'v-b1')?.level).toBe('B1');
    expect(railEntryForVariant(rail, 'missing')).toBeNull();
    expect(railEntryForVariant(rail, undefined)).toBeNull();
  });
});

describe('deriveDeckCta (accepted CTA contract)', () => {
  it('playing → pause icon', () => {
    expect(deriveDeckCta({ progress: null, isPlaying: true })).toEqual({
      kind: 'pause',
      label: 'توقف',
    });
  });

  it('completed → «مرور دوباره» regardless of position', () => {
    const cta = deriveDeckCta({
      progress: { completed: true, positionSeconds: 600 },
      isPlaying: false,
    });
    expect(cta.kind).toBe('review');
    expect(cta.label).toBe('مرور دوباره');
    expect(cta.resumePositionSeconds).toBeUndefined();
  });

  it('in_progress ≥5s → «ادامه از HH:MM» with the saved position to seek', () => {
    const cta = deriveDeckCta({
      progress: { completed: false, positionSeconds: 150 },
      isPlaying: false,
    });
    expect(cta.kind).toBe('resume');
    expect(cta.label).toBe('ادامه از 2:30');
    expect(cta.resumePositionSeconds).toBe(150);
  });

  it('in_progress <5s → «پخش» (no invented resume point)', () => {
    const cta = deriveDeckCta({
      progress: { completed: false, positionSeconds: 3 },
      isPlaying: false,
    });
    expect(cta.kind).toBe('play');
    expect(cta.label).toBe('پخش');
    expect(cta.resumePositionSeconds).toBeUndefined();
  });

  it('not started → «شروع گوشدادن»', () => {
    const cta = deriveDeckCta({ progress: null, isPlaying: false });
    expect(cta.kind).toBe('start');
    expect(cta.label).toBe('شروع گوش‌دادن');
  });
});

describe('pronunciation fallback chain', () => {
  const voice = (lang: string, name: string) =>
    ({ lang, name, default: false, localService: false, voiceURI: name }) as SpeechSynthesisVoice;

  it('prefers en-US, then en-GB, then any English voice', () => {
    const voices = [voice('fr-FR', 'fr'), voice('en-GB', 'gb'), voice('en-US', 'us')];
    expect(pickEnglishVoice(voices)?.lang).toBe('en-US');
    expect(pickEnglishVoice([voice('fr-FR', 'fr'), voice('en-GB', 'gb')])?.lang).toBe('en-GB');
    expect(pickEnglishVoice([voice('en-AU', 'au')])?.lang).toBe('en-AU');
    expect(pickEnglishVoice([voice('fr-FR', 'fr')])).toBeNull();
    expect(pickEnglishVoice([])).toBeNull();
    expect(pickEnglishVoice(null)).toBeNull();
  });

  it('canUseTts requires both the platform API and an English voice', () => {
    const synth = {} as SpeechSynthesis;
    expect(canUseTts(synth, [voice('en-US', 'us')])).toBe(true);
    expect(canUseTts(synth, [voice('fr-FR', 'fr')])).toBe(false);
    expect(canUseTts(synth, [])).toBe(false);
    expect(canUseTts(null, [voice('en-US', 'us')])).toBe(false);
  });
});

describe('waitForEnglishVoice (async voiceschanged fallback)', () => {
  const voice = (lang: string, name: string) =>
    ({ lang, name, default: false, localService: false, voiceURI: name }) as SpeechSynthesisVoice;

  // A controllable SpeechSynthesis fake: the test decides when voices
  // arrive and can fire `voiceschanged` on demand.
  function fakeSynth(initialVoices: SpeechSynthesisVoice[] = []) {
    let voices = [...initialVoices];
    const listeners: Record<string, () => void> = {};
    return {
      synth: {
        getVoices: () => voices,
        addEventListener: (type: string, cb: () => void) => {
          listeners[type] = cb;
        },
        removeEventListener: (type: string) => {
          delete listeners[type];
        },
      } as unknown as SpeechSynthesis,
      setVoices(next: SpeechSynthesisVoice[]) {
        voices = [...next];
        listeners.voiceschanged?.();
      },
      hasListener: (type: string) => Boolean(listeners[type]),
    };
  }

  it('waits for an English voice arriving later via voiceschanged (regression: old code resolved null immediately)', async () => {
    vi.useFakeTimers();
    try {
      const { synth, setVoices } = fakeSynth();
      let resolved: 'pending' | SpeechSynthesisVoice | null = 'pending';
      waitForEnglishVoice(synth).then((v) => {
        resolved = v;
      });
      // The promise must NOT settle while getVoices() is still empty —
      // the old immediate-null behavior fails this assertion.
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).toBe('pending');
      // Voices arrive asynchronously (the browser fires voiceschanged).
      setVoices([voice('fr-FR', 'fr'), voice('en-US', 'us')]);
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved === 'pending').toBe(false);
      expect((resolved as unknown as SpeechSynthesisVoice | null)?.lang).toBe('en-US');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves immediately when an English voice already exists', async () => {
    const { synth } = fakeSynth([voice('en-GB', 'gb')]);
    const result = await waitForEnglishVoice(synth);
    expect(result?.lang).toBe('en-GB');
  });

  it('the accepted timeout still produces the honest unavailable state', async () => {
    vi.useFakeTimers();
    try {
      const { synth, hasListener } = fakeSynth();
      let resolved: 'pending' | SpeechSynthesisVoice | null = 'pending';
      waitForEnglishVoice(synth, 2500).then((v) => {
        resolved = v;
      });
      // Non-English voices arriving do not satisfy the wait.
      await vi.advanceTimersByTimeAsync(1000);
      expect(resolved).toBe('pending');
      await vi.advanceTimersByTimeAsync(1500);
      expect(resolved).toBeNull();
      expect(hasListener('voiceschanged')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores non-English voices and keeps waiting for an English one', async () => {
    vi.useFakeTimers();
    try {
      const { synth, setVoices } = fakeSynth();
      let resolved: 'pending' | SpeechSynthesisVoice | null = 'pending';
      waitForEnglishVoice(synth).then((v) => {
        resolved = v;
      });
      setVoices([voice('fr-FR', 'fr')]);
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).toBe('pending');
      setVoices([voice('fr-FR', 'fr'), voice('en-AU', 'au')]);
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved === 'pending').toBe(false);
      expect((resolved as unknown as SpeechSynthesisVoice | null)?.lang).toBe('en-AU');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('vocabulary expansion + heading', () => {
  it('toggles one open row at a time', () => {
    expect(nextOpenId(null, 'a')).toBe('a');
    expect(nextOpenId('a', 'a')).toBe(null);
    expect(nextOpenId('a', 'b')).toBe('b');
  });

  it('headings carry the real count', () => {
    expect(vocabularyHeading(3)).toBe('کلمات کلیدی · 3');
  });
});
