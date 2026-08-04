// app/src/features/lessons/routes/LessonDetailRoute.tsx
// Visual Slice 2 — focused reading and listening environment.
//
// Required order: contextual back action (Top App Bar) → topic/level
// metadata → lesson title → Audio Player → progress/resume state → English
// lesson content. One H1 per route (the PageHeader); the English article
// heading is an H2. The article is LTR with a bounded measure and the
// `englishReading` typography. On md+ the Player stays sticky within safe
// bounds; while the article is being read the metadata row quiets down
// (presentation-only). No fixed element ever covers text.

import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LevelBadge } from '../../../app/shell/LevelBadge';
import { PageContainer } from '../../../app/shell/PageContainer';
import { PageHeader } from '../../../app/shell/PageHeader';
import { LessonDetailSkeleton } from '../../../app/shell/PageSkeletons';
import { StatePanel } from '../../../app/shell/StatePanel';
import { duration, easing, layout } from '../../../app/theme/tokens';
import type { CefrLevel } from '../../../app/theme/tokens/cefr';
import { AudioPlayer } from '../../player';
import * as progressApi from '../../progress/api';
import type { LessonProgressResponse } from '../../progress/types';
import { useProgressSave } from '../../progress/useProgressSave';
import * as api from '../api';
import type { LessonDetailResponse } from '../types';

type Phase = 'loading' | 'ready' | 'error' | 'no_entitlement' | 'not_found' | 'resume_required';

const RESUME_THRESHOLD = 5; // seconds — show resume prompt if position >= this

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Split the English body into paragraphs on blank lines (punctuation kept). */
function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

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
  const [readingActive, setReadingActive] = useState(false);
  // Position the player should seek to when the user chooses to resume.
  const [resumePosition, setResumePosition] = useState<number | undefined>(undefined);
  const articleRef = useRef<HTMLElement | null>(null);

  const { handleTimeUpdate, handleSeek, handleEnded } = useProgressSave({
    lessonId: id,
    enabled: !!id && !!audioUrl && !audioError,
    // Feed the already-loaded progress into the hook so the first save uses
    // the authoritative revision (no guaranteed 409 for returning users).
    initialProgress: progress ?? undefined,
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
    setResumePosition(undefined);
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

  // Restrained focus behavior: while the English article is being read the
  // metadata row quiets down. Presentation-only; never hides actions.
  useEffect(() => {
    const el = articleRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setReadingActive(entry.isIntersecting);
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lesson?.id]);

  // Resume from saved position — the player seeks to the saved position once
  // the user confirms (the audio element may not have loaded metadata yet).
  const handleResume = useCallback(() => {
    if (progress) {
      setResumePosition(progress.positionSeconds);
    }
    setPhase('ready');
  }, [progress]);

  // Start from beginning
  const handleStartFromBeginning = useCallback(() => {
    setResumePosition(0);
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
        <LessonDetailSkeleton />
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

  const metaQuiet = readingActive ? 0.45 : 1;

  return (
    <PageContainer maxWidth="md">
      {/* Topic + level metadata + title (one H1 per route). */}
      <PageHeader
        title={lesson.title}
        subtitle={
          <Stack
            spacing={1.5}
            data-testid="lesson-meta"
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              pt: 0.5,
              gap: 1.5,
              flexWrap: 'wrap',
              transition: `opacity ${duration.durationFast}ms ${easing.easingStandard}`,
              opacity: metaQuiet,
            }}
          >
            <LevelBadge level={lesson.level as CefrLevel} size="sm" />
            <Chip
              size="small"
              label={lesson.topic.title}
              variant="outlined"
              sx={{ borderRadius: '16px' }}
            />
            <Typography variant="caption" color="text.secondary">
              {lesson.estimatedMinutes} دقیقه
            </Typography>
            {progress && (
              <Chip
                size="small"
                label={`${progress.percent}٪`}
                color={completed ? 'success' : 'default'}
                variant="outlined"
              />
            )}
          </Stack>
        }
      />

      {/* Resume prompt */}
      {phase === 'resume_required' && progress && !completed && (
        <Card sx={{ mb: 3, bgcolor: 'action.hover' }} data-testid="resume-prompt">
          <CardContent>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              پیشرفت شما تا {formatTime(progress.positionSeconds)} ذخیره شده است. از کجا می‌خواهید
              ادامه دهید؟
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleResume}
                sx={{ minHeight: 44 }}
              >
                ادامه از {formatTime(progress.positionSeconds)}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleStartFromBeginning}
                sx={{ minHeight: 44 }}
              >
                شروع از اول
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Audio Player — sticky within safe bounds on md+; in-flow on mobile
          so it can never cover the Bottom Navigation. */}
      {audioUrl && !audioError && (
        <Box
          data-testid="player-surface"
          sx={{
            mb: 3,
            position: { md: 'sticky' },
            top: { md: `calc(${layout.headerHeight.md}px + 16px)` },
          }}
        >
          <Card>
            <CardContent sx={{ pb: '12px !important' }}>
              <AudioPlayer
                src={audioUrl}
                contentType={lesson?.audio.contentType}
                onTimeUpdate={onPlayerTimeUpdate}
                onEnded={onPlayerEnded}
                onSeek={onPlayerSeek}
                completed={completed}
                showCompleted
                initialPosition={resumePosition}
                onRetry={handleRetry}
                session={{ lessonId: lesson.id, title: lesson.title }}
              />
            </CardContent>
          </Card>
        </Box>
      )}

      {audioError && (
        <Card sx={{ mb: 3 }} data-testid="audio-error-card">
          <CardContent>
            <Typography variant="body2" color="error" role="alert">
              خطا در دریافت فایل صوتی. لطفاً دوباره تلاش کنید.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              sx={{ mt: 1, minHeight: 44 }}
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

      {/* English body — LTR, bounded measure, comfortable line height. */}
      <Box
        component="article"
        ref={articleRef}
        lang="en"
        dir="ltr"
        data-testid="english-reading"
        sx={{
          maxWidth: layout.readingMaxWidth,
          mx: 'auto',
          width: '100%',
        }}
      >
        <Typography
          component="h2"
          variant="h3"
          sx={{ mb: 2.5, textAlign: 'start', fontFamily: 'inherit' }}
        >
          {lesson.title}
        </Typography>
        {splitParagraphs(lesson.body).map((paragraph, i) => (
          <Typography
            key={`${i}-${paragraph.slice(0, 24)}`}
            variant="englishReading"
            component="p"
            sx={{ mb: 3, textAlign: 'start' }}
          >
            {paragraph}
          </Typography>
        ))}
      </Box>
    </PageContainer>
  );
}
