// app/src/features/library/components/OptionChips.tsx
// Podcast Slice 6 — compact single-select chip row for Library filters.
//
// Horizontal scroll on phones (no document overflow), keyboard-accessible
// buttons, and the selected state is communicated by shape + icon + text
// (`aria-pressed`, filled container, check icon) — never by color alone.

import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { Box, Chip, Typography } from '@mui/material';
import { useId } from 'react';

export interface OptionChip {
  value: string;
  label: string;
}

export function OptionChips({
  label,
  options,
  value,
  onChange,
  'data-testid': testId,
}: {
  /** Accessible group label (visually hidden; chips carry their labels). */
  label: string;
  options: OptionChip[];
  value: string;
  onChange: (value: string) => void;
  'data-testid'?: string;
}) {
  const groupId = useId();
  return (
    <Box data-testid={testId}>
      <Typography
        id={groupId}
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 0.5 }}
      >
        {label}
      </Typography>
      <Box
        role="group"
        aria-labelledby={groupId}
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 0.5,
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'outlineVariant',
            borderRadius: '999px',
          },
        }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Chip
              key={option.value}
              label={option.label}
              clickable
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              data-testid={`${testId}-${option.value}`}
              icon={selected ? <CheckRoundedIcon /> : undefined}
              variant={selected ? 'filled' : 'outlined'}
              color={selected ? 'primary' : 'default'}
              sx={{
                flexShrink: 0,
                minHeight: 40,
                borderRadius: '999px',
                fontWeight: selected ? 700 : 500,
                '& .MuiChip-icon': { marginInlineStart: '4px', marginInlineEnd: '-4px' },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
