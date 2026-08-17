import { useState } from 'react';
import { AppCta } from '../components/AppCta';
import { BrandMark } from '../components/BrandMark';

const NAV_LINKS = [
  { href: '/', label: 'خانه' },
  { href: '/how-it-works', label: 'چگونه کار می‌کند' },
  { href: '/install', label: 'نصب' },
  { href: '/sample', label: 'نمونه درس' },
  { href: '/about', label: 'درباره' },
  { href: '/collaboration', label: 'همکاری' },
  { href: '/contact', label: 'تماس' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-outline-soft bg-canvas/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <BrandMark />
        <nav aria-label="ناوبری اصلی" className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-text hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus min-h-11 inline-flex items-center"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <AppCta
            place="header"
            className="hidden sm:inline-flex items-center justify-center rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus min-h-11"
          >
            ورود به وب‌اپ
          </AppCta>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden inline-flex items-center justify-center rounded-lg p-2 text-text hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus min-h-11 min-w-11"
            aria-label="باز/بستن منو"
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            <svg
              aria-hidden
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              role="img"
            >
              <title>{open ? 'بستن منو' : 'باز کردن منو'}</title>
              {open ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>
      {open ? (
        <nav
          id="mobile-nav"
          aria-label="ناوبری موبایل"
          className="lg:hidden border-t border-outline-soft bg-canvas"
        >
          <div className="mx-auto max-w-6xl px-4 py-2 flex flex-col">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus min-h-11 inline-flex items-center"
              >
                {link.label}
              </a>
            ))}
            <AppCta
              place="header"
              className="mt-1 mb-2 inline-flex items-center justify-center rounded-[10px] bg-primary px-4 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12"
            >
              ورود به وب‌اپ
            </AppCta>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
