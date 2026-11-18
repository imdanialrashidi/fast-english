import { Link } from '@inertiajs/react';
import { Check, ChevronLeft, ChevronRight, CircleCheck, Layers, RotateCcw, Volume2, X } from 'lucide-react';
import * as React from 'react';
import type { FlashcardCardRow, FlashcardStudyConfig } from '@/types';

/**
 * Text-first flashcard player (owner clarification 2026-11-15).
 *
 * Card: English word + speaker. «نمایش پاسخ» reveals the Persian meaning,
 * example and IPA (when known). There is no picture prompt and no timed
 * reveal: the learner controls when the answer appears.
 *
 * One component serves three decks. Book units and the daily queue use the
 * two-grade book schedule (درست گفتم / درست نگفتم); a lesson deck passes the
 * notebook's four-grade options and its own submit function, so the
 * vocabulary schedule and the notebook stay in sync. Ratings are props, not
 * branches in the player.
 */

export interface FlashcardRatingOption {
    value: string;
    label: string;
    shortcut?: string;
    tone: 'good' | 'again' | 'neutral';
}

interface Props {
    cards: FlashcardCardRow[];
    study: FlashcardStudyConfig;
    mode: 'unit' | 'review' | 'lesson';
    title: string;
    subtitle?: string | null;
    backHref: string;
    backLabel?: string;
    resultsHref?: string | null;
    reviewedToday?: number;
    nextDueAt?: string | null;
    ratings?: FlashcardRatingOption[];
    onSubmitRating: (card: FlashcardCardRow, rating: string) => Promise<{ ok: boolean; message?: string }>;
    bucketLabels?: { good: string; again: string };
    correctRatings?: string[];
    againRatings?: string[];
    startHint?: string;
}

interface Answers {
    [cardId: number]: string;
}

const DEFAULT_RATINGS: FlashcardRatingOption[] = [
    { value: 'good', label: 'درست گفتم', shortcut: '1', tone: 'good' },
    { value: 'again', label: 'درست نگفتم', shortcut: '2', tone: 'again' },
];

const DEFAULT_CORRECT = ['good'];
const DEFAULT_AGAIN = ['again'];
const DEFAULT_BUCKETS = { good: 'درست گفتم', again: 'درست نگفتم' };

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}


