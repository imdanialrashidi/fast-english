// app/src/features/dashboard/routes/DashboardRoute.tsx
// P2-S2 — Active Student Dashboard.

import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageContainer } from '../../../app/shell/PageContainer';
import { PageHeader } from '../../../app/shell/PageHeader';
import { StatePanel } from '../../../app/shell/StatePanel';
import { useAuth } from '../../../lib/auth';
import * as placementApi from '../../placement/api';
import {
  CEFR_LEVEL_LABELS,
  DASHBOARD_ACCOUNT,
  DASHBOARD_LESSONS_SHELL,
  DASHBOARD_LESSONS_SOON,
  DASHBOARD_LOADING,
  DASHBOARD_LOGOUT,
  DASHBOARD_NO_ENTITLEMENT,
  DASHBOARD_PLACEMENT_SUMMARY,
  DASHBOARD_PROGRESS,
  DASHBOARD_PROGRESS_PLACEHOLDER,
  DASHBOARD_SUBSCRIPTION,
  DASHBOARD_SUPPORT,
  DASHBOARD_UNAVAILABLE,
  DASHBOARD_WELCOME,
  LEVEL_CHANGE,
  LEVEL_SELECTED_LABEL,
  LEVEL_SUGGESTED_LABEL,
} from '../../placement/constants';
import { mapPlacementError } from '../../placement/errors';
import type { DashboardResponse } from '../../placement/types';

type Phase = 'loading' | 'ready' | 'error' | 'unavailable' | 'no_entitlement';

export function DashboardRoute() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [errorInfo, setErrorInfo] = useState<{
    title: string;
    description: string;
    retry?: boolean;
  } | null>(null);

  const loadDashboard = useCallback(async () => {
    setPhase('loading');
    setErrorInfo(null);
    try {
      const data = await placementApi.getDashboard();
      setDashboard(data);
      setPhase('ready');
    } catch (err) {
      const mapped = mapPlacementError(err);
      if (
        mapped.code === 'placement_incomplete' ||
        mapped.code === 'no_attempt' ||
        mapped.code === 'attempt_not_submitted'
      ) {
        setPhase('unavailable');
        setErrorInfo({
          title: 'تعیین سطح کامل نشده',
          description: mapped.message,
          retry: false,
        });
      } else if (mapped.code === 'subscription_required' || mapped.code === 'account_suspended') {
        setPhase('no_entitlement');
        setErrorInfo({
          title: 'دسترسی محدود',
          description: mapped.message,
          retry: false,
        });
      } else {
        setPhase('error');
        setErrorInfo({ title: 'خطا', description: mapped.message, retry: mapped.retry });
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  if (phase === 'loading') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel variant="loading" title={DASHBOARD_LOADING} />
      </PageContainer>
    );
  }

  if (phase === 'error') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel
          variant="error"
          title={errorInfo?.title || 'خطا'}
          description={errorInfo?.description}
          action={
            errorInfo?.retry ? (
              <Button variant="outlined" onClick={loadDashboard}>
                تلاش مجدد
              </Button>
            ) : undefined
          }
        />
      </PageContainer>
    );
  }

  if (phase === 'unavailable') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel
          variant="unavailable"
          title={errorInfo?.title || DASHBOARD_UNAVAILABLE}
          description={errorInfo?.description}
          action={
            <Button variant="contained" onClick={() => navigate('/placement/result')}>
              انتخاب سطح
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (phase === 'no_entitlement') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel
          variant="permission"
          title={errorInfo?.title || DASHBOARD_NO_ENTITLEMENT}
          description={errorInfo?.description}
        />
      </PageContainer>
    );
  }

  // Ready — render dashboard
  if (!dashboard || !user) return null;

  const { student, placement, subscription } = dashboard;

  return (
    <PageContainer>
      {/* Welcome */}
      <PageHeader
        title={`${DASHBOARD_WELCOME} ${student.name}`}
        subtitle={`${LEVEL_SELECTED_LABEL}: ${student.selectedLevel}`}
      />

      <Stack spacing={2}>
        {/* Selected Level Card */}
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h6">{LEVEL_SELECTED_LABEL}</Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {student.selectedLevel}
                </Typography>
                <Chip
                  label={
                    CEFR_LEVEL_LABELS[student.selectedLevel as keyof typeof CEFR_LEVEL_LABELS] || ''
                  }
                  variant="outlined"
                  size="small"
                />
              </Stack>
              {student.suggestedLevel && (
                <Typography variant="body2" color="text.secondary">
                  {LEVEL_SUGGESTED_LABEL}: {student.suggestedLevel}
                </Typography>
              )}
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate('/placement/result')}
                >
                  {LEVEL_CHANGE}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Lessons Shell (honest placeholder) */}
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <SchoolRoundedIcon color="action" />
                <Typography variant="h6">{DASHBOARD_LESSONS_SHELL}</Typography>
                <Chip
                  label={DASHBOARD_LESSONS_SOON}
                  size="small"
                  color="default"
                  variant="outlined"
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {DASHBOARD_PROGRESS_PLACEHOLDER}
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* Placement Summary */}
        {placement.score !== null && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {DASHBOARD_PLACEMENT_SUMMARY}
              </Typography>
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  نمره: {placement.score} از {placement.maxScore}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {LEVEL_SUGGESTED_LABEL}: {student.suggestedLevel || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {LEVEL_SELECTED_LABEL}: {student.selectedLevel}
                </Typography>
                {placement.submittedAt && (
                  <Typography variant="caption" color="text.secondary">
                    تاریخ ثبت: {new Date(placement.submittedAt).toLocaleDateString('fa-IR')}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Subscription Summary */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {DASHBOARD_SUBSCRIPTION}
            </Typography>
            <Stack spacing={0.5}>
              {subscription.planName && (
                <Typography variant="body2">طرح: {subscription.planName}</Typography>
              )}
              {subscription.expiresAt && (
                <Typography variant="body2">
                  تاریخ انقضا: {new Date(subscription.expiresAt).toLocaleDateString('fa-IR')}
                </Typography>
              )}
              <Typography variant="body2">
                روزهای باقی‌مانده: {subscription.remainingDays}
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* Progress (honest placeholder) */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {DASHBOARD_PROGRESS}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {DASHBOARD_PROGRESS_PLACEHOLDER}
            </Typography>
          </CardContent>
        </Card>

        {/* Account */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {DASHBOARD_ACCOUNT}
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">نام: {student.name}</Typography>
              <Typography variant="body2" dir="ltr" sx={{ textAlign: 'start' }}>
                {user.phone}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button variant="outlined" color="error" onClick={handleLogout} size="small">
                {DASHBOARD_LOGOUT}
              </Button>
              <Button variant="text" size="small" disabled>
                {DASHBOARD_SUPPORT}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  );
}
