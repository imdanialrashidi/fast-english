// shared/ui/ReceiptZoomDialog.tsx
// Accessible zoom dialog for a receipt image. Full-screen on phones
// (fits any viewport), bounded centered dialog on larger screens.
// MUI Dialog handles focus trap and restoration; Escape and the
// close button both dismiss it. The image source is a local blob:
// URL — never a protected server URL.

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  AppBar,
  Dialog,
  DialogContent,
  IconButton,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { formatFileSize } from '../lib/formatters';

interface Props {
  open: boolean;
  /** Local blob: URL of the image. */
  src: string;
  alt: string;
  fileName: string | null;
  fileSize?: number | null;
  onClose: () => void;
}

export function ReceiptZoomDialog({ open, src, alt, fileName, fileSize, onClose }: Props) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isPhone}
      maxWidth="md"
      fullWidth
      aria-label="بزرگ‌نمایی رسید"
      data-testid="receipt-zoom-dialog"
      scroll="paper"
    >
      <AppBar
        position="static"
        elevation={0}
        sx={{
          backgroundColor: 'var(--mui-palette-surfaceContainerHigh)',
          color: 'var(--mui-palette-onSurface)',
        }}
      >
        <Toolbar sx={{ minHeight: 56, gap: 1 }}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={onClose}
            aria-label="بستن بزرگ‌نمایی"
            sx={{ minWidth: 44, minHeight: 44 }}
            data-testid="receipt-zoom-close"
          >
            <CloseRoundedIcon />
          </IconButton>
          <Typography variant="body1" sx={{ flex: 1, fontWeight: 600, overflowWrap: 'anywhere' }}>
            {fileName || 'رسید پرداخت'}
          </Typography>
          {fileSize ? (
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              {formatFileSize(fileSize)}
            </Typography>
          ) : null}
        </Toolbar>
      </AppBar>
      <DialogContent
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
          p: 2,
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
            borderRadius: '12px',
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
