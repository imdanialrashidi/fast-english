// app/src/features/operator/operator-redesign.quality.test.ts
// Deterministic design-consistency gates for the Operator Workspace
// Redesign (no DOM environment is configured — pure logic + static scan,
// mirroring the payment-redesign quality gates):
//  - queue: unified keyboard items, selection not color-only, URL filter
//    state, debounce + abort, explicit empty-kind distinction;
//  - detail: accepted hierarchy (receipt before decisions), status region
//    focus/live, stale state, success only after Backend ack;
//  - decisions: confirmation required, double-submit guard, conflict
//    routing, public/internal note separation;
//  - geometry/a11y: 44px targets, bounded split panes, sticky header
//    only inside the split workspace, one h1 per surface.
// The global static-quality scanner enforces tokens (no raw hex /
// durations / radii / `transition: all`) over every new file.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
function read(rel: string): string {
  return readFileSync(resolve(ROOT, 'app', 'src', rel), 'utf8');
}

const ITEM = 'features/operator/components/OperatorRequestItem.tsx';
const CHIP = 'features/operator/components/OperatorStatusChip.tsx';
const QUEUE = 'features/operator/components/OperatorQueue.tsx';
const EMPTY = 'features/operator/components/OperatorEmptyState.tsx';
const DETAIL = 'features/operator/components/OperatorRequestDetail.tsx';
const WORKSPACE = 'features/operator/components/OperatorWorkspace.tsx';
const APPROVE = 'features/operator/components/ApproveRequestDialog.tsx';
const REJECT = 'features/operator/components/RejectRequestDialog.tsx';
const RECEIPT = 'features/operator/components/OperatorReceiptInspector.tsx';
const PANEL = 'features/operator/components/OperatorDecisionPanel.tsx';
const TOOLBAR = 'features/operator/components/OperatorQueueToolbar.tsx';
const STALE = 'features/operator/components/OperatorStaleState.tsx';

describe('Operator queue', () => {
  it('items are single keyboard-selectable buttons with no nested controls', () => {
    const item = read(ITEM);
    expect(item).toContain('ButtonBase');
    expect(item).toContain('component="button"');
    expect(item).toContain('onClick={() => onOpen(item.id)}');
  });

  it('selected state is not color-only: aria-current + shape indicator', () => {
    const item = read(ITEM);
    expect(item).toContain("aria-current={selected ? 'true' : undefined}");
    expect(item).toContain('data-selected');
    // The shape indicator bar (::before) exists independently of the
    // tonal background.
    expect(item).toContain("'&::before'");
    expect(item).toContain('insetInlineStart: 0');
  });

  it('item targets are practical touch size', () => {
    const item = read(ITEM);
    expect(item).toMatch(/minHeight: 64/);
  });

  it('status chips carry an icon and text', () => {
    const chip = read(CHIP);
    expect(chip).toContain('icon={<');
    expect(chip).toContain('label={meta.label}');
  });

  it('filter state lives in URL params with debounce + superseded abort', () => {
    const queue = read(QUEUE);
    expect(queue).toContain('setSearchParams');
    expect(queue).toContain("searchParams.get('status')");
    expect(queue).toContain("searchParams.get('search')");
    expect(queue).toContain('AbortController');
    expect(queue).toContain('SEARCH_DEBOUNCE_MS');
  });

  it('counts come from the bounded Backend response (no client counting)', () => {
    const queue = read(QUEUE);
    expect(queue).toContain('response.totalItems');
    // No client-side filtering over paginated data.
    expect(queue).not.toContain('items.filter(');
    expect(queue).not.toContain('items.sort(');
  });

  it('empty filtered results differ from an empty overall queue', () => {
    const empty = read(EMPTY);
    expect(empty).toContain('درخواست در انتظار بررسی وجود ندارد.');
    expect(empty).toContain('درخواستی با این فیلترها یافت نشد');
    const queue = read(QUEUE);
    expect(queue).toContain('emptyStateKind(statusFilter, searchParam');
  });

  it('queue toolbar provides clear search + one clear-filters action', () => {
    const toolbar = read(TOOLBAR);
    expect(toolbar).toContain('queue-search-clear');
    expect(toolbar).toContain('queue-clear-filters');
    expect(toolbar).toContain('پاک‌کردن فیلترها');
  });

  it('the sticky header is limited to the split workspace', () => {
    const queue = read(QUEUE);
    expect(queue).toContain("stickyHeader ? 'sticky' : 'static'");
  });
});

