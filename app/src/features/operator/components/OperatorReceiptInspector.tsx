// app/src/features/operator/components/OperatorReceiptInspector.tsx
// Protected receipt inspection for the operator: fetches the bytes via the
// operator-only route, renders a bounded preview (aspect preserved, never
// a compressed thumbnail) and opens an accessible zoom Dialog. The image
// source is a local blob: URL, revoked on retry, replacement and unmount;
// no token, storage path or protected URL is ever rendered.
//
// States: loading / ready / missing (404 — no readable receipt) / error
// (safe Persian message + retry). The zoom dialog is shared with the
// Student payment journey (full-screen below sm, bounded dialog above).

import ImageNotSupportedRoundedIcon from '@mui/icons-material/ImageNotSupportedRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import { Box, Button, ButtonBase, CircularProgress, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ReceiptZoomDialog } from '../../payment/components/ReceiptZoomDialog';
import { fetchReceiptBlob } from '../api';
import { isMissingReceipt, type OperatorError, toOperatorError } from '../errors';

type ReceiptStatus = 'loading' | 'ready' | 'missing' | 'error';

export function OperatorReceiptInspector({
  requestId,
  token,
}: {
  requestId: string;
  token: string;
}) {
  const [status, setStatus] = useState<ReceiptStatus>('loading');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<OperatorError | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!requestId || !token) return;
    let cancelled = false;
    const ctrl = new AbortController();
    // The previous blob URL must never outlive the request it belongs to.
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setUrl(null);
    setError(null);
    setStatus('loading');
    (async () => {
      try {
        const blob = await fetchReceiptBlob(token, requestId, ctrl.signal);
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        urlRef.current = objectUrl;
        setUrl(objectUrl);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        // 404 from the protected route = the request has no readable
        // receipt: a normal state, not an error.
        if (isMissingReceipt(err)) {
          setStatus('missing');
          return;
        }
        setError(toOperatorError(err, requestId));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [requestId, token, retryKey]);

  const handleRetry = useCallback(() => setRetryKey((k) => k + 1), []);

  if (status === 'loading') {
    return (
      <Stack
        spacing={1.5}
        role="status"
        aria-live="polite"
        data-testid="operator-receipt-loading"
        sx={{
          p: 3,
          minHeight: 180,
          alignItems: 'center',
          justifyContent: 'center',
          border: 1,
          borderColor: 'divider',
          borderRadius: '16px',
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
        }}
      >
        <CircularProgress size={28} aria-label="در حال بارگذاری رسید" />
        <Typography variant="body2" color="text.secondary">
          در حال بارگذاری رسید…
        </Typography>
      </Stack>
    );
  }

  if (status === 'missing') {
    return (
      <Stack
        spacing={1}
        data-testid="operator-receipt-missing"
        sx={{
          p: 3,
          alignItems: 'center',
          justifyContent: 'center',
          border: 1,
          borderColor: 'divider',
          borderRadius: '16px',
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
          color: 'var(--mui-palette-onSurfaceVariant)',
        }}
      >
        <ImageNotSupportedRoundedIcon aria-hidden sx={{ fontSize: 40 }} />
        <Typography variant="body2">رسیدی برای این درخواست ثبت نشده است.</Typography>
      </Stack>
    );
  }

  if (status === 'error') {
    return (
      <Box
        role="alert"
        data-testid="operator-receipt-error"
        sx={{
          p: 2,
          border: 1,
          borderColor: 'var(--mui-palette-error-main)',
          borderRadius: '16px',
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
        }}
      >
        <Stack spacing={1.5}>
          <Typography variant="body2" sx={{ color: 'var(--mui-palette-error-main)' }}>
            {error?.message ?? 'خطا در بارگذاری رسید'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            لینک رسید محافظت‌شده است و به‌صورت خودکار منقضی می‌شود. اگر پیام تکرار شد، دوباره تلاش
            کنید.
          </Typography>
          <Box>
            <Button
              onClick={handleRetry}
              startIcon={<RefreshRoundedIcon />}
              size="small"
              variant="outlined"
              sx={{ minHeight: 44 }}
              data-testid="operator-receipt-retry"
            >
              تلاش دوباره
            </Button>
          </Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5} data-testid="operator-receipt-ready">
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: '16px',
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
          overflow: 'hidden',
          maxHeight: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ButtonBase
          component="button"
          type="button"
          onClick={() => setZoomOpen(true)}
          aria-label="بزرگ‌نمایی رسید پرداخت"
          data-testid="operator-receipt-image"
          sx={{ display: 'block', padding: 0, borderRadius: '16px' }}
        >
          <img
            src={url ?? undefined}
            alt="رسید پرداخت"
            style={{
              maxWidth: '100%',
              maxHeight: 360,
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </ButtonBase>
      </Box>
      <Box>
        <Button
          onClick={() => setZoomOpen(true)}
          startIcon={<ZoomInRoundedIcon />}
          size="small"
          sx={{ minHeight: 44 }}
          data-testid="operator-receipt-open"
        >
          بزرگ‌نمایی رسید
        </Button>
      </Box>
      <ReceiptZoomDialog
        open={zoomOpen}
        src={url ?? ''}
        alt="بزرگ‌نمایی رسید پرداخت"
        fileName={null}
        onClose={() => setZoomOpen(false)}
      />
    </Stack>
  );
}
