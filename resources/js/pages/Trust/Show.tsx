import { Head, Link } from '@inertiajs/react';
import { CircleAlert, Info } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { publicLayout } from '@/layouts/PublicLayout';
import type { SharedProps } from '@/types';

/**
 * Trust pages (PUB-02): about, cooperation, faq, support, terms,
 * privacy. Every page keeps its DRAFT badge; support/terms/privacy and
 * the cooperation contact keep their explicit BLOCKED states. No
 * support channel, legal text, name, or number is invented — the S8
 * placeholder scan runs against these props.
 */

type TrustPage = 'about' | 'cooperation' | 'faq' | 'support' | 'terms' | 'privacy';

interface TrustProps extends SharedProps {
    page: TrustPage;
    /**
     * Verbatim server strings: the DRAFT badge and the page's BLOCKED
     * note (null when the page has prose instead). They travel as props
     * so the S8 placeholder scan runs against the encoded page.
     */
    badge: string;
    blocked: string | null;
}

const TITLES: Record<TrustPage, string> = {
    about: 'درباره Fast English',
    cooperation: 'همکاری با Fast English',
    faq: 'پرسش‌های پرتکرار',
    support: 'پشتیبانی Fast English',
    terms: 'قوانین استفاده',
    privacy: 'حریم خصوصی',
};

const HEADINGS: Record<TrustPage, string> = {
    about: 'درباره',
    cooperation: 'همکاری',
    faq: 'پرسش‌های پرتکرار',
    support: 'پشتیبانی',
    terms: 'قوانین استفاده',
    privacy: 'حریم خصوصی',
};

function Blocked({ children }: { children: React.ReactNode }): React.JSX.Element {
    return (
        <div role="note" className="grid gap-2 rounded-3xl border border-line bg-surface p-5">
            <p className="m-0 flex items-center gap-2 font-bold">
                <CircleAlert size={20} aria-hidden="true" />
                {children}
            </p>
        </div>
    );
}

export const TrustShow: FunctionComponent<TrustProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    page,
    badge,
    blocked,
}: TrustProps): React.JSX.Element => {
    return (
        <>
            <Head title={TITLES[page]}>
                <meta name="description" content={TITLES[page]} />
            </Head>
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <p role="note" className="m-0 inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-bold text-muted">
                    <Info size={16} aria-hidden="true" />
                    {badge}
                </p>
                <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">{HEADINGS[page]}</h1>

                {page === 'about' && (
                    <div className="grid gap-3 text-[1.0625rem] leading-9">
                        <p className="m-0">
                            Fast English یک محصول ساده برای خواندن و شنیدن متن‌های کوتاه انگلیسی در سطح مناسب زبان‌آموز است. هر مطلب در
                            چند سطح ارائه می‌شود و صوت هر نسخه دقیقاً همان متن را پوشش می‌دهد.
                        </p>
                        <p className="m-0 text-muted">این متن پیش‌نویس است و پیش از انتشار عمومی توسط صاحب محصول بازبینی و نهایی می‌شود.</p>
                    </div>
                )}

                {page === 'cooperation' && (
                    <>
                        <div className="grid gap-3 text-[1.0625rem] leading-9">
                            <p className="m-0">
                                این صفحه شرایط همکاری (تولید محتوا، آموزش و سایر همکاری‌ها) را توضیح می‌دهد. شرایط نهایی هنوز اعلام نشده است.
                            </p>
                            <p className="m-0 text-muted">این متن پیش‌نویس است و پیش از انتشار عمومی توسط صاحب محصول بازبینی و نهایی می‌شود.</p>
                        </div>
                        {blocked !== null && (
                            <Blocked>
                                <span>{blocked}</span>
                            </Blocked>
                        )}
                    </>
                )}

                {page === 'faq' && (
                    <div className="grid gap-5">
                        {[
                            { q: 'آیا بدون حساب می‌توانم نمونه را ببینم؟', a: 'بله. یک نمونه واقعی از صفحه اصلی در دسترس است و نیازی به ثبت‌نام ندارد.' },
                            { q: 'سطح‌ها چه معنایی دارند؟', a: 'مطالب در سطح‌های A1 تا C2 ارائه می‌شوند. می‌توانید سطح را مستقیم انتخاب کنید یا از آزمون تعیین سطح استفاده کنید.' },
                            { q: 'خرید چگونه انجام می‌شود؟', a: 'پلن را انتخاب می‌کنید، مبلغ را کارت‌به‌کارت می‌کنید و رسید را ارسال می‌کنید. پس از بررسی، اشتراک فعال می‌شود.' },
                        ].map((item) => (
                            <div key={item.q} className="grid gap-1">
                                <h2 className="m-0 text-lg leading-8 font-bold">{item.q}</h2>
                                <p className="m-0 leading-8 text-muted">{item.a}</p>
                            </div>
                        ))}
                        <div className="grid gap-1">
                            <h2 className="m-0 text-lg leading-8 font-bold">فایل نصب اندروید کجاست؟</h2>
                            <p className="m-0 leading-8 text-muted">
                                وضعیت انتشار فایل نصب در{' '}
                                <Link href="/download" className="inline-flex min-h-11 items-center text-primary">
                                    صفحه دانلود
                                </Link>{' '}
                                اعلام می‌شود.
                            </p>
                        </div>
                    </div>
                )}

                {page === 'support' && blocked !== null && (
                    <Blocked>
                        <span>{blocked}</span>
                    </Blocked>
                )}

                {page === 'terms' && blocked !== null && (
                    <Blocked>
                        <span>{blocked}</span>
                    </Blocked>
                )}

                {page === 'privacy' && blocked !== null && (
                    <Blocked>
                        <span>{blocked}</span>
                    </Blocked>
                )}
            </div>
        </>
    );
};

TrustShow.layout = publicLayout;

export default TrustShow;
