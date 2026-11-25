import { Volume2, X } from 'lucide-react';
import type { ReadingWord } from '@/types';

export interface WordSheetWord {
    word: string;
    meaning_fa: string | null;
    definition_en: string | null;
    part_of_speech?: string | null;
    synonym?: string | null;
    level?: string | null;
    audio_url?: string | null;
}

interface WordSheetProps {
    word: ReadingWord | WordSheetWord | null;
    onClose: () => void;
    onPlay?: (word: WordSheetWord) => void;
}

/**
 * One small meaning panel for every highlighted reading word. It is the
 * single answer to a tap: word, short Persian meaning, short English
 * definition, an optional simple synonym, the CEFR band when known, and a
 * pronunciation button. It never covers the whole page and never stops the
 * persistent player unless the learner explicitly plays the word.
 */
export function WordSheet({ word, onClose, onPlay }: WordSheetProps): React.JSX.Element | null {
    if (word === null) {
        return null;
    }

    const meaning = word.meaning_fa ?? word.definition_en ?? '';
    const synonym = 'synonym' in word ? word.synonym : null;
    const level = 'level' in word ? word.level : null;
    const partOfSpeech = word.part_of_speech ?? null;
    const playable = word.audio_url !== undefined && word.audio_url !== null && onPlay !== undefined;

    return (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-50 mx-auto w-full max-w-[680px] px-3">
            <div
                role="dialog"
                aria-label={`معنی ${word.word}`}
                className="grid max-h-[46vh] gap-2 overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-[0_18px_44px_rgb(23_34_56_/_0.2)]"
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span lang="en" dir="ltr" className="font-en text-xl font-extrabold text-ink">
                            {word.word}
                        </span>
                        {level !== null && level !== '' && (
                            <span lang="en" dir="ltr" className="rounded-full bg-canvas px-2 py-0.5 font-en text-[0.68rem] font-bold text-primary">
                                {level}
                            </span>
                        )}
                        {partOfSpeech !== null && partOfSpeech !== '' && (
                            <span className="rounded-full bg-canvas px-2 py-0.5 text-[0.68rem] text-muted">{partOfSpeech}</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="بستن معنی"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-muted"
                    >
                        <X size={15} aria-hidden="true" />
                    </button>
                </div>

                {meaning !== '' && (
                    <p className="m-0 text-[1.0625rem] leading-8 font-bold text-ink">{meaning}</p>
                )}
                {word.definition_en !== null && word.definition_en !== '' && (
                    <p lang="en" dir="ltr" className="m-0 text-left font-en text-[0.82rem] leading-6 text-muted">
                        {word.definition_en}
                    </p>
                )}
                {synonym !== null && synonym !== '' && (
                    <p className="m-0 text-sm leading-7 text-muted">
                        مترادف ساده: <span lang="en" dir="ltr" className="font-en font-bold text-ink">{synonym}</span>
                    </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                    {playable && (
                        <button
                            type="button"
                            onClick={() => onPlay(word as WordSheetWord)}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-surface hover:bg-primary-hover"
                        >
                            <Volume2 size={16} aria-hidden="true" />
                            پخش تلفظ
                        </button>
                    )}
                    <span className="text-[0.7rem] leading-6 text-muted">دو بار روی واژه بزنی، تلفظ پخش می‌شود.</span>
                </div>
            </div>
        </div>
    );
}
