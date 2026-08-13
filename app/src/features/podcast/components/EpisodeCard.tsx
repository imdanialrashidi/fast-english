// app/src/features/podcast/components/EpisodeCard.tsx
// Podcast Slice 5 — reusable Episode card foundation (Slice 6 builds the
// Library on top of this).
//
// Required content: Artwork, Category, Title, Level, Duration, progress
// state where relevant, one primary semantic action.
//
// Layouts (no style explosion — exactly two real usages):
//   - `auto`  (default): compact horizontal row on phones, standard
//     vertical card from md+ (used by Home sections);
//   - `row`   (explicit): always a horizontal row (used by the Library
//     placeholder list).
//
// States reuse the deterministic lessonCardState derivation:
//   not_started → «شروع گوشدادن», in_progress → «ادامه از HH:MM»,
//   completed → «مرور دوباره». Never conveyed by color alone; progress
//   bars carry accessible labels; titles wrap instead of truncating.

import { Box, Button, Card, LinearProgress, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import type { CefrLevel } from '../../../../../shared/ui/tokens/cefr';
import { productCopy } from '../../../app/copy/productCopy';
import { LevelBadge } from '../../../app/shell/LevelBadge';
import { lessonCardState } from '../../lessons/components/LessonCard';
import type { LessonListItem } from '../../lessons/types';
import type { LessonProgressResponse } from '../../progress/types';
import { EpisodeArtwork } from './EpisodeArtwork';

export type EpisodeCardLayout = 'auto' | 'row';

export interface EpisodeCardProps {
  lesson: LessonListItem;
  /** Real progress when the caller has it (Home hero/lesson lists). */
  progress?: LessonProgressResponse;
  layout?: EpisodeCardLayout;
  /**
   * Optional caption of the Episode's other published levels (e.g.
   * «سطح‌ها: A1 · B1 · C1»). Rendered only when provided.
   */
  availableLevelsCaption?: string | null;
  /**
   * Lazy loading policy for the artwork. First-viewport cards may pass
   * 'eager' so artwork is not deferred (default 'lazy').
   */
  artworkLoading?: 'lazy' | 'eager';
  'data-testid'?: string;
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Authoritative duration text; estimated minutes only as a legacy fallback. */
export function episodeDurationText(lesson: LessonListItem): string {
  if (lesson.audioDurationSeconds && lesson.audioDurationSeconds > 0) {
    return formatClock(lesson.audioDurationSeconds);
  }
  return `${lesson.estimatedMinutes} دقیقه`;
}

export function EpisodeCard({
  lesson,
  progress,
  layout = 'auto',
  availableLevelsCaption,
  artworkLoading = 'lazy',
  'data-testid': testId,
}: EpisodeCardProps) {
  const { status, position, percent } = lessonCardState(progress);
  const detailPath = `/lessons/${lesson.id}`;
  const episode = lesson.episode;
  const titleFa = episode?.titleFa?.trim();
  const primaryTitle = titleFa || lesson.title;
  const englishTitle = titleFa ? lesson.title : '';

  const ctaLabel =
    status === 'completed'
      ? productCopy.actions.reviewAgain
      : status === 'in_progress'
        ? productCopy.actions.continueFrom(formatClock(position))
        : productCopy.actions.startListening;

  return (
    <Card data-testid={testId ?? `episode-card-${lesson.id}`} sx={{ height: '100%' }}>
      <Stack
        spacing={1.5}
        sx={{
          p: { xs: 2, sm: 2.5 },
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        <EpisodeArtwork
          src={episode?.artwork}
          alt={primaryTitle || productCopy.episode.entity}
          loading={artworkLoading}
          sx={{ width: { xs: 88, md: layout === 'row' ? 96 : 148 }, aspectRatio: '1 / 1' }}
        />
        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          {episode?.category?.titleFa ? (
            <Typography
              variant="caption"
              color="primary"
              sx={{ fontWeight: 700, display: 'block', overflowWrap: 'anywhere' }}
            >
              {episode.category.titleFa}
            </Typography>
          ) : null}

          <Typography variant="titleMedium" sx={{ overflowWrap: 'anywhere' }}>
            <RouterLink
              to={detailPath}
              data-testid="episode-card-title"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              {primaryTitle}
            </RouterLink>
          </Typography>

          {englishTitle ? (
            <Typography
              lang="en"
              dir="ltr"
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'start', overflowWrap: 'anywhere' }}
            >
              {englishTitle}
            </Typography>
          ) : null}

          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
          >
            <LevelBadge level={lesson.level as CefrLevel} size="sm" showName={false} />
            <Typography variant="caption" color="text.secondary">
              {episodeDurationText(lesson)}
            </Typography>
            {availableLevelsCaption ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
                data-testid="episode-card-levels"
              >
                {availableLevelsCaption}
              </Typography>
            ) : null}
          </Stack>

          {status === 'in_progress' || status === 'completed' ? (
            <Box sx={{ maxWidth: '100%' }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, percent))}
                aria-label={`پیشرفت ${primaryTitle}: ${Math.round(percent)} درصد`}
                sx={{ width: '100%' }}
              />
            </Box>
          ) : null}

          <Box sx={{ pt: 0.5 }}>
            <Button
              component={RouterLink}
              to={detailPath}
              variant={status === 'completed' ? 'outlined' : 'contained'}
              size="medium"
              fullWidth
              data-testid="episode-card-cta"
              sx={{ minHeight: 44 }}
            >
              {ctaLabel}
            </Button>
          </Box>
        </Stack>
      </Stack>
    </Card>
  );
}
