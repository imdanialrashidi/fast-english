// app/src/features/episode/logic.ts
// Slice 7 — pure derivations for the Episode surface (Record Jacket).
//
// Everything here is deterministic and unit-tested; components stay thin.
// Domain rules mirror the accepted design contract (docs/DESIGN.md):
//   - the Edition Rail renders the full CEFR ladder and intersects it with
//     the server-provided published levels (disabled = honest absence);
//   - the Deck's primary control label derives from the Variant's saved
//     Progress (never from live playback position);
//   - pronunciation prefers the uploaded file, falls back to English
//     device/browser speech synthesis, otherwise is honestly unavailable.

import { type CefrLevel, cefrLevels } from '../../../../shared/ui/tokens/cefr';
import { productCopy } from '../../app/copy/productCopy';
import type { AvailableLevelEntry } from '../lessons/types';
import { formatClock } from '../podcast/components/EpisodeCard';

// ---------------------------------------------------------------------------
// Edition Rail
// ---------------------------------------------------------------------------

export interface EditionRailEntry {
  level: CefrLevel;
  /** Published Variant id; null when the level has no published Variant. */
  variantId: string | null;
  isRecommended: boolean;
  isPreferred: boolean;
}

/**
 * Full A1–C2 ladder intersected with the server's published levels
 * (availableLevels). Unpublished levels render as honest disabled plates —
 * never invented "coming soon" states, never removed from the ladder.
 */
export function buildEditionRail(
  availableLevels: AvailableLevelEntry[] | undefined,
): EditionRailEntry[] {
  const byLevel = new Map<string, AvailableLevelEntry>();
  for (const entry of availableLevels ?? []) {
    byLevel.set(entry.level, entry);
  }
  return cefrLevels.map((level) => {
    const published = byLevel.get(level);
    return published
      ? {
          level,
          variantId: published.variantId,
          isRecommended: published.isRecommended,
          isPreferred: published.isPreferred,
        }
      : { level, variantId: null, isRecommended: false, isPreferred: false };
  });
}

/** The rail entry for a given Variant id (used to name the in-flight switch). */
export function railEntryForVariant(
  entries: EditionRailEntry[],
  variantId: string | undefined,
): EditionRailEntry | null {
  if (!variantId) return null;
  return entries.find((entry) => entry.variantId === variantId) ?? null;
}

// ---------------------------------------------------------------------------
// Deck primary control (CTA)
// ---------------------------------------------------------------------------

export type DeckCtaKind = 'start' | 'resume' | 'play' | 'review' | 'pause';

export interface DeckCtaState {
  kind: DeckCtaKind;
  /** Visible label / accessible name of the primary control. */
  label: string;
  /** resume only: saved position (seconds) to seek to before playing. */
  resumePositionSeconds?: number;
}

export interface DeckProgressInput {
  completed: boolean;
  positionSeconds: number;
}

/**
 * Accepted CTA contract (docs/DESIGN.md — "The Deck"):
 *   playing → pause icon; completed → «مرور دوباره» (plays from 0);
 *   in_progress ≥5s → «ادامه از HH:MM» (plays from the saved position);
 *   in_progress <5s → «پخش»; not started → «شروع گوشدادن».
 * The label derives from the saved Progress only — never from the live
 * playback position — so a mid-session pause can never invent a resume point.
 */
export function deriveDeckCta(opts: {
  progress: DeckProgressInput | null;
  isPlaying: boolean;
}): DeckCtaState {
  if (opts.isPlaying) {
    return { kind: 'pause', label: 'توقف' };
  }
  const p = opts.progress;
  if (p?.completed) {
    return { kind: 'review', label: productCopy.actions.reviewAgain };
  }
  if (p && p.positionSeconds >= 5) {
    return {
      kind: 'resume',
      label: productCopy.actions.continueFrom(formatClock(p.positionSeconds)),
      resumePositionSeconds: p.positionSeconds,
    };
  }
  if (p && p.positionSeconds > 0) {
    return { kind: 'play', label: productCopy.episodeSurface.play };
  }
  return { kind: 'start', label: productCopy.actions.startListening };
}

// ---------------------------------------------------------------------------
// Pronunciation fallback chain
// ---------------------------------------------------------------------------

/**
 * Pick the best English voice for TTS pronunciation: prefer en-US, then
 * en-GB, then any English voice; null when the device has none (→ honest
 * unavailable state).
 */
export function pickEnglishVoice(
  voices: readonly SpeechSynthesisVoice[] | SpeechSynthesisVoice[] | undefined | null,
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (english.length === 0) return null;
  const exact = (lang: string) => english.find((v) => v.lang.toLowerCase() === lang);
  return exact('en-us') ?? exact('en-gb') ?? english[0] ?? null;
}

/** True when the platform exposes speech synthesis AND an English voice. */
export function canUseTts(
  synthesis: SpeechSynthesis | undefined | null,
  voices: readonly SpeechSynthesisVoice[] | SpeechSynthesisVoice[] | undefined | null,
): boolean {
  if (!synthesis) return false;
  return pickEnglishVoice(voices) !== null;
}

/**
 * Resolve an English TTS voice, waiting for async voice loading.
 *
 * Voices load asynchronously: `getVoices()` can be empty until the
 * `voiceschanged` event fires. Waiting for a real voice is the honest
 * loading state — an instant "unavailable" would lie about voices that
 * exist but have not arrived yet (and would stick for the session).
 *
 * Contract (accepted pronunciation fallback):
 *   - an English voice already present resolves immediately;
 *   - otherwise the promise waits for `voiceschanged` to deliver an
 *     English voice (checked on every event);
 *   - the accepted timeout still produces the honest unavailable state
 *     (resolve with whatever exists — null when nothing arrived).
 */
export function waitForEnglishVoice(
  synth: SpeechSynthesis,
  timeoutMs = 2500,
): Promise<SpeechSynthesisVoice | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (voice: SpeechSynthesisVoice | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(voice);
    };
    const onVoicesChanged = () => {
      const voice = pickEnglishVoice(synth.getVoices());
      if (voice) finish(voice);
    };
    const timer = setTimeout(() => finish(pickEnglishVoice(synth.getVoices())), timeoutMs);
    synth.addEventListener('voiceschanged', onVoicesChanged);
    // Immediate resolution ONLY when an English voice already exists;
    // an empty list must not settle the promise (the listener above is
    // the honest wait for the real voices to arrive).
    const initial = pickEnglishVoice(synth.getVoices());
    if (initial) finish(initial);
  });
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** One-open-at-a-time expansion is list-level state; this keeps the contract pure. */
export function nextOpenId(current: string | null, requested: string): string | null {
  return current === requested ? null : requested;
}

export function vocabularyHeading(count: number): string {
  return productCopy.episodeSurface.vocabularySection(count);
}
