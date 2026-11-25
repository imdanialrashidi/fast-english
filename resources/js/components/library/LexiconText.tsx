import * as React from 'react';
import type { TedLexiconEntry } from '@/types';

interface LexiconTextProps {
    text: string;
    lexicon: Record<string, TedLexiconEntry>;
    onWordSelect: (entry: TedLexiconEntry & { word: string }) => void;
    onWordPlay?: (entry: TedLexiconEntry & { word: string }) => void;
}

interface Piece {
    text: string;
    entry: (TedLexiconEntry & { word: string }) | null;
}

/**
 * Static B2+ highlighting for a TED transcript. The server sends only the
 * words that actually occur in the talk; this component tokenises the
 * paragraph, keeps every original character (spaces, punctuation, curly
 * quotes), paints matched words with the calm reading highlight, and opens
 * the shared WordSheet on tap. A quick second tap plays the word.
 */
export function LexiconText({ text, lexicon, onWordSelect, onWordPlay }: LexiconTextProps): React.JSX.Element {
    const pieces = React.useMemo<Piece[]>(() => {
        const out: Piece[] = [];
        const pattern = /[A-Za-z][A-Za-z'’\-]*/g;
        let cursor = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(text)) !== null) {
            if (match.index > cursor) {
                out.push({ text: text.slice(cursor, match.index), entry: null });
            }
            const surface = match[0];
            const entry = lexicon[surface.toLowerCase()] ?? null;
            out.push({ text: surface, entry: entry === null ? null : { ...entry, word: surface } });
            cursor = match.index + surface.length;
        }

        if (cursor < text.length) {
            out.push({ text: text.slice(cursor), entry: null });
        }

        return out;
    }, [text, lexicon]);

    const lastTap = React.useRef<{ word: string; at: number }>({ word: '', at: 0 });

    const handle = (entry: TedLexiconEntry & { word: string }): void => {
        const now = Date.now();
        if (lastTap.current.word === entry.word && now - lastTap.current.at < 420) {
            lastTap.current = { word: '', at: 0 };
            onWordPlay?.(entry);

            return;
        }

        lastTap.current = { word: entry.word, at: now };
        onWordSelect(entry);
    };

    return (
        <span className="whitespace-pre-wrap">
            {pieces.map((piece, index) => {
                if (piece.entry === null) {
                    return <React.Fragment key={index}>{piece.text}</React.Fragment>;
                }

                const entry = piece.entry;
                return (
                    <button
                        key={index}
                        type="button"
                        onClick={() => handle(entry)}
                        aria-label={`${entry.word} — ${entry.fa}`}
                        className="cursor-pointer rounded-[3px] bg-highlight-soft px-[1px] text-inherit [box-decoration-break:clone] hover:bg-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        {piece.text}
                    </button>
                );
            })}
        </span>
    );
}
