import { useEffect, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Check, Eye, Headphones, Play, X } from 'lucide-react';
import { HighlightedText } from '@/components/library/HighlightedText';
import { ReaderAudioBar } from '@/components/library/ReaderAudioBar';
import { WordPreview } from '@/components/library/WordPreview';
import { postJson } from '@/lib/http';
import { activeSentenceIndex, sentencesForRange, selectionWithin, wordsForRange } from '@/lib/reading';
import type {
    IeltsQuestion,
    IeltsResult,
    IeltsResultItem,
    LibraryBreadcrumb,
    ReadingEndpoints,
    ReadingNode,
    ReadingPage,
    ReadingProgressState,
    ReadingSentence,
    ReadingWord,
} from '@/types';

interface IeltsPassage {
    title_en: string | null;
    subtitle_fa: string | null;
    paragraphs: ReadingPage[];
}

interface IeltsReaderProps {
    node: ReadingNode;
    breadcrumbs: LibraryBreadcrumb[];
    passage: IeltsPassage;
    questions: IeltsQuestion[];
    attempt: IeltsResult | null;
    progress: ReadingProgressState | null;
    endpoints: ReadingEndpoints;
    credit?: string | null;
}

type AnswerValue = string | string[];

const TFNG = ['TRUE', 'FALSE', 'NOT GIVEN'];
const YNNG = ['YES', 'NO', 'NOT GIVEN'];

/**
 * Cambridge IELTS reading: vocabulary first, then the paragraph with its
 * original teaching voice (Underdog Woof when the book has no audio), then
 * the real question types. The key and the evidence arrive only after a
 * submission; a wrong answer can jump to the exact sentence.
 */
