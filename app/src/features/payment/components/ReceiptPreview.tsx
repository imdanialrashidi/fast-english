// app/src/features/payment/components/ReceiptPreview.tsx
// Render the protected owner receipt using a short-lived token. The
// hook handles the network/token side; this component only chooses
// the right visual for each state.

import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
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
  const status = useReceiptPreview({
    recordId,
    fileName,
    enabled: show && Boolean(recordId) && Boolean(fileName),
  });

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
        sx={{
          p: 2,
          border: 1,
          borderColor: 'error.light',
          borderRadius: 2,
          backgroundColor: 'background.default',
        }}
      >
        <Stack spacing={1}>
          <Typography variant="body2" color="error.main">
            {status.error.message}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            لینک رسید محافظت‌شده است. اگر پیام تکرار شد، صفحه را تازه‌سازی کنید.
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5}>
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
          >
            باز کردن در تب جدید
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
