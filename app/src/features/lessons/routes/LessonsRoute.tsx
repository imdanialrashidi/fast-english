// app/src/features/lessons/routes/LessonsRoute.tsx
// Visual Slice 2 — premium lesson list grouped by Topic, using the shared
// LessonCard structure (not_started / in_progress / completed states with
// real progress from the backend).

import { Box, Button, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { extractApiError } from '../../../../../shared/lib/apiError';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { LessonListSkeleton } from '../../../app/shell/PageSkeletons';
import { useAuth } from '../../../lib/auth';
import * as progressApi from '../../progress/api';
import type { LessonProgressResponse } from '../../progress/types';
import * as api from '../api';
import { LessonCard, lessonCardState } from '../components/LessonCard';
import type { LessonListItem } from '../types';

type Phase = 'loading' | 'ready' | 'error' | 'empty' | 'no_entitlement';

interface LessonWithProgress extends LessonListItem {
  progress?: LessonProgressResponse;
}

export function LessonsRoute() {
  const { user } = useAuth();
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
      const envelope = extractApiError(err);
      const code = envelope.code ?? '';
      if (code === 'subscription_required' || code === 'account_suspended') {
        setPhase('no_entitlement');
        setErrorInfo({
          title: 'دسترسی محدود',
          description: envelope.message || 'اشتراک فعالی ندارید.',
        });
      } else {
        setPhase('error');
        setErrorInfo({
          title: 'خطا در بارگذاری درس‌ها',
          description: envelope.message || 'خطایی رخ داد.',
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
        <LessonListSkeleton />
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
          description="برای سطح انتخابی شما هنوز درسی منتشر نشده است. به‌زودی درس‌های جدید اضافه می‌شوند."
          action={
            <Button variant="outlined" onClick={loadLessons}>
              بررسی دوباره
            </Button>
          }
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
            <Typography component="h2" variant="titleMedium" sx={{ mb: 1.5 }}>
              {topic.title}
            </Typography>
            <Stack spacing={1.5}>
              {topic.lessons.map((lesson) => {
                const { status, position, percent } = lessonCardState(lesson.progress);
                return (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    status={status}
                    positionSeconds={position}
                    percent={percent}
                  />
                );
              })}
            </Stack>
          </Box>
        ))}
      </Stack>
    </PageContainer>
  );
}
