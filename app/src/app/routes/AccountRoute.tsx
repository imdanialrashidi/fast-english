// app/src/app/routes/AccountRoute.tsx
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth';
import { formatIranianPhoneForDisplay } from '../../lib/phone';
import { LevelBadge } from '../shell/LevelBadge';
import { PageContainer } from '../shell/PageContainer';
import { PageHeader } from '../shell/PageHeader';
import { StatePanel } from '../shell/StatePanel';

export function AccountRoute() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <PageContainer maxWidth="md">
      <PageHeader title="حساب کاربری" subtitle="نمای کلی حساب و تنظیمات." />

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography component="h2" variant="h4">
              اطلاعات حساب
            </Typography>
            <Box>
              <Typography variant="caption" color="text.secondary">
                نام
              </Typography>
              <Typography variant="body1">{user.name}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                شمارهٔ موبایل
              </Typography>
              <Typography variant="body1" dir="ltr" sx={{ textAlign: 'start' }}>
                {formatIranianPhoneForDisplay(user.phone)}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.5 }}
              >
                سطح انتخابی
              </Typography>
              <LevelBadge level={(user.selected_level ?? 'B1') as 'B1'} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                وضعیت حساب
              </Typography>
              <Typography variant="body1">{user.account_status}</Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1.5}>
        <Button variant="outlined" onClick={() => navigate('/')}>
          بازگشت
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={() => {
            logout();
            navigate('/', { replace: true });
          }}
        >
          خروج
        </Button>
      </Stack>

      <Box sx={{ pt: 3 }}>
        <StatePanel
          variant="unavailable"
          title="تنظیمات کامل حساب در اسلایس بعدی فعال می‌شود"
          description="تغییر رمز عبور، آپلود تصویر پروفایل و تنظیمات اعلان‌ها در این بخش قرار خواهند گرفت."
        />
      </Box>
    </PageContainer>
  );
}
