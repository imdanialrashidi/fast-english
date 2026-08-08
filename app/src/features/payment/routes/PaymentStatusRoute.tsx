// app/src/features/payment/routes/PaymentStatusRoute.tsx
// Real-time status workspace of the student's current payment
// request. States: none, pending, rejected, approved, cancelled —
// each driven by the real backend payload, never by client-side
// assumptions. After a successful submission the form is replaced
// by this workspace, so the user always knows whether the receipt
// was received and what happens next.

import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { loadCurrentRequest } from '../api';
import { PaymentApprovedPanel } from '../components/PaymentApprovedPanel';
import { PaymentErrorPanel } from '../components/PaymentErrorPanel';
import { PaymentJourney } from '../components/PaymentJourney';
import { PaymentRejectedPanel } from '../components/PaymentRejectedPanel';
import { PaymentRequestSummary } from '../components/PaymentRequestSummary';
import { PaymentStatusTimeline } from '../components/PaymentStatusTimeline';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { StatusBadge } from '../components/StatusBadge';
import { toPaymentError } from '../errors';
import { formatDurationDays, formatToman } from '../formatters';
import type { CurrentRequestResponse, PaymentError as PaymentErrorModel } from '../types';

type StatusState =
  | { kind: 'loading' }
  | { kind: 'ready'; response: CurrentRequestResponse }
  | { kind: 'error'; error: PaymentErrorModel; lastKnownRequestId?: string };

