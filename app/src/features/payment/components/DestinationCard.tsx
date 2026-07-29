// app/src/features/payment/components/DestinationCard.tsx
// Display the active payment destination card. The card number is
// formatted with Arabic comma (RTL-safe), uses LTR direction so the
// digits always read left-to-right, and supports keyboard copy.

import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { Box, Card, CardContent, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import { formatCardNumber } from '../formatters';
import type { PaymentDestination } from '../types';

export function DestinationCard({ destination }: { destination: PaymentDestination }) {
  const [copied, setCopied] = useState(false);
  const formatted = formatCardNumber(destination.cardNumber);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(destination.cardNumber);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      // Clipboard write failed (e.g. insecure context). Stay silent
      // — the card number remains visible and selectable.
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography component="h2" variant="h4">
            مقصد پرداخت
          </Typography>
          <Box>
            <Typography variant="caption" color="text.secondary" component="div">
              شمارهٔ کارت
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <Typography
                lang="en"
                dir="ltr"
                component="div"
                sx={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  fontVariantNumeric: 'tabular-nums',
                  textAlign: 'start',
                  userSelect: 'all',
                }}
                aria-label={`شمارهٔ کارت ${formatted}`}
              >
                {formatted}
              </Typography>
              <Tooltip title={copied ? 'کپی شد' : 'کپی شمارهٔ کارت'} arrow>
                <span>
                  <IconButton
                    onClick={handleCopy}
                    aria-label="کپی شمارهٔ کارت"
                    size="small"
                    sx={{ minWidth: 44, minHeight: 44 }}
                  >
                    <ContentCopyRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              {copied ? (
                <Typography
                  variant="caption"
                  color="success.main"
                  role="status"
                  aria-live="polite"
                  sx={{ fontWeight: 600 }}
                >
                  کپی شد
                </Typography>
              ) : null}
            </Stack>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" component="div">
              نام دارندهٔ کارت
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              {destination.cardHolderName}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" component="div">
              نام بانک
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              {destination.bankName}
            </Typography>
          </Box>
          {destination.instructions ? (
            <Box>
              <Typography variant="caption" color="text.secondary" component="div">
                راهنمای انتقال
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, whiteSpace: 'pre-line' }}
              >
                {destination.instructions}
              </Typography>
            </Box>
          ) : null}
          {destination.supportContact ? (
            <Box>
              <Typography variant="caption" color="text.secondary" component="div">
                راه ارتباطی پشتیبانی
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
                dir="ltr"
                lang="en"
              >
                {destination.supportContact}
              </Typography>
            </Box>
          ) : null}
          {destination.reviewSlaText ? (
            <Box>
              <Typography variant="caption" color="text.secondary" component="div">
                زمان تقریبی بررسی
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {destination.reviewSlaText}
              </Typography>
            </Box>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
