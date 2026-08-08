// app/src/features/payment/components/ReceiptPicker.tsx
// Professional receipt-selection surface.
//
// - Real native file input (visually hidden, opened by a labeled
//   button — keyboard/touch accessible, >= 44px targets).
// - Selected filename + size + type, supported-type guidance and the
//   real backend size limit (constants.ts mirrors the server cap).
// - Immediate client validation mirroring the server (MIME + size);
//   the server remains authoritative for security.
// - Replace and remove actions before submission; Object URLs are
//   revoked on replace, removal and unmount (never Base64, never
//   localStorage, never an automatic upload).
// - Bounded preview with preserved aspect ratio; zoom in an
//   accessible Dialog; a malformed (undecodable) image degrades to a
//   safe validation state — no crash, no server URL exposure.
// - No drag-and-drop requirement; nothing is animated continuously.

import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { ReceiptZoomDialog } from '../../../../../shared/ui/ReceiptZoomDialog';
import { ALLOWED_RECEIPT_MIME_TYPES, MAX_RECEIPT_BYTES } from '../constants';
import { formatFileSize } from '../formatters';
import type { PaymentError } from '../types';

interface Props {
  value: File | null;
  onChange: (file: File | null) => void;
  /** Server-side or local validation error to show next to the picker. */
  error?: PaymentError | null;
  /** When true, the picker is disabled (e.g. during submission). */
  disabled?: boolean;
}

interface PreviewState {
  url: string;
  file: File;
}

function isAllowedType(file: File): boolean {
  return ALLOWED_RECEIPT_MIME_TYPES.includes(file.type.toLowerCase());
}

export function ReceiptPicker({ value, onChange, error, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  // Build / replace the preview URL whenever `value` changes.
  useEffect(() => {
    setDecodeFailed(false);
    if (!value) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview({ url, file: value });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [value]);

  // Final cleanup on unmount: revoke any current URL.
  useEffect(() => {
    return () => {
      setPreview((current) => {
        if (current?.url) {
          URL.revokeObjectURL(current.url);
        }
        return current;
      });
    };
  }, []);

  const handlePick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setLocalError(null);
      onChange(null);
      return;
    }
    if (!isAllowedType(file)) {
      setLocalError('فرمت فایل باید JPEG، PNG یا WebP باشد.');
      onChange(null);
      e.target.value = '';
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setLocalError('حجم فایل نباید بیشتر از ۵ مگابایت باشد.');
      onChange(null);
      e.target.value = '';
      return;
    }
    setLocalError(null);
    onChange(file);
    e.target.value = '';
  };

  const handleRemove = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setLocalError(null);
    setDecodeFailed(false);
    setZoomOpen(false);
    onChange(null);
  };

  const shownError = localError ?? error?.message ?? null;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={2}
            sx={{
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <Typography component="h2" variant="h4">
              رسید پرداخت
            </Typography>
            <Typography variant="caption" color="text.secondary">
              فقط یک تصویر (JPEG / PNG / WebP، حداکثر ۵ مگابایت)
            </Typography>
          </Stack>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            // `capture` is omitted so the picker offers both camera
            // and gallery on Android, but the picker remains a normal
            // file input everywhere else.
            onChange={handleFile}
            disabled={disabled}
            aria-hidden="true"
            tabIndex={-1}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          />

          {!value ? (
            <Box>
              <Button
                type="button"
                onClick={handlePick}
                variant="outlined"
                startIcon={<CloudUploadRoundedIcon />}
                disabled={disabled}
                sx={{ minHeight: 48, px: 2 }}
                aria-label="انتخاب تصویر رسید"
                data-testid="select-receipt"
              >
                انتخاب تصویر رسید
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                تصویر رسید باید خوانا باشد و مبلغ آن با مبلغ اعلام‌شده مطابقت داشته باشد. نوع فایل‌های
                پشتیبانی‌شده: JPEG، PNG و WebP — حداکثر ۵ مگابایت.
              </Typography>
            </Box>
          ) : (
            <Stack
              spacing={1.5}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: decodeFailed ? 'error.light' : 'divider',
                borderRadius: '16px',
                backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
              }}
              data-testid="receipt-selected"
            >
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'center', minWidth: 0, flex: 1 }}
                >
                  <ImageRoundedIcon color="primary" aria-hidden sx={{ flexShrink: 0 }} />
                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                      dir="auto"
                    >
                      {value.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {value.type || 'نوع نامشخص'} • {formatFileSize(value.size)}
                    </Typography>
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                  {preview && !decodeFailed ? (
                    <IconButton
                      onClick={() => setZoomOpen(true)}
                      disabled={disabled}
                      aria-label="بزرگ‌نمایی رسید"
                      sx={{ minWidth: 44, minHeight: 44 }}
                      data-testid="preview-zoom"
                    >
                      <ZoomInRoundedIcon />
                    </IconButton>
                  ) : null}
                  <Button
                    size="small"
                    onClick={handlePick}
                    disabled={disabled}
                    sx={{ minHeight: 44 }}
                    data-testid="replace-receipt"
                  >
                    جایگزینی
                  </Button>
                  <IconButton
                    onClick={handleRemove}
                    disabled={disabled}
                    aria-label="حذف رسید انتخاب‌شده"
                    sx={{ minWidth: 44, minHeight: 44 }}
                    data-testid="remove-receipt"
                  >
                    <DeleteOutlineRoundedIcon />
                  </IconButton>
                </Stack>
              </Stack>

              {preview && !decodeFailed ? (
                <Box
                  sx={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--mui-palette-surfaceContainerHighest)',
                    border: 1,
                    borderColor: 'divider',
                    maxHeight: 280,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={preview.url}
                    alt="پیش‌نمایش رسید"
                    onError={() => setDecodeFailed(true)}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 280,
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </Box>
              ) : null}

              {decodeFailed ? (
                <Alert severity="warning" role="alert" data-testid="receipt-decode-error">
                  تصویر انتخاب‌شده قابل نمایش نیست (ممکن است فایل آسیب‌دیده باشد). لطفاً تصویر دیگری
                  انتخاب کنید.
                </Alert>
              ) : null}
            </Stack>
          )}

          {shownError ? (
            <Alert severity="error" role="alert" data-testid="receipt-error">
              {shownError}
            </Alert>
          ) : null}

          <Typography variant="caption" color="text.secondary">
            تصویر رسید نزد ما محافظت‌شده نگه‌داری می‌شود؛ فقط برای بررسی پرداخت قابل دسترسی است و لینک
            عمومی ندارد. پس از ارسال، وضعیت بررسی در همین صفحه نمایش داده می‌شود.
          </Typography>

          <ReceiptZoomDialog
            open={zoomOpen && preview !== null && !decodeFailed}
            src={preview?.url ?? ''}
            alt="بزرگ‌نمایی رسید پرداخت"
            fileName={value?.name ?? null}
            fileSize={value?.size ?? null}
            onClose={() => setZoomOpen(false)}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
