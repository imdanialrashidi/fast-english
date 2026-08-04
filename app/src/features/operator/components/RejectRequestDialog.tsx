// app/src/features/operator/components/RejectRequestDialog.tsx
// Two-step rejection with two clearly separated text concepts:
//  - Public rejection reason: required (≥3 chars, ≤500), visible to the
//    Student, inline-validated, wrapped in a visible-to-Student warning.
//  - Internal operator note: optional, labeled as internal, never sent to
//    any Student surface (the API sends it in a separate field).
// The confirm button keeps destructive emphasis; a stale 409 conflict
// closes the dialog and lets the detail refresh authoritative state.

import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import {
  Alert,
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
import { ApiError, rejectRequest } from '../api';
import { isStaleConflict, toOperatorError } from '../errors';
import { formatToman } from '../formatters';
import {
  INTERNAL_NOTE_MAX,
  PUBLIC_REASON_MAX,
  PUBLIC_REASON_MIN,
  publicReasonError,
} from '../logic';
import { OperatorDetailRow } from './OperatorDetailRow';

export type RejectOutcome = { kind: 'success' } | { kind: 'conflict' };

interface Props {
  open: boolean;
  onClose: () => void;
  requestId: string;
  studentName: string;
  planName: string;
  amountToman: number;
  onResult: (outcome: RejectOutcome) => void;
}

export function RejectRequestDialog({
  open,
  onClose,
  requestId,
  studentName,
  planName,
  amountToman,
  onResult,
}: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [reason, setReason] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = reason.trim();
  const reasonError = publicReasonError(reason);

  const handleReject = async () => {
    if (submitting) return; // no double submission
    if (trimmed.length < PUBLIC_REASON_MIN) {
      setError('دلیل رد باید حداقل ۳ حرف باشد.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const pb = getPocketBase();
      const token = pb.authStore.token ?? '';
      await rejectRequest(token, requestId, trimmed, internalNote);
      // Success is only reported after the Backend acknowledged the
      // rejection transaction.
      onResult({ kind: 'success' });
    } catch (err) {
      if (err instanceof ApiError && isStaleConflict(err)) {
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
      setReason('');
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
      data-testid="reject-dialog"
    >
      <DialogTitle>رد درخواست پرداخت</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, mt: 1 }}>
          <Alert severity="warning" data-testid="reject-student-warning">
            متن «دلیل رد» به دانشجو نمایش داده می‌شود. یادداشت داخلی فقط برای اپراتورها است.
          </Alert>

          <Box
            sx={{
              p: 1.5,
              borderRadius: '12px',
              border: 1,
              borderColor: 'var(--mui-palette-outlineVariant)',
              backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
            }}
          >
            <Stack sx={{ gap: 1.25 }}>
              <OperatorDetailRow label="کاربر" value={studentName || 'بدون نام'} />
              <OperatorDetailRow label="پلن" value={planName} />
              <OperatorDetailRow label="مبلغ" value={formatToman(amountToman)} />
            </Stack>
          </Box>

          <Box>
            <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, mb: 1 }}>
              <PublicRoundedIcon
                fontSize="small"
                sx={{ color: 'var(--mui-palette-onSurfaceVariant)' }}
              />
              <Typography variant="caption" color="text.secondary">
                این متن برای دانشجو نمایش داده می‌شود.
              </Typography>
            </Stack>
            <TextField
              label="دلیل رد (عمومی)"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, PUBLIC_REASON_MAX))}
              multiline
              rows={3}
              required
              fullWidth
              error={reasonError !== null}
              slotProps={{ htmlInput: { maxLength: PUBLIC_REASON_MAX } }}
              helperText={
                reasonError !== null ? reasonError : `${reason.length}/${PUBLIC_REASON_MAX}`
              }
              data-testid="reject-public-reason"
            />
          </Box>

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
              data-testid="reject-internal-note"
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
          color="error"
          onClick={handleReject}
          disabled={submitting || trimmed.length < PUBLIC_REASON_MIN}
          startIcon={submitting ? <CircularProgress size={16} /> : undefined}
          sx={{ minHeight: 48, minWidth: 160 }}
          data-testid="reject-confirm"
        >
          {submitting ? 'در حال رد...' : 'رد درخواست'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
