// app/src/features/episode/components/VariantDeck.tsx
// Slice 7 — the Deck: the Episode's listening surface (the room's player).
//
// Accepted presentation contract (docs/DESIGN.md — "The Deck"):
//   - CEFR edition stripe (4px, level pair) crowns the Deck;
//   - one dominant primary control in a fixed 56px slot; its label derives
//     from the Variant's saved Progress (deriveDeckCta): شروع گوشدادن /
//     ادامه از HH:MM / پخش / مرور دوباره, and a pause icon while playing;
//   - resume is a label on the play control — no separate resume card;
//   - speed is a compact menu (no chip wall); zero chips in the Deck;
//   - the timeline IS the progress bar (per-Variant only);
//   - states: metadata loading, playing, paused, completed, audio error
//     with retry, unavailable source. No raw media errors are ever shown.
//
// The Deck binds the shared PlayerProvider session exactly like the legacy
// AudioPlayer (single audio element; MiniPlayer follows navigation), so the
// established shared-player behavior is preserved.

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import Forward10RoundedIcon from '@mui/icons-material/Forward10Rounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import Replay10RoundedIcon from '@mui/icons-material/Replay10Rounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import { Box, Button, IconButton, Menu, MenuItem, Slider, Stack, Typography } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { radius } from '../../../../../shared/ui/tokens';
import type { CefrLevel } from '../../../../../shared/ui/tokens/cefr';
import { deckStripeColor } from '../../../../../shared/ui/tokens/cefr';
import { productCopy } from '../../../app/copy/productCopy';
import { type PlayerSession, usePlayer } from '../../player/PlayerProvider';
import type { LessonProgressResponse } from '../../progress/types';
import { deriveDeckCta } from '../logic';

export interface VariantDeckProps {
  /** Protected audio URL (built with a file token); null while unavailable. */
  src: string | null;
  contentType?: string;
  /** Active-Variant identity used by the session registry + Mini Player. */
  session: PlayerSession;
  /** Authoritative per-Variant Progress of the current Variant. */
  progress: LessonProgressResponse | null;
  /** Current Variant level (edition stripe). */
  level: CefrLevel | null;
  /**
   * True when the absent source is a recoverable protected-URL build
   * failure (the Deck then offers the inline retry next to the honest
   * unavailable line); false for a genuinely source-less Episode.
   */
  retryable?: boolean;
  onTimeUpdate: (positionSeconds: number, durationSeconds: number) => void;
  onPause: (positionSeconds: number, durationSeconds: number) => void;
  onSeek: (positionSeconds: number) => void;
  onEnded: () => void;
  onRetry: () => void;
}

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

/**
 * The speed menu opens without an entrance transform: on low-end devices
 * (and in headless test environments) a frozen Grow transition can leave
 * the menu visually scaled and the items below their 44px touch targets.
 * An instant appearance is the restrained choice for a 5-item menu.
 */
