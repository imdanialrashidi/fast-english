// Shared static page layout for every landing route: skip link, header,
// main landmark, and footer. Rendered identically at build time (SSR)
// and in the browser, so the built HTML is complete without JavaScript.
import type { ReactNode } from 'react';
import { Footer } from '../sections/Footer';
import { Header } from '../sections/Header';

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-brand-surface text-brand-text">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-50 focus:rounded-xl focus:bg-brand-midnight focus:px-4 focus:py-2 focus:text-white"
      >
        پرش به محتوای اصلی
      </a>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