function formatDue(iso: string | null | undefined): string {
    if (iso === null || iso === undefined || iso === '') {
        return '—';
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function gradeButtonClass(tone: FlashcardRatingOption['tone']): string {
    const base =
        'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 font-bold transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

    if (tone === 'good') {
        return `${base} bg-success text-surface`;
    }

    if (tone === 'again') {
        return `${base} border border-danger/40 bg-surface text-danger hover:bg-danger/5`;
    }

    return `${base} border border-line bg-canvas text-ink hover:bg-surface`;
}

export function FlashcardPlayer({
    cards,
    study,
    mode,
    title,
    subtitle,
    backHref,
    backLabel = 'بازگشت',
    resultsHref = null,
    reviewedToday,
    nextDueAt = null,
    ratings = DEFAULT_RATINGS,
    onSubmitRating,
    bucketLabels = DEFAULT_BUCKETS,
    correctRatings = DEFAULT_CORRECT,
    againRatings = DEFAULT_AGAIN,
    startHint,
}: Props): React.JSX.Element {
    const [activeCards, setActiveCards] = React.useState<FlashcardCardRow[]>(cards);
    const [started, setStarted] = React.useState(false);
    const [index, setIndex] = React.useState(0);
    const [revealed, setRevealed] = React.useState(false);
    const [revealedIds, setRevealedIds] = React.useState<Set<number>>(() => new Set<number>());
    const [answers, setAnswers] = React.useState<Answers>({});
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const [audioFailed, setAudioFailed] = React.useState(false);
    const [finished, setFinished] = React.useState(false);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const preloadRef = React.useRef<HTMLAudioElement | null>(null);

    const card: FlashcardCardRow | undefined = activeCards[index];
    const answered: string | undefined = card === undefined ? undefined : answers[card.id];

    const getAudio = React.useCallback((): HTMLAudioElement => {
        if (audioRef.current === null) {
            const audio = new Audio();
            audio.preload = 'auto';
            audioRef.current = audio;
        }

        return audioRef.current;
    }, []);

    const playAudio = React.useCallback(
        (url: string | null): void => {
            if (url === null || url === '') {
                return;
            }

            const audio = getAudio();
            setAudioFailed(false);
            audio.src = url;
            audio.currentTime = 0;
            void audio.play().catch(() => setAudioFailed(true));
        },
        [getAudio],
    );

    // Safari and Chrome only allow programmatic audio after a gesture. The
    // start button plays a silent clip through the same element, so the
    // answer reveal is not blocked by the autoplay policy.
    const unlockAudio = React.useCallback((): void => {
        const audio = getAudio();
        audio.volume = 0.01;
        audio.src = '/audio/silence.mp3';
        void audio
            .play()
            .then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 1;
            })
            .catch(() => {
                audio.volume = 1;
            });
    }, [getAudio]);

    const pauseAudio = React.useCallback((): void => {
        const audio = audioRef.current;
        if (audio !== null) {
            audio.pause();
        }
    }, []);

    React.useEffect(() => {
        setActiveCards(cards);
        setStarted(false);
        setIndex(0);
        setRevealed(false);
        setRevealedIds(new Set<number>());
        setAnswers({});
        setFinished(false);
        setError('');
    }, [cards]);

    React.useEffect(() => {
        return () => {
            pauseAudio();
            if (preloadRef.current !== null) {
                preloadRef.current.src = '';
            }
        };
    }, [pauseAudio]);

    React.useEffect(() => {
        if (!started || finished || activeCards.length === 0) {
            return;
        }

        const current = activeCards[index];
        if (current === undefined) {
            return;
        }

        setError('');
        setAudioFailed(false);
    }, [started, finished, index, activeCards]);

    // Preload the next clip so the next reveal never waits on the network.
    React.useEffect(() => {
        if (!started || finished) {
            return;
        }

        const next = activeCards[index + 1];
        if (next === undefined || next.audio_url === null || next.audio_url === '') {
            return;
        }

        const preload = new Audio();
        preload.preload = 'auto';
        preload.src = next.audio_url;
        preloadRef.current = preload;
    }, [started, finished, index, activeCards]);

    const revealNow = React.useCallback((): void => {
        if (!started || finished || card === undefined || revealed) {
            return;
        }

        setRevealed(true);
        setRevealedIds((previous) => {
            const next = new Set(previous);
            next.add(card.id);

            return next;
        });

        if (study.auto_play_audio) {
            playAudio(card.audio_url);
        }
    }, [started, finished, card, revealed, study.auto_play_audio, playAudio]);

    const goTo = React.useCallback(
        (nextIndex: number): void => {
            if (nextIndex < 0 || nextIndex >= activeCards.length) {
                return;
            }

            setIndex(nextIndex);
            setRevealed(revealedIds.has(activeCards[nextIndex]?.id ?? -1));
            setError('');
        },
        [activeCards, revealedIds],
    );

    const goPrev = React.useCallback((): void => {
        goTo(index - 1);
    }, [goTo, index]);

    const goNext = React.useCallback((): void => {
        goTo(index + 1);
    }, [goTo, index]);

    const finishSession = React.useCallback((): void => {
        setFinished(true);
        pauseAudio();
    }, [pauseAudio]);

    const submit = React.useCallback(
        async (target: FlashcardCardRow, rating: string): Promise<{ ok: boolean; message?: string }> =>
            onSubmitRating(target, rating),
        [onSubmitRating],
    );

    const rate = React.useCallback(
        async (rating: string): Promise<void> => {
            if (!started || finished || busy || card === undefined || answered !== undefined) {
                return;
            }

            setBusy(true);
            setError('');

            try {
                const result = await submit(card, rating);

                if (!result.ok) {
                    setError(result.message ?? 'ثبت نتیجه مرور ممکن نشد. دوباره تلاش کنید.');

                    return;
                }

                setAnswers((previous) => ({ ...previous, [card.id]: rating }));

                if (index >= activeCards.length - 1) {
                    finishSession();

                    return;
                }

                setRevealed(revealedIds.has(activeCards[index + 1]?.id ?? -1));
                setIndex(index + 1);
            } catch {
                setError('ثبت نتیجه مرور ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.');
            } finally {
                setBusy(false);
            }
        },
        [started, finished, busy, card, answered, submit, index, activeCards, revealedIds, finishSession],
    );

    const start = React.useCallback((): void => {
        unlockAudio();
        setStarted(true);
        setFinished(false);
        setIndex(0);
        setAnswers({});
        setRevealedIds(new Set<number>());
        setRevealed(false);
    }, [unlockAudio]);

    const restartWith = React.useCallback((subset: FlashcardCardRow[]): void => {
        if (subset.length === 0) {
            return;
        }

        setActiveCards(subset);
        setIndex(0);
        setAnswers({});
        setRevealedIds(new Set<number>());
        setRevealed(false);
        setFinished(false);
        setError('');
        setStarted(true);
    }, []);

    const answeredCards = activeCards.filter((entry) => answers[entry.id] !== undefined);
    const correctCards = answeredCards.filter((entry) => correctRatings.includes(answers[entry.id] ?? ''));
    const wrongCards = answeredCards.filter((entry) => againRatings.includes(answers[entry.id] ?? ''));
    const unansweredCards = activeCards.filter((entry) => answers[entry.id] === undefined);
    const progress = activeCards.length === 0 ? 0 : Math.round(((index + 1) / activeCards.length) * 100);

    React.useEffect(() => {
        if (!started || finished) {
            return;
        }

        const onKey = (event: KeyboardEvent): void => {
            if (event.defaultPrevented) {
                return;
            }

            const target = event.target;
            if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                return;
            }

            if ((event.key === ' ' || event.key === 'Enter') && !revealed) {
                event.preventDefault();
                revealNow();

                return;
            }

            if (!revealed) {
                return;
            }

            const option = ratings.find((entry) => entry.shortcut === event.key);
            if (option !== undefined) {
                event.preventDefault();
                void rate(option.value);

                return;
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                goPrev();
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                goNext();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [started, finished, revealed, ratings, revealNow, rate, goPrev, goNext]);

    if (activeCards.length === 0) {
        return (
            <div className="mx-auto grid w-full max-w-[680px] gap-4 px-4 py-6">
                <section
                    data-flashcard-empty
                    className="grid justify-items-center gap-3 rounded-3xl border border-line bg-surface px-6 py-10 text-center"
                >
                    <CircleCheck size={28} aria-hidden="true" />
                    <h2 className="m-0 text-xl font-extrabold">
                        {mode === 'review' ? 'الان کارتی برای مرور نیست.' : 'کارتی در این بخش نیست.'}
                    </h2>
                    <p className="m-0 max-w-md leading-8 text-muted">
                        {mode === 'review'
                            ? 'وقتی موعد کارتی برسد، همین‌جا مرور می‌شود.'
                            : 'برای این مقاله هنوز واژه‌ای ثبت نشده است.'}
                    </p>
                    {mode === 'review' && nextDueAt !== null && (
                        <p className="m-0 text-sm leading-7 text-muted">موعد بعدی: {formatDue(nextDueAt)}</p>
                    )}
                    <Link
                        href={backHref}
                        className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                    >
                        {backLabel}
                    </Link>
                </section>
            </div>
        );
    }

    if (!started) {
        return (
            <div className="mx-auto grid w-full max-w-[680px] gap-4 px-4 py-6">
                <section
                    data-flashcard-start
                    className="grid justify-items-center gap-4 rounded-3xl border border-line bg-surface px-6 py-10 text-center"
                >
                    <span
                        aria-hidden="true"
                        className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary"
                    >
                        <Layers size={32} />
                    </span>
                    <div className="grid gap-1">
                        <h2 lang="en" dir="ltr" className="m-0 text-2xl leading-9 font-extrabold">
                            {title}
                        </h2>
                        {(subtitle ?? '') !== '' && <p className="m-0 text-sm leading-7 text-muted">{subtitle}</p>}
                    </div>
                    <p className="m-0 text-sm leading-8 text-muted">
                        {startHint ?? `${fa(activeCards.length)} کارت. واژه را ببین و معنی را بگو؛ بعد پاسخ را ببین.`}
                    </p>
                    {mode === 'review' && reviewedToday !== undefined && reviewedToday > 0 && (
                        <p className="m-0 text-xs leading-6 text-muted">امروز {fa(reviewedToday)} مرور ثبت کرده‌ای.</p>
                    )}
                    <button
                        type="button"
                        onClick={start}
                        data-flashcard-start-button
                        className="inline-flex min-h-12 min-w-44 cursor-pointer items-center justify-center rounded-full bg-primary px-8 py-3 font-bold text-surface hover:bg-primary-hover"
                    >
                        شروع
                    </button>
                </section>
            </div>
        );
    }

    if (finished) {
        return (
            <div className="mx-auto grid w-full max-w-[680px] gap-4 px-4 py-6">
                <section
                    data-flashcard-summary
                    className="grid gap-5 rounded-3xl border border-line bg-surface p-6 text-center"
                >
                    <span
                        aria-hidden="true"
                        className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"
                    >
                        <CircleCheck size={32} />
                    </span>
                    <div className="grid gap-1">
                        <h2 className="m-0 text-2xl font-extrabold">
                            {mode === 'review' ? 'مرور امروز تمام شد.' : 'این مقاله تمام شد.'}
                        </h2>
                        <p className="m-0 text-sm leading-7 text-muted">
                            {fa(answeredCards.length)} از {fa(activeCards.length)} کارت پاسخ داده شد.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-success/10 p-4">
                            <p className="m-0 text-sm font-bold text-success">{bucketLabels.good}</p>
                            <p className="m-0 text-3xl font-extrabold text-success">{fa(correctCards.length)}</p>
                        </div>
                        <div className="rounded-2xl bg-danger/10 p-4">
                            <p className="m-0 text-sm font-bold text-danger">{bucketLabels.again}</p>
                            <p className="m-0 text-3xl font-extrabold text-danger">{fa(wrongCards.length)}</p>
                        </div>
                    </div>

                    {unansweredCards.length > 0 && (
                        <p className="m-0 text-sm leading-7 text-muted">{fa(unansweredCards.length)} کارت بی‌پاسخ ماند.</p>
                    )}

                    <div className="flex flex-wrap justify-center gap-2">
                        {wrongCards.length > 0 && (
                            <button
                                type="button"
                                onClick={() => restartWith(wrongCards)}
                                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-canvas px-5 py-2.5 font-bold text-ink hover:bg-surface"
                            >
                                <RotateCcw size={18} aria-hidden="true" />
                                مرور دوبارهٔ {bucketLabels.again}
                            </button>
                        )}
                        {unansweredCards.length > 0 && (
                            <button
                                type="button"
                                onClick={() => restartWith(unansweredCards)}
                                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-canvas px-5 py-2.5 font-bold text-ink hover:bg-surface"
                            >
                                ادامهٔ کارت‌های بی‌پاسخ
                            </button>
                        )}
                        {resultsHref !== null && (
                            <Link
                                href={resultsHref}
                                className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                دیدن نتیجهٔ درس
                            </Link>
                        )}
                        <Link
                            href={backHref}
                            className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 py-2.5 font-bold text-ink no-underline hover:bg-canvas"
                        >
                            {backLabel}
                        </Link>
                    </div>
                </section>
            </div>
        );
    }

    if (card === undefined) {
        return <></>;
    }

    return (
        <div className="mx-auto grid w-full max-w-[680px] gap-3 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
                <p className="m-0 text-sm font-bold text-muted" data-flashcard-position>
                    {fa(index + 1)} از {fa(activeCards.length)}
                </p>
                <p className="m-0 text-xs text-muted">
                    {mode === 'review' && card.book_title !== null && card.book_title !== undefined
                        ? card.book_title
                        : 'فلش‌کارت'}
                </p>
            </div>

            <div
                role="progressbar"
                aria-label="پیشرفت این جلسه"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-1.5 w-full overflow-hidden rounded-full bg-line"
            >
                <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>

            <section
                aria-label="کارت فلش‌کارت"
                data-flashcard-card
                data-flashcard-id={card.id}
                data-revealed={revealed ? 'true' : 'false'}
                className="overflow-hidden rounded-3xl border border-line bg-surface"
            >
                <div className="grid gap-3 px-5 py-8 text-center">
                    <p className="m-0 text-xs tracking-wide text-muted">{mode === 'lesson' ? 'واژهٔ این مقاله' : 'واژه'}</p>
                    <div className="flex items-center justify-center gap-2">
                        <p
                            lang="en"
                            dir="ltr"
                            data-flashcard-word
                            className="m-0 font-en text-4xl leading-[1.25] font-extrabold sm:text-5xl"
                        >
                            {card.word}
                        </p>
                        {card.audio_url !== null && card.audio_url !== '' && (
                            <button
                                type="button"
                                onClick={() => playAudio(card.audio_url)}
                                aria-label="پخش دوبارهٔ صدا"
                                title="پخش دوبارهٔ صدا"
                                data-flashcard-audio
                                className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-canvas text-primary hover:bg-surface"
                            >
                                <Volume2 size={20} aria-hidden="true" />
                            </button>
                        )}
                    </div>

                    <div aria-live="polite" className="grid min-h-[7.5rem] content-start gap-1 pt-1">
                        {revealed ? (
                            <>
                                {study.show_phonetic && card.phonetic !== null && card.phonetic !== '' && (
                                    <p lang="en" dir="ltr" className="m-0 font-en text-sm text-muted">
                                        {card.phonetic}
                                    </p>
                                )}
                                {study.show_translation && (
                                    <p dir="auto" className="m-0 text-lg leading-8 font-bold">
                                        {card.translation_fa}
                                    </p>
                                )}
                                {card.example_en !== null && card.example_en !== '' && (
                                    <p lang="en" dir="ltr" className="m-0 font-en text-sm leading-6 text-muted">
                                        {card.example_en}
                                    </p>
                                )}
                                {audioFailed && (
                                    <p role="status" className="m-0 text-xs leading-6 text-danger">
                                        صدا پخش نشد؛ دکمهٔ بلندگو را دوباره بزن.
                                    </p>
                                )}
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={revealNow}
                                data-flashcard-reveal
                                className="mx-auto inline-flex min-h-11 min-w-40 cursor-pointer items-center justify-center rounded-full border border-line bg-canvas px-5 py-2.5 font-bold text-ink hover:bg-surface"
                            >
                                نمایش پاسخ
                            </button>
                        )}
                    </div>
                </div>
            </section>

            <div role="group" aria-label="نتیجهٔ مرور" className="grid grid-cols-2 gap-2">
                {ratings.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        data-flashcard-grade={option.value}
                        aria-keyshortcuts={option.shortcut}
                        aria-pressed={answered === option.value}
                        disabled={!revealed || busy || answered !== undefined}
                        onClick={() => void rate(option.value)}
                        className={gradeButtonClass(option.tone)}
                    >
                        {option.tone === 'good' && <Check size={18} aria-hidden="true" />}
                        {option.tone === 'again' && <X size={18} aria-hidden="true" />}
                        {option.label}
                    </button>
                ))}

                {index > 0 ? (
                    <button
                        type="button"
                        data-flashcard-prev
                        aria-keyshortcuts="ArrowRight"
                        onClick={goPrev}
                        disabled={busy}
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-line bg-canvas px-4 py-2 font-bold text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <ChevronRight size={18} aria-hidden="true" />
                        گزینهٔ قبلی
                    </button>
                ) : (
                    <span aria-hidden="true" className="min-h-11" />
                )}

                {index < activeCards.length - 1 ? (
                    <button
                        type="button"
                        data-flashcard-next
                        aria-keyshortcuts="ArrowLeft"
                        onClick={goNext}
                        disabled={busy}
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-line bg-canvas px-4 py-2 font-bold text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        گزینهٔ بعدی
                        <ChevronLeft size={18} aria-hidden="true" />
                    </button>
                ) : (
                    <span aria-hidden="true" className="min-h-11" />
                )}
            </div>

            {answered !== undefined && (
                <p className="m-0 text-center text-xs leading-6 text-muted">
                    پاسخ این کارت ثبت شده است؛ برای تغییر، از پایان جلسه دوباره شروع کن.
                </p>
            )}

            {error !== '' && (
                <p role="alert" className="m-0 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm leading-7 text-danger">
                    {error}
                </p>
            )}

            <p className="m-0 text-center text-xs leading-6 text-muted">
                {revealed
                    ? `${ratings
                          .map((option) => option.shortcut)
                          .filter(Boolean)
                          .join(' و ')} برای پاسخ، فلش چپ و راست برای جابه‌جایی.`
                    : 'فاصله یا Enter برای دیدن پاسخ؛ فلش چپ و راست برای جابه‌جایی.'}
            </p>
        </div>
    );
}
