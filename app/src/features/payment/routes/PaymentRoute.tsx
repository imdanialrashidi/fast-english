// app/src/features/payment/routes/PaymentRoute.tsx
// Real student payment page. Loads plans and the active destination
// from the backend and walks the user through the journey.
//
// The page has exactly three modes, driven by REAL backend state:
//
//   1. FREE plan selected (canonical server price_toman === 0):
//        «شروع رایگان» — no destination card, no receipt upload, no
//        payment request, no staff approval. The server grants the
//        entitlement idempotently (POST /subscriptions/free-activate)
//        and the user continues to placement. Works identically when
//        card-to-card is disabled.
//   2. Paid plan selected + card transfer ENABLED (active destination):
//        the existing simplified card-transfer flow — destination card
//        → transfer → upload ONE receipt → submit for review.
//   3. Paid plan + card transfer DISABLED:
//        the plan is shown as «موقتاً در دسترس نیست» and is not
//        selectable; no card/receipt UI can appear. The server also
//        rejects stale submissions (payment_destination_unavailable),
//        so a stale browser state can never bypass a newly-disabled
//        payment method.
//
// Journey stages reflect real state only. Free-plan steps never mention
// card-to-card or receipts.

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
  activateFreePlan,
  createPaymentRequest,
  loadActiveDestination,
  loadActivePlans,
  loadCurrentRequest,
} from '../api';
import { PaymentErrorPanel } from '../components/PaymentErrorPanel';
import { PaymentInstructions } from '../components/PaymentInstructions';
import { PaymentJourney } from '../components/PaymentJourney';
import { isPlanPurchasable, PlanSelector } from '../components/PlanSelector';
import { ReceiptPicker } from '../components/ReceiptPicker';
import { toPaymentError } from '../errors';
import { formatDurationDays, formatPlanPrice } from '../formatters';
import { type PaymentFormValues, paymentFormSchema } from '../schemas';
import type { PaymentDestination, PaymentError as PaymentErrorModel, Plan } from '../types';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; plans: Plan[]; destination: PaymentDestination | null }
  | { kind: 'error'; error: PaymentErrorModel };

/** Compact two-step journey for the free flow (never card/receipt steps). */
function FreeJourney({ active }: { active: boolean }) {
  const steps = ['انتخاب طرح', 'شروع رایگان'];
  return (
    <Box
      component="section"
      aria-label="مراحل شروع رایگان"
      data-testid="free-journey"
      sx={{ display: 'flex', alignItems: 'center', width: '100%' }}
    >
      <Box
        role="list"
        aria-label="مراحل شروع رایگان"
        sx={{ display: 'flex', alignItems: 'center', flex: '1 1 auto', minWidth: 0 }}
      >
        {steps.map((label, index) => {
          const isActive = active && index === 1;
          const isLast = index === steps.length - 1;
          return (
            <Box
              key={label}
              role="listitem"
              aria-label={`مرحلهٔ ${index + 1}: ${label}`}
              sx={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : '1 1 0' }}
            >
              <Box
                aria-current={isActive ? 'step' : undefined}
                sx={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  backgroundColor: isActive
                    ? 'var(--mui-palette-primary-main)'
                    : 'var(--mui-palette-surfaceContainerHighest)',
                  color: isActive
                    ? 'var(--mui-palette-onPrimary)'
                    : 'var(--mui-palette-onSurfaceVariant)',
                  border: 1,
                  borderColor: isActive
                    ? 'var(--mui-palette-primary-main)'
                    : 'var(--mui-palette-outlineVariant)',
                }}
              >
                {index + 1}
              </Box>
              {!isLast ? (
                <Box
                  aria-hidden
                  sx={{
                    flex: '1 1 auto',
                    height: 2,
                    minWidth: 8,
                    mx: 0.5,
                    borderRadius: '50%',
                    backgroundColor: 'var(--mui-palette-outlineVariant)',
                  }}
                />
              ) : null}
            </Box>
          );
        })}
      </Box>
      <Typography variant="labelLarge" sx={{ mr: 1 }}>
        {active ? 'شروع رایگان' : 'انتخاب طرح'}
      </Typography>
    </Box>
  );
}

