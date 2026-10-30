import { Head, Link, usePage } from '@inertiajs/react';
import { CircleCheck, Info, MonitorDown, MoreVertical, Share } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { publicLayout } from '@/layouts/PublicLayout';
import type { SharedProps } from '@/types';

/**
 * Install guide (owner 2026-10-26): one public page for adding Fast
 * English to the home screen.
 *
 * iOS Safari never fires `beforeinstallprompt`, so the Account install card
 * cannot appear there; this page is the iPhone path. Android and desktop
 * get the same numbered walkthrough so nobody has to guess. Persian chrome,
 * English only for the browser labels the user actually sees.
 */

interface InstallIndexProps extends SharedProps {}
function En({ children }: { children: React.ReactNode }): React.JSX.Element {
    return (
        <span lang="en" dir="ltr" className="font-en">
            {children}
        </span>
    );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }): React.JSX.Element {
    return (
        <li className="grid grid-cols-[2.25rem_1fr] items-start gap-3">
            <span
                aria-hidden="true"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-canvas font-bold text-primary"
            >
                {n}
            </span>
            <div className="grid gap-1">
                <p className="m-0 font-bold leading-7">{title}</p>
                <p className="m-0 text-sm leading-7 text-muted">{children}</p>
            </div>
        </li>
    );
}

