import { Box, Button, Stack, Typography } from '@mui/material';
import { PageContainer } from '../shell/PageContainer';
import { PageHeader } from '../shell/PageHeader';
import { StatePanel } from '../shell/StatePanel';

export function PlacementRoute() {
  return (
    <PageContainer maxWidth="md">
      <PageHeader title="آزمون تعیین سطح" subtitle="۲۰ سؤال برای پیشنهاد سطح مناسب CEFR." />
      <StatePanel
        variant="unavailable"
        title="آزمون تعیین سطح هنوز آماده نیست"
        description="آزمون پس از اتصال به پایگاه‌داده و بارگذاری سؤالات فعال می‌شود."
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" disabled aria-disabled="true">
              شروع آزمون (بعداً فعال می‌شود)
            </Button>
          </Stack>
        }
      />
      <Box sx={{ pt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          پیش‌نمایش: آزمون شامل ۲۰ سؤال چهارگزینه‌ای است، نمره‌دهی در سمت سرور انجام می‌شود و پاسخ صحیح
          هرگز به دستگاه کاربر ارسال نمی‌شود.
        </Typography>
      </Box>
    </PageContainer>
  );
}