export function PaymentRoute() {
  const { user, refresh } = useAuth();
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
          // No active destination = card transfer disabled. Paid plans
          // become unavailable; free plans keep working. This is a
          // non-fatal "unavailable" UX state.
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

  // Card-to-card enabled ⇔ an active destination exists (server truth).
  const cardTransferEnabled = load.kind === 'ready' && load.destination !== null;
  const selectedPlanIsFree = selectedPlan !== null && selectedPlan.priceToman === 0;
  const selectedPlanPurchasable =
    selectedPlan !== null && isPlanPurchasable(selectedPlan, { cardTransferEnabled });

  // Journey steps (0-based) for the PAID flow:
  //   0 info, 1 card-to-card, 2 receipt, 3 submit, 4 result
  const paidJourneyActiveStep = selectedPlanId ? (receiptFile ? 2 : 1) : 0;

  const submissionDisabled = useMemo(() => {
    if (isSubmitting) return true;
    if (load.kind !== 'ready') return true;
    if (!load.destination) return true;
    if (load.plans.length === 0) return true;
    if (!selectedPlanId) return true;
    if (!selectedPlanPurchasable) return true;
    if (!receiptFile) return true;
    return false;
  }, [isSubmitting, load, selectedPlanId, receiptFile, selectedPlanPurchasable]);

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

  // Server-authoritative FREE activation. The server re-validates the
  // canonical plan (exists + active + price_toman === 0) and grants the
  // entitlement idempotently; the client never claims a plan is free.
  const [freeActivating, setFreeActivating] = useState(false);
  const [freePeriodEnded, setFreePeriodEnded] = useState(false);
  const onFreeActivate = async () => {
    if (!selectedPlan) return;
    if (selectedPlan.priceToman !== 0) return;
    setSubmissionError(null);
    setFreeActivating(true);
    try {
      const res = await activateFreePlan({ planId: selectedPlan.id });
      if (res.kind === 'activated' || res.kind === 'already_entitled') {
        trackFunnel(FUNNEL_EVENTS.freePlanActivated, { planId: selectedPlan.id });
        // Re-read the account server-side so the app sees `active`
        // before navigating into the active-student journey.
        await refresh();
        navigate('/placement', { replace: true });
      } else if (res.kind === 'free_period_ended') {
        // Terminal honest state: the user's one free period has been
        // consumed and is no longer valid. Never navigate into an
        // entitlement that does not exist.
        setFreePeriodEnded(true);
      } else {
        setSubmissionError(
          toPaymentError(new Error('پاسخ سرور نامعتبر است. لطفاً صفحه را تازه‌سازی کنید.')),
        );
      }
    } catch (err) {
      setSubmissionError(toPaymentError(err));
    } finally {
      setFreeActivating(false);
    }
  };

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
        title={selectedPlanIsFree ? 'شروع رایگان' : 'پرداخت'}
        subtitle={
          user
            ? `حساب: ${user.name} — وضعیت: ${user.account_status}`
            : 'انتخاب طرح و بارگذاری رسید.'
        }
      />

      <Box sx={{ mb: 3 }}>
        {selectedPlanIsFree ? (
          <FreeJourney active />
        ) : (
          <PaymentJourney
            activeStep={paidJourneyActiveStep}
            completedSteps={paidJourneyActiveStep}
          />
        )}
      </Box>

      {currentRequestKind === 'rejected' ? (
        <Alert severity="warning" sx={{ mb: 2 }} role="status">
          درخواست قبلی شما رد شده است. می‌توانید رسید جدیدی ارسال کنید یا یک طرح رایگان انتخاب کنید؛
          درخواست جدید جداگانه بررسی می‌شود.
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
                    {selectedPlanIsFree ? 'طرح رایگان' : 'انتخاب طرح'}
                  </Typography>
                  {selectedPlanIsFree ? (
                    <Stack spacing={1} data-testid="free-plan-summary">
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {selectedPlan.name} — {formatPlanPrice(selectedPlan.priceToman)} —{' '}
                        {formatDurationDays(selectedPlan.durationDays)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        با انتخاب «شروع رایگان» دسترسی فوراً فعال می‌شود و به تعیین سطح هدایت می‌شوید.
                      </Typography>
                    </Stack>
                  ) : (
                    <PlanSelector
                      plans={plans}
                      selectedId={selectedPlanId || null}
                      availability={{ cardTransferEnabled }}
                      onSelect={(id) => {
                        setValue('planId', id, { shouldValidate: true });
                      }}
                    />
                  )}
                  {errors.planId ? (
                    <Typography variant="caption" color="error.main" role="alert">
                      {errors.planId.message}
                    </Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>

            {/* Free flow: no receipt picker, no card transfer UI. */}
            {selectedPlanIsFree ? (
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                      این طرح کاملاً رایگان است؛ نیازی به انتقال پول یا بارگذاری رسید نیست و دسترسی
                      بدون تأیید پشتیبانی فعال می‌شود.
                    </Typography>
                    {submissionError ? (
                      <PaymentErrorPanel error={submissionError} data-testid="submission-error" />
                    ) : null}
                    {freePeriodEnded ? (
                      <StatePanel
                        variant="unavailable"
                        title="دورهٔ رایگان شما به پایان رسیده است"
                        description="برای خرید یک طرح پولی یا بررسی وضعیت حساب با پشتیبانی تماس بگیرید."
                        data-testid="free-period-ended"
                      />
                    ) : null}
                    <Button
                      type="button"
                      variant="contained"
                      size="large"
                      fullWidth
                      onClick={onFreeActivate}
                      disabled={freeActivating || freePeriodEnded}
                      endIcon={
                        freeActivating ? (
                          <CircularProgress
                            size={16}
                            color="inherit"
                            aria-label="در حال فعال‌سازی"
                          />
                        ) : (
                          <ArrowForwardRoundedIcon sx={{ transform: 'scaleX(-1)' }} />
                        )
                      }
                      sx={{ minHeight: 48 }}
                      data-testid="start-free-plan"
                    >
                      {freeActivating ? 'در حال فعال‌سازی…' : 'شروع رایگان'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Paid flow: the receipt picker renders ONLY for a
                    selectable paid plan (card transfer enabled). When
                    card-to-card is disabled no receipt UI can appear;
                    paid plans are not selectable at all. */}
                {selectedPlan && selectedPlanPurchasable ? (
                  <ReceiptPicker
                    value={receiptFile ?? null}
                    onChange={(f) => {
                      setValue('receiptFile', f as unknown as File, { shouldValidate: true });
                    }}
                    error={
                      errors.receiptFile
                        ? toPaymentError(
                            new Error(errors.receiptFile.message ?? 'رسید نامعتبر است.'),
                          )
                        : null
                    }
                    disabled={isSubmitting}
                  />
                ) : !destination ? (
                  <Card>
                    <CardContent>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        data-testid="paid-unavailable-note"
                      >
                        پرداخت کارت‌به‌کارت در حال حاضر غیرفعال است؛ طرح‌های پولی موقتاً در دسترس
                        نیستند. می‌توانید یک طرح رایگان انتخاب کنید.
                      </Typography>
                    </CardContent>
                  </Card>
                ) : null}

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
                        return `${p.name} — ${formatPlanPrice(p.priceToman)}${
                          p.priceToman === 0 ? '' : ' تومان'
                        } — ${formatDurationDays(p.durationDays)}`;
                      })()}
                    </Typography>
                  ) : null}
                </Box>
              </>
            )}
          </Box>
        </Box>
      )}
    </PageContainer>
  );
}
