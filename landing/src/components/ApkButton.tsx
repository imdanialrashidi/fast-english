// landing/src/components/ApkButton.tsx
// Configuration-driven Android download action. Never fabricates a
// download link: without a configured official release URL it renders
// an honest "coming soon" state instead of a dead or unsafe link.
import { apkAvailable, apkState } from '../lib/siteConfig';

export function ApkButton({ className = '' }: { className?: string }) {
  if (!apkAvailable(apkState)) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xl border border-brand-divider bg-white px-5 py-3 text-sm font-semibold text-brand-muted min-h-12 ${className}`}
      >
        نسخهٔ اندروید به‌زودی منتشر می‌شود
      </span>
    );
  }
  return (
    <a
      href={apkState.url ?? undefined}
      download
      rel="noopener noreferrer"
      target="_blank"
      className={`inline-flex items-center justify-center rounded-xl border border-brand-divider bg-white px-5 py-3 text-sm font-semibold text-brand-text hover:bg-brand-surface min-h-12 ${className}`}
    >
      دانلود نسخهٔ اندروید
      {apkState.version ? ` — نسخهٔ ${apkState.version}` : ''}
    </a>
  );
}
