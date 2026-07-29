// app/src/features/payment/useReceiptPreview.ts
// React hook that fetches a short-lived authorized receipt URL for the
// currently-authenticated user. The token is request-scoped and is
// never stored outside React state or any persistent client storage.

import { useEffect, useState } from 'react';
import { getPocketBase } from '../../lib/pocketbase';
import { toPaymentError } from './errors';
import { PaymentError } from './types';

export type ReceiptPreviewStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; url: string; revoke: () => void }
  | { kind: 'error'; error: PaymentError };

interface Args {
  /** PB record id of the owning payment_request. Required to start. */
  recordId: string | null;
  /** Randomized storage filename returned by the backend. */
  fileName: string | null;
  /** Skip fetching entirely (e.g. tab not open). */
  enabled: boolean;
}

interface InternalState {
  objectUrl: string | null;
  status: ReceiptPreviewStatus;
}

/**
 * Authorize and render the owner's protected receipt. We never accept
 * an arbitrary recordId from raw UI input; the caller must pass the
 * sanitized id from the trusted current-request response.
 *
 * Lifecycle:
 *  - When enabled flips on with a valid recordId+fileName, request a
 *    fresh file token from PB and build a short-lived URL.
 *  - The token is held only in the React state and the URL string
 *    (revoked on unmount or replacement).
 *  - If the token returns 401/403 we surface a generic "access
 *    denied" Persian error and offer no retry shortcut that would
 *    loop on the same token.
 */
export function useReceiptPreview({ recordId, fileName, enabled }: Args): ReceiptPreviewStatus {
  const [state, setState] = useState<InternalState>({
    objectUrl: null,
    status: { kind: 'idle' },
  });

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !recordId || !fileName) {
      return () => {
        cancelled = true;
      };
    }
    setState((s) => {
      revokeIfAny(s.objectUrl);
      return { objectUrl: null, status: { kind: 'loading' } };
    });
    const pb = getPocketBase();
    (async () => {
      try {
        const token = await pb.files.getToken();
        if (cancelled) return;
        // Build the URL with the token as a query string. PB SDK
        // handles encoding.
        const url = pb.files.getURL(
          { collectionId: '', collectionName: 'payment_requests', id: recordId },
          fileName,
          { token, query: {} },
        );
        if (cancelled) {
          // We're not going to use the URL — no need to verify the
          // image, but the token was already issued. We do not need
          // to revoke it explicitly: PB tokens expire server-side.
          return;
        }
        // Probe the URL with a HEAD-style fetch (range 0-0) to make
        // sure the token is good. The native <img> element will
        // retry on its own; doing the probe here means a stale token
        // is detected before we hand the URL to the <img>.
        try {
          const probe = await fetch(url, { method: 'GET', credentials: 'same-origin' });
          if (cancelled) return;
          if (!probe.ok) {
            setState({
              objectUrl: null,
              status: {
                kind: 'error',
                error: new PaymentError(
                  'دسترسی به رسید امکان‌پذیر نیست. دوباره تلاش کنید.',
                  'unauthorized',
                  probe.status,
                ),
              },
            });
            return;
          }
        } catch {
          // Network blip — fall back to the URL anyway. The <img>
          // will render a broken-image icon if it can't be reached.
        }
        if (cancelled) return;
        setState({
          objectUrl: url,
          status: {
            kind: 'ready',
            url,
            revoke: () => {
              // PB URLs are server-driven; revoking a "blob:" URL is
              // not applicable. We expose a revoke so the component
              // can call it on unmount if it cached the URL.
            },
          },
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          objectUrl: null,
          status: { kind: 'error', error: toPaymentError(err) },
        });
      }
    })();
    return () => {
      cancelled = true;
      setState((s) => {
        revokeIfAny(s.objectUrl);
        return s;
      });
    };
  }, [enabled, recordId, fileName]);

  return state.status;
}

function revokeIfAny(_url: string | null) {
  // PB protected file URLs are not blob: URLs; they live on the
  // server and expire by token. Nothing to revoke on the client.
}
