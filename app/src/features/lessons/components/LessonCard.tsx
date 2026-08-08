// app/src/features/lessons/components/LessonCard.tsx
// Visual Slice 2 — one shared structure for every lesson card.
//
// States (never conveyed by color alone — each carries text + icon):
//   - not_started → «شروع درس»
//   - in_progress → «ادامه از HH:MM» (saved position, authoritative)
//   - completed   → «مرور مجدد» (completed lessons stay interactive)
//   - unavailable → clear explanation, NO fake CTA
//
// Rules honoured here:
//   - long Persian/English titles wrap (overflowWrap anywhere);
//   - metadata stays secondary; no excessive chips;
//   - progress bars carry accessible labels;
//   - the CTA stays reachable at 360px (44px+ target, full-width on xs).

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { Box, Button, Card, LinearProgress, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import type { CefrLevel } from '../../../../../shared/ui/tokens/cefr';
import { LevelBadge } from '../../../app/shell/LevelBadge';
import type { LessonProgressResponse } from '../../progress/types';
import type { LessonListItem } from '../types';

export type LessonCardStatus = 'not_started' | 'in_progress' | 'completed' | 'unavailable';

/**
 * Pure state derivation from real progress data. Completed wins, then any
 * saved position (in progress), otherwise not started. `unavailable` is
 * only ever passed explicitly by callers that know the lesson is not
 * playable — this function never fabricates it.
 */
export function lessonCardState(progress: LessonProgressResponse | undefined): {
  status: LessonCardStatus;
  position: number;
  percent: number;
} {
  if (progress?.completed) {
    return {
      status: 'completed',
      position: progress.furthestSeconds,
      percent: progress.percent,
    };
  }
  if (progress && progress.furthestSeconds > 0) {
    return {
      status: 'in_progress',
      position: progress.furthestSeconds,
      percent: progress.percent ?? 0,
    };
  }
  return { status: 'not_started', position: 0, percent: 0 };
}

export interface LessonCardProps {
  lesson: LessonListItem;
  status: LessonCardStatus;
  /** Saved position in seconds (in_progress only) — drives «ادامه از …». */
  positionSeconds?: number;
  /** 0..100 completion percent (in_progress/completed only). */
  percent?: number;
  /** Optional note for the unavailable state. */
  unavailableNote?: string;
  'data-testid'?: string;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const STATUS_TEXT: Record<LessonCardStatus, string> = {
  not_started: 'شروع نشده',
  in_progress: 'در حال یادگیری',
  completed: 'کامل شده',
  unavailable: 'در دسترس نیست',
};

export function LessonCard({
  lesson,
  status,
  positionSeconds = 0,
  percent = 0,
  unavailableNote,
  'data-testid': testId,
}: LessonCardProps) {
  const detailPath = `/lessons/${lesson.id}`;
  const durationText =
    lesson.audioDurationSeconds && lesson.audioDurationSeconds > 0
      ? formatClock(lesson.audioDurationSeconds)
      : `${lesson.estimatedMinutes} دقیقه`;

  return (
    <Card data-testid={testId ?? `lesson-card-${status}`}>
      <Stack spacing={1.5} sx={{ p: { xs: 2, sm: 2.5 } }}>
        {/* Metadata row: level badge + status (text, not color alone) */}
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}
        >
          <LevelBadge level={lesson.level as CefrLevel} size="sm" />
          <Typography
            variant="caption"
            component="span"
            data-testid="lesson-card-status"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              color: 'text.secondary',
              fontWeight: 600,
            }}
          >
            {status === 'completed' ? (
              <CheckCircleRoundedIcon fontSize="small" color="success" />
            ) : status === 'in_progress' ? (
              <PlayCircleOutlineRoundedIcon fontSize="small" color="primary" />
            ) : status === 'unavailable' ? (
              <LockRoundedIcon fontSize="small" />
            ) : null}
            {STATUS_TEXT[status]}
          </Typography>
        </Stack>

        {/* Title — a real link so completed lessons remain interactive. */}
        <Typography component="h3" variant="titleLarge" sx={{ overflowWrap: 'anywhere' }}>
          <RouterLink
            to={detailPath}
            data-testid="lesson-card-title"
            // The link fills the heading box so the whole title row is
            // clickable (same interaction as the previous card-wide hit area).
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            {lesson.title}
          </RouterLink>
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {lesson.summary}
        </Typography>

        {/* Meta row: topic (secondary) + duration */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {lesson.topicTitle}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.9 }}>
            {durationText}
          </Typography>
          {lesson.isPublicSample ? (
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              نمونه
            </Typography>
          ) : null}
        </Stack>

        {/* Progress bar with accessible label (in-progress/completed) */}
        {status === 'in_progress' || status === 'completed' ? (
          <Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, percent))}
              aria-label={`پیشرفت درس ${lesson.title}: ${Math.round(percent)} درصد`}
              sx={{ borderRadius: '999px', height: 6 }}
            />
          </Box>
        ) : null}

        {/* One appropriate action per state */}
        <Box sx={{ pt: 0.5 }}>
          {status === 'unavailable' ? (
            <Typography variant="caption" color="text.secondary">
              {unavailableNote ?? 'این درس فعلاً در دسترس نیست و به‌زودی فعال می‌شود.'}
            </Typography>
          ) : (
            <Button
              component={RouterLink}
              to={detailPath}
              variant={status === 'completed' ? 'outlined' : 'contained'}
              size="small"
              fullWidth={status !== 'completed'}
              startIcon={
                status === 'completed' ? (
                  <ReplayRoundedIcon />
                ) : status === 'in_progress' ? (
                  <PlayCircleOutlineRoundedIcon />
                ) : (
                  <PlayCircleOutlineRoundedIcon />
                )
              }
              data-testid="lesson-card-cta"
              sx={{ minHeight: 44 }}
            >
              {status === 'completed'
                ? 'مرور مجدد'
                : status === 'in_progress'
                  ? `ادامه از ${formatClock(positionSeconds)}`
                  : 'شروع درس'}
            </Button>
          )}
        </Box>
      </Stack>
    </Card>
  );
}
