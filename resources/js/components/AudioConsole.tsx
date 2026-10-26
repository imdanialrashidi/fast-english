import * as React from 'react';
import { ChevronDown, Gauge, LoaderCircle, Pause, Play, RotateCcw, RotateCw, TriangleAlert } from 'lucide-react';
import { formatAudioTime } from '@/lib/audio';

/**
 * One player surface for the learner shell and the public sample.
 *
 * The learner bar and the sample card used to be two hand-copied consoles
 * with the same hook IDs; this module is the single visual/interaction
 * definition. The adapters own the audio element and state
 * (`lib/player.tsx` for the persistent shell, `lib/audio.ts` for the
 * public page); this component only renders and forwards user intent.
 *
 * Hook IDs (#player-play, #player-seek, #player-back/forward/toggle,
 * #player-speed, #player-current/duration, #player-error/retry,
 * #player-progress-fill, #mini-player) stay stable: they are the browser
 * media-test contract.
 */

export interface AudioConsoleState {
    playing: boolean;
    buffering: boolean;
    time: number;
    duration: number;
    rate: number;
    fraction: number;
    bufferedFraction: number;
    hasError: boolean;
    expanded: boolean;
    saveError: string | null;
}

export interface AudioConsoleActions {
    setExpanded: (value: boolean) => void;
    toggle: () => void;
    seekToFraction: (percent: number) => void;
    skipBy: (delta: number) => void;
    cycleRate: () => void;
    retry: () => void;
    retrySaveNow: () => void;
}

interface AudioConsoleProps {
    state: AudioConsoleState;
    actions: AudioConsoleActions;
    title: string;
    level: string | null;
    coverUrl: string | null;
    sectionLabel: string;
    seekLabel: string;
    className?: string;
    /** The learner shell can fail to save progress; the sample cannot. */
    showSaveError?: boolean;
}

const numberFormat = new Intl.NumberFormat('fa-IR');