function MenuNoTransition({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VariantDeck({
  src,
  onTimeUpdate,
  onPause,
  onSeek,
  onEnded,
  onRetry,
  session,
  progress,
  level,
  retryable = false,
}: VariantDeckProps) {
  const player = usePlayer();
  const [speedAnchor, setSpeedAnchor] = useState<HTMLElement | null>(null);
  // Hoisted above the early return: unconditional hook order is a React
  // Rules-of-Hooks invariant — the `!src` fallback and the full Deck are
  // the same fiber, and the dev build throws on a hook-count change.
  const { colorScheme } = useColorScheme();

  // Bind the Variant session + callbacks (same semantics as the legacy
  // AudioPlayer: bind resets only when the lesson/source actually changes).
  useEffect(() => {
    if (!src || !session) return;
    player.bind(session, src, { onTimeUpdate, onSeek, onEnded, onPause, onRetry });
    return () => player.unbind(session.lessonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, session?.lessonId]);

  if (!src) {
    return (
      <Box
        role="group"
        aria-label="پخش‌کنندهٔ صوت"
        data-testid="audio-player"
        sx={{
          p: 2,
          textAlign: 'center',
          bgcolor: 'surfaceContainerHigh',
          borderRadius: `${radius.radiusCard}px`,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {productCopy.episodeSurface.audioUnavailable}
        </Typography>
        {/* Recoverable absence (the protected-URL build failed): keep the
            accepted inline retry reachable — a transient token/network
            failure must not read as a terminal state. The route's onRetry
            rebuilds the URL and no-ops safely when there is nothing to
            rebuild (genuinely source-less episodes show the line only). */}
        {retryable ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={onRetry}
            sx={{ minHeight: 44, mt: 1 }}
          >
            {productCopy.actions.retry}
          </Button>
        ) : null}
      </Box>
    );
  }

  const cta = deriveDeckCta({
    progress: progress
      ? { completed: progress.completed, positionSeconds: progress.positionSeconds }
      : null,
    isPlaying: player.isPlaying,
  });

  const displayTime = player.currentTime;
  const effectiveDuration = player.duration || 0;
  const percent =
    progress && !progress.completed && progress.positionSeconds > 0 ? progress.percent : 0;

  const handleCta = () => {
    if (player.hasError) return;
    if (cta.kind === 'resume' && cta.resumePositionSeconds !== undefined) {
      player.applyInitialPosition(cta.resumePositionSeconds);
    } else if (cta.kind === 'review') {
      player.applyInitialPosition(0);
    }
    player.togglePlay();
  };

  let stateLine: React.ReactNode = null;
  if (player.hasError) {
    stateLine = (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" color="error" role="alert" sx={{ fontWeight: 600 }}>
          {productCopy.episodeSurface.audioPlaybackError}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshRoundedIcon />}
          onClick={player.retry}
          sx={{ minHeight: 44 }}
        >
          {productCopy.actions.retry}
        </Button>
      </Stack>
    );
  } else if (progress?.completed) {
    stateLine = (
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <CheckCircleRoundedIcon color="success" fontSize="small" />
        <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
          {productCopy.episodeSurface.episodeCompleted}
        </Typography>
      </Stack>
    );
  } else if (player.isPlaying) {
    stateLine = (
      <Typography variant="caption" color="text.secondary">
        {productCopy.episodeSurface.playingNow}
      </Typography>
    );
  } else if (progress && progress.positionSeconds > 0) {
    stateLine = (
      <Typography variant="caption" color="text.secondary">
        {productCopy.episodeSurface.inProgressPercent(Math.round(percent))}
      </Typography>
    );
  } else {
    stateLine = (
      <Typography variant="caption" color="text.secondary">
        {productCopy.cardStatus.notStarted}
      </Typography>
    );
  }

  const stripeColor = level ? deckStripeColor(level, colorScheme ?? 'light') : 'transparent';

  return (
    <Box
      role="group"
      aria-label="پخش‌کنندهٔ صوت"
      data-testid="audio-player"
      aria-busy={player.isLoading}
      sx={{
        backgroundColor: 'surfaceContainerHigh',
        borderRadius: `${radius.radiusCard}px`,
      }}
    >
      {/* CEFR edition stripe (4px, level pair) — top corners follow the card */}
      <Box
        aria-hidden="true"
        data-testid="deck-edition-stripe"
        sx={{
          height: 4,
          backgroundColor: stripeColor,
          borderTopLeftRadius: `${radius.radiusCard}px`,
          borderTopRightRadius: `${radius.radiusCard}px`,
        }}
      />

      <Box sx={{ p: 2 }}>
        {/* Row 1: state line (stable height) + speed + mute at the end */}
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', minHeight: 28, flexWrap: 'nowrap', gap: 1 }}
        >
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
            {stateLine}
          </Box>
          <IconButton
            aria-label={`سرعت پخش ${player.playbackRate} برابر`}
            onClick={(event) => setSpeedAnchor(event.currentTarget)}
            disabled={player.hasError}
            data-testid="deck-speed-trigger"
            sx={{ fontWeight: 700, fontSize: '0.875rem', fontFamily: 'inherit' }}
          >
            {player.playbackRate}×
          </IconButton>
          <IconButton
            aria-label={player.isMuted || player.volume === 0 ? 'باز کردن صدا' : 'قطع صدا'}
            onClick={player.toggleMute}
            disabled={player.hasError}
          >
            {player.isMuted || player.volume === 0 ? (
              <VolumeOffRoundedIcon />
            ) : (
              <VolumeUpRoundedIcon />
            )}
          </IconButton>
        </Stack>

        {player.isLoading && !player.hasError ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            در حال بارگذاری…
          </Typography>
        ) : null}

        <Stack spacing={0.5}>
          {/* Timeline / seek — interactive even during a temporary error */}
          <Box sx={{ px: 0.5 }}>
            <Slider
              aria-label="موقعیت پخش"
              value={displayTime}
              min={0}
              max={effectiveDuration || 1}
              step={0.1}
              onChange={(_e, v) => player.seekTo(Number(Array.isArray(v) ? v[0] : v))}
              size="small"
              sx={{ '& .MuiSlider-thumb': { width: 14, height: 14 } }}
            />
          </Box>

          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', alignItems: 'center', px: 0.5 }}
          >
            <Typography variant="audioTime" color="text.secondary" dir="ltr" lang="en">
              {formatTime(displayTime)}
            </Typography>
            <Typography variant="audioTime" color="text.secondary" dir="ltr" lang="en">
              {formatTime(effectiveDuration)}
            </Typography>
          </Stack>
        </Stack>

        {/* Transport: dominant CTA (fixed 56px slot) between the skips.
            flexWrap allows the row to reflow at 200% text zoom where the
            widest CTA label (شروع گوش‌دادن) plus the scaled transport
            buttons exceed 390px — the accepted geometry contract forbids
            horizontal overflow at zoom. At normal sizes the row fits and
            never wraps. */}
        <Stack
          direction="row"
          sx={{ justifyContent: 'center', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1 }}
        >
          <IconButton
            aria-label="۱۰ ثانیه به عقب"
            onClick={() => player.skipBy(-10)}
            disabled={player.hasError}
          >
            <Replay10RoundedIcon />
          </IconButton>

          <Box
            sx={{
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {player.isPlaying ? (
              <IconButton
                aria-label="توقف"
                onClick={player.togglePlay}
                color="primary"
                data-testid="player-play-toggle"
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <PauseRoundedIcon />
              </IconButton>
            ) : (
              <Button
                variant="contained"
                size="large"
                onClick={handleCta}
                // The CTA must not be actionable while a (re)load is in
                // flight: `retry()` clears hasError optimistically BEFORE
                // the rebuilt source is ready, and play() on the still-
                // broken element rejects — a fast click would bounce the
                // deck straight back into the error state.
                disabled={player.hasError || player.isLoading}
                data-testid="deck-primary-cta"
                startIcon={<PlayArrowRoundedIcon />}
                sx={{
                  minHeight: 56,
                  height: 56,
                  borderRadius: `${radius.radiusControl}px`,
                  px: 2.5,
                  minWidth: 128,
                  fontSize: '0.9375rem',
                }}
              >
                {cta.label}
              </Button>
            )}
          </Box>

          <IconButton
            aria-label="۱۰ ثانیه به جلو"
            onClick={() => player.skipBy(10)}
            disabled={player.hasError}
          >
            <Forward10RoundedIcon />
          </IconButton>
        </Stack>

        {/* Volume slider — only where useful (sm+); mute always available */}
        <Box sx={{ display: { xs: 'none', sm: 'block' }, mt: 0.5 }}>
          <Slider
            aria-label="بلندی صدا"
            value={player.isMuted ? 0 : player.volume}
            min={0}
            max={1}
            step={0.05}
            onChange={(_e, v) => player.setVolume(Number(Array.isArray(v) ? v[0] : v))}
            size="small"
            disabled={player.hasError}
            sx={{ width: 160, maxWidth: '100%' }}
          />
        </Box>
      </Box>

      <Menu
        anchorEl={speedAnchor}
        open={Boolean(speedAnchor)}
        onClose={() => setSpeedAnchor(null)}
        slots={{ transition: MenuNoTransition }}
        data-testid="deck-speed-menu"
      >
        {PLAYBACK_SPEEDS.map((speed) => (
          <MenuItem
            key={speed}
            selected={player.playbackRate === speed}
            onClick={() => {
              player.setRate(speed);
              setSpeedAnchor(null);
            }}
            sx={{ minHeight: 44, height: 44, display: 'flex', alignItems: 'center' }}
          >
            {`سرعت پخش ${speed} برابر`}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
