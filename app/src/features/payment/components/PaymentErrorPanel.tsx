// app/src/features/payment/components/PaymentErrorPanel.tsx
// Safe error surface for the payment flow. Shows a Persian message
// mapped from the backend code — never raw server output.
//
// Future request tracing: when `requestId` is provided, it is
// displayed ONLY inside the error-details area, labeled as a support
// code and copyable. No backend request-id infrastructure exists
// yet; this surface is the UI preparation for the Monitoring slice.

import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import type { PaymentError } from '../types';
import { CopyValue } from './CopyValue';

interface Props {
  error: PaymentError;
  /** Optional support code (future request tracing). */
  requestId?: string | null;
  /** Retry action label + handler. Omit to hide the retry action. */
  retryLabel?: string;
  onRetry?: () => void;
  'data-testid'?: string;
}

export function PaymentErrorPanel({
  error,
  requestId,
  retryLabel,
  onRetry,
  'data-testid': testId,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Alert severity="error" role="alert" data-testid={testId ?? 'payment-error-panel'}>
      <Stack spacing={1} sx={{ width: '100%' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {error.message}
        </Typography>
        {requestId ? (
          <Box sx={{ width: '100%' }}>
            <Button
              size="small"
              variant="text"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
              sx={{ minHeight: 44, px: 0.5 }}
            >
              {showDetails ? 'پنهان کردن جزئیات خطا' : 'جزئیات خطا و کد پشتیبانی'}
            </Button>
            {showDetails ? (
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                data-testid="error-details-area"
              >
                <Typography variant="caption" color="text.secondary">
                  کد پشتیبانی:
                </Typography>
                <Typography
                  variant="caption"
                  dir="ltr"
                  lang="en"
                  sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                >
                  {requestId}
                </Typography>
                <CopyValue value={requestId} label="کپی کد پشتیبانی" />
              </Stack>
            ) : null}
          </Box>
        ) : null}
        {onRetry && retryLabel ? (
          <Box sx={{ pt: 0.5 }}>
            <Button variant="outlined" size="small" onClick={onRetry} sx={{ minHeight: 44 }}>
              {retryLabel}
            </Button>
          </Box>
        ) : null}
      </Stack>
    </Alert>
  );
}
