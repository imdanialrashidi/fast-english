// app/src/features/payment/useReceiptPreview.ts
// React hook that fetches the owner's protected receipt via the
// dedicated authenticated route and converts the binary response
// to a short-lived Blob URL.
//
// Security model:
//   - The route requires an authenticated `fep_users` session and
//     matches the caller's id against `payment_request.user`. It
//     serves ONLY the bytes for the request's `receipt_file`.
//   - The client never stores a file token in any persistent
//     storage. The only client-side artifact is a `blob:` URL that
//     is revoked on unmount, replacement, and retry.
//   - Errors are surfaced through the standard PaymentError model
//     so the UI can show a stable Persian message.

import { useEffect, useState } from 'react';
import { fetchReceiptBlob } from './api';
import { toPaymentError } from './errors';
import type { PaymentError } from './types';

export type ReceiptPreviewStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; url: string; revoke: () => void }
  | { kind: 'error'; error: PaymentError };

interface Args {
  /** PB record id of the owning payment_request. Required to start. */
  recordId: string | null;
  /**
   * Reserved for future API parity. The current secure route does
   * not require a stored filename; the server resolves the actual
   * on-disk path from the authenticated record. The argument is
   * kept so the call site does not have to change when the secure
   * route is the only surface in use.
   */
  fileName: string | null;
  /** Skip fetching entirely (e.g. tab not open). */
  enabled: boolean;
}

interface InternalState {
  objectUrl: string | null;
  status: ReceiptPreviewStatus;
}

/**
 * Authorize and render the owner's protected receipt. We never
 * accept an arbitrary recordId from raw UI input; the caller must
 * pass the sanitized id from the trusted current-request response.
 *
 * Lifecycle:
 *  - When enabled flips on with a valid recordId, request the
 *    bytes from the secure route and build a Blob URL.
 *  - The previous Blob URL is revoked on every transition so we
 *    never leak two URLs for the same record.
 *  - On unmount, the current URL is revoked.
 */
export function useReceiptPreview({
  recordId,
  fileName: _fileName,
  enabled,
}: Args): ReceiptPreviewStatus {
  const [state, setState] = useState<InternalState>({
    objectUrl: null,
    status: { kind: 'idle' },
  });

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !recordId) {
      return () => {
        cancelled = true;
      };
    }
    setState((s) => {
      revokeIfAny(s.objectUrl);
      return { objectUrl: null, status: { kind: 'loading' } };
    });
    (async () => {
      try {
        const { blob } = await fetchReceiptBlob(recordId);
        if (cancelled) {
          // The caller no longer wants this URL; we created one
          // synchronously below, so we must revoke it before
          // returning. Build the URL here just to revoke.
          // (createObjectURL must be called from a live
          // window context — it is — so this is safe.)
          const temp = URL.createObjectURL(blob);
          URL.revokeObjectURL(temp);
          return;
        }
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setState({
          objectUrl: url,
          status: {
            kind: 'ready',
            url,
            revoke: () => {
              URL.revokeObjectURL(url);
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
  }, [enabled, recordId]);

  return state.status;
}

function revokeIfAny(url: string | null) {
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore: revocation failures are not user-visible
    }
  }
}
