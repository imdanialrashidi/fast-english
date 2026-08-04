// app/src/features/dashboard/routes/DashboardRoute.tsx
// Visual Slice 2 — Active Student Dashboard.
//
// Information hierarchy (answers the four questions immediately):
//   1. Continue Learning — the single dominant next action (hero surface).
//   2. Level + progress metrics (started/completed/percent) in one compact
//      responsive group.
//   3. Subscription state with exact expiry and days remaining.
//   4. Honest empty states (no lessons / no progress / all completed) —
//      never placeholder metrics presented as real data.

import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import {
  Box,
  Button,
  Card,
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
import { DashboardSkeleton } from '../../../app/shell/PageSkeletons';
import { StatePanel } from '../../../app/shell/StatePanel';
import { radius } from '../../../app/theme/tokens';
import { useAuth } from '../../../lib/auth';
import * as lessonsApi from '../../lessons/api';
import type { LessonDetailResponse } from '../../lessons/types';
import * as placementApi from '../../placement/api';
import {
  CEFR_LEVEL_LABELS,
  DASHBOARD_LOGOUT,
  DASHBOARD_NO_ENTITLEMENT,
  DASHBOARD_PROGRESS,
  DASHBOARD_SUBSCRIPTION,
  DASHBOARD_UNAVAILABLE,
  DASHBOARD_WELCOME,
  LEVEL_CHANGE,
  LEVEL_SELECTED_LABEL,
  LEVEL_SUGGESTED_LABEL,
} from '../../placement/constants';
import { mapPlacementError } from '../../placement/errors';
import type { DashboardResponse } from '../../placement/types';
import * as progressApi from '../../progress/api';
import type { LessonProgressResponse } from '../../progress/types';

type Phase = 'loading' | 'ready' | 'error' | 'unavailable' | 'no_entitlement';

interface ContinueCardData {
  lesson: LessonDetailResponse;
  progress: LessonProgressResponse | null;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function DashboardRoute() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [continueCard, setContinueCard] = useState<ContinueCardData | null>(null);
  const [continueLoading, setContinueLoading] = useState(false);
  const [continueError, setContinueError] = useState(false);
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

  // Continue Learning: real title/topic/duration/position when available.
  // No fabricated time: remaining minutes are derived only from the
  // authoritative lesson duration + the saved position.
  useEffect(() => {
    if (phase !== 'ready' || !dashboard) return;
    const cl = dashboard.continueLearning;
    if (!cl?.lessonId || cl.kind === 'no_lessons' || cl.kind === 'all_completed') return;
    let cancelled = false;
    setContinueLoading(true);
    setContinueError(false);
    void (async () => {
      try {
        const [lesson, progress] = await Promise.all([
          lessonsApi.getLessonDetail(cl.lessonId),
          progressApi.getLessonProgress(cl.lessonId).catch(() => null),
        ]);
        if (!cancelled) {
          setContinueCard({ lesson, progress });
        }
      } catch {
        if (!cancelled) {
          setContinueCard(null);
          setContinueError(true);
        }
      } finally {
        if (!cancelled) setContinueLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, dashboard]);

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
        <DashboardSkeleton />
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

  const { student, subscription, progress: prog, continueLearning } = dashboard;
  const level = student.selectedLevel || '';
  const levelLabel = CEFR_LEVEL_LABELS[level as keyof typeof CEFR_LEVEL_LABELS] || '';

  // Remaining minutes only when both duration and position are reliable.
  let remainingMinutes: number | null = null;
  if (continueCard?.lesson.audioDurationSeconds && continueCard.progress) {
    const remaining =
      continueCard.lesson.audioDurationSeconds - continueCard.progress.positionSeconds;
    if (remaining > 30) {
      remainingMinutes = Math.max(1, Math.ceil(remaining / 60));
    }
  }

  const continuePosition = continueCard?.progress?.positionSeconds ?? 0;
  const isIncompleteContinue = continueLearning.kind === 'incomplete';

  return (
    <PageContainer maxWidth="md">
      <PageHeader
        title={`${DASHBOARD_WELCOME} ${student.name}`}
        subtitle={
          <Stack
            spacing={1.5}
            sx={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}
          >
            {level ? (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1,
                  py: 0.25,
                  borderRadius: '10px',
                  backgroundColor: 'secondaryContainer',
                  color: 'onSecondaryContainer',
                  fontWeight: 700,
                }}
                aria-label={`${LEVEL_SELECTED_LABEL}: ${level}`}
              >
                {level}
              </Box>
            ) : null}
            {levelLabel ? <Typography variant="body2">{levelLabel}</Typography> : null}
            {student.suggestedLevel && student.suggestedLevel !== level ? (
              <Typography variant="body2" color="text.secondary">
                {LEVEL_SUGGESTED_LABEL}: {student.suggestedLevel}
              </Typography>
            ) : null}
          </Stack>
        }
        action={
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={handleLogout}
            startIcon={<LogoutRoundedIcon />}
          >
            {DASHBOARD_LOGOUT}
          </Button>
        }
      />

      <Stack spacing={2}>
        {/* ---- 1. Continue Learning: the dominant next action ---- */}
        {continueLearning.kind === 'no_lessons' ? (
          <StatePanel
            variant="empty"
            title="هنوز درسی منتشر نشده است"
            description={`برای سطح ${level || 'شما'} هنوز درسی منتشر نشده است. به‌زودی درس‌های جدید اضافه می‌شوند.`}
            action={
              student.suggestedLevel && student.suggestedLevel !== level ? (
                <Button variant="outlined" onClick={() => navigate('/placement/result')}>
                  {LEVEL_CHANGE}
                </Button>
              ) : undefined
            }
          />
        ) : continueLearning.kind === 'all_completed' ? (
          <StatePanel
            variant="success"
            title="همهٔ درس‌های این سطح کامل شد"
            description="برای مرور دوباره می‌توانید به فهرست درس‌ها بروید."
            action={
              <Button variant="contained" onClick={() => navigate('/lessons')}>
                مشاهدهٔ درس‌ها
              </Button>
            }
          />
        ) : (
          <Card
            data-testid="continue-card"
            sx={{ borderRadius: radius.radiusHero, backgroundColor: 'primaryContainer' }}
          >
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <PlayCircleRoundedIcon sx={{ color: 'onPrimaryContainer' }} />
                  <Typography
                    variant="titleMedium"
                    sx={{ color: 'onPrimaryContainer', fontWeight: 700 }}
                  >
                    ادامه یادگیری
                  </Typography>
                </Stack>

                {continueLoading && !continueCard ? (
                  <Box sx={{ color: 'onPrimaryContainer' }}>
                    <Typography variant="body2">در حال آماده‌سازی…</Typography>
                  </Box>
                ) : null}

                {!continueLoading && continueError ? (
                  <Box sx={{ color: 'onPrimaryContainer' }}>
                    <Typography variant="body2" color="onPrimaryContainer">
                      درس بعدی شما آماده است.
                    </Typography>
                  </Box>
                ) : null}

                {continueCard ? (
                  <>
                    <Typography
                      variant="headlineSmall"
                      sx={{ color: 'onPrimaryContainer', overflowWrap: 'anywhere' }}
                    >
                      {continueCard.lesson.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'onPrimaryContainer' }}>
                      {continueCard.lesson.topic.title}
                      {remainingMinutes !== null
                        ? ` — حدود ${remainingMinutes} دقیقه باقی‌مانده`
                        : ''}
                    </Typography>
                  </>
                ) : null}

                <Box>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PlayCircleRoundedIcon />}
                    data-testid="continue-cta"
                    onClick={() => navigate(`/lessons/${continueLearning.lessonId}`)}
                    sx={{
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': { backgroundColor: 'primary.dark' },
                    }}
                  >
                    {continueCard && isIncompleteContinue && continuePosition > 0
                      ? `ادامه از ${formatClock(continuePosition)}`
                      : 'شروع درس'}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* ---- 2. Progress summary: level + started + completed + percent ---- */}
        <Card data-testid="progress-card">
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <AutoStoriesRoundedIcon color="action" />
                <Typography component="h2" variant="titleMedium" sx={{ flex: 1 }}>
                  {DASHBOARD_PROGRESS}
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => navigate('/placement/result')}
                  sx={{ flexShrink: 0 }}
                >
                  {LEVEL_CHANGE}
                </Button>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    sm: 'repeat(4, minmax(0, 1fr))',
                  },
                  gap: 2,
                }}
              >
                <MetricCell label={LEVEL_SELECTED_LABEL} value={level || '—'} />
                <MetricCell label="شروع شده" value={`${prog.startedLessonCount}`} />
                <MetricCell label="کامل شده" value={`${prog.completedLessonCount}`} />
                <MetricCell label="پیشرفت" value={`${prog.completionPercent}٪`} />
              </Box>

              {prog.publishedLessonCount > 0 && (
                <Box>
                  <LinearProgress
                    variant="determinate"
                    value={prog.completionPercent}
                    aria-label={`پیشرفت کلی: ${prog.completionPercent} درصد`}
                    aria-valuetext={`${prog.completionPercent} از ۱۰۰ درصد`}
                    sx={{ borderRadius: '999px', height: 8 }}
                  />
                </Box>
              )}

              {prog.publishedLessonCount === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  هنوز درسی برای سطح شما منتشر نشده است.
                </Typography>
              ) : prog.startedLessonCount === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  هنوز درسی را شروع نکرده‌اید — اولین درس را از فهرست درس‌ها شروع کنید.
                </Typography>
              ) : null}

              <Box>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => navigate('/lessons')}
                  startIcon={<AutoStoriesRoundedIcon />}
                >
                  مشاهدهٔ درس‌ها
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* ---- 3. Subscription status ---- */}
        <Card data-testid="subscription-card">
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <WorkspacePremiumRoundedIcon color="success" />
                <Typography component="h2" variant="titleMedium" sx={{ flex: 1 }}>
                  {DASHBOARD_SUBSCRIPTION}
                </Typography>
                <Chip
                  label="فعال"
                  size="small"
                  icon={<WorkspacePremiumRoundedIcon />}
                  sx={{
                    backgroundColor: 'successContainer',
                    color: 'onSuccessContainer',
                    fontWeight: 600,
                  }}
                />
              </Stack>
              <Stack spacing={0.5}>
                {subscription.planName ? (
                  <Typography variant="body2">طرح: {subscription.planName}</Typography>
                ) : null}
                {subscription.expiresAt ? (
                  <Typography variant="body2">
                    تاریخ انقضا: {new Date(subscription.expiresAt).toLocaleDateString('fa-IR')}
                  </Typography>
                ) : null}
                <Typography variant="body2">
                  روزهای باقی‌مانده: {subscription.remainingDays}
                </Typography>
              </Stack>
              <Box>
                <Button size="small" variant="text" onClick={() => navigate('/account')}>
                  مشاهدهٔ جزئیات حساب
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        px: 1,
        py: 1.25,
        borderRadius: '12px',
        backgroundColor: 'surfaceContainerLow',
        minWidth: 0,
      }}
    >
      <Typography
        variant="numericMetric"
        sx={{ display: 'block', whiteSpace: 'nowrap', overflowWrap: 'normal' }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
    </Box>
  );
}
