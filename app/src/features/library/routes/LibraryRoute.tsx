// app/src/features/library/routes/LibraryRoute.tsx
// Podcast Slice 5 — transitional Library route.
//
// The full Library (categories, search, filters) belongs to Slice 6; this
// route exists so the final navigation architecture is real today. It
// shows a small set of real recently-published Episodes from the existing
// API and states the honest transitional state — real content is shown, so
// no «coming soon» placeholder.

import { Box, Button, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { productCopy } from '../../../app/copy/productCopy';
import { LessonListSkeleton } from '../../../app/shell/PageSkeletons';
import * as lessonsApi from '../../lessons/api';
import type { LessonListItem } from '../../lessons/types';
import { EpisodeCard } from '../../podcast/components/EpisodeCard';

type Phase = 'loading' | 'ready' | 'error' | 'empty';

export function LibraryRoute() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [episodes, setEpisodes] = useState<LessonListItem[]>([]);
  const [level, setLevel] = useState('');

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const data = await lessonsApi.getLessonList(1, 50);
      setEpisodes(data.lessons);
      setLevel(data.preferredLevel ?? '');
      setPhase(data.lessons.length === 0 ? 'empty' : 'ready');
    } catch {
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase === 'loading') {
    return (
      <PageContainer maxWidth="md">
        <LessonListSkeleton />
      </PageContainer>
    );
  }

  if (phase === 'error') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel
          variant="error"
          title={productCopy.errors.episodesFailed}
          description={productCopy.errors.checkConnection}
          action={
            <Button variant="outlined" onClick={load}>
              {productCopy.actions.retry}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (phase === 'empty') {
    return (
      <PageContainer maxWidth="md">
        <PageHeader title={productCopy.nav.library} subtitle={level ? `سطح ${level}` : undefined} />
        <StatePanel
          variant="empty"
          title="هنوز اپیزودی منتشر نشده است"
          description={productCopy.empty.noEpisodesForLevel}
          action={
            <Button variant="outlined" onClick={() => navigate('/')}>
              بازگشت به صفحهٔ اصلی
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="md">
      <Box component="header" sx={{ mb: 3 }}>
        <Typography component="h1" variant="h2">
          {productCopy.nav.library}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          اپیزودهای سطح {level} بر اساس تازگی.
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          component="span"
          sx={{ display: 'block', mt: 0.5 }}
        >
          دسته‌بندی و جستجو در نسخه‌های بعدی اضافه می‌شوند.
        </Typography>
      </Box>
      <Stack spacing={1.5}>
        {episodes.map((lesson) => (
          <EpisodeCard key={lesson.id} lesson={lesson} layout="row" />
        ))}
      </Stack>
    </PageContainer>
  );
}
