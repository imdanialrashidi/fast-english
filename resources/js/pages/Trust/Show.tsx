import { Head, Link } from '@inertiajs/react';
import { Info, MessageCircle } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { publicLayout } from '@/layouts/PublicLayout';
import type { SharedProps } from '@/types';

/**
 * Trust pages (PUB-02): about, cooperation, faq, support, terms,
 * privacy, refund.
 *
 * Owner instruction 2026-10-25: public pages never expose internal
 * workflow labels. Contact channels and legal copy come from staff-editable
 * settings with config defaults; a missing value renders a calm public
 * note, never an invented address or claim.
 */

type TrustPage = 'about' | 'cooperation' | 'faq' | 'support' | 'terms' | 'privacy' | 'refund';

interface ContactProps {
    support_channel: string;
    support_href: string | null;
    support_hours: string | null;
    cooperation_channel: string;
    cooperation_href: string | null;
}

interface TrustProps extends SharedProps {
    page: TrustPage;
    /** Public fallback note; null when the page has its own copy. */
    notice: string | null;
    contact: ContactProps;
    legal: string | null;
}

const TITLES: Record<TrustPage, string> = {
    about: 'درباره Fast English',
    cooperation: 'همکاری با Fast English',
    faq: 'پرسش‌های پرتکرار',
    support: 'پشتیبانی Fast English',
    terms: 'قوانین استفاده',
    privacy: 'حریم خصوصی',
    refund: 'بازگشت وجه',
};

const HEADINGS: Record<TrustPage, string> = {
    about: 'درباره',
    cooperation: 'همکاری',
    faq: 'پرسش‌های پرتکرار',
    support: 'پشتیبانی',
    terms: 'قوانین استفاده',
    privacy: 'حریم خصوصی',
    refund: 'بازگشت وجه',
};

function Notice({ children }: { children: React.ReactNode }): React.JSX.Element {
    return (
        <div role="note" className="grid gap-2 rounded-3xl border border-line bg-surface p-5">
            <p className="m-0 flex items-start gap-2 leading-8">
                <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
                <span>{children}</span>
            </p>
        </div>
    );
}

function ChannelLink({ channel, href }: { channel: string; href: string | null }): React.JSX.Element {
    if (href === null) {
        return <span dir="ltr">{channel}</span>;
    }

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="inline-flex min-h-11 items-center gap-1.5 font-bold text-primary"
        >
            <MessageCircle size={20} aria-hidden="true" />
            {channel}
        </a>
    );
}

function withBidiIsolates(text: string): React.ReactNode[] {
    // A bare @handle inside a Persian paragraph is reordered by the bidi
    // algorithm («test@»). Keep every handle in its own LTR isolate.
    return text.split(/(@[A-Za-z0-9_]{3,64})/g).map((part, index) =>
        part.startsWith('@') ? (
            <bdi key={index} dir="ltr">
                {part}
            </bdi>
        ) : (
            part
        ),
    );
}

function LegalBody({ text }: { text: string | null }): React.JSX.Element {
    if (text === null) {
        return <Notice>متن این صفحه هنوز منتشر نشده است.</Notice>;
    }

    const paragraphs = text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph !== '');

    return (
        <div className="grid gap-4 text-[1.0625rem] leading-9">
            {paragraphs.map((paragraph, index) => (
                <p key={index} className="m-0">
                    {withBidiIsolates(paragraph)}
                </p>
            ))}
        </div>
    );
}

