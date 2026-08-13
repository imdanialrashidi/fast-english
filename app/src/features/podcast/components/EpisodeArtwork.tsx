// app/src/features/podcast/components/EpisodeArtwork.tsx
// Podcast Slice 5 — artwork-led Episode identity element.
//
// - Fixed 1:1 aspect ratio (reserved before load → no layout shift);
// - object-fit cover inside the rounded shape from the Design Tokens;
// - resolution chain is server-resolved (`episode.artwork` = thumbnail
//   override → Episode artwork); on any load failure the client falls
//   back to the controlled Product fallback artwork route;
// - meaningful alt text is required from the caller (decorative images
//   pass an empty alt explicitly);
// - small thumbnails only: the list API returns the artwork proxy URL,
//   never the full-size source file.

import { Box, type BoxProps } from '@mui/material';
import { useState } from 'react';
import { FALLBACK_ARTWORK_URL } from '../../../../../shared/podcast/domain';
import { radius } from '../../../../../shared/ui/tokens';
import { resolveMediaUrl } from '../../lessons/api';

export interface EpisodeArtworkProps {
  /** Server-resolved artwork path (episode.artwork) or empty for fallback. */
  src?: string | null;
  /** Meaningful alternative text; pass '' for decorative images only. */
  alt: string;
  'data-testid'?: string;
  /** Size/ratio overrides for the artwork box (defaults to 1:1). */
  sx?: BoxProps['sx'];
  /**
   * Lazy loading policy. Defaults to 'lazy' (below-the-fold friendly);
   * first-viewport artwork may pass 'eager' so it is not deferred.
   */
  loading?: 'lazy' | 'eager';
}

export function EpisodeArtwork({
  src,
  alt,
  'data-testid': testId,
  sx,
  loading = 'lazy',
}: EpisodeArtworkProps) {
  const [failed, setFailed] = useState(false);
  const url = src && src.length > 0 ? src : FALLBACK_ARTWORK_URL;
  const resolvedUrl = resolveMediaUrl(failed ? FALLBACK_ARTWORK_URL : url);

  return (
    <Box
      data-testid={testId}
      sx={{
        aspectRatio: '1 / 1',
        width: '100%',
        borderRadius: `${radius.radiusCard}px`,
        backgroundColor: 'surfaceContainerHighest',
        flexShrink: 0,
        ...sx,
      }}
    >
      <img
        src={resolvedUrl}
        alt={alt}
        loading={loading}
        onError={() => setFailed(true)}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: `${radius.radiusCard}px`,
        }}
      />
    </Box>
  );
}
