import * as React from 'react';
import { usePlayer } from '@/lib/player';

interface ReaderTrackOptions {
    /** Null means this page has no approved narration. */
    audioUrl: string | null;
    /** Stable identity for the page/paragraph; changing it rebinds. */
    pageKey: string;
    titleEn: string;
    level: string;
    coverUrl: string | null;
    audioRevision: number;
    /** Absolute chapter offset (ms) when the file is a whole chapter. */
    startMs?: number | null;
    /** Absolute chapter end (ms); omitted means the file duration. */
    endMs?: number | null;
    /** Resume position relative to the page start (ms). */
    initialPositionMs?: number;
    /** Continue playing as soon as the next page is ready. */
    autoplay?: boolean;
}

export interface ReaderTrack {
    timeMs: number;
    durationMs: number;
    playing: boolean;
    buffering: boolean;
    hasError: boolean;
    toggle: () => void;
    play: () => void;
    pause: () => void;
    seekToMs: (ms: number) => void;
}

/**
 * Binds one reading page to the single persistent player.
 *
 * Story and IELTS pages used to mount their own <audio> + transport, so
 * the shell player and the page player could both be visible. This hook
 * makes the page a slice of the one element: the title/level/cover identify
 * the book, `startMs`/`endMs` keep the console relative to the page, and
 * the page decides when to turn and what to save. No lesson progress is
 * written by the player; the reader owns its reading-progress endpoint.
 */
export function useReaderTrack(options: ReaderTrackOptions): ReaderTrack {
    const { setTrack, clearTrack, time, duration, playing, buffering, hasError, toggle, play, pause, seekTo } =
        usePlayer();

    const startMs = Math.max(0, options.startMs ?? 0);
    const endMs = options.endMs !== null && options.endMs !== undefined ? Math.max(startMs, options.endMs) : null;
    const autoplayRef = React.useRef(false);
    autoplayRef.current = options.autoplay === true;
    const initialRef = React.useRef(options.initialPositionMs ?? 0);
    initialRef.current = options.initialPositionMs ?? 0;

    React.useEffect(() => {
        if (options.audioUrl === null) {
            clearTrack();

            return;
        }

        setTrack(
            {
                kind: 'reading',
                key: options.pageKey,
                lessonId: 0,
                audioUrl: options.audioUrl,
                audioRevision: options.audioRevision,
                titleEn: options.titleEn,
                level: options.level,
                coverUrl: options.coverUrl,
                initialPosition: Math.max(0, initialRef.current) / 1000,
                startSeconds: startMs / 1000,
                endSeconds: endMs === null ? undefined : endMs / 1000,
                autoplay: autoplayRef.current,
            },
            { canSave: false, onCompleted: () => {}, onStale: () => {} },
        );
        // The identity is the page/source; a parent re-render must not rebind.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options.audioUrl, options.pageKey, options.audioRevision, startMs, endMs]);

    const absoluteDuration = Number.isFinite(duration) ? duration * 1000 : 0;
    const boundedEnd = endMs ?? (absoluteDuration > 0 ? absoluteDuration : startMs);
    const relativeTime = Math.min(Math.max(0, time * 1000 - startMs), Math.max(0, boundedEnd - startMs));
    const relativeDuration = Math.max(0, boundedEnd - startMs);

    return {
        timeMs: relativeTime,
        durationMs: relativeDuration,
        playing,
        buffering,
        hasError,
        toggle,
        play,
        pause,
        seekToMs: (ms: number) => seekTo(startMs / 1000 + Math.max(0, ms) / 1000),
    };
}
