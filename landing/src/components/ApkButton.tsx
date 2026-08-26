// landing/src/components/ApkButton.tsx
// Runtime-validated Android download action.
//
// Primary source of truth is the validated release metadata fetched from
// `/releases/release-metadata.json` (same-origin, validated via
// `validateReleaseMetadata`). The build-time `VITE_ANDROID_APK_URL`
// (siteConfig) is kept only as a local-dev / legacy fallback so a missing
// metadata file in a fresh checkout does not render a broken page. When
// validated metadata is available it ALWAYS outranks the build-time value
// so a new APK+metadata publish updates the download without a Landing
// rebuild.
//
// Never fabricates a download link: without a validated release it renders
// an honest "coming soon" state instead of a dead or unsafe link.

import { formatReleaseSize } from '../lib/releaseMetadata';
import { apkAvailable, apkState } from '../lib/siteConfig';
import { trackDownloadIntent } from '../lib/telemetry';
import { useReleaseMetadata } from '../lib/useReleaseMetadata';

function Unavailable({ dark, className }: { dark: boolean; className: string }) {
  return (
    <span
      data-testid="apk-unavailable"
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

function FallbackLink({ dark, className }: { dark: boolean; className: string }) {
  return (
    <a
      href={apkState.url ?? undefined}
      download
      rel="noopener noreferrer"
      target="_blank"
      data-testid="apk-download"
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

function LiveApkButton({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const release = useReleaseMetadata();
  const fallbackAvailable = apkAvailable(apkState);

  if (release.status === 'ready') {
    const { metadata } = release;
    const sizeLabel = formatReleaseSize(metadata.sizeBytes);
    return (
      <a
        href={metadata.downloadPath}
        download={metadata.fileName}
        rel="noopener noreferrer"
        data-testid="apk-download"
        data-apk-version={metadata.versionName}
        data-apk-sha256={metadata.sha256}
        className={`inline-flex items-center justify-center gap-2 rounded-[10px] px-5 py-3 text-sm font-semibold min-h-12 border ${className} ${
          dark
            ? 'border-ice-soft bg-ice text-midnight hover:bg-ice-hover border-transparent'
            : 'bg-primary text-on-primary hover:bg-primary-hover border-transparent shadow-interactive'
        }`}
        onClick={() => trackDownloadIntent()}
        aria-label={`دانلود نسخهٔ اندروید ${metadata.versionName}${sizeLabel ? `، ${sizeLabel}` : ''}`}
      >
        <span>دانلود نسخهٔ اندروید</span>
        <span
          className={`text-xs font-medium ${dark ? 'text-midnight/70' : 'text-on-primary/80'}`}
          dir="ltr"
        >
          v{metadata.versionName}
          {sizeLabel ? ` · ${sizeLabel}` : ''}
        </span>
      </a>
    );
  }

  if (fallbackAvailable) {
    return <FallbackLink dark={dark} className={className} />;
  }

  return <Unavailable dark={dark} className={className} />;
}

export function ApkButton({
  className = '',
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  // SSR / prerender: static honest fallback without hooks (matches the
  // initial client render before the runtime fetch resolves so hydration
  // does not mismatch). The client Live component then swaps in the
  // validated release when the fetch answers.
  if (typeof window === 'undefined') {
    if (apkAvailable(apkState)) {
      return <FallbackLink dark={dark} className={className} />;
    }
    return <Unavailable dark={dark} className={className} />;
  }
  return <LiveApkButton className={className} dark={dark} />;
}
