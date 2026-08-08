// app/src/features/player/MiniPlayer.tsx
// Visual Slice 2 — restrained Mini Player shown while a lesson is active
// inside the authenticated student shell.
//
// - Single source of truth: reflects the PlayerProvider session; never owns
//   an audio element (no duplicate simultaneous playback).
// - Fixed bar placed ABOVE the bottom navigation (never overlapping it);
//   the reserved space is announced to PageContainer through the
//   `--fep-mini-player-space` CSS variable so scrolling content is never
//   covered.
// - Visible only when a lesson session is active AND playback has actually
//   started (position > 0 or playing) — no ghost bar for untouched lessons.
// - Entrance uses the motion tokens; the theme's reduced-motion rule
//   collapses it to an instant state change.

import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { Box, IconButton, LinearProgress, Paper, Typography } from '@mui/material';
import { useLayoutEffect } from 'react';
import { useNavigate } from 'react-router';
import { duration, easing, layout } from '../../../../shared/ui/tokens';
import { usePlayer } from './PlayerProvider';

const MINI_PLAYER_HEIGHT = 56;
const RESERVE_VAR = '--fep-mini-player-space';

export function MiniPlayer() {
  const player = usePlayer();
  const navigate = useNavigate();
  const { session, src, isPlaying, currentTime, duration: totalDuration } = player;

  const active = !!session && !!src && (isPlaying || currentTime > 0.5);

  // Announce the reserved space before paint so PageContainer's bottom
  // padding tracks the bar without layout shift or covered content.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (active) {
      root.style.setProperty(RESERVE_VAR, `${MINI_PLAYER_HEIGHT + 8}px`);
    } else {
      root.style.removeProperty(RESERVE_VAR);
    }
    return () => {
      root.style.removeProperty(RESERVE_VAR);
    };
  }, [active]);

  if (!active || !session) return null;

  const percent =
    totalDuration > 0 ? Math.min(100, Math.max(0, (currentTime / totalDuration) * 100)) : 0;
  const goToLesson = () => navigate(`/lessons/${session.lessonId}`);

  return (
    <Paper
      elevation={0}
      data-testid="mini-player"
      role="region"
      aria-label={`درس فعال: ${session.title}`}
      sx={{
        position: 'fixed',
        insetInlineStart: 0,
        insetInlineEnd: 0,
        bottom: {
          xs: `calc(${layout.bottomNavigationHeight}px + env(safe-area-inset-bottom, 0px))`,
          md: 16,
        },
        zIndex: (t) => t.zIndex.appBar,
        borderTop: 1,
        borderColor: 'divider',
        backgroundColor: 'surfaceContainerHigh',
        color: 'onSurface',
        animation: `fep-mini-player-enter ${duration.durationEmphasized}ms ${easing.easingEmphasized} both`,
      }}
    >
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.5,
          py: 0.5,
          height: MINI_PLAYER_HEIGHT,
        }}
      >
        <Box
          component="button"
          type="button"
          onClick={goToLesson}
          aria-label={`بازگشت به درس ${session.title}`}
          data-testid="mini-player-return"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flex: 1,
            minWidth: 0,
            textAlign: 'start',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            font: 'inherit',
            color: 'inherit',
            p: 0.5,
            borderRadius: '10px',
          }}
        >
          <GraphicEqRoundedIcon sx={{ color: 'primary.main', flexShrink: 0 }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="titleSmall"
              sx={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {session.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {isPlaying ? 'در حال پخش…' : 'مکث شده'}
            </Typography>
          </Box>
        </Box>

        <IconButton
          onClick={player.togglePlay}
          aria-label={isPlaying ? 'توقف پخش' : 'پخش'}
          data-testid="mini-player-toggle"
          sx={{
            width: 44,
            height: 44,
            color: 'onPrimaryContainer',
            backgroundColor: 'primaryContainer',
            '&:hover': { backgroundColor: 'primaryContainer' },
            flexShrink: 0,
          }}
        >
          {isPlaying ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
        </IconButton>
      </Box>
      {/* Small progress indicator (kept above the transport row visually). */}
      <LinearProgress
        variant="determinate"
        value={percent}
        aria-label={`پیشرفت درس ${session.title}: ${Math.round(percent)} درصد`}
        sx={{
          position: 'absolute',
          insetInlineStart: 0,
          insetInlineEnd: 0,
          bottom: 0,
          height: 3,
        }}
      />
    </Paper>
  );
}
