// app/src/features/dashboard/routes/DashboardRoute.tsx
// P3-S2 — Active Student Dashboard with real progress data.

import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
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
  DASHBOARD_LOADING,
  DASHBOARD_LOGOUT,
  DASHBOARD_NO_ENTITLEMENT,
  DASHBOARD_PLACEMENT_SUMMARY,
  DASHBOARD_PROGRESS,
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

  const { student, placement, subscription, progress: prog, continueLearning, lessons } = dashboard;
  const hasContinueLesson =
    continueLearning?.lessonId &&
    continueLearning.kind !== 'no_lessons' &&
    continueLearning.kind !== 'all_completed';

  return (
    <PageContainer>
      {/* Welcome */}
      <PageHeader
        title={`${DASHBOARD_WELCOME} ${student.name}`}
        subtitle={`${LEVEL_SELECTED_LABEL}: ${student.selectedLevel}`}
      />

      <Stack spacing={2}>
        {/* Continue Learning Card */}
        {hasContinueLesson && (
          <Card variant="outlined" sx={{ borderColor: 'primary.main', borderWidth: 2 }}>
            <CardActionArea onClick={() => navigate(`/lessons/${continueLearning.lessonId}`)}>
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                  <PlayCircleRoundedIcon color="primary" />
                  <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700 }}>
                    ادامه یادگیری
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {continueLearning.kind === 'incomplete'
                    ? 'درس ناقص را ادامه دهید'
                    : 'درس جدید را شروع کنید'}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        )}

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

        {/* Lessons Overview */}
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <AutoStoriesRoundedIcon color="action" />
                <Typography variant="h6">دروس آموزشی</Typography>
              </Stack>
              <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {lessons.publishedCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    درس منتشر شده
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {prog.startedLessonCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    شروع شده
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {prog.completedLessonCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    کامل شده
                  </Typography>
                </Box>
              </Stack>
              {prog.publishedLessonCount > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      پیشرفت
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {prog.completionPercent}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={prog.completionPercent}
                    sx={{ borderRadius: 1, height: 6 }}
                  />
                </Box>
              )}
              <Box>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => navigate('/lessons')}
                  startIcon={<AutoStoriesRoundedIcon />}
                >
                  مشاهده درس‌ها
                </Button>
              </Box>
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

        {/* Progress Summary */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {DASHBOARD_PROGRESS}
            </Typography>
            <Stack spacing={0.5}>
              {prog.startedLessonCount > 0 ? (
                <>
                  <Typography variant="body2">شروع شده: {prog.startedLessonCount} درس</Typography>
                  <Typography variant="body2">کامل شده: {prog.completedLessonCount} درس</Typography>
                  <Typography variant="body2">پیشرفت کلی: {prog.completionPercent}%</Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  هنوز درسی را شروع نکرده‌اید.
                </Typography>
              )}
            </Stack>
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
