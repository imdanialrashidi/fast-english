import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Bookmark, Clock, Compass } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
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
            <div className="mx-auto grid max-w-[1024px] gap-5 px-4 py-6">
                <div>
                    <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">ذخیره‌شده‌ها</h1>
                    <p className="m-0 mt-2 text-[1.0625rem] leading-8 text-muted">مطلب‌هایی که برای بعد نگه داشته‌ای.</p>
                </div>

                {topics.length === 0 ? (
                    <div role="status" className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <Bookmark size={24} aria-hidden="true" />
                        <p className="m-0 text-xl font-bold">هنوز مطلبی ذخیره نکرده‌اید.</p>
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
                    <ul className="m-0 grid list-none p-0">
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
                                            <h2 lang="en" dir="ltr" className="m-0 text-left font-en text-lg leading-7 font-bold">
                                                {topic.title_en}
                                            </h2>
                                            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] text-muted">
                                                <Clock size={16} aria-hidden="true" />
                                                حدود {topic.minutes} دقیقه مطالعه
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

                {pagination.last_page > 1 && (
                    <nav aria-label="صفحه‌های ذخیره‌شده‌ها" className="fe-pagination">
                        <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
                            {Array.from({ length: pagination.last_page }, (_, index) => index + 1).map((page) => (
                                <li key={page}>
                                    <Link
                                        href={page === 1 ? '/app/saved' : `/app/saved?page=${page}`}
                                        aria-label={`صفحه ${page}`}
                                        aria-current={page === pagination.current_page ? 'page' : undefined}
                                        className={
                                            page === pagination.current_page
                                                ? 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-primary px-4 py-2 font-en font-bold text-surface no-underline'
                                                : 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface px-4 py-2 font-en text-ink no-underline hover:bg-canvas'
                                        }
                                    >
                                        <span lang="en" dir="ltr">
                                            {page}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}
            </div>
        </>
    );
};

SavedIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default SavedIndex;
