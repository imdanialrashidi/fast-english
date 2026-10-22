import * as React from 'react';
import type { PlayerTrack } from '@/types';
import { useAudioTransport } from './audio';
import { postJson } from './http';

/**
 * M1 persistent audio adapter (READ-01, MEDIA-01/02, PROG-01).
 *
 * One HTMLAudioElement lives in the persistent AppLayout, so Inertia
 * visits (reader ↔ library) never destroy it: playback continues across
 * in-layout navigation, while a lesson switch replaces the source and
 * stops the old audio with no autoplay. Logout is a native form POST
 * (full reload), which destroys the element and stops everything.
 *
 * The transport (`lib/audio.ts`) owns the element events and controls;
 * this adapter adds the track identity, resume position, progress saves,
 * completion, and the stale-revision (409) response. Server rules are
 * preserved: saves go to the existing JSON endpoints at most every 15 s
 * while playing plus on pause; stale revisions adopt the server position;
 * failures show the save error and never claim success; completion comes
 * only from the `ended` event or the explicit خواندم action.
 */

export interface ProgressCallbacks {
    canSave: boolean;
    onCompleted: () => void;
    onStale: (position: number) => void;
}

interface PlayerState {
    track: PlayerTrack | null;
    audioRef: React.RefObject<HTMLAudioElement | null>;
    bindRef: (element: HTMLAudioElement | null) => void;
    playing: boolean;
    time: number;
    duration: number;
    rate: number;
    fraction: number;
    hasError: boolean;
    expanded: boolean;
    setExpanded: (value: boolean) => void;
    saveError: string | null;
}

interface PlayerActions {
    setTrack: (track: PlayerTrack, callbacks: ProgressCallbacks) => void;
    clearTrack: () => void;
    toggle: () => void;
    seekTo: (seconds: number) => void;
    seekToFraction: (percent: number) => void;
    skipBy: (delta: number) => void;
    cycleRate: () => void;
    retry: () => void;
    retrySaveNow: () => void;
}

const PlayerStateContext = React.createContext<PlayerState | null>(null);
const PlayerActionsContext = React.createContext<PlayerActions | null>(null);
const PlayerTrackContext = React.createContext<PlayerTrack | null | undefined>(undefined);

export function usePlayerActions(): PlayerActions {
    const actions = React.useContext(PlayerActionsContext);
    if (actions === null) {
        throw new Error('usePlayerActions must be used inside PlayerProvider');
    }
    return actions;
}

/**
 * Track presence only. Layouts use this instead of usePlayer() so the
 * shell does not re-render on every timeupdate; the value changes only
 * when a lesson is bound or cleared.
 */
export function usePlayerTrack(): PlayerTrack | null {
    const track = React.useContext(PlayerTrackContext);
    if (track === undefined) {
        throw new Error('usePlayerTrack must be used inside PlayerProvider');
    }
    return track;
}

export function usePlayer(): PlayerState & PlayerActions {
    const state = React.useContext(PlayerStateContext);
    const actions = React.useContext(PlayerActionsContext);
    if (state === null || actions === null) {
        throw new Error('usePlayer must be used inside PlayerProvider');
    }
    return { ...state, ...actions };
}

function trackKey(track: PlayerTrack): string {
    return `${track.lessonId}:${track.audioRevision}`;
}

const NOOP_CALLBACKS: ProgressCallbacks = { canSave: false, onCompleted: () => {}, onStale: () => {} };

export function PlayerProvider({ children }: React.PropsWithChildren): React.JSX.Element {
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const [track, setTrackState] = React.useState<PlayerTrack | null>(null);
    const [saveError, setSaveError] = React.useState<string | null>(null);
    const [bound, setBound] = React.useState(false);

    const loadedKey = React.useRef<string | null>(null);
    const pendingSeek = React.useRef<number | null>(null);
    const callbacks = React.useRef<ProgressCallbacks>(NOOP_CALLBACKS);
    const lastSave = React.useRef(0);
    const retrySave = React.useRef<(() => void) | null>(null);

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

    const transport = useAudioTransport({
        audioRef,
        resetKey: track ? trackKey(track) : null,
        onBind: () => {
            setBound(true);
            window.__fePlayerBound = true;
        },
        onPause: (audio) => {
            void savePosition(audio.currentTime, true);
        },
        onTime: (audio) => {
            void savePosition(audio.currentTime, false);
        },
        onLoadedMetadata: (audio) => {
            if (pendingSeek.current !== null && Number.isFinite(audio.duration)) {
                audio.currentTime = Math.min(pendingSeek.current, Math.max(0, audio.duration - 0.5));
                pendingSeek.current = null;
            }
        },
        onEnded: () => {
            const current = callbacks.current;
            const active = loadedKey.current;
            if (!current.canSave || active === null) {
                return;
            }
            const [lessonId, revision] = active.split(':').map(Number);
            void postJson('/app/progress/complete', { lesson_id: lessonId, audio_revision: revision })
                .then((response) => {
                    if (response.ok) {
                        current.onCompleted();
                    }
                })
                .catch(() => {
                    setSaveError('ثبت تکمیل درس ممکن نشد. دکمه خواندم را دوباره بزنید.');
                });
        },
    });

    const { bindRef, toggle, seekTo, seekToFraction, skipBy, cycleRate, retry } = transport;

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
        setSaveError(null);
    }, []);

    // Bind the source when the track identity changes. `bound` makes the
    // effect replay if the element mounted after the first track render.
    React.useEffect(() => {
        const audio = audioRef.current;
        if (audio === null || track === null || !bound) {
            return;
        }
        if (loadedKey.current === trackKey(track)) {
            return;
        }
        loadedKey.current = trackKey(track);
        audio.src = track.audioUrl;
        audio.load();
    }, [track, bound]);

    const retrySaveNow = React.useCallback(() => {
        retrySave.current?.();
    }, []);

    const state = React.useMemo<PlayerState>(
        () => ({
            track,
            audioRef,
            bindRef,
            playing: transport.playing,
            time: transport.time,
            duration: transport.duration,
            rate: transport.rate,
            fraction: transport.fraction,
            hasError: transport.hasError,
            expanded: transport.expanded,
            setExpanded: transport.setExpanded,
            saveError,
        }),
        [
            track,
            audioRef,
            bindRef,
            transport.playing,
            transport.time,
            transport.duration,
            transport.rate,
            transport.fraction,
            transport.hasError,
            transport.expanded,
            transport.setExpanded,
            saveError,
        ],
    );

    const actions = React.useMemo<PlayerActions>(
        () => ({ setTrack, clearTrack, toggle, seekTo, seekToFraction, skipBy, cycleRate, retry, retrySaveNow }),
        [setTrack, clearTrack, toggle, seekTo, seekToFraction, skipBy, cycleRate, retry, retrySaveNow],
    );

    return (
        <PlayerActionsContext.Provider value={actions}>
            <PlayerTrackContext.Provider value={track}>
                <PlayerStateContext.Provider value={state}>{children}</PlayerStateContext.Provider>
            </PlayerTrackContext.Provider>
        </PlayerActionsContext.Provider>
    );
}
