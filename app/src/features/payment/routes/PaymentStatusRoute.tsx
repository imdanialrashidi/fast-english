// app/src/features/payment/routes/PaymentStatusRoute.tsx
// Real-time status of the student's current payment request.
// States: none, pending, rejected, approved, cancelled. Approved is
// display-only (P1-S2 owns activation).

import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageContainer } from '../../../app/shell/PageContainer';
import { PageHeader } from '../../../app/shell/PageHeader';
import { StatePanel } from '../../../app/shell/StatePanel';
import { loadCurrentRequest } from '../api';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { StatusBadge } from '../components/StatusBadge';
import { toPaymentError } from '../errors';
import {
  formatDurationDays,
  formatLastFour,
  formatPersianDateTime,
  formatToman,
} from '../formatters';
import type { CurrentRequestResponse, PaymentError as PaymentErrorModel } from '../types';

type StatusState =
  | { kind: 'loading' }
  | { kind: 'ready'; response: CurrentRequestResponse }
  | { kind: 'error'; error: PaymentErrorModel };

export function PaymentStatusRoute() {
  const navigate = useNavigate();
  const [state, setState] = useState<StatusState>({ kind: 'loading' });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await loadCurrentRequest();
        if (cancelled) return;
        setState({ kind: 'ready', response: res });
        // Expose the latest request id for end-to-end tests. The
        // window attribute is set only when Vite's `import.meta.env.DEV`
        // is true (development builds), so production bundles never
        // include this assignment.
        if (import.meta.env.DEV && res.kind === 'request') {
          try {
            const w = window as unknown as { __fepLastRequestId?: string };
            w.__fepLastRequestId = res.request.id;
          } catch {
            // SSR / no window — ignore.
          }
        }
      } catch (e) {
        if (cancelled) return;
        setState({ kind: 'error', error: toPaymentError(e) });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <PageContainer maxWidth="sm">
        <PageHeader title="وضعیت پرداخت" />
        <StatePanel variant="loading" title="در حال بارگذاری وضعیت…" />
      </PageContainer>
    );
  }

  if (state.kind === 'error') {
    return (
      <PageContainer maxWidth="sm">
        <PageHeader title="وضعیت پرداخت" />
        <StatePanel
          variant="error"
          title="بارگذاری وضعیت ناموفق بود"
          description={state.error.message}
          action={
            <Button
              variant="outlined"
              onClick={() => window.location.reload()}
              sx={{ minHeight: 44 }}
            >
              تلاش دوباره
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const { response } = state;

  if (response.kind === 'none') {
    return (
      <PageContainer maxWidth="sm">
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
  const planSummary = `${formatToman(request.amountToman)} تومان • ${formatDurationDays(request.durationDays)}`;

  return (
    <PageContainer maxWidth="sm">
      <PageHeader
        title="وضعیت پرداخت"
        subtitle={`طرح: ${request.planName}`}
        action={<StatusBadge status={request.status} />}
      />

      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography component="h2" variant="h4">
                خلاصهٔ درخواست
              </Typography>
              <SummaryRow label="نام طرح" value={request.planName} />
              <SummaryRow label="مبلغ" value={`${formatToman(request.amountToman)} تومان`} />
              <SummaryRow label="مدت اشتراک" value={formatDurationDays(request.durationDays)} />
              <SummaryRow label="زمان ثبت" value={formatPersianDateTime(request.created) || '—'} />
              {request.senderCardLast4 ? (
                <SummaryRow
                  label="چهار رقم کارت مبدأ"
                  value={formatLastFour(request.senderCardLast4) || '—'}
                />
              ) : null}
              {request.bankReference ? (
                <SummaryRow label="شمارهٔ پیگیری" value={request.bankReference} />
              ) : null}
              {request.transferAt ? (
                <SummaryRow
                  label="زمان واریز"
                  value={formatPersianDateTime(request.transferAt) || '—'}
                />
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        {request.status === 'pending' ? (
          <PendingPanel
            request={request}
            planSummary={planSummary}
            showPreview={showPreview}
            setShowPreview={setShowPreview}
          />
        ) : null}
        {request.status === 'rejected' ? (
          <RejectedPanel
            request={request}
            showPreview={showPreview}
            setShowPreview={setShowPreview}
          />
        ) : null}
        {request.status === 'approved' ? <ApprovedPanel /> : null}
        {request.status === 'cancelled' ? <CancelledPanel /> : null}
      </Stack>
    </PageContainer>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 500, textAlign: 'end', maxWidth: '60%', wordBreak: 'break-word' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function PendingPanel({
  request,
  planSummary,
  showPreview,
  setShowPreview,
}: {
  request: import('../types').PaymentRequest;
  planSummary: string;
  showPreview: boolean;
  setShowPreview: (v: boolean) => void;
}) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography component="h2" variant="h4">
            در انتظار بررسی اپراتور
          </Typography>
          <Typography variant="body2" color="text.secondary">
            رسید شما ثبت شد. اپراتور پس از بررسی، وضعیت حساب شما را به «تأیید شده» تغییر می‌دهد و
            دسترسی به درس‌ها فعال می‌شود.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            فقط داشتنِ تصویر رسید به‌تنهایی اثبات‌کنندهٔ پرداخت نیست؛ اپراتور پرداخت را با اطلاعات بانکی
            شما تطبیق می‌دهد.
          </Typography>

          <Stack
            direction="row"
            spacing={1}
            sx={{ pt: 1, alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography variant="body2" color="text.secondary">
              رسید ثبت‌شده ({planSummary})
            </Typography>
            <Button
              size="small"
              variant={showPreview ? 'contained' : 'outlined'}
              onClick={() => setShowPreview(!showPreview)}
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
        </Stack>
      </CardContent>
    </Card>
  );
}

function RejectedPanel({
  request,
  showPreview,
  setShowPreview,
}: {
  request: import('../types').PaymentRequest;
  showPreview: boolean;
  setShowPreview: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography component="h2" variant="h4">
            این درخواست قبلی رد شده است
          </Typography>
          {request.publicRejectionReason ? (
            <Alert severity="error" role="alert" data-testid="rejection-reason">
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                دلیل رد:
              </Typography>
              <Typography variant="body2">{request.publicRejectionReason}</Typography>
            </Alert>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            درخواست ردشده نزد ما بایگانی می‌شود و تغییر نمی‌کند. برای فعال‌سازی حساب، یک رسید جدید
            ارسال کنید تا یک درخواست تازه ثبت شود.
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ pt: 1, alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography variant="body2" color="text.secondary">
              رسید قبلی (فقط مشاهده)
            </Typography>
            <Button
              size="small"
              variant={showPreview ? 'contained' : 'outlined'}
              onClick={() => setShowPreview(!showPreview)}
              sx={{ minHeight: 44 }}
            >
              {showPreview ? 'پنهان کردن رسید' : 'نمایش رسید قبلی'}
            </Button>
          </Stack>
          {showPreview ? (
            <ReceiptPreview
              recordId={request.receipt.recordId}
              fileName={request.receipt.fileName}
              show
            />
          ) : null}
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

function ApprovedPanel() {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography component="h2" variant="h4">
            پرداخت تأیید شده است
          </Typography>
          <Alert severity="success" role="status">
            پرداخت شما توسط اپراتور تأیید شد. فعال‌سازی کامل حساب (ایجاد اشتراک و فعال شدن دسترسی‌ها)
            در اسلایس بعدی محصول (P1-S2) انجام می‌شود. در حال حاضر این صفحه فقط نمایشی است.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            هیچ اشتراکی به‌صورت خودکار در این اسلایس ساخته نمی‌شود، حساب شما به‌طور خودکار فعال نمی‌شود،
            و به درس‌ها یا آزمون تعیین سطح دسترسی پیدا نمی‌کنید.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function CancelledPanel() {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography component="h2" variant="h4">
            این درخواست لغو شده است
          </Typography>
          <Typography variant="body2" color="text.secondary">
            این درخواست توسط اپراتور یا سامانه لغو شده است. برای ادامه، یک رسید جدید ارسال کنید.
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
