// landing/src/components/AppCta.tsx
// Centralized primary CTA into the Student web app:
//   - routes to the real app entry (`webAppUrl`);
//   - preserves allowlisted campaign/referral parameters from the
//     current landing URL (see lib/campaign.ts) — applied after mount
//     so the prerendered HTML and the first client render stay in sync;
//   - emits the `signup_intent` acquisition telemetry event (no PII);
//   - always carries safe `target="_blank"` + `rel` attributes.
import { type ReactNode, useEffect, useState } from 'react';
import { appUrlWithCurrentCampaign } from '../lib/campaign';
import { webAppUrl } from '../lib/siteConfig';
import { type CtaPlace, trackSignupIntent } from '../lib/telemetry';

export function AppCta({
  place,
  className = '',
  children,
}: {
  /** Fixed site identifier for telemetry; never free text. */
  place: CtaPlace;
  className?: string;
  children: ReactNode;
}) {
  const [href, setHref] = useState(webAppUrl);
  useEffect(() => {
    setHref(appUrlWithCurrentCampaign(webAppUrl));
  }, []);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => trackSignupIntent(place)}
    >
      {children}
    </a>
  );
}
