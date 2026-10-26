import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BookOpen, Check, Clock, Compass, GraduationCap, Languages, Play, Sun } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import { formatAudioTime } from '@/lib/audio';
import type { SharedProps, TopicRow } from '@/types';

/**
 * Today — «امروز» (PLAN-01): greeting, Continue Learning, today's plan,
 * goal progress, due vocabulary, and recommendations. Every row derives
 * from persisted state (the DailyPlan props) — never stored, never a
 * self-toggling button. Incomplete stays incomplete after reload.
 */

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}

interface PlanTask {
    key: string;
    title: string;
    detail: string | null;
    url: string;
    done: boolean;
    title_en: string | null;
    level: string | null;
    cover_url: string | null;
    position_seconds: number | null;
    estimated_minutes: number | null;
}

interface TodayProps extends SharedProps {
    userName: string;
    needsLevel: boolean;
    plan: {
        goal_minutes: number;
        learned_minutes: number;
        progress_pct: number;
        due_words: number;
        tasks: PlanTask[];
    };
    recommendations: TopicRow[];
}

export const TodayIndex: FunctionComponent<TodayProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    userName,
    needsLevel,
    plan,
    recommendations,
}: TodayProps): React.JSX.Element => {
    const continueTask = plan.tasks.find((task) => task.key === 'continue') ?? null;

    return (
        <>
            <Head title="امروز" />
            <div className="mx-auto grid max-w-[680px] gap-6 px-4 py-6">
                <div>
                    <p className="fe-meta fe-bidi m-0 inline-flex items-center gap-1.5 text-muted">
                        <Sun size={20} aria-hidden="true" />
                        سلام، {userName}
                    </p>
                    <h1 className="fe-title m-0 mt-1 text-2xl sm:text-3xl">
                        {plan.learned_minutes > 0
                            ? 'امروز هم قدمی به سمت هدف‌هات برداشتی.'
                            : 'امروز از کجا شروع می‌کنیم؟'}
                    </h1>
                </div>

                {needsLevel && (
                    <section aria-label="انتخاب سطح" className="grid gap-3 rounded-3xl border border-primary/30 bg-primary/5 p-5">
                        <p className="m-0 inline-flex items-center gap-2 text-sm font-bold text-primary">
                            <GraduationCap size={18} aria-hidden="true" />
                            یک قدم کوتاه
                        </p>
                        <p className="m-0 text-lg leading-8 font-bold">سطح ترجیحی‌ات را انتخاب کن</p>
                        <p className="m-0 text-sm leading-7 text-muted">
                            یک آزمون ۲۰ سؤالی یا انتخاب دستی. هر مطلب سطح خودش را دارد و بعداً هم می‌توانی تغییر بدهی.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                href="/app/placement"
                                className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-5 py-2 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                تعیین سطح
                            </Link>
                            <Link
                                href="/app/account/settings"
                                className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-5 py-2 text-sm font-bold text-ink no-underline hover:bg-canvas"
                            >
                                انتخاب دستی
                            </Link>
                        </div>
                    </section>
                )}

                {continueTask !== null && (
                    <section aria-label="ادامه یادگیری" className="grid gap-3 rounded-3xl border border-line bg-surface p-5">
                        <div className="flex items-start gap-3">
                            {continueTask.cover_url !== null ? (
                                <img
                                    src={continueTask.cover_url}
                                    alt=""
                                    width={88}
                                    height={88}
                                    loading="lazy"
                                    className="h-[88px] w-[88px] shrink-0 rounded-2xl bg-canvas object-cover"
                                />
                            ) : (
                                <span aria-hidden="true" className="inline-flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-2xl bg-canvas text-muted">
                                    <BookOpen size={28} />
                                </span>
                            )}
                            <div className="min-w-0">
                                <p className="m-0 inline-flex items-center gap-1.5 text-sm font-bold text-accent-strong">
                                    <Play size={16} aria-hidden="true" />
                                    ادامه یادگیری
                                </p>
                                <h2 lang="en" dir="ltr" className="m-0 mt-0.5 text-left font-en text-xl leading-8 font-bold">
                                    {continueTask.title_en ?? continueTask.detail ?? continueTask.title}
                                </h2>
                                {continueTask.level !== null && (
                                    <p className="m-0 mt-1">
                                        <span lang="en" dir="ltr" className="inline-flex items-center rounded-full border border-line bg-canvas px-2.5 py-0.5 font-en text-sm font-bold">
                                            {continueTask.level}
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>
                        {(continueTask.position_seconds !== null ||
                            (continueTask.estimated_minutes !== null && continueTask.estimated_minutes > 0)) && (
                            <p className="fe-meta m-0 text-muted">
                                {continueTask.position_seconds !== null && (
                                    <>
                                        ادامه از <span dir="ltr">{formatAudioTime(continueTask.position_seconds)}</span>
                                    </>
                                )}
                                {continueTask.position_seconds !== null && continueTask.estimated_minutes !== null && continueTask.estimated_minutes > 0 && (
                                    <> · </>
                                )}
                                {continueTask.estimated_minutes !== null && continueTask.estimated_minutes > 0 && (
                                    <>حدود {fa(continueTask.estimated_minutes)} دقیقه</>
                                )}
                            </p>
                        )}
                        <p className="m-0">
                            <Link
                                href={continueTask.url}
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                <Play size={20} aria-hidden="true" />
                                ادامه مطالعه
                            </Link>
                        </p>
                    </section>
                )}

                <section aria-label="برنامه امروز" className="grid gap-3">
                    <h2 className="m-0 flex items-center gap-2 text-xl leading-8">
                        <BookOpen size={20} aria-hidden="true" />
                        برنامه امروز
                    </h2>
                    {plan.tasks.length === 0 ? (
                        <div className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-10 text-center">
                            <Compass size={24} aria-hidden="true" />
                            <p className="m-0 leading-8 text-muted">هنوز برنامه‌ای نیست. یک مطلب انتخاب کن تا برنامه امروزت ساخته شود.</p>
                            <p className="m-0 mt-1">
                                <Link
                                    href="/app"
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    <Compass size={20} aria-hidden="true" />
                                    کشف مطالب
                                </Link>
                            </p>
                        </div>
                    ) : (
                        <ul className="m-0 grid list-none divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface p-0">
                            {plan.tasks.map((task) => (
                                <li key={task.key} className="flex items-start gap-3 px-4 py-3.5" data-done={task.done ? '1' : '0'}>
                                    <span
                                        aria-hidden="true"
                                        className={
                                            task.done
                                                ? 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-strong text-surface'
                                                : 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-canvas'
                                        }
                                    >
                                        {task.done && <Check size={16} />}
                                    </span>
                                    <span className="min-w-0">
                                        <Link
                                            href={task.url}
                                            aria-label={task.done ? `${task.title} (انجام شده)` : undefined}
                                            className="inline-flex min-h-11 items-center font-bold text-ink no-underline hover:text-primary"
                                        >
                                            {task.title}
                                        </Link>
                                        {task.detail !== null && (
                                            <>
                                                <br />
                                                <small dir="auto" className="text-muted">
                                                    {task.detail}
                                                </small>
                                            </>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section
                    aria-label="هدف امروز"
                    className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-3xl border border-line bg-surface p-5"
                >
                    <div
                        role="img"
                        aria-label={`پیشرفت امروز: ${plan.progress_pct} درصد`}
                        className="relative inline-flex h-20 w-20 shrink-0 items-center justify-center"
                    >
                        <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 h-full w-full">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-line)" strokeWidth="8" />
                            {plan.progress_pct > 0 && (
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="42"
                                    fill="none"
                                    stroke="var(--color-accent-strong)"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    pathLength={100}
                                    strokeDasharray={`${Math.min(100, plan.progress_pct)} 100`}
                                    transform="rotate(-90 50 50)"
                                />
                            )}
                        </svg>
                        <span dir="ltr" className="font-en text-xs font-bold tabular-nums">
                            {fa(plan.learned_minutes)}/{fa(plan.goal_minutes)}
                        </span>
                    </div>
                    <div>
                        <h2 className="m-0 text-base leading-8 sm:text-lg">هدف امروز: {fa(plan.goal_minutes)} دقیقه مطالعه</h2>
                        <p className="m-0 mt-1 leading-8 text-muted">{fa(plan.learned_minutes)} دقیقه از برنامه امروز انجام شده.</p>
                        {plan.due_words > 0 && (
                            <p className="m-0 mt-2">
                                <Link
                                    href="/app/words/review"
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2 font-bold text-ink no-underline hover:bg-surface"
                                >
                                    <Languages size={20} aria-hidden="true" />
                                    مرور {fa(plan.due_words)} واژه
                                </Link>
                            </p>
                        )}
                    </div>
                </section>

                {recommendations.length > 0 && (
                    <section aria-label="مطالب پیشنهادی" className="grid gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="m-0 flex items-center gap-2 text-xl leading-8">
                                <Compass size={20} aria-hidden="true" />
                                مطالب پیشنهادی
                            </h2>
                            <Link
                                href="/app"
                                className="inline-flex min-h-11 min-w-11 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-bold text-primary no-underline hover:bg-primary/5"
                            >
                                مشاهده همه
                                <ArrowLeft size={16} aria-hidden="true" />
                            </Link>
                        </div>
                        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
                            {recommendations.map((topic) => (
                                <li key={topic.slug}>
                                    <article className="overflow-hidden rounded-3xl border border-line bg-surface">
                                        <Link href={topic.reader_url} aria-label={topic.title_en} className="block min-h-11 text-inherit no-underline">
                                            <span className="relative block aspect-video w-full overflow-hidden bg-canvas">
                                                {topic.cover_url !== null ? (
                                                    <img src={topic.cover_url} alt="" loading="lazy" className="block h-full w-full bg-canvas object-cover" />
                                                ) : (
                                                    <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-canvas">
                                                        <img src="/icons/icon-192.png" alt="" width={56} height={56} loading="lazy" className="block h-14 w-14 rounded-[14px]" />
                                                    </span>
                                                )}
                                                {topic.levels.length > 0 && (
                                                    <span aria-hidden="true" className="absolute start-3 top-3 inline-flex">
                                                        <span
                                                            lang="en"
                                                            dir="ltr"
                                                            className="fe-chip inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-0.5 font-en text-xs font-bold"
                                                        >
                                                            {topic.levels[0]}
                                                        </span>
                                                    </span>
                                                )}
                                            </span>
                                            <span className="grid gap-1 px-4 pt-3 pb-4">
                                                <h3 lang="en" dir="ltr" className="m-0 text-left font-en text-lg leading-7 font-bold">
                                                    {topic.title_en}
                                                </h3>
                                                <span className="inline-flex flex-wrap items-center gap-1.5 text-[0.9375rem] text-muted">
                                                    <Clock size={16} aria-hidden="true" />
                                                    حدود {fa(topic.minutes)} دقیقه مطالعه
                                                    {topic.levels.length > 0 && (
                                                        <span lang="en" dir="ltr" className="font-en">
                                                            {' '}· {topic.levels.join('، ')}
                                                        </span>
                                                    )}
                                                </span>
                                            </span>
                                        </Link>
                                    </article>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </>
    );
};

TodayIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default TodayIndex;
