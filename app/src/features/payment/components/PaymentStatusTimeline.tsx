// app/src/features/payment/components/PaymentStatusTimeline.tsx
// Vertical status timeline for the payment request workspace.
//
// Nodes reflect the real backend status only:
//   pending  → رسید ارسال شد ✓ → بررسی دستی (active) → نتیجه بررسی (upcoming)
//   rejected → رسید ارسال شد ✓ → بررسی دستی ✓ → نتیجه بررسی (error)
//   approved → رسید ارسال شد ✓ → بررسی دستی ✓ → پرداخت تأیید شد (success)
//   cancelled→ رسید ارسال شد ✓ → درخواست لغو شد (neutral)
//
// State is never conveyed by color alone: every node carries an
// icon + text. Times shown are authoritative backend timestamps.

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import { Box, Stack, Typography } from '@mui/material';
import { duration, easing } from '../../../../../shared/ui/tokens';
import { formatPersianDateTime } from '../formatters';
import type { PaymentStatus } from '../types';

interface NodeDef {
  icon: React.ReactNode;
  title: string;
  description?: string;
  time?: string | null;
  circleBg: string;
  circleColor: string;
  lineBg: string;
}

function Circle({ node }: { node: NodeDef }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: `background-color ${duration.durationStandard}ms ${easing.easingStandard}`,
        backgroundColor: node.circleBg,
        color: node.circleColor,
        border: 1,
        borderColor: node.circleBg,
      }}
    >
      {node.icon}
    </Box>
  );
}

export function PaymentStatusTimeline({
  status,
  created,
  updated,
}: {
  status: PaymentStatus;
  created: string | null;
  updated: string | null;
}) {
  const receivedTime = formatPersianDateTime(created);
  const updatedTime = formatPersianDateTime(updated);

  const nodes: NodeDef[] = [];
  const base = {
    circleBg: 'var(--mui-palette-primaryContainer)',
    circleColor: 'var(--mui-palette-onPrimaryContainer)',
    lineBg: 'var(--mui-palette-primaryContainer)',
  };

  if (status === 'pending') {
    nodes.push(
      {
        ...base,
        icon: <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />,
        title: 'رسید ارسال شد',
        description: receivedTime ? `زمان ثبت درخواست: ${receivedTime}` : 'زمان ثبت درخواست: —',
        time: receivedTime,
      },
      {
        icon: <HourglassBottomRoundedIcon sx={{ fontSize: 20 }} />,
        title: 'در انتظار بررسی',
        description:
          'رسید شما دریافت شد و به‌صورت دستی بررسی می‌شود. پرداخت به‌صورت خودکار تأیید نمی‌شود.',
        circleBg: 'var(--mui-palette-primary-main)',
        circleColor: 'var(--mui-palette-onPrimary)',
        lineBg: 'var(--mui-palette-surfaceContainerHighest)',
      },
      {
        icon: <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 20 }} />,
        title: 'نتیجهٔ بررسی',
        description: 'نتیجه پس از بررسی در همین صفحه نمایش داده می‌شود.',
        circleBg: 'var(--mui-palette-surfaceContainerHighest)',
        circleColor: 'var(--mui-palette-onSurfaceVariant)',
        lineBg: 'var(--mui-palette-surfaceContainerHighest)',
      },
    );
  } else if (status === 'rejected') {
    nodes.push(
      {
        ...base,
        icon: <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />,
        title: 'رسید ارسال شد',
        description: receivedTime ? `زمان ثبت درخواست: ${receivedTime}` : 'زمان ثبت درخواست: —',
        time: receivedTime,
      },
      {
        ...base,
        icon: <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />,
        title: 'بررسی انجام شد',
        description: updatedTime ? `زمان بررسی: ${updatedTime}` : 'زمان بررسی: —',
        time: updatedTime,
      },
      {
        icon: <ErrorOutlineRoundedIcon sx={{ fontSize: 20 }} />,
        title: 'درخواست رد شد',
        description: 'برای فعال‌سازی حساب، یک رسید جدید ارسال کنید.',
        circleBg: 'var(--mui-palette-errorContainer)',
        circleColor: 'var(--mui-palette-onErrorContainer)',
        lineBg: 'var(--mui-palette-errorContainer)',
      },
    );
  } else if (status === 'approved') {
    nodes.push(
      {
        ...base,
        icon: <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />,
        title: 'رسید ارسال شد',
        description: receivedTime ? `زمان ثبت درخواست: ${receivedTime}` : 'زمان ثبت درخواست: —',
        time: receivedTime,
      },
      {
        ...base,
        icon: <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />,
        title: 'بررسی انجام شد',
        description: updatedTime ? `زمان بررسی: ${updatedTime}` : 'زمان بررسی: —',
        time: updatedTime,
      },
      {
        icon: <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />,
        title: 'پرداخت تأیید شد',
        description: 'پرداخت شما تأیید و اشتراک شما فعال شد.',
        circleBg: 'var(--mui-palette-successContainer)',
        circleColor: 'var(--mui-palette-onSuccessContainer)',
        lineBg: 'var(--mui-palette-successContainer)',
      },
    );
  } else {
    // cancelled
    nodes.push(
      {
        ...base,
        icon: <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />,
        title: 'رسید ارسال شد',
        description: receivedTime ? `زمان ثبت درخواست: ${receivedTime}` : 'زمان ثبت درخواست: —',
        time: receivedTime,
      },
      {
        icon: <RemoveCircleOutlineRoundedIcon sx={{ fontSize: 20 }} />,
        title: 'درخواست لغو شد',
        description: 'این درخواست لغو شده است.',
        circleBg: 'var(--mui-palette-surfaceContainerHighest)',
        circleColor: 'var(--mui-palette-onSurfaceVariant)',
        lineBg: 'var(--mui-palette-surfaceContainerHighest)',
      },
    );
  }

  return (
    <Stack
      spacing={0}
      role="list"
      aria-label="مراحل بررسی درخواست"
      data-testid="payment-status-timeline"
    >
      {nodes.map((node, index) => {
        const isLast = index === nodes.length - 1;
        return (
          <Box
            key={node.title}
            role="listitem"
            aria-label={`${node.title}${node.time ? ` — ${node.time}` : ''}`}
            sx={{ display: 'flex', alignItems: 'stretch', width: '100%' }}
          >
            <Stack sx={{ alignItems: 'center', width: 36, flexShrink: 0 }}>
              <Circle node={node} />
              {!isLast ? (
                <Box
                  aria-hidden
                  sx={{
                    width: 2,
                    flex: '1 1 auto',
                    minHeight: 24,
                    backgroundColor: node.lineBg,
                  }}
                />
              ) : null}
            </Stack>
            <Box sx={{ pb: isLast ? 0 : 3, pr: 2, minWidth: 0 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {node.title}
              </Typography>
              {node.description ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {node.description}
                </Typography>
              ) : null}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
