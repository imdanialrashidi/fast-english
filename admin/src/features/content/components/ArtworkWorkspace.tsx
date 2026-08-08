// admin/src/features/content/components/ArtworkWorkspace.tsx
// Episode artwork: square (primary identity) + optional wide hero.
// Uploads go through the Staff route; the server validates bytes,
// sizes and signatures. Removal is blocked server-side for published
// content and surfaced here.

import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
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
import { useRef, useState } from 'react';
import {
  ARTWORK_MAX_BYTES,
  ARTWORK_MIME_TYPES,
} from '../../../../../shared/content-package/constants';
import { artworkUrl, removeEpisodeMedia, uploadEpisodeMedia } from '../api';
import { safeErrorMessage } from '../errors';
import type { EpisodeListItem } from '../types';

interface ArtworkCardProps {
  episodeId: string;
  label: string;
  kind: 'artwork' | 'hero';
  present: boolean;
  hint?: string;
  onChanged: (episode: EpisodeListItem) => void;
}

function ArtworkCard({ episodeId, label, kind, present, hint, onChanged }: ArtworkCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!(ARTWORK_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError('فرمت تصویر پشتیبانینشده است؛ JPEG، PNG یا WebP انتخاب کنید.');
      return;
    }
    if (file.size === 0) {
      setError('فایل انتخابشده خالی است.');
      return;
    }
    if (file.size > ARTWORK_MAX_BYTES) {
      setError('حجم تصویر بیش از ۵ مگابایت است.');
      return;
    }
    setBusy(true);
    try {
      const res = await uploadEpisodeMedia(episodeId, kind, file);
      onChanged(res.episode);
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
      const res = await removeEpisodeMedia(episodeId, kind);
      onChanged(res.episode);
    } catch (err) {
      setError(safeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="titleMedium">{label}</Typography>
          {present ? (
            <Box
              sx={{
                width: '100%',
                maxHeight: 220,
                overflow: 'hidden',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'outlineVariant',
                display: 'flex',
                justifyContent: 'center',
                backgroundColor: 'surfaceContainerLow',
              }}
            >
              <img
                src={artworkUrl(episodeId, kind === 'artwork' ? 'square' : 'hero')}
                alt={kind === 'artwork' ? 'تصویر اصلی اپیزود' : 'تصویر عریض اپیزود'}
                style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain' }}
                data-testid={`artwork-preview-${kind}`}
              />
            </Box>
          ) : (
            <Box
              sx={{
                height: 120,
                borderRadius: 2,
                border: '1px dashed',
                borderColor: 'outlineVariant',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'onSurfaceVariant',
                gap: 1,
              }}
            >
              <ImageRoundedIcon />
              <Typography variant="body2">تصویری تنظیم نشده است</Typography>
            </Box>
          )}
          {kind === 'hero' && !present ? (
            <Typography variant="caption" color="text.secondary">
              در صورت نبود تصویر عریض، رابط دانشجو از تصویر اصلی اپیزود استفاده میکند.
            </Typography>
          ) : null}
          {error ? (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          ) : null}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button
              component="label"
              variant="outlined"
              size="small"
              startIcon={busy ? <CircularProgress size={16} /> : <UploadRoundedIcon />}
              disabled={busy}
              sx={{ minHeight: 44 }}
            >
              {present ? 'جایگزینی' : 'بارگذاری'}
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => void pick(e.target.files?.[0])}
                data-testid={`artwork-input-${kind}`}
              />
            </Button>
            {present ? (
              <Button
                size="small"
                variant="text"
                color="error"
                startIcon={<DeleteOutlineRoundedIcon />}
                disabled={busy}
                onClick={() => void remove()}
                data-testid={`artwork-remove-${kind}`}
                sx={{ minHeight: 44 }}
              >
                حذف
              </Button>
            ) : null}
          </Stack>
          {hint ? (
            <Typography variant="caption" color="text.secondary">
              {hint}
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ArtworkWorkspace({
  episodeId,
  episode,
  onChanged,
}: {
  episodeId: string;
  episode: Pick<EpisodeListItem, 'artworkPresent' | 'heroPresent' | 'status'>;
  onChanged: (episode: EpisodeListItem) => void;
}) {
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        تصویر اصلی هویت اپیزود است و در کتابخانه دانشجو نمایش داده میشود.
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ArtworkCard
            episodeId={episodeId}
            label="تصویر اصلی (مربع)"
            kind="artwork"
            present={episode.artworkPresent}
            onChanged={onChanged}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ArtworkCard
            episodeId={episodeId}
            label="تصویر عریض"
            kind="hero"
            present={episode.heroPresent}
            onChanged={onChanged}
          />
        </Box>
      </Stack>
    </Stack>
  );
}
