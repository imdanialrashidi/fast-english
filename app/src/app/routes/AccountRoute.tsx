// app/src/app/routes/AccountRoute.tsx
// Student account information is one calm settings surface rather than a
// stack of unrelated cards: identity header → subscription → level → display
// preference. Read-only values stay typographic and server-owned.

import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { Box, Button, Divider, Skeleton, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageContainer } from '../../../../shared/ui/PageContainer';
import { ThemeSwitch } from '../../../../shared/ui/ThemeSwitch';
import type { CefrLevel } from '../../../../shared/ui/tokens/cefr';
import { radius } from '../../../../shared/ui/tokens/shape';
import * as placementApi from '../../features/placement/api';
import type { DashboardResponse } from '../../features/placement/types';
import { useAuth } from '../../lib/auth';
import { formatIranianPhoneForDisplay } from '../../lib/phone';
import { productCopy } from '../copy/productCopy';
import { LevelBadge } from '../shell/LevelBadge';

function normalizeLevel(value: unknown): CefrLevel {
  return typeof value === 'string' && value.length > 0 ? (value as CefrLevel) : 'B1';
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography component="h2" variant="titleMedium" sx={{ mb: 1.5, fontWeight: 700 }}>
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

  const recommended = user.suggested_level;
  const preferred = normalizeLevel(user.selected_level ?? '');

  return (
    <PageContainer maxWidth="lg">
      <Box component="header" sx={{ mb: { xs: 4, sm: 5 } }}>
        <Stack
          sx={{
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'flex-end' },
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0, maxWidth: '100%' }}>
            <Typography component="h1" variant="h2" sx={{ overflowWrap: 'anywhere' }}>
              {productCopy.nav.account}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              {user.name || '—'}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              component="span"
              sx={{ display: 'block', mt: 0.25 }}
            >
              {formatIranianPhoneForDisplay(user.phone)}
            </Typography>
          </Box>
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
        </Stack>
      </Box>

      <Box
        sx={{
          maxWidth: 760,
          backgroundColor: 'surfaceContainerLow',
          borderRadius: `${radius.radiusCard}px`,
          px: { xs: 2, sm: 3 },
          py: { xs: 2.5, sm: 3 },
        }}
      >
        <Box component="section" data-testid="account-subscription-card">
          <GroupTitle>{productCopy.subscription.label}</GroupTitle>
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
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <WorkspacePremiumRoundedIcon color="success" />
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {productCopy.subscription.active}
                </Typography>
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                  gap: { xs: 1.5, sm: 2.5 },
                }}
              >
                <InfoRow
                  label={productCopy.subscription.plan}
                  value={subscription?.planName || '—'}
                />
                <InfoRow
                  label={productCopy.subscription.expiresAt}
                  value={
                    subscription?.expiresAt
                      ? new Date(subscription.expiresAt).toLocaleDateString('fa-IR')
                      : '—'
                  }
                />
                <InfoRow
                  label={productCopy.subscription.daysRemaining}
                  value={`${subscription?.remainingDays ?? 0}`}
                />
              </Box>
            </Stack>
          )}
        </Box>

        <Divider sx={{ my: { xs: 2.5, sm: 3 } }} />

        <Box component="section">
          <GroupTitle>سطح زبان</GroupTitle>
          <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <LevelBadge level={preferred} />
              <Button size="small" variant="text" onClick={() => navigate('/placement/result')}>
                تغییر سطح
              </Button>
            </Stack>
            {recommended && recommended !== preferred ? (
              <Typography variant="body2" color="text.secondary">
                {productCopy.levels.recommended}: {recommended} — {productCopy.levels.browsing}:{' '}
                {preferred}
              </Typography>
            ) : null}
          </Stack>
        </Box>

        <Divider sx={{ my: { xs: 2.5, sm: 3 } }} />

        <Box component="section">
          <GroupTitle>تنظیمات نمایش</GroupTitle>
          <ThemeSwitch labeled data-testid="account-theme-switch" />
        </Box>
      </Box>
    </PageContainer>
  );
}
