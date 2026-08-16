// landing/src/lib/usePublicSettings.ts
// React hook over the public settings fetch (client-side only).
//
// SSR/prerender note: the Landing is pre-rendered with renderToString and
// Vite's SSR loader, which loads a separate React instance from the one
// react-dom/server drives — calling ANY hook during SSR throws. Components
// therefore gate on `typeof window` and render static honest fallbacks
// without hooks (see SupportContact/PlanPricing), then hydrate this hook
// on the client. The initial state mirrors the static fallback so
// hydration does not mismatch.

import { useEffect, useState } from 'react';
import { fetchPublicSettings, type PublicSettings } from './publicSettings';

export type PublicSettingsState =
  | { status: 'loading' }
  | { status: 'ready'; settings: PublicSettings }
  | { status: 'unavailable' };

export function usePublicSettings(): PublicSettingsState {
  // Honest neutral default (matches the SSR fallback copy); the fetch
  // swaps in real values as soon as the endpoint answers.
  const [state, setState] = useState<PublicSettingsState>({ status: 'unavailable' });

  useEffect(() => {
    let cancelled = false;
    fetchPublicSettings()
      .then((settings) => {
        if (cancelled) return;
        setState(settings ? { status: 'ready', settings } : { status: 'unavailable' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
