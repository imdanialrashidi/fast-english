import { Link } from '@inertiajs/react';
import { Download, Info, Mail, MessageCircle, Send } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { publicLayout } from '@/layouts/PublicLayout';
import type { SharedProps } from '@/types';

/**
 * Trust pages (PUB-02): about, cooperation, faq, support, terms, privacy.
 *
 * Owner instruction 2026-11-25 replaced the about/cooperation/support copy,
 * fixed the four FAQ questions, removed the refund page, and made Bale and
 * Telegram the only support actions. Receipts are uploaded only in the web
 * panel; no page asks anyone to send a receipt in a messenger.
 */

type TrustPage = 'about' | 'cooperation' | 'faq' | 'support' | 'terms' | 'privacy';

interface ContactProps {
    support_channel: string;
    support_href: string | null;
    support_phone: string;
    support_phone_href: string | null;
    support_email: string;
    support_email_href: string | null;
    support_messenger: string;
    support_messenger_note: string;
    support_telegram_url: string | null;
    support_bale_url: string | null;
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
    about: 'درباره ما',
    cooperation: 'همکاری',
    faq: 'پرسش‌های شما',
    support: 'پشتیبانی',
    terms: 'قوانین استفاده',
    privacy: 'حریم خصوصی',
};

const SUPPORT_LEAD =
    'برای پرسش‌های قبل از خرید، راهنمایی استفاده از برنامه، مشکل ورود یا پیگیری اشتراک، در بله یا تلگرام به شمارهٔ ۰۹۹۳۶۹۰۸۶۳۳ پیام بدهید.';

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

function MessengerActions({ contact }: { contact: ContactProps }): React.JSX.Element {
    return (
        <div className="flex flex-wrap gap-2">
            {contact.support_bale_url !== null && (
                <a
                    href={contact.support_bale_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                >
                    <MessageCircle size={16} aria-hidden="true" />
                    پیام در بله
                </a>
            )}
            {contact.support_telegram_url !== null && (
                <a
                    href={contact.support_telegram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-field px-4 py-2 text-sm font-bold text-ink no-underline hover:bg-canvas"
                >
                    <Send size={16} aria-hidden="true" />
                    پیام در تلگرام
                </a>
            )}
        </div>
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
}: TrustProps): React.JSX.Element => {
    return (
        <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
            <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">{HEADINGS[page]}</h1>

            {page === 'about' && (
                <div className="grid gap-4 text-[1.0625rem] leading-9">
                    <p className="m-0">
                        فست انگلیش برای فارسی‌زبانانی ساخته شده که می‌خواهند انگلیسی را به‌صورت استاندارد و جذاب یاد بگیرند. هر
                        پادکست در شش سطح استاندارد ارائه می‌شود تا از سطح مناسب خودت شروع کنی و با گوش‌دادن، حتی بدون نگاه‌کردن به
                        موبایل، کلمات جدید یاد بگیری.
                    </p>
                    <p className="m-0">
                        از داستان کوتاه و آزمون‌های آیلتس تا سخنرانی TED، Inside Reading و یونیت‌های گرامر و…، هزاران ساعت پادکست و
                        آموزش در اختیار توست. برنامهٔ روزانه، واژنامهٔ شخصی، تمرین و مرور کمک می‌کنند یادگیری را ادامه بدهی و
                        پیشرفتت را ببینی.
                    </p>
                </div>
            )}

            {page === 'cooperation' && (
                <div className="grid gap-4 text-[1.0625rem] leading-9">
                    <p className="m-0">
                        اگر در آموزش زبان انگلیسی یا تولید محتوای آموزشی فعالیت می‌کنید و پیشنهادی برای همکاری با فست انگلیش
                        دارید، معرفی کوتاه، زمینهٔ همکاری و نمونه‌کارتان را برای ما بفرستید. پس از بررسی، با شما در ارتباط خواهیم
                        بود.
                    </p>
                    <p className="m-0">
                        ایمیل همکاری:{' '}
                        <a
                            href={contact.cooperation_href ?? 'mailto:info@fastenglishpodcast.ir'}
                            dir="ltr"
                            className="inline-flex min-h-11 items-center gap-1.5 font-bold text-primary"
                        >
                            <Mail size={18} aria-hidden="true" />
                            {contact.cooperation_channel}
                        </a>
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
                    <div className="grid gap-2 rounded-3xl border border-line bg-surface p-5">
                        <p className="m-0 leading-8 text-muted">{SUPPORT_LEAD}</p>
                        <MessengerActions contact={contact} />
                    </div>
                    <p className="m-0">
                        <Link
                            href="/download"
                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-bold text-ink no-underline hover:bg-canvas"
                        >
                            <Download size={18} aria-hidden="true" />
                            صفحهٔ دانلود و راهنمای نصب
                        </Link>
                    </p>
                </div>
            )}

            {page === 'support' && (
                <div className="grid gap-4 text-[1.0625rem] leading-9">
                    <p className="m-0">{SUPPORT_LEAD}</p>
                    <div className="grid gap-3 rounded-3xl border border-line bg-surface p-5">
                        <MessengerActions contact={contact} />
                        <p className="m-0 text-sm leading-7 text-muted" dir="rtl">
                            شمارهٔ پشتیبانی در بله و تلگرام:{' '}
                            <span dir="ltr" className="font-en font-bold text-ink">
                                {contact.support_phone}
                            </span>
                        </p>
                        {contact.support_email_href !== null && (
                            <p className="m-0 text-sm leading-7 text-muted">
                                ایمیل:{' '}
                                <a
                                    href={contact.support_email_href}
                                    dir="ltr"
                                    className="inline-flex min-h-11 items-center text-primary"
                                >
                                    {contact.support_email}
                                </a>
                            </p>
                        )}
                    </div>
                    {notice !== null && <Notice>{notice}</Notice>}
                    <p className="m-0">
                        <Link
                            href="/faq"
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-bold text-ink no-underline hover:bg-canvas"
                        >
                            پرسش‌های شما
                        </Link>
                    </p>
                </div>
            )}

            {(page === 'terms' || page === 'privacy') && <LegalBody text={legal} />}

            {page !== 'faq' && page !== 'support' && (
                <p className="m-0">
                    <Link href="/faq" className="inline-flex min-h-11 items-center text-primary">
                        پرسش‌های شما
                    </Link>
                </p>
            )}
        </div>
    );
};

TrustShow.layout = publicLayout;

export default TrustShow;
