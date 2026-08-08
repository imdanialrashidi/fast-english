// ThemeSwitch: Light / Dark / System control.
//
// Uses MUI `useColorScheme` (single source of mode state, localStorage
// persistence under the `mode` key, cross-tab sync). A segmented control
// with three options — never a binary switch — so `system` is representable.
// Keyboard accessible (buttons), each option has a tooltip + accessible name,
// and the active option carries `aria-pressed`.
//
// `labeled` renders a wider segmented group with visible labels and the
// documented caption for the System option (used in Account settings);
// the compact icon-only form stays the default everywhere else.

import BrightnessAutoRoundedIcon from '@mui/icons-material/BrightnessAutoRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { Box, Stack, Tooltip, Typography, useColorScheme } from '@mui/material';
import { motion } from './tokens/motion';

export type ThemePreference = 'light' | 'dark' | 'system';

const OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  /** Visible label (labeled variant). */
  label: string;
  /** Accessible-name suffix — kept stable for existing e2e assertions. */
  a11yLabel: string;
  caption?: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'light',
    label: 'روشن',
    a11yLabel: 'روشن',
    icon: <LightModeRoundedIcon fontSize="small" />,
  },
  {
    value: 'dark',
    label: 'تاریک',
    a11yLabel: 'تیره',
    icon: <DarkModeRoundedIcon fontSize="small" />,
  },
  {
    value: 'system',
    label: 'سیستم',
    a11yLabel: 'سیستمی',
    caption: 'هماهنگ با تنظیمات دستگاه',
    icon: <BrightnessAutoRoundedIcon fontSize="small" />,
  },
];

export function ThemeSwitch({
  'data-testid': testId = 'theme-switch',
  labeled = false,
}: {
  'data-testid'?: string;
  labeled?: boolean;
}) {
  const { mode, setMode } = useColorScheme();
  const current: ThemePreference = mode === 'light' || mode === 'dark' ? mode : 'system';

  if (labeled) {
    return (
      <Box
        role="group"
        aria-label="انتخاب حالت نمایش"
        data-testid={testId}
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'stretch',
          gap: 1,
          width: '100%',
        }}
      >
        {OPTIONS.map((option) => {
          const selected = current === option.value;
          return (
            <Box
              key={option.value}
              component="button"
              type="button"
              aria-label={`حالت ${option.a11yLabel}`}
              aria-pressed={selected}
              data-value={option.value}
              onClick={() => setMode(option.value)}
              sx={{
                flex: { xs: '1 1 auto', sm: 1 },
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minHeight: 44,
                px: 1.5,
                py: 1,
                borderRadius: '12px',
                border: '1px solid',
                borderColor: selected ? 'primary.main' : 'outlineVariant',
                backgroundColor: selected ? 'primaryContainer' : 'transparent',
                color: selected ? 'onPrimaryContainer' : 'onSurfaceVariant',
                cursor: 'pointer',
                textAlign: 'start',
                transition: `background-color ${motion.duration.durationFast}ms ${motion.easing.easingStandard}, border-color ${motion.duration.durationFast}ms ${motion.easing.easingStandard}`,
                '&:hover': {
                  backgroundColor: selected ? 'primaryContainer' : 'action.hover',
                },
              }}
            >
              {option.icon}
              <Stack spacing={0} sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} component="span">
                  {option.label}
                </Typography>
                {option.caption ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="span"
                    sx={{ display: 'block', overflowWrap: 'anywhere' }}
                  >
                    {option.caption}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          );
        })}
      </Box>
    );
  }

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
          <Tooltip key={option.value} title={option.a11yLabel} placement="bottom">
            <Box
              component="button"
              type="button"
              aria-label={`حالت ${option.a11yLabel}`}
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
