// app/src/features/lessons/routes/LessonDetailRoute.tsx
// P3-S2 — Premium lesson detail with Audio Player and progress persistence.
// Shows the English body and premium audio with save/resume support.

import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LevelBadge } from '../../../app/shell/LevelBadge';
import { PageContainer } from '../../../app/shell/PageContainer';
import { PageHeader } from '../../../app/shell/PageHeader';
import { StatePanel } from '../../../app/shell/StatePanel';
import type { CefrLevel } from '../../../app/theme/tokens';
import { AudioPlayer } from '../../player';
import * as progressApi from '../../progress/api';
import { useProgressSave } from '../../progress/useProgressSave';
import type { LessonProgressResponse } from '../../progress/types';
import * as api from '../api';
import type { LessonDetailResponse } from '../types';

type Phase = 'loading' | 'ready' | 'error' | 'no_entitlement' | 'not_found' | 'resume_required';

const RESUME_THRESHOLD = 5; // seconds — show resume prompt if position >= this

export function LessonDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [lesson, setLesson] = useState<LessonDetailResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{
    title: string;
    description: string;
    retry?: boolean;
  } | null>(null);
  const [progress, setProgress] = useState<LessonProgressResponse | null>(null);
  const [completed, setCompleted] = useState(false);

  const { handleTimeUpdate, handleSeek, handleEnded } = useProgressSave({
    lessonId: id,
    enabled: !!id && !!audioUrl && !audioError,
    onSaved: (p) => {
      setProgress(p);
      setCompleted(p.completed);
    },
    onStaleRevision: (p) => {
      setProgress(p);
      setCompleted(p.completed);
    },
  });

  const buildAudioUrl = useCallback(async (audioUrl: string) => {
    try {
      const url = await api.buildProtectedAudioUrl(audioUrl);
      setAudioUrl(url);
      setAudioError(false);
    } catch {
      setAudioError(true);
    }
  }, []);

  const loadLesson = useCallback(async () => {
    if (!id) {
      setPhase('not_found');
      return;
    }
    setPhase('loading');
    setErrorInfo(null);
    setAudioError(false);
    setAudioUrl(null);
    setCompleted(false);
    setProgress(null);
    try {
      const data = await api.getLessonDetail(id);
      setLesson(data);
      setPhase('ready');

      // Load progress
      try {
        const prog = await progressApi.getLessonProgress(id);
        setProgress(prog);
        setCompleted(prog.completed);

        // Show resume prompt if position is meaningful and lesson not completed
        if (!prog.completed && prog.positionSeconds >= RESUME_THRESHOLD) {
          setPhase('resume_required');
        }
      } catch {
        // Progress load failure is non-fatal
      }

      // Build audio URL asynchronously with file token
      if (data.audio?.url) {
        void buildAudioUrl(data.audio.url);
      }
    } catch (err) {
      const errObj = err as { status?: number; data?: { code?: string; message?: string } };
      const code = errObj?.data?.code ?? '';
      const status = errObj?.status ?? 0;
      if (status === 404) {
        setPhase('not_found');
        setErrorInfo({
          title: 'درس یافت نشد',
          description: 'این درس وجود ندارد یا در دسترس نیست.',
        });
      } else if (
        code === 'subscription_required' ||
        code === 'account_suspended' ||
        code === 'access_denied'
      ) {
        setPhase('no_entitlement');
        setErrorInfo({
          title: 'دسترسی محدود',
          description: 'شما دسترسی به این درس را ندارید.',
        });
      } else {
        setPhase('error');
        setErrorInfo({
          title: 'خطا در بارگذاری درس',
          description: errObj?.data?.message || 'خطایی رخ داد.',
          retry: true,
        });
      }
    }
  }, [id, buildAudioUrl]);

  useEffect(() => {
    void loadLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Resume from saved position
  const handleResume = useCallback(() => {
    setPhase('ready');
  }, []);

  // Start from beginning
  const handleStartFromBeginning = useCallback(() => {
    setPhase('ready');
  }, []);

  const handleRetry = useCallback(() => {
    setAudioError(false);
    if (lesson?.audio?.url) {
      void buildAudioUrl(lesson.audio.url);
    }
  }, [lesson, buildAudioUrl]);

  // Override the player's onTimeUpdate to also save
  const onPlayerTimeUpdate = useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      handleTimeUpdate(positionSeconds, durationSeconds);
    },
    [handleTimeUpdate],
  );

  const onPlayerEnded = useCallback(() => {
    handleEnded();
  }, [handleEnded]);

  const onPlayerSeek = useCallback(
    (positionSeconds: number) => {
      handleSeek(positionSeconds);
    },
    [handleSeek],
  );

  if (phase === 'loading') {
    return (
      <PageContainer>
        <StatePanel variant="loading" title="در حال بارگذاری درس…" />
      </PageContainer>
    );
  }

  if (phase === 'error') {
    return (
      <PageContainer>
        <StatePanel
          variant="error"
          title={errorInfo?.title || 'خطا'}
          description={errorInfo?.description}
          action={
            <Stack direction="row" spacing={1}>
              {errorInfo?.retry && (
                <Button variant="outlined" onClick={loadLesson}>
                  تلاش مجدد
                </Button>
              )}
              <Button variant="text" onClick={() => navigate('/lessons')}>
                بازگشت به فهرست
              </Button>
            </Stack>
          }
        />
      </PageContainer>
    );
  }

  if (phase === 'no_entitlement' || phase === 'not_found') {
    return (
      <PageContainer>
        <StatePanel
          variant="permission"
          title={errorInfo?.title || 'دسترسی محدود'}
          description={errorInfo?.description}
          action={
            <Button variant="text" onClick={() => navigate('/lessons')}>
              بازگشت به فهرست
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (!lesson) return null;

  return (
    <PageContainer maxWidth="md">
      <PageHeader
        title={lesson.title}
        subtitle={
          <Stack
            spacing={1.5}
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              pt: 0.5,
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <LevelBadge level={lesson.level as CefrLevel} size="sm" />
            <Chip
              size="small"
              label={lesson.topic.title}
              variant="outlined"
              sx={{ borderRadius: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              {lesson.estimatedMinutes} دقیقه
            </Typography>
            {progress && (
              <Chip
                size="small"
                label={`${progress.percent}%`}
                color={completed ? 'success' : 'default'}
                variant="outlined"
              />
            )}
          </Stack>
        }
      />

      {/* Resume prompt */}
      {phase === 'resume_required' && progress && !completed && (
        <Card sx={{ mb: 3, bgcolor: 'action.hover' }}>
          <CardContent>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              پیشرفت شما تا {formatTime(progress.positionSeconds)} ذخیره شده است. از کجا می‌خواهید
              ادامه دهید؟
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" onClick={handleResume}>
                ادامه از {formatTime(progress.positionSeconds)}
              </Button>
              <Button variant="outlined" size="small" onClick={handleStartFromBeginning}>
                شروع از اول
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Audio Player */}
      {audioUrl && !audioError && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ pb: '12px !important' }}>
            <AudioPlayer
              src={audioUrl}
              contentType={lesson?.audio.contentType}
              onTimeUpdate={onPlayerTimeUpdate}
              onEnded={onPlayerEnded}
              onSeek={onPlayerSeek}
              completed={completed}
              showCompleted
              onRetry={handleRetry}
            />
          </CardContent>
        </Card>
      )}

      {audioError && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="body2" color="error">
              خطا در دریافت فایل صوتی. لطفاً دوباره تلاش کنید.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              sx={{ mt: 1 }}
              onClick={() => {
                setAudioError(false);
                if (lesson?.audio?.url) {
                  void buildAudioUrl(lesson.audio.url);
                }
              }}
            >
              تلاش مجدد برای دریافت صوت
            </Button>
          </CardContent>
        </Card>
      )}

      <Divider sx={{ my: 3 }} />

      {/* English body */}
      <Box
        component="article"
        lang="en"
        dir="ltr"
        sx={{
          maxWidth: '38rem',
          mx: 'auto',
        }}
      >
        <Typography
          component="h1"
          variant="h3"
          sx={{ mb: 2, textAlign: 'start', fontFamily: 'inherit' }}
        >
          {lesson.title}
        </Typography>
        <Typography
          variant="body1"
          sx={{ textAlign: 'start', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}
        >
          {lesson.body}
        </Typography>
      </Box>
    </PageContainer>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
