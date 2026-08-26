// landing/src/lib/useReleaseMetadata.ts
// React hook over the runtime release metadata fetch (client-side only).
//
// Mirrors usePublicSettings: SSR/prerender renders the honest unavailable
// state without hooks; the client hydrates this hook and swaps in real
// validated values when /releases/release-metadata.json answers.

import { useEffect, useState } from 'react';
import { fetchReleaseMetadata, type ReleaseMetadata } from './releaseMetadata';

export type ReleaseMetadataState =
  | { status: 'loading' }
  | { status: 'ready'; metadata: ReleaseMetadata }
  | { status: 'unavailable' };

export function useReleaseMetadata(): ReleaseMetadataState {
  // Honest neutral default matching the SSR fallback (no hooks during
  // prerender). The fetch swaps in real validated values; this avoids a
  // hydration mismatch where SSR shows "unavailable" but the first
  // client render shows "loading".
  const [state, setState] = useState<ReleaseMetadataState>({ status: 'unavailable' });

  useEffect(() => {
    let cancelled = false;
    fetchReleaseMetadata()
      .then((metadata) => {
        if (cancelled) return;
        setState(metadata ? { status: 'ready', metadata } : { status: 'unavailable' });
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
