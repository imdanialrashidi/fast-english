import * as React from 'react';
import type { ReadingSentence, ReadingWord } from '@/types';
import { clamp } from '@/lib/reading';

interface HighlightedTextProps {
    text: string;
    sentences: ReadingSentence[];
    activeIndex: number | null;
    words?: ReadingWord[];
    evidence?: { start: number; end: number } | null;
    onWordSelect?: (word: ReadingWord) => void;
    onWordPlay?: (word: ReadingWord) => void;
    className?: string;
}

interface SegmentFlags {
    active: boolean;
    evidence: boolean;
    word: ReadingWord | null;
}

/**
 * Splits the page text at every sentence, word and evidence boundary and
 * paints the flags on the resulting slices. The text itself is never
 * rewritten: only `text.slice(start, end)` ranges are rendered, so spaces,
 * punctuation and dialogue quotes stay exactly as the pack shipped them.
 *
 * Owner instruction 2026-11-25: a reading word is a soft background
 * highlight, never a dotted underline. One tap opens the small meaning
 * panel; a quick second tap on the same word plays its pronunciation.
 */
export function HighlightedText({
    text,
    sentences,
    activeIndex,
    words = [],
    evidence = null,
    onWordSelect,
    onWordPlay,
    className = '',
}: HighlightedTextProps): React.JSX.Element {
    const length = text.length;
    const boundaries = new Set<number>([0, length]);

    for (const sentence of sentences) {
        if (sentence.end_utf16 > sentence.start_utf16) {
            boundaries.add(clamp(sentence.start_utf16, 0, length));
            boundaries.add(clamp(sentence.end_utf16, 0, length));
        }
    }
    for (const word of words) {
        if (word.start_utf16 !== null && word.end_utf16 !== null && word.end_utf16 > word.start_utf16) {
            boundaries.add(clamp(word.start_utf16, 0, length));
            boundaries.add(clamp(word.end_utf16, 0, length));
        }
    }
    if (evidence !== null) {
        boundaries.add(clamp(evidence.start, 0, length));
        boundaries.add(clamp(evidence.end, 0, length));
    }

    const points = [...boundaries].sort((left, right) => left - right);
    const active = activeIndex !== null ? sentences[activeIndex] : undefined;
    const lastTap = React.useRef<{ word: string; at: number }>({ word: '', at: 0 });

    const activate = (word: ReadingWord): void => {
        const now = Date.now();
        if (lastTap.current.word === word.word && now - lastTap.current.at < 420) {
            lastTap.current = { word: '', at: 0 };
            onWordPlay?.(word);

            return;
        }

        lastTap.current = { word: word.word, at: now };
        onWordSelect?.(word);
    };

    return (
        <span className={`whitespace-pre-wrap ${className}`}>
            {points.slice(0, -1).map((start, index) => {
                const end = points[index + 1] ?? start;
                if (end <= start) {
                    return null;
                }

                const flags = flagsFor(start, end, active, activeIndex, words, evidence);
                const classes = [
                    flags.evidence ? 'bg-highlight shadow-[inset_0_-2px_0_var(--color-highlight-rule)]' : '',
                    flags.active && !flags.evidence ? 'bg-highlight-soft/60' : '',
                    flags.word !== null ? 'cursor-pointer rounded-[3px] bg-highlight-soft px-[1px] text-ink [box-decoration-break:clone] hover:bg-highlight' : '',
                ]
                    .filter(Boolean)
                    .join(' ');

                if (flags.word !== null) {
                    const word = flags.word;
                    return (
                        <button
                            key={`${start}-${end}`}
                            type="button"
                            data-sentence-active={flags.active ? 'true' : undefined}
                            aria-label={word.meaning_fa !== null && word.meaning_fa !== '' ? `${word.word} — ${word.meaning_fa}` : word.word}
                            onClick={() => activate(word)}
                            className={`${classes} text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
                        >
                            {text.slice(start, end)}
                        </button>
                    );
                }

                if (classes === '') {
                    return <span key={`${start}-${end}`}>{text.slice(start, end)}</span>;
                }

                return (
                    <span key={`${start}-${end}`} data-sentence-active={flags.active ? 'true' : undefined} className={classes}>
                        {text.slice(start, end)}
                    </span>
                );
            })}
        </span>
    );
}

function flagsFor(
    start: number,
    end: number,
    active: ReadingSentence | undefined,
    activeIndex: number | null,
    words: ReadingWord[],
    evidence: { start: number; end: number } | null,
): SegmentFlags {
    const word =
        words.find(
            (candidate) =>
                candidate.start_utf16 !== null &&
                candidate.end_utf16 !== null &&
                candidate.start_utf16 <= start &&
                candidate.end_utf16 >= end,
        ) ?? null;

    return {
        active:
            activeIndex !== null &&
            active !== undefined &&
            active.start_utf16 <= start &&
            active.end_utf16 >= end,
        evidence: evidence !== null && evidence.start <= start && evidence.end >= end,
        word,
    };
}