export const InstallIndex: FunctionComponent<InstallIndexProps> & { layout?: (page: ReactNode) => ReactNode } = (): React.JSX.Element => {
    const { auth, has_public_sample: hasPublicSample } = usePage<SharedProps>().props;
    const signedIn = auth.user !== null;

    return (
        <>
            <Head title="نصب روی گوشی" />
            <div className="mx-auto grid max-w-[760px] gap-5 px-4 py-6">
                <div className="grid gap-2">
                    <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">نصب روی گوشی</h1>
                    <p className="m-0 leading-8 text-muted">
                        Fast English یک اپلیکیشن وب نصب‌شدنی است؛ بدون فروشگاه برنامه. با چند لمس به صفحهٔ اصلی اضافه می‌شود و مثل یک اپ
                        جداگانه باز می‌شود.
                    </p>
                </div>

                <div role="note" className="grid gap-2 rounded-3xl border border-line bg-surface p-5">
                    <p className="m-0 flex items-start gap-2 leading-8">
                        <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
                        <span>
                            اگر لینک را از تلگرام یا اینستاگرام باز کرده‌اید، اول از منوی همان برنامه «
                            <En>Open in browser</En>» را بزنید و صفحه را در Safari (آیفون) یا Chrome (اندروید) باز کنید.
                        </span>
                    </p>
                </div>

                <section aria-labelledby="install-ios" className="grid gap-3 rounded-3xl border border-line bg-surface p-5 sm:p-6">
                    <h2 id="install-ios" className="m-0 flex items-center gap-2 text-xl leading-8">
                        <Share size={20} aria-hidden="true" />
                        iPhone و iPad
                    </h2>
                    <p className="m-0 leading-8 text-muted">
                        در iPhone و iPad فقط Safari گزینهٔ «افزودن به صفحهٔ اصلی» را دارد.
                    </p>
                    <ol className="m-0 grid list-none gap-4 p-0">
                        <Step n="۱" title="سایت را در Safari باز کنید">
                            آیکن آبی <En>Safari</En> را از صفحهٔ اصلی گوشی باز کنید و نشانی سایت را در نوار آدرس وارد کنید.
                        </Step>
                        <Step n="۲" title="دکمهٔ اشتراک‌گذاری را بزنید">
                            مربعِ با فلشِ رو به بالا، معمولاً در نوار پایین صفحه. اگر نوار را نمی‌بینید، کمی به پایین بکشید.
                        </Step>
                        <Step n="۳" title="«افزودن به صفحهٔ اصلی» را انتخاب کنید">
                            در صفحهٔ اشتراک‌گذاری کمی به پایین بروید و <En>Add to Home Screen</En> را بزنید.
                        </Step>
                        <Step n="۴" title="«افزودن» را تأیید کنید">
                            <En>Add</En> را بزنید. آیکن Fast English روی صفحهٔ اصلی ساخته می‌شود.
                        </Step>
                    </ol>
                    <p className="m-0 text-sm leading-7 text-muted">
                        اگر گزینهٔ «افزودن به صفحهٔ اصلی» را پیدا نکردید، مطمئن شوید صفحه در Safari باز است؛ Chrome و Firefox در iOS این
                        گزینه را ندارند.
                    </p>
                </section>

                <section aria-labelledby="install-android" className="grid gap-3 rounded-3xl border border-line bg-surface p-5 sm:p-6">
                    <h2 id="install-android" className="m-0 flex items-center gap-2 text-xl leading-8">
                        <MoreVertical size={20} aria-hidden="true" />
                        اندروید
                    </h2>
                    <p className="m-0 leading-8 text-muted">در بیشتر گوشی‌های اندروید، Chrome خودش پیشنهاد نصب را نشان می‌دهد.</p>
                    <ol className="m-0 grid list-none gap-4 p-0">
                        <Step n="۱" title="سایت را در Chrome باز کنید">
                            اگر لینک را از برنامهٔ دیگری باز کرده‌اید، ابتدا آن را در Chrome باز کنید.
                        </Step>
                        <Step n="۲" title="منوی سه‌نقطه را بزنید">
                            منوی بالای صفحه (یا پایین، بسته به نسخهٔ Chrome) را باز کنید.
                        </Step>
                        <Step n="۳" title="«نصب برنامه» یا «افزودن به صفحهٔ اصلی» را بزنید">
                            نام گزینه بسته به نسخهٔ Chrome متفاوت است: <En>Install app</En> یا <En>Add to Home screen</En>.
                        </Step>
                        <Step n="۴" title="تأیید کنید">
                            در پنجرهٔ تأیید، <En>Install</En> یا <En>Add</En> را بزنید.
                        </Step>
                    </ol>
                    <p className="m-0 text-sm leading-7 text-muted">
                        اگر گزینه را ندیدید، صفحه را یک‌بار دوباره بارگذاری کنید و چند ثانیه صبر کنید؛ Chrome بعد از بازدید کامل، امکان نصب
                        را فعال می‌کند.
                    </p>
                </section>

                <section aria-labelledby="install-desktop" className="grid gap-3 rounded-3xl border border-line bg-surface p-5 sm:p-6">
                    <h2 id="install-desktop" className="m-0 flex items-center gap-2 text-xl leading-8">
                        <MonitorDown size={20} aria-hidden="true" />
                        کامپیوتر
                    </h2>
                    <p className="m-0 leading-8 text-muted">در Chrome یا Edge روی ویندوز، مک و لینوکس هم می‌توانید Fast English را نصب کنید.</p>
                    <ol className="m-0 grid list-none gap-4 p-0">
                        <Step n="۱" title="آیکن نصب را در نوار آدرس ببینید">
                            آیکن کوچک نصب (مانیتور با فلش) سمت راست نوار آدرس ظاهر می‌شود؛ روی آن بزنید.
                        </Step>
                        <Step n="۲" title="یا از منوی مرورگر نصب کنید">
                            منوی سه‌نقطه ← <En>Cast, save, and share</En> ← <En>Install page as app</En>.
                        </Step>
                        <Step n="۳" title="تأیید کنید">
                            <En>Install</En> را بزنید تا پنجرهٔ مستقل Fast English باز شود.
                        </Step>
                    </ol>
                </section>

                <section aria-labelledby="install-after" className="grid gap-3 rounded-3xl border border-line bg-surface p-5 sm:p-6">
                    <h2 id="install-after" className="m-0 flex items-center gap-2 text-xl leading-8">
                        <CircleCheck size={20} aria-hidden="true" />
                        بعد از نصب
                    </h2>
                    <ul className="m-0 grid list-none gap-2 p-0">
                        <li className="flex items-start gap-2 leading-8">
                            <CircleCheck size={18} aria-hidden="true" className="mt-1.5 shrink-0 text-success" />
                            <span>اپ بدون نوار آدرس و از آیکن صفحهٔ اصلی باز می‌شود.</span>
                        </li>
                        <li className="flex items-start gap-2 leading-8">
                            <CircleCheck size={18} aria-hidden="true" className="mt-1.5 shrink-0 text-success" />
                            <span>حساب، پیشرفت و پخش صوت همان است؛ چیزی از نو ساخته نمی‌شود.</span>
                        </li>
                        <li className="flex items-start gap-2 leading-8">
                            <CircleCheck size={18} aria-hidden="true" className="mt-1.5 shrink-0 text-success" />
                            <span>نسخهٔ اپ با باز شدن از وب به‌روز می‌شود؛ نیازی به دانلود دوباره نیست.</span>
                        </li>
                        <li className="flex items-start gap-2 leading-8">
                            <CircleCheck size={18} aria-hidden="true" className="mt-1.5 shrink-0 text-success" />
                            <span>پوستهٔ عمومی و صفحهٔ آفلاین ذخیره می‌شود؛ درس‌های اشتراکی فقط با دسترسی فعال پخش می‌شوند.</span>
                        </li>
                    </ul>
                </section>

                <div className="grid justify-items-center gap-3 rounded-3xl border border-line bg-surface px-6 py-8 text-center">
                    <p className="m-0 text-lg font-bold">آماده‌اید شروع کنید؟</p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {signedIn ? (
                            <Link
                                href="/app/today"
                                className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                باز کردن Fast English
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href="/register"
                                    className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    ساخت حساب
                                </Link>
                                {hasPublicSample ? (
                                    <Link
                                        href="/sample"
                                        className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-canvas px-5 py-2 text-ink no-underline hover:bg-surface"
                                    >
                                        نمونهٔ رایگان
                                    </Link>
                                ) : (
                                    <Link
                                        href="/plans"
                                        className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-canvas px-5 py-2 text-ink no-underline hover:bg-surface"
                                    >
                                        پلن‌ها و قیمت
                                    </Link>
                                )}
                            </>
                        )}
                        <Link
                            href="/download"
                            className="inline-flex min-h-11 min-w-11 items-center rounded-full px-4 py-2 text-sm text-muted no-underline hover:bg-canvas hover:text-ink"
                        >
                            صفحهٔ دانلود
                        </Link>
                    </div>
                    <p className="m-0 text-sm leading-7 text-muted">
                        نصب اختیاری است؛ Fast English در مرورگر هم کامل کار می‌کند. پرسشی دارید؟ از صفحهٔ{' '}
                        <Link href="/support" className="font-bold text-primary">
                            پشتیبانی
                        </Link>{' '}
                        بپرسید.
                    </p>
                </div>
            </div>
        </>
    );
};

InstallIndex.layout = publicLayout;

export default InstallIndex;
