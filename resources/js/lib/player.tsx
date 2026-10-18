import * as React from 'react';
import type { PlayerTrack } from '@/types';
import { postJson } from './http';

/**
 * M1 persistent audio owner (READ-01, MEDIA-01/02, PROG-01).
 *
 * One HTMLAudioElement lives in the persistent AppLayout, so Inertia
 * visits (reader ↔ library) never destroy it: playback continues across
 * in-layout navigation, while a lesson switch replaces the source and
 * stops the old audio with no autoplay. Logout is a native form POST
 * (full reload), which destroys the element and stops everything.
 *
 * Server rules preserved from reader-player.js: saves go to the
 * existing JSON endpoints (store/complete) at most every 15 s while
 * playing plus on pause; stale revisions (409) adopt the server
 * position; failures show #progress-error + #progress-retry and never
 * claim success; completion comes only from the `ended` event or the
 * explicit خواندم action, never from seeking to the end.
 */

export const PLAYER_RATES = [1, 1.25, 1.5, 0.75] as const;

export function formatAudioTime(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
        return '–:––';
    }
    const total = Math.floor(totalSeconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export interface ProgressCallbacks {
    canSave: boolean;
    onCompleted: () => void;
    onStale: (position: number) => void;
}

interface PlayerContextValue {
    audioRef: React.RefObject<HTMLAudioElement | null>;
    track: PlayerTrack | null;
    setTrack: (track: PlayerTrack, callbacks: ProgressCallbacks) => void;
    clearTrack: () => void;
    playing: boolean;
    time: number;
    duration: number;
    rate: number;
    hasError: boolean;
    expanded: boolean;
    setExpanded: (value: boolean) => void;
    saveError: string | null;
    retrySaveNow: () => void;
    toggle: () => void;
    seekTo: (seconds: number) => void;
    skipBy: (delta: number) => void;
    cycleRate: () => void;
    retry: () => void;
}

const PlayerContext = React.createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
    const value = React.useContext(PlayerContext);
    if (value === null) {
        throw new Error('usePlayer must be used inside PlayerProvider');
    }
    return value;
}

function trackKey(track: PlayerTrack): string {
    return `${track.lessonId}:${track.audioRevision}`;
}

const NOOP_CALLBACKS: ProgressCallbacks = { canSave: false, onCompleted: () => {}, onStale: () => {} };

