import * as React from 'react';
import { ChevronDown, Gauge, Pause, Play, RotateCcw, RotateCw, TriangleAlert } from 'lucide-react';
import { usePage } from '@inertiajs/react';
import { formatAudioTime } from '@/lib/audio';
import { usePlayer } from '@/lib/player';
import { useMediaSession } from '@/lib/media-session';
import type { SharedProps } from '@/types';

/**
 * M1 studio player (MEDIA-01/02): the visible console for the single
 * persistent audio element. It rests collapsed (play · lesson · speed ·
 * expand) and opens into the full seek/skip console on demand; errors
 * auto-expand so they stay visible.
 *
 * Hook IDs (#lesson-audio, #player-play, #player-seek, #player-speed,
 * #player-back/forward/toggle, #player-error/retry, #mini-player) are
 * the long-standing browser-test contract — the visual design around
 * them is new, the interaction model is unchanged.
 */
export function AudioPlayer(): React.JSX.Element | null {
    const {
        bindRef,
        audioRef,
        track,
        playing,
        time,
        duration,
        rate,
        fraction,
        hasError,
        expanded,
        setExpanded,
        saveError,
        retrySaveNow,
        toggle,
        seekTo,
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

    const rateLabel = `${rate}×`;
    const title = track !== null ? `${track.titleEn} (${track.level})` : 'پخش‌کننده آماده است';

    const onSeekInput = (event: React.FormEvent<HTMLInputElement>): void => {
        seekToFraction(Number(event.currentTarget.value));
    };

    // Logged-out session with no bound lesson: no audio machinery at all
    // (the Blade shell had no element here either). Guests keep the
    // element once a track binds so sample playback persists.
    const { props } = usePage<SharedProps>();
    if (track === null && props.auth.user === null) {
        return null;
    }

    // No lesson bound yet (landing, first library visit): no visible
    // affordance renders — never a dead control. The audio element
    // below stays in a stable position either way so binding a track
    // never remounts it (a remount would orphan the event wiring).
    const bar = track === null ? null : (
        <section className="fe-playerbar" data-expanded={expanded ? 'true' : 'false'} aria-label="پخش‌کننده صوت درس">
            <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_8px_28px_rgb(16_27_51/0.10)]">
                {/* Seek fill: decorative progress only (time text carries the value). */}
                <div aria-hidden="true" className="h-1 w-full bg-line">
                    <span
                        id="player-progress-fill"
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${Math.round(fraction * 100)}%` }}
                    />
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4">
                    <button
                        id="player-play"
                        type="button"
                        onClick={toggle}
                        aria-label={playing ? 'توقف' : 'پخش'}
                        className="inline-flex h-12 w-12 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-surface transition-colors duration-150 hover:bg-primary-hover disabled:cursor-default disabled:opacity-55"
                    >
                        {playing ? <Pause size={24} aria-hidden="true" /> : <Play size={24} aria-hidden="true" />}
                    </button>
                    <img
                        id="player-thumb"
                        src={track?.coverUrl ?? '/icons/icon-192.png'}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded-xl bg-canvas object-cover"
                    />
                    <div className="min-w-0 flex-1">
                        <p id="mini-player" role="status" className="m-0 truncate text-[0.9375rem] leading-6 font-bold">
                            {track !== null ? (
                                <>
                                    <span lang="en" dir="ltr">
                                        {track.titleEn}
                                    </span>{' '}
                                    <span lang="en" dir="ltr" className="font-en text-sm font-bold text-muted">
                                        {track.level}
                                    </span>
                                </>
                            ) : (
                                title
                            )}
                        </p>
                        <p className="m-0 font-en text-[0.8125rem] tabular-nums" dir="ltr">
                            <span id="player-current">{formatAudioTime(time)}</span>
                            {' / '}
                            <span id="player-duration">{formatAudioTime(duration)}</span>
                        </p>
                    </div>
                    <button
                        id="player-speed"
                        type="button"
                        onClick={cycleRate}
                        aria-label={`سرعت پخش: ${rateLabel}`}
                        title="سرعت پخش از ۰٫۷۵ تا ۱٫۵ برابر قابل تنظیم است"
                        className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1.5 transition-colors duration-150 hover:bg-canvas"
                    >
                        <Gauge size={16} aria-hidden="true" />
                        <span id="player-speed-label" dir="ltr" className="font-en text-[0.8125rem] font-bold tabular-nums">
                            {rateLabel}
                        </span>
                    </button>
                    <button
                        id="player-toggle"
                        type="button"
                        onClick={() => setExpanded(!expanded)}
                        aria-expanded={expanded ? 'true' : 'false'}
                        aria-controls="player-detail"
                        aria-label={expanded ? 'پنهان کردن کنترل‌های بیشتر' : 'نمایش کنترل‌های بیشتر'}
                        className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface transition-colors duration-150 hover:bg-canvas"
                    >
                        <ChevronDown size={20} aria-hidden="true" className={expanded ? 'rotate-180' : ''} />
                    </button>
                </div>
                <div id="player-detail" className={expanded ? 'grid gap-3 px-4 pt-1 pb-4' : 'hidden'}>
                    <input
                        id="player-seek"
                        type="range"
                        min={0}
                        max={100}
                        step={0.1}
                        value={Math.round(fraction * 1000) / 10}
                        onInput={onSeekInput}
                        onChange={onSeekInput}
                        aria-label="جست‌وجو در صوت درس"
                        className="fe-seek h-11 w-full cursor-pointer appearance-none rounded-full bg-transparent"
                        style={
                            {
                                background: `linear-gradient(to left, var(--color-accent) ${Math.round(fraction * 100)}%, var(--color-line) ${Math.round(fraction * 100)}%)`,
                                backgroundSize: '100% 0.375rem',
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center',
                                // Compat probe for the progress-fill capture
                                // (design-theme.spec.ts): percent as a var.
                                '--fe-seek-pct': `${Math.round(fraction * 1000) / 10}%`,
                            } as React.CSSProperties
                        }
                    />
                    <div className="flex items-center justify-center gap-6">
                        <button
                            id="player-back"
                            type="button"
                            onClick={() => skipBy(-10)}
                            aria-label="۱۰ ثانیه به عقب"
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1 rounded-full border border-line bg-surface px-3 py-2 transition-colors duration-150 hover:bg-canvas"
                        >
                            <RotateCcw size={20} aria-hidden="true" />
                            <span dir="ltr" className="font-en text-sm font-bold tabular-nums">
                                10
                            </span>
                        </button>
                        <button
                            id="player-forward"
                            type="button"
                            onClick={() => skipBy(10)}
                            aria-label="۱۰ ثانیه به جلو"
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1 rounded-full border border-line bg-surface px-3 py-2 transition-colors duration-150 hover:bg-canvas"
                        >
                            <RotateCw size={20} aria-hidden="true" />
                            <span dir="ltr" className="font-en text-sm font-bold tabular-nums">
                                10
                            </span>
                        </button>
                    </div>
                    <p id="player-status" role="status" className="m-0 text-sm leading-7 text-muted" />
                    <p id="player-error" role="alert" hidden={!hasError} className="m-0 flex items-center gap-2 rounded-2xl border border-line bg-canvas px-4 py-3 text-danger">
                        <TriangleAlert size={20} aria-hidden="true" />
                        <span id="player-error-text">پخش صوت ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.</span>
                    </p>
                    <p className="m-0" hidden={!hasError}>
                        <button
                            id="player-retry"
                            type="button"
                            onClick={retry}
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-surface transition-colors duration-150 hover:bg-primary-hover"
                        >
                            <RotateCw size={20} aria-hidden="true" />
                            تلاش دوباره
                        </button>
                    </p>
                    <p id="progress-error" role="alert" hidden={saveError === null} className="m-0 flex items-center gap-2 rounded-2xl border border-line bg-canvas px-4 py-3 text-danger">
                        <TriangleAlert size={20} aria-hidden="true" />
                        <span id="progress-error-text">{saveError ?? ''}</span>
                    </p>
                    <p className="m-0" hidden={saveError === null}>
                        <button
                            id="progress-retry"
                            type="button"
                            onClick={retrySaveNow}
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink transition-colors duration-150 hover:bg-canvas"
                        >
                            <RotateCw size={20} aria-hidden="true" />
                            تلاش دوباره برای ذخیره
                        </button>
                    </p>
                </div>
            </div>
        </section>
    );

    return (
        <>
            {bar}
            {/* Stable position: binding a track never remounts this. */}
            <audio id="lesson-audio" ref={bindRef} preload="metadata" />
        </>
    );
}
