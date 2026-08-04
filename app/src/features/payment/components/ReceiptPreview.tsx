// app/src/features/payment/components/ReceiptPreview.tsx
// Render the protected owner receipt via the secure custom route.
// The hook (useReceiptPreview) handles the network/blob side; this
// component only chooses the right visual for each state.
//
// The rendered image is a local blob: URL (never a protected server
// URL). Zoom happens in an accessible Dialog; the blob URL is
// revoked when the component unmounts or retries.

import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useReceiptPreview } from '../useReceiptPreview';
import { ReceiptZoomDialog } from './ReceiptZoomDialog';

interface Props {
  recordId: string | null;
  fileName: string | null;
  /** When false, the hook is idle and no URL is fetched. */
  show: boolean;
  /** Whether to show the zoom action. */
  showOpenAction?: boolean;
}

export function ReceiptPreview({ recordId, fileName, show, showOpenAction = true }: Props) {
  // Bump a counter to force the hook to re-issue the fetch.
  const [retryToken, setRetryToken] = useState(0);

  if (!show) {
    return (
      <Box
        sx={{
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: '16px',
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          رسیدی برای نمایش وجود ندارد.
        </Typography>
      </Box>
    );
  }

  if (!recordId) {
    return (
      <Box
        sx={{
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: '16px',
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          رسیدی برای نمایش وجود ندارد.
        </Typography>
      </Box>
    );
  }

  return (
    <PreviewBody
      key={`${recordId}:${retryToken}`}
      recordId={recordId}
      fileName={fileName}
      showOpenAction={showOpenAction}
      onRetry={() => setRetryToken((n) => n + 1)}
    />
  );
}

interface PreviewBodyProps {
  recordId: string;
  fileName: string | null;
  showOpenAction: boolean;
  onRetry: () => void;
}

function PreviewBody({ recordId, fileName, showOpenAction, onRetry }: PreviewBodyProps) {
  const status = useReceiptPreview({
    recordId,
    fileName,
    enabled: true,
  });
  const [zoomOpen, setZoomOpen] = useState(false);

  if (status.kind === 'loading' || status.kind === 'idle') {
    return (
      <Stack
        spacing={1.5}
        sx={{
          p: 3,
          minHeight: 200,
          border: 1,
          borderColor: 'divider',
          borderRadius: '16px',
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        role="status"
        aria-live="polite"
        data-testid="receipt-preview-loading"
      >
        <CircularProgress size={28} aria-label="در حال بارگذاری رسید" />
        <Typography variant="body2" color="text.secondary">
          در حال بارگذاری رسید…
        </Typography>
      </Stack>
    );
  }

  if (status.kind === 'error') {
    return (
      <Box
        role="alert"
        data-testid="receipt-preview-error"
        sx={{
          p: 2,
          border: 1,
          borderColor: 'error.light',
          borderRadius: '16px',
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
        }}
      >
        <Stack spacing={1.5}>
          <Typography variant="body2" color="error.main">
            {status.error.message}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            لینک رسید محافظت‌شده است. اگر پیام تکرار شد، صفحه را تازه‌سازی کنید.
          </Typography>
          <Box>
            <Button
              onClick={onRetry}
              startIcon={<RefreshRoundedIcon />}
              size="small"
              variant="outlined"
              sx={{ minHeight: 44 }}
              data-testid="receipt-preview-retry"
            >
              تلاش دوباره
            </Button>
          </Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5} data-testid="receipt-preview-ready">
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
        <img
          src={status.url}
          alt="رسید پرداخت"
          style={{
            maxWidth: '100%',
            maxHeight: 360,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </Box>
      {showOpenAction ? (
        <Box>
          <Button
            onClick={() => setZoomOpen(true)}
            startIcon={<ZoomInRoundedIcon />}
            size="small"
            sx={{ minHeight: 44 }}
            data-testid="receipt-preview-open"
          >
            بزرگ‌نمایی رسید
          </Button>
        </Box>
      ) : null}
      <ReceiptZoomDialog
        open={zoomOpen}
        src={status.url}
        alt="بزرگ‌نمایی رسید پرداخت"
        fileName={fileName}
        onClose={() => setZoomOpen(false)}
      />
    </Stack>
  );
}
