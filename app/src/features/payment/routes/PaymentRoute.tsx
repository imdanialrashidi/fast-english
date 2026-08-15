// app/src/features/payment/routes/PaymentRoute.tsx
// Real student payment page. Loads plans and the active destination
// from the backend, walks the user through the five payment stages,
// collects one receipt image with client validation mirroring the
// server, and submits the multipart form to the real P1-S1B route.
//
// Simplified journey (Business Configuration slice): choose plan →
// see the destination card → transfer manually → upload ONE receipt →
// submit. No transaction-reference fields and no confirmation step.
//
// The journey stages reflect real state only:
//   - stage 1 active until a plan is selected
//   - stage 2 active until a receipt is selected
//   - stage 3 (submission) is shown while the request is being sent
//   - stage 4 (result) is owned by /payment-status after success

import { zodResolver } from '@hookform/resolvers/zod';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { useAuth } from '../../../lib/auth';
import { FUNNEL_EVENTS, trackFunnel } from '../../../lib/telemetry';
import {
  createPaymentRequest,
  loadActiveDestination,
  loadActivePlans,
  loadCurrentRequest,
} from '../api';
import { PaymentErrorPanel } from '../components/PaymentErrorPanel';
import { PaymentInstructions } from '../components/PaymentInstructions';
import { PaymentJourney } from '../components/PaymentJourney';
import { PlanSelector } from '../components/PlanSelector';
import { ReceiptPicker } from '../components/ReceiptPicker';
import { toPaymentError } from '../errors';
import { formatDurationDays, formatToman } from '../formatters';
import { type PaymentFormValues, paymentFormSchema } from '../schemas';
import type { PaymentDestination, PaymentError as PaymentErrorModel, Plan } from '../types';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; plans: Plan[]; destination: PaymentDestination | null }
  | { kind: 'error'; error: PaymentErrorModel };

