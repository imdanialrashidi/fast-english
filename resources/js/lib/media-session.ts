import * as React from 'react';

/**
 * Media Session wiring for the one audio transport (owner follow-up
 * 2026-10-22). Sets lock-screen/OS metadata and the standard play,
 * pause, seek, and skip handlers when the browser exposes the API.
 *
 * This is metadata/controls only: it does not promise background audio
 * (a non-goal). Feature detection keeps Safari/Firefox and old Chromium
 * on the normal in-page controls with no errors.
 */
export interface MediaSessionOptions {
    title: string | null;
    artist?: string;
    album?: string | null;
    artwork?: string | null;
    audioRef: React.RefObject<HTMLAudioElement | null>;
    playing: boolean;
    position: number;
    duration: number;
    rate: number;
}

function supported(): boolean {
    return typeof navigator !== 'undefined'
        && 'mediaSession' in navigator
        && typeof MediaMetadata !== 'undefined';
}

export function useMediaSession({
    title,
    artist = 'Fast English',
    album,
    artwork,
    audioRef,
    playing,
    position,
    duration,
    rate,
}: MediaSessionOptions): void {
    React.useEffect(() => {
        if (!supported() || title === null) {
            return;
        }

        const session = navigator.mediaSession;
        session.metadata = new MediaMetadata({
            title,
            artist,
            album: album ?? '',
            artwork: artwork !== null && artwork !== undefined && artwork !== ''
                ? [{ src: artwork, sizes: '512x512' }]
                : [],
        });

        return () => {
            session.metadata = null;
        };
    }, [title, artist, album, artwork]);

    React.useEffect(() => {
        if (!supported()) {
            return;
        }

        const session = navigator.mediaSession;
        const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
            ['play', () => {
                const element = audioRef.current;
                if (element !== null) {
                    void element.play().catch(() => undefined);
                }
            }],
            ['pause', () => {
                audioRef.current?.pause();
            }],
            ['seekbackward', (details) => {
                const element = audioRef.current;
                if (element !== null) {
                    element.currentTime = Math.max(0, element.currentTime - (details.seekOffset ?? 10));
                }
            }],
            ['seekforward', (details) => {
                const element = audioRef.current;
                if (element !== null) {
                    element.currentTime = Math.min(element.duration || Infinity, element.currentTime + (details.seekOffset ?? 10));
                }
            }],
            ['seekto', (details) => {
                const element = audioRef.current;
                if (element !== null && typeof details.seekTime === 'number') {
                    element.currentTime = Math.max(0, details.seekTime);
                }
            }],
        ];

        for (const [action, handler] of handlers) {
            try {
                session.setActionHandler(action, handler);
            } catch {
                // Some engines reject individual actions; keep the rest.
            }
        }

        return () => {
            for (const [action] of handlers) {
                try {
                    session.setActionHandler(action, null);
                } catch {
                    // Ignore unsupported cleanup.
                }
            }
        };
    }, [audioRef]);

    React.useEffect(() => {
        if (!supported()) {
            return;
        }
        navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }, [playing]);

    React.useEffect(() => {
        if (!supported() || !Number.isFinite(duration) || duration <= 0) {
            return;
        }
        try {
            navigator.mediaSession.setPositionState({
                duration,
                playbackRate: rate,
                position: Math.min(Math.max(0, position), duration),
            });
        } catch {
            // Position state is optional; playback is unaffected.
        }
    }, [position, duration, rate]);
}