export function AudioConsole({
    state,
    actions,
    title,
    level,
    coverUrl,
    sectionLabel,
    seekLabel,
    className = '',
    showSaveError = false,
}: AudioConsoleProps): React.JSX.Element {
    const percent = Math.round(state.fraction * 100);
    const bufferedPercent = Math.round(state.bufferedFraction * 100);
    const timeLabel = `${formatAudioTime(state.time)} از ${formatAudioTime(state.duration)}`;

    return (
        <section
            className={className}
            data-expanded={state.expanded ? 'true' : 'false'}
            aria-label={sectionLabel}
            aria-busy={state.buffering ? 'true' : undefined}
        >
            <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-elev">
                {/* Seek fill: decorative progress only (the time text and the
                    expanded range carry the value). */}
                <div aria-hidden="true" className="relative h-1 w-full bg-line">
                    <span
                        className="pointer-events-none absolute inset-y-0 start-0 bg-accent/25"
                        style={{ width: `${bufferedPercent}%` }}
                    />
                    <span
                        id="player-progress-fill"
                        className="pointer-events-none absolute inset-y-0 start-0 rounded-full bg-accent"
                        style={{ width: `${percent}%` }}
                    />
                </div>

                <div className="flex items-center gap-2 px-2.5 py-2.5 min-[380px]:gap-3 sm:px-3.5">
                    {!state.expanded && (
                        <button
                            id="player-play"
                            type="button"
                            onClick={actions.toggle}
                            aria-label={state.playing ? 'توقف' : 'پخش'}
                            className="inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-surface transition-colors duration-150 hover:bg-primary-hover disabled:cursor-default disabled:opacity-55"
                        >
                            {state.buffering ? (
                                <LoaderCircle size={22} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                            ) : state.playing ? (
                                <Pause size={24} aria-hidden="true" />
                            ) : (
                                <Play size={24} aria-hidden="true" className="translate-x-px" />
                            )}
                        </button>
                    )}

                    <img
                        id="player-thumb"
                        src={coverUrl ?? '/icons/icon-192.png'}
                        alt=""
                        width={44}
                        height={44}
                        loading="lazy"
                        className="hidden h-11 w-11 shrink-0 rounded-xl border border-line bg-canvas object-cover sm:block"
                    />

                    <div className="min-w-0 flex-1">
                        <p id="mini-player" role="status" dir="ltr" className="m-0 flex min-w-0 items-center gap-2 text-left">
                            <span lang="en" dir="ltr" className="truncate text-[0.9375rem] leading-6 font-bold">
                                {title}
                            </span>
                            {level !== null && (
                                <span lang="en" dir="ltr" className="fe-chip shrink-0 px-1.5 py-0 text-[0.6875rem] font-bold">
                                    {level}
                                </span>
                            )}
                        </p>
                        <p className="m-0 flex items-center gap-1.5 font-en text-[0.8125rem] leading-5 text-muted tabular-nums" dir="ltr">
                            <span id="player-current">{formatAudioTime(state.time)}</span>
                            <span aria-hidden="true">/</span>
                            <span id="player-duration">{formatAudioTime(state.duration)}</span>
                        </p>
                    </div>

                    <button
                        id="player-speed"
                        type="button"
                        onClick={actions.cycleRate}
                        aria-label={`سرعت پخش: ${state.rate}×`}
                        title="سرعت پخش از ۰٫۷۵ تا ۱٫۵ برابر قابل تنظیم است"
                        className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1.5 transition-colors duration-150 hover:bg-canvas"
                    >
                        <Gauge size={16} aria-hidden="true" className="hidden min-[420px]:block" />
                        <span id="player-speed-label" dir="ltr" className="font-en text-[0.8125rem] font-bold tabular-nums">
                            {state.rate}×
                        </span>
                    </button>

                    <button
                        id="player-toggle"
                        type="button"
                        onClick={() => actions.setExpanded(!state.expanded)}
                        aria-expanded={state.expanded ? 'true' : 'false'}
                        aria-controls="player-detail"
                        aria-label={state.expanded ? 'پنهان کردن کنترل‌های بیشتر' : 'نمایش کنترل‌های بیشتر'}
                        className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface transition-colors duration-150 hover:bg-canvas"
                    >
                        <ChevronDown size={20} aria-hidden="true" className={state.expanded ? 'rotate-180' : ''} />
                    </button>
                </div>

                {showSaveError && state.saveError !== null && !state.expanded && (
                    <p role="alert" className="m-0 flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-2 text-sm leading-7 text-danger">
                        <TriangleAlert size={18} aria-hidden="true" />
                        ذخیره پیشرفت ممکن نشد.
                        <button
                            type="button"
                            onClick={actions.retrySaveNow}
                            className="inline-flex min-h-11 cursor-pointer items-center font-bold text-primary underline underline-offset-4"
                        >
                            تلاش دوباره
                        </button>
                    </p>
                )}

                <div id="player-detail" className={state.expanded ? 'grid gap-3 border-t border-line px-3.5 pt-3 pb-4 sm:px-4' : 'hidden'}>
                    <div className="flex items-center justify-between font-en text-xs text-muted tabular-nums" dir="rtl">
                        <span dir="ltr">{formatAudioTime(state.time)}</span>
                        <span dir="ltr">{formatAudioTime(state.duration)}</span>
                    </div>

                    <input
                        id="player-seek"
                        type="range"
                        min={0}
                        max={100}
                        step={0.1}
                        value={Math.round(state.fraction * 1000) / 10}
                        onInput={(event) => actions.seekToFraction(Number(event.currentTarget.value))}
                        onChange={(event) => actions.seekToFraction(Number(event.currentTarget.value))}
                        aria-label={seekLabel}
                        aria-valuetext={timeLabel}
                        className="fe-seek h-11 w-full cursor-pointer appearance-none rounded-full bg-transparent"
                        style={
                            {
                                // Compact progress fill (percent as a var keeps
                                // one CSS definition for both engines and the
                                // browser capture contract).
                                '--fe-seek-pct': `${percent}%`,
                            } as React.CSSProperties
                        }
                    />

                    <div className="flex items-center justify-center gap-5 sm:gap-7">
                        <button
                            id="player-back"
                            type="button"
                            onClick={() => actions.skipBy(-10)}
                            aria-label="۱۰ ثانیه به عقب"
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1 rounded-full border border-line bg-surface px-3 py-2 transition-colors duration-150 hover:bg-canvas"
                        >
                            <RotateCcw size={20} aria-hidden="true" />
                            <span dir="ltr" className="font-en text-sm font-bold tabular-nums">
                                10
                            </span>
                        </button>
                        {state.expanded && (
                            <button
                                id="player-play"
                                type="button"
                                onClick={actions.toggle}
                                aria-label={state.playing ? 'توقف' : 'پخش'}
                                className="inline-flex h-14 w-14 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-surface shadow-elev transition-colors duration-150 hover:bg-primary-hover"
                            >
                                {state.buffering ? (
                                    <LoaderCircle size={26} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                                ) : state.playing ? (
                                    <Pause size={28} aria-hidden="true" />
                                ) : (
                                    <Play size={28} aria-hidden="true" className="translate-x-px" />
                                )}
                            </button>
                        )}
                        <button
                            id="player-forward"
                            type="button"
                            onClick={() => actions.skipBy(10)}
                            aria-label="۱۰ ثانیه به جلو"
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1 rounded-full border border-line bg-surface px-3 py-2 transition-colors duration-150 hover:bg-canvas"
                        >
                            <RotateCw size={20} aria-hidden="true" />
                            <span dir="ltr" className="font-en text-sm font-bold tabular-nums">
                                10
                            </span>
                        </button>
                    </div>

                    <p id="player-status" role="status" className="m-0 min-h-5 text-center text-xs leading-5 text-muted">
                        {state.buffering ? 'در حال بارگذاری صوت…' : ''}
                    </p>

                    <p id="player-error" role="alert" hidden={!state.hasError} className="m-0 flex items-center gap-2 rounded-2xl border border-line bg-canvas px-4 py-3 text-danger">
                        <TriangleAlert size={20} aria-hidden="true" />
                        <span id="player-error-text">پخش صوت ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.</span>
                    </p>
                    <p className="m-0" hidden={!state.hasError}>
                        <button
                            id="player-retry"
                            type="button"
                            onClick={actions.retry}
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-surface transition-colors duration-150 hover:bg-primary-hover"
                        >
                            <RotateCw size={20} aria-hidden="true" />
                            تلاش دوباره
                        </button>
                    </p>

                    {showSaveError && state.saveError !== null && (
                        <>
                            <p id="progress-error" role="alert" className="m-0 flex items-center gap-2 rounded-2xl border border-line bg-canvas px-4 py-3 text-danger">
                                <TriangleAlert size={20} aria-hidden="true" />
                                <span id="progress-error-text">{state.saveError}</span>
                            </p>
                            <p className="m-0">
                                <button
                                    id="progress-retry"
                                    type="button"
                                    onClick={actions.retrySaveNow}
                                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink transition-colors duration-150 hover:bg-canvas"
                                >
                                    <RotateCw size={20} aria-hidden="true" />
                                    تلاش دوباره برای ذخیره
                                </button>
                            </p>
                        </>
                    )}
                </div>
            </div>
            <span className="sr-only">{numberFormat.format(Math.round(percent))} درصد از صوت پخش شده است.</span>
        </section>
    );
}
