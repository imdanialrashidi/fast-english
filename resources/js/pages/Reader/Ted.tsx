import { Head } from '@inertiajs/react';
import { BookOpen, ChevronDown, Clock, Headphones } from 'lucide-react';
import * as React from 'react';
import { LexiconText } from '@/components/library/LexiconText';
import { WordSheet, type WordSheetWord } from '@/components/library/WordSheet';
import type { FunctionComponent, ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import { usePlayerActions } from '@/lib/player';
import type { SharedProps, TedLexiconEntry, TedTalkPayload } from '@/types';

/**
 * Standalone TED talk (owner instruction 2026-11-22).
 *
 * A talk is its own article: its own section, URL, cover, transcript and
 * source line. It is not a seventh tab inside a podcast topic, and the
 * transcript is plain text — no sentence highlight, no cue-follow scroll.
 * The fixed shell player is the only audio surface.
 */

interface TedProps extends SharedProps {
    talk: TedTalkPayload;
}

function estimateMinutes(seconds: number): number {
    return Math.max(1, Math.round(seconds / 60));
}

export const TedShow: FunctionComponent<TedProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    talk,
}: TedProps): React.JSX.Element => {
    const { setTrack } = usePlayerActions();
    const minutes = estimateMinutes(talk.duration_seconds);
    const [activeWord, setActiveWord] = React.useState<WordSheetWord | null>(null);
    const wordAudioRef = React.useRef<HTMLAudioElement | null>(null);

    const toSheet = (entry: TedLexiconEntry & { word: string }): WordSheetWord => ({
        word: entry.word,
        meaning_fa: entry.fa,
        definition_en: entry.en,
        part_of_speech: entry.pos,
        synonym: entry.syn,
        level: entry.level,
        audio_url: entry.audio_url,
    });

    const playWord = (word: WordSheetWord): void => {
        const element = wordAudioRef.current;
        if (element === null || word.audio_url === undefined || word.audio_url === null) {
            return;
        }

        element.src = word.audio_url;
        void element.play().catch(() => undefined);
    };

    // Bind the talk to the one persistent element. TED listening never
    // writes lesson progress; the console owns play/seek/speed.
    React.useEffect(() => {
        setTrack(
            {
                kind: 'ted',
                key: `ted:${talk.slug}`,
                lessonId: talk.id,
                audioUrl: talk.audio_url,
                audioRevision: talk.audio_revision,
                titleEn: talk.title_en,
                level: 'TED',
                coverUrl: talk.cover_url,
                initialPosition: 0,
            },
            { canSave: false, onCompleted: () => {}, onStale: () => {} },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [talk.id]);

    return (
        <>
            <Head title={`${talk.title_en} (TED Talk)`} />
            <ScreenHeader
                title={talk.title_en}
                titleLang="en"
                width="reading"
                back={{ href: '/app/ted', label: 'بازگشت به TED' }}
            />
            <div className="mx-auto grid w-full max-w-[760px] gap-5 px-4 py-5 sm:gap-6 sm:py-7">
                <header className="grid gap-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                        <span className="fe-chip px-2 py-0.5 font-en text-[0.75rem] font-bold">TED Talk</span>
                        <span aria-hidden="true">·</span>
                        <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[0.72rem] font-bold text-accent-strong">
                            {talk.area_label}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1.5">
                            <Clock size={16} aria-hidden="true" />
                            {minutes.toLocaleString('fa-IR')} دقیقه
                        </span>
                        {talk.speaker !== '' && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span lang="en" dir="ltr" className="font-en">
                                    {talk.speaker}
                                </span>
                            </>
                        )}
                    </div>
                    <h1
                        lang="en"
                        dir="ltr"
                        className="m-0 text-left font-en text-[2rem] leading-[1.3] font-extrabold tracking-tight text-balance sm:text-[2.6rem]"
                    >
                        {talk.title_en}
                    </h1>
                    <p className="m-0 flex items-start gap-2 text-xs leading-6 text-muted">
                        <Headphones size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                        پخش این گفتار از نوار صوتی پایین صفحه انجام می‌شود؛ متن و واژه‌ها همیشه در دسترس‌اند.
                    </p>
                </header>

                <details className="fe-ted-words group rounded-3xl border border-line bg-surface">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                        <BookOpen size={18} aria-hidden="true" className="shrink-0 text-primary" />
                        <span lang="en" dir="ltr" className="font-en text-[0.9375rem] font-bold">
                            new words
                        </span>
                        <span className="text-xs text-muted">{talk.words.length.toLocaleString('fa-IR')} واژه</span>
                        <ChevronDown
                            size={18}
                            aria-hidden="true"
                            className="fe-ted-chevron ms-auto shrink-0 text-muted"
                        />
                    </summary>
                    <dl className="m-0 grid gap-x-6 gap-y-3 border-t border-line px-4 pt-3 pb-4 sm:grid-cols-2">
                        {talk.words.map((word) => (
                            <div key={word.word} className="grid gap-0.5">
                                <dt lang="en" dir="ltr" className="text-left font-en text-[0.9375rem] font-bold">
                                    {word.word}
                                </dt>
                                <dd dir="ltr" className="m-0 flex flex-wrap items-baseline gap-x-2 text-left">
                                    <span lang="en" className="font-en text-sm leading-6 text-muted">
                                        {word.en}
                                    </span>
                                    {word.fa !== null && (
                                        <span lang="fa" dir="rtl" className="text-sm leading-6">
                                            {word.fa}
                                        </span>
                                    )}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </details>

                {talk.cover_url !== null && (
                    <img
                        src={talk.cover_url}
                        alt=""
                        loading="eager"
                        className="block aspect-video h-auto w-full rounded-2xl border border-line bg-canvas object-cover sm:rounded-3xl"
                    />
                )}

                <article lang="en" dir="ltr" aria-label="متن گفتار" className="fe-english-body grid max-w-[68ch] gap-5">
                    {talk.segments.map((paragraph, index) => (
                        <p key={index} className="m-0 text-pretty">
                            {paragraph.map((sentence, sentenceIndex) => (
                                <React.Fragment key={sentenceIndex}>
                                    {sentenceIndex > 0 ? ' ' : ''}
                                    <LexiconText
                                        text={sentence.text}
                                        lexicon={talk.lexicon}
                                        onWordSelect={(entry) => setActiveWord(toSheet(entry))}
                                        onWordPlay={(entry) => playWord(toSheet(entry))}
                                    />
                                </React.Fragment>
                            ))}
                        </p>
                    ))}
                </article>

                <p className="m-0 border-t border-line pt-4 text-xs leading-6 text-muted">
                    منبع:{' '}
                    <a
                        href={talk.source_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-bold text-primary underline underline-offset-4"
                    >
                        TED
                    </a>{' '}
                    · «{talk.title_en}» اثر {talk.speaker || 'TED'} · مجوز {talk.source_license}
                </p>
            </div>
            <WordSheet word={activeWord} onClose={() => setActiveWord(null)} onPlay={playWord} />
            <audio ref={wordAudioRef} preload="none" className="hidden" />
        </>
    );
};

TedShow.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default TedShow;