describe('Operator detail hierarchy', () => {
  it('renders receipt + context before the decision controls', () => {
    const detail = read(DETAIL);
    // Search the JSX usages (`<Component`), not the import block.
    const receiptIdx = detail.indexOf('<OperatorReceiptInspector');
    const userIdx = detail.indexOf('<OperatorUserSummary');
    const subIdx = detail.indexOf('<OperatorSubscriptionSummary');
    const historyIdx = detail.indexOf('<OperatorRequestHistory');
    const decisionIdx = detail.indexOf('<OperatorDecisionPanel');
    expect(userIdx).toBeGreaterThan(0);
    expect(receiptIdx).toBeGreaterThan(userIdx);
    expect(subIdx).toBeGreaterThan(receiptIdx);
    expect(historyIdx).toBeGreaterThan(subIdx);
    expect(decisionIdx).toBeGreaterThan(historyIdx);
  });

  it('decision controls only render for pending requests', () => {
    const detail = read(DETAIL);
    expect(detail).toContain('isPending ? (');
    expect(detail).toContain('<OperatorDecisionPanel');
  });

  it('status region receives focus and announces changes after decisions', () => {
    const detail = read(DETAIL);
    expect(detail).toContain('role="status"');
    expect(detail).toContain('aria-live="polite"');
    expect(detail).toContain('statusRegionRef.current?.focus');
  });

  it('stale multi-operator conflicts refresh authoritative state', () => {
    const detail = read(DETAIL);
    expect(detail).toContain('<OperatorStaleState');
    expect(detail).toContain('setReloadKey((k) => k + 1)');
    expect(detail).toContain('openedStatusRef.current !== data.status');
    const stale = read(STALE);
    expect(stale).toContain('این درخواست قبلاً بررسی شده است');
    expect(stale).toContain('اقدام شما ثبت نشده است.');
  });

  it('requestId support codes appear only inside safe error details', () => {
    const detail = read(DETAIL);
    expect(detail).toContain('requestId={error?.requestId ?? requestId}');
    const errors = read('features/operator/errors.ts');
    expect(errors).toContain('requestId?: string');
  });
});

describe('Operator decisions', () => {
  it('both outcomes require an explicit confirmation step', () => {
    const approve = read(APPROVE);
    const reject = read(REJECT);
    expect(approve).toContain('approve-confirm');
    expect(approve).toContain('تأیید و فعال‌سازی');
    expect(reject).toContain('reject-confirm');
    expect(reject).toContain('رد درخواست');
    expect(approve).toContain('انصراف');
    expect(reject).toContain('انصراف');
  });

  it('double submission is prevented and conflicting actions stay disabled', () => {
    for (const src of [APPROVE, REJECT]) {
      const file = read(src);
      expect(file).toContain('if (submitting) return');
      expect(file).toContain('disabled={submitting}');
    }
  });

  it('success is only reported after the Backend acknowledges', () => {
    const approve = read(APPROVE);
    const reject = read(REJECT);
    // onResult success calls appear only after `await` of the API call.
    const approveCall = approve.slice(approve.indexOf('const res = await approveRequest'));
    expect(approveCall).toContain("onResult({ kind: 'success'");
    const rejectCall = reject.slice(reject.indexOf('await rejectRequest'));
    expect(rejectCall).toContain("onResult({ kind: 'success' })");
    // ...and never inside the catch branch.
    expect(approve.slice(approve.indexOf('} catch (err)'))).not.toContain("kind: 'success'");
  });

  it('stale conflicts never present the action as successful', () => {
    for (const src of [APPROVE, REJECT]) {
      const file = read(src);
      expect(file).toContain('isStaleConflict(err)');
      expect(file).toContain("onResult({ kind: 'conflict' })");
    }
  });

  it('public reason and internal note stay visually + contractually separated', () => {
    const reject = read(REJECT);
    expect(reject).toContain('label="دلیل رد (عمومی)"');
    expect(reject).toContain('label="یادداشت داخلی (دلخواه)"');
    expect(reject).toContain('این متن برای دانشجو نمایش داده می‌شود.');
    expect(reject).toContain('فقط برای اپراتورها');
    const api = read('features/operator/api.ts');
    expect(api).toContain('public_rejection_reason: publicRejectionReason');
    expect(api).toContain("internal_note: internalNote ?? ''");
  });

  it('approve summary covers user, plan, amount, duration, impact and request id', () => {
    const approve = read(APPROVE);
    for (const row of [
      'کاربر',
      'پلن',
      'مبلغ',
      'مدت اشتراک',
      'تأثیر بر اشتراک فعلی',
      'شناسهٔ درخواست',
    ]) {
      expect(approve, row).toContain(row);
    }
    // No client-computed activation dates: the server owns them.
    expect(approve).toContain('res.startsAt');
    expect(approve).not.toMatch(/new Date\(\)\.setDate|startsAt\s*=\s*new Date/);
  });

  it('approve and reject are never equally emphasized', () => {
    const panel = read(PANEL);
    const approveIdx = panel.indexOf('data-testid="operator-approve-open"');
    const rejectIdx = panel.indexOf('data-testid="operator-reject-open"');
    expect(approveIdx).toBeGreaterThan(0);
    expect(rejectIdx).toBeGreaterThan(approveIdx);
    // Approve (before its testid) is contained/positive; Reject is
    // outlined with forced destructive token colors (after its testid).
    expect(panel.slice(0, approveIdx)).toContain('variant="contained"');
    expect(panel.slice(0, rejectIdx)).toContain('variant="outlined"');
    expect(panel.slice(rejectIdx)).toContain('error-main');
  });

  it('decision actions stack vertically on narrow phones', () => {
    const panel = read(PANEL);
    expect(panel).toContain("flexDirection: { xs: 'column', sm: 'row' }");
  });
});