export function PaymentRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [currentRequestKind, setCurrentRequestKind] = useState<
    'none' | 'pending' | 'rejected' | 'other' | 'unknown'
  >('unknown');
  const [submissionError, setSubmissionError] = useState<PaymentErrorModel | null>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    mode: 'onBlur',
    defaultValues: {
      planId: '',
      receiptFile: undefined as unknown as File,
    },
  });

  const selectedPlanId = watch('planId');
  const receiptFile = watch('receiptFile');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plans, destination, current] = await Promise.allSettled([
          loadActivePlans(),
          loadActiveDestination(),
          loadCurrentRequest(),
        ]);
        if (cancelled) return;
        const planList = plans.status === 'fulfilled' ? plans.value : [];
        const dest = destination.status === 'fulfilled' ? destination.value : null;
        if (plans.status === 'rejected') {
          setLoad({ kind: 'error', error: toPaymentError(plans.reason) });
          return;
        }
        if (destination.status === 'rejected') {
          // No destination is a non-fatal "unavailable" UX state.
          const e = toPaymentError(destination.reason);
          if (e.code === 'payment_destination_unavailable') {
            setLoad({ kind: 'ready', plans: planList, destination: null });
          } else {
            setLoad({ kind: 'error', error: e });
            return;
          }
        } else {
          setLoad({ kind: 'ready', plans: planList, destination: dest });
        }
        if (current.status === 'fulfilled') {
          if (current.value.kind === 'none') {
            setCurrentRequestKind('none');
          } else {
            const st = current.value.request.status;
            if (st === 'pending') setCurrentRequestKind('pending');
            else if (st === 'rejected') setCurrentRequestKind('rejected');
            else setCurrentRequestKind('other');
          }
        } else {
          setCurrentRequestKind('unknown');
        }
      } catch (e) {
        if (cancelled) return;
        setLoad({ kind: 'error', error: toPaymentError(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPlan = useMemo(
    () =>
      load.kind === 'ready' ? (load.plans.find((p) => p.id === selectedPlanId) ?? null) : null,
    [load, selectedPlanId],
  );

  // Journey stages (0-based):
  //   0 info, 1 card-to-card, 2 receipt, 3 submit, 4 result
  const journeyActiveStep = selectedPlanId ? (receiptFile ? 2 : 1) : 0;

  const submissionDisabled = useMemo(() => {
    if (isSubmitting) return true;
    if (load.kind !== 'ready') return true;
    if (!load.destination) return true;
    if (load.plans.length === 0) return true;
    if (!selectedPlanId) return true;
    if (!receiptFile) return true;
    return false;
  }, [isSubmitting, load, selectedPlanId, receiptFile]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmissionError(null);
    try {
      const res = await createPaymentRequest({
        planId: values.planId,
        receiptFile: values.receiptFile,
      });
      if (res.kind === 'request') {
        // Funnel telemetry: payment-request submission succeeded. No
        // receipt/transfer/payment data is ever included.
        trackFunnel(FUNNEL_EVENTS.paymentRequestSubmitted, { planId: values.planId });
        // Clear local file + URL (ReceiptPicker revokes on value=null).
        setValue('receiptFile', undefined as unknown as File, { shouldValidate: false });
        reset(
          {
            planId: values.planId,
            receiptFile: undefined as unknown as File,
          },
          { keepValues: false },
        );
        navigate('/payment-status');
      } else {
        setSubmissionError(
          toPaymentError(new Error('پاسخ سرور نامعتبر است. لطفاً صفحه را تازه‌سازی کنید.')),
        );
      }
    } catch (err) {
      const e = toPaymentError(err);
      // Map specific codes back to form fields when applicable.
      if (e.code === 'invalid_receipt') {
        setError('receiptFile', { type: 'server', message: e.message });
      } else if (e.code === 'invalid_plan') {
        setError('planId', { type: 'server', message: e.message });
      } else {
        setSubmissionError(e);
      }
    }
  });

  // Redirect to status when a request already exists: pending,
  // approved or cancelled. The status workspace owns those states;
  // the form is only for users with no request or a rejected one.
  useEffect(() => {
    if (currentRequestKind === 'pending' || currentRequestKind === 'other') {
      navigate('/payment-status', { replace: true });
    }
  }, [currentRequestKind, navigate]);

  if (load.kind === 'loading' || currentRequestKind === 'unknown') {
    return (
      <PageContainer maxWidth="md">
        <PageHeader title="پرداخت" subtitle="در حال بارگذاری طرح‌ها و مقصد پرداخت…" />
        <StatePanel variant="loading" title="در حال بارگذاری…" />
      </PageContainer>
    );
  }

  if (load.kind === 'error') {
    return (
      <PageContainer maxWidth="md">
        <PageHeader title="پرداخت" />
        <PaymentErrorPanel
          error={load.error}
          retryLabel="تلاش دوباره"
          onRetry={() => window.location.reload()}
        />
      </PageContainer>
    );
  }

  const { plans, destination } = load;

  // Renewal is NOT supported by the current backend rules (expired
  // accounts are outside the pre-approval statuses), so the form is
  // hidden and an honest notice is shown instead.
  if (user?.account_status === 'expired') {
    return (
      <PageContainer maxWidth="md">
        <PageHeader title="پرداخت" subtitle="اشتراک شما به پایان رسیده است." />
        <StatePanel
          variant="unavailable"
          title="تمدید اشتراک در حال حاضر فعال نیست"
          description="برای تمدید اشتراک یا بررسی وضعیت حساب، با پشتیبانی تماس بگیرید. پس از فعال‌شدن امکان تمدید، در همین صفحه می‌توانید رسید جدید ارسال کنید."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="md">
      <PageHeader
        title="پرداخت"
        subtitle={
          user
            ? `حساب: ${user.name} — وضعیت: ${user.account_status}`
            : 'انتخاب طرح و بارگذاری رسید.'
        }
      />

      <Box sx={{ mb: 3 }}>
        <PaymentJourney activeStep={journeyActiveStep} completedSteps={journeyActiveStep} />
      </Box>

      {currentRequestKind === 'rejected' ? (
        <Alert severity="warning" sx={{ mb: 2 }} role="status">
          درخواست قبلی شما رد شده است. می‌توانید رسید جدیدی ارسال کنید؛ درخواست جدید جداگانه بررسی
          می‌شود.
        </Alert>
      ) : null}

      {plans.length === 0 ? (
        <Box sx={{ mb: 2 }}>
          <StatePanel
            variant="unavailable"
            title="فعلاً طرح فعالی برای پرداخت وجود ندارد"
            description="لطفاً بعداً دوباره بررسی کنید یا با پشتیبانی تماس بگیرید."
          />
        </Box>
      ) : (
        <Box
          sx={{
            display: { md: 'grid' },
            gridTemplateColumns: { md: 'minmax(0, 5fr) minmax(0, 7fr)' },
            gap: { md: 3 },
          }}
        >
          {/* Instructions column (details + trust content). */}
          <Box sx={{ mb: { xs: 2, md: 0 }, minWidth: 0 }}>
            <PaymentInstructions plan={selectedPlan} destination={destination} />
          </Box>

          {/* Selection + submission column. */}
          <Box
            component="form"
            noValidate
            onSubmit={onSubmit}
            aria-label="فرم پرداخت"
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}
          >
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography component="h2" variant="h4">
                    انتخاب طرح
                  </Typography>
                  <PlanSelector
                    plans={plans}
                    selectedId={selectedPlanId || null}
                    onSelect={(id) => {
                      setValue('planId', id, { shouldValidate: true });
                    }}
                  />
                  {errors.planId ? (
                    <Typography variant="caption" color="error.main" role="alert">
                      {errors.planId.message}
                    </Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>

            <ReceiptPicker
              value={receiptFile ?? null}
              onChange={(f) => {
                setValue('receiptFile', f as unknown as File, { shouldValidate: true });
              }}
              error={
                errors.receiptFile
                  ? toPaymentError(new Error(errors.receiptFile.message ?? 'رسید نامعتبر است.'))
                  : null
              }
              disabled={isSubmitting}
            />

            {submissionError ? (
              <PaymentErrorPanel error={submissionError} data-testid="submission-error" />
            ) : null}

            <Box
              sx={{
                position: 'sticky',
                bottom: { xs: 'calc(80px + env(safe-area-inset-bottom, 0px))', md: 0 },
                zIndex: 1,
                pt: 1,
                backgroundColor: 'var(--mui-palette-background-default)',
              }}
            >
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={submissionDisabled}
                endIcon={
                  isSubmitting ? (
                    <CircularProgress size={16} color="inherit" aria-label="در حال ارسال" />
                  ) : (
                    <ArrowForwardRoundedIcon sx={{ transform: 'scaleX(-1)' }} />
                  )
                }
                sx={{ minHeight: 48 }}
                data-testid="submit-payment"
              >
                {isSubmitting ? 'در حال ارسال رسید…' : 'ارسال رسید و ثبت درخواست'}
              </Button>
              {isSubmitting ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  role="status"
                  aria-live="polite"
                  sx={{ display: 'block', mt: 1, textAlign: 'center' }}
                >
                  در حال ارسال… پس از دریافت تأیید سرور، به صفحهٔ وضعیت منتقل می‌شوید.
                </Typography>
              ) : selectedPlanId ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1, textAlign: 'center' }}
                >
                  {(() => {
                    const p = plans.find((x) => x.id === selectedPlanId);
                    if (!p) return null;
                    return `${p.name} — ${formatToman(p.priceToman)} تومان — ${formatDurationDays(p.durationDays)}`;
                  })()}
                </Typography>
              ) : null}
            </Box>
          </Box>
        </Box>
      )}
    </PageContainer>
  );
}
