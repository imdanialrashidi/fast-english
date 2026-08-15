// app/src/features/payment/payment-redesign.quality.test.ts
// Deterministic design-consistency gates for the Payment Experience
// Redesign.
//
// These assert behavior contract facts by static scan + pure-logic
// tests (no DOM environment is configured in this repo):
//  - hierarchy: exactly one dominant submit CTA; copy actions are
//    secondary controls; pending replaces the submission form;
//    rejected carries a resubmission CTA; approved shows only
//    authoritative backend values (no client-computed dates).
//  - geometry: bounded preview frames, compact phone stepper,
//    full-screen phone zoom dialog, LTR card-number handling.
//  - accessibility semantics: copy feedback live region, support
//    code only inside the error-details area, card number readable
//    by screen readers.
// The global static-quality scanner additionally enforces tokens
// (no raw hex/durations/radii) over every new file automatically.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveApprovedCta } from './components/PaymentApprovedPanel';

const ROOT = process.cwd();
function read(rel: string): string {
  return readFileSync(resolve(ROOT, 'app', 'src', rel), 'utf8');
}

// Files that moved to the shared design system (Podcast Slice 1).
function readShared(rel: string): string {
  return readFileSync(resolve(ROOT, 'shared', rel), 'utf8');
}

const JOURNEY = 'features/payment/components/PaymentJourney.tsx';
const DETAILS = 'features/payment/components/PaymentDetailsCard.tsx';
const INSTRUCTIONS = 'features/payment/components/PaymentInstructions.tsx';
const COPY_VALUE = 'ui/CopyValue.tsx';
const PICKER = 'features/payment/components/ReceiptPicker.tsx';
const PREVIEW = 'features/payment/components/ReceiptPreview.tsx';
const ZOOM = 'ui/ReceiptZoomDialog.tsx';
const TIMELINE = 'features/payment/components/PaymentStatusTimeline.tsx';
const SUMMARY = 'features/payment/components/PaymentRequestSummary.tsx';
const REJECTED = 'features/payment/components/PaymentRejectedPanel.tsx';
const APPROVED = 'features/payment/components/PaymentApprovedPanel.tsx';
const ERROR_PANEL = 'features/payment/components/PaymentErrorPanel.tsx';
const PAYMENT_ROUTE = 'features/payment/routes/PaymentRoute.tsx';
const STATUS_ROUTE = 'features/payment/routes/PaymentStatusRoute.tsx';

