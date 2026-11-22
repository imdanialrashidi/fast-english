import { Head } from '@inertiajs/react';
import { LibraryBig } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { BookTabs } from '@/components/library/BookTabs';
import { CollectionCard } from '@/components/library/CollectionCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { LibraryCollection, LibraryTab, SharedProps } from '@/types';

/**
 * The books shelf: five independent items — American English File, Oxford
 * Bookworms story books, Cambridge IELTS reading, Inside Reading, and the
 * standalone TED Talks section. Each item keeps its own hierarchy and
 * reader; this page only routes the learner to the right one.
 */

interface BooksIndexProps extends SharedProps {
    collections: LibraryCollection[];
    tabs: LibraryTab[];
}

export const BooksIndex: FunctionComponent<BooksIndexProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = ({ collections, tabs }: BooksIndexProps): React.JSX.Element => {
    return (
        <>
            <Head title="کتاب‌ها" />
            <ScreenHeader title="کتاب‌ها" />
            <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-6 px-4 py-5 sm:gap-8">
                <header className="grid min-w-0 grid-cols-1 gap-2">
                    <p className="fe-meta m-0 inline-flex items-center gap-1.5 text-accent-strong">
                        <LibraryBig size={18} aria-hidden="true" />
                        پنج بخش مستقل
                    </p>
                    <h1 className="fe-title m-0 text-2xl leading-10 sm:text-3xl">از گرامر تا داستان و آیلتس.</h1>
                    <p className="fe-prose m-0 max-w-[68ch] text-muted">
                        هر بخش مسیر خودش را دارد: کتاب دوره با یونیت و تمرین، استوری‌بوک با تصویر و صدای هم‌زمان،
                        آیلتس با تست و پسیج، اینساید ریدینگ با متن و صدای اصلی، و TED Talk با گفتارهای مستقل. پیشرفت هر بخش جدا ذخیره می‌شود.
                    </p>
                    <BookTabs tabs={tabs} />
                </header>

                <section aria-label="بخش‌های کتاب" className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                    {collections.map((collection) => (
                        <CollectionCard key={collection.key} collection={collection} />
                    ))}
                </section>

                <section className="grid gap-2 rounded-3xl border border-line bg-surface p-5">
                    <h2 className="m-0 text-lg font-extrabold">چطور شروع کنم؟</h2>
                    <p className="m-0 text-sm leading-7 text-muted">
                        اگر تازه شروع کرده‌ای، از «کتاب» و استارتر برو. برای شنیدن و خواندن هم‌زمان، استوری‌بوک را باز
                        کن؛ برای تمرین آزمون، آیلتس؛ و برای متن‌های بلندتر با صدای اصلی، اینساید ریدینگ.
                    </p>
                </section>
            </div>
        </>
    );
};

BooksIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default BooksIndex;
