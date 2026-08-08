// app/src/app/routes/NotFoundRoute.tsx
// Student-safe Not Found state. Unknown paths — including the legacy
// /operator, /admin and /staff routes — render this page instead of the
// Admin application or any role error that could expose internal
// structure. No Admin login link, no Staff terminology.

import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { PageContainer } from '../../../../shared/ui/PageContainer';

export function NotFoundRoute() {
  return (
    <PageContainer maxWidth="sm">
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 6 }}>
        <Typography component="h1" variant="h1">
          صفحه پیدا نشد
        </Typography>
        <Typography variant="body1" color="text.secondary">
          آدرس موردنظر وجود ندارد یا منتقل شده است.
        </Typography>
        <Button component={RouterLink} to="/" variant="contained" size="large">
          بازگشت به صفحهٔ اصلی
        </Button>
      </Stack>
    </PageContainer>
  );
}
