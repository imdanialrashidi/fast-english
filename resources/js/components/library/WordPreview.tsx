import { useState } from 'react';
import { ChevronDown, Volume2 } from 'lucide-react';
import type { ReadingWord } from '@/types';

interface WordPreviewProps {
    words: ReadingWord[];
    onPlay?: (word: ReadingWord) => void;
    onPlayAll?: () => void;
    defaultOpen?: boolean;
    compact?: boolean;
    title?: string;
}

/**
 * The employer's «پیشخوانی» control: a small pill above the image that
 * opens the page/of-paragraph words with their Persian meaning (story and
 * Inside Reading) or a short English definition (IELTS). It never hides the
 * text or stops the narration; it only expands in place.
 */
export function WordPreview({
    words,
    onPlay,
    onPlayAll,
    defaultOpen = false,
    compact = false,
    title,
}: WordPreviewProps): React.JSX.Element | null {
    const [open, setOpen] = useState(defaultOpen);

    if (words.length === 0) {
        return null;
    }

    const heading = title ?? `پیش‌خوانی ${words.length.toLocaleString('fa-IR')} واژه`;

    return (
        <section className={`grid gap-2 ${compact ? '' : 'rounded-2xl'}`}>
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="fe-press inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-bold text-primary transition-colors hover:border-primary/40"
            >
                <Volume2 size={15} aria-hidden="true" />
                {heading}
                <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div className="grid gap-1.5 rounded-2xl border border-line bg-surface p-3">
                    {onPlayAll !== undefined && (
                        <button
                            type="button"
                            onClick={onPlayAll}
                            className="fe-press inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 text-[0.7rem] font-bold text-primary"
                        >
                            <Volume2 size={13} aria-hidden="true" />
                            پخش واژه‌ها با تکرار
                        </button>
                    )}
                    {words.map((word, index) => (
                        <div
                            key={`${word.word}-${index}`}
                            className="flex items-start justify-between gap-3 border-b border-line/70 py-1.5 last:border-0 last:pb-0"
                        >
                            <div className="flex min-w-0 items-center gap-1.5">
                                {word.audio_url !== null && onPlay !== undefined ? (
                                    <button
                                        type="button"
                                        onClick={() => onPlay(word)}
                                        aria-label={`پخش تلفظ ${word.word}`}
                                        className="fe-press grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-canvas text-primary hover:border-primary/40"
                                    >
                                        <Volume2 size={14} aria-hidden="true" />
                                    </button>
                                ) : null}
                                <span lang="en" dir="ltr" className="truncate font-en text-sm font-extrabold text-ink">
                                    {word.word}
                                </span>
                            </div>
                            <div className="grid min-w-0 justify-items-end gap-0.5 text-right">
                                {word.meaning_fa !== null && word.meaning_fa !== '' && (
                                    <span className="text-xs leading-6 font-bold text-ink">{word.meaning_fa}</span>
                                )}
                                {word.definition_en !== null && word.definition_en !== '' && (
                                    <span lang="en" dir="ltr" className="text-[0.7rem] leading-5 text-muted">
                                        {word.definition_en}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