export function IeltsReader({ node, breadcrumbs, passage, questions, attempt, progress, endpoints, credit }: IeltsReaderProps): React.JSX.Element {
    const paragraphs = passage.paragraphs;
    const [mode, setMode] = useState<'guided' | 'full'>('guided');
    const initialIndex =
        progress !== null && progress.same_revision
            ? Math.max(0, paragraphs.findIndex((paragraph) => paragraph.id === progress.page_key))
            : 0;
    const [index, setIndex] = useState(initialIndex);
    const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
        const initial: Record<string, AnswerValue> = {};
        for (const item of attempt?.items ?? []) {
            if (item.given !== null) {
                initial[item.id] = item.given;
            }
        }

        return initial;
    });
    const [result, setResult] = useState<IeltsResult | null>(attempt);
    const [evidence, setEvidence] = useState<{ page_key: string; start_utf16: number; end_utf16: number } | null>(null);
    const [translation, setTranslation] = useState<{ en: string; fa: string } | null>(null);
    const [playing, setPlaying] = useState(false);
    const [timeMs, setTimeMs] = useState(0);
    const [durationMs, setDurationMs] = useState(0);
    const [rate, setRate] = useState(1);
    const [continuous, setContinuous] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const wordAudioRef = useRef<HTMLAudioElement | null>(null);
    const paragraphRefs = useRef(new Map<string, HTMLParagraphElement>());
    const wordQueueRef = useRef<{ words: ReadingWord[]; index: number; repeat: number; wasPlaying: boolean }>({
        words: [],
        index: 0,
        repeat: 0,
        wasPlaying: false,
    });
    const autoplayRef = useRef(false);

    const paragraph = paragraphs[index];
    const audioSrc = paragraph?.audio_url ?? null;
    const activeIndex = activeSentenceIndex(paragraph?.sentences ?? [], timeMs);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio === null) {
            return;
        }

        if (audioSrc === null) {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
            setDurationMs(0);

            return;
        }

        const absolute = new URL(audioSrc, window.location.href).href;
        if (audio.src !== absolute) {
            audio.src = audioSrc;
            audio.load();
        } else {
            audio.currentTime = 0;
        }
    }, [audioSrc]);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio === null) {
            return;
        }
        audio.pause();
        audio.currentTime = 0;
        setTimeMs(0);
        setPlaying(false);
    }, [index]);

    useEffect(() => {
        const current = paragraphs[index];
        const audio = audioRef.current;

        return () => {
            if (current !== undefined) {
                void postJson(endpoints.progress, {
                    page_key: current.id,
                    position_ms: Math.max(0, Math.round((audio?.currentTime ?? 0) * 1000)),
                }).catch(() => undefined);
            }
        };
    }, [endpoints.progress, index, paragraphs]);

    useEffect(() => {
        if (!playing) {
            return;
        }

        const timer = window.setInterval(() => {
            const current = paragraphs[index];
            const audio = audioRef.current;
            if (current !== undefined && audio !== null) {
                void postJson(endpoints.progress, {
                    page_key: current.id,
                    position_ms: Math.max(0, Math.round(audio.currentTime * 1000)),
                }).catch(() => undefined);
            }
        }, 5000);

        return () => window.clearInterval(timer);
    }, [endpoints.progress, index, paragraphs, playing]);

    const playWords = (words: ReadingWord[]): void => {
        const playable = words.filter((word) => word.audio_url !== null);
        if (playable.length === 0) {
            return;
        }

        const narration = audioRef.current;
        const wasPlaying = narration !== null && !narration.paused;
        narration?.pause();
        wordQueueRef.current = { words: playable, index: 0, repeat: 0, wasPlaying };
        playNextWord();
    };

    const playNextWord = (): void => {
        const queue = wordQueueRef.current;
        const word = queue.words[queue.index];
        const audio = wordAudioRef.current;

        if (word === undefined || audio === null) {
            if (queue.wasPlaying) {
                void audioRef.current?.play().catch(() => setPlaying(false));
            }

            return;
        }

        audio.src = word.audio_url ?? '';
        audio.onended = () => {
            if (queue.repeat === 0) {
                queue.repeat = 1;
                window.setTimeout(() => void audio.play().catch(() => undefined), 400);

                return;
            }

            queue.repeat = 0;
            queue.index += 1;
            if (queue.index >= queue.words.length) {
                if (queue.wasPlaying) {
                    void audioRef.current?.play().catch(() => setPlaying(false));
                }

                return;
            }
            playNextWord();
        };
        void audio.play().catch(() => undefined);
    };

    const goToParagraph = (next: number, options?: { play?: boolean }): void => {
        if (next < 0 || next >= paragraphs.length) {
            return;
        }
        autoplayRef.current = options?.play ?? false;
        setIndex(next);
        setMode('guided');
    };

    const showEvidence = (item: IeltsResultItem): void => {
        if (item.evidence === null) {
            return;
        }

        setMode('full');
        setEvidence({
            page_key: item.evidence.page_key,
            start_utf16: item.evidence.start_utf16,
            end_utf16: item.evidence.end_utf16,
        });
        window.setTimeout(() => {
            document.getElementById(`ielts-page-${item.evidence?.page_key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
    };

    const captureSelection = (page: ReadingPage): void => {
        const element = paragraphRefs.current.get(page.id);
        if (element === undefined) {
            return;
        }

        const selected = selectionWithin(element);
        if (selected === null) {
            return;
        }

        const sentences = sentencesForRange(page.sentences, selected.start, selected.end);
        const words = wordsForRange(page.words, selected.start, selected.end);
        const faSentences = sentences.map((sentence: ReadingSentence) => sentence.text_fa).filter((value): value is string => value !== null && value !== '');
        const faWords = words
            .map((word) => (word.meaning_fa !== null ? `${word.word}: ${word.meaning_fa}` : null))
            .filter((value): value is string => value !== null);

        if (faSentences.length === 0 && faWords.length === 0) {
            return;
        }

        setTranslation({
            en: selected.text,
            fa: [...faSentences, ...faWords].join(' '),
        });
    };

    const submit = async (): Promise<void> => {
        if (endpoints.attempts === null) {
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const response = await postJson(endpoints.attempts, { answers });
            if (!response.ok) {
                setError('ثبت پاسخ‌ها انجام نشد. دوباره تلاش کن.');
                setSubmitting(false);

                return;
            }
            const data = (await response.json()) as IeltsResult;
            setResult(data);
            setSubmitting(false);
            window.setTimeout(() => {
                document.getElementById('ielts-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 80);
        } catch {
            setError('ارتباط برقرار نشد. اتصال را بررسی کن.');
            setSubmitting(false);
        }
    };

    const resetAttempt = (): void => {
        setAnswers({});
        setResult(null);
        setEvidence(null);
        setError(null);
    };

    const parent = [...breadcrumbs].reverse().find((crumb) => crumb.url !== null);
    const resultFor = (id: string): IeltsResultItem | undefined => result?.items.find((item) => item.id === id);
    const totalQuestions = questions.reduce((total, question) => total + Math.max(1, question.weight), 0);
    const answeredCount = questions.reduce((total, question) => {
        const value = answers[question.id];
        const answered = Array.isArray(value) ? value.length > 0 : value !== undefined && value !== '';
        return answered ? total + Math.max(1, question.weight) : total;
    }, 0);

    const showEvidenceFirstWrong = (): void => {
        const wrong = result?.items.find((item) => !item.is_correct && item.evidence !== null);
        if (wrong !== undefined) {
            showEvidence(wrong);
        }
    };

    return (
        <div className="mx-auto grid w-full max-w-[980px] gap-4 px-4 py-4 pb-32 sm:gap-5 sm:py-5 sm:pb-32">
            <div className="flex items-center justify-between gap-3">
                <Link
                    href={parent?.url ?? '/app/books'}
                    className="fe-press inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-muted no-underline hover:text-ink"
                >
                    <ArrowRight size={16} aria-hidden="true" />
                    {parent?.title ?? 'آیلتس'}
                </Link>
                <button
                    type="button"
                    onClick={() => {
                        setMode((value) => (value === 'guided' ? 'full' : 'guided'));
                        setPlaying(false);
                        audioRef.current?.pause();
                    }}
                    className="fe-press inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-xs font-bold text-ink"
                >
                    <Eye size={15} aria-hidden="true" />
                    {mode === 'guided' ? 'دیدن کل ریدینگ' : 'حالت هدایت‌شده'}
                </button>
            </div>

            <header className="grid gap-1.5">
                <p className="fe-meta m-0 text-accent-strong">{node.title_fa ?? 'کمبریج آیلتس'}</p>
                <h2 lang="en" dir="ltr" className="m-0 font-en text-xl leading-8 font-extrabold sm:text-2xl">
                    {passage.title_en ?? node.title_en}
                </h2>
                {passage.subtitle_fa !== null && passage.subtitle_fa !== '' && (
                    <p className="m-0 text-sm leading-7 text-muted">{passage.subtitle_fa}</p>
                )}
                <p className="m-0 text-[0.72rem] leading-6 text-muted">
                    {paragraphs.length.toLocaleString('fa-IR')} پاراگراف · {totalQuestions.toLocaleString('fa-IR')} سوال ·
                    برای ترجمه، بخشی از متن را انتخاب کن.
                </p>
            </header>

            {mode === 'guided' && paragraph !== undefined ? (
                <section className="grid gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold text-ink">
                            پاراگراف {paragraph.label ?? index + 1}
                        </span>
                        <span className="font-en text-[0.7rem] font-bold text-muted" dir="ltr">
                            {index + 1} / {paragraphs.length}
                        </span>
                    </div>

                    <WordPreview
                        words={paragraph.words}
                        title={`واژه‌های سخت پاراگراف ${paragraph.label ?? index + 1}`}
                        defaultOpen
                        onPlay={(word) => playWords([word])}
                        onPlayAll={() => playWords(paragraph.words)}
                    />

                    <div className="rounded-3xl border border-line bg-surface p-4 sm:p-6">
                        <p
                            lang="en"
                            dir="ltr"
                            ref={(element) => {
                                if (element !== null) {
                                    paragraphRefs.current.set(paragraph.id, element);
                                } else {
                                    paragraphRefs.current.delete(paragraph.id);
                                }
                            }}
                            onMouseUp={() => captureSelection(paragraph)}
                            onTouchEnd={() => window.setTimeout(() => captureSelection(paragraph), 260)}
                            className="m-0 max-w-[68ch] font-en text-[1.05rem] leading-8 text-ink sm:text-[1.12rem] sm:leading-9"
                        >
                            <HighlightedText
                                text={paragraph.text_en}
                                sentences={paragraph.sentences}
                                activeIndex={playing ? activeIndex : null}
                                words={paragraph.words}
                                evidence={evidence?.page_key === paragraph.id ? { start: evidence.start_utf16, end: evidence.end_utf16 } : null}
                                onWordClick={(word) => playWords([word])}
                            />
                        </p>
                    </div>

                    <ReaderAudioBar
                        disabled={audioSrc === null}
                        playing={playing}
                        timeMs={timeMs}
                        durationMs={durationMs}
                        onToggle={() => {
                            const audio = audioRef.current;
                            if (audio === null) {
                                return;
                            }
                            if (audio.paused) {
                                void audio.play().catch(() => setPlaying(false));
                            } else {
                                audio.pause();
                            }
                        }}
                        onSeek={(ms) => {
                            if (audioRef.current !== null) {
                                audioRef.current.currentTime = ms / 1000;
                                setTimeMs(ms);
                            }
                        }}
                        rate={rate}
                        onRate={(next) => {
                            setRate(next);
                            if (audioRef.current !== null) {
                                audioRef.current.playbackRate = next;
                            }
                        }}
                        continuous={continuous}
                        onContinuous={setContinuous}
                        label="پخش پاراگراف"
                    />

                    <div className="flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => goToParagraph(index - 1)}
                            disabled={index === 0}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-canvas px-4 text-sm font-bold text-ink disabled:opacity-40"
                        >
                            <ArrowRight size={16} aria-hidden="true" />
                            پاراگراف قبل
                        </button>
                        {index < paragraphs.length - 1 ? (
                            <button
                                type="button"
                                onClick={() => goToParagraph(index + 1)}
                                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-surface"
                            >
                                پاراگراف بعد
                                <ArrowLeft size={16} aria-hidden="true" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => document.getElementById('ielts-questions')?.scrollIntoView({ behavior: 'smooth' })}
                                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-surface"
                            >
                                رفتن به سوال‌ها
                                <ArrowLeft size={16} aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </section>
            ) : (
                <section className="grid gap-4">
                    {paragraphs.map((item, itemIndex) => (
                        <article
                            key={item.id}
                            id={`ielts-page-${item.id}`}
                            className="grid gap-3 rounded-3xl border border-line bg-surface p-4 sm:p-5"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-3 py-1 text-xs font-bold text-ink">
                                    پاراگراف {item.label ?? itemIndex + 1}
                                </span>
                                {item.audio_url !== null && (
                                    <button
                                        type="button"
                                        onClick={() => goToParagraph(itemIndex, { play: true })}
                                        className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line px-3 text-[0.7rem] font-bold text-primary"
                                    >
                                        <Play size={12} aria-hidden="true" />
                                        پخش
                                    </button>
                                )}
                            </div>
                            <WordPreview
                                words={item.words}
                                title={`واژه‌های سخت پاراگراف ${item.label ?? itemIndex + 1}`}
                                onPlay={(word) => playWords([word])}
                                onPlayAll={() => playWords(item.words)}
                            />
                            <p
                                lang="en"
                                dir="ltr"
                                ref={(element) => {
                                    if (element !== null) {
                                        paragraphRefs.current.set(item.id, element);
                                    } else {
                                        paragraphRefs.current.delete(item.id);
                                    }
                                }}
                                onMouseUp={() => captureSelection(item)}
                                onTouchEnd={() => window.setTimeout(() => captureSelection(item), 260)}
                                className="m-0 max-w-[68ch] font-en text-[1.02rem] leading-8 text-ink"
                            >
                                <HighlightedText
                                    text={item.text_en}
                                    sentences={item.sentences}
                                    activeIndex={index === itemIndex && playing ? activeIndex : null}
                                    words={item.words}
                                    evidence={evidence?.page_key === item.id ? { start: evidence.start_utf16, end: evidence.end_utf16 } : null}
                                    onWordClick={(word) => playWords([word])}
                                />
                            </p>
                        </article>
                    ))}

                    <ReaderAudioBar
                        disabled={audioSrc === null}
                        playing={playing}
                        timeMs={timeMs}
                        durationMs={durationMs}
                        onToggle={() => {
                            const audio = audioRef.current;
                            if (audio === null) {
                                return;
                            }
                            if (audio.paused) {
                                void audio.play().catch(() => setPlaying(false));
                            } else {
                                audio.pause();
                            }
                        }}
                        onSeek={(ms) => {
                            if (audioRef.current !== null) {
                                audioRef.current.currentTime = ms / 1000;
                                setTimeMs(ms);
                            }
                        }}
                        rate={rate}
                        onRate={(next) => {
                            setRate(next);
                            if (audioRef.current !== null) {
                                audioRef.current.playbackRate = next;
                            }
                        }}
                        continuous={continuous}
                        onContinuous={setContinuous}
                        label="پخش پاراگراف"
                    />
                </section>
            )}

            <section id="ielts-questions" className="grid gap-3 scroll-mt-20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="m-0 text-lg font-extrabold">سوال‌های این پسیج</h2>
                    <span className="text-[0.72rem] font-bold text-muted">
                        {answeredCount.toLocaleString('fa-IR')} از {totalQuestions.toLocaleString('fa-IR')} پاسخ داده‌شده
                    </span>
                </div>

                {error !== null && (
                    <p role="alert" className="m-0 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                        {error}
                    </p>
                )}

                {questions.map((question) => {
                    const item = resultFor(question.id);
                    const value = answers[question.id];
                    const options = question.type === 'tfng' ? TFNG : question.type === 'ynng' ? YNNG : question.options;

                    return (
                        <article
                            key={question.id}
                            className={`grid gap-2 rounded-2xl border bg-surface p-4 ${
                                item === undefined
                                    ? 'border-line'
                                    : item.is_correct
                                      ? 'border-success/40'
                                      : 'border-danger/40'
                            }`}
                        >
                            <div className="flex items-start gap-2">
                                <span className="mt-0.5 grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-ink px-1 font-en text-[0.65rem] font-black text-surface">
                                    {question.number}
                                    {question.number_end !== null && `–${question.number_end}`}
                                </span>
                                <div className="grid min-w-0 gap-1">
                                    <p lang="en" dir="ltr" className="m-0 font-en text-sm leading-7 font-semibold text-ink">
                                        {question.prompt}
                                    </p>
                                    {question.instructions_fa !== null && question.instructions_fa !== '' && (
                                        <p className="m-0 text-[0.7rem] leading-6 text-muted">{question.instructions_fa}</p>
                                    )}
                                </div>
                            </div>

                            {question.type === 'completion' || question.type === 'short_answer' ? (
                                <label className="grid gap-1">
                                    <span className="sr-only">پاسخ سوال {question.number}</span>
                                    <input
                                        value={typeof value === 'string' ? value : ''}
                                        onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                                        placeholder={question.word_limit !== null ? `حداکثر ${question.word_limit} کلمه` : 'پاسخ'}
                                        className="min-h-11 w-full rounded-xl border border-line bg-canvas px-3 font-en text-sm text-ink outline-none focus:border-primary"
                                    />
                                </label>
                            ) : question.type === 'multi_choice' ? (
                                <div className="grid gap-1.5" role="group" aria-label={`پاسخ سوال ${question.number}`}>
                                    {options.map((option, optionIndex) => {
                                        const key = String.fromCharCode(65 + optionIndex);
                                        const selected = Array.isArray(value) ? value.includes(key) : value === key;
                                        return (
                                            <label
                                                key={key}
                                                className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                                                    selected ? 'border-primary bg-primary/5' : 'border-line bg-canvas'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={(event) => {
                                                        setAnswers((current) => {
                                                            const previous = Array.isArray(current[question.id]) ? (current[question.id] as string[]) : [];
                                                            const next = event.target.checked
                                                                ? [...previous, key]
                                                                : previous.filter((entry) => entry !== key);
                                                            return { ...current, [question.id]: next };
                                                        });
                                                    }}
                                                    className="mt-1 accent-primary"
                                                />
                                                <span lang="en" dir="ltr" className="font-en leading-6">
                                                    <span className="font-bold">{key}.</span> {option}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="grid gap-1.5" role="group" aria-label={`پاسخ سوال ${question.number}`}>
                                    {options.map((option) => {
                                        const selected = value === option;
                                        return (
                                            <label
                                                key={option}
                                                className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                                                    selected ? 'border-primary bg-primary/5' : 'border-line bg-canvas'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name={`question-${question.id}`}
                                                    checked={selected}
                                                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                                                    className="mt-1 accent-primary"
                                                />
                                                <span lang="en" dir="ltr" className="font-en leading-6">
                                                    {option}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}

                            {item !== undefined && (
                                <div className="grid gap-1.5 rounded-xl border border-line bg-canvas p-3">
                                    <p className={`m-0 inline-flex items-center gap-1.5 text-xs font-bold ${item.is_correct ? 'text-success' : 'text-danger'}`}>
                                        {item.is_correct ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                                        {item.is_correct ? 'پاسخ درست است.' : `پاسخ درست: ${item.correct}`}
                                    </p>
                                    {!item.is_correct && item.explanation_fa !== null && item.explanation_fa !== '' && (
                                        <p className="m-0 text-[0.8rem] leading-7 text-ink">{item.explanation_fa}</p>
                                    )}
                                    {!item.is_correct && item.why_wrong_fa !== null && item.why_wrong_fa !== '' && (
                                        <p className="m-0 text-[0.75rem] leading-6 text-muted">{item.why_wrong_fa}</p>
                                    )}
                                    {!item.is_correct && item.evidence !== null && (
                                        <button
                                            type="button"
                                            onClick={() => showEvidence(item)}
                                            className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[0.7rem] font-bold text-primary"
                                        >
                                            <Eye size={13} aria-hidden="true" />
                                            نمایش شاهد در متن
                                        </button>
                                    )}
                                </div>
                            )}
                        </article>
                    );
                })}

                <div id="ielts-result" className="grid gap-3">
                    {result !== null && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
                            <p className="m-0 text-sm font-extrabold text-ink">
                                نتیجه: {result.score.toLocaleString('fa-IR')} از {result.total.toLocaleString('fa-IR')}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={showEvidenceFirstWrong}
                                    disabled={result.items.every((item) => item.is_correct || item.evidence === null)}
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[0.7rem] font-bold text-primary disabled:opacity-40"
                                >
                                    <Eye size={13} aria-hidden="true" />
                                    شاهد اولین اشتباه
                                </button>
                                <button
                                    type="button"
                                    onClick={resetAttempt}
                                    className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-[0.7rem] font-bold text-ink"
                                >
                                    تلاش دوباره
                                </button>
                            </div>
                        </div>
                    )}

                    {result === null && (
                        <button
                            type="button"
                            onClick={() => void submit()}
                            disabled={submitting || endpoints.attempts === null}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-surface transition-colors hover:bg-primary-hover disabled:opacity-50"
                        >
                            <Headphones size={16} aria-hidden="true" />
                            {submitting ? 'در حال ثبت…' : 'ثبت پاسخ‌ها و دیدن نتیجه'}
                        </button>
                    )}
                </div>
            </section>

            {translation !== null && (
                <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-50 mx-auto w-full max-w-[680px] px-3">
                    <div className="grid max-h-[42vh] gap-2 overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-[0_18px_44px_rgb(23_34_56_/_0.2)]">
                        <div className="flex items-start justify-between gap-2">
                            <p className="m-0 text-[0.68rem] font-bold text-accent-strong">ترجمهٔ انتخاب</p>
                            <button
                                type="button"
                                onClick={() => setTranslation(null)}
                                aria-label="بستن ترجمه"
                                className="grid h-7 w-7 place-items-center rounded-full border border-line text-muted"
                            >
                                <X size={13} aria-hidden="true" />
                            </button>
                        </div>
                        <p lang="en" dir="ltr" className="m-0 font-en text-xs leading-6 text-muted">
                            {translation.en}
                        </p>
                        <p className="m-0 text-sm leading-7 text-ink">{translation.fa}</p>
                    </div>
                </div>
            )}

            {credit !== null && credit !== undefined && <p className="m-0 text-center text-[0.65rem] text-muted">{credit}</p>}

            <audio
                ref={audioRef}
                preload="metadata"
                onLoadedMetadata={() => {
                    const audio = audioRef.current;
                    if (audio === null) {
                        return;
                    }
                    audio.currentTime = 0;
                    audio.playbackRate = rate;
                    setDurationMs(Number.isFinite(audio.duration) ? audio.duration * 1000 : 0);
                    setTimeMs(0);
                    if (autoplayRef.current) {
                        autoplayRef.current = false;
                        void audio.play().catch(() => setPlaying(false));
                    }
                }}
                onTimeUpdate={() => {
                    const audio = audioRef.current;
                    if (audio !== null) {
                        setTimeMs(audio.currentTime * 1000);
                    }
                }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                    setPlaying(false);
                    if (continuous && index < paragraphs.length - 1) {
                        autoplayRef.current = true;
                        setIndex(index + 1);
                    }
                }}
                className="hidden"
            />
            <audio ref={wordAudioRef} preload="none" className="hidden" />
        </div>
    );

}
