import * as React from 'react';
import { usePage } from '@inertiajs/react';
import { AudioConsole } from '@/components/AudioConsole';
import { usePlayer } from '@/lib/player';
import { useMediaSession } from '@/lib/media-session';
import type { SharedProps } from '@/types';

/**
 * Learner shell player (MEDIA-01/02): the visible console for the single
 * persistent audio element. It rests collapsed (play · lesson · speed ·
 * expand) and opens into the seek/skip console on demand; errors
 * auto-expand so they stay visible, and a failed progress save is
 * surfaced without opening the console.
 *
 * The visual surface lives in AudioConsole (shared with the public
 * sample); this adapter binds the persistent track and Media Session
 * metadata. Hook IDs are the long-standing browser-test contract.
 */
export function AudioPlayer(): React.JSX.Element | null {
    const {
        bindRef,
        audioRef,
        track,
        playing,
        buffering,
        time,
        duration,
        rate,
        bufferedFraction,
        hasError,
        expanded,
        setExpanded,
        saveError,
        retrySaveNow,
        toggle,
        seekToFraction,
        skipBy,
        cycleRate,
        retry,
    } = usePlayer();

    useMediaSession({
        title: track?.titleEn ?? null,
        album: track?.level ?? null,
        artwork: track?.coverUrl ?? null,
        audioRef,
        playing,
        position: time,
        duration,
        rate,
    });

    // Logged-out session with no bound lesson: no audio machinery at all
    // (the Blade shell had no element here either). Guests keep the
    // element once a track binds so sample playback persists.
    const { props } = usePage<SharedProps>();
    if (track === null && props.auth.user === null) {
        return null;
    }

    // No lesson bound yet (landing, first library visit): no visible
    // affordance renders — never a dead control. The audio element below
    // stays in a stable position either way so binding a track never
    // remounts it (a remount would orphan the event wiring).
    // A reading page can bind a slice of a chapter file. The console must
    // read relative to that slice; the element still stores absolute time.
    const start = track?.startSeconds ?? 0;
    const end = track === null ? 0 : (track.endSeconds ?? (Number.isFinite(duration) ? duration : 0));
    const boundedDuration = Math.max(0, end - start);
    const boundedTime = Math.min(Math.max(0, time - start), boundedDuration);
    const boundedFraction = boundedDuration > 0 ? boundedTime / boundedDuration : 0;
    const boundedBuffered =
        boundedDuration > 0
            ? Math.min(1, Math.max(0, (bufferedFraction * (Number.isFinite(duration) ? duration : 0) - start) / boundedDuration))
            : 0;

    const bar = track === null ? null : (
        <AudioConsole
            className="fe-playerbar"
            sectionLabel="پخش‌کننده صوت"
            seekLabel="جست‌وجو در صوت"
            title={track.titleEn}
            level={track.level}
            coverUrl={track.coverUrl}
            state={{
                playing,
                buffering,
                time: boundedTime,
                duration: boundedDuration,
                rate,
                fraction: boundedFraction,
                bufferedFraction: boundedBuffered,
                hasError,
                expanded,
                saveError,
            }}
            actions={{ setExpanded, toggle, seekToFraction, skipBy, cycleRate, retry, retrySaveNow }}
            showSaveError={track.kind !== 'reading'}
        />
    );

    return (
        <>
            {bar}
            {/* Stable position: binding a track never remounts this. */}
            <audio id="lesson-audio" ref={bindRef} preload="metadata" />
        </>
    );
}
