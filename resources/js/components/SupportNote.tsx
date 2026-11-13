import { Link, usePage } from '@inertiajs/react';
import { MessageCircle } from 'lucide-react';
import type { SharedProps, SupportContact } from '@/types';

/**
 * The one support note used on payment, auth, and account screens. The
 * number and messenger label come from the owner-editable settings, so
 * changing them in the panel changes every placement at once.
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

    return (
        <aside
            aria-label="پشتیبانی"
            className={`grid gap-1.5 rounded-2xl border border-line bg-canvas px-4 py-3 text-sm leading-7 ${className}`}
        >
            <p className="m-0 flex items-center gap-2 font-bold">
                <MessageCircle size={18} aria-hidden="true" />
                مشکلی داری؟ به پشتیبانی پیام بده.
            </p>
            {support !== null ? (
                <p className="m-0 text-muted">
                    <a
                        href={support.phone_href ?? '/support'}
                        dir="ltr"
                        className="inline-flex min-h-11 items-center font-bold text-primary"
                    >
                        {support.phone}
                    </a>
                    {support.messenger !== '' && (
                        <>
                            <span aria-hidden="true" className="px-1.5 text-field">
                                ·
                            </span>
                            {support.messenger} با همین شماره
                        </>
                    )}
                </p>
            ) : (
                <p className="m-0 text-muted">
                    <Link href="/support" className="inline-flex min-h-11 items-center text-primary">
                        صفحهٔ پشتیبانی
                    </Link>
                </p>
            )}
        </aside>
    );
}
