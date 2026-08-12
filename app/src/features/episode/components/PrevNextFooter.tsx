// app/src/features/episode/components/PrevNextFooter.tsx
// Slice 7 — previous/next Episode navigation.
//
// Rendered ONLY from real backend-provided neighbors (previousEpisode /
// nextEpisode on the detail response). Absent refs → no footer at all:
// adjacency is never invented client-side.

import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Box, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { productCopy } from '../../../app/copy/productCopy';
import type { EpisodeNeighborRef } from '../../lessons/types';
import { EpisodeArtwork } from '../../podcast/components/EpisodeArtwork';

export interface PrevNextFooterProps {
  previous: EpisodeNeighborRef | null;
  next: EpisodeNeighborRef | null;
}

function NeighborLink({ ref, kind }: { ref: EpisodeNeighborRef; kind: 'previous' | 'next' }) {
  const label =
    kind === 'previous' ? productCopy.episodeSurface.previous : productCopy.episodeSurface.next;
  const title = ref.titleFa?.trim() || ref.title;
  const isNext = kind === 'next';
  return (
    <Box
      component={RouterLink}
      to={`/lessons/${ref.variantId}`}
      aria-label={`${label}: ${title}`}
      data-testid={`prevnext-${kind}`}
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1.5,
        flex: { xs: '1 1 100%', sm: '0 1 auto' },
        minWidth: 0,
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: '12px',
        p: 1,
        '&:hover': { backgroundColor: 'surfaceContainerHigh' },
      }}
    >
      {!isNext ? <ChevronRightRoundedIcon sx={{ color: 'primary.main', flexShrink: 0 }} /> : null}
      <EpisodeArtwork src={ref.artwork} alt="" sx={{ width: 56, flexShrink: 0 }} loading="lazy" />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="caption"
          color="primary"
          sx={{ fontWeight: 700, display: 'block', textAlign: isNext ? 'end' : 'start' }}
        >
          {label}
        </Typography>
        <Typography
          variant="titleSmall"
          sx={{ display: 'block', overflowWrap: 'anywhere', textAlign: isNext ? 'end' : 'start' }}
        >
          {title}
        </Typography>
      </Box>
      {isNext ? <ChevronLeftRoundedIcon sx={{ color: 'primary.main', flexShrink: 0 }} /> : null}
    </Box>
  );
}

export function PrevNextFooter({ previous, next }: PrevNextFooterProps) {
  if (!previous && !next) return null;
  return (
    <Box component="nav" aria-label="اپیزودهای همسایه" data-testid="prevnext-footer" sx={{ mt: 4 }}>
      <Stack
        direction="row"
        sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'stretch', justifyContent: 'space-between' }}
      >
        {previous ? <NeighborLink ref={previous} kind="previous" /> : <Box sx={{ flex: 1 }} />}
        {next ? <NeighborLink ref={next} kind="next" /> : null}
      </Stack>
    </Box>
  );
}
