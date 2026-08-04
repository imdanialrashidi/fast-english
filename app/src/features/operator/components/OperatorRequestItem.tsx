// app/src/features/operator/components/OperatorRequestItem.tsx
// One queue row. Shows only the most useful scan information: safe user
// identity, plan, amount, submission time, status. The whole row is a
// single button (keyboard selectable, Enter/Space) with no nested
// interactive controls. Selection is conveyed by shape (indicator bar),
// semantics (`aria-current`) and a tonal background — never color alone.

import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { duration, easing } from '../../../app/theme/tokens';
import { formatAge, formatDateTime, formatToman } from '../formatters';
import type { QueueItem } from '../types';
import { OperatorStatusChip } from './OperatorStatusChip';

interface Props {
  item: QueueItem;
  selected: boolean;
  onOpen: (id: string) => void;
}

export function OperatorRequestItem({ item, selected, onOpen }: Props) {
  // The Backend currently returns empty system timestamps (`created`) on
  // this PB version; show the most meaningful real time available —
  // the submission time when present, otherwise the reported transfer
  // time — and never a fabricated date.
  const timeLine = item.created
    ? `${formatDateTime(item.created)} — ${formatAge(item.requestAgeSeconds)}`
    : item.transferAt
      ? `انتقال: ${formatDateTime(item.transferAt)}`
      : null;
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <ButtonBase
        component="button"
        type="button"
        onClick={() => onOpen(item.id)}
        aria-current={selected ? 'true' : undefined}
        data-selected={selected ? 'true' : 'false'}
        data-testid={`operator-request-item-${item.id}`}
        sx={{
          display: 'block',
          width: '100%',
          textAlign: 'start',
          minHeight: 64,
          px: 2,
          py: 1.5,
          borderRadius: '12px',
          position: 'relative',
          transition: `background-color ${duration.durationFast}ms ${easing.easingStandard}`,
          backgroundColor: selected ? 'var(--mui-palette-surfaceContainerHighest)' : 'transparent',
          '&:hover': {
            backgroundColor: 'var(--mui-palette-surfaceContainerHigh)',
          },
          // Shape indicator for the selected state (visible in Light and
          // Dark, independent of color contrast).
          '&::before': {
            content: '""',
            position: 'absolute',
            insetInlineStart: 0,
            top: '25%',
            bottom: '25%',
            width: 4,
            borderRadius: '999px',
            backgroundColor: 'var(--mui-palette-primary-main)',
            opacity: selected ? 1 : 0,
            transition: `opacity ${duration.durationFast}ms ${easing.easingStandard}`,
          },
        }}
      >
        <Stack sx={{ gap: 0.75 }}>
          <Stack
            sx={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography
              variant="body1"
              sx={{
                fontWeight: 600,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={item.student.name}
            >
              {item.student.name || 'بدون نام'}
            </Typography>
            <Box sx={{ flexShrink: 0 }}>
              <OperatorStatusChip status={item.status} />
            </Box>
          </Stack>
          <Stack
            sx={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 1,
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.student.maskedPhone || ''}
              {item.student.maskedPhone && item.planName ? ' — ' : ''}
              {item.planName}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatToman(item.amountToman)}
            </Typography>
          </Stack>
          {timeLine ? (
            <Typography variant="caption" color="text.secondary">
              {timeLine}
            </Typography>
          ) : null}
        </Stack>
      </ButtonBase>
    </Box>
  );
}
