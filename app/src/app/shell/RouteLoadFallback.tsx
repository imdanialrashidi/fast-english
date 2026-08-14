// app/src/app/shell/RouteLoadFallback.tsx
// Minimal, quiet loading state shown while a lazy-loaded route chunk is
// being fetched (React Suspense fallback). Purposefully lightweight: it
// only covers the brief chunk-fetch window — each route already renders
// its own data skeleton once mounted. Uses the same skeleton language and
// tokens as PageSkeletons so the swap into real content is calm and never
// shows a full-page spinner flash.

import { Box, Skeleton, Stack } from '@mui/material';
import { PageContainer } from '../../../../shared/ui/PageContainer';

export function RouteLoadFallback() {
  return (
    <PageContainer maxWidth="lg">
      <Stack spacing={2} role="status" aria-busy="true" aria-label="در حال بارگذاری…">
        <Skeleton variant="text" width="35%" height={32} />
        <Box
          data-testid="route-load-fallback"
          sx={{
            backgroundColor: 'surfaceContainerLow',
            borderRadius: '16px',
            p: 2,
          }}
        >
          <Stack spacing={1.5}>
            <Skeleton variant="rounded" height={96} />
            <Skeleton variant="text" width="60%" height={20} />
            <Skeleton variant="text" width="40%" height={16} />
            <Skeleton variant="rounded" height={48} />
          </Stack>
        </Box>
        <Skeleton variant="text" width="80%" height={16} />
        <Skeleton variant="text" width="70%" height={16} />
      </Stack>
    </PageContainer>
  );
}
