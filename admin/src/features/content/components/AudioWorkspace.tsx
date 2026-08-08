// admin/src/features/content/components/AudioWorkspace.tsx
// Variant audio: upload/replace, authoritative duration + size display,
// removal when publication rules permit, and a Staff-only playable
// preview (never a Student audio URL).

import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { AUDIO_MAX_BYTES, AUDIO_MIME_TYPES } from '../../../../../shared/content-package/constants';
import { audioUrl, fetchMediaBlob, removeVariantAudio, uploadVariantAudio } from '../api';
import { safeErrorMessage } from '../errors';
import { formatDuration } from '../presentation';

export interface AudioWorkspaceProps {
  variantId: string;
  audioPresent: boolean;
  audioDurationSeconds: number;
  status: string;
  onChanged: () => void;
}

export function AudioWorkspace({
  variantId,
  audioPresent,
  audioDurationSeconds,
  status,
  onChanged,
}: AudioWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sizeBytes, setSizeBytes] = useState<number | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);

  // Derive display metadata from the Staff-authorized bytes.
  useEffect(() => {
    let cancelled = false;
    setSizeBytes(null);
    setUploadName(null);
    if (!audioPresent) return;
    void fetchMediaBlob(`/api/fast-english/staff/media/audio/${variantId}`)
      .then((blob) => {
        if (!cancelled) setSizeBytes(blob.size);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [variantId, audioPresent]);

  const pick = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    const isAudio =
      (AUDIO_MIME_TYPES as readonly string[]).includes(file.type) ||
      /\.(mp3|m4a|mp4)$/i.test(file.name);
    if (!isAudio) {
      setError('فرمت صوتی پشتیبانینشده است؛ MP3 یا M4A انتخاب کنید.');
      return;
    }
    if (file.size === 0) {
      setError('فایل انتخابشده خالی است.');
      return;
    }
    if (file.size > AUDIO_MAX_BYTES) {
      setError('حجم فایل صوتی بیش از ۱۰ مگابایت است.');
      return;
    }
    setBusy(true);
    setUploadName(file.name);
    try {
      await uploadVariantAudio(variantId, file);
      onChanged();
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError(safeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError(null);
    setBusy(true);
    try {
      await removeVariantAudio(variantId);
      onChanged();
    } catch (err) {
      setError(safeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const locked = status === 'published';

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="titleMedium">صوت اپیزود</Typography>
          {audioPresent ? (
            <>
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                  مدت: <b dir="ltr">{formatDuration(audioDurationSeconds)}</b>
                </Typography>
                {sizeBytes !== null ? (
                  <Typography variant="body2" color="text.secondary">
                    حجم: <b>{formatBytes(sizeBytes)}</b>
                  </Typography>
                ) : null}
                {uploadName ? (
                  <Typography variant="body2" color="text.secondary">
                    فایل: <b dir="ltr">{uploadName}</b>
                  </Typography>
                ) : null}
              </Stack>
              <Box
                component="audio"
                controls
                preload="none"
                src={audioUrl(variantId)}
                dir="ltr"
                sx={{ width: '100%', maxWidth: 480 }}
                data-testid="audio-preview"
              />
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              فایل صوتی تنظیم نشده است.
            </Typography>
          )}
          {error ? (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          ) : null}
          {locked ? (
            <Typography variant="caption" color="text.secondary">
              نسخه منتشرشده است؛ جایگزینی صوت مجاز است اما حذف آن ممکن نیست.
            </Typography>
          ) : null}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button
              component="label"
              variant="outlined"
              size="small"
              startIcon={busy ? <CircularProgress size={16} /> : <UploadRoundedIcon />}
              disabled={busy}
              sx={{ minHeight: 44 }}
              data-testid="audio-upload-button"
            >
              {audioPresent ? 'جایگزینی صوت' : 'بارگذاری صوت'}
              <input
                ref={inputRef}
                type="file"
                accept="audio/mpeg,audio/mp4,audio/mp3,audio/x-m4a,.mp3,.m4a"
                hidden
                onChange={(e) => void pick(e.target.files?.[0])}
                data-testid="audio-input"
              />
            </Button>
            {audioPresent && !locked ? (
              <Button
                size="small"
                variant="text"
                color="error"
                startIcon={<DeleteOutlineRoundedIcon />}
                disabled={busy}
                onClick={() => void remove()}
                data-testid="audio-remove"
                sx={{ minHeight: 44 }}
              >
                حذف صوت
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
