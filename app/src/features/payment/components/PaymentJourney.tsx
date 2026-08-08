// app/src/features/payment/components/PaymentJourney.tsx
// The five-stage payment journey indicator.
//
//   ۱. مشاهده اطلاعات پرداخت
//   ۲. انجام کارت‌به‌کارت
//   ۳. انتخاب و بررسی رسید
//   ۴. ارسال برای بررسی
//   ۵. نتیجه بررسی
//
// The stages are driven by the REAL backend state (the caller maps
// loaded state to an active step). Compact representation on phones:
// numbered circles + connectors with the current stage named below;
// full MUI Stepper (alternativeLabel) at sm+.
//
// The journey never implies automatic verification: the stage copy
// is neutral ("نتیجه بررسی"), and the result stage is described by
// the status panels, not by this component.

import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Box, Stack, Step, StepLabel, Stepper, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { duration, easing } from '../../../../../shared/ui/tokens';

export const JOURNEY_STAGES = [
  'مشاهده اطلاعات پرداخت',
  'انجام کارت‌به‌کارت',
  'انتخاب و بررسی رسید',
  'ارسال برای بررسی',
  'نتیجه بررسی',
] as const;

export type JourneyTone = 'default' | 'error';

interface Props {
  /** Index of the stage the user is currently on (0-based). */
  activeStep: number;
  /** Stages fully completed (0..activeStep). */
  completedSteps: number;
  /** 'error' when the result stage ended in a rejection. */
  tone?: JourneyTone;
}

function toPersianNumber(n: number): string {
  const digits = '۰۱۲۳۴۵۶۷۸۹';
  return String(n)
    .split('')
    .map((d) => digits[Number(d)] ?? d)
    .join('');
}

export function PaymentJourney({ activeStep, completedSteps, tone = 'default' }: Props) {
  const theme = useTheme();
  const full = useMediaQuery(theme.breakpoints.up('sm'));

  if (full) {
    return (
      <Box
        component="section"
        aria-label="مراحل پرداخت"
        data-testid="payment-journey"
        sx={{ width: '100%' }}
      >
        <Stepper
          activeStep={activeStep}
          alternativeLabel
          sx={{ width: '100%' }}
          data-testid="payment-journey-stepper"
        >
          {JOURNEY_STAGES.map((label, index) => {
            const completed = index < completedSteps;
            const isActive = index === activeStep;
            return (
              <Step key={label} completed={completed}>
                <StepLabel
                  error={tone === 'error' && index === JOURNEY_STAGES.length - 1}
                  aria-current={isActive ? 'step' : undefined}
                  sx={{
                    '& .MuiStepLabel-label': {
                      fontSize: '0.8125rem',
                      lineHeight: 1.5,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive
                        ? 'var(--mui-palette-primary-main)'
                        : 'var(--mui-palette-onSurfaceVariant)',
                      marginTop: 0.5,
                    },
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            );
          })}
        </Stepper>
      </Box>
    );
  }

  // Compact phone representation: numbered circles + connectors,
  // current stage named below. Labels stay hidden so the row never
  // overflows a 360px viewport.
  return (
    <Box
      component="section"
      aria-label="مراحل پرداخت"
      data-testid="payment-journey"
      sx={{ width: '100%' }}
    >
      <Box
        role="list"
        aria-label="مراحل پرداخت"
        sx={{ display: 'flex', alignItems: 'center', width: '100%' }}
      >
        {JOURNEY_STAGES.map((label, index) => {
          const completed = index < completedSteps;
          const isActive = index === activeStep;
          const isLast = index === JOURNEY_STAGES.length - 1;
          const circle = (
            <Box
              aria-label={`مرحلهٔ ${toPersianNumber(index + 1)}: ${label}`}
              aria-current={isActive ? 'step' : undefined}
              data-testid={`journey-step-${index + 1}`}
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
                transition: `background-color ${duration.durationStandard}ms ${easing.easingStandard}`,
                backgroundColor: isActive
                  ? 'var(--mui-palette-primary-main)'
                  : completed
                    ? 'var(--mui-palette-primaryContainer)'
                    : tone === 'error' && isLast
                      ? 'var(--mui-palette-errorContainer)'
                      : 'var(--mui-palette-surfaceContainerHighest)',
                color: isActive
                  ? 'var(--mui-palette-onPrimary)'
                  : completed
                    ? 'var(--mui-palette-onPrimaryContainer)'
                    : tone === 'error' && isLast
                      ? 'var(--mui-palette-onErrorContainer)'
                      : 'var(--mui-palette-onSurfaceVariant)',
                border: 1,
                borderColor: isActive
                  ? 'var(--mui-palette-primary-main)'
                  : completed
                    ? 'var(--mui-palette-primaryContainer)'
                    : 'var(--mui-palette-outlineVariant)',
              }}
            >
              {completed ? (
                <CheckRoundedIcon sx={{ fontSize: 20 }} aria-hidden />
              ) : tone === 'error' && isLast ? (
                <ErrorOutlineRoundedIcon sx={{ fontSize: 20 }} aria-hidden />
              ) : (
                toPersianNumber(index + 1)
              )}
            </Box>
          );
          return (
            <Box
              key={label}
              role="listitem"
              aria-label={`مرحلهٔ ${toPersianNumber(index + 1)}: ${label}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                flex: isLast ? '0 0 auto' : '1 1 0',
                minWidth: 0,
              }}
            >
              {circle}
              {!isLast ? (
                <Box
                  aria-hidden
                  sx={{
                    flex: '1 1 auto',
                    height: 2,
                    minWidth: 8,
                    mx: 0.5,
                    borderRadius: '50%',
                    backgroundColor: completed
                      ? 'var(--mui-palette-primaryContainer)'
                      : 'var(--mui-palette-outlineVariant)',
                  }}
                />
              ) : null}
            </Box>
          );
        })}
      </Box>
      <Typography
        variant="labelLarge"
        sx={{ display: 'block', mt: 1, textAlign: 'center' }}
        role="status"
        aria-live="polite"
      >
        {JOURNEY_STAGES[activeStep]}
      </Typography>
      {tone === 'error' && activeStep === JOURNEY_STAGES.length - 1 ? (
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, justifyContent: 'center' }}>
          <ErrorOutlineRoundedIcon sx={{ fontSize: 16 }} color="error" aria-hidden />
          <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
            نتیجهٔ بررسی: رد شده
          </Typography>
        </Stack>
      ) : null}
    </Box>
  );
}
