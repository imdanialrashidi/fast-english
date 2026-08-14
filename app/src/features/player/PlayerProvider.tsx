// app/src/features/player/PlayerProvider.tsx
// Visual Slice 2 — single shared audio host + active-lesson session.
// Slice 8 — lifecycle reliability: stale-async guards, same-Variant soft
// source refresh, visibility reconciliation, Media Session integration.
//
// The app owns exactly ONE <audio> element for the premium player. The
// AudioPlayer UI in the lesson detail route binds to this provider instead
// of creating its own element, so:
//   - there is never a second simultaneous audio element (Mini Player
//     constraint);
//   - audio keeps playing while the student navigates inside the app and the
//     Mini Player can control it;
//   - resume position, playback rate and volume survive route changes;
//   - progress-save callbacks are registered per session by the bound route
//     and are dropped when that route unmounts (no stale writes).
//
// Slice 8 reliability contracts:
//   - a session generation guard drops stale async outcomes (a pending
//     play() promise from a stopped session can never fabricate an error
//     or a playing state on the next session);
//   - binding the SAME Variant with a NEW source (token rebuild / retry)
//     is a soft refresh: session, practical position and playback
//     preferences survive; only a genuinely new lesson resets;
//   - on background/foreground transitions the provider reconciles the UI
//     from real element state — never auto-plays, never invents a
//     position, and never writes Progress itself (the element's own pause
//     event stays the single pause-save writer);
//   - Media Session (metadata/playbackState/positionState/actions) mirrors
//     the authoritative session and is cleared when playback stops or is
//     no longer valid; unsupported platforms degrade to no-ops;
//   - volume/rate/mute preferences are re-applied to the element on
//     (re)mount and on visibility return (Android WebView resets them
//     across lifecycle transitions).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../../lib/auth';
import { classifyMediaError, reportPlayerFailure } from '../../lib/telemetry';
import { setAudioBusy } from '../../pwa/activity';
import {
  clampPosition,
  decideResumeTarget,
  isRestorablePosition,
  reconcileSnapshot,
  resolveBindTransition,
  resolveUserSeek,
} from './lifecycle';
import {
  buildMediaMetadataPayload,
  clearMediaSession,
  createMediaSessionHandlers,
  getMediaSessionHost,
  registerMediaSessionActions,
} from './mediaSession';

export interface PlayerSession {
  lessonId: string;
  title: string;
  /** Resolved Episode artwork URL for Media Session surfaces (optional). */
  artwork?: string | null;
}

export interface PlayerCallbacks {
  onTimeUpdate?: (positionSeconds: number, durationSeconds: number) => void;
  onSeek?: (positionSeconds: number) => void;
  onEnded?: () => void;
  /** Fired when playback pauses for any reason (incl. pronunciation exclusivity). */
  onPause?: (positionSeconds: number, durationSeconds: number) => void;
  /** Refresh the protected audio URL (e.g. a new file token). */
  onRetry?: () => void;
}

interface PlayerState {
  src: string | null;
  session: PlayerSession | null;
  isPlaying: boolean;
  isLoading: boolean;
  hasError: boolean;
  isMuted: boolean;
  volume: number;
  playbackRate: number;
  currentTime: number;
  duration: number;
}

export interface PlayerController extends PlayerState {
  /** Bind (or refresh) the active lesson session and its callbacks. */
  bind: (session: PlayerSession, src: string, callbacks: PlayerCallbacks) => void;
  /** Called when the bound route unmounts: drop callbacks, keep playback. */
  unbind: (lessonId: string) => void;
  /**
   * Pause the shared element without changing the session (used by
   * pronunciation exclusivity and atomic Variant switches).
   */
  pause: () => void;
  /**
   * Atomically end the current session: pause, drop callbacks and src,
   * clear the session (MiniPlayer disappears). Used when a Variant switch
   * must never leave the old Variant's audio audible.
   */
  stop: () => void;
  /** Seek to a position once metadata is loaded (resume). */
  applyInitialPosition: (seconds: number) => void;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  skipBy: (deltaSeconds: number) => void;
  setRate: (rate: number) => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  retry: () => void;
}

const PlayerContext = createContext<PlayerController | null>(null);

export function usePlayer(): PlayerController {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return ctx;
}

