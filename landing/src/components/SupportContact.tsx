// landing/src/components/SupportContact.tsx
// Business Configuration slice — canonical support/collaboration contact.
//
// Both the support page (/contact) and the collaboration page
// (/collaboration) render the SAME configurable destination, served at
// runtime from `/api/fast-english/public/settings` (site_settings
// collection, edited in the Admin Business Settings surface). While it is
// unset the pages show the honest "not announced yet" state — no
// fabricated contact values, no per-page duplication.
//
// SSR note: during prerender (`typeof window === 'undefined'`) the static
// honest fallback renders WITHOUT hooks (the Vite SSR loader uses a
// separate React instance; see usePublicSettings.ts). The client hydrates
// the live component and swaps in real values when the endpoint answers.

import { isContactUrl } from '../lib/publicSettings';
import { usePublicSettings } from '../lib/usePublicSettings';

interface SupportContactProps {
  /** CTA label when the contact is a clickable URL. */
  label?: string;
  /** Optional acquisition-intent hook fired when the CTA is clicked. */
  onIntent?: () => void;
}

function StaticFallback() {
  return (
    <span data-testid="support-unavailable" className="inline-block text-sm text-muted">
      کانال پشتیبانی هنوز اعلام نشده است و به‌زودی در همین صفحه منتشر می‌شود.
    </span>
  );
}

function LiveSupportContact({ label, onIntent }: SupportContactProps) {
  const state = usePublicSettings();
  const contact = state.status === 'ready' ? state.settings.support.supportContact.trim() : '';

  if (!contact) {
    return <StaticFallback />;
  }

  if (isContactUrl(contact)) {
    return (
      <a
        href={contact}
        rel="noopener noreferrer"
        target="_blank"
        data-testid="support-link"
        onClick={onIntent}
        className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12"
      >
        {label}
      </a>
    );
  }

  return (
    <span
      data-testid="support-contact-text"
      className="mt-4 inline-flex items-center justify-center rounded-[10px] border border-outline-soft bg-surface px-5 py-3 text-sm font-semibold text-text min-h-12"
      dir="ltr"
      lang="en"
    >
      {contact}
    </span>
  );
}

export function SupportContact(props: SupportContactProps) {
  if (typeof window === 'undefined') {
    // Prerender: static honest state, no hooks.
    return <StaticFallback />;
  }
  return <LiveSupportContact {...props} />;
}
