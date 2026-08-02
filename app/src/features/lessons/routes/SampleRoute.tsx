// app/src/features/lessons/routes/SampleRoute.tsx
// P3-S1 — Public sample lesson. Accessible without authentication.
// Shows a sample lesson and plays its public audio.

import { Box, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { LevelBadge } from '../../../app/shell/LevelBadge';
import { PageContainer } from '../../../app/shell/PageContainer';
import { PageHeader } from '../../../app/shell/PageHeader';
import { StatePanel } from '../../../app/shell/StatePanel';
import type { CefrLevel } from '../../../app/theme/tokens/cefr';
import * as api from '../api';
import type { AudioDescriptor } from '../types';

type Phase = 'loading' | 'ready' | 'unavailable' | 'error';

export function SampleRoute() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [lesson, setLesson] = useState<{
    id: string;
    topic: { id: string; title: string; slug: string };
    title: string;
    level: string;
    summary: string;
    body: string;
    estimatedMinutes: number;
    audio: AudioDescriptor;
  } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const loadSample = useCallback(async () => {
    setPhase('loading');
    try {
      const data = await api.getPublicSample();
      if (data.kind === 'sample_unavailable' || !data.lesson) {
        setPhase('unavailable');
        return;
      }
      setLesson(data.lesson);
      setPhase('ready');
      // Audio URL from server response (no token needed for public sample).
      // The server sends a root-relative path; resolve it against the SDK
      // origin so native builds do not resolve against the WebView origin.
      setAudioUrl(api.resolveMediaUrl(data.lesson.audio.url));
    } catch {
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    void loadSample();
  }, [loadSample]);

  if (phase === 'loading') {
    return (
      <PageContainer>
        <StatePanel variant="loading" title="در حال بارگذاری نمونهٔ درس…" />
      </PageContainer>
    );
  }

  if (phase === 'unavailable') {
    return (
      <PageContainer>
        <StatePanel
          variant="empty"
          title="نمونه درسی موجود نیست"
          description="هنوز نمونه درسی منتشر نشده است."
        />
      </PageContainer>
    );
  }

  if (phase === 'error' || !lesson) {
    return (
      <PageContainer>
        <StatePanel variant="error" title="خطا" description="بارگذاری نمونهٔ درس با خطا مواجه شد." />
      </PageContainer>
    );
  }

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
              sx={{ borderRadius: '16px' }}
            />
            <Typography variant="caption" color="text.secondary">
              {lesson.estimatedMinutes} دقیقه
            </Typography>
          </Stack>
        }
      />

      {/* Audio player */}
      {audioUrl && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <audio
              controls
              preload="metadata"
              style={{ width: '100%' }}
              aria-label="پخش صوت نمونه درس"
            >
              <source src={audioUrl} type={lesson.audio.contentType} />
              <track kind="captions" />
              مرورگر شما از پخش صوت پشتیبانی نمی‌کند.
            </audio>
          </CardContent>
        </Card>
      )}

      <Divider sx={{ my: 3 }} />

      {/* English body sample */}
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
