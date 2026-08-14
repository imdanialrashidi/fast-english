import { AppCta } from '../components/AppCta';
import { SITE_NAME } from '../content/siteContent';

const PRODUCT_LINKS = [
  { href: '/', label: 'خانه' },
  { href: '/how-it-works', label: 'چگونه کار می‌کند' },
  { href: '/install', label: 'نصب' },
  { href: '/sample', label: 'نمونه درس' },
];

const COMPANY_LINKS = [
  { href: '/about', label: 'درباره' },
  { href: '/collaboration', label: 'همکاری' },
  { href: '/contact', label: 'تماس' },
];

const LEGAL_LINKS = [
  { href: '/privacy', label: 'حریم خصوصی' },
  { href: '/terms', label: 'شرایط استفاده' },
];

export function Footer() {
  return (
    <footer className="border-t border-brand-divider bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="grid sm:grid-cols-4 gap-6 text-sm">
          <div>
            <p className="font-bold text-brand-text">{SITE_NAME}</p>
            <p className="mt-1 text-brand-muted leading-relaxed">
              یادگیری انگلیسی برای فارسی‌زبانان، در شش سطح CEFR.
            </p>
          </div>
          <nav aria-label="پیوندهای محصول" className="space-y-2">
            {PRODUCT_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="block text-brand-muted hover:text-brand-text"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <nav aria-label="پیوندهای مجموعه" className="space-y-2">
            {COMPANY_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="block text-brand-muted hover:text-brand-text"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <nav aria-label="پیوندهای حقوقی" className="space-y-2">
            {LEGAL_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="block text-brand-muted hover:text-brand-text"
              >
                {l.label}
              </a>
            ))}
            <AppCta place="footer" className="block text-brand-muted hover:text-brand-text">
              وب‌اپ
            </AppCta>
          </nav>
        </div>
        <p className="mt-8 text-xs text-brand-muted">
          این صفحه صرفاً معرفی محصول است. ثبت‌نام، پرداخت و دسترسی به درس‌ها در داخل اپلیکیشن انجام
          می‌شود.
        </p>
      </div>
    </footer>
  );
}
