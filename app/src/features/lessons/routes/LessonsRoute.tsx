// app/src/features/lessons/routes/LessonsRoute.tsx
// P3-S2 — Premium lesson list. Shows published lessons grouped by Topic
// with progress indicators.

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LibraryMusicRoundedIcon from '@mui/icons-material/LibraryMusicRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
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
import * as progressApi from '../../progress/api';
import type { LessonProgressResponse } from '../../progress/types';
import * as api from '../api';
import type { LessonListItem } from '../types';

type Phase = 'loading' | 'ready' | 'error' | 'empty' | 'no_entitlement';

interface LessonWithProgress extends LessonListItem {
  progress?: LessonProgressResponse;
}

export function LessonsRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [lessons, setLessons] = useState<LessonWithProgress[]>([]);
  const [errorInfo, setErrorInfo] = useState<{
    title: string;
    description: string;
    retry?: boolean;
  } | null>(null);

  const loadLessons = useCallback(async () => {
    setPhase('loading');
    setErrorInfo(null);
    try {
      const data = await api.getLessonList();
      if (data.lessons.length === 0) {
        setPhase('empty');
        return;
      }
      setLessons(data.lessons);

      // Load progress for all lessons (fire-and-forget — errors are non-fatal)
      try {
        const progressPromises = data.lessons.map((l) =>
          progressApi.getLessonProgress(l.id).catch(() => null),
        );
        const progressResults = await Promise.all(progressPromises);
        const merged: LessonWithProgress[] = data.lessons.map((l, i) => ({
          ...l,
          progress: progressResults[i] ?? undefined,
        }));
        setLessons(merged);
      } catch {
        // Progress load failure is non-fatal; lessons still display
      }

      setPhase('ready');
    } catch (err) {
      const errObj = err as { status?: number; data?: { code?: string; message?: string } };
      const code = errObj?.data?.code ?? '';
      if (code === 'subscription_required' || code === 'account_suspended') {
        setPhase('no_entitlement');
        setErrorInfo({
          title: 'دسترسی محدود',
          description: errObj?.data?.message || 'اشتراک فعالی ندارید.',
        });
      } else {
        setPhase('error');
        setErrorInfo({
          title: 'خطا در بارگذاری درس‌ها',
          description: errObj?.data?.message || 'خطایی رخ داد.',
          retry: true,
        });
      }
    }
  }, []);

  useEffect(() => {
    void loadLessons();
  }, [loadLessons]);

  if (phase === 'loading') {
    return (
      <PageContainer>
        <StatePanel variant="loading" title="در حال بارگذاری درس‌ها…" />
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
            errorInfo?.retry ? (
              <Button variant="outlined" onClick={loadLessons}>
                تلاش مجدد
              </Button>
            ) : undefined
          }
        />
      </PageContainer>
    );
  }

  if (phase === 'no_entitlement') {
    return (
      <PageContainer>
        <StatePanel
          variant="permission"
          title={errorInfo?.title || 'دسترسی محدود'}
          description={errorInfo?.description}
        />
      </PageContainer>
    );
  }

  if (phase === 'empty') {
    return (
      <PageContainer>
        <PageHeader title="درس‌ها" subtitle="هنوز درسی منتشر نشده است." />
        <StatePanel
          variant="empty"
          title="درسی یافت نشد"
          description="برای سطح انتخابی شما هنوز درسی منتشر نشده است."
        />
      </PageContainer>
    );
  }

  // Group lessons by topic
  const topicMap = new Map<
    string,
    { title: string; slug: string; lessons: LessonWithProgress[] }
  >();
  for (const lesson of lessons) {
    const key = lesson.topicId;
    if (!topicMap.has(key)) {
      topicMap.set(key, {
        title: lesson.topicTitle || 'بدون موضوع',
        slug: lesson.topicSlug,
        lessons: [],
      });
    }
    const t = topicMap.get(key);
    if (t) {
      t.lessons.push(lesson);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="درس‌ها"
        subtitle={
          user?.selected_level
            ? `سطح ${user.selected_level} — ${lessons.length} درس`
            : `${lessons.length} درس`
        }
      />

      <Stack spacing={3}>
        {Array.from(topicMap.entries()).map(([topicId, topic]) => (
          <Box key={topicId}>
            <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600 }}>
              {topic.title}
            </Typography>
            <Stack spacing={1.5}>
              {topic.lessons.map((lesson) => {
                const p = lesson.progress;
                const isCompleted = p?.completed ?? false;
                const percent = p?.percent ?? 0;
                const hasProgress = (p?.furthestSeconds ?? 0) > 0;

                return (
                  <Card key={lesson.id} variant="outlined">
                    <CardActionArea
                      onClick={() => navigate(`/lessons/${lesson.id}`)}
                      sx={{ height: '100%' }}
                    >
                      <CardContent>
                        <Stack spacing={1}>
                          <Stack
                            spacing={1}
                            sx={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                            }}
                          >
                            <Typography
                              variant="h6"
                              sx={{ fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}
                            >
                              {lesson.title}
                            </Typography>
                            <Stack
                              direction="row"
                              spacing={0.5}
                              sx={{ flexWrap: 'wrap', minWidth: 0 }}
                            >
                              {isCompleted && (
                                <Chip
                                  icon={<CheckCircleRoundedIcon />}
                                  label="کامل"
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                />
                              )}
                              {hasProgress && !isCompleted && (
                                <Chip
                                  icon={<PlayCircleOutlineRoundedIcon />}
                                  label={`${percent}%`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              )}
                              {lesson.isPublicSample && (
                                <Chip
                                  icon={<LibraryMusicRoundedIcon />}
                                  label="نمونه"
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              )}
                              <Chip
                                label={lesson.level}
                                size="small"
                                variant="outlined"
                                color="default"
                              />
                            </Stack>
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {lesson.summary}
                          </Typography>
                          <Stack
                            direction="row"
                            sx={{
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {lesson.estimatedMinutes} دقیقه
                            </Typography>
                            {hasProgress && !isCompleted && (
                              <Box sx={{ width: '40%' }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={percent}
                                  sx={{ borderRadius: 1, height: 4 }}
                                />
                              </Box>
                            )}
                          </Stack>
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Stack>
    </PageContainer>
  );
}
