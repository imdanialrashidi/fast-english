import { Pause, Play, Repeat2 } from 'lucide-react';
import { formatClock } from '@/lib/reading';

interface ReaderAudioBarProps {
    disabled?: boolean;
    playing: boolean;
    timeMs: number;
    durationMs: number;
    onToggle: () => void;
    onSeek: (ms: number) => void;
    rate: number;
    onRate: (rate: number) => void;
    continuous?: boolean;
    onContinuous?: (value: boolean) => void;
    label?: string;
}

/**
 * The reading transport: real playback position, seek, three speeds and an
 * optional continuous mode. It sits above the app's tab bar, never over the
 * last line of text.
 */
export function ReaderAudioBar({
    disabled = false,
    playing,
    timeMs,
    durationMs,
    onToggle,
    onSeek,
    rate,
    onRate,
    continuous,
    onContinuous,
    label = 'پخش خوانش',
}: ReaderAudioBarProps): React.JSX.Element {
    if (disabled) {
        return (
            <div className="rounded-2xl border border-dashed border-line bg-surface/80 px-4 py-3 text-xs leading-6 text-muted">
                برای این بخش صدای تأییدشده‌ای ثبت نشده؛ متن و واژه‌ها در دسترس‌اند.
            </div>
        );
    }

    const max = Math.max(0, durationMs);
    const value = Math.min(timeMs, max);

    return (
        <div className="grid w-full gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-[0_12px_32px_rgb(23_34_56_/_0.12)] backdrop-blur lg:mx-auto lg:max-w-[720px]">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={playing ? 'توقف' : label}
                    className="fe-press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-surface transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
                </button>

                <div className="grid min-w-0 flex-1 gap-1">
                    <input
                        type="range"
                        min={0}
                        max={max}
                        step={50}
                        value={value}
                        onChange={(event) => onSeek(Number(event.target.value))}
                        aria-label="جای پخش"
                        className="h-2 w-full cursor-pointer accent-primary"
                    />
                    <div className="flex items-center justify-between font-en text-[0.65rem] font-bold text-muted" dir="ltr">
                        <span>{formatClock(value)}</span>
                        <span>{formatClock(max)}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1" role="group" aria-label="سرعت پخش">
                    {[0.8, 1, 1.15].map((speed) => (
                        <button
                            key={speed}
                            type="button"
                            onClick={() => onRate(speed)}
                            aria-pressed={rate === speed}
                            className={`min-h-9 rounded-full border px-3 font-en text-[0.7rem] font-bold transition-colors ${
                                rate === speed
                                    ? 'border-ink bg-ink text-surface'
                                    : 'border-line bg-canvas text-muted hover:text-ink'
                            }`}
                        >
                            {speed}×
                        </button>
                    ))}
                </div>

                {onContinuous !== undefined && continuous !== undefined && (
                    <button
                        type="button"
                        onClick={() => onContinuous(!continuous)}
                        aria-pressed={continuous}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[0.7rem] font-bold transition-colors ${
                            continuous
                                ? 'border-accent-strong bg-accent-strong/10 text-accent-strong'
                                : 'border-line bg-canvas text-muted hover:text-ink'
                        }`}
                    >
                        <Repeat2 size={13} aria-hidden="true" />
                        پخش پیوسته
                    </button>
                )}
            </div>
        </div>
    );
}
