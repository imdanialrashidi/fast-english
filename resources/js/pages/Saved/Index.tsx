import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Bookmark, Clock, Compass } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { Pagination } from '@/components/Pagination';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { PaginationMeta, SharedProps, TopicRow } from '@/types';

/**
 * Saved (SAVE-01): the user's bookmarked topics in the same editorial
 * row shape as Discover. Only published topics with a published lesson
 * appear; archived topics vanish while the row persists server-side. A
 * bookmark never grants access — premium opens still hit the reader
 * policy.
 */

interface SavedProps extends SharedProps {
    topics: TopicRow[];
    pagination: PaginationMeta;
}

export const SavedIndex: FunctionComponent<SavedProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    topics,
    pagination,
}: SavedProps): React.JSX.Element => {
    return (
        <>
            <Head title="ذخیره‌شده‌ها" />
            <ScreenHeader
                title="ذخیره‌شده‌ها"
                back={{ href: '/app/account', label: 'بازگشت به حساب' }}
            />
            <div className="mx-auto grid max-w-[1024px] gap-2 px-4 py-5">
                {topics.length === 0 ? (
                    <div role="status" className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <Bookmark size={24} aria-hidden="true" />
                        <p className="m-0 text-xl font-bold">هنوز مطلبی ذخیره نکرده‌ای.</p>
                        <p className="m-0 mt-2">
                            <Link
                                href="/app"
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                <Compass size={20} aria-hidden="true" />
                                دیدن مطالب
                            </Link>
                        </p>
                    </div>
                ) : (
                    <ul
                        id="saved-results"
                        tabIndex={-1}
                        aria-label="مطالب ذخیره‌شده"
                        className="m-0 grid list-none scroll-mt-24 p-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    >
                        {topics.map((topic) => (
                            <li key={topic.slug} className="border-b border-line py-5 first:pt-1 last:border-b-0">
                                <article className="fe-card">
                                    <Link href={topic.reader_url} aria-label={topic.title_en} className="flex min-h-11 gap-4 text-inherit no-underline">
                                        <span className="fe-card-media relative block aspect-video w-32 shrink-0 self-start overflow-hidden rounded-2xl bg-canvas sm:w-44">
                                            {topic.cover_url !== null ? (
                                                <img src={topic.cover_url} alt="" loading="lazy" className="block h-full w-full bg-canvas object-cover" />
                                            ) : (
                                                <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-canvas">
                                                    <img src="/icons/icon-192.png" alt="" width={44} height={44} loading="lazy" className="block h-11 w-11 rounded-[11px]" />
                                                </span>
                                            )}
                                        </span>
                                        <span className="grid min-w-0 content-start gap-1 py-0.5">
                                            <h2 lang="en" dir="ltr" className="m-0 text-right font-en text-lg leading-7 font-bold">
                                                {topic.title_en}
                                            </h2>
                                            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] text-muted">
                                                <Clock size={16} aria-hidden="true" />
                                                حدود {topic.minutes.toLocaleString('fa-IR')} دقیقه مطالعه
                                                {topic.levels.length > 0 && (
                                                    <span>
                                                        — سطح‌ها:{' '}
                                                        <span lang="en" dir="ltr" className="font-en">
                                                            {topic.levels.join('، ')}
                                                        </span>
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                        <span aria-hidden="true" className="ms-auto inline-flex self-center text-muted">
                                            <ArrowLeft size={20} />
                                        </span>
                                    </Link>
                                </article>
                            </li>
                        ))}
                    </ul>
                )}

                <Pagination
                    pagination={pagination}
                    hrefFor={(page) => (page === 1 ? '/app/saved' : `/app/saved?page=${page}`)}
                    label="صفحه‌های ذخیره‌شده‌ها"
                    resultsId="saved-results"
                />
            </div>
        </>
    );
};

SavedIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default SavedIndex;
