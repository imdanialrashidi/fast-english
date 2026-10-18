import { Head, Link } from '@inertiajs/react';
import { BookOpen } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import type { SharedProps } from '@/types';

/**
 * M1 missing level (level semantics, scope §8): the requested level is
 * not published for this topic. The exact message renders with the
 * available levels — never a silent substitution, never a redirect.
 */
interface NotReadyProps extends SharedProps {
    topic: {
        slug: string;
        title_en: string;
    };
    requestedLevel: string;
    availableLevels: string[];
}

export const ReaderNotReady: FunctionComponent<NotReadyProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    topic,
    requestedLevel,
    availableLevels,
}: NotReadyProps): React.JSX.Element => {
    return (
        <>
            <Head title="سطح آماده نیست" />
            <div className="mx-auto grid max-w-[680px] gap-4 px-4 py-10">
                <div role="status" className="grid justify-items-center gap-3 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                    <span aria-hidden="true" className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-canvas text-primary">
                        <BookOpen size={28} />
                    </span>
                    <h1 className="m-0 text-2xl leading-9 font-extrabold">این سطح هنوز آماده نیست</h1>
                    <p className="m-0 leading-8 text-muted">
                        سطح درخواستی (
                        <span lang="en" dir="ltr" className="font-en font-bold">
                            {requestedLevel}
                        </span>
                        ) برای این مطلب منتشر نشده است. سطح دیگری جایگزین نشد؛ یکی از سطح‌های آماده را انتخاب کنید:
                    </p>
                    <p lang="en" dir="ltr" className="m-0 text-left font-en text-lg font-bold">
                        {topic.title_en}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {availableLevels.map((level) => (
                            <Link
                                key={level}
                                href={`/app/topics/${topic.slug}?level=${level}`}
                                className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-5 py-2 font-en font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                <span lang="en" dir="ltr">
                                    {level}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

ReaderNotReady.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default ReaderNotReady;
