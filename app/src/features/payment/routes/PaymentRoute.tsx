// app/src/features/payment/routes/PaymentRoute.tsx
// Real student payment page. Loads plans and the active destination
// from the backend, lets the student pick a plan, fill optional
// transfer details, attach one receipt image, and submit the
// multipart form to the real P1-S1B route.

import { zodResolver } from '@hookform/resolvers/zod';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { PageContainer } from '../../../app/shell/PageContainer';
import { PageHeader } from '../../../app/shell/PageHeader';
import { StatePanel } from '../../../app/shell/StatePanel';
import { useAuth } from '../../../lib/auth';
import {
  createPaymentRequest,
  loadActiveDestination,
  loadActivePlans,
  loadCurrentRequest,
} from '../api';
import { DestinationCard } from '../components/DestinationCard';
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
    register,
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
      bankReference: '',
      senderCardLast4: '',
      transferAt: '',
    },
  });

  const selectedPlanId = watch('planId');
  const receiptFile = watch('receiptFile');
  const senderCardLast4 = watch('senderCardLast4');

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
        bankReference: values.bankReference,
        senderCardLast4: values.senderCardLast4,
        transferAt: values.transferAt,
      });
      if (res.kind === 'request') {
        // Clear local file + URL (ReceiptPicker revokes on value=null).
        setValue('receiptFile', undefined as unknown as File, { shouldValidate: false });
        reset(
          {
            planId: values.planId,
            receiptFile: undefined as unknown as File,
            bankReference: '',
            senderCardLast4: '',
            transferAt: '',
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
      } else if (e.code === 'invalid_transfer_details') {
        setError('senderCardLast4', { type: 'server', message: e.message });
      } else if (e.code === 'invalid_plan') {
        setError('planId', { type: 'server', message: e.message });
      } else {
        setSubmissionError(e);
      }
    }
  });

  // Redirect to status if a pending request already exists.
  useEffect(() => {
    if (currentRequestKind === 'pending') {
      navigate('/payment-status', { replace: true });
    }
  }, [currentRequestKind, navigate]);

  if (load.kind === 'loading' || currentRequestKind === 'unknown') {
    return (
      <PageContainer maxWidth="sm">
        <PageHeader title="پرداخت" subtitle="در حال بارگذاری طرح‌ها و مقصد پرداخت…" />
        <StatePanel variant="loading" title="در حال بارگذاری…" />
      </PageContainer>
    );
  }

  if (load.kind === 'error') {
    return (
      <PageContainer maxWidth="sm">
        <PageHeader title="پرداخت" />
        <StatePanel
          variant="error"
          title="بارگذاری اطلاعات پرداخت ناموفق بود"
          description={load.error.message}
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

  const { plans, destination } = load;

  return (
    <PageContainer maxWidth="sm">
      <PageHeader
        title="پرداخت"
        subtitle={
          user
            ? `حساب: ${user.name} — وضعیت: ${user.account_status}`
            : 'انتخاب طرح و بارگذاری رسید.'
        }
      />

      {currentRequestKind === 'rejected' ? (
        <Alert severity="warning" sx={{ mb: 2 }} role="status">
          درخواست قبلی شما رد شده است. می‌توانید رسید جدیدی ارسال کنید.
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
          component="form"
          noValidate
          onSubmit={onSubmit}
          aria-label="فرم پرداخت"
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
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
                  onSelect={(id) => setValue('planId', id, { shouldValidate: true })}
                />
                {errors.planId ? (
                  <Typography variant="caption" color="error.main" role="alert">
                    {errors.planId.message}
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          {destination ? (
            <DestinationCard destination={destination} />
          ) : (
            <StatePanel
              variant="unavailable"
              title="مقصد پرداخت فعال نیست"
              description="تا زمانی که مقصد پرداخت توسط اپراتور فعال نشده باشد، نمی‌توانید درخواستی ثبت کنید."
            />
          )}

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography component="h2" variant="h4">
                  جزئیات انتقال (اختیاری)
                </Typography>
                <TextField
                  label="چهار رقم آخر کارت مبدأ"
                  inputMode="numeric"
                  autoComplete="off"
                  {...register('senderCardLast4')}
                  error={Boolean(errors.senderCardLast4)}
                  helperText={
                    errors.senderCardLast4?.message ??
                    'فقط برای پیگیری داخلی استفاده می‌شود. هرگز اطلاعات کامل کارت ارسال نکنید.'
                  }
                  slotProps={{
                    input: {
                      // Force LTR for the digit-only field. The form
                      // already accepts Persian digits via the schema
                      // transform; the display is Latin so users see
                      // exactly what they typed.
                      inputProps: {
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        maxLength: 8,
                      },
                    },
                  }}
                />
                <TextField
                  label="شمارهٔ پیگیری بانک"
                  inputMode="text"
                  autoComplete="off"
                  {...register('bankReference')}
                  error={Boolean(errors.bankReference)}
                  helperText={
                    errors.bankReference?.message ??
                    `اگر بانک شما شمارهٔ پیگیری صادر کرده، اینجا وارد کنید. (${formatPersianPreview(senderCardLast4)})`
                  }
                />
                <TextField
                  label="زمان واریز"
                  type="datetime-local"
                  slotProps={{ inputLabel: { shrink: true } }}
                  {...register('transferAt')}
                  error={Boolean(errors.transferAt)}
                  helperText={errors.transferAt?.message ?? ' '}
                />
              </Stack>
            </CardContent>
          </Card>

          <ReceiptPicker
            value={receiptFile ?? null}
            onChange={(f) =>
              setValue('receiptFile', f as unknown as File, { shouldValidate: true })
            }
            error={
              errors.receiptFile
                ? toPaymentError(new Error(errors.receiptFile.message ?? 'رسید نامعتبر است.'))
                : null
            }
            disabled={isSubmitting}
          />

          {submissionError ? (
            <Alert severity="error" role="alert" data-testid="submission-error">
              {submissionError.message}
            </Alert>
          ) : null}

          <Box
            sx={{
              position: 'sticky',
              bottom: { xs: 'calc(80px + env(safe-area-inset-bottom, 0px))', md: 0 },
              zIndex: 1,
              pt: 1,
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
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <ArrowForwardRoundedIcon sx={{ transform: 'scaleX(-1)' }} />
                )
              }
              sx={{ minHeight: 48 }}
              data-testid="submit-payment"
            >
              {isSubmitting ? (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <HourglassEmptyRoundedIcon fontSize="small" />
                  <span>در حال ارسال…</span>
                </Stack>
              ) : (
                'ارسال رسید و ثبت درخواست'
              )}
            </Button>
            {selectedPlanId ? (
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
      )}
    </PageContainer>
  );
}

function formatPersianPreview(raw: string | undefined): string {
  if (!raw) return 'مثال: ۱۲۳۴';
  // Show what the user typed so far, normalized to four digits.
  const digits = raw
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\D/g, '');
  if (!digits) return 'مثال: ۱۲۳۴';
  const padded = digits.padStart(4, '0').slice(-4);
  return `اکنون: ${padded}`;
}
