// ThemeSwitch: Light / Dark / System control.
//
// Uses MUI `useColorScheme` (single source of mode state, localStorage
// persistence under the `mode` key, cross-tab sync). A segmented control
// with three options — never a binary switch — so `system` is representable.
// Keyboard accessible (buttons), each option has a tooltip + accessible name,
// and the active option carries `aria-pressed`.

import BrightnessAutoRoundedIcon from '@mui/icons-material/BrightnessAutoRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { Box, Tooltip, useColorScheme } from '@mui/material';
import { motion } from './tokens/motion';

export type ThemePreference = 'light' | 'dark' | 'system';

const OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: 'light', label: 'روشن', icon: <LightModeRoundedIcon fontSize="small" /> },
  { value: 'dark', label: 'تیره', icon: <DarkModeRoundedIcon fontSize="small" /> },
  { value: 'system', label: 'سیستمی', icon: <BrightnessAutoRoundedIcon fontSize="small" /> },
];

export function ThemeSwitch({
  'data-testid': testId = 'theme-switch',
}: {
  'data-testid'?: string;
}) {
  const { mode, setMode } = useColorScheme();
  const current: ThemePreference = mode === 'light' || mode === 'dark' ? mode : 'system';

  return (
    <Box
      role="group"
      aria-label="انتخاب حالت نمایش"
      data-testid={testId}
      sx={{
        display: 'inline-flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0.5,
        p: 0.5,
        borderRadius: '999px',
        backgroundColor: 'action.hover',
      }}
    >
      {OPTIONS.map((option) => {
        const selected = current === option.value;
        return (
          <Tooltip key={option.value} title={option.label} placement="bottom">
            <Box
              component="button"
              type="button"
              aria-label={`حالت ${option.label}`}
              aria-pressed={selected}
              data-value={option.value}
              onClick={() => setMode(option.value)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                minWidth: 40,
                minHeight: 40,
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                backgroundColor: selected ? 'primaryContainer' : 'transparent',
                color: selected ? 'onPrimaryContainer' : 'onSurfaceVariant',
                transition: `background-color ${motion.duration.durationFast}ms ${motion.easing.easingStandard}, color ${motion.duration.durationFast}ms ${motion.easing.easingStandard}`,
                '&:hover': { backgroundColor: selected ? 'primaryContainer' : 'action.hover' },
              }}
            >
              {option.icon}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
