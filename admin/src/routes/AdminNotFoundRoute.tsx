// admin/src/routes/AdminNotFoundRoute.tsx
// Admin-side Not Found state for unknown paths. No Student links.

import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { PageContainer } from '../../../shared/ui/PageContainer';

export function AdminNotFoundRoute() {
  return (
    <PageContainer maxWidth="sm">
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 6 }}>
        <Typography component="h1" variant="h1">
          صفحه پیدا نشد
        </Typography>
        <Typography variant="body1" color="text.secondary">
          آدرس موردنظر وجود ندارد.
        </Typography>
        <Button component={RouterLink} to="/" variant="contained" size="large">
          بازگشت به داشبورد
        </Button>
      </Stack>
    </PageContainer>
  );
}
