// app/src/app/routes/SignupRoute.tsx

import { zodResolver } from '@hookform/resolvers/zod';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import {
  Box,
  Button,
  Card,
  CardContent,
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
import { type SignupValues, signupSchema } from '../../lib/schemas';
import { PageContainer } from '../shell/PageContainer';
import { PageHeader } from '../shell/PageHeader';
import { StatePanel } from '../shell/StatePanel';

export function SignupRoute() {
  const navigate = useNavigate();
  const { signup } = useAuth();
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

  const onSubmit = handleSubmit(async (values) => {
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
  });

  return (
    <PageContainer maxWidth="sm">
      <PageHeader title="ساخت حساب" subtitle="فقط با شمارهٔ موبایل ایرانی، نام و رمز عبور." />
      <Card>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack
            component="form"
            spacing={2}
            noValidate
            aria-label="فرم ثبت‌نام"
            onSubmit={onSubmit}
          >
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
              label="ایمیل (اختیاری)"
              type="email"
              inputMode="email"
              autoComplete="email"
              {...register('email')}
              error={Boolean(errors.email)}
              helperText={errors.email?.message ?? ' '}
            />
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
                        {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
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
            {serverError ? <StatePanel variant="error" description={serverError} /> : null}
            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? 'در حال ساخت حساب…' : 'ساخت حساب'}
            </Button>
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                حساب دارید؟{' '}
                <Typography
                  component={RouterLink}
                  to="/login"
                  variant="body2"
                  sx={{ color: 'primary.main', textDecoration: 'none', fontWeight: 600 }}
                >
                  ورود
                </Typography>
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
