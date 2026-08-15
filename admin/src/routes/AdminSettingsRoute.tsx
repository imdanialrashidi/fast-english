// admin/src/routes/AdminSettingsRoute.tsx
// Staff settings. ONE obvious location for owner-controlled business
// configuration (plans, payment destination, support contact) plus the
// account card and the theme selection («ظاهر») which lives ONLY here.

import { Card, CardContent, Stack, Typography } from '@mui/material';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ThemeSwitch } from '../../../shared/ui/ThemeSwitch';
import { useStaffAuth } from '../auth/staffAuth';
import { BusinessSettingsPanel } from '../features/settings/BusinessSettingsPanel';

export function AdminSettingsRoute() {
  const { user } = useStaffAuth();
  return (
    <PageContainer maxWidth="md">
      <PageHeader title="تنظیمات" />
      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Typography component="h2" variant="titleMedium" sx={{ mb: 1.5 }}>
              حساب
            </Typography>
            <Typography variant="body1">{user?.displayName || '—'}</Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              dir="ltr"
              sx={{ textAlign: 'start' }}
            >
              {user?.email || ''}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography component="h2" variant="titleMedium" sx={{ mb: 1.5 }}>
              تنظیمات کسبوکار
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              طرحها، قیمتها، مقصد کارتبهکارت و کانال پشتیبانی/همکاری — همینجا و بدون تغییر کد.
            </Typography>
            <BusinessSettingsPanel />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography component="h2" variant="titleMedium" sx={{ mb: 1.5 }}>
              ظاهر
            </Typography>
            <ThemeSwitch data-testid="admin-theme-switch" />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              انتخاب شما روی همهٔ صفحهها اعمال میشود؛ «سیستمی» از تنظیمات دستگاه پیروی میکند.
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  );
}
