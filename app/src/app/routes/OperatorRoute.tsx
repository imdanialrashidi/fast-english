import { Box, Stack, Typography } from '@mui/material';
import { PageContainer } from '../shell/PageContainer';
import { PageHeader } from '../shell/PageHeader';
import { StatePanel } from '../shell/StatePanel';

// Distinct operator surface. The student bottom nav and side nav are not
// rendered for this route (see AppShell). The route is a placeholder until
// P1-S2 builds the real operator queue, review, and approval actions.
export function OperatorRoute() {
  return (
    <PageContainer maxWidth="lg">
      <PageHeader title="پنل اپراتور" subtitle="صف درخواست‌های پرداخت، بررسی رسید و تأیید اشتراک." />
      <StatePanel
        variant="unavailable"
        title="پنل اپراتور هنوز آماده نیست"
        description="صف درخواست‌ها، نمایش رسید محافظت‌شده و اقدامات تأیید/رد در اسلایس P1-S2 ساخته می‌شوند."
      />
      <Box sx={{ pt: 3 }}>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            اپراتورها فقط به درخواست‌های پرداخت و اطلاعات محدود کاربر دسترسی خواهند داشت.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            احراز هویت اپراتور در سمت سرور بررسی می‌شود — حفاظ رابط کاربری به‌تنهایی مجوز محسوب
            نمی‌شود.
          </Typography>
        </Stack>
      </Box>
    </PageContainer>
  );
}
