// admin/src/features/payments/components/OperatorRequestDetail.tsx
// The selected-request detail pane, ordered by the accepted hierarchy:
//   1. status + request identity (with live region + post-decision focus)
//   2. user and account context
//   3. payment expectation
//   4. protected receipt inspection
//   5. current Subscription
//   6. bounded request history
//   7. decision controls (pending only, after all context)
// Approve/Reject are never shown before the receipt and payment context.
// A stale multi-operator decision refreshes authoritative state and shows
// the stale alert instead of a false success.

import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Box, Card, CardContent, IconButton, Skeleton, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CopyValue } from '../../../../../shared/ui/CopyValue';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { getPocketBase } from '../../../auth/pocketbase';
import { fetchDetail } from '../api';
import { type OperatorError, toOperatorError } from '../errors';
import { formatAge, formatDateTime, formatToman } from '../formatters';
import type { RequestDetail } from '../types';
import { type ApproveOutcome, ApproveRequestDialog } from './ApproveRequestDialog';
import { OperatorDecisionPanel } from './OperatorDecisionPanel';
import { OperatorDetailRow } from './OperatorDetailRow';
import { OperatorReceiptInspector } from './OperatorReceiptInspector';
import { OperatorRequestHistory } from './OperatorRequestHistory';
import { OperatorStaleState } from './OperatorStaleState';
import { OperatorStatusChip } from './OperatorStatusChip';
import { OperatorSubscriptionSummary } from './OperatorSubscriptionSummary';
import { OperatorUserSummary } from './OperatorUserSummary';
import { type RejectOutcome, RejectRequestDialog } from './RejectRequestDialog';

interface Props {
  requestId: string;
  /** Split workspace: the queue h1 is the page heading, detail uses h2. */
  isSplit: boolean;
  /** Mobile only: back to the queue (queue state is preserved). */
  onBack?: () => void;
  /** Called after every completed decision attempt (success or conflict):
   * the workspace refreshes the queue and moves focus to the status. */
  onDecisionDone: () => void;
  /** Bumped by the workspace after a decision so focus lands on the
   * resulting status region. */
  focusSignal: number;
}

type SuccessNotice =
  | { kind: 'approved'; startsAt: string; expiresAt: string }
  | { kind: 'rejected' };

