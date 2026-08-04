// app/src/features/payment/components/PaymentApprovedPanel.tsx
// The approved-request state: successful activation, authoritative
// payment request data, and — when the backend provides it — the
// authoritative subscription window (startsAt/expiresAt/remainingDays
// from the dashboard route). Dates are NEVER computed client-side.
//
// The next primary action refreshes the auth record first so the
// route guard sees the real (active) account status, then navigates
// to the placement or dashboard route.
//
// The receipt is intentionally not shown here — after approval the
// sensitive receipt data is no longer needed on this surface.

import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../lib/auth';
import { getDashboard } from '../../placement/api';
import { formatPersianDateTime } from '../formatters';
import type { PaymentRequest } from '../types';
import { PaymentRequestSummary } from './PaymentRequestSummary';
import { PaymentStatusTimeline } from './PaymentStatusTimeline';
import { StatusBadge } from './StatusBadge';

export type ApprovedCtaTarget = 'dashboard' | 'placement';

/**
 * Pure decision: where the primary CTA goes after approval.
 * - dashboard data available  → dashboard (subscription visible there)
 * - placement incomplete      → placement
 * - unknown (network etc.)    → dashboard (guards handle edge cases)
 */
export function resolveApprovedCta(
  dashboardLoaded: boolean,
  dashboardErrorCode: string | null,
): ApprovedCtaTarget {
  if (dashboardErrorCode === 'placement_incomplete' && !dashboardLoaded) return 'placement';
  return 'dashboard';
}

function mapDashboardErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as {
    response?: { data?: { code?: string }; code?: string };
    code?: string;
    cause?: { code?: string; data?: { code?: string } };
  };
  // The PB SDK puts the parsed body directly on `response` (custom
  // routes send { code, message }); the raw-fetch wrapper nests it
  // under `response.data`. Read both, then fall back to cause.
  const code =
    e.response?.code ??
    e.response?.data?.code ??
    e.code ??
    e.cause?.code ??
    e.cause?.data?.code ??
    null;
  return typeof code === 'string' ? code : null;
}

export function PaymentApprovedPanel({ request }: { request: PaymentRequest }) {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [dashState, setDashState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>(
    'loading',
  );
  const [subscription, setSubscription] = useState<{
    planName: string;
    startsAt: string;
    expiresAt: string;
    remainingDays: number;
  } | null>(null);

  const load = useCallback(async () => {
    setDashState('loading');
    try {
      const data = await getDashboard();
      setSubscription(data.subscription);
      setDashState('ready');
    } catch (err) {
      const code = mapDashboardErrorCode(err);
      if (code === 'placement_incomplete') {
        setDashState('unavailable');
      } else {
        setDashState('error');
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ctaTarget: ApprovedCtaTarget = dashState === 'unavailable' ? 'placement' : 'dashboard';

  const goNext = async () => {
    // The stored auth record may be stale (approved while the session
    // was pending). Refresh so the route guard sees the active status.
    try {
      await refresh();
    } catch {
      // Navigation still works for the remaining cases; the guard
      // will re-evaluate on the next load.
    }
    navigate(ctaTarget === 'placement' ? '/placement' : '/dashboard', {
      replace: true,
    });
  };

  return (
    <Card data-testid="approved-panel">
      <CardContent>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <CheckCircleRoundedIcon color="success" aria-hidden />
            <Typography component="h2" variant="h4">
              پرداخت تأیید شد
            </Typography>
            <StatusBadge status={request.status} />
          </Stack>

          <Alert severity="success" role="status" data-testid="approved-alert">
            پرداخت شما توسط اپراتور تأیید شد و اشتراک شما فعال شده است.
          </Alert>

          <PaymentStatusTimeline
            status={request.status}
            created={request.created}
            updated={request.updated}
          />

          <PaymentRequestSummary request={request} />

          <Box>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
              اشتراک فعال
            </Typography>
            {dashState === 'loading' ? (
              <Stack spacing={1}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
              </Stack>
            ) : subscription ? (
              <Box
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  border: 1,
                  borderColor: 'var(--mui-palette-outlineVariant)',
                  backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
                }}
                data-testid="subscription-window"
              >
                <Stack spacing={1}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {subscription.planName || request.planName}
                    </Typography>
                    <Chip
                      size="small"
                      label="فعال"
                      icon={<CheckCircleRoundedIcon />}
                      sx={{
                        backgroundColor: 'var(--mui-palette-successContainer)',
                        color: 'var(--mui-palette-onSuccessContainer)',
                        fontWeight: 600,
                      }}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    شروع اشتراک: {formatPersianDateTime(subscription.startsAt) || '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    پایان اشتراک: {formatPersianDateTime(subscription.expiresAt) || '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    روزهای باقی‌مانده: {subscription.remainingDays}
                  </Typography>
                </Stack>
              </Box>
            ) : dashState === 'unavailable' ? (
              <Typography variant="body2" color="text.secondary">
                اشتراک شما فعال است. ابتدا تعیین سطح را کامل کنید تا درس‌ها برای شما آماده شوند.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                اشتراک شما فعال است. جزئیات دقیق در صفحهٔ داشبورد نمایش داده می‌شود.
              </Typography>
            )}
          </Box>

          <Box sx={{ pt: 1 }}>
            <Button
              variant="contained"
              onClick={goNext}
              endIcon={<ArrowForwardRoundedIcon sx={{ transform: 'scaleX(-1)' }} />}
              sx={{ minHeight: 48 }}
              data-testid="approved-primary-cta"
            >
              {ctaTarget === 'placement' ? 'شروع تعیین سطح' : 'رفتن به داشبورد'}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
