// app/src/features/player/AudioPlayer.tsx
// Visual Slice 2 — premium Audio Player presentation bound to the shared
// PlayerProvider (single audio element; see PlayerProvider.tsx).
//
// Visual hierarchy:
//   - Play/Pause is the dominant control (56px filled primary circle).
//   - Skip -10s / +10s stay reachable (44px targets).
//   - Timeline + stable timestamps (audioTime: tabular numerals, LTR).
//   - Speed stays a fixed row of 5 chips (no wrapping, no layout growth).
//   - Volume slider appears only where useful (sm+); mute always available.
//   - States: loading metadata, ready, playing, paused, completed,
//     temporary network error with retry, entitlement error handled by the
//     route (no raw media/backend errors are ever rendered here).

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import Forward10RoundedIcon from '@mui/icons-material/Forward10Rounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import Replay10RoundedIcon from '@mui/icons-material/Replay10Rounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import { Box, Button, Chip, IconButton, Slider, Stack, Tooltip, Typography } from '@mui/material';
import { useEffect, useRef } from 'react';
import { radius } from '../../app/theme/tokens';
import { type PlayerSession, usePlayer } from './PlayerProvider';

export interface AudioPlayerProps {
  /** The audio source URL (from the protected audio proxy) */
  src: string | null;
  /** The MIME content type of the audio */
  contentType?: string;
  /** Called with current position (seconds) and duration (seconds) for external progress saving */
  onTimeUpdate?: (positionSeconds: number, durationSeconds: number) => void;
  /** Called when audio playback ends naturally */
  onEnded?: () => void;
  /** Called when user performs a seek (for triggering a save) */
  onSeek?: (positionSeconds: number) => void;
  /** External flag to indicate the lesson is completed */
  completed?: boolean;
  /** Whether to show the completed indicator */
  showCompleted?: boolean;
  /** Kept for API compatibility; the provider always preloads metadata. */
  preload?: 'none' | 'metadata' | 'auto';
  /**
   * Position (seconds) to seek to after metadata loads, e.g. a saved resume
   * position. Applied once per value change; never auto-plays.
   */
  initialPosition?: number;
  /** Callback to refresh the audio source (e.g., get a new file token) */
  onRetry?: () => void;
  /** Active-lesson identity used for the session registry + Mini Player. */
  session?: PlayerSession | null;
}

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer({
  src,
  onTimeUpdate,
  onEnded,
  onSeek,
  completed,
  showCompleted,
  preload = 'metadata',
  initialPosition,
  onRetry,
  session,
}: AudioPlayerProps) {
  const player = usePlayer();
  // The provider hosts the single audio element; `preload` is accepted for
  // API compatibility but the shared element always preloads metadata.
  void preload;
  const appliedPositionRef = useRef<number | null>(null);

  // Bind the lesson session + callbacks. `bind` resets the player only when
  // the lesson/source actually changes, so re-mounts of the same lesson
  // (back navigation) keep the position.
  useEffect(() => {
    if (!src || !session) return;
    player.bind(session, src, { onTimeUpdate, onSeek, onEnded, onRetry });
    return () => player.unbind(session.lessonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, session?.lessonId]);

  // Apply the resume position once per value change (same semantics as the
  // previous pending-seek implementation). Re-mounts of the same lesson
  // re-apply the resume position; manual seeks afterwards are never overridden.
  useEffect(() => {
    if (initialPosition === undefined || initialPosition === null) return;
    if (appliedPositionRef.current !== initialPosition) {
      appliedPositionRef.current = initialPosition;
      player.applyInitialPosition(initialPosition);
    }
  }, [initialPosition, player]);

  if (!src) {
    return (
      <Box
        sx={{
          p: 2,
          textAlign: 'center',
          bgcolor: 'action.hover',
          borderRadius: radius.radiusCard,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          فایل صوتی در دسترس نیست.
        </Typography>
      </Box>
    );
  }

  const displayTime = player.currentTime;
  const effectiveDuration = player.duration || 0;

  return (
    <Box
      role="group"
      aria-label="پخش‌کنندهٔ صوت"
      data-testid="audio-player"
      aria-busy={player.isLoading}
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: radius.radiusCard,
        border: 1,
        borderColor: 'divider',
      }}
    >
      {/* Completed indicator */}
      {showCompleted && completed && (
        <Stack direction="row" spacing={0.5} sx={{ mb: 1, alignItems: 'center' }}>
          <CheckCircleRoundedIcon color="success" fontSize="small" />
          <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
            این درس کامل شده است
          </Typography>
        </Stack>
      )}

      {/* Temporary network error — retry is safe, no raw media errors */}
      {player.hasError && (
        <Stack spacing={1} sx={{ mb: 1 }}>
          <Typography variant="body2" color="error" role="alert">
            خطا در پخش صوت.
          </Typography>
          <Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={player.retry}
            >
              تلاش مجدد
            </Button>
          </Box>
        </Stack>
      )}

      {/* Loading / buffering */}
      {player.isLoading && !player.hasError && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          در حال بارگذاری…
        </Typography>
      )}

      <Stack spacing={1.5}>
        {/* Timeline / seek — stays interactive even during a temporary
            network error so the student can still scrub (seeks are queued
            and saved once playback recovers). */}
        <Box sx={{ px: 0.5 }}>
          <Slider
            aria-label="موقعیت پخش"
            value={displayTime}
            min={0}
            max={effectiveDuration || 1}
            step={0.1}
            onChange={(_e, v) => player.seekTo(Number(Array.isArray(v) ? v[0] : v))}
            size="small"
            sx={{
              '& .MuiSlider-thumb': { width: 14, height: 14 },
            }}
          />
        </Box>

        {/* Timestamps stay stable (tabular numerals, LTR-isolated) */}
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', px: 0.5 }}
        >
          <Typography variant="audioTime" color="text.secondary">
            {formatTime(displayTime)}
          </Typography>
          <Typography variant="audioTime" color="text.secondary">
            {formatTime(effectiveDuration)}
          </Typography>
        </Stack>

        {/* Transport: dominant Play/Pause with reachable skips */}
        <Stack
          direction="row"
          sx={{ justifyContent: 'center', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}
        >
          <Tooltip title="۱۰ ثانیه قبل">
            <IconButton
              aria-label="۱۰ ثانیه به عقب"
              onClick={() => player.skipBy(-10)}
              disabled={player.hasError}
            >
              <Replay10RoundedIcon />
            </IconButton>
          </Tooltip>

          <IconButton
            aria-label={player.isPlaying ? 'توقف' : 'پخش'}
            onClick={player.togglePlay}
            color="primary"
            data-testid="player-play-toggle"
            sx={{
              width: 56,
              height: 56,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
              '&:focus-visible': {
                outline: 2,
                outlineOffset: 2,
                outlineColor: 'primary.main',
              },
            }}
            disabled={player.hasError}
          >
            {player.isPlaying ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
          </IconButton>

          <Tooltip title="۱۰ ثانیه بعد">
            <IconButton
              aria-label="۱۰ ثانیه به جلو"
              onClick={() => player.skipBy(10)}
              disabled={player.hasError}
            >
              <Forward10RoundedIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Speed: fixed five-chip row — never wraps, never grows the layout */}
        <Stack
          direction="row"
          sx={{ justifyContent: 'center', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}
        >
          {PLAYBACK_SPEEDS.map((speed) => (
            <Chip
              key={speed}
              label={`${speed}×`}
              size="small"
              variant={player.playbackRate === speed ? 'filled' : 'outlined'}
              color={player.playbackRate === speed ? 'primary' : 'default'}
              onClick={() => player.setRate(speed)}
              aria-label={`سرعت پخش ${speed} برابر`}
              aria-pressed={player.playbackRate === speed}
              sx={{
                cursor: 'pointer',
                fontWeight: player.playbackRate === speed ? 600 : 400,
                minHeight: 44,
                minWidth: 44,
                flexShrink: 0,
              }}
            />
          ))}
        </Stack>

        {/* Volume / mute — slider only where useful (sm+), mute always */}
        <Stack
          direction="row"
          sx={{ justifyContent: 'center', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}
        >
          <IconButton
            aria-label={player.isMuted ? 'باز کردن صدا' : 'قطع صدا'}
            onClick={player.toggleMute}
            disabled={player.hasError}
          >
            {player.isMuted || player.volume === 0 ? (
              <VolumeOffRoundedIcon />
            ) : (
              <VolumeUpRoundedIcon />
            )}
          </IconButton>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, width: 128, minWidth: 128 }}>
            <Slider
              aria-label="بلندی صدا"
              value={player.isMuted ? 0 : player.volume}
              min={0}
              max={1}
              step={0.05}
              onChange={(_e, v) => player.setVolume(Number(Array.isArray(v) ? v[0] : v))}
              size="small"
              disabled={player.hasError}
            />
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
