import { Box, Typography } from '@mui/material';
import type { CefrLevel } from '../theme/tokens/cefr';
import { cefr } from '../theme/tokens/cefr';

// CEFR level badge that combines color, label text, and a level name so the
// level is never communicated by color alone.
export function LevelBadge({
  level,
  showName = true,
  size = 'md',
}: {
  level: CefrLevel;
  showName?: boolean;
  size?: 'sm' | 'md';
}) {
  const palette = cefr[level];
  const names: Record<CefrLevel, string> = {
    A1: 'مبتدی',
    A2: 'پایه',
    B1: 'متوسط',
    B2: 'میانی بالا',
    C1: 'پیشرفته',
    C2: 'تسلط',
  };
  const padY = size === 'sm' ? 0.25 : 0.5;
  const padX = size === 'sm' ? 0.75 : 1;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '12px',
      }}
      aria-label={`سطح ${palette.label} ${showName ? `(${names[level]})` : ''}`}
    >
      <Box
        aria-hidden
        sx={{
          backgroundColor: palette.bg,
          color: palette.fg,
          px: padX,
          py: padY,
          borderRadius: '10px',
          fontWeight: 700,
          fontSize: size === 'sm' ? '0.75rem' : '0.8125rem',
          lineHeight: 1.4,
        }}
      >
        {palette.label}
      </Box>
      {showName ? (
        <Typography component="span" variant="body2" color="text.secondary">
          {names[level]}
        </Typography>
      ) : null}
    </Box>
  );
}
