// landing/src/components/ApkButton.tsx
// Configuration-driven Android download action. Never fabricates a
// download link: without a configured official release URL it renders
// an honest "coming soon" state instead of a dead or unsafe link.
import { apkAvailable, apkState } from '../lib/siteConfig';
import { trackDownloadIntent } from '../lib/telemetry';

export function ApkButton({
  className = '',
  dark = false,
}: {
  className?: string;
  /** Render the midnight-panel variant (ice text on translucent surface). */
  dark?: boolean;
}) {
  if (!apkAvailable(apkState)) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[10px] border px-5 py-3 text-sm font-semibold min-h-12 ${className} ${
          dark
            ? 'border-ice-soft bg-transparent text-ice-muted'
            : 'border-outline-soft bg-surface text-muted'
        }`}
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
      className={`inline-flex items-center justify-center rounded-[10px] border px-5 py-3 text-sm font-semibold min-h-12 ${className} ${
        dark
          ? 'border-ice-soft bg-transparent text-ice hover:bg-ice-soft'
          : 'border-outline-soft bg-surface text-text hover:bg-surface-strong'
      }`}
      onClick={() => trackDownloadIntent()}
    >
      دانلود نسخهٔ اندروید
      {apkState.version ? ` — نسخهٔ ${apkState.version}` : ''}
    </a>
  );
}