describe('Receipt inspection', () => {
  it('uses the protected blob route with revoked lifecycle', () => {
    const receipt = read(RECEIPT);
    expect(receipt).toContain('fetchReceiptBlob(token, requestId');
    expect(receipt).toContain('URL.createObjectURL');
    expect(receipt).toContain('URL.revokeObjectURL');
    expect(receipt).toContain('ctrl.abort()');
  });

  it('treats 404 as missing-receipt state and keeps errors safe', () => {
    const receipt = read(RECEIPT);
    expect(receipt).toContain('isMissingReceipt(err)');
    expect(receipt).toContain('operator-receipt-missing');
    expect(receipt).toContain('toOperatorError(err, requestId)');
  });

  it('preview is bounded and zoom stays accessible', () => {
    const receipt = read(RECEIPT);
    expect(receipt).toContain('maxHeight: 360');
    expect(receipt).toContain("objectFit: 'contain'");
    expect(receipt).toContain('بزرگ‌نمایی رسید');
    expect(receipt).toContain('ReceiptZoomDialog');
  });

  it('zoom and decision controls are visually separated surfaces', () => {
    const detail = read(DETAIL);
    // The receipt lives in its own card, far above the decision panel.
    expect(detail).toContain('<SectionCard title="رسید پرداخت">');
    expect(detail).toContain('<OperatorDecisionPanel');
  });
});

describe('Workspace geometry and shell', () => {
  it('split is chosen deterministically by width via the theme breakpoint', () => {
    const workspace = read(WORKSPACE);
    expect(workspace).toContain("useMediaQuery(theme.breakpoints.up('md'))");
  });

  it('queue pane is bounded and detail takes the remaining space', () => {
    const workspace = read(WORKSPACE);
    expect(workspace).toContain('width: { md: 340, lg: 400 }');
    expect(workspace).toContain('flexShrink: 0');
    expect(workspace).toContain('flex: 1');
    expect(workspace).toContain('minWidth: 0');
  });

  it('panes scroll independently without document-level scroll traps', () => {
    const workspace = read(WORKSPACE);
    expect(workspace).toContain("overflowY: 'auto'");
    expect(workspace).toContain("overscrollBehavior: 'contain'");
    expect(workspace).not.toMatch(/overflowY: 'hidden'/);
  });

  it('mobile keeps the queue mounted and restores its scroll', () => {
    const workspace = read(WORKSPACE);
    expect(workspace).toContain('savedQueueScroll.current = window.scrollY');
    expect(workspace).toContain('requestAnimationFrame');
    expect(workspace).toContain("display: requestId ? 'none' : undefined");
  });

  it('selection preserves the queue filter query in the URL', () => {
    const workspace = read(WORKSPACE);
    expect(workspace).toContain('location.search');
    expect(workspace).toContain('navigate(`/operator/payment-requests/');
    expect(workspace).toMatch(/operator\/payment-requests\/\$\{id\}/);
  });

  it('one primary heading per surface in split mode', () => {
    const detail = read(DETAIL);
    expect(detail).toContain("component={isSplit ? 'h2' : 'h1'}");
    const queue = read(QUEUE);
    expect(queue).toContain('component="h1"');
  });

  it('critical controls declare 44px+ targets', () => {
    for (const file of [PANEL, TOOLBAR, APPROVE, REJECT, RECEIPT, STALE]) {
      const src = read(file);
      expect(src, file).toMatch(/minHeight: 4[48]/);
    }
  });

  it('operator shell offers Logout + Theme preference and no Student nav', () => {
    const header = read('app/shell/AppHeader.tsx');
    expect(header).toContain('operator-logout');
    expect(header).toContain('LogoutRoundedIcon');
    expect(header).toContain('<ThemeSwitch />');
    const shell = read('app/shell/AppShell.tsx');
    expect(shell).toContain('!isOperator ? <StudentBottomNav /> : null');
  });
});
