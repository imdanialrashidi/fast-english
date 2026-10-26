import type { ReactNode } from 'react';
import { BookOpen, Headphones, Languages } from 'lucide-react';
import { Link } from '@inertiajs/react';
import PublicLayout, { publicLayout } from '@/layouts/PublicLayout';

/**
 * Shared auth frame: brand promise on one side, the form card on the
 * other. Single-column on mobile, two columns on desktop. Same Persian
 * copy and labels as the Blade auth views so the auth browser contracts
 * (labels, buttons, landing after signup) keep holding.
 */

const POINTS = [
    { icon: <BookOpen size={20} aria-hidden="true" />, text: 'متن کوتاه در سطح خودت، با صوت همان نسخه' },
    { icon: <Headphones size={20} aria-hidden="true" />, text: 'پخش‌کننده ساده با سرعت قابل تنظیم' },
    { icon: <Languages size={20} aria-hidden="true" />, text: 'دفترچه واژه با مرور سر موعد' },
];

export function AuthFrame({
    title,
    heading,
    lede,
    errors,
    status,
    children,
}: {
    title: string;
    heading: string;
    lede: string;
    errors: Record<string, string>;
    status?: string | null;
    children: ReactNode;
}): React.JSX.Element {
    const firstError = Object.values(errors)[0] ?? null;
    return (
        <div className="mx-auto grid max-w-[1024px] gap-8 px-4 py-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <section aria-label="درباره Fast English" className="order-2 grid content-start gap-4 pt-2 lg:order-1">
                <Link
                    href="/"
                    dir="ltr"
                    aria-label="Fast English"
                    className="hidden min-h-11 items-center no-underline lg:inline-flex"
                >
                    <img
                        src="/images/brand/fastenglish-header-logo.png"
                        alt=""
                        width={120}
                        height={34}
                        className="h-[34px] w-auto"
                    />
                </Link>
                <h1 className="m-0 text-2xl leading-[1.7] font-extrabold tracking-tight sm:text-3xl">{title}</h1>
                <ul className="m-0 grid gap-2.5 p-0">
                    {POINTS.map((point) => (
                        <li key={point.text} className="flex list-none items-center gap-2.5 leading-8 text-muted">
                            <span aria-hidden="true" className="inline-flex text-ink">
                                {point.icon}
                            </span>
                            {point.text}
                        </li>
                    ))}
                </ul>
            </section>

            <section aria-label={heading} className="order-1 grid gap-4 rounded-3xl border border-line bg-surface p-6 lg:order-2">
                <div>
                    <h2 className="m-0 text-xl leading-8 font-extrabold">{heading}</h2>
                    <p className="m-0 mt-1 leading-8 text-muted">{lede}</p>
                </div>
                {status !== null && status !== undefined && status !== '' && (
                    <p role="status" className="m-0 rounded-2xl border border-line bg-canvas px-4 py-3 text-success">
                        {status}
                    </p>
                )}
                {firstError !== null && (
                    <p role="alert" className="m-0 rounded-2xl border border-line bg-canvas px-4 py-3 text-danger">
                        {firstError}
                    </p>
                )}
                {children}
            </section>
        </div>
    );
}

// Arrow (not `function`): the Inertia adapter only treats prototype-less
// functions as render-functions. A `function` declaration would be
// mounted as a component receiving the whole props object as its child.
export const authLayout = (page: ReactNode): ReactNode => <PublicLayout>{page}</PublicLayout>;
