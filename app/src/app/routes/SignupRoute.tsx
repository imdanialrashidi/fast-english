// app/src/app/routes/SignupRoute.tsx

import { zodResolver } from '@hookform/resolvers/zod';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import {
  Box,
  Button,
  Card,
  CardContent,
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
import { Brand } from '../../../../shared/ui/brand/Brand';
import { PageContainer } from '../../../../shared/ui/PageContainer';
import { StatePanel } from '../../../../shared/ui/StatePanel';
import { useAuth } from '../../lib/auth';
import { AuthError } from '../../lib/authErrors';
import { formatIranianPhoneForDisplay, normalizeIranianPhone } from '../../lib/phone';
import { type SignupValues, signupSchema } from '../../lib/schemas';

// Focuses the first invalid field after a failed submit (keyboard-first).
function focusFirstInvalid(form: HTMLFormElement | null): void {
  requestAnimationFrame(() => {
    const first = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.focus();
  });
}

export function SignupRoute() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
    defaultValues: { name: '', phone: '', email: '', password: '', passwordConfirm: '' },
  });

  const phoneValue = watch('phone');
  const canonicalPreview = normalizeIranianPhone(phoneValue);
  const phoneDisplay = canonicalPreview ? formatIranianPhoneForDisplay(canonicalPreview) : null;

  const onSubmit = handleSubmit(
    async (values) => {
      setServerError(null);
      try {
        await signup({
          name: values.name,
          phone: values.phone,
          email: values.email || undefined,
          password: values.password,
          passwordConfirm: values.passwordConfirm,
        });
        navigate('/payment', { replace: true });
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
                  ساخت حساب
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  فقط با شمارهٔ موبایل ایرانی، نام و رمز عبور.
                </Typography>
              </Stack>

              <Stack
                ref={formRef}
                component="form"
                spacing={2}
                noValidate
                aria-label="فرم ثبت‌نام"
                onSubmit={onSubmit}
              >
                <Stack spacing={1}>
                  <Typography variant="labelMedium" color="text.secondary">
                    اطلاعات حساب
                  </Typography>
                  <TextField
                    label="نام"
                    autoComplete="name"
                    {...register('name')}
                    error={Boolean(errors.name)}
                    helperText={errors.name?.message ?? ' '}
                  />
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
                    // value (stable digit entry); labels/help stay RTL.
                    slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'tel' } }}
                    error={Boolean(errors.phone)}
                    helperText={
                      errors.phone?.message ??
                      (phoneDisplay ? `شکل ذخیره‌شده: ${phoneDisplay}` : ' ')
                    }
                  />
                  <TextField
                    label="ایمیل (اختیاری)"
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                    // Emails are LTR values; the field aligns them as such.
                    slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'email' } }}
                    error={Boolean(errors.email)}
                    helperText={errors.email?.message ?? ' '}
                  />
                </Stack>

                <Stack spacing={1}>
                  <Typography variant="labelMedium" color="text.secondary">
                    رمز عبور
                  </Typography>
                  <TextField
                    label="رمز عبور"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
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
                  <TextField
                    label="تکرار رمز عبور"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    {...register('passwordConfirm')}
                    error={Boolean(errors.passwordConfirm)}
                    helperText={errors.passwordConfirm?.message ?? ' '}
                  />
                </Stack>

                {serverError ? <StatePanel variant="error" description={serverError} /> : null}
                <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                  {isSubmitting ? 'در حال ساخت حساب…' : 'ساخت حساب'}
                </Button>
              </Stack>

              <Divider />

              {/* Clearly separated cross-link to login. */}
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                  حساب دارید؟
                </Typography>
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="outlined"
                  size="large"
                  fullWidth
                >
                  ورود
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  );
}
