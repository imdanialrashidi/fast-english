import { Head, Link } from '@inertiajs/react';
import { BookOpen, Lock, Play, UserPlus } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { SharedProps } from '@/types';

/**
 * Locked learner state (paid-only gate, owner requirement): what every
 * ineligible learner-page request renders — no subscription, pending,
 * expired, or revoked. Status stays 403 and no premium body, glossary,
 * audio URL, answer, or vocabulary travels in the props. One primary
 * CTA (subscribe for signed-in learners, register for guests) plus the
 * public sample as the honest free path. Uses the learner shell: this
 * is the learner experience's own permission state, not a marketing page.
 */

interface LockedProps extends SharedProps {
    isGuest: boolean;
    subscribeUrl: string;
    registerUrl: string;
    loginUrl: string;
    sampleUrl: string;
}

export const LockedIndex: FunctionComponent<LockedProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    isGuest,
    subscribeUrl,
    registerUrl,
    loginUrl,
    sampleUrl,
}: LockedProps): React.JSX.Element => {
    return (
        <>
            <Head title="نیاز به اشتراک فعال" />
            <ScreenHeader
                title="اشتراک"
                width="reading"
                back={{ href: isGuest ? '/' : '/app/account', label: isGuest ? 'بازگشت به صفحه اصلی' : 'بازگشت به حساب' }}
            />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-8">
                <section aria-label="نیاز به اشتراک" className="grid justify-items-start gap-3 rounded-3xl border border-line bg-surface p-6">
                    <p aria-hidden="true" className="m-0 inline-flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-primary">
                        <Lock size={24} />
                    </p>
                    <h2 className="m-0 text-2xl leading-[1.7] font-extrabold tracking-tight">برای ادامه، اشتراک فعال لازم است</h2>
                    <p className="m-0 text-[1.0625rem] leading-8 text-muted">
                        {isGuest
                            ? 'این بخش یادگیری فقط برای اعضایی است که اشتراک فعال دارند. اول حساب بساز، بعد پلن را انتخاب کن.'
                            : 'اشتراک فعالی روی حسابت نیست — یا هنوز خرید نکرده‌ای، یا درخواستت در صف بررسی است، یا اشتراکت تمام شده. وضعیتت را ببین و ادامه بده.'}
                    </p>
                    <p className="m-0 flex flex-wrap gap-2">
                        {isGuest ? (
                            <>
                                <Link
                                    href={registerUrl}
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    <UserPlus size={20} aria-hidden="true" />
                                    ساخت حساب
                                </Link>
                                <Link
                                    href={loginUrl}
                                    className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                                >
                                    ورود
                                </Link>
                            </>
                        ) : (
                            <Link
                                href={subscribeUrl}
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                مشاهده پلن‌ها و خرید
                            </Link>
                        )}
                    </p>
                </section>
                <section aria-label="نمونه رایگان" className="grid justify-items-start gap-2 rounded-3xl border border-line bg-surface p-6">
                    <h2 className="m-0 flex items-center gap-2 text-lg leading-8">
                        <BookOpen size={20} aria-hidden="true" />
                        هنوز مطمئن نیستی؟
                    </h2>
                    <p className="m-0 leading-8 text-muted">نمونه واقعی همیشه رایگان است و بدون اشتراک باز می‌شود.</p>
                    <p className="m-0">
                        <Link
                            href={sampleUrl}
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                        >
                            <Play size={20} aria-hidden="true" />
                            شنیدن نمونه رایگان
                        </Link>
                    </p>
                </section>
            </div>
        </>
    );
};

LockedIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default LockedIndex;
