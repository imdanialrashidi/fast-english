// app/src/features/home/routes/HomeRoute.tsx
// Podcast Slice 5 — Podcast-first Student Home.
//
// Answers, in order: 1) what should I listen to now? 2) what else is
// relevant? 3) how am I progressing? 4) is my account/subscription okay?
//
// No dense analytics dashboard: one dominant listening action, two calm
// Episode sections from real Published data, one compact progress panel,
// one quiet subscription line. All levels come from the authenticated
// Student profile / server responses; rendering never changes preferred or
// recommended levels (browsing elsewhere is read-only).

import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { Box, Button, Card, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getRecommendedLevel } from '../../../../../shared/podcast/domain';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { layout, radius } from '../../../../../shared/ui/tokens';
import type { CefrLevel } from '../../../../../shared/ui/tokens/cefr';
import { productCopy } from '../../../app/copy/productCopy';
import { LevelBadge } from '../../../app/shell/LevelBadge';
import { HomeSkeleton } from '../../../app/shell/PageSkeletons';
import { useAuth } from '../../../lib/auth';
import type { LessonListItem } from '../../lessons/types';
import { ContentSection } from '../../podcast/components/ContentSection';
import { EpisodeArtwork } from '../../podcast/components/EpisodeArtwork';
import { EpisodeCard, formatClock } from '../../podcast/components/EpisodeCard';
import type { ContinueLessonProgress } from '../../progress/types';
import { type HomeData, loadHomeData } from '../api';
import { deriveHeroState, deriveSections } from '../logic';

type Phase = 'loading' | 'ready' | 'error';

function greetingFor(name: string): string {
  const trimmed = name.trim();
  return trimmed ? `سلام ${trimmed}` : 'سلام';
}

