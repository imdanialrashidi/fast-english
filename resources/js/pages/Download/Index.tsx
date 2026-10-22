import { Head, Link } from '@inertiajs/react';
import { Download as DownloadIcon, Play } from 'lucide-react';
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
}: DownloadProps): React.JSX.Element => {
    return (
        <>
            <Head title="دانلود Fast English" />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <div className="grid gap-2">
                    <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">دانلود</h1>
                    <p className="m-0 leading-8 text-muted">
                        نسخه اندروید Fast English از همین صفحه منتشر می‌شود. تا آماده‌شدن فایل نصب، نمونه واقعی بدون حساب در دسترس است.
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
                            <Link
                                href="/sample"
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                <Play size={20} aria-hidden="true" />
                                شروع با نمونه رایگان
                            </Link>
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
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    <DownloadIcon size={20} aria-hidden="true" />
                                    دانلود فایل نصب
                                </a>
                            </p>
                        )}
                    </>
                )}
            </div>
        </>
    );
};

DownloadIndex.layout = publicLayout;

export default DownloadIndex;
