import { Link, usePage } from '@inertiajs/react';
import { MessageCircle, Send } from 'lucide-react';
import { supportChannels } from '@/lib/support';
import type { SharedProps, SupportContact } from '@/types';

/**
 * The one support note used on payment, auth, and account screens. The
 * number and messenger links come from the owner-editable settings, so
 * changing them in the panel changes every placement at once.
 *
 * Owner instruction 2026-11-22: support is reachable in Bale or Telegram
 * on 09936908633 from every screen that can block a purchase, a login,
 * or an account change.
 */
export function SupportNote({
    support: provided,
    className = '',
}: {
    support?: SupportContact | null;
    className?: string;
}): React.JSX.Element {
    const { support: shared } = usePage<SharedProps>().props;
    const support = provided ?? shared ?? null;
    const channels = supportChannels(support);

    return (
        <aside
            aria-label="پشتیبانی"
            className={`grid gap-2 rounded-2xl border border-line bg-canvas px-4 py-3 text-sm leading-7 ${className}`}
        >
            <p className="m-0 flex items-center gap-2 font-bold">
                <MessageCircle size={18} aria-hidden="true" />
                مشکلی داری؟ به پشتیبانی پیام بده.
            </p>
            <p className="m-0 text-muted">
                در بله یا تلگرام به شمارهٔ{' '}
                <span dir="ltr" className="font-en font-bold text-ink">
                    {channels.phone}
                </span>{' '}
                پیام بده. رسید پرداخت فقط در پنل کاربری وب‌سایت بارگذاری می‌شود.
            </p>
            <div className="flex flex-wrap gap-2">
                <a
                    href={channels.bale}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-surface no-underline hover:bg-primary-hover"
                >
                    <MessageCircle size={16} aria-hidden="true" />
                    پیام در بله
                </a>
                <a
                    href={channels.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-field px-4 py-2 font-bold text-ink no-underline hover:bg-surface"
                >
                    <Send size={16} aria-hidden="true" />
                    پیام در تلگرام
                </a>
            </div>
            <Link
                href="/support"
                className="inline-flex min-h-11 w-fit items-center text-xs text-muted no-underline hover:text-ink"
            >
                صفحهٔ پشتیبانی
            </Link>
        </aside>
    );
}