export function HomeRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<HomeData | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);

  const load = useCallback(async () => {
    setPhase('loading');
    setSummaryFailed(false);
    try {
      const recommended = user ? getRecommendedLevel(user) : '';
      const result = await loadHomeData(recommended);
      setData(result.data);
      setSummaryFailed(result.summaryFailed);
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase === 'loading') {
    return (
      <PageContainer maxWidth="lg">
        <HomeSkeleton />
      </PageContainer>
    );
  }

  if (phase === 'error' || !data) {
    return (
      <PageContainer maxWidth="lg">
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

  const hero = deriveHeroState(data);
  const { recommended, latest } = deriveSections(data.episodes);

  return (
    <PageContainer maxWidth="lg">
      <Box component="header" sx={{ mb: { xs: 4, sm: 5 } }}>
        <Typography component="h1" variant="h2" sx={{ overflowWrap: 'anywhere' }}>
          {greetingFor(user?.name ?? '')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          شنیدن بعدی‌ات را از همین‌جا ادامه بده.
        </Typography>
      </Box>

      <Stack spacing={{ xs: layout.sectionGap.xs, sm: layout.sectionGap.sm }}>
        {/* ---- 1. What should I listen to now? ---- */}
        {hero.kind === 'continue' && hero.item ? (
          <ContinueHero
            item={hero.item}
            onOpen={() => navigate(`/lessons/${hero.item?.lesson.id ?? ''}`)}
          />
        ) : hero.kind === 'first_use' ? (
          <FirstUsePanel
            hasEpisodes={hero.hasEpisodes}
            level={data.preferredLevel}
            onFindEpisode={() => navigate('/library')}
          />
        ) : hero.kind === 'all_completed' ? (
          <CompletedPanel onOpenLibrary={() => navigate('/library')} />
        ) : (
          <UnavailablePanel onOpenLibrary={() => navigate('/library')} />
        )}

        {/* ---- 2. What else is relevant to me? ---- */}
        {recommended.length > 0 ? (
          <ContentSection title={productCopy.sections.recommended} data-testid="home-recommended">
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  // Two columns keep a single real Episode from becoming a
                  // tiny card stranded beside a large desktop void.
                  lg: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 2,
              }}
            >
              {recommended.map((lesson) => (
                <EpisodeCard key={lesson.id} lesson={lesson} />
              ))}
            </Box>
          </ContentSection>
        ) : null}

        {/* ---- 3. New Episodes (real published_at, no fake analytics) ---- */}
        {latest.length > 0 ? (
          <ContentSection title={productCopy.sections.latest} data-testid="home-latest">
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  // Keep the same rhythm as the preferred-level section.
                  lg: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 2,
              }}
            >
              {latest.map((lesson) => (
                <EpisodeCard key={lesson.id} lesson={lesson} />
              ))}
            </Box>
          </ContentSection>
        ) : null}

        {/* ---- 4. How am I progressing? ---- */}
        <ProgressPanel
          data={data}
          summaryFailed={summaryFailed}
          onRetry={load}
          onOpenProgress={() => navigate('/progress')}
        />

        {/* ---- 5. Is my account/subscription okay? (compact, quiet) ---- */}
        {data.subscription ? <SubscriptionLine subscription={data.subscription} /> : null}
      </Stack>
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------
// Continue Listening hero — dominant when real resumable progress exists.
// ---------------------------------------------------------------------------

function ContinueHero({
  item,
  onOpen,
}: {
  item: { lesson: LessonListItem; progress: ContinueLessonProgress };
  onOpen: () => void;
}) {
  const { lesson, progress } = item;
  const episode = lesson.episode;
  const titleFa = episode?.titleFa?.trim();
  const title = titleFa || lesson.title;
  const position = progress.positionSeconds ?? 0;
  const percent = Math.min(100, Math.max(0, progress.percent ?? 0));

  return (
    <Card
      data-testid="home-continue"
      sx={{
        border: 'none',
        borderRadius: `${radius.radiusHero}px`,
        backgroundColor: 'primaryContainer',
        borderInlineStart: '4px solid',
        borderInlineStartColor: 'primary.main',
      }}
    >
      <Stack
        spacing={2}
        sx={{
          p: {
            xs: `${layout.cardPaddingComfortable}px`,
            sm: `${layout.cardPaddingComfortable + 8}px`,
          },
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <PlayCircleRoundedIcon sx={{ color: 'onPrimaryContainer' }} />
          <Typography
            component="h2"
            variant="titleMedium"
            sx={{ color: 'onPrimaryContainer', fontWeight: 700 }}
          >
            {productCopy.sections.continueListening}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <EpisodeArtwork
            src={episode?.artwork}
            alt={title || productCopy.episode.entity}
            sx={{ width: { xs: 104, sm: 144 }, borderRadius: `${radius.radiusCard}px` }}
            data-testid="continue-artwork"
          />
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            {episode?.category?.titleFa ? (
              <Typography
                variant="caption"
                sx={{
                  color: 'onPrimaryContainer',
                  fontWeight: 700,
                  display: 'block',
                  overflowWrap: 'anywhere',
                }}
              >
                {episode.category.titleFa}
              </Typography>
            ) : null}
            <Typography
              variant="headlineSmall"
              sx={{ color: 'onPrimaryContainer', overflowWrap: 'anywhere' }}
            >
              {title}
            </Typography>
            {titleFa && lesson.title ? (
              <Typography
                lang="en"
                dir="ltr"
                variant="caption"
                sx={{
                  color: 'onPrimaryContainer',
                  display: 'block',
                  textAlign: 'start',
                  overflowWrap: 'anywhere',
                }}
              >
                {lesson.title}
              </Typography>
            ) : null}
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
            >
              <LevelBadge level={lesson.level as CefrLevel} size="sm" showName={false} />
              <Typography variant="caption" sx={{ color: 'onPrimaryContainer' }}>
                {lesson.audioDurationSeconds && lesson.audioDurationSeconds > 0
                  ? formatClock(lesson.audioDurationSeconds)
                  : formatClock(progress.durationSeconds ?? 0)}
              </Typography>
            </Stack>
          </Stack>
        </Stack>

        <Box>
          <LinearProgress
            variant="determinate"
            value={percent}
            aria-label={`پیشرفت ${title}: ${Math.round(percent)} درصد`}
            sx={{
              backgroundColor:
                'color-mix(in srgb, var(--mui-palette-onPrimaryContainer) 25%, transparent)',
              '& .MuiLinearProgress-bar': { backgroundColor: 'onPrimaryContainer' },
            }}
          />
        </Box>

        <Box>
          <Button
            variant="contained"
            size="large"
            fullWidth
            data-testid="continue-cta"
            onClick={onOpen}
            startIcon={<PlayCircleRoundedIcon />}
          >
            {position > 0
              ? productCopy.actions.continueFrom(formatClock(position))
              : productCopy.actions.startListening}
          </Button>
        </Box>
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// First-use start experience (never-started student → no empty card).
// ---------------------------------------------------------------------------

function FirstUsePanel({
  hasEpisodes,
  level,
  onFindEpisode,
}: {
  hasEpisodes: boolean;
  level: string;
  onFindEpisode: () => void;
}) {
  return (
    <Card
      data-testid="home-start"
      sx={{ borderRadius: `${radius.radiusHero}px`, backgroundColor: 'secondaryContainer' }}
    >
      <Stack
        spacing={1.5}
        sx={{
          p: {
            xs: `${layout.cardPaddingCompact}px`,
            sm: `${layout.cardPaddingComfortable}px`,
          },
        }}
      >
        <Typography component="h2" variant="headlineSmall" sx={{ color: 'onSecondaryContainer' }}>
          اولین اپیزودت را شروع کن
        </Typography>
        <Typography variant="body1" sx={{ color: 'onSecondaryContainer' }}>
          {hasEpisodes && level
            ? `اپیزودهای سطح ${level} برای شروع آماده‌اند.`
            : productCopy.empty.noEpisodesForLevel}
        </Typography>
        <Box>
          <Button
            variant="contained"
            size="large"
            fullWidth
            data-testid="home-start-cta"
            onClick={onFindEpisode}
          >
            {productCopy.actions.findEpisode}
          </Button>
        </Box>
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Completion state (all published Episodes of the level completed).
// ---------------------------------------------------------------------------

function CompletedPanel({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  return (
    <Card
      data-testid="home-completed"
      sx={{ borderRadius: `${radius.radiusHero}px`, backgroundColor: 'successContainer' }}
    >
      <Stack
        spacing={1.5}
        sx={{
          p: {
            xs: `${layout.cardPaddingCompact}px`,
            sm: `${layout.cardPaddingComfortable}px`,
          },
        }}
      >
        <Typography component="h2" variant="headlineSmall" sx={{ color: 'onSuccessContainer' }}>
          همهٔ اپیزودهای این سطح را گوش کردی
        </Typography>
        <Typography variant="body1" sx={{ color: 'onSuccessContainer' }}>
          برای مرور دوباره می‌توانی به کتابخانه بروی.
        </Typography>
        <Box>
          <Button
            variant="contained"
            size="large"
            fullWidth
            data-testid="home-completed-cta"
            onClick={onOpenLibrary}
          >
            {productCopy.actions.goToLibrary}
          </Button>
        </Box>
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Honest unavailable state (started Episodes are no longer published).
// ---------------------------------------------------------------------------

function UnavailablePanel({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  return (
    <Card data-testid="home-unavailable">
      <Stack
        spacing={1.5}
        sx={{
          p: {
            xs: `${layout.cardPaddingCompact}px`,
            sm: `${layout.cardPaddingComfortable}px`,
          },
        }}
      >
        <Typography component="h2" variant="headlineSmall">
          اپیزودها فعلاً در دسترس نیستند
        </Typography>
        <Typography variant="body1" color="text.secondary">
          اپیزودهای شروع‌شدهٔ تو موقتاً از فهرست حذف شده‌اند؛ بقیهٔ اپیزودها را در کتابخانه ببین.
        </Typography>
        <Box>
          <Button variant="outlined" size="large" fullWidth onClick={onOpenLibrary}>
            {productCopy.actions.goToLibrary}
          </Button>
        </Box>
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Progress snapshot — one compact panel (started / completed / percent /
// preferred level); never four tiny stat cards on phones.
// ---------------------------------------------------------------------------

function ProgressPanel({
  data,
  summaryFailed,
  onRetry,
  onOpenProgress,
}: {
  data: HomeData;
  summaryFailed: boolean;
  onRetry: () => void;
  onOpenProgress: () => void;
}) {
  const summary = data.summary;
  const showRecommended = data.recommendedLevel && data.recommendedLevel !== data.preferredLevel;

  return (
    <Card data-testid="progress-card">
      <Stack
        spacing={1.5}
        sx={{
          p: {
            xs: `${layout.cardPaddingCompact}px`,
            sm: `${layout.cardPaddingComfortable}px`,
          },
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <AutoStoriesRoundedIcon color="action" />
          <Typography component="h2" variant="titleMedium" sx={{ flex: 1 }}>
            {productCopy.sections.progress}
          </Typography>
          <Button size="small" variant="text" onClick={onOpenProgress} data-testid="progress-more">
            جزئیات
          </Button>
        </Stack>

        {summaryFailed || !summary ? (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              {productCopy.errors.progressFailed}
            </Typography>
            <Box>
              <Button size="small" variant="outlined" onClick={onRetry}>
                {productCopy.actions.retry}
              </Button>
            </Box>
          </Stack>
        ) : (
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
                level={(data.preferredLevel as CefrLevel) || 'A1'}
                size="sm"
                showName={false}
              />
            </Stack>

            {showRecommended ? (
              <Typography variant="body2" color="text.secondary">
                {productCopy.levels.recommended}: {data.recommendedLevel} —{' '}
                {productCopy.levels.browsing}: {data.preferredLevel}
              </Typography>
            ) : null}

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

            {summary.publishedLessonCount > 0 ? (
              <Box>
                <LinearProgress
                  variant="determinate"
                  value={summary.completionPercent}
                  aria-label={`پیشرفت کلی: ${summary.completionPercent} درصد`}
                  aria-valuetext={`${summary.completionPercent} از ۱۰۰ درصد`}
                />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                هنوز اپیزودی برای این سطح منتشر نشده است.
              </Typography>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
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

// ---------------------------------------------------------------------------
// Subscription line — compact and quiet; no payment-style card, no Staff
// terminology. Active-only route: pending/expired students are redirected
// to the payment journey before this route renders.
// ---------------------------------------------------------------------------

function SubscriptionLine({
  subscription,
}: {
  subscription: NonNullable<HomeData['subscription']>;
}) {
  return (
    <Box
      data-testid="subscription-card"
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 1,
        flexWrap: 'wrap',
        px: 2,
        py: 1.5,
        borderRadius: `${radius.radiusCard}px`,
        border: '1px solid',
        borderColor: 'outlineVariant',
        backgroundColor: 'surfaceContainerLow',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <WorkspacePremiumRoundedIcon color="success" fontSize="small" />
        <Typography variant="titleSmall">{productCopy.subscription.label}</Typography>
        <Chip
          label={productCopy.subscription.active}
          size="small"
          sx={{
            backgroundColor: 'successContainer',
            color: 'onSuccessContainer',
            fontWeight: 600,
          }}
        />
      </Stack>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
      >
        {productCopy.subscription.plan}: {subscription.planName}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
      >
        {productCopy.subscription.expiresAt}:{' '}
        {subscription.expiresAt
          ? new Date(subscription.expiresAt).toLocaleDateString('fa-IR')
          : '—'}{' '}
        — {productCopy.subscription.daysRemaining}: {subscription.remainingDays}
      </Typography>
    </Box>
  );
}
