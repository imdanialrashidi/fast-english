import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { Brand } from '../../../../shared/ui/brand/Brand';
import { PageContainer } from '../../../../shared/ui/PageContainer';

// App entry route: the first screen an unauthenticated visitor sees after
// reaching the web app. Communicates value briefly and routes to login/signup.
//
// Action hierarchy (Material 3):
//   - Registration (ساخت حساب) is THE primary action — one dominant filled
//     button only;
//   - Login (ورود) uses the outlined hierarchy — never a second dominant
//     filled button;
//   - both actions are full-width on mobile with deliberate vertical spacing
//     (16px) and >= 48px heights, so they can never touch or overlap at 360px.
// Theme control sits quietly in the corner, outside the content flow.
export function EntryRoute() {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        py: 4,
        position: 'relative',
      }}
    >
      <PageContainer maxWidth="sm" disableGutter>
        <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Brand variant="full" size="md" />

          <Stack spacing={1.5}>
            <Typography component="h1" variant="h1" sx={{ textWrap: 'balance' }}>
              انگلیسی را دقیقاً در سطح خودت یاد بگیر
            </Typography>
            <Typography variant="body1" color="text.secondary">
              یک موضوع، شش سطح، متن و صوت مناسب تو.
            </Typography>
          </Stack>

          <Stack spacing={2} sx={{ width: '100%' }}>
            <Button component={RouterLink} to="/signup" variant="contained" size="large" fullWidth>
              ساخت حساب
            </Button>
            <Button component={RouterLink} to="/login" variant="outlined" size="large" fullWidth>
              ورود
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ pt: 1 }}>
            ورود، پرداخت و فعال‌سازی اشتراک از داخل همین برنامه انجام می‌شود.
          </Typography>
        </Stack>
      </PageContainer>
    </Box>
  );
}
