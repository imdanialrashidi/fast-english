// app/src/features/payment/components/ReceiptPreview.tsx
// Render the protected owner receipt via the secure custom route.
// The hook (useReceiptPreview) handles the network/blob side; this
// component only chooses the right visual for each state.

import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useReceiptPreview } from '../useReceiptPreview';

interface Props {
  recordId: string | null;
  fileName: string | null;
  /** When false, the hook is idle and no URL is fetched. */
  show: boolean;
  /** Whether to show the open-in-new-tab/download link. */
  showOpenAction?: boolean;
}

export function ReceiptPreview({ recordId, fileName, show, showOpenAction = true }: Props) {
  // Bump a counter to force the hook to re-issue the fetch.
  const [retryToken, setRetryToken] = useState(0);
  // We mount/unmount the hook via a key prop on the inner wrapper so
  // the effect re-runs after a retry click. This is the simplest
  // way to "re-run" a useEffect that depends on stable inputs.

  if (!show) {
    return (
      <Box
        sx={{
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          backgroundColor: 'background.default',
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
          borderRadius: 2,
          backgroundColor: 'background.default',
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

  if (status.kind === 'loading' || status.kind === 'idle') {
    return (
      <Stack
        spacing={1.5}
        sx={{
          p: 3,
          minHeight: 200,
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          backgroundColor: 'background.default',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        role="status"
        aria-live="polite"
        data-testid="receipt-preview-loading"
      >
        <CircularProgress size={28} />
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
          borderRadius: 2,
          backgroundColor: 'background.default',
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
          borderRadius: 2,
          backgroundColor: 'background.default',
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
        <Stack direction="row" spacing={1}>
          <Button
            component="a"
            href={status.url}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<DownloadRoundedIcon />}
            size="small"
            sx={{ minHeight: 44 }}
            data-testid="receipt-preview-open"
          >
            باز کردن در تب جدید
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
