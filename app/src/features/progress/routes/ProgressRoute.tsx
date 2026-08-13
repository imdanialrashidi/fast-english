// app/src/features/progress/routes/ProgressRoute.tsx
// Podcast Slice 5 — Progress route foundation.
//
// Level-aware presentation of the real progress summary (started /
// completed / completion percent at the preferred level only — the server
// never aggregates cross-level activity). No new analytics; the full
// Progress experience beyond this summary is a later slice.

import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getRecommendedLevel } from '../../../../../shared/podcast/domain';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import type { CefrLevel } from '../../../../../shared/ui/tokens/cefr';
import { layout } from '../../../../../shared/ui/tokens/spacing';
import { productCopy } from '../../../app/copy/productCopy';
import { LevelBadge } from '../../../app/shell/LevelBadge';
import { useAuth } from '../../../lib/auth';
import * as progressApi from '../api';
import type { ProgressSummaryResponse } from '../types';

type Phase = 'loading' | 'ready' | 'error';

export function ProgressRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [summary, setSummary] = useState<ProgressSummaryResponse | null>(null);

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      setSummary(await progressApi.getProgressSummary());
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase === 'loading') {
    return (
      <PageContainer maxWidth="lg">
        <Box component="header" sx={{ mb: 3 }}>
          <Typography component="h1" variant="h2">
            {productCopy.sections.progress}
          </Typography>
        </Box>
        <Stack spacing={1.5}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              data-testid="progress-line-skeleton"
              sx={{ height: 18, borderRadius: '10px', backgroundColor: 'surfaceContainerHighest' }}
            />
          ))}
        </Stack>
      </PageContainer>
    );
  }

  if (phase === 'error' || !summary) {
    return (
      <PageContainer maxWidth="lg">
        <Box component="header" sx={{ mb: 3 }}>
          <Typography component="h1" variant="h2">
            {productCopy.sections.progress}
          </Typography>
        </Box>
        <StatePanel
          variant="error"
          title={productCopy.errors.progressFailed}
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

  const recommended = user ? getRecommendedLevel(user) : '';
  const showRecommended = recommended && recommended !== summary.selectedLevel;

  return (
    <PageContainer maxWidth="lg">
      <Box component="header" sx={{ mb: { xs: 4, sm: 5 } }}>
        <Typography component="h1" variant="h2">
          {productCopy.sections.progress}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          {summary.publishedLessonCount > 0
            ? `اپیزودهای سطح ${summary.selectedLevel}`
            : 'پیشرفت شنیداری تو'}
        </Typography>
      </Box>

      <Stack spacing={2}>
        <Box
          data-testid="progress-summary-card"
          sx={{
            px: { xs: 2, sm: 3 },
            py: {
              xs: `${layout.cardPaddingCompact}px`,
              sm: `${layout.cardPaddingComfortable}px`,
            },
            borderRadius: '16px',
            border: '1px solid',
            borderColor: 'outlineVariant',
            backgroundColor: 'surfaceContainerLow',
          }}
        >
          <Stack spacing={1.5}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
            >
              <Typography variant="body2" color="text.secondary">
                {productCopy.levels.preferred}:
              </Typography>
              <LevelBadge
                level={(summary.selectedLevel as CefrLevel) || 'A1'}
                size="sm"
                showName={false}
              />
            </Stack>

            {showRecommended ? (
              <Typography variant="body2" color="text.secondary">
                {productCopy.levels.recommended}: {recommended} — {productCopy.levels.browsing}:{' '}
                {summary.selectedLevel}
              </Typography>
            ) : null}

            {summary.publishedLessonCount > 0 ? (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, minmax(0, 1fr))',
                      sm: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: 2,
                  }}
                >
                  <StatCell label="اپیزودهای شروع‌شده" value={`${summary.startedLessonCount}`} />
                  <StatCell
                    label="اپیزودهای کامل‌شده"
                    value={`${summary.completedLessonCount} از ${summary.publishedLessonCount}`}
                  />
                  <StatCell label="پیشرفت" value={`${summary.completionPercent}٪`} />
                </Box>
                <Box>
                  <LinearProgress
                    variant="determinate"
                    value={summary.completionPercent}
                    aria-label={`پیشرفت کلی: ${summary.completionPercent} درصد`}
                    aria-valuetext={`${summary.completionPercent} از ۱۰۰ درصد`}
                  />
                </Box>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {productCopy.empty.noEpisodesForLevel}
              </Typography>
            )}
          </Stack>
        </Box>

        <Box>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => navigate('/lessons')}
            data-testid="progress-to-episodes"
          >
            {productCopy.actions.goToEpisodes}
          </Button>
        </Box>
      </Stack>
    </PageContainer>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="numericMetric"
        sx={{ display: 'block', whiteSpace: 'nowrap', overflowWrap: 'normal' }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', overflowWrap: 'anywhere' }}
      >
        {label}
      </Typography>
    </Box>
  );
}
