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
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth';
import { AuthError } from '../../lib/authErrors';
import { formatIranianPhoneForDisplay, normalizeIranianPhone } from '../../lib/phone';
import { type LoginValues, loginSchema } from '../../lib/schemas';
import { Brand } from '../brand/Brand';
import { PageContainer } from '../shell/PageContainer';
import { StatePanel } from '../shell/StatePanel';

// Focuses the first invalid field after a failed submit (keyboard-first:
// the user lands exactly where the fix is needed). RHF sets `aria-invalid`
// on every invalid input before the onInvalid callback runs.
function focusFirstInvalid(form: HTMLFormElement | null): void {
  requestAnimationFrame(() => {
    const first = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.focus();
  });
}

export function LoginRoute() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
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

  const onSubmit = handleSubmit(
    async (values) => {
      setServerError(null);
      try {
        const user = await login({ phone: values.phone, password: values.password });
        if (user.account_status === 'active') navigate('/dashboard', { replace: true });
        else navigate('/payment', { replace: true });
      } catch (err) {
        if (err instanceof AuthError) setServerError(err.message);
        else setServerError('خطای غیرمنتظره‌ای رخ داد.');
      }
    },
    () => focusFirstInvalid(formRef.current),
  );

  return (
    <PageContainer maxWidth="sm">
      <Stack spacing={2.5} sx={{ alignItems: 'center' }}>
        <Box sx={{ pt: 2 }}>
          <Brand variant="full" size="md" />
        </Box>

        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={2.5}>
              <Stack spacing={1}>
                <Typography component="h1" variant="h2">
                  ورود
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  با شمارهٔ موبایل و رمز عبور وارد شوید.
                </Typography>
              </Stack>

              <Stack
                ref={formRef}
                component="form"
                spacing={2}
                noValidate
                aria-label="فرم ورود"
                onSubmit={onSubmit}
              >
                <TextField
                  label="شمارهٔ موبایل"
                  type="tel"
                  autoComplete="tel"
                  placeholder="مثلاً ۰۹۱۲۳۴۵۶۷۸۹"
                  {...register('phone', {
                    onBlur: () => {
                      const c = normalizeIranianPhone(phoneValue);
                      if (c) setValue('phone', c, { shouldValidate: true });
                    },
                  })}
                  // RTL shell with intentional LTR handling for the phone
                  // value: digits are entered and aligned in a stable LTR
                  // run while labels/help stay RTL.
                  slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'tel' } }}
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
                            {showPassword ? (
                              <VisibilityOffRoundedIcon />
                            ) : (
                              <VisibilityRoundedIcon />
                            )}
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
              </Stack>

              <Divider />

              {/* Clearly separated cross-link to registration. */}
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                  حساب ندارید؟
                </Typography>
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

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" component="span">
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
      </Stack>

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
