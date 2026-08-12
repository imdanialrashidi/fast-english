// app/src/features/episode/pronunciationPlayback.ts
// Slice 7 — word-scoped pronunciation clip playback.
//
// The VocabularyList stays a thin adapter: this module owns the ordering
// guarantees that make the accepted pronunciation contract honest:
//   - every `start` (or `stop`) invalidates older in-flight URL
//     resolutions, so a slower earlier request can never switch playback
//     to the wrong word after the student chose another one;
//   - natural clip completion (host `ended`) returns the surface to idle;
//   - media failures (host `error`, or `play()` rejection) are retryable,
//     never silently stuck and never a permanent "unavailable";
//   - events only fire for the CURRENT request — stale events are no-ops.
//
// Pure-controller shape (same pattern as useProgressSave's exported
// queue helpers): deterministic under a fake host, no DOM renderer needed.

export interface PronunciationAudioHost {
  src: string | null;
  play(): Promise<void>;
  pause(): void;
  removeAttribute(name: string): void;
  onended: ((ev: Event) => unknown) | null;
  onerror: ((ev: Event) => unknown) | null;
}

export interface PronunciationPlaybackEvents {
  /** The clip for `wordId` actually started playing. */
  onPlaying: (wordId: string) => void;
  /** The current clip ended naturally — surface returns to idle. */
  onIdle: () => void;
  /** The current clip failed — the word stays retryable. */
  onRetryable: (wordId: string) => void;
}

export interface PronunciationPlaybackSession {
  /** The request token of the newest start/stop (monotonic). */
  readonly requestToken: number;
  /**
   * Begin loading `wordId`'s clip. Invalidates every older request;
   * attaches the ended/error handlers for this request. Returns the
   * request token the caller must carry through the async URL build.
   */
  start(wordId: string): number;
  /** Cancel: invalidates in-flight requests and silences the host. */
  stop(): void;
  /**
   * Attach a freshly resolved URL and play it. No-op when `requestToken`
   * no longer matches (an older URL can never take over playback).
   */
  applyUrl(requestToken: number, wordId: string, url: string): Promise<void>;
  /**
   * The URL build failed. Retryable only when the request is still the
   * current one — a stale failure must not mark a newer word.
   */
  handleBuildFailure(requestToken: number, wordId: string): void;
  /** True when `requestToken` still belongs to the current request. */
  isCurrent(requestToken: number): boolean;
}

export function createPronunciationPlayback(
  host: PronunciationAudioHost,
  events: PronunciationPlaybackEvents,
): PronunciationPlaybackSession {
  let token = 0;

  return {
    get requestToken() {
      return token;
    },

    start(wordId: string) {
      token += 1;
      const myToken = token;
      host.onended = () => {
        if (token === myToken) events.onIdle();
      };
      host.onerror = () => {
        if (token === myToken) events.onRetryable(wordId);
      };
      return myToken;
    },

    stop() {
      token += 1;
      host.onended = null;
      host.onerror = null;
      host.pause();
      host.removeAttribute('src');
    },

    async applyUrl(requestToken: number, wordId: string, url: string) {
      if (requestToken !== token) return;
      host.src = url;
      try {
        await host.play();
      } catch {
        // play() rejection (network drop, autoplay refusal) — the word
        // itself is fine; offer a retry.
        if (requestToken === token) events.onRetryable(wordId);
        return;
      }
      if (requestToken === token) events.onPlaying(wordId);
    },

    handleBuildFailure(requestToken: number, wordId: string) {
      if (requestToken !== token) return;
      events.onRetryable(wordId);
    },

    isCurrent(requestToken: number) {
      return requestToken === token;
    },
  };
}