export function OperatorRequestDetail({
  requestId,
  isSplit,
  onBack,
  onDecisionDone,
  focusSignal,
}: Props) {
  const pb = getPocketBase();
  const token = useMemo(() => pb.authStore.token ?? '', [pb]);

  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<OperatorError | null>(null);
  const [stale, setStale] = useState(false);
  const [successNotice, setSuccessNotice] = useState<SuccessNotice | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const openedStatusRef = useRef<string | null>(null);
  const statusRegionRef = useRef<HTMLDivElement | null>(null);

  const loadDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!requestId || !token) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDetail(token, requestId, signal);
        if (signal?.aborted) return;
        setDetail(data);
        // Multi-operator change detection: if the request changed status
        // since this operator first opened it (and the operator did not
        // cause the change themselves), surface the stale alert. The
        // decision handlers update `openedStatusRef` on their own success.
        if (openedStatusRef.current && openedStatusRef.current !== data.status) {
          setStale(true);
        }
        if (!openedStatusRef.current) openedStatusRef.current = data.status;
      } catch (err) {
        if (signal?.aborted) return;
        setError(toOperatorError(err, requestId));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [requestId, token],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    loadDetail(ctrl.signal);
    return () => ctrl.abort();
  }, [loadDetail, reloadKey]);

  // After a successful decision the workspace bumps `focusSignal`: move
  // keyboard focus to the resulting status region (visible + announced).
  useEffect(() => {
    if (focusSignal > 0) {
      statusRegionRef.current?.focus({ preventScroll: false });
    }
  }, [focusSignal]);

  const handleDecisionResult = useCallback(
    (outcome: ApproveOutcome | RejectOutcome) => {
      if (outcome.kind === 'conflict') {
        setStale(true);
      } else if ('startsAt' in outcome) {
        setStale(false);
        setSuccessNotice({
          kind: 'approved',
          startsAt: outcome.startsAt,
          expiresAt: outcome.expiresAt,
        });
        openedStatusRef.current = 'approved';
      } else {
        setStale(false);
        setSuccessNotice({ kind: 'rejected' });
        openedStatusRef.current = 'rejected';
      }
      setApproveOpen(false);
      setRejectOpen(false);
      onDecisionDone();
      setReloadKey((k) => k + 1); // authoritative refresh
    },
    [onDecisionDone],
  );

  const handleRefresh = useCallback(() => setReloadKey((k) => k + 1), []);

  if (loading && !detail) {
    return <DetailSkeleton />;
  }

  if (error || !detail) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <StatePanel
          variant="error"
          title="بارگذاری جزئیات ناموفق بود"
          description={error?.message ?? 'درخواست یافت نشد.'}
          requestId={error?.requestId ?? requestId}
          action={
            <Stack sx={{ flexDirection: 'row', gap: 1 }}>
              <IconButton
                onClick={handleRefresh}
                aria-label="تلاش دوباره"
                sx={{ minWidth: 44, minHeight: 44 }}
                data-testid="operator-detail-retry"
              >
                <RefreshRoundedIcon />
              </IconButton>
              {onBack ? (
                <IconButton
                  onClick={onBack}
                  aria-label="بازگشت به صف"
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  <ArrowForwardRoundedIcon />
                </IconButton>
              ) : null}
            </Stack>
          }
        />
      </Box>
    );
  }

  const isPending = detail.status === 'pending';

  return (
    <Box
      sx={{
        maxWidth: 880,
        mx: 'auto',
        px: { xs: 2, md: 3 },
        py: { xs: 1.5, md: 3 },
      }}
      data-testid="operator-request-detail"
    >
      {!isSplit && onBack ? (
        <IconButton
          onClick={onBack}
          aria-label="بازگشت به صف"
          sx={{ minWidth: 44, minHeight: 44, mb: 0.5 }}
          data-testid="operator-detail-back"
        >
          <ArrowForwardRoundedIcon />
        </IconButton>
      ) : null}

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component={isSplit ? 'h2' : 'h1'}
            variant="h3"
            sx={{ overflowWrap: 'anywhere', mb: 0.5 }}
          >
            درخواست {detail.student?.name ?? ''}
          </Typography>
          <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              شناسه: <bdi dir="ltr">{detail.id}</bdi>
            </Typography>
            <CopyValue
              value={detail.id}
              label="کپی شناسهٔ درخواست"
              hint=""
              data-testid="operator-copy-request-id"
            />
          </Stack>
        </Box>
        <IconButton
          onClick={handleRefresh}
          aria-label="تازه‌سازی جزئیات"
          sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
          data-testid="operator-detail-refresh"
        >
          <RefreshRoundedIcon />
        </IconButton>
      </Box>

      {/* Status region: receives keyboard focus and announces changes
          after a decision. */}
      <Box
        ref={statusRegionRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        data-testid="operator-detail-status"
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          mb: 2,
          borderRadius: '12px',
          px: 0.5,
          py: 0.25,
          '&:focus-visible': {
            outline: '2px solid var(--mui-palette-focusRing)',
            outlineOffset: 2,
          },
        }}
      >
        <OperatorStatusChip status={detail.status} />
        {detail.created ? (
          <Typography variant="body2" color="text.secondary">
            ثبت: {formatDateTime(detail.created)} — سن: {formatAge(detail.requestAgeSeconds)}
          </Typography>
        ) : null}
        {detail.updated && detail.updated !== detail.created ? (
          <Typography variant="caption" color="text.secondary">
            آخرین به‌روزرسانی: {formatDateTime(detail.updated)}
          </Typography>
        ) : null}
      </Box>

      {stale ? (
        <OperatorStaleState
          status={detail.status}
          reviewedAt={detail.reviewedAt}
          reviewerName={detail.reviewer?.name ?? null}
          onRefresh={handleRefresh}
        />
      ) : null}

      {successNotice ? (
        <Box
          role="status"
          data-testid="operator-decision-success"
          sx={{
            mb: 2,
            p: 2,
            borderRadius: '12px',
            border: 1,
            borderColor: 'var(--mui-palette-success-main)',
            backgroundColor: 'var(--mui-palette-successContainer)',
            color: 'var(--mui-palette-onSuccessContainer)',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {successNotice.kind === 'approved'
              ? 'اشتراک با موفقیت فعال شد'
              : 'درخواست با موفقیت رد شد'}
          </Typography>
          {successNotice.kind === 'approved' ? (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              شروع: {formatDateTime(successNotice.startsAt)} — پایان:{' '}
              {formatDateTime(successNotice.expiresAt)}
            </Typography>
          ) : null}
        </Box>
      ) : null}

      <Stack sx={{ gap: 2 }}>
        <SectionCard>
          <OperatorUserSummary student={detail.student} />
        </SectionCard>

        <SectionCard title="انتظار پرداخت">
          <Stack sx={{ gap: 1.25 }}>
            <OperatorDetailRow label="پلن" value={detail.planName} />
            <OperatorDetailRow label="مبلغ مورد انتظار" value={formatToman(detail.amountToman)} />
            <OperatorDetailRow label="مدت" value={`${detail.durationDays} روز`} />
            {detail.bankReference ? (
              <OperatorDetailRow label="مرجع بانکی" value={detail.bankReference} valueDir="ltr" />
            ) : null}
            {detail.senderCardLast4 ? (
              <OperatorDetailRow
                label="۴ رقم آخر کارت"
                value={detail.senderCardLast4}
                valueDir="ltr"
              />
            ) : null}
            {detail.transferAt ? (
              <OperatorDetailRow label="زمان انتقال" value={formatDateTime(detail.transferAt)} />
            ) : null}
          </Stack>
        </SectionCard>

        <SectionCard title="رسید پرداخت">
          <OperatorReceiptInspector requestId={detail.id} token={token} />
        </SectionCard>

        <SectionCard>
          <OperatorSubscriptionSummary
            current={detail.currentActiveSubscription}
            latest={detail.latestSubscription}
          />
        </SectionCard>

        <SectionCard>
          <OperatorRequestHistory detail={detail} />
        </SectionCard>

        {isPending ? (
          <OperatorDecisionPanel
            onApprove={() => {
              setRejectOpen(false);
              setApproveOpen(true);
            }}
            onReject={() => {
              setApproveOpen(false);
              setRejectOpen(true);
            }}
          />
        ) : (
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                این درخواست دیگر در انتظار بررسی نیست؛ امکان تصمیم‌گیری وجود ندارد.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Stack>

      <ApproveRequestDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        requestId={detail.id}
        studentName={detail.student?.name ?? ''}
        planName={detail.planName}
        amountToman={detail.amountToman}
        durationDays={detail.durationDays}
        currentExpiry={detail.currentActiveSubscription?.expiresAt}
        onResult={handleDecisionResult}
      />

      <RejectRequestDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        requestId={detail.id}
        studentName={detail.student?.name ?? ''}
        planName={detail.planName}
        amountToman={detail.amountToman}
        onResult={handleDecisionResult}
      />
    </Box>
  );
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        {title ? (
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            {title}
          </Typography>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <Box
      sx={{ maxWidth: 880, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 1.5, md: 3 } }}
      data-testid="operator-detail-loading"
    >
      <Skeleton variant="text" width="45%" sx={{ fontSize: '1.5rem' }} />
      <Skeleton variant="text" width="30%" sx={{ fontSize: '0.875rem', mb: 2 }} />
      <Stack sx={{ gap: 2 }}>
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              p: 2,
              borderRadius: '16px',
              backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
            }}
          >
            <Skeleton variant="text" width="35%" sx={{ fontSize: '0.875rem', mb: 1 }} />
            <Skeleton variant="text" width="80%" sx={{ fontSize: '0.875rem' }} />
            <Skeleton variant="text" width="60%" sx={{ fontSize: '0.875rem' }} />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
