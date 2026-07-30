// app/src/features/player/AudioPlayer.tsx
// P3-S2 — Reusable Audio Player with full controls.
//
// Features:
//   - Play/pause
//   - Current time / total duration
//   - Seek slider (keyboard accessible)
//   - Skip backward 15s / forward 15s
//   - Playback speed (0.75×, 1×, 1.25×, 1.5×, 2×)
//   - Volume / mute
//   - Loading/buffering state
//   - Error state with retry
//   - Completed indicator
//   - All controls keyboard accessible
//   - Accessible slider labels

import { Box, Button, Chip, IconButton, Slider, Stack, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import Replay10RoundedIcon from '@mui/icons-material/Replay10Rounded';
import Forward30RoundedIcon from '@mui/icons-material/Forward30Rounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

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
  /** Whether to auto-load metadata (don't auto-play) */
  preload?: 'none' | 'metadata' | 'auto';
  /** Callback to refresh the audio source (e.g., get a new file token) */
  onRetry?: () => void;
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
  onRetry,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isSeeking, setIsSeeking] = useState(false);
  const seekValueRef = useRef(0);

  // Reset state when source changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(true);
    setHasError(false);
    setIsMuted(false);
    setVolume(1);
    setPlaybackRate(1);
    setIsSeeking(false);
  }, [src]);

  // --- Audio event handlers ---
  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);
    setIsLoading(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || isSeeking) return;
    const pos = audio.currentTime;
    setCurrentTime(pos);
    const dur = audio.duration || duration;
    if (dur > 0) {
      onTimeUpdate?.(pos, dur);
    }
  }, [isSeeking, duration, onTimeUpdate]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    const audio = audioRef.current;
    if (audio) {
      const pos = audio.currentTime;
      const dur = audio.duration || duration;
      if (dur > 0) {
        onTimeUpdate?.(pos, dur);
      }
    }
  }, [duration, onTimeUpdate]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    const audio = audioRef.current;
    if (audio) {
      const pos = audio.currentTime;
      const dur = audio.duration || duration;
      if (dur > 0) {
        onTimeUpdate?.(pos, dur);
      }
    }
    onEnded?.();
  }, [duration, onTimeUpdate, onEnded]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    setIsPlaying(false);
  }, []);

  const handleWaiting = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleLoadedData = useCallback(() => {
    setIsLoading(false);
  }, []);

  // --- Controls ---
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => {
        setHasError(true);
      });
    } else {
      audio.pause();
    }
  }, []);

  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
  }, []);

  const handleSeekChange = useCallback((_event: Event, value: number | number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    seekValueRef.current = v;
    setCurrentTime(v);
  }, []);

  const handleSeekEnd = useCallback(
    (_event: Event | React.SyntheticEvent, value: number | number[]) => {
      const audio = audioRef.current;
      if (!audio) return;
      const v = Array.isArray(value) ? value[0] : value;
      audio.currentTime = v;
      setCurrentTime(v);
      setIsSeeking(false);
      onSeek?.(v);
      onTimeUpdate?.(v, audio.duration || duration);
    },
    [duration, onSeek, onTimeUpdate],
  );

  const skipBackward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Math.max(0, audio.currentTime - 15);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    onSeek?.(newTime);
    onTimeUpdate?.(newTime, audio.duration || duration);
  }, [duration, onSeek, onTimeUpdate]);

  const skipForward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Math.min(audio.duration || duration, audio.currentTime + 15);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    onSeek?.(newTime);
    onTimeUpdate?.(newTime, audio.duration || duration);
  }, [duration, onSeek, onTimeUpdate]);

  const changeSpeed = useCallback((speed: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    setPlaybackRate(speed);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  }, []);

  const handleVolumeChange = useCallback(
    (_event: Event, value: number | number[]) => {
      const audio = audioRef.current;
      if (!audio) return;
      const v = Array.isArray(value) ? value[0] : value;
      audio.volume = v;
      setVolume(v);
      if (v === 0) {
        audio.muted = true;
        setIsMuted(true);
      } else if (isMuted) {
        audio.muted = false;
        setIsMuted(false);
      }
    },
    [isMuted],
  );

  // Keyboard handler for the play/pause on Enter/Space
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        togglePlay();
      }
    },
    [togglePlay],
  );

  // ---- Render ----
  if (!src) {
    return (
      <Box
        sx={{
          p: 2,
          textAlign: 'center',
          bgcolor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          فایل صوتی در دسترس نیست.
        </Typography>
      </Box>
    );
  }

  const displayTime = isSeeking ? seekValueRef.current : currentTime;
  const effectiveDuration = duration || 0;

  return (
    <Box
      role="application"
      aria-label="پخش‌کنندهٔ صوت"
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
      }}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        preload={preload}
        src={src}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onLoadedData={handleLoadedData}
      >
        <track kind="captions" />
      </audio>

      {/* Completed indicator */}
      {showCompleted && completed && (
        <Stack direction="row" spacing={0.5} sx={{ mb: 1, alignItems: 'center' }}>
          <CheckCircleRoundedIcon color="success" fontSize="small" />
          <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
            این درس کامل شده است
          </Typography>
        </Stack>
      )}

      {/* Error state */}
      {hasError && (
        <Stack spacing={1} sx={{ mb: 1 }}>
          <Typography variant="body2" color="error">
            خطا در پخش صوت.
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={() => {
              setHasError(false);
              setIsLoading(true);
              onRetry?.();
              // Force reload the audio element
              const audio = audioRef.current;
              if (audio) {
                audio.load();
              }
            }}
          >
            تلاش مجدد
          </Button>
        </Stack>
      )}

      {/* Loading / Buffering */}
      {isLoading && !hasError && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          در حال بارگذاری…
        </Typography>
      )}

      {/* Main controls */}
      <Stack spacing={1.5}>
        {/* Seek slider */}
        <Box sx={{ px: 0.5 }}>
          <Slider
            aria-label="موقعیت پخش"
            value={displayTime}
            min={0}
            max={effectiveDuration || 1}
            step={0.1}
            onChange={handleSeekChange}
            onChangeCommitted={handleSeekEnd}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            size="small"
            sx={{
              '& .MuiSlider-thumb': { width: 14, height: 14 },
            }}
          />
        </Box>

        {/* Time display */}
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', px: 0.5 }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {formatTime(displayTime)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {formatTime(effectiveDuration)}
          </Typography>
        </Stack>

        {/* Control buttons */}
        <Stack direction="row" sx={{ justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
          {/* Skip backward 15s */}
          <Tooltip title="۱۵ ثانیه قبل">
            <IconButton
              aria-label="۱۵ ثانیه به عقب"
              onClick={skipBackward}
              size="small"
              disabled={hasError}
            >
              <Replay10RoundedIcon />
            </IconButton>
          </Tooltip>

          {/* Play/Pause */}
          <IconButton
            aria-label={isPlaying ? 'توقف' : 'پخش'}
            onClick={togglePlay}
            onKeyDown={handleKeyDown}
            color="primary"
            sx={{
              width: 48,
              height: 48,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
              '&:focus-visible': {
                outline: 2,
                outlineOffset: 2,
                outlineColor: 'primary.main',
              },
            }}
            disabled={hasError}
          >
            {isPlaying ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
          </IconButton>

          {/* Skip forward 15s */}
          <Tooltip title="۱۵ ثانیه بعد">
            <IconButton
              aria-label="۱۵ ثانیه به جلو"
              onClick={skipForward}
              size="small"
              disabled={hasError}
            >
              <Forward30RoundedIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Bottom row: speed + volume */}
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
        >
          {/* Playback speed */}
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              سرعت:
            </Typography>
            {PLAYBACK_SPEEDS.map((speed) => (
              <Chip
                key={speed}
                label={`${speed}×`}
                size="small"
                variant={playbackRate === speed ? 'filled' : 'outlined'}
                color={playbackRate === speed ? 'primary' : 'default'}
                onClick={() => changeSpeed(speed)}
                aria-label={`سرعت پخش ${speed} برابر`}
                aria-pressed={playbackRate === speed}
                sx={{
                  cursor: 'pointer',
                  fontWeight: playbackRate === speed ? 600 : 400,
                }}
              />
            ))}
          </Stack>

          {/* Volume / mute */}
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <IconButton
              aria-label={isMuted ? 'باز کردن صدا' : 'قطع صدا'}
              onClick={toggleMute}
              size="small"
              disabled={hasError}
            >
              {isMuted || volume === 0 ? (
                <VolumeOffRoundedIcon fontSize="small" />
              ) : (
                <VolumeUpRoundedIcon fontSize="small" />
              )}
            </IconButton>
            <Slider
              aria-label="بلندی صدا"
              value={isMuted ? 0 : volume}
              min={0}
              max={1}
              step={0.05}
              onChange={handleVolumeChange}
              size="small"
              sx={{ width: 80 }}
            />
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
