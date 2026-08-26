// app/src/features/player/useMediaSession.ts
// Deep Media Session adapter — hides metadata/playbackState/positionState
// + action registration behind a small interface. PlayerProvider becomes
// composition (audio element + bind/transition + this adapter).

import { useEffect, useRef } from 'react';
import { clampPosition } from './lifecycle';
import {
  buildMediaMetadataPayload,
  clearMediaSession,
  createMediaSessionHandlers,
  getMediaSessionHost,
  type MediaSessionController,
  registerMediaSessionActions,
} from './mediaSession';

export interface UseMediaSessionOpts {
  session: { lessonId: string; title: string; artwork?: string | null } | null;
  src: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  controller: MediaSessionController;
}

export function useMediaSession(opts: UseMediaSessionOpts): void {
  const { session, src, isPlaying, currentTime, duration, playbackRate, controller } = opts;
  const lastPositionStateRef = useRef<{
    position: number;
    duration: number;
    playbackRate: number;
  } | null>(null);
  const actionsRegisteredRef = useRef(false);

  // Metadata
  useEffect(() => {
    const host = getMediaSessionHost();
    if (!host) return;
    if (!session || !src) {
      clearMediaSession(host);
      return;
    }
    if (typeof MediaMetadata !== 'undefined') {
      host.metadata = new MediaMetadata(buildMediaMetadataPayload(session));
    }
  }, [session, src]);

  // Playback state
  useEffect(() => {
    const host = getMediaSessionHost();
    if (!host || !session || !src) return;
    host.playbackState = isPlaying ? 'playing' : 'paused';
  }, [session, src, isPlaying]);

  // Position state throttled
  useEffect(() => {
    const host = getMediaSessionHost();
    if (!host || !session || !src) return;
    if (duration <= 0) return;
    const next = {
      position: clampPosition(currentTime, duration),
      duration,
      playbackRate,
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
  }, [session, src, currentTime, duration, playbackRate]);

  // Action handlers — registered once, stable (controller refs only).
  useEffect(() => {
    const host = getMediaSessionHost();
    if (!host || actionsRegisteredRef.current) return;
    actionsRegisteredRef.current = true;
    registerMediaSessionActions(host, createMediaSessionHandlers(controller));
  }, [controller]);
}
