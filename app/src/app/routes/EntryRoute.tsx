import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { Brand } from '../brand/Brand';
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
              <Brand variant="full" size="md" />
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
                ورود، پرداخت و فعال‌سازی اشتراک از داخل همین برنامه انجام می‌شود.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </PageContainer>
    </Box>
  );
}
