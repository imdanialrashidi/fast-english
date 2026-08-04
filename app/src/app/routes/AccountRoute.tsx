// app/src/app/routes/AccountRoute.tsx
// Visual Slice 2 — polished account presentation with clear information
// groups: identity, selected level, subscription, display preference,
// logout. Read-only values are plain text (never editable-looking inputs);
// no raw record dump; missing/malformed optional fields degrade gracefully.

import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { Box, Button, Card, CardContent, Chip, Skeleton, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import * as placementApi from '../../features/placement/api';
import type { DashboardResponse } from '../../features/placement/types';
import { useAuth } from '../../lib/auth';
import { formatIranianPhoneForDisplay } from '../../lib/phone';
import { LevelBadge } from '../shell/LevelBadge';
import { PageContainer } from '../shell/PageContainer';
import { PageHeader } from '../shell/PageHeader';
import { StatePanel } from '../shell/StatePanel';
import { ThemeSwitch } from '../theme/ThemeSwitch';
import type { CefrLevel } from '../theme/tokens/cefr';

// PocketBase serializes an unset select field as "" — normalize to a valid
// CEFR level so an unfinished placement can never crash the account page.
function normalizeLevel(value: unknown): CefrLevel {
  return typeof value === 'string' && value.length > 0 ? (value as CefrLevel) : 'B1';
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography component="h2" variant="titleMedium" sx={{ mb: 1.5 }}>
      {children}
    </Typography>
  );
}

function InfoRow({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: React.ReactNode;
  ltr?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography
        variant="body1"
        dir={ltr ? 'ltr' : undefined}
        sx={{ textAlign: ltr ? 'start' : undefined, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export function AccountRoute() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [subState, setSubState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [subscription, setSubscription] = useState<DashboardResponse['subscription'] | null>(null);

  const loadSubscription = useCallback(async () => {
    setSubState('loading');
    try {
      const data = await placementApi.getDashboard();
      setSubscription(data.subscription);
      setSubState('ready');
    } catch {
      setSubState('error');
    }
  }, []);

  useEffect(() => {
    void loadSubscription();
  }, [loadSubscription]);

  if (!user) return null;

  return (
    <PageContainer maxWidth="md">
      <PageHeader
        title="حساب کاربری"
        subtitle="نمای کلی حساب، اشتراک و تنظیمات نمایش."
        action={
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<LogoutRoundedIcon />}
            onClick={() => {
              logout();
              navigate('/', { replace: true });
            }}
            data-testid="account-logout"
          >
            خروج
          </Button>
        }
      />

      <Stack spacing={2}>
        {/* Identity */}
        <Card>
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <GroupTitle>اطلاعات حساب</GroupTitle>
            <Stack spacing={2}>
              <InfoRow label="نام" value={user.name || '—'} />
              <InfoRow label="شمارهٔ موبایل" value={formatIranianPhoneForDisplay(user.phone)} ltr />
            </Stack>
          </CardContent>
        </Card>

        {/* Level */}
        <Card>
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <GroupTitle>سطح آموزشی</GroupTitle>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <LevelBadge level={normalizeLevel(user.selected_level)} />
                <Button size="small" variant="text" onClick={() => navigate('/placement/result')}>
                  تغییر سطح
                </Button>
              </Box>
              {user.suggested_level ? (
                <Typography variant="body2" color="text.secondary">
                  سطح پیشنهادی: {user.suggested_level}
                </Typography>
              ) : null}
              <Typography variant="caption" color="text.secondary">
                درس‌های شما بر اساس این سطح نمایش داده می‌شوند.
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* Subscription (read-only summary; loaded lazily, never crashes) */}
        <Card data-testid="account-subscription-card">
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <GroupTitle>اشتراک</GroupTitle>
            {subState === 'loading' ? (
              <Stack spacing={1}>
                <Skeleton variant="text" width="40%" height={18} />
                <Skeleton variant="text" width="55%" height={18} />
                <Skeleton variant="text" width="35%" height={18} />
              </Stack>
            ) : subState === 'error' ? (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  وضعیت اشتراک در دسترس نیست.
                </Typography>
                <Box>
                  <Button size="small" variant="outlined" onClick={loadSubscription}>
                    تلاش مجدد
                  </Button>
                </Box>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <WorkspacePremiumRoundedIcon color="success" />
                  <Chip
                    label="فعال"
                    size="small"
                    sx={{
                      backgroundColor: 'successContainer',
                      color: 'onSuccessContainer',
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <InfoRow label="طرح" value={subscription?.planName || '—'} />
                <InfoRow
                  label="تاریخ انقضا"
                  value={
                    subscription?.expiresAt
                      ? new Date(subscription.expiresAt).toLocaleDateString('fa-IR')
                      : '—'
                  }
                />
                <InfoRow label="روزهای باقی‌مانده" value={`${subscription?.remainingDays ?? 0}`} />
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Display preference */}
        <Card>
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <GroupTitle>حالت نمایش</GroupTitle>
            <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <ThemeSwitch data-testid="account-theme-switch" />
              <Typography variant="caption" color="text.secondary">
                انتخاب شما روی همهٔ صفحه‌ها اعمال می‌شود؛ «سیستمی» از تنظیمات دستگاه پیروی می‌کند.
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <StatePanel
          variant="unavailable"
          title="تنظیمات کامل حساب در اسلایس بعدی فعال می‌شود"
          description="تغییر رمز عبور، آپلود تصویر پروفایل و تنظیمات اعلان‌ها در این بخش قرار خواهند گرفت."
        />
      </Stack>
    </PageContainer>
  );
}
