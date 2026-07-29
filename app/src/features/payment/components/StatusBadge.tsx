// app/src/features/payment/components/StatusBadge.tsx
// Status badge for a payment request. Always icon + text; never
// color alone.

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import { Chip } from '@mui/material';
import type { PaymentStatus } from '../types';

interface BadgeMeta {
  label: string;
  color: 'success' | 'warning' | 'error' | 'default';
  Icon: typeof CheckCircleRoundedIcon;
}

const META: Record<PaymentStatus, BadgeMeta> = {
  pending: {
    label: 'در انتظار بررسی',
    color: 'warning',
    Icon: HourglassBottomRoundedIcon,
  },
  approved: {
    label: 'تأیید شده',
    color: 'success',
    Icon: CheckCircleRoundedIcon,
  },
  rejected: {
    label: 'رد شده',
    color: 'error',
    Icon: ErrorOutlineRoundedIcon,
  },
  cancelled: {
    label: 'لغو شده',
    color: 'default',
    Icon: RemoveCircleOutlineRoundedIcon,
  },
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const meta = META[status];
  const Icon = meta.Icon;
  return (
    <Chip
      icon={<Icon />}
      label={meta.label}
      color={meta.color}
      variant="filled"
      aria-label={`وضعیت: ${meta.label}`}
      sx={{ fontWeight: 600 }}
    />
  );
}
