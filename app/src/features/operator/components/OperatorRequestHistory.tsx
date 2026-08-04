// app/src/features/operator/components/OperatorRequestHistory.tsx
// Bounded lifecycle history of the selected request, built only from
// fields the existing detail API exposes (no cross-request history fetch,
// no unbounded lists, no receipt auto-loading). Rows:
//   submitted → reviewed (operator + time) → outcome details → activation.
// Internal notes are only shown for the selected request (the existing
// operator detail contract already exposes them) and never in any Student
// surface.

import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { Box, Stack, Typography } from '@mui/material';
import { formatDate, formatDateTime, formatToman } from '../formatters';
import type { RequestDetail } from '../types';

export function OperatorRequestHistory({ detail }: { detail: RequestDetail }) {
  const decided = detail.status !== 'pending';
  const activated =
    detail.status === 'approved' && (detail.currentActiveSubscription ?? detail.latestSubscription);

  return (
    <Stack sx={{ gap: 1.5 }} data-testid="request-history">
      <Typography variant="subtitle2">تاریخچهٔ درخواست</Typography>
      <Stack sx={{ gap: 0 }}>
        {detail.created ? (
          <HistoryRow
            icon={<SendRoundedIcon fontSize="small" />}
            title="ارسال درخواست"
            detail={formatDateTime(detail.created)}
          />
        ) : null}
        {decided ? (
          <HistoryRow
            icon={<FactCheckRoundedIcon fontSize="small" />}
            title={detail.status === 'approved' ? 'بررسی و تأیید' : 'بررسی و رد'}
            detail={[
              detail.reviewer?.name ? `توسط ${detail.reviewer.name}` : null,
              detail.reviewedAt ? formatDateTime(detail.reviewedAt) : null,
            ]
              .filter(Boolean)
              .join(' — ')}
          />
        ) : null}
        {detail.status === 'rejected' && detail.publicRejectionReason ? (
          <HistoryRow title="دلیل رد (عمومی)" detail={detail.publicRejectionReason} wrap />
        ) : null}
        {activated ? (
          <HistoryRow
            icon={<WorkspacePremiumRoundedIcon fontSize="small" />}
            title={`فعال‌سازی اشتراک — ${activated.planName || 'پلن'}`}
            detail={`${formatDate(activated.startsAt)} تا ${formatDate(activated.expiresAt)}`}
          />
        ) : null}
        {detail.internalNote ? (
          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              borderRadius: '12px',
              backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
              border: 1,
              borderColor: 'var(--mui-palette-outlineVariant)',
            }}
          >
            <Typography variant="caption" color="text.secondary" component="span">
              یادداشت داخلی
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere', mt: 0.5 }}>
              {detail.internalNote}
            </Typography>
          </Box>
        ) : null}
        {detail.status === 'rejected' ? (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            مبلغ درخواست: {formatToman(detail.amountToman)}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  );
}

function HistoryRow({
  icon,
  title,
  detail,
  wrap = false,
}: {
  icon?: React.ReactNode;
  title: string;
  detail: string;
  wrap?: boolean;
}) {
  return (
    <Stack sx={{ flexDirection: 'row', gap: 1.5, py: 0.75, alignItems: 'flex-start' }}>
      <Box
        aria-hidden
        sx={{
          mt: 0.25,
          color: 'var(--mui-palette-primary-main)',
          display: 'flex',
        }}
      >
        {icon}
      </Box>
      <Stack sx={{ gap: 0.25, minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={wrap ? { overflowWrap: 'anywhere' } : undefined}
        >
          {detail}
        </Typography>
      </Stack>
    </Stack>
  );
}
