// app/src/features/payment/components/ReceiptPicker.tsx
// Single-file receipt picker with local preview. Revokes Object URLs
// when the file is replaced or the component unmounts. No Base64
// conversion; no localStorage; no automatic upload.

import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
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

  // Build / replace the preview URL whenever `value` changes.
  useEffect(() => {
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
              فقط یک تصویر (JPEG/PNG/WebP، حداکثر ۵ مگابایت)
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
            <Button
              type="button"
              onClick={handlePick}
              variant="outlined"
              startIcon={<CloudUploadRoundedIcon />}
              disabled={disabled}
              sx={{ alignSelf: 'flex-start', minHeight: 48 }}
              aria-label="انتخاب تصویر رسید"
            >
              انتخاب تصویر رسید
            </Button>
          ) : (
            <Stack
              spacing={1.5}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: '16px',
                backgroundColor: 'background.default',
              }}
            >
              <Stack
                direction="row"
                spacing={2}
                sx={{ alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-all' }}>
                    {value.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {value.type || 'نوع نامشخص'} • {formatFileSize(value.size)}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5}>
                  <Button
                    size="small"
                    onClick={handlePick}
                    disabled={disabled}
                    sx={{ minHeight: 44 }}
                  >
                    جایگزینی
                  </Button>
                  <IconButton
                    onClick={handleRemove}
                    disabled={disabled}
                    aria-label="حذف رسید انتخاب‌شده"
                    sx={{ minWidth: 44, minHeight: 44 }}
                  >
                    <DeleteOutlineRoundedIcon />
                  </IconButton>
                </Stack>
              </Stack>
              {preview ? (
                <Box
                  sx={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    backgroundColor: 'background.paper',
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
                    style={{
                      maxWidth: '100%',
                      maxHeight: 280,
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </Box>
              ) : null}
            </Stack>
          )}

          {shownError ? (
            <Alert severity="error" role="alert" data-testid="receipt-error">
              {shownError}
            </Alert>
          ) : null}

          <Typography variant="caption" color="text.secondary">
            تصویر رسید نزد ما محافظت‌شده نگه‌داری می‌شود. فقط برای بررسی توسط اپراتور قابل دسترسی است و
            لینک عمومی ندارد.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
