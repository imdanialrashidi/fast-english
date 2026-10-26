import * as React from 'react';

/**
 * The one audio transport (MEDIA-01/02, READ-01/03).
 *
 * Owns the HTMLAudioElement event wiring, play/pause, seek, skip, rate
 * cycle, error recovery, retry, and the time/duration state. Two adapters
 * sit on top of it:
 *
 * - the persistent learner player (`lib/player.tsx`) supplies an element
 *   ref from the shell and progress/completion callbacks;
 * - the public sample and landing preview (`useAudioTransport` directly)
 *   own a local element and pass no callbacks.
 *
 * The interface is the test surface: the transport hook IDs
 * (#lesson-audio, #player-play/seek/speed/back/forward/toggle/error/retry)
 * stay the same in both adapters, so the browser media contracts keep
 * holding. Text and audio are independent; there is no sentence-level
 * synchronisation.
 */

export const PLAYER_RATES = [1, 1.25, 1.5, 0.75] as const;

export function formatAudioTime(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
        return '–:––';
    }
    const total = Math.floor(totalSeconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Lifecycle callbacks; the transport owns the element and its listeners. */
export interface TransportCallbacks {
    /** Fired once when an element binds (used by the learner test probe). */
    onBind?: () => void;
    /** Fired on pause; progress adapters save here. */
    onPause?: (audio: HTMLAudioElement) => void;
    /** Fired while playing (not seeking); progress adapters throttle here. */
    onTime?: (audio: HTMLAudioElement) => void;
    /** Fired on the media `ended` event; completion adapters post here. */
    onEnded?: (audio: HTMLAudioElement) => void;
    /** Fired on loadedmetadata; resume adapters apply a pending seek here. */
    onLoadedMetadata?: (audio: HTMLAudioElement) => void;
}

export interface AudioTransport {
    audioRef: React.RefObject<HTMLAudioElement | null>;
    /** Callback ref for the owned `<audio>` element. */
    bindRef: (element: HTMLAudioElement | null) => void;
    playing: boolean;
    /** True while the browser is fetching/decoding and cannot advance. */
    buffering: boolean;
    time: number;
    duration: number;
    rate: number;
    hasError: boolean;
    expanded: boolean;
    setExpanded: (value: boolean) => void;
    fraction: number;
    /** Highest buffered position as a 0–1 fraction of the duration. */
    bufferedFraction: number;
    toggle: () => void;
    seekTo: (seconds: number) => void;
    /** Seek from a 0–100 range input (one mapping for both adapters). */
    seekToFraction: (percent: number) => void;
    skipBy: (delta: number) => void;
    cycleRate: () => void;
    retry: () => void;
}

export interface TransportOptions extends TransportCallbacks {
    /**
     * Element ref supplied by an adapter that also needs to set `src`
     * imperatively (the persistent learner player). When omitted the
     * transport owns its ref.
     */
    audioRef?: React.RefObject<HTMLAudioElement | null>;
    /** Reset local time/duration/error state when this identity changes. */
    resetKey?: string | number | null;
}

/** Highest buffered end at/after the current position, as a 0–1 fraction. */
function bufferedEndFraction(audio: HTMLAudioElement): number {
    const duration = audio.duration;
    if (!Number.isFinite(duration) || duration <= 0 || audio.buffered.length === 0) {
        return 0;
    }

    let end = audio.buffered.end(audio.buffered.length - 1);
    for (let index = audio.buffered.length - 1; index >= 0; index -= 1) {
        if (audio.buffered.start(index) <= audio.currentTime + 0.25) {
            end = audio.buffered.end(index);
            break;
        }
    }

    return Math.min(1, Math.max(0, end / duration));
}

export function useAudioTransport(options: TransportOptions = {}): AudioTransport {
    const internalRef = React.useRef<HTMLAudioElement | null>(null);
    const audioRef = options.audioRef ?? internalRef;
    const [node, setNode] = React.useState<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = React.useState(false);
    const [buffering, setBuffering] = React.useState(false);
    const [time, setTime] = React.useState(0);
    const [duration, setDuration] = React.useState(Number.NaN);
    const [bufferedFraction, setBufferedFraction] = React.useState(0);
    const [rateIndex, setRateIndex] = React.useState(0);
    const [hasError, setHasError] = React.useState(false);
    const [expanded, setExpanded] = React.useState(false);

    const rate = PLAYER_RATES[rateIndex] ?? 1;
    const rateRef = React.useRef(rate);
    rateRef.current = rate;
    const callbacks = React.useRef<TransportCallbacks>(options);
    React.useEffect(() => {
        callbacks.current = options;
    });

    const bindRef = React.useCallback(
        (element: HTMLAudioElement | null) => {
            audioRef.current = element;
            setNode(element);
        },
        [audioRef],
    );

    // One listener set per bound element, regardless of which adapter owns it.
    React.useEffect(() => {
        if (node === null) {
            return;
        }
        const audio = node;
        callbacks.current.onBind?.();

        const onPlay = (): void => setPlaying(true);
        const onPlaying = (): void => {
            setPlaying(true);
            setBuffering(false);
        };
        const onWaiting = (): void => {
            // `waiting` also fires on a very short seek gap; only show the
            // indicator while the element actually intends to play.
            if (!audio.paused) {
                setBuffering(true);
            }
        };
        const onPause = (): void => {
            setPlaying(false);
            setBuffering(false);
            callbacks.current.onPause?.(audio);
        };
        const onTimeUpdate = (): void => {
            setTime(audio.currentTime);
            if (!audio.paused && !audio.seeking) {
                callbacks.current.onTime?.(audio);
            }
        };
        const onProgress = (): void => setBufferedFraction(bufferedEndFraction(audio));
        const onLoadedMetadata = (): void => {
            setDuration(audio.duration);
            setHasError(false);
            setBufferedFraction(bufferedEndFraction(audio));
            audio.playbackRate = rateRef.current;
            callbacks.current.onLoadedMetadata?.(audio);
        };
        const onCanPlay = (): void => setBuffering(false);
        const onDurationChange = (): void => {
            setDuration(audio.duration);
            setBufferedFraction(bufferedEndFraction(audio));
        };
        const onEnded = (): void => {
            setPlaying(false);
            setBuffering(false);
            callbacks.current.onEnded?.(audio);
        };
        const onError = (): void => {
            if (audio.currentSrc === '') {
                return;
            }
            setPlaying(false);
            setBuffering(false);
            setHasError(true);
            setExpanded(true);
        };

        audio.addEventListener('play', onPlay);
        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('waiting', onWaiting);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('progress', onProgress);
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('durationchange', onDurationChange);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        // A public page mounts its element with `src` already set; the
        // metadata event can fire before this effect binds. Seed from the
        // element so duration/time are correct on the first frame.
        if (audio.readyState >= 1) {
            setDuration(audio.duration);
            setTime(audio.currentTime);
            setBufferedFraction(bufferedEndFraction(audio));
            audio.playbackRate = rateRef.current;
            callbacks.current.onLoadedMetadata?.(audio);
        }

        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('playing', onPlaying);
            audio.removeEventListener('waiting', onWaiting);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('progress', onProgress);
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('durationchange', onDurationChange);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
        };
    }, [node]);

    // A new lesson/sample version starts clean; the element may keep its
    // previous bytes until the adapter assigns a new src.
    const resetKey = options.resetKey ?? null;
    React.useEffect(() => {
        setTime(0);
        setDuration(Number.NaN);
        setBufferedFraction(0);
        setBuffering(false);
        setHasError(false);
    }, [resetKey]);

    React.useEffect(() => {
        const audio = audioRef.current;
        if (audio !== null) {
            audio.playbackRate = rate;
        }
    }, [rate, audioRef, node]);

    const toggle = React.useCallback((): void => {
        const audio = audioRef.current;
        if (audio === null) {
            return;
        }
        if (hasError) {
            setHasError(false);
            audio.load();
        }
        if (audio.paused) {
            setBuffering(true);
            void audio.play().catch(() => {
                setBuffering(false);
                setHasError(true);
                setExpanded(true);
            });
        } else {
            audio.pause();
        }
    }, [audioRef, hasError]);

    const seekTo = React.useCallback(
        (seconds: number): void => {
            const audio = audioRef.current;
            if (audio === null || !Number.isFinite(audio.duration) || audio.duration <= 0) {
                return;
            }
            audio.currentTime = Math.min(Math.max(0, seconds), audio.duration);
            setTime(audio.currentTime);
        },
        [audioRef],
    );

    const seekToFraction = React.useCallback(
        (percent: number): void => {
            const audio = audioRef.current;
            if (audio === null || !Number.isFinite(audio.duration) || audio.duration <= 0) {
                return;
            }
            audio.currentTime = (Math.min(Math.max(0, percent), 100) / 100) * audio.duration;
            setTime(audio.currentTime);
        },
        [audioRef],
    );

    const skipBy = React.useCallback(
        (delta: number): void => {
            const audio = audioRef.current;
            if (audio === null || !Number.isFinite(audio.duration)) {
                return;
            }
            seekTo(audio.currentTime + delta);
        },
        [audioRef, seekTo],
    );

    const cycleRate = React.useCallback((): void => {
        setRateIndex((previous) => (previous + 1) % PLAYER_RATES.length);
    }, []);

    const retry = React.useCallback((): void => {
        const audio = audioRef.current;
        if (audio === null) {
            return;
        }
        setHasError(false);
        setBuffering(true);
        // An errored element never retries the same src without load().
        audio.load();
        void audio.play().catch(() => {
            setBuffering(false);
            setHasError(true);
            setExpanded(true);
        });
    }, [audioRef]);

    const fraction = Number.isFinite(duration) && duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;

    return {
        audioRef,
        bindRef,
        playing,
        buffering,
        time,
        duration,
        rate,
        hasError,
        expanded,
        setExpanded,
        fraction,
        bufferedFraction,
        toggle,
        seekTo,
        seekToFraction,
        skipBy,
        cycleRate,
        retry,
    };
}
