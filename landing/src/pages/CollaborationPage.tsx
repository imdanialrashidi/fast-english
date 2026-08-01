import { PageIntro } from '../components/PageIntro';
import { SiteLayout } from '../layouts/SiteLayout';
import { supportUrl } from '../lib/siteConfig';

const categories = [
  {
    title: 'تولید محتوا',
    desc: 'نویسندگی و ویرایش درس‌های انگلیسی در سطوح A1 تا C2، با نگاه به نیاز فارسی‌زبانان.',
  },
  {
    title: 'تخصص آموزش زبان',
    desc: 'همکاری آموزشی برای طراحی درس، آزمون تعیین سطح و مسیر یادگیری در چارچوب CEFR.',
  },
  {
    title: 'تولید صوت',
    desc: 'گویندگی، ضبط و تدوین صوت درس‌ها با کیفیت حرفه‌ای برای پخش روی موبایل.',
  },
  {
    title: 'مشارکت‌های بازاریابی',
    desc: 'همکاری در معرفی محصول به مخاطبان فارسی‌زبان از طریق کانال‌ها و رسانه‌های مرتبط.',
  },
  {
    title: 'دسترسی سازمانی',
    desc: 'فراهم‌کردن دسترسی گروهی برای آموزشگاه‌ها، سازمان‌ها و تیم‌ها با هماهنگی مستقیم.',
  },
];

export function CollaborationPage() {
  const hasSupport = supportUrl !== null;
  return (
    <SiteLayout>
      <PageIntro
        title="همکاری با فست انگلیش پادکست"
        lead="اگر در یکی از حوزه‌های زیر فعالیت می‌کنید، خوشحال می‌شویم پیشنهادتان را بشنویم."
      />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-12 sm:pb-20 space-y-4">
        {categories.map((c) => (
          <section
            key={c.title}
            className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
          >
            <h2 className="text-lg font-extrabold">{c.title}</h2>
            <p className="mt-2 text-sm text-brand-muted leading-relaxed">{c.desc}</p>
          </section>
        ))}
        <section className="rounded-2xl bg-brand-midnight p-5 sm:p-6 text-white">
          <h2 className="text-lg font-extrabold">ارسال پیشنهاد همکاری</h2>
          {hasSupport ? (
            <p className="mt-2 text-sm text-white/75 leading-relaxed">
              پیشنهاد خود را از طریق کانال پشتیبانی ارسال کنید.
            </p>
          ) : (
            <p className="mt-2 text-sm text-white/75 leading-relaxed">
              کانال ارتباطی همکاری هنوز اعلام نشده است؛ به‌زودی در همین صفحه منتشر می‌شود.
            </p>
          )}
          {hasSupport ? (
            <a
              href={supportUrl ?? undefined}
              rel="noopener noreferrer"
              target="_blank"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark min-h-12"
            >
              تماس برای همکاری
            </a>
          ) : (
            <span className="mt-4 inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 min-h-12">
              کانال همکاری — به‌زودی
            </span>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}