export const TrustShow: FunctionComponent<TrustProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    page,
    notice,
    contact,
    legal,
    has_public_sample,
}: TrustProps): React.JSX.Element => {
    return (
        <>
            <Head title={TITLES[page]}>
                <meta name="description" content={TITLES[page]} />
            </Head>
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">{HEADINGS[page]}</h1>

                {page === 'about' && (
                    <div className="grid gap-3 text-[1.0625rem] leading-9">
                        <p className="m-0">
                            Fast English یک محصول ساده برای خواندن و شنیدن متن‌های کوتاه انگلیسی در سطح مناسب زبان‌آموز است. هر مطلب در
                            چند سطح ارائه می‌شود و صوت هر نسخه دقیقاً همان متن را پوشش می‌دهد.
                        </p>
                        <p className="m-0 text-muted">
                            {has_public_sample
                                ? 'نمونهٔ واقعی بدون حساب در دسترس است. برای ادامه، حساب بسازید و پلن را انتخاب کنید.'
                                : 'نمونهٔ عمومی هنوز منتشر نشده است. برای دسترسی به درس‌ها، حساب بسازید و پلن را انتخاب کنید.'}
                        </p>
                    </div>
                )}

                {page === 'cooperation' && (
                    <div className="grid gap-4 text-[1.0625rem] leading-9">
                        <p className="m-0">
                            برای پیشنهاد تولید محتوا، آموزش یا همکاری دیگر، پیام خود را همراه با نمونهٔ کار و زمینهٔ همکاری به کانال زیر
                            بفرستید. پاسخ پس از بررسی ارسال می‌شود.
                        </p>
                        <p className="m-0">
                            کانال همکاری: <ChannelLink channel={contact.cooperation_channel} href={contact.cooperation_href} />
                        </p>
                        {notice !== null && <Notice>{notice}</Notice>}
                    </div>
                )}

                {page === 'faq' && (
                    <div className="grid gap-5">
                        {[
                            {
                                q: 'آیا بدون حساب می‌توانم نمونه را ببینم؟',
                                a: has_public_sample
                                    ? 'بله. یک نمونه واقعی از صفحه اصلی در دسترس است و نیازی به ثبت‌نام ندارد.'
                                    : 'نمونهٔ عمومی هنوز منتشر نشده است؛ پس از انتشار، بدون ثبت‌نام باز می‌شود.',
                            },
                            { q: 'سطح‌ها چه معنایی دارند؟', a: 'مطالب در سطح‌های A1 تا C2 ارائه می‌شوند. می‌توانید سطح را مستقیم انتخاب کنید یا از آزمون تعیین سطح استفاده کنید.' },
                            { q: 'خرید چگونه انجام می‌شود؟', a: 'پلن را انتخاب می‌کنید، مبلغ را کارت‌به‌کارت می‌کنید و رسید را ارسال می‌کنید. پس از بررسی، اشتراک فعال می‌شود.' },
                        ].map((item) => (
                            <div key={item.q} className="grid gap-1">
                                <h2 className="m-0 text-lg leading-8 font-bold">{item.q}</h2>
                                <p className="m-0 leading-8 text-muted">{item.a}</p>
                            </div>
                        ))}
                        <div className="grid gap-1">
                            <h2 className="m-0 text-lg leading-8 font-bold">اگر پرداخت مشکل داشت چه کنم؟</h2>
                            <p className="m-0 leading-8 text-muted">
                                از صفحهٔ{' '}
                                <Link href="/support" className="inline-flex min-h-11 items-center text-primary">
                                    پشتیبانی
                                </Link>{' '}
                                پیام بدهید. شرایط بازگشت وجه در صفحهٔ{' '}
                                <Link href="/refund" className="inline-flex min-h-11 items-center text-primary">
                                    بازگشت وجه
                                </Link>{' '}
                                آمده است.
                            </p>
                        </div>
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

                {page === 'support' && (
                    <div className="grid gap-4 text-[1.0625rem] leading-9">
                        <p className="m-0">
                            برای پیگیری پرداخت، مشکل دسترسی یا پرسش دربارهٔ حساب، از کانال زیر پیام بدهید. شمارهٔ پیگیری یا تصویر رسید
                            را همراه پیام بفرستید تا بررسی سریع‌تر شود.
                        </p>
                        <p className="m-0">
                            کانال پشتیبانی: <ChannelLink channel={contact.support_channel} href={contact.support_href} />
                        </p>
                        {contact.support_hours !== null && <p className="m-0 text-muted">ساعت پاسخ‌گویی: {contact.support_hours}</p>}
                        {notice !== null && <Notice>{notice}</Notice>}
                        <p className="m-0">
                            <Link
                                href="/faq"
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-bold text-ink no-underline hover:bg-canvas"
                            >
                                دیدن پرسش‌های پرتکرار
                            </Link>
                        </p>
                    </div>
                )}

                {(page === 'terms' || page === 'privacy' || page === 'refund') && <LegalBody text={legal} />}

                {page !== 'faq' && page !== 'support' && (
                    <p className="m-0">
                        <Link href="/faq" className="inline-flex min-h-11 items-center text-primary">
                            پرسش‌های پرتکرار
                        </Link>
                    </p>
                )}
            </div>
        </>
    );
};

TrustShow.layout = publicLayout;

export default TrustShow;
