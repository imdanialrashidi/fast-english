// app/src/features/payment/components/PaymentRejectedPanel.tsx
// The rejected-request state. Semantic error styling is applied only
// around the relevant reason and status — never to the whole screen.
// Shows the public rejection reason (wrapping), the original request
// time, the last update time, a safe preview of the previous receipt,
// the exact next action and a resubmission CTA that creates a NEW
// request (the rejected record is never mutated).

import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatPersianDateTime } from '../formatters';
import type { PaymentRequest } from '../types';
import { PaymentRequestSummary } from './PaymentRequestSummary';
import { PaymentStatusTimeline } from './PaymentStatusTimeline';
import { ReceiptPreview } from './ReceiptPreview';

export function PaymentRejectedPanel({ request }: { request: PaymentRequest }) {
  const navigate = useNavigate();
  const [showPreview, setShowPreview] = useState(false);

  return (
    <Card data-testid="rejected-panel">
      <CardContent>
        <Stack spacing={2.5}>
          <Typography component="h2" variant="h4">
            این درخواست قبلی رد شده است
          </Typography>

          <PaymentStatusTimeline
            status={request.status}
            created={request.created}
            updated={request.updated}
          />

          {/* Semantic error container: only around the reason + status. */}
          <Box
            role="alert"
            data-testid="rejection-reason"
            sx={{
              p: 2,
              borderRadius: '16px',
              border: 1,
              borderColor: 'var(--mui-palette-errorContainer)',
              backgroundColor: 'var(--mui-palette-errorContainer)',
              color: 'var(--mui-palette-onErrorContainer)',
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <ErrorOutlineRoundedIcon sx={{ fontSize: 20, mt: 0.25, flexShrink: 0 }} aria-hidden />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  دلیل رد درخواست
                </Typography>
                {request.publicRejectionReason ? (
                  <Typography
                    variant="body2"
                    sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}
                  >
                    {request.publicRejectionReason}
                  </Typography>
                ) : (
                  <Typography variant="body2">
                    دلیل مشخصی ثبت نشده است؛ برای جزئیات بیشتر با پشتیبانی تماس بگیرید.
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
              زمان ثبت درخواست: {formatPersianDateTime(request.created) || '—'}
            </Typography>
            {request.updated ? (
              <Typography variant="caption" color="text.secondary" component="div">
                آخرین به‌روزرسانی: {formatPersianDateTime(request.updated) || '—'}
              </Typography>
            ) : null}
          </Box>

          <PaymentRequestSummary request={request} />

          <Stack spacing={1}>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                pt: 1,
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                رسید قبلی (فقط مشاهده)
              </Typography>
              <Button
                size="small"
                variant={showPreview ? 'contained' : 'outlined'}
                onClick={() => setShowPreview((v) => !v)}
                sx={{ minHeight: 44 }}
              >
                {showPreview ? 'پنهان کردن رسید قبلی' : 'نمایش رسید قبلی'}
              </Button>
            </Stack>
            {showPreview ? (
              <ReceiptPreview
                recordId={request.receipt.recordId}
                fileName={request.receipt.fileName}
                show
              />
            ) : null}
          </Stack>

          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              درخواست ردشده نزد ما بایگانی می‌شود و تغییر نمی‌کند. برای فعال‌سازی حساب، یک رسید جدید
              ارسال کنید؛ درخواست جدید جداگانه بررسی می‌شود و رسید قبلی به‌صورت خودکار استفاده نمی‌شود.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/payment')}
              endIcon={<ArrowForwardRoundedIcon sx={{ transform: 'scaleX(-1)' }} />}
              sx={{ minHeight: 48 }}
              data-testid="resubmit-cta"
            >
              ارسال درخواست جدید
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
