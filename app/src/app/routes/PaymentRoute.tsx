// app/src/app/routes/PaymentRoute.tsx
import { Box, Stack, Typography } from '@mui/material';
import { useAuth } from '../../lib/auth';
import { formatIranianPhoneForDisplay } from '../../lib/phone';
import { PageContainer } from '../shell/PageContainer';
import { PageHeader } from '../shell/PageHeader';
import { StatePanel } from '../shell/StatePanel';

export function PaymentRoute() {
  const { user } = useAuth();
  return (
    <PageContainer maxWidth="sm">
      <PageHeader
        title="پرداخت"
        subtitle={
          user
            ? `حساب شما: ${formatIranianPhoneForDisplay(user.phone)} — وضعیت: ${user.account_status}`
            : 'انتخاب طرح و بارگذاری رسید.'
        }
      />
      <StatePanel
        variant="unavailable"
        title="پرداخت و آپلود رسید هنوز آماده نیست"
        description="جریان پرداخت دستی، انتخاب طرح و بارگذاری رسید کارت‌به‌کارت در اسلایس P1-S1 فعال می‌شود."
      />
      <Box sx={{ pt: 3 }}>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            پس از فعال‌سازی، اپراتور پس از بررسی رسید، اشتراک شما را فعال می‌کند و به درس‌ها و صوت‌ها
            دسترسی پیدا می‌کنید.
          </Typography>
        </Stack>
      </Box>
    </PageContainer>
  );
}

export function PaymentStatusRoute() {
  return (
    <PageContainer maxWidth="sm">
      <PageHeader title="وضعیت پرداخت" />
      <StatePanel
        variant="unavailable"
        title="وضعیت پرداخت پس از فعال‌سازی نمایش داده می‌شود"
        description="پس از اتصال به پایگاه‌داده، این صفحه وضعیت «در انتظار بررسی»، «تأیید شده» یا «رد شده» را نمایش می‌دهد."
      />
    </PageContainer>
  );
}
