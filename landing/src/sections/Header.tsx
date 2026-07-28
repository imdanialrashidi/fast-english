import { useState } from 'react';
import { BrandMark } from '../components/BrandMark';

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-brand-divider">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <BrandMark />
        <nav aria-label="ناوبری اصلی" className="hidden md:flex items-center gap-1">
          <a
            href="#levels"
            className="px-3 py-2 rounded-lg text-sm font-medium text-brand-text hover:bg-brand-surface"
          >
            سطوح
          </a>
          <a
            href="#sample"
            className="px-3 py-2 rounded-lg text-sm font-medium text-brand-text hover:bg-brand-surface"
          >
            نمونه درس
          </a>
          <a
            href="#how"
            className="px-3 py-2 rounded-lg text-sm font-medium text-brand-text hover:bg-brand-surface"
          >
            چگونه کار می‌کند
          </a>
          <a
            href="#install"
            className="px-3 py-2 rounded-lg text-sm font-medium text-brand-text hover:bg-brand-surface"
          >
            نصب
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="#install"
            className="hidden sm:inline-flex items-center justify-center rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-dark"
          >
            ورود به وب‌اپ
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-brand-text hover:bg-brand-surface"
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
          className="md:hidden border-t border-brand-divider bg-white"
        >
          <div className="mx-auto max-w-6xl px-4 py-2 flex flex-col">
            <a
              href="#levels"
              className="px-3 py-3 rounded-lg text-sm font-medium hover:bg-brand-surface"
            >
              سطوح
            </a>
            <a
              href="#sample"
              className="px-3 py-3 rounded-lg text-sm font-medium hover:bg-brand-surface"
            >
              نمونه درس
            </a>
            <a
              href="#how"
              className="px-3 py-3 rounded-lg text-sm font-medium hover:bg-brand-surface"
            >
              چگونه کار می‌کند
            </a>
            <a
              href="#install"
              className="px-3 py-3 rounded-lg text-sm font-medium hover:bg-brand-surface"
            >
              نصب
            </a>
            <a
              href="#install"
              className="mt-1 mb-2 inline-flex items-center justify-center rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark"
            >
              ورود به وب‌اپ
            </a>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
