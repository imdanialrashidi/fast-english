// app/src/features/operator/components/OperatorDecisionPanel.tsx
// The two primary decision outcomes. Approve carries the positive
// emphasis (contained primary), Reject the destructive emphasis (outlined
// error with forced semantic colors) — never two equally positive
// buttons. Actions are separated, full height (44px minimum), and stacked
// vertically on narrow phones to prevent accidental taps. Only rendered
// for pending requests, after the receipt and payment context.

import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';

interface Props {
  onApprove: () => void;
  onReject: () => void;
}

export function OperatorDecisionPanel({ onApprove, onReject }: Props) {
  return (
    <Card data-testid="operator-decision-panel" sx={{ borderColor: 'var(--mui-palette-outline)' }}>
      <CardContent>
        <Stack sx={{ gap: 1.5 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
              تصمیم‌گیری
            </Typography>
            <Typography variant="caption" color="text.secondary">
              پس از بررسی رسید و اطلاعات پرداخت اقدام کنید. هر دو اقدام نیاز به تأیید نهایی دارند.
            </Typography>
          </Box>
          <Stack
            sx={{
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 1, sm: 2 },
            }}
          >
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<CheckCircleRoundedIcon />}
              onClick={onApprove}
              data-testid="operator-approve-open"
              sx={{ flex: { xs: '1 1 auto', sm: '1 1 0' }, minHeight: 48 }}
            >
              تأیید
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="large"
              startIcon={<CancelRoundedIcon />}
              onClick={onReject}
              data-testid="operator-reject-open"
              sx={{
                flex: { xs: '1 1 auto', sm: '1 1 0' },
                minHeight: 48,
                // Guarantee the destructive emphasis even where theme
                // overrides target the generic outlined variant.
                borderColor: 'var(--mui-palette-error-main)',
                color: 'var(--mui-palette-error-main)',
                '&:hover': {
                  borderColor: 'var(--mui-palette-error-main)',
                  backgroundColor:
                    'color-mix(in srgb, var(--mui-palette-error-main) 8%, transparent)',
                },
              }}
            >
              رد
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