function formatSafeDuration(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const callbacksRef = useRef<PlayerCallbacks>({});
  const pendingSeekRef = useRef<number | null>(null);
  // Practical-position restore armed by retry()/soft refresh: while armed,
  // an older saved resume point must not regress it (see decideResumeTarget).
  const retryRestoreRef = useRef<number | null>(null);
  // Session generation: bumped on fresh bind/stop/logout; stale async
  // outcomes (play() promises) are dropped when the generation changed.
  const sessionGenRef = useRef(0);
  // Media Session position-state throttle (position updates flow through
  // state; the OS surface only needs ~0.5s granularity).
  const lastPositionStateRef = useRef<{
    position: number;
    duration: number;
    playbackRate: number;
  } | null>(null);
  const actionsRegisteredRef = useRef(false);
  const [state, setState] = useState<PlayerState>({
    src: null,
    session: null,
    isPlaying: false,
    isLoading: false,
    hasError: false,
    isMuted: false,
    volume: 1,
    playbackRate: 1,
    currentTime: 0,
    duration: 0,
  });

  // Keep a ref mirror so lifecycle listeners and the auth effect read the
  // freshest state without re-creating their identities.
  const stateRef = useRef(state);
  stateRef.current = state;

  // --- Session binding -----------------------------------------------------
  const bind = useCallback((session: PlayerSession, src: string, callbacks: PlayerCallbacks) => {
    callbacksRef.current = callbacks;
    setState((prev) => {
      const transition = resolveBindTransition(prev.session?.lessonId ?? null, prev.src, {
        sessionLessonId: session.lessonId,
        src,
      });

      // Identical lesson + source: refresh the session identity (title /
      // artwork may have been enriched), never touch playback.
      if (transition === 'same') {
        return { ...prev, session };
      }

      // Same lesson, NEW source — a token rebuild / retry. This is a soft
      // refresh: keep the session, the practical position (armed as a
      // pending seek + retry restore) and the playback preferences. The
      // old source's transient pause event still saves the practical
      // position through the bound callbacks (real position, not
      // fabrication).
      if (transition === 'soft-refresh') {
        const practical = prev.currentTime;
        if (isRestorablePosition(practical)) {
          pendingSeekRef.current = practical;
          retryRestoreRef.current = practical;
        } else {
          pendingSeekRef.current = null;
          retryRestoreRef.current = null;
        }
        setAudioBusy(false);
        return {
          ...prev,
          session,
          src,
          isPlaying: false,
          isLoading: true,
          hasError: false,
        };
      }

      // Genuinely new lesson: full reset (mirrors the previous AudioPlayer
      // "reset state when source changes" effect). Playback preferences
      // (rate, volume, mute) intentionally survive source changes — a
      // Variant switch must not reset the student's chosen listening setup.
      sessionGenRef.current += 1;
      pendingSeekRef.current = null;
      retryRestoreRef.current = null;
      setAudioBusy(false);
      return {
        ...prev,
        session,
        src,
        isPlaying: false,
        isLoading: true,
        hasError: false,
        currentTime: 0,
        duration: 0,
      };
    });
  }, []);

  // Keep the session + playback for the Mini Player when the bound route
  // unmounts; drop the callbacks so a detached route can never write stale
  // progress.
  const unbind = useCallback((lessonId: string) => {
    if (stateRef.current.session?.lessonId === lessonId) {
      callbacksRef.current = {};
    }
  }, []);

  // The provider now outlives the authenticated shell (it wraps every
  // route, including Home). Logging out must stop playback and drop the
  // session: without this, audio would keep playing with no Mini Player
  // visible on the public pages. The Media Session is cleared by the sync
  // effects once the session becomes null.
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (isAuthenticated || !stateRef.current.src) return;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setAudioBusy(false);
    callbacksRef.current = {};
    pendingSeekRef.current = null;
    retryRestoreRef.current = null;
    sessionGenRef.current += 1;
    setState((prev) => ({
      ...prev,
      src: null,
      session: null,
      isPlaying: false,
      isLoading: false,
      hasError: false,
      currentTime: 0,
      duration: 0,
    }));
  }, [isAuthenticated]);

  // --- Audio element events (same semantics as the previous AudioPlayer) --
  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setState((prev) => {
      const duration = formatSafeDuration(audio.duration);
      const next = { ...prev, duration, isLoading: false };
      if (pendingSeekRef.current !== null && duration > 0) {
        const target = Math.min(pendingSeekRef.current, duration - 0.25);
        audio.currentTime = target;
        // The pending seek (resume or retry restore) has landed: the
        // practical position is the audio position again. The retry
        // restore guard stays armed until the saved Progress catches up
        // (or an explicit user intent supersedes it) — a stale CTA label
        // (derived from an older save) must never regress the position.
        pendingSeekRef.current = null;
        next.currentTime = target;
      }
      return next;
    });
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const pos = audio.currentTime;
    const dur = audio.duration || 0;
    // While a pending seek is armed the element position is transient
    // (source refresh in flight) — never let it clobber the practical
    // position or write a fabricated 0-position save.
    if (pendingSeekRef.current === null) {
      setState((prev) => ({ ...prev, currentTime: pos, duration: formatSafeDuration(dur) }));
      if (dur > 0) {
        callbacksRef.current.onTimeUpdate?.(pos, dur);
      }
    }
  }, []);

  const handlePlay = useCallback(() => {
    // A stale play event from a cleared session must not resurrect a
    // playing state (or the audio-busy flag) on the next session.
    if (!stateRef.current.session || !stateRef.current.src) return;
    setState((prev) => ({ ...prev, isPlaying: true, hasError: false }));
    setAudioBusy(true);
  }, []);

  const handlePause = useCallback(() => {
    const audio = audioRef.current;
    setState((prev) => ({ ...prev, isPlaying: false }));
    setAudioBusy(false);
    if (audio) {
      const dur = audio.duration || 0;
      if (dur > 0) {
        callbacksRef.current.onTimeUpdate?.(audio.currentTime, dur);
      }
      // A pause at position 0 must not write a 0 save: the server rejects
      // 0 on required NumberFields (PB "cannot be blank" → 500). Mirror
      // the handleError guard — sub-0.5s pauses carry nothing worth
      // persisting.
      if (audio.currentTime > 0.5) {
        callbacksRef.current.onPause?.(audio.currentTime, dur);
      }
    }
  }, []);

  const handleEnded = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
    setAudioBusy(false);
    retryRestoreRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      const dur = audio.duration || 0;
      if (dur > 0) {
        callbacksRef.current.onTimeUpdate?.(audio.currentTime, dur);
      }
    }
    callbacksRef.current.onEnded?.();
  }, []);

  const handleError = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: false, hasError: true, isPlaying: false }));
    setAudioBusy(false);
    // Operational telemetry: the classified media-error code plus the
    // lesson id only — never the media URL or the MediaError message
    // (both can embed protected tokens).
    const lessonId = stateRef.current.session?.lessonId ?? null;
    const code = classifyMediaError(audioRef.current?.error?.code);
    reportPlayerFailure(lessonId, code);
    const audio = audioRef.current;
    // A recoverable failure stops playback at a REAL position. Save it so
    // the practical position survives the retry (the deck's resume point
    // derives from saved Progress; token expiry mid-playback would
    // otherwise fall back to an older periodic save). Only meaningful
    // positions (> 0.5s) are written — never invented.
    if (audio && audio.duration > 0 && audio.currentTime > 0.5) {
      const dur = audio.duration || 0;
      callbacksRef.current.onTimeUpdate?.(audio.currentTime, dur);
      callbacksRef.current.onPause?.(audio.currentTime, dur);
    }
  }, []);

  const handleWaiting = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true }));
  }, []);

  const handleCanPlay = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  // --- Controls ------------------------------------------------------------
  // Play when paused (used by the Media Session play action and togglePlay).
  // The session generation guard drops stale outcomes: a play() promise
  // from a stopped/cleared session can never flip the next session's state.
  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (audio?.paused !== true) return;
    const gen = sessionGenRef.current;
    void audio.play().catch(() => {
      if (gen === sessionGenRef.current && audioRef.current === audio) {
        setState((prev) => ({ ...prev, hasError: true, isLoading: false }));
      }
    });
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      resume();
    } else {
      audio.pause();
    }
  }, [resume]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    // A Variant switch must preserve the latest practical resume
    // position: the active pause/save callback is applied SYNCHRONOUSLY
    // here, BEFORE the callbacks are cleared. The queued `pause` event
    // from audio.pause() below would otherwise fire after the clear and
    // the exact position would be lost (only the coarser periodic save
    // would survive). Covers a naturally-ended clip too, whose final
    // position would otherwise never be saved. Only meaningful positions
    // (> 0.5s) are written — a 0-position save would 500 server-side.
    if (audio && audio.duration > 0 && (!audio.paused || audio.ended) && audio.currentTime > 0.5) {
      const dur = audio.duration || 0;
      callbacksRef.current.onTimeUpdate?.(audio.currentTime, dur);
      callbacksRef.current.onPause?.(audio.currentTime, dur);
    }
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setAudioBusy(false);
    callbacksRef.current = {};
    pendingSeekRef.current = null;
    retryRestoreRef.current = null;
    // Invalidate any in-flight async work of the old session.
    sessionGenRef.current += 1;
    setState((prev) => ({
      ...prev,
      src: null,
      session: null,
      isPlaying: false,
      isLoading: false,
      hasError: false,
      // Playback preferences survive stop() (see bind() above).
      currentTime: 0,
      duration: 0,
    }));
  }, []);

  const applyInitialPosition = useCallback((seconds: number) => {
    // While a retry restore is armed the practical position wins over an
    // older saved resume point; explicit user intent always wins.
    const decision = decideResumeTarget(retryRestoreRef.current, seconds);
    if (decision.kind === 'ignore') return;
    retryRestoreRef.current = null;
    const target = decision.target;
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = Math.min(target, audio.duration - 0.25);
      pendingSeekRef.current = null;
    } else {
      // Metadata not loaded yet — the seek lands on loadedmetadata.
      pendingSeekRef.current = target;
    }
    setState((prev) => ({ ...prev, currentTime: target }));
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const v = Math.max(0, seconds);
    const dur = audio.duration || 0;
    // A user scrub is explicit intent: it supersedes any pending retry
    // restore (and becomes the pending seek when metadata is still
    // loading).
    const decision = resolveUserSeek({
      pendingSeek: pendingSeekRef.current,
      retryRestore: retryRestoreRef.current,
      durationKnown: dur > 0,
      target: v,
    });
    pendingSeekRef.current = decision.pendingSeek;
    retryRestoreRef.current = decision.retryRestore;
    if (decision.applyToElement) {
      audio.currentTime = v;
    }
    setState((prev) => ({ ...prev, currentTime: v }));
    callbacksRef.current.onSeek?.(v);
    if (dur > 0) {
      callbacksRef.current.onTimeUpdate?.(v, dur);
    }
  }, []);

  const skipBy = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const dur = audio.duration || 0;
      const v = Math.min(Math.max(0, audio.currentTime + deltaSeconds), dur > 0 ? dur : Infinity);
      seekTo(v);
    },
    [seekTo],
  );

  const setRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
    setState((prev) => ({ ...prev, playbackRate: rate }));
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setState((prev) => ({ ...prev, isMuted: audio.muted }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    setState((prev) => {
      if (volume === 0) {
        audio.muted = true;
        return { ...prev, volume, isMuted: true };
      }
      audio.muted = prev.isMuted ? false : prev.isMuted;
      return { ...prev, volume, isMuted: false };
    });
  }, []);

  const retry = useCallback(() => {
    const s = stateRef.current;
    if (!s.session || !s.src) return;
    // Arm the practical-position restore BEFORE the source refresh: the
    // reload resets the element to 0, and the pending seek + guard make
    // sure the student resumes where playback actually stopped.
    if (isRestorablePosition(s.currentTime)) {
      retryRestoreRef.current = s.currentTime;
      pendingSeekRef.current = s.currentTime;
    }
    setState((prev) => ({ ...prev, hasError: false, isLoading: true }));
    // The bound route rebuilds the protected URL with a fresh token when
    // it provides onRetry (the bind soft-refresh then reloads the element
    // and lands the pending seek). Without a rebuild callback, fall back
    // to reloading the same source.
    if (callbacksRef.current.onRetry) {
      callbacksRef.current.onRetry();
    } else {
      audioRef.current?.load();
    }
  }, []);

  // --- Element preference re-application -----------------------------------
  // The <audio> element is (re)created whenever src goes null → value
  // (stop + rebind). A fresh element resets volume/rate/mute to defaults;
  // the accepted contract keeps the student's preferences, so they are
  // re-applied on every element mount. Also re-applied on visibility
  // return (Android WebView resets them across lifecycle transitions).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !state.src) return;
    audio.playbackRate = state.playbackRate;
    audio.muted = state.isMuted;
    audio.volume = state.volume;
  }, [state.src, state.playbackRate, state.isMuted, state.volume]);

  // --- Background/foreground reconciliation --------------------------------
  // Valid playback continues where the platform permits it; returning to
  // the app restores coherent Player UI from REAL element state. This
  // never auto-plays and never writes Progress itself: the element's own
  // pause event (delivered on resume if the platform paused while hidden)
  // remains the single pause-save writer — a reconcile can never produce
  // a duplicate write or a fabricated position.
  useEffect(() => {
    const reconcile = () => {
      const audio = audioRef.current;
      const s = stateRef.current;
      if (!audio || !s.session || !s.src) return;
      const result = reconcileSnapshot(
        {
          paused: audio.paused,
          ended: audio.ended,
          currentTime: audio.currentTime,
          duration: audio.duration,
        },
        {
          isPlaying: s.isPlaying,
          pendingSeekArmed: pendingSeekRef.current !== null,
        },
      );
      // Platform lifecycle transitions may reset element preferences.
      audio.playbackRate = s.playbackRate;
      audio.muted = s.isMuted;
      audio.volume = s.volume;
      if (Object.keys(result.patch).length > 0) {
        setState((prev) => ({ ...prev, ...result.patch }));
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') reconcile();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) reconcile();
    };
    const onResume = () => reconcile();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('resume', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('resume', onResume);
    };
  }, []);

  // --- Media Session (progressive enhancement) -----------------------------
  // Metadata: follows the active session; cleared when the session or
  // source is invalid so OS surfaces never advertise a stale Variant.
  useEffect(() => {
    const host = getMediaSessionHost();
    if (!host) return;
    if (!state.session || !state.src) {
      clearMediaSession(host);
      return;
    }
    if (typeof MediaMetadata !== 'undefined') {
      host.metadata = new MediaMetadata(buildMediaMetadataPayload(state.session));
    }
  }, [state.session, state.src]);

  // Playback state: mirrors the real element through player state. Only
  // meaningful while a session is active (clearMediaSession already set
  // 'none' when it was invalidated).
  useEffect(() => {
    const host = getMediaSessionHost();
    if (!host || !state.session || !state.src) return;
    host.playbackState = state.isPlaying ? 'playing' : 'paused';
  }, [state.session, state.src, state.isPlaying]);

  // Position state: throttled to ~0.5s granularity (position updates flow
  // through state at timeupdate rate).
  useEffect(() => {
    const host = getMediaSessionHost();
    if (!host || !state.session || !state.src) return;
    if (state.duration <= 0) return;
    const next: { position: number; duration: number; playbackRate: number } = {
      position: clampPosition(state.currentTime, state.duration),
      duration: state.duration,
      playbackRate: state.playbackRate,
    };
    const last = lastPositionStateRef.current;
    if (
      last &&
      Math.abs(last.position - next.position) < 0.5 &&
      Math.abs(last.duration - next.duration) < 0.5 &&
      Math.abs(last.playbackRate - next.playbackRate) < 0.01
    ) {
      return;
    }
    lastPositionStateRef.current = next;
    host.setPositionState(next);
  }, [state.session, state.src, state.currentTime, state.duration, state.playbackRate]);

  // Action handlers: registered ONCE, routed to the same authoritative
  // controller; per-action capability capture keeps unsupported actions
  // from breaking the rest. Handlers are stable (they only touch refs),
  // so re-registration is never needed.
  useEffect(() => {
    const host = getMediaSessionHost();
    if (!host || actionsRegisteredRef.current) return;
    actionsRegisteredRef.current = true;
    registerMediaSessionActions(
      host,
      createMediaSessionHandlers({
        resume,
        pause,
        skipBy,
        seekTo,
        stop,
      }),
    );
  }, [resume, pause, skipBy, seekTo, stop]);

  // The provider reads its own state inside `unbind` through the ref mirror
  // declared above the session-binding section.
  const value = useMemo<PlayerController>(
    () => ({
      ...state,
      bind,
      unbind,
      pause,
      stop,
      applyInitialPosition,
      togglePlay,
      seekTo,
      skipBy,
      setRate,
      toggleMute,
      setVolume,
      retry,
    }),
    [
      state,
      bind,
      unbind,
      pause,
      stop,
      applyInitialPosition,
      togglePlay,
      seekTo,
      skipBy,
      setRate,
      toggleMute,
      setVolume,
      retry,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      {state.src ? (
        <audio
          ref={audioRef}
          preload="metadata"
          src={state.src}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onError={handleError}
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
        >
          <track kind="captions" src="data:text/vtt,WEBVTT%0A%0A" srcLang="en" label="English" />
        </audio>
      ) : null}
      {children}
    </PlayerContext.Provider>
  );
}
