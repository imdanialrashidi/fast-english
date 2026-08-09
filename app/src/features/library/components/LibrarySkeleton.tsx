// app/src/features/library/components/LibrarySkeleton.tsx
// Podcast Slice 6 — media-aware Library loading state.
//
// Reserves the real page geometry (heading, search bar, filter rows,
// artwork + title + metadata per card) so the layout does not jump when
// content arrives. Wrapped in a polite live region; no full-page spinner.

import { Box, Card, Skeleton, Stack } from '@mui/material';

function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="skeleton-region"
      aria-label={label}
    >
      <Box
        sx={{
          position: 'absolute',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          width: '1px',
          height: '1px',
          m: -1,
        }}
      >
        {label}
      </Box>
      {children}
    </Box>
  );
}

export function LibrarySkeleton() {
  return (
    <LoadingRegion label="در حال بارگذاری کتابخانه…">
      <Stack spacing={2.5}>
        <Stack spacing={1}>
          <Skeleton variant="text" width="30%" height={32} />
          <Skeleton variant="text" width="55%" height={18} />
        </Stack>
        <Skeleton variant="rounded" height={52} />
        <Stack direction="row" spacing={1}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" width={96} height={40} sx={{ flexShrink: 0 }} />
          ))}
        </Stack>
        {[0, 1, 2].map((card) => (
          <Card key={card}>
            <Stack direction="row" spacing={1.5} sx={{ p: 1.5 }}>
              <Skeleton variant="rounded" width={88} height={88} sx={{ flexShrink: 0 }} />
              <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                <Skeleton variant="text" width="30%" height={14} />
                <Skeleton variant="text" width="75%" height={20} />
                <Skeleton variant="text" width="45%" height={14} />
                <Skeleton variant="rounded" height={40} />
              </Stack>
            </Stack>
          </Card>
        ))}
      </Stack>
    </LoadingRegion>
  );
}
