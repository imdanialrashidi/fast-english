import { Head, Link } from '@inertiajs/react';
import { Download as DownloadIcon, Play, Smartphone } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { publicLayout } from '@/layouts/PublicLayout';
import type { SharedProps } from '@/types';

/**
 * Download (MOB-02 presentation): the APK is «هنوز منتشر نشده» until a
 * real build fills the release metadata. Rows render only from
 * config/release.php values — never from invented ones — and partial
 * metadata keeps the unpublished state.
 */

interface DownloadProps extends SharedProps {
    release: {
        version_name: string | null;
        version_code: string | null;
        release_date: string | null;
        size_bytes: string | null;
        sha256: string | null;
        file_url: string | null;
    };
    published: boolean;
}

export const DownloadIndex: FunctionComponent<DownloadProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    release,
    published,
    has_public_sample,
}: DownloadProps): React.JSX.Element => {
    const sizeLabel =
        release.size_bytes !== null
            ? `${(Number(release.size_bytes) / (1024 * 1024)).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت`
            : null;

    return (
        <>
            <Head title="دانلود Fast English" />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <div className="grid gap-2">
                    <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">دانلود</h1>
                    <p className="m-0 leading-8 text-muted">
                        {published
                            ? 'نسخه اندروید Fast English از همین صفحه قابل دانلود است. مشخصات فایل و SHA-256 در ادامه آمده است.'
                            : 'نسخه اندروید Fast English پس از انتشار از همین صفحه در دسترس قرار می‌گیرد.'}
                    </p>
                </div>

                <div className="grid gap-3 rounded-3xl border border-line bg-surface p-5">
                    <p className="m-0 inline-flex items-center gap-2 text-sm font-bold text-primary">
                        <Smartphone size={18} aria-hidden="true" />
                        بدون فروشگاه برنامه
                    </p>
                    <p className="m-0 text-lg leading-8 font-bold">Fast English را روی گوشی نصب کنید</p>
                    <p className="m-0 text-sm leading-7 text-muted">
                        روی iPhone، iPad و اندروید می‌توانید سایت را به صفحهٔ اصلی اضافه کنید و مثل یک اپ باز کنید؛ بدون فایل نصب و بدون
                        تعویض حساب.
                    </p>
                    <p className="m-0">
                        <Link
                            href="/install"
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                        >
                            <Smartphone size={20} aria-hidden="true" />
                            راهنمای نصب روی گوشی
                        </Link>
                    </p>
                </div>

                {!published ? (
                    <div role="status" className="grid gap-3 rounded-3xl border border-line bg-surface p-6">
                        <p className="m-0 text-xl font-bold">فایل نصب هنوز منتشر نشده</p>
                        <p className="m-0 leading-8 text-muted">
                            نسخه اندروید هنوز آماده انتشار نیست. مشخصات نسخه (نسخه، کد نسخه، تاریخ، حجم و SHA-256) تنها پس از ساخت واقعی اعلام
                            می‌شود.
                        </p>
                        <p className="m-0">
                            {has_public_sample ? (
                                <Link
                                    href="/sample"
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    <Play size={20} aria-hidden="true" />
                                    شروع با نمونه رایگان
                                </Link>
                            ) : (
                                <Link
                                    href="/register"
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    ساخت حساب
                                </Link>
                            )}
                        </p>
                    </div>
                ) : (
                    <>
                        <table className="w-full overflow-hidden rounded-3xl border border-line bg-surface">
                            <caption className="p-4 text-right font-bold">مشخصات نسخه منتشرشده</caption>
                            <tbody>
                                <tr className="border-t border-line">
                                    <th scope="row" className="p-4 text-right font-bold">نسخه</th>
                                    <td className="p-4">{release.version_name}</td>
                                </tr>
                                <tr className="border-t border-line">
                                    <th scope="row" className="p-4 text-right font-bold">کد نسخه</th>
                                    <td className="p-4">{release.version_code}</td>
                                </tr>
                                <tr className="border-t border-line">
                                    <th scope="row" className="p-4 text-right font-bold">تاریخ انتشار</th>
                                    <td className="p-4">{release.release_date}</td>
                                </tr>
                                <tr className="border-t border-line">
                                    <th scope="row" className="p-4 text-right font-bold">حجم</th>
                                    <td className="p-4">{release.size_bytes} بایت</td>
                                </tr>
                                <tr className="border-t border-line">
                                    <th scope="row" className="p-4 text-right font-bold">SHA-256</th>
                                    <td lang="en" dir="ltr" className="p-4 text-left font-en text-sm break-all">
                                        {release.sha256}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        {release.file_url !== null && (
                            <p className="m-0">
                                <a
                                    href={release.file_url}
                                    download={`fast-english-${release.version_name ?? 'latest'}.apk`}
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    <DownloadIcon size={20} aria-hidden="true" />
                                    دانلود فایل نصب (APK)
                                </a>
                                {sizeLabel !== null && (
                                    <span className="mt-2 block text-xs text-muted">
                                        نسخه {release.version_name} • حجم {sizeLabel}
                                    </span>
                                )}
                            </p>
                        )}
                        <p className="m-0 text-sm leading-7 text-muted">
                            فایل نصب مستقیم از همین دامنه ارائه می‌شود. پس از دانلود، اگر اندروید اجازهٔ نصب از منبع ناشناس خواست، آن را
                            فقط برای همین فایل تأیید کنید. مشخصات بالا (SHA-256) برای بررسی سلامت فایل است.
                        </p>
                    </>
                )}
            </div>
        </>
    );
};

DownloadIndex.layout = publicLayout;

export default DownloadIndex;
