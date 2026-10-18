import * as React from 'react';
import type { SentenceCue } from '@/types';
import { PLAYER_RATES, formatAudioTime } from '@/lib/player';

/**
 * Headless audio adapter shared by the learner reader and the public
 * sample: one owned HTMLAudioElement with the same transport contract —
 * play/pause, seek, ±10s, speed cycle, retry-after-error, cue index, and
 * time strings. The persistent learner player keeps its own element
 * (progress saves + cross-page continuity); the sample uses this hook
 * locally so player fixes land once.
 *
 * Hook IDs (#lesson-audio, #player-play/seek/speed/back/forward/toggle/
 * error/retry) stay identical in both consumers: the browser media
 * contracts keep holding.
 */
export interface HeadlessAudio {
    audioRef: React.RefObject<HTMLAudioElement | null>;
    playing: boolean;
    time: number;
    duration: number;
    rate: number;
    hasError: boolean;
    expanded: boolean;
    setExpanded: (value: boolean) => void;
    fraction: number;
    activeIndex: number;
    toggle: () => void;
    seekTo: (value: number) => void;
    skipBy: (delta: number) => void;
    cycleRate: () => void;
    retry: () => void;
    /** Element event bindings: spread onto the owned audio element. */
    bind: {
        onPlay: () => void;
        onPause: () => void;
        onTimeUpdate: (event: React.SyntheticEvent<HTMLAudioElement>) => void;
        onLoadedMetadata: (event: React.SyntheticEvent<HTMLAudioElement>) => void;
        onDurationChange: (event: React.SyntheticEvent<HTMLAudioElement>) => void;
        onError: () => void;
    };
}

export function currentCueIndex(cues: SentenceCue[], time: number): number {
    let active = -1;
    for (let index = 0; index < cues.length; index += 1) {
        const cue = cues[index];
        if (cue !== undefined && time >= cue.start_seconds && time < cue.end_seconds) {
            active = index;
        }
    }
    if (active === -1 && cues.length > 0) {
        const last = cues[cues.length - 1];
        if (last !== undefined && time >= last.end_seconds) {
            active = cues.length - 1;
        }
    }
    return active;
}

export { formatAudioTime };

export function useHeadlessAudio(audioUrl: string, cues: SentenceCue[], cuesUsable: boolean): HeadlessAudio {
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = React.useState(false);
    const [time, setTime] = React.useState(0);
    const [duration, setDuration] = React.useState(Number.NaN);
    const [rateIndex, setRateIndex] = React.useState(0);
    const [hasError, setHasError] = React.useState(false);
    const [expanded, setExpanded] = React.useState(false);
    const rate = PLAYER_RATES[rateIndex] ?? 1;

    const ready = Number.isFinite(duration);
    const fraction = ready && duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;
    const activeIndex = cuesUsable ? currentCueIndex(cues, time) : -1;

    const toggle = React.useCallback(() => {
        const audio = audioRef.current;
        if (audio === null) {
            return;
        }
        if (audio.paused) {
            setHasError(false);
            void audio.play().catch(() => {
                setHasError(true);
                setExpanded(true);
            });
        } else {
            audio.pause();
        }
    }, []);

    const seekTo = React.useCallback((value: number) => {
        const audio = audioRef.current;
        if (audio === null || !Number.isFinite(audio.duration) || audio.duration <= 0) {
            return;
        }
        audio.currentTime = Math.min(Math.max(0, value), audio.duration);
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
        setRateIndex((previous) => (previous + 1) % PLAYER_RATES.length);
    }, []);

    const retry = React.useCallback(() => {
        const audio = audioRef.current;
        setHasError(false);
        if (audio !== null) {
            // An errored element never retries the same src without load().
            audio.load();
            void audio.play().catch(() => {
                setHasError(true);
                setExpanded(true);
            });
        }
    }, []);

    React.useEffect(() => {
        const audio = audioRef.current;
        if (audio === null) {
            return;
        }
        audio.playbackRate = rate;
    }, [rate]);

    // Rebinding a new lesson URL resets local state; same URL keeps it.
    const urlRef = React.useRef(audioUrl);
    React.useEffect(() => {
        if (urlRef.current !== audioUrl) {
            urlRef.current = audioUrl;
            setTime(0);
            setDuration(Number.NaN);
            setHasError(false);
        }
    }, [audioUrl]);

    return {
        audioRef,
        playing,
        time,
        duration,
        rate,
        hasError,
        expanded,
        setExpanded,
        fraction,
        activeIndex,
        toggle,
        seekTo,
        skipBy,
        cycleRate,
        retry,
        bind: {
            onPlay: () => setPlaying(true),
            onPause: () => setPlaying(false),
            onTimeUpdate: (event: React.SyntheticEvent<HTMLAudioElement>) => setTime(event.currentTarget.currentTime),
            onLoadedMetadata: (event: React.SyntheticEvent<HTMLAudioElement>) => setDuration(event.currentTarget.duration),
            onDurationChange: (event: React.SyntheticEvent<HTMLAudioElement>) => setDuration(event.currentTarget.duration),
            onError: () => {
                setHasError(true);
                setExpanded(true);
            },
        },
    };
}
