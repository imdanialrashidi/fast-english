// admin/src/routes/AdminLoginRoute.tsx
// Staff login: Fast English Podcast branding, «ورود مدیریت», a concise
// note that the area is restricted, email + password, loading state and a
// safe authentication error. There is no public signup link, no Student
// registration link and no "switch role" control — the Admin has exactly
// one identity type.

import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Brand } from '../../../shared/ui/brand/Brand';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { StatePanel } from '../../../shared/ui/StatePanel';
import { useStaffAuth } from '../auth/staffAuth';
import { staffLoginErrorMessage } from '../auth/staffErrors';

export function AdminLoginRoute() {
  const { login } = useStaffAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(staffLoginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer maxWidth="xs">
      <Stack spacing={3} sx={{ alignItems: 'center', py: 6 }}>
        <Brand variant="full" size="md" />
        <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Typography component="h1" variant="h1">
            ورود مدیریت
          </Typography>
          <Typography variant="body2" color="text.secondary">
            این بخش فقط برای مدیران مجاز است.
          </Typography>
        </Stack>

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
          <Stack spacing={2}>
            <TextField
              label="ایمیل"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="admin-login-email"
              required
            />
            <TextField
              label="رمز عبور"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="admin-login-password"
              required
            />
            {error ? (
              <StatePanel variant="error" title="ورود ناموفق بود" description={error} />
            ) : null}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={!canSubmit}
              data-testid="admin-login-submit"
            >
              {submitting ? 'در حال ورود…' : 'ورود'}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </PageContainer>
  );
}
