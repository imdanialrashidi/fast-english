// app/src/app/shell/PageSkeletons.tsx
// Visual Slice 2 — structured loading states that mirror the expected page
// layout (no full-page spinners where skeletons work). Each skeleton wraps
// its blocks in a polite live region so screen readers announce loading
// without stealing focus. MUI Skeleton disables its pulse/wave animation
// under `prefers-reduced-motion` by default (v9 behavior).

import { Box, Card, Skeleton, Stack } from '@mui/material';
import { layout } from '../../../../shared/ui/tokens/spacing';

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
          // String px values — MUI System maps numeric `width: 1` to 100%.
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

/** Home loading state (Podcast Slice 5): greeting, hero artwork + lines,
 *  section rows — media-aware so the layout does not shift when the real
 *  content arrives. */
export function HomeSkeleton() {
  return (
    <LoadingRegion label="در حال بارگذاری صفحهٔ اصلی…">
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Skeleton variant="text" width="40%" height={32} />
          <Skeleton variant="text" width="30%" height={20} />
        </Stack>
        <Card data-testid="skeleton-home-hero" sx={{ borderRadius: '24px' }}>
          <Stack spacing={2} sx={{ p: 3 }}>
            <Skeleton variant="text" width="30%" height={20} />
            <Stack direction="row" spacing={2}>
              <Skeleton variant="rounded" width={96} height={96} />
              <Stack spacing={1} sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="40%" height={16} />
                <Skeleton variant="text" width="25%" height={16} />
              </Stack>
            </Stack>
            <Skeleton variant="rounded" height={6} />
            <Skeleton variant="rounded" height={48} />
          </Stack>
        </Card>
        <Box>
          <Skeleton variant="text" width="25%" height={24} sx={{ mb: 1.5 }} />
          <Stack spacing={1.5}>
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <Stack direction="row" spacing={1.5} sx={{ p: 1.5 }}>
                  <Skeleton variant="rounded" width={88} height={88} />
                  <Stack spacing={1} sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="45%" height={18} />
                    <Skeleton variant="text" width="70%" height={18} />
                    <Skeleton variant="rounded" height={40} width="60%" />
                  </Stack>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Box>
      </Stack>
    </LoadingRegion>
  );
}

/** Lesson list loading state: topic header + card rows. */
export function LessonListSkeleton() {
  return (
    <LoadingRegion label="در حال بارگذاری درس‌ها…">
      <Stack spacing={2}>
        <Skeleton variant="text" width="40%" height={32} />
        {[0, 1].map((group) => (
          <Box key={group}>
            <Skeleton variant="text" width="25%" height={22} sx={{ mb: 1.5 }} />
            <Stack spacing={1.5}>
              {[0, 1].map((card) => (
                <Card key={card}>
                  <Stack spacing={1.5} sx={{ p: `${layout.cardPaddingCompact}px` }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Skeleton variant="text" width="40%" height={20} />
                      <Skeleton variant="rounded" width={64} height={24} />
                    </Stack>
                    <Skeleton variant="text" width="75%" height={22} />
                    <Skeleton variant="text" width="90%" height={16} />
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Skeleton variant="text" width="20%" height={14} />
                      <Skeleton variant="rounded" width={120} height={40} />
                    </Stack>
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </LoadingRegion>
  );
}

/** Episode loading state (Slice 7 Record Jacket): artwork, rail plates,
 *  identity lines, Deck skeleton, then the reading-column sections. */
export function LessonDetailSkeleton() {
  return (
    <LoadingRegion label="در حال بارگذاری اپیزود…">
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          sx={{ alignItems: 'flex-start' }}
        >
          <Box sx={{ width: { xs: 200, md: 200, lg: 280 }, flexShrink: 0 }}>
            <Skeleton variant="rounded" width="100%" height={200} />
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rounded" width={44} height={44} />
              ))}
            </Stack>
          </Box>
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0, pt: { md: 0.5 } }}>
            <Skeleton variant="text" width="30%" height={16} />
            <Skeleton variant="text" width="70%" height={32} />
            <Skeleton variant="text" width="45%" height={18} />
            <Skeleton variant="text" width="25%" height={16} />
          </Stack>
        </Stack>
        <Box data-testid="player-surface">
          <DeckSkeleton />
        </Box>
        <Box sx={{ maxWidth: layout.readingMaxWidth, width: '100%' }}>
          <Skeleton variant="text" width="30%" height={24} sx={{ mb: 1.5 }} />
          <Skeleton variant="text" height={18} />
          <Skeleton variant="text" height={18} />
          <Skeleton variant="text" width="80%" height={18} sx={{ mb: 3 }} />
          <Skeleton variant="text" width="30%" height={24} sx={{ mb: 1.5 }} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="text" height={18} sx={{ mb: 1 }} />
          ))}
        </Box>
      </Stack>
    </LoadingRegion>
  );
}

/** Deck-shaped loading block (used by first load + Variant switches). */
export function DeckSkeleton() {
  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid="deck-skeleton"
      sx={{
        backgroundColor: 'surfaceContainerHigh',
        borderRadius: '16px',
        p: 2,
      }}
    >
      <Skeleton variant="rounded" height={4} sx={{ mb: 1.5 }} />
      <Skeleton variant="text" width="30%" height={16} />
      <Skeleton variant="rounded" height={14} sx={{ my: 1.5 }} />
      <Stack direction="row" sx={{ justifyContent: 'center', gap: 2, mt: 1 }}>
        <Skeleton variant="circular" width={44} height={44} />
        <Skeleton variant="rounded" width={128} height={56} sx={{ borderRadius: '999px' }} />
        <Skeleton variant="circular" width={44} height={44} />
      </Stack>
    </Box>
  );
}
