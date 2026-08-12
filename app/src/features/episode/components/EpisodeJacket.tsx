// app/src/features/episode/components/EpisodeJacket.tsx
// Slice 7 — the Record Jacket: artwork, Edition Rail and Episode identity.
//
// Phone: artwork (≤240px) → Edition Rail → identity. Tablet: jacket-front
// (artwork beside identity, rail under the artwork). Desktop: stacked
// inside the pinned jacket column. The H1 is the Persian title (falls back
// to the English title for legacy content); the English title is an LTR
// caption. While the transcript is being read the identity quiets
// (presentation-only, never hides actions).

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Typography } from '@mui/material';
import { useCallback, useState } from 'react';
import { duration, easing } from '../../../../../shared/ui/tokens';
import type { CefrLevel } from '../../../../../shared/ui/tokens/cefr';
import { productCopy } from '../../../app/copy/productCopy';
import { cefrLevelNames } from '../../../app/shell/LevelBadge';
import type { EpisodeMeta, LessonDetailResponse } from '../../lessons/types';
import { EpisodeArtwork } from '../../podcast/components/EpisodeArtwork';
import type { EditionRailEntry } from '../logic';
import { EditionRail } from './EditionRail';

export interface EpisodeJacketProps {
  episode: EpisodeMeta | null;
  variant: LessonDetailResponse['variant'] | null;
  entries: EditionRailEntry[];
  currentLevel: CefrLevel | null;
  recommendedLevel: string;
  railDisabled: boolean;
  switchingNote: string | null;
  readingActive: boolean;
  onSelectVariant: (variantId: string, level: CefrLevel) => void;
  onUnpublishedAttempt: (level: CefrLevel) => void;
}

export function EpisodeJacket({
  episode,
  variant,
  entries,
  currentLevel,
  recommendedLevel,
  railDisabled,
  switchingNote,
  readingActive,
  onSelectVariant,
  onUnpublishedAttempt,
}: EpisodeJacketProps) {
  const [unpublishedNoteLevel, setUnpublishedNoteLevel] = useState<CefrLevel | null>(null);

  // Attempting an unpublished plate reveals the accepted honest line next
  // to the rail (visible feedback) AND routes the same line to the
  // route-level polite live region (assistive-technology feedback).
  const handleUnpublishedAttempt = useCallback(
    (level: CefrLevel) => {
      setUnpublishedNoteLevel(level);
      onUnpublishedAttempt(level);
    },
    [onUnpublishedAttempt],
  );

  const handleSelectVariant = useCallback(
    (variantId: string, level: CefrLevel) => {
      // A real selection dismisses any visible unpublished note.
      setUnpublishedNoteLevel(null);
      onSelectVariant(variantId, level);
    },
    [onSelectVariant],
  );

  const titleFa = episode?.titleFa?.trim();
  const primaryTitle = titleFa || episode?.title || '';
  const englishTitle = titleFa ? (episode?.title ?? '') : '';
  const category = episode?.category?.titleFa ?? '';
  const levelName = variant && currentLevel ? (cefrLevelNames[currentLevel] ?? '') : '';
  const durationMinutes =
    variant && (variant.audioDurationSeconds ?? 0) > 0
      ? Math.max(1, Math.round((variant.audioDurationSeconds ?? 0) / 60))
      : 0;
  const episodeNumber =
    (episode?.episodeNumber ?? 0) > 0 ? (episode?.episodeNumber ?? 0) : undefined;
  const meta = productCopy.episodeSurface.episodeMeta(episodeNumber, durationMinutes || undefined);

  return (
    <Box data-testid="episode-jacket">
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row', lg: 'column' },
          alignItems: 'flex-start',
          gap: 3,
        }}
      >
        {/* Artwork + Edition Rail */}
        <Box sx={{ width: { xs: 200, md: 200, lg: 280 }, flexShrink: 0 }}>
          {episode ? (
            <EpisodeArtwork
              src={episode.artwork}
              alt={primaryTitle || productCopy.episode.entity}
              loading="eager"
            />
          ) : null}
          <EditionRail
            entries={entries}
            currentLevel={currentLevel}
            disabled={railDisabled}
            onSelect={handleSelectVariant}
            onUnpublishedAttempt={handleUnpublishedAttempt}
          />
          {unpublishedNoteLevel ? (
            <Box
              data-testid="edition-unpublished-note"
              sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: 1 }}
            >
              <InfoOutlinedIcon
                fontSize="small"
                sx={{ color: 'text.secondary', mt: '0.1875rem', flexShrink: 0 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {productCopy.episodeSurface.levelUnpublished(unpublishedNoteLevel)}
              </Typography>
            </Box>
          ) : null}
        </Box>

        {/* Identity */}
        <Box
          data-testid="episode-identity"
          sx={{
            flex: 1,
            minWidth: 0,
            transition: `opacity ${duration.durationFast}ms ${easing.easingStandard}`,
            opacity: readingActive ? 0.45 : 1,
          }}
        >
          {category ? (
            <Typography
              variant="caption"
              color="primary"
              sx={{ fontWeight: 700, display: 'block', overflowWrap: 'anywhere', mb: 0.5 }}
            >
              {category}
            </Typography>
          ) : null}

          <Typography
            component="h1"
            variant="headlineLarge"
            sx={{ overflowWrap: 'anywhere', fontSize: { lg: '1.5rem' }, lineHeight: { lg: 1.35 } }}
          >
            {primaryTitle || '…'}
          </Typography>

          {englishTitle ? (
            <Typography
              lang="en"
              dir="ltr"
              variant="englishMetadata"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.5, textAlign: 'start', overflowWrap: 'anywhere' }}
            >
              {englishTitle}
            </Typography>
          ) : null}

          {levelName && currentLevel ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 600 }}>
              {productCopy.episodeSurface.levelLabel(currentLevel, levelName)}
            </Typography>
          ) : null}

          {meta ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {meta}
            </Typography>
          ) : null}

          {!railDisabled &&
          currentLevel &&
          recommendedLevel &&
          recommendedLevel !== currentLevel ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {productCopy.episodeSurface.recommendedNote(recommendedLevel)}
            </Typography>
          ) : null}

          {switchingNote ? (
            <Typography
              variant="body2"
              color="text.secondary"
              role="status"
              data-testid="variant-switching-note"
              sx={{ mt: 1, fontWeight: 600 }}
            >
              {switchingNote}
            </Typography>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