export function PaymentStatusRoute() {
  const navigate = useNavigate();
  const [state, setState] = useState<StatusState>({ kind: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);
  // Kept across refreshes so an error surface can still offer the
  // last known request id as a support code (future request tracing).
  const lastRequestIdRef = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, kind: 'loading' as const }));
    try {
      const res = await loadCurrentRequest();
      if (res.kind === 'request') {
        lastRequestIdRef.current = res.request.id;
        // Expose the latest request id for end-to-end tests. The
        // window attribute is set only when Vite's `import.meta.env.DEV`
        // is true (development builds), so production bundles never
        // include this assignment.
        if (import.meta.env.DEV) {
          try {
            const w = window as unknown as { __fepLastRequestId?: string };
            w.__fepLastRequestId = res.request.id;
          } catch {
            // SSR / no window — ignore.
          }
        }
      }
      setState({ kind: 'ready', response: res });
    } catch (e) {
      setState({
        kind: 'error',
        error: toPaymentError(e),
        lastKnownRequestId: lastRequestIdRef.current,
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (state.kind === 'loading') {
    return (
      <PageContainer maxWidth="md">
        <PageHeader title="وضعیت پرداخت" />
        <StatePanel variant="loading" title="در حال بارگذاری وضعیت…" />
      </PageContainer>
    );
  }

  if (state.kind === 'error') {
    return (
      <PageContainer maxWidth="md">
        <PageHeader title="وضعیت پرداخت" />
        <PaymentErrorPanel
          error={state.error}
          requestId={state.lastKnownRequestId}
          retryLabel="تلاش دوباره"
          onRetry={() => setRefreshKey((n) => n + 1)}
        />
      </PageContainer>
    );
  }

  const { response } = state;

  if (response.kind === 'none') {
    return (
      <PageContainer maxWidth="md">
        <PageHeader title="وضعیت پرداخت" />
        <StatePanel
          variant="empty"
          title="هنوز درخواستی ثبت نکرده‌اید"
          description="برای فعال‌سازی حساب، ابتدا یک رسید پرداخت ارسال کنید."
          action={
            <Button
              variant="contained"
              onClick={() => navigate('/payment')}
              endIcon={<ArrowForwardRoundedIcon sx={{ transform: 'scaleX(-1)' }} />}
              sx={{ minHeight: 48 }}
            >
              رفتن به صفحهٔ پرداخت
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const request = response.request;

  return (
    <PageContainer maxWidth="md">
      <PageHeader
        title="وضعیت پرداخت"
        subtitle={`طرح: ${request.planName}`}
        action={<StatusBadge status={request.status} />}
      />

      <Stack
        spacing={2.5}
        aria-live="polite"
        data-testid="payment-status-workspace"
        sx={{ width: '100%' }}
      >
        <PaymentJourney
          activeStep={4}
          completedSteps={request.status === 'cancelled' ? 2 : 4}
          tone={request.status === 'rejected' ? 'error' : 'default'}
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="text"
            size="small"
            startIcon={<RefreshRoundedIcon />}
            onClick={() => setRefreshKey((n) => n + 1)}
            sx={{ minHeight: 44 }}
            data-testid="refresh-status"
          >
            بررسی مجدد وضعیت
          </Button>
        </Box>

        {request.status === 'pending' ? <PendingPanel request={request} /> : null}
        {request.status === 'rejected' ? <PaymentRejectedPanel request={request} /> : null}
        {request.status === 'approved' ? <PaymentApprovedPanel request={request} /> : null}
        {request.status === 'cancelled' ? <CancelledPanel request={request} /> : null}
      </Stack>
    </PageContainer>
  );
}

function PendingPanel({ request }: { request: import('../types').PaymentRequest }) {
  const [showPreview, setShowPreview] = useState(false);
  const planSummary = `${formatToman(request.amountToman)} تومان • ${formatDurationDays(request.durationDays)}`;

  return (
    <>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography component="h2" variant="h4">
              در انتظار بررسی
            </Typography>
            <Alert severity="info" role="status" data-testid="pending-alert">
              رسید شما دریافت شد و هم‌اکنون ثبت شده است. رسید به‌صورت دستی بررسی می‌شود؛ پرداخت به‌صورت
              خودکار تأیید نمی‌شود و اشتراک فقط پس از تأیید فعال می‌شود.
            </Alert>
            <PaymentStatusTimeline
              status={request.status}
              created={request.created}
              updated={request.updated}
            />
            <PaymentRequestSummary request={request} />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography component="h2" variant="h4">
              رسید ثبت‌شده
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {planSummary} — اگر رسید را اشتباه ثبت کرده‌اید، منتظر نتیجهٔ بررسی بمانید؛ ارسال تکراری
              ممکن نیست.
            </Typography>
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
                مشاهدهٔ رسید (فقط برای شما)
              </Typography>
              <Button
                size="small"
                variant={showPreview ? 'contained' : 'outlined'}
                onClick={() => setShowPreview((v) => !v)}
                sx={{ minHeight: 44 }}
              >
                {showPreview ? 'پنهان کردن رسید' : 'نمایش رسید'}
              </Button>
            </Stack>
            {showPreview ? (
              <ReceiptPreview
                recordId={request.receipt.recordId}
                fileName={request.receipt.fileName}
                show
              />
            ) : null}
            <Typography variant="caption" color="text.secondary">
              فقط داشتنِ تصویر رسید به‌تنهایی اثبات‌کنندهٔ پرداخت نیست؛ پرداخت با اطلاعات بانکی تطبیق
              می‌دهد. نتیجه پس از بررسی در همین صفحه نمایش داده می‌شود.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}

function CancelledPanel({ request }: { request: import('../types').PaymentRequest }) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography component="h2" variant="h4">
            این درخواست لغو شده است
          </Typography>
          <PaymentStatusTimeline
            status={request.status}
            created={request.created}
            updated={request.updated}
          />
          <Typography variant="body2" color="text.secondary">
            این درخواست لغو شده است. برای ادامه، یک رسید جدید ارسال کنید.
          </Typography>
          <Box sx={{ pt: 1 }}>
            <Button
              variant="contained"
              onClick={() => navigate('/payment')}
              endIcon={<ArrowForwardRoundedIcon sx={{ transform: 'scaleX(-1)' }} />}
              sx={{ minHeight: 48 }}
            >
              ارسال درخواست جدید
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
