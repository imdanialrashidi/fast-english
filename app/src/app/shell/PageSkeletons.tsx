// app/src/app/shell/PageSkeletons.tsx
// Visual Slice 2 — structured loading states that mirror the expected page
// layout (no full-page spinners where skeletons work). Each skeleton wraps
// its blocks in a polite live region so screen readers announce loading
// without stealing focus. MUI Skeleton disables its pulse/wave animation
// under `prefers-reduced-motion` by default (v9 behavior).

import { Box, Card, Skeleton, Stack } from '@mui/material';
import { layout } from '../theme/tokens/spacing';

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

/** Dashboard loading state: header, Continue hero card, metrics, cards. */
export function DashboardSkeleton() {
  return (
    <LoadingRegion label="در حال بارگذاری داشبورد…">
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Skeleton variant="text" width="45%" height={32} />
          <Skeleton variant="text" width="30%" height={20} />
        </Stack>
        <Card data-testid="skeleton-continue-card" sx={{ borderRadius: '24px' }}>
          <Stack spacing={1.5} sx={{ p: 3 }}>
            <Skeleton variant="text" width="35%" height={20} />
            <Skeleton variant="text" width="70%" height={28} />
            <Skeleton variant="text" width="40%" height={18} />
            <Skeleton variant="rounded" height={48} width="60%" />
          </Stack>
        </Card>
        <Card>
          <Stack spacing={1.5} sx={{ p: 2.5 }}>
            <Skeleton variant="text" width="30%" height={22} />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 2,
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <Stack key={i} spacing={0.5}>
                  <Skeleton variant="text" width="60%" height={24} />
                  <Skeleton variant="text" width="80%" height={14} />
                </Stack>
              ))}
            </Box>
            <Skeleton variant="rounded" height={6} />
          </Stack>
        </Card>
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
                  <Stack spacing={1.5} sx={{ p: 2.5 }}>
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

/** Lesson detail loading state: metadata, player card, reading lines. */
export function LessonDetailSkeleton() {
  return (
    <LoadingRegion label="در حال بارگذاری درس…">
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Skeleton variant="text" width="60%" height={32} />
          <Skeleton variant="text" width="35%" height={18} />
        </Stack>
        <Card>
          <Stack spacing={1.5} sx={{ p: 2.5 }}>
            <Skeleton variant="rounded" height={4} />
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Skeleton variant="text" width="15%" height={16} />
              <Skeleton variant="text" width="15%" height={16} />
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'center', gap: 2 }}>
              <Skeleton variant="circular" width={44} height={44} />
              <Skeleton variant="circular" width={56} height={56} />
              <Skeleton variant="circular" width={44} height={44} />
            </Stack>
            <Skeleton variant="rounded" height={44} />
          </Stack>
        </Card>
        <Box sx={{ maxWidth: layout.readingMaxWidth, mx: 'auto', width: '100%' }}>
          <Skeleton variant="text" width="50%" height={26} sx={{ mb: 2 }} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="text" height={18} sx={{ mb: 1 }} />
          ))}
        </Box>
      </Stack>
    </LoadingRegion>
  );
}

// The loading region's label is announced by the live region; the hidden
// box above holds the actual text.
