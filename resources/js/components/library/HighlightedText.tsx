import type { ReadingSentence, ReadingWord } from '@/types';
import { clamp } from '@/lib/reading';

interface HighlightedTextProps {
    text: string;
    sentences: ReadingSentence[];
    activeIndex: number | null;
    words?: ReadingWord[];
    evidence?: { start: number; end: number } | null;
    onWordClick?: (word: ReadingWord) => void;
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
 */
export function HighlightedText({
    text,
    sentences,
    activeIndex,
    words = [],
    evidence = null,
    onWordClick,
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
                    flags.active && !flags.evidence ? 'bg-highlight-soft' : '',
                    flags.word !== null ? 'cursor-pointer border-b border-dotted border-primary/55' : '',
                ]
                    .filter(Boolean)
                    .join(' ');

                if (flags.word !== null) {
                    const word = flags.word;
                    return (
                        <span
                            key={`${start}-${end}`}
                            role="button"
                            tabIndex={0}
                            data-sentence-active={flags.active ? 'true' : undefined}
                            title={word.meaning_fa ?? word.definition_en ?? word.word}
                            onClick={() => onWordClick?.(word)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onWordClick?.(word);
                                }
                            }}
                            className={`rounded-[2px] transition-colors hover:bg-primary/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${classes}`}
                        >
                            {text.slice(start, end)}
                        </span>
                    );
                }

                if (classes === '') {
                    return <span key={`${start}-${end}`}>{text.slice(start, end)}</span>;
                }

                return (
                    <span
                        key={`${start}-${end}`}
                        data-sentence-active={flags.active ? 'true' : undefined}
                        className={classes}
                    >
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
