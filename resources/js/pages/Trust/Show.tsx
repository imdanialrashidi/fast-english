import { Link } from '@inertiajs/react';
import { Info, MessageCircle, Phone } from 'lucide-react';
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
    support_phone: string;
    support_phone_href: string | null;
    support_email: string;
    support_email_href: string | null;
    support_messenger: string;
    support_messenger_note: string;
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
    /** Server-owned FAQ rows; the same list feeds the FAQPage JSON-LD. */
    faqs: { q: string; a: string }[];
}

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
    faqs,
    has_public_sample,
}: TrustProps): React.JSX.Element => {
    return (
        <>
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">{HEADINGS[page]}</h1>

                {page === 'about' && (
                    <div className="grid gap-3 text-[1.0625rem] leading-9">
                        <p className="m-0">
                            Fast English یک محصول ساده برای خواندن و شنیدن متن‌های کوتاه انگلیسی در سطح مناسب زبان‌آموز است. هر مطلب در
                            چند سطح ارائه می‌شود و صوت هر نسخه دقیقاً همان متن را پوشش می‌دهد.
                        </p>
                        <p className="m-0">
                            هر مطلب در شش سطح A1 تا C2 بازنویسی می‌شود و متن و صوت هر نسخه از یک درس می‌آیند؛ سطح فقط سختی متن را
                            می‌گوید، نه دسترسی را.
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
                        {faqs.map((item) => (
                            <div key={item.q} className="grid gap-1">
                                <h2 className="m-0 text-lg leading-8 font-bold">{item.q}</h2>
                                <p className="m-0 leading-8 text-muted">{item.a}</p>
                            </div>
                        ))}
                        <div className="grid gap-1">
                            <h2 className="m-0 text-lg leading-8 font-bold">اگر پرداخت مشکل داشت چه کنم؟</h2>
                            <p className="m-0 leading-8 text-muted">
                                به پشتیبانی پیام بده: {' '}
                                {contact.support_phone_href !== null ? (
                                    <a href={contact.support_phone_href} dir="ltr" className="inline-flex min-h-11 items-center text-primary">
                                        {contact.support_phone}
                                    </a>
                                ) : (
                                    <span dir="ltr">{contact.support_phone}</span>
                                )}{' '}
                                ({contact.support_messenger} هم با همین شماره). شرایط بازگشت وجه در صفحهٔ{' '}
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
                            برای پیگیری پرداخت، مشکل ورود یا هر پرسش دربارهٔ حساب، به پشتیبانی پیام بده. شمارهٔ پیگیری یا تصویر رسید را
                            همراه پیام بفرست تا سریع‌تر بررسی شود.
                        </p>
                        <div className="grid gap-2 rounded-3xl border border-line bg-surface p-5">
                            <p className="m-0 flex flex-wrap items-center gap-2">
                                <Phone size={20} aria-hidden="true" className="text-muted" />
                                <span className="font-bold">تلفن پشتیبانی:</span>
                                {contact.support_phone_href !== null ? (
                                    <a
                                        href={contact.support_phone_href}
                                        dir="ltr"
                                        className="inline-flex min-h-11 items-center font-bold text-primary"
                                    >
                                        {contact.support_phone}
                                    </a>
                                ) : (
                                    <span dir="ltr">{contact.support_phone}</span>
                                )}
                            </p>
                            <p className="m-0 flex flex-wrap items-center gap-2 text-muted">
                                <MessageCircle size={20} aria-hidden="true" />
                                <span className="font-bold text-ink">پیام‌رسان {contact.support_messenger}:</span>
                                <span className="text-ink" dir="ltr">
                                    {contact.support_phone}
                                </span>
                            </p>
                            <p className="m-0 text-sm leading-7 text-muted">{contact.support_messenger_note}</p>
                            <p className="m-0 text-sm leading-7 text-muted">
                                ایمیل:{' '}
                                {contact.support_email_href !== null ? (
                                    <a
                                        href={contact.support_email_href}
                                        dir="ltr"
                                        className="inline-flex min-h-11 items-center text-primary"
                                    >
                                        {contact.support_email}
                                    </a>
                                ) : (
                                    <span dir="ltr">{contact.support_email}</span>
                                )}
                            </p>
                            {contact.support_hours !== null && <p className="m-0 text-muted">ساعت پاسخ‌گویی: {contact.support_hours}</p>}
                        </div>
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