export function PlayerProvider({ children }: React.PropsWithChildren): React.JSX.Element {
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const [track, setTrackState] = React.useState<PlayerTrack | null>(null);
    const [playing, setPlaying] = React.useState(false);
    const [time, setTime] = React.useState(0);
    const [duration, setDuration] = React.useState(Number.NaN);
    const [rate, setRate] = React.useState<number>(1);
    const [hasError, setHasError] = React.useState(false);
    const [expanded, setExpanded] = React.useState(false);
    const [saveError, setSaveError] = React.useState<string | null>(null);

    const loadedKey = React.useRef<string | null>(null);
    const pendingSeek = React.useRef<number | null>(null);
    const callbacks = React.useRef<ProgressCallbacks>(NOOP_CALLBACKS);
    const lastSave = React.useRef(0);
    const retrySave = React.useRef<(() => void) | null>(null);
    const rateRef = React.useRef(rate);
    rateRef.current = rate;

    const setTrack = React.useCallback((next: PlayerTrack, nextCallbacks: ProgressCallbacks) => {
        callbacks.current = nextCallbacks;
        if (loadedKey.current === trackKey(next)) {
            // Same lesson version (back/forward revisit): keep the
            // element, its time, and its play state untouched.
            setTrackState(next);
            return;
        }
        audioRef.current?.pause();
        pendingSeek.current = next.initialPosition > 1 ? next.initialPosition : null;
        setTrackState(next);
    }, []);

    const clearTrack = React.useCallback(() => {
        audioRef.current?.pause();
        loadedKey.current = null;
        pendingSeek.current = null;
        setTrackState(null);
        setTime(0);
        setDuration(Number.NaN);
        setHasError(false);
    }, []);

    // Bind the source when the track identity changes.
    React.useEffect(() => {
        const audio = audioRef.current;
        if (audio === null || track === null) {
            return;
        }
        if (loadedKey.current === trackKey(track)) {
            return;
        }
        loadedKey.current = trackKey(track);
        setHasError(false);
        setTime(0);
        setDuration(Number.NaN);
        audio.playbackRate = rateRef.current;
        audio.src = track.audioUrl;
        audio.load();
    }, [track]);

    const savePosition = React.useCallback(async (position: number, manual: boolean): Promise<void> => {
        const current = callbacks.current;
        const active = loadedKey.current;
        if (!current.canSave || active === null) {
            return;
        }
        if (!Number.isFinite(position) || position < 0) {
            return;
        }
        // Throttle background saves; manual saves (pause) always go.
        const now = Date.now();
        if (!manual && now - lastSave.current < 15_000) {
            return;
        }
        lastSave.current = now;
        const [lessonId, revision] = active.split(':').map(Number);
        try {
            const response = await postJson('/app/progress', {
                lesson_id: lessonId,
                audio_revision: revision,
                position_seconds: position,
            });
            if (response.status === 409) {
                const data = (await response.json()) as { position_seconds?: number };
                const serverPosition = typeof data.position_seconds === 'number' ? data.position_seconds : 0;
                const audio = audioRef.current;
                if (audio !== null) {
                    audio.currentTime = serverPosition;
                }
                current.onStale(serverPosition);
                return;
            }
            if (!response.ok) {
                throw new Error(`save failed: ${response.status}`);
            }
            setSaveError(null);
            retrySave.current = null;
        } catch {
            setSaveError('ذخیره موقعیت ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.');
            retrySave.current = () => {
                void savePosition(position, true);
            };
        }
    }, []);

    const retrySaveNow = React.useCallback(() => {
        retrySave.current?.();
    }, []);

    // Element event wiring: bound once per mounted element, never
    // duplicated across visits. It re-runs when the track binds because
    // a logged-out shell mounts no audio element at all — the first
    // mount has nothing to bind until the reader sets its track.
    React.useEffect(() => {
        const audio = audioRef.current;
        if (audio === null) {
            return;
        }
        // S4-6 compat probe: exactly one owner binds the element.
        (window as unknown as { __fePlayerBound?: boolean }).__fePlayerBound = true;

        const onPlay = (): void => setPlaying(true);
        const onPause = (): void => {
            setPlaying(false);
            void savePosition(audio.currentTime, true);
        };
        const onTime = (): void => {
            setTime(audio.currentTime);
            if (!audio.paused && !audio.seeking) {
                void savePosition(audio.currentTime, false);
            }
        };
        const onMeta = (): void => {
            setDuration(audio.duration);
            setHasError(false);
            audio.playbackRate = rateRef.current;
            if (pendingSeek.current !== null && Number.isFinite(audio.duration)) {
                audio.currentTime = Math.min(pendingSeek.current, Math.max(0, audio.duration - 0.5));
                pendingSeek.current = null;
            }
        };
        const onEnded = (): void => {
            setPlaying(false);
            const current = callbacks.current;
            const activeKey = loadedKey.current;
            if (!current.canSave || activeKey === null) {
                return;
            }
            const [lessonId, revision] = activeKey.split(':').map(Number);
            void postJson('/app/progress/complete', { lesson_id: lessonId, audio_revision: revision })
                .then((response) => {
                    if (response.ok) {
                        current.onCompleted();
                    }
                })
                .catch(() => {
                    setSaveError('ثبت تکمیل درس ممکن نشد. دکمه خواندم را دوباره بزنید.');
                });
        };
        const onError = (): void => {
            if (audio.currentSrc === '') {
                return;
            }
            setPlaying(false);
            setHasError(true);
            setExpanded(true);
        };

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('loadedmetadata', onMeta);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);
        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('loadedmetadata', onMeta);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
        };
    }, [savePosition, track]);

    const toggle = React.useCallback(() => {
        const audio = audioRef.current;
        if (audio === null || track === null) {
            return;
        }
        if (hasError) {
            setHasError(false);
            audio.load();
        }
        if (audio.paused) {
            void audio.play().catch(() => {
                setHasError(true);
                setExpanded(true);
            });
        } else {
            audio.pause();
        }
    }, [track, hasError]);

    const seekTo = React.useCallback((seconds: number) => {
        const audio = audioRef.current;
        if (audio === null || !Number.isFinite(audio.duration)) {
            return;
        }
        audio.currentTime = Math.min(Math.max(0, seconds), audio.duration);
        setTime(audio.currentTime);
    }, []);

    const skipBy = React.useCallback(
        (delta: number) => {
            const audio = audioRef.current;
            if (audio === null || !Number.isFinite(audio.duration)) {
                return;
            }
            seekTo(audio.currentTime + delta);
        },
        [seekTo],
    );

    const cycleRate = React.useCallback(() => {
        setRate((previous) => {
            const index = PLAYER_RATES.indexOf(previous as (typeof PLAYER_RATES)[number]);
            const next = PLAYER_RATES[(index + 1) % PLAYER_RATES.length] ?? 1;
            const audio = audioRef.current;
            if (audio !== null) {
                audio.playbackRate = next;
            }
            return next;
        });
    }, []);

    const retry = React.useCallback(() => {
        const audio = audioRef.current;
        if (audio === null || track === null) {
            return;
        }
        setHasError(false);
        audio.load();
        void audio.play().catch(() => {
            setHasError(true);
            setExpanded(true);
        });
    }, [track]);

    const value = React.useMemo<PlayerContextValue>(
        () => ({
            audioRef,
            track,
            setTrack,
            clearTrack,
            playing,
            time,
            duration,
            rate,
            hasError,
            expanded,
            setExpanded,
            saveError,
            retrySaveNow,
            toggle,
            seekTo,
            skipBy,
            cycleRate,
            retry,
        }),
        [
            track,
            setTrack,
            clearTrack,
            playing,
            time,
            duration,
            rate,
            hasError,
            expanded,
            saveError,
            retrySaveNow,
            toggle,
            seekTo,
            skipBy,
            cycleRate,
            retry,
        ],
    );

    return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
