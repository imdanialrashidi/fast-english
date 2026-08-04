// app/src/features/operator/components/OperatorStatusChip.tsx
// Request status chip: always icon + text (never color alone), colored
// only through the semantic status tokens. Used in queue items and the
// request detail.

import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import { Chip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { type StatusMeta, statusMeta } from '../logic';

const ICONS: Record<StatusMeta['icon'], typeof ScheduleRoundedIcon> = {
  schedule: ScheduleRoundedIcon,
  check: CheckCircleRoundedIcon,
  cancel: CancelRoundedIcon,
  block: BlockRoundedIcon,
};

const TONE_SX: Record<StatusMeta['tone'], SxProps<Theme>> = {
  pending: {
    backgroundColor: 'var(--mui-palette-warningContainer)',
    color: 'var(--mui-palette-onWarningContainer)',
    '& .MuiChip-icon': { color: 'var(--mui-palette-onWarningContainer)' },
  },
  approved: {
    backgroundColor: 'var(--mui-palette-successContainer)',
    color: 'var(--mui-palette-onSuccessContainer)',
    '& .MuiChip-icon': { color: 'var(--mui-palette-onSuccessContainer)' },
  },
  rejected: {
    backgroundColor: 'var(--mui-palette-errorContainer)',
    color: 'var(--mui-palette-onErrorContainer)',
    '& .MuiChip-icon': { color: 'var(--mui-palette-onErrorContainer)' },
  },
  neutral: {
    backgroundColor: 'var(--mui-palette-surfaceContainerHighest)',
    color: 'var(--mui-palette-onSurfaceVariant)',
    '& .MuiChip-icon': { color: 'var(--mui-palette-onSurfaceVariant)' },
  },
};

export function OperatorStatusChip({
  status,
  size = 'small',
}: {
  status: string;
  size?: 'small' | 'medium';
}) {
  const meta = statusMeta(status);
  const Icon = ICONS[meta.icon];
  return (
    <Chip
      icon={<Icon fontSize="small" />}
      label={meta.label}
      size={size}
      sx={TONE_SX[meta.tone]}
      data-testid={`status-chip-${status}`}
    />
  );
}