describe('Payment redesign — journey architecture', () => {
  it('declares exactly the five accepted stages in order', () => {
    const journey = read(JOURNEY);
    for (const stage of [
      'مشاهده اطلاعات پرداخت',
      'انجام کارت‌به‌کارت',
      'انتخاب و بررسی رسید',
      'ارسال برای بررسی',
      'نتیجه بررسی',
    ]) {
      expect(journey, `stage ${stage}`).toContain(stage);
    }
    // No stage copy implies automatic verification.
    expect(journey).not.toMatch(/تأیید خودکار|فوری|بلافاصله/);
  });

  it('the journey maps real form state to the active stage', () => {
    const route = read(PAYMENT_ROUTE);
    // Paid flow: no plan → stage 1; plan → stage 2; file → stage 3
    // (submission is direct — the simplified flow has no separate
    // confirmation stage).
    expect(route).toContain('paidJourneyActiveStep');
    expect(route).not.toContain('transferConfirmed');
    expect(route).toMatch(/paidJourneyActiveStep\s*=\s*selectedPlanId/);
    // Free flow: the journey is the two-step «انتخاب طرح / شروع رایگان» —
    // card-to-card and receipt stages must never appear for a free plan.
    expect(route).toContain('FreeJourney');
    expect(route).toContain('شروع رایگان');
    expect(route).toMatch(/selectedPlanIsFree\s*\?\s*\(?\s*<FreeJourney/);
  });

  it('an existing pending (or decided) request redirects to the status workspace', () => {
    const route = read(PAYMENT_ROUTE);
    expect(route).toMatch(/currentRequestKind === 'pending' \|\| currentRequestKind === 'other'/);
    expect(route).toContain("navigate('/payment-status', { replace: true })");
  });

  it('the pending status workspace replaces the submission form', () => {
    const status = read(STATUS_ROUTE);
    // The form surface must not be reachable from the status page.
    expect(status).not.toContain('ReceiptPicker');
    expect(status).not.toContain('PlanSelector');
    expect(status).not.toContain('type="submit"');
    // The workspace renders the real timeline + pending panel.
    expect(status).toContain('PaymentStatusTimeline');
    expect(status).toContain('در انتظار بررسی');
    expect(status).toContain('پس از بررسی در همین صفحه');
  });
});

describe('Payment redesign — hierarchy', () => {
  it('exactly one dominant submit CTA per submission surface', () => {
    const route = read(PAYMENT_ROUTE);
    const matches = route.match(/data-testid="submit-payment"/g) ?? [];
    expect(matches).toHaveLength(1);
    // The dominant CTA is a contained, full-width submit button.
    expect(route).toMatch(/type="submit"/);
    expect(route).toMatch(/variant="contained"/);
    expect(route).toMatch(/fullWidth/);
    expect(route).toMatch(/disabled=\{submissionDisabled\}/);
    // Submission requires only a selected plan + receipt (no confirmation
    // checkbox, no transaction-reference fields in the simplified flow).
    expect(route).toContain('if (!selectedPlanId) return true;');
    expect(route).toContain('if (!receiptFile) return true;');
    expect(route).not.toContain('transferConfirmed');
    expect(route).not.toContain('جزئیات انتقال');
    expect(route).not.toContain('senderCardLast4');
    expect(route).not.toContain('bankReference');
    expect(route).not.toContain('transferAt');
  });

  it('copy actions are secondary icon controls, not CTAs', () => {
    const copy = readShared(COPY_VALUE);
    expect(copy).toContain('<IconButton');
    expect(copy).not.toContain('variant="contained"');
    const details = read(DETAILS);
    // Amount + card number both expose copy.
    expect(details).toContain('کپی مبلغ');
    expect(details).toContain('کپی شمارهٔ کارت');
  });

  it('rejected state carries a resubmission CTA that creates a new request', () => {
    const rejected = read(REJECTED);
    expect(rejected).toContain('data-testid="resubmit-cta"');
    expect(rejected).toContain("navigate('/payment')");
    expect(rejected).toContain('درخواست جدید جداگانه بررسی می‌شود');
    expect(rejected).toContain('رسید قبلی به‌صورت خودکار استفاده نمی‌شود');
    // The error styling is scoped to the reason container only.
    expect(rejected).toContain('data-testid="rejection-reason"');
    expect(rejected).toContain("backgroundColor: 'var(--mui-palette-errorContainer)'");
  });

  it('approved state never computes dates client-side', () => {
    const approved = read(APPROVED);
    // No independent date arithmetic.
    expect(approved).not.toMatch(/new Date\(/);
    expect(approved).not.toMatch(/Date\.now/);
    // Subscription values only come from the authoritative dashboard.
    expect(approved).toContain('getDashboard');
    expect(approved).toContain('startsAt');
    expect(approved).toContain('expiresAt');
    // Receipt is not shown after approval.
    expect(approved).not.toContain('ReceiptPreview');
  });

  it('approved CTA resolution is deterministic', () => {
    expect(resolveApprovedCta(true, null)).toBe('dashboard');
    expect(resolveApprovedCta(true, 'placement_incomplete')).toBe('dashboard');
    expect(resolveApprovedCta(false, 'placement_incomplete')).toBe('placement');
    expect(resolveApprovedCta(false, null)).toBe('dashboard');
    expect(resolveApprovedCta(false, 'unexpected_error')).toBe('dashboard');
  });
});

describe('Payment redesign — geometry contracts', () => {
  it('phone journey is a compact fixed-size indicator row', () => {
    const journey = read(JOURNEY);
    // Compact circles: 36px, flex-1 connectors, no labels in the row.
    expect(journey).toContain('width: 36');
    expect(journey).toContain('height: 36');
    expect(journey).toContain('flexShrink: 0');
    // Full stepper only at sm+.
    expect(journey).toContain("theme.breakpoints.up('sm')");
    expect(journey).toContain('alternativeLabel');
  });

  it('receipt previews are bounded in both the picker and the status preview', () => {
    const picker = read(PICKER);
    const preview = read(PREVIEW);
    expect(picker).toContain('maxHeight: 280');
    expect(preview).toContain('maxHeight: 360');
    // Aspect ratio is preserved (object-fit contain).
    expect(picker).toContain("objectFit: 'contain'");
    expect(preview).toContain("objectFit: 'contain'");
  });

  it('zoom dialog is full-screen on phones and bounded on larger screens', () => {
    const zoom = readShared(ZOOM);
    expect(zoom).toContain('fullScreen={isPhone}');
    expect(zoom).toContain("theme.breakpoints.down('sm')");
    expect(zoom).toContain('maxWidth="md"');
    expect(zoom).toContain('fullWidth');
  });

  it('card number and amount are LTR-isolated and readable', () => {
    const details = read(DETAILS);
    expect(details).toContain('dir="ltr"');
    expect(details).toContain('lang="en"');
    expect(details).toContain("fontVariantNumeric: 'tabular-nums'");
    // Screen readers get the full card number via aria-label.
    expect(details).toContain('aria-label={`شمارهٔ کارت');
    expect(details).toContain('formattedCard}');
  });

  it('status timeline and summary carry list semantics and wrap', () => {
    const timeline = read(TIMELINE);
    expect(timeline).toContain('role="list"');
    expect(timeline).toContain('role="listitem"');
    const summary = read(SUMMARY);
    expect(summary).toContain("overflowWrap: 'anywhere'");
  });
});

describe('Payment redesign — copy + error semantics', () => {
  it('copy feedback is a short polite live region, not a snackbar flood', () => {
    const copy = readShared(COPY_VALUE);
    expect(copy).toContain('aria-live="polite"');
    expect(copy).toContain('role="status"');
    expect(copy).toContain('کپی شد');
    // No Snackbar is imported or rendered by the copy control.
    expect(copy).not.toMatch(/import\s+Snackbar/);
    expect(copy).not.toMatch(/<Snackbar/);
  });

  it('support code appears only inside the error-details area', () => {
    const panel = read(ERROR_PANEL);
    expect(panel).toContain('جزئیات خطا و کد پشتیبانی');
    expect(panel).toContain('کد پشتیبانی:');
    expect(panel).toContain('data-testid="error-details-area"');
    // The requestId is rendered inside the details branch only.
    expect(panel).toContain('{showDetails ?');
    expect(panel).toContain('CopyValue value={requestId}');
    // No raw error text can leak: only the mapped Persian message.
    expect(panel).not.toContain('stack');
    expect(panel).not.toContain('internal_note');
  });

  it('no raw backend error strings can be rendered by the status route', () => {
    const status = read(STATUS_ROUTE);
    expect(status).not.toMatch(/UNIQUE constraint/);
    expect(status).not.toMatch(/ApiError/);
    expect(status).not.toMatch(/validation_invalid/);
  });

  it('upload progress is honest: indeterminate only, no fake percentages', () => {
    const route = read(PAYMENT_ROUTE);
    expect(route).toContain('CircularProgress');
    expect(route).toContain('در حال ارسال رسید…');
    expect(route).not.toMatch(/value=\{.*percent/i);
    expect(route).not.toContain('LinearProgress');
  });

  it('the submission surface keeps an honest plan/amount summary line', () => {
    const route = read(PAYMENT_ROUTE);
    // The simplified journey needs no confirmation checkbox or summary
    // card: the sticky submit area already states plan + price + duration
    // (the free label «رایگان» is the canonical rendering for 0 toman).
    expect(route).not.toContain('data-testid="confirmation-summary"');
    expect(route).not.toContain('انتقال را انجام داده‌ام');
    expect(route).toContain('formatPlanPrice(p.priceToman)');
    expect(route).toContain('formatDurationDays(p.durationDays)');
  });

  it('trust content is explicit and makes no unsupported promises', () => {
    const instructions = read(INSTRUCTIONS);
    expect(instructions).toContain('بررسی به‌صورت دستی انجام می‌شود');
    expect(instructions).toContain('به‌صورت خودکار تأیید نمی‌شود');
    expect(instructions).toContain('فقط پس از تأیید فعال می‌شود');
    expect(instructions).toContain('از ارسال تکراری خودداری کنید');
    // No invented SLA ("within two hours") and no fake badges.
    expect(instructions).not.toMatch(/دو ساعت|۲ ساعت|ظرف \d+/);
    expect(instructions).not.toContain('نماد اعتماد');
  });
});

describe('Payment redesign — real limit parity', () => {
  it('client guidance mirrors the server 5 MB limit constant', () => {
    const picker = read(PICKER);
    expect(picker).toContain('MAX_RECEIPT_BYTES');
    expect(picker).toContain('ALLOWED_RECEIPT_MIME_TYPES');
    expect(picker).toContain('حداکثر ۵ مگابایت');
    const constants = read('features/payment/constants.ts');
    expect(constants).toContain('5 * 1024 * 1024');
  });

  it('object URLs are revoked on replace, removal and unmount', () => {
    const picker = read(PICKER);
    expect(picker).toContain('URL.revokeObjectURL(url)');
    expect(picker).toContain('URL.revokeObjectURL(preview.url)');
    const preview = read(PREVIEW);
    expect(preview).toContain('useReceiptPreview');
  });
});
