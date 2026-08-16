import { BrandMark } from '../components/BrandMark';
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

// Footer links are full-height touch targets (>= 44px) — never
// cramped text rows (final-pass note from the P4-S1 review).
function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center min-h-11 rounded-lg px-1 text-sm text-muted hover:text-text hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {label}
    </a>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-outline-soft bg-surface">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
          <div>
            <BrandMark tone="compact" />
            <p className="mt-3 text-muted leading-relaxed max-w-xs">
              یادگیری انگلیسی برای فارسی‌زبانان، در شش سطح CEFR — از A1 تا C2.
            </p>
          </div>
          <nav aria-label="پیوندهای محصول" className="flex flex-col items-start">
            <h2 className="text-xs font-bold text-text mb-1">محصول</h2>
            {PRODUCT_LINKS.map((l) => (
              <FooterLink key={l.href} href={l.href} label={l.label} />
            ))}
          </nav>
          <nav aria-label="پیوندهای مجموعه" className="flex flex-col items-start">
            <h2 className="text-xs font-bold text-text mb-1">فست انگلیش</h2>
            {COMPANY_LINKS.map((l) => (
              <FooterLink key={l.href} href={l.href} label={l.label} />
            ))}
          </nav>
          <nav aria-label="پیوندهای حقوقی" className="flex flex-col items-start">
            <h2 className="text-xs font-bold text-text mb-1">حقوقی</h2>
            {LEGAL_LINKS.map((l) => (
              <FooterLink key={l.href} href={l.href} label={l.label} />
            ))}
            <span className="inline-flex items-center min-h-11 rounded-lg px-1 text-sm text-muted">
              {SITE_NAME}
            </span>
          </nav>
        </div>
        <p className="mt-10 pt-6 border-t border-outline-soft text-xs text-muted">
          این صفحه صرفاً معرفی محصول است. ثبت‌نام، پرداخت و دسترسی به درس‌ها در داخل اپلیکیشن انجام
          می‌شود.
        </p>
      </div>
    </footer>
  );
}
