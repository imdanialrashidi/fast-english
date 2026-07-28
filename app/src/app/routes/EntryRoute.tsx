import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { BrandMark } from '../shell/BrandMark';
import { PageContainer } from '../shell/PageContainer';

// App entry route: the first screen an unauthenticated visitor sees after
// reaching the web app. Communicates value briefly and routes to login/signup.
export function EntryRoute() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', py: 4 }}>
      <PageContainer maxWidth="sm" disableGutter>
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={3}>
              <BrandMark size={48} />
              <Stack spacing={1.5}>
                <Typography component="h1" variant="h1">
                  انگلیسی را دقیقاً در سطح خودت یاد بگیر
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  یک موضوع، شش سطح، متن و صوت مناسب تو.
                </Typography>
              </Stack>

              <Stack spacing={1.5}>
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="contained"
                  size="large"
                  fullWidth
                >
                  ورود
                </Button>
                <Button
                  component={RouterLink}
                  to="/signup"
                  variant="outlined"
                  size="large"
                  fullWidth
                >
                  ساخت حساب
                </Button>
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ pt: 1 }}>
                این یک نمایش بصری است — احراز هویت، پرداخت و اشتراک در نسخه‌های بعدی فعال می‌شوند.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </PageContainer>
    </Box>
  );
}
