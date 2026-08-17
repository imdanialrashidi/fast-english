// Shared static page layout for every landing route: skip link, header,
// main landmark, and footer. Rendered identically at build time (SSR)
// and in the browser, so the built HTML is complete without JavaScript.
import { type ReactNode, useEffect } from 'react';
import { PwaInstallProbe } from '../components/PwaInstallProbe';
import { ACQUISITION_EVENTS, setSurface, trackAcquisition } from '../lib/telemetry';
import { Footer } from '../sections/Footer';
import { Header } from '../sections/Header';

// One route surface per page load (multi-page static site). The flag is
// module-scoped so React StrictMode's dev double-invoke cannot record
// two `route_change` events for a single page view; a fresh page load
// re-executes the module and records exactly one.
let routeChangeTracked = false;

export function SiteLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (routeChangeTracked) return;
    routeChangeTracked = true;
    // Set the redacted surface first so the route event carries it. No PII.
    setSurface(window.location.pathname);
    trackAcquisition(ACQUISITION_EVENTS.routeChange, {});
  }, []);
  return (
    <div className="min-h-dvh bg-surface-muted text-text">
      <PwaInstallProbe />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-50 focus:rounded-[10px] focus:bg-midnight focus:px-4 focus:py-2 focus:text-ice"
      >
        پرش به محتوای اصلی
      </a>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
    </div>
  );
}
