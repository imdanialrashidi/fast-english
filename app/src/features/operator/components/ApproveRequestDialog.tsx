// app/src/features/operator/components/ApproveRequestDialog.tsx
// Two-step approval: the operator confirms a summary (user, plan, amount,
// duration, request ID, current-Subscription impact) before the Backend
// transaction runs. No client-computed activation dates — the authoritative
// startsAt/expiresAt come from the approval response and are shown only
// after the Backend acknowledges the decision. Double-submit is prevented;
// a stale 409 conflict closes the dialog and lets the detail refresh.

import LockRoundedIcon from '@mui/icons-material/LockRounded';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { getPocketBase } from '../../../lib/pocketbase';
import { ApiError, approveRequest } from '../api';
import { isStaleConflict, toOperatorError } from '../errors';
import { formatDate, formatToman } from '../formatters';
import { INTERNAL_NOTE_MAX } from '../logic';
import { OperatorDetailRow } from './OperatorDetailRow';

export type ApproveOutcome =
  | { kind: 'success'; startsAt: string; expiresAt: string }
  | { kind: 'conflict' };

interface Props {
  open: boolean;
  onClose: () => void;
  requestId: string;
  studentName: string;
  planName: string;
  amountToman: number;
  durationDays: number;
  currentExpiry: string | null | undefined;
  onResult: (outcome: ApproveOutcome) => void;
}

export function ApproveRequestDialog({
  open,
  onClose,
  requestId,
  studentName,
  planName,
  amountToman,
  durationDays,
  currentExpiry,
  onResult,
}: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [internalNote, setInternalNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (submitting) return; // no double submission
    setSubmitting(true);
    setError(null);
    try {
      const pb = getPocketBase();
      const token = pb.authStore.token ?? '';
      const res = await approveRequest(token, requestId, internalNote);
      // Success is only reported after the Backend acknowledged the
      // transaction; dates come from the authoritative response.
      onResult({ kind: 'success', startsAt: res.startsAt, expiresAt: res.expiresAt });
    } catch (err) {
      if (err instanceof ApiError && isStaleConflict(err)) {
        // Another operator already decided: never show this action as
        // successful — close and let the detail refresh authoritative state.
        onResult({ kind: 'conflict' });
        return;
      }
      setError(toOperatorError(err, requestId).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setInternalNote('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      aria-busy={submitting}
      data-testid="approve-dialog"
    >
      <DialogTitle>تأیید درخواست پرداخت</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, mt: 1 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: '12px',
              backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
            }}
          >
            <Stack sx={{ gap: 1.25 }}>
              <OperatorDetailRow label="کاربر" value={studentName || 'بدون نام'} />
              <OperatorDetailRow label="پلن" value={planName} />
              <OperatorDetailRow label="مبلغ" value={formatToman(amountToman)} />
              <OperatorDetailRow label="مدت اشتراک" value={`${durationDays} روز`} />
              <OperatorDetailRow label="شناسهٔ درخواست" value={requestId} valueDir="ltr" />
              <OperatorDetailRow
                label="تأثیر بر اشتراک فعلی"
                value={
                  currentExpiry
                    ? `کاربر اشتراک فعال تا ${formatDate(currentExpiry)} دارد؛ اشتراک جدید پس از پایان آن آغاز می‌شود.`
                    : 'کاربر اشتراک فعال ندارد؛ اشتراک از زمان تأیید آغاز می‌شود.'
                }
              />
            </Stack>
          </Box>
          <Typography variant="caption" color="text.secondary">
            تاریخ دقیق شروع و پایان اشتراک توسط سرور محاسبه و پس از تأیید نمایش داده می‌شود.
          </Typography>

          <Box
            sx={{
              p: 1.5,
              borderRadius: '12px',
              border: 1,
              borderColor: 'var(--mui-palette-outlineVariant)',
              backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
            }}
          >
            <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, mb: 1 }}>
              <LockRoundedIcon
                fontSize="small"
                sx={{ color: 'var(--mui-palette-onSurfaceVariant)' }}
              />
              <Typography variant="caption" color="text.secondary">
                فقط برای اپراتورها قابل مشاهده است — در هیچ رخداد دانشجو نمایش داده نمی‌شود.
              </Typography>
            </Stack>
            <TextField
              label="یادداشت داخلی (دلخواه)"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value.slice(0, INTERNAL_NOTE_MAX))}
              multiline
              rows={2}
              size="small"
              slotProps={{ htmlInput: { maxLength: INTERNAL_NOTE_MAX } }}
              data-testid="approve-internal-note"
            />
          </Box>

          {error ? (
            <Typography
              variant="body2"
              sx={{ color: 'var(--mui-palette-error-main)' }}
              role="alert"
            >
              {error}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          انصراف
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleApprove}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} /> : undefined}
          sx={{ minHeight: 48, minWidth: 160 }}
          data-testid="approve-confirm"
        >
          {submitting ? 'در حال تأیید...' : 'تأیید و فعال‌سازی'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
