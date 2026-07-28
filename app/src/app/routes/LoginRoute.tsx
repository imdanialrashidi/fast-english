// app/src/app/routes/LoginRoute.tsx

import { zodResolver } from '@hookform/resolvers/zod';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth';
import { AuthError } from '../../lib/authErrors';
import { formatIranianPhoneForDisplay, normalizeIranianPhone } from '../../lib/phone';
import { type LoginValues, loginSchema } from '../../lib/schemas';
import { PageContainer } from '../shell/PageContainer';
import { PageHeader } from '../shell/PageHeader';
import { StatePanel } from '../shell/StatePanel';

export function LoginRoute() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { phone: '', password: '' },
  });

  const phoneValue = watch('phone');
  const canonicalPreview = normalizeIranianPhone(phoneValue);
  const phoneDisplay = canonicalPreview ? formatIranianPhoneForDisplay(canonicalPreview) : null;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const user = await login({ phone: values.phone, password: values.password });
      if (user.account_status === 'active') navigate('/dashboard', { replace: true });
      else navigate('/payment', { replace: true });
    } catch (err) {
      if (err instanceof AuthError) setServerError(err.message);
      else setServerError('خطای غیرمنتظره‌ای رخ داد.');
    }
  });

  return (
    <PageContainer maxWidth="sm">
      <PageHeader title="ورود" subtitle="با شمارهٔ موبایل و رمز عبور وارد شوید." />
      <Card>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack component="form" spacing={2} noValidate aria-label="فرم ورود" onSubmit={onSubmit}>
            <TextField
              label="شمارهٔ موبایل"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="مثلاً ۰۹۱۲۳۴۵۶۷۸۹"
              {...register('phone', {
                onBlur: () => {
                  const c = normalizeIranianPhone(phoneValue);
                  if (c) setValue('phone', c, { shouldValidate: true });
                },
              })}
              error={Boolean(errors.phone)}
              helperText={
                errors.phone?.message ?? (phoneDisplay ? `شکل ذخیره‌شده: ${phoneDisplay}` : ' ')
              }
            />
            <TextField
              label="رمز عبور"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
              error={Boolean(errors.password)}
              helperText={errors.password?.message ?? ' '}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((s) => !s)}
                        edge="end"
                        aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                      >
                        {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            {serverError ? <StatePanel variant="error" description={serverError} /> : null}
            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? 'در حال ورود…' : 'ورود'}
            </Button>
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                حساب ندارید؟{' '}
                <Typography
                  component={RouterLink}
                  to="/signup"
                  variant="body2"
                  sx={{ color: 'primary.main', textDecoration: 'none', fontWeight: 600 }}
                >
                  ساخت حساب
                </Typography>
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pt: 1 }}>
                رمز عبور را فراموش کرده‌اید؟{' '}
                <Typography
                  component="button"
                  type="button"
                  variant="caption"
                  onClick={() => setRecoveryOpen(true)}
                  sx={{
                    color: 'primary.main',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    p: 0,
                    font: 'inherit',
                    textDecoration: 'underline',
                  }}
                >
                  بازیابی از طریق پشتیبانی
                </Typography>
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        dir="rtl"
        aria-labelledby="recovery-title"
        aria-describedby="recovery-desc"
      >
        <DialogTitle id="recovery-title">بازیابی رمز عبور</DialogTitle>
        <DialogContent>
          <DialogContentText id="recovery-desc">
            بازیابی خودکار رمز عبور در این نسخه فعال نیست. برای بازنشانی رمز عبور، با پشتیبانی تماس
            بگیرید و شمارهٔ موبایل حساب خود را اعلام کنید.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecoveryOpen(false)} autoFocus>
            متوجه شدم
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
