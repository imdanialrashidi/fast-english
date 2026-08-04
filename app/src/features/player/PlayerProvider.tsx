// app/src/features/player/PlayerProvider.tsx
// Visual Slice 2 — single shared audio host + active-lesson session.
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
// This changes presentation/interaction ergonomics only — the PWA activity
// flag, resume semantics and error behavior are preserved from the previous
// AudioPlayer implementation.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { setAudioBusy } from '../../pwa/activity';

export interface PlayerSession {
  lessonId: string;
  title: string;
}

export interface PlayerCallbacks {
  onTimeUpdate?: (positionSeconds: number, durationSeconds: number) => void;
  onSeek?: (positionSeconds: number) => void;
  onEnded?: () => void;
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

  // --- Session binding -----------------------------------------------------
  const bind = useCallback((session: PlayerSession, src: string, callbacks: PlayerCallbacks) => {
    callbacksRef.current = callbacks;
    setState((prev) => {
      if (prev.session?.lessonId === session.lessonId && prev.src === src) {
        return { ...prev, session };
      }
      // New lesson or new source: full reset (mirrors the previous
      // AudioPlayer "reset state when source changes" effect).
      pendingSeekRef.current = null;
      setAudioBusy(false);
      return {
        ...prev,
        session,
        src,
        isPlaying: false,
        isLoading: true,
        hasError: false,
        isMuted: false,
        volume: 1,
        playbackRate: 1,
        currentTime: 0,
        duration: 0,
      };
    });
  }, []);

  // Keep the session + playback for the Mini Player when the bound route
  // unmounts; drop the callbacks so a detached route can never write stale
  // progress. The provider reads its own state through a ref mirror so the
  // callback identity stays stable without re-creating the context.
  const stateRef = useRef(state);
  stateRef.current = state;
  const unbind = useCallback((lessonId: string) => {
    if (stateRef.current.session?.lessonId === lessonId) {
      callbacksRef.current = {};
    }
  }, []);

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
    setState((prev) => ({ ...prev, currentTime: pos, duration: formatSafeDuration(dur) }));
    if (dur > 0) {
      callbacksRef.current.onTimeUpdate?.(pos, dur);
    }
  }, []);

  const handlePlay = useCallback(() => {
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
    }
  }, []);

  const handleEnded = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
    setAudioBusy(false);
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
  }, []);

  const handleWaiting = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true }));
  }, []);

  const handleCanPlay = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  // --- Controls ------------------------------------------------------------
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => {
        setState((prev) => ({ ...prev, hasError: true, isLoading: false }));
      });
    } else {
      audio.pause();
    }
  }, []);

  const applyInitialPosition = useCallback((seconds: number) => {
    const audio = audioRef.current;
    const target = Math.max(0, seconds);
    pendingSeekRef.current = target;
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = Math.min(target, audio.duration - 0.25);
    }
    setState((prev) => ({ ...prev, currentTime: target }));
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const v = Math.max(0, seconds);
    audio.currentTime = v;
    const dur = audio.duration || 0;
    setState((prev) => ({ ...prev, currentTime: v }));
    callbacksRef.current.onSeek?.(v);
    if (dur > 0) {
      callbacksRef.current.onTimeUpdate?.(v, dur);
    }
  }, []);

  const skipBy = useCallback((deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration || 0;
    const v = Math.min(Math.max(0, audio.currentTime + deltaSeconds), dur > 0 ? dur : Infinity);
    audio.currentTime = v;
    setState((prev) => ({ ...prev, currentTime: v }));
    callbacksRef.current.onSeek?.(v);
    if (dur > 0) {
      callbacksRef.current.onTimeUpdate?.(v, dur);
    }
  }, []);

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
    setState((prev) => ({ ...prev, hasError: false, isLoading: true }));
    callbacksRef.current.onRetry?.();
    const audio = audioRef.current;
    if (audio) {
      audio.load();
    }
  }, []);

  // The provider reads its own state inside `unbind` through the ref mirror
  // declared above the session-binding section.
  const value = useMemo<PlayerController>(
    () => ({
      ...state,
      bind,
      unbind,
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
