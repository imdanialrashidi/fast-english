// app/src/features/library/components/ContinueStrip.tsx
// Podcast Slice 6 — restrained Continue Listening rail.
//
// A compact horizontal presentation (artwork + title + resume action) for
// real resumable Progress only; the server never returns completed items.
// Deliberately smaller than the Home hero — no duplicate hero. Horizontal
// scroll on phones keeps the document free of overflow.

import { Box, Button, Card, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { productCopy } from '../../../app/copy/productCopy';
import { EpisodeArtwork } from '../../podcast/components/EpisodeArtwork';
import { formatClock } from '../../podcast/components/EpisodeCard';
import type { ContinueListeningItem } from '../types';

export function ContinueStrip({
  items,
  'data-testid': testId,
}: {
  items: ContinueListeningItem[];
  'data-testid'?: string;
}) {
  if (items.length === 0) return null;
  return (
    <Box data-testid={testId}>
      <Box
        role="list"
        aria-label={productCopy.library.continueSection}
        sx={{
          display: 'flex',
          gap: 1.5,
          overflowX: 'auto',
          pb: 0.5,
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'outlineVariant',
            borderRadius: '999px',
          },
        }}
      >
        {items.map((item) => {
          const titleFa = item.episode.titleFa?.trim();
          const title = titleFa || item.episode.title;
          const path = `/lessons/${item.variant.id}`;
          return (
            <Card key={item.variant.id} role="listitem" sx={{ flexShrink: 0, width: 240 }}>
              <Stack spacing={1} sx={{ p: 1.5 }}>
                <EpisodeArtwork
                  src={item.episode.artwork}
                  alt={title || productCopy.episode.entity}
                  loading="lazy"
                  sx={{ width: 72 }}
                />
                <Typography
                  variant="titleSmall"
                  sx={{
                    overflowWrap: 'anywhere',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  <RouterLink
                    to={path}
                    data-testid="continue-strip-title"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                  >
                    {title}
                  </RouterLink>
                </Typography>
                <Button
                  component={RouterLink}
                  to={path}
                  variant="contained"
                  size="small"
                  fullWidth
                  data-testid="continue-strip-cta"
                  sx={{ minHeight: 40 }}
                >
                  {productCopy.actions.continueFrom(formatClock(item.progress.positionSeconds))}
                </Button>
              </Stack>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
