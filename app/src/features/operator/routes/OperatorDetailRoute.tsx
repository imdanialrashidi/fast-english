// app/src/features/operator/routes/OperatorDetailRoute.tsx
// P1-S2 — Operator payment-request detail view.

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ImageIcon from '@mui/icons-material/Image';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageContainer } from '../../../app/shell/PageContainer';
import { PageHeader } from '../../../app/shell/PageHeader';
import { StatePanel } from '../../../app/shell/StatePanel';
import { getPocketBase } from '../../../lib/pocketbase';
import { ApiError, fetchDetail, fetchReceiptBlob } from '../api';
import { ApproveDialog } from '../components/ApproveDialog';
import { RejectDialog } from '../components/RejectDialog';
import {
  accountStatusLabel,
  formatAge,
  formatDate,
  formatDateTime,
  formatToman,
  statusLabel,
} from '../formatters';

export function OperatorDetailRoute() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const pb = getPocketBase();
  const token = useMemo(() => pb.authStore.token ?? '', [pb]);

  const [detail, setDetail] = useState<{
    id: string;
    status: string;
    created: string;
    updated: string;
    requestAgeSeconds: number;
    planId: string;
    planName: string;
    amountToman: number;
    durationDays: number;
    bankReference: string | null;
    senderCardLast4: string | null;
    transferAt: string | null;
    publicRejectionReason: string | null;
    internalNote: string | null;
    reviewedAt: string | null;
    reviewer: { id: string; name: string } | null;
    subscriptionId: string | null;
    student: {
      id: string;
      name: string;
      phone: string;
      accountStatus: string;
      placementCompleted: boolean;
      selectedLevel: string | null;
      suspended: boolean;
    } | null;
    currentActiveSubscription: {
      id: string;
      startsAt: string;
      expiresAt: string;
      status: string;
      planName: string;
      durationDays: number;
    } | null;
    latestSubscription: {
      id: string;
      startsAt: string;
      expiresAt: string;
      status: string;
      planName: string;
      durationDays: number;
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptZoomOpen, setReceiptZoomOpen] = useState(false);
  const receiptUrlRef = useRef<string | null>(null);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!requestId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDetail(token, requestId);
      setDetail(data as typeof detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری جزئیات');
    } finally {
      setLoading(false);
    }
  }, [requestId, token]);

  const loadReceipt = useCallback(async () => {
    if (!requestId || !token) return;
    setReceiptLoading(true);
    setReceiptError(null);
    if (receiptUrlRef.current) {
      URL.revokeObjectURL(receiptUrlRef.current);
      receiptUrlRef.current = null;
    }
    try {
      const blob = await fetchReceiptBlob(token, requestId);
      const url = URL.createObjectURL(blob);
      receiptUrlRef.current = url;
      setReceiptUrl(url);
    } catch (err) {
      setReceiptError(err instanceof ApiError ? err.message : 'خطا در بارگذاری رسید');
    } finally {
      setReceiptLoading(false);
    }
  }, [requestId, token]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    return () => {
      if (receiptUrlRef.current) URL.revokeObjectURL(receiptUrlRef.current);
    };
  }, []);

  const handleBack = useCallback(() => navigate('/operator'), [navigate]);
  const isPending = detail?.status === 'pending';

  if (loading) {
    return (
      <PageContainer maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  if (error || !detail) {
    return (
      <PageContainer maxWidth="md">
        <StatePanel variant="error" title="خطا" description={error ?? 'درخواست یافت نشد.'} />
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={handleBack}>
            بازگشت به صف
          </Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="md">
      <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={handleBack} aria-label="بازگشت">
          <ArrowBackIcon />
        </IconButton>
        <PageHeader
          title={`درخواست ${detail.student?.name ?? ''}`}
          subtitle={`شناسه: ${detail.id}`}
        />
      </Stack>

      <Stack sx={{ flexDirection: 'row', gap: 1, mb: 3 }}>
        <Chip
          label={statusLabel(detail.status)}
          color={
            detail.status === 'pending'
              ? 'warning'
              : detail.status === 'approved'
                ? 'success'
                : 'error'
          }
          size="small"
        />
        <Chip label={formatAge(detail.requestAgeSeconds)} variant="outlined" size="small" />
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                دانشجو
              </Typography>
              {detail.student?.name && <InfoRow label="نام" value={detail.student.name} />}
              {detail.student?.phone && <InfoRow label="تلفن" value={detail.student.phone} />}
              {detail.student?.accountStatus && (
                <InfoRow
                  label="وضعیت حساب"
                  value={accountStatusLabel(detail.student.accountStatus)}
                />
              )}
              {detail.student?.suspended && <InfoRow label="معلق" value="بله" />}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                پلن و مبلغ
              </Typography>
              <InfoRow label="پلن" value={detail.planName} />
              <InfoRow label="مبلغ" value={formatToman(detail.amountToman)} />
              <InfoRow label="مدت" value={`${detail.durationDays} روز`} />
              {detail.bankReference && <InfoRow label="مرجع بانکی" value={detail.bankReference} />}
              {detail.senderCardLast4 && (
                <InfoRow label="۴ رقم آخر کارت" value={detail.senderCardLast4} />
              )}
              {detail.transferAt && (
                <InfoRow label="زمان انتقال" value={formatDateTime(detail.transferAt)} />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                رسید
              </Typography>
              {!receiptUrl && !receiptLoading && !receiptError && (
                <Button variant="outlined" startIcon={<ImageIcon />} onClick={loadReceipt}>
                  نمایش رسید
                </Button>
              )}
              {receiptLoading && <CircularProgress size={24} />}
              {receiptError && (
                <Stack sx={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
                  <Typography variant="body2" color="error">
                    {receiptError}
                  </Typography>
                  <Button size="small" onClick={loadReceipt}>
                    تلاش مجدد
                  </Button>
                </Stack>
              )}
              {receiptUrl && (
                <Box
                  component="img"
                  src={receiptUrl}
                  alt="رسید پرداخت"
                  onClick={() => setReceiptZoomOpen(true)}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                اشتراک
              </Typography>
              {detail.currentActiveSubscription ? (
                <>
                  <InfoRow label="وضعیت" value={detail.currentActiveSubscription.status} />
                  <InfoRow
                    label="شروع"
                    value={formatDate(detail.currentActiveSubscription.startsAt)}
                  />
                  <InfoRow
                    label="پایان"
                    value={formatDate(detail.currentActiveSubscription.expiresAt)}
                  />
                  <InfoRow label="پلن" value={detail.currentActiveSubscription.planName} />
                </>
              ) : detail.latestSubscription ? (
                <>
                  <InfoRow label="وضعیت" value={detail.latestSubscription.status} />
                  <InfoRow label="پایان" value={formatDate(detail.latestSubscription.expiresAt)} />
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  بدون اشتراک
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {detail.reviewedAt && (
          <Grid size={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  بررسی
                </Typography>
                <InfoRow label="تاریخ بررسی" value={formatDateTime(detail.reviewedAt)} />
                {detail.reviewer?.name && (
                  <InfoRow label="بررسی‌کننده" value={detail.reviewer.name} />
                )}
                {detail.publicRejectionReason && (
                  <InfoRow label="دلیل رد (عمومی)" value={detail.publicRejectionReason} />
                )}
                {detail.internalNote && (
                  <InfoRow label="یادداشت داخلی" value={detail.internalNote} />
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {isPending && (
        <Stack
          sx={{ flexDirection: 'row', gap: 2, mt: 4, justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<CheckCircleIcon />}
            onClick={() => setApproveOpen(true)}
            sx={{ minHeight: 48, px: 3 }}
          >
            تأیید
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="large"
            startIcon={<CancelIcon />}
            onClick={() => setRejectOpen(true)}
            sx={{ minHeight: 48, px: 3 }}
          >
            رد
          </Button>
        </Stack>
      )}

      <Dialog
        open={receiptZoomOpen}
        onClose={() => setReceiptZoomOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>رسید پرداخت</DialogTitle>
        <DialogContent>
          {receiptUrl && (
            <Box
              component="img"
              src={receiptUrl}
              alt="رسید پرداخت"
              sx={{ maxWidth: '100%', maxHeight: '80vh', display: 'block', mx: 'auto' }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ApproveDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        requestId={detail.id}
        studentName={detail.student?.name ?? ''}
        planName={detail.planName}
        amountToman={detail.amountToman}
        durationDays={detail.durationDays}
        currentExpiry={detail.currentActiveSubscription?.expiresAt}
        onSuccess={loadDetail}
      />

      <RejectDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        requestId={detail.id}
        onSuccess={loadDetail}
      />
    </PageContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <Typography variant="body2" sx={{ mb: 0.5 }}>
      <strong>{label}:</strong> {value}
    </Typography>
  );
}
