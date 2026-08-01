// app/src/features/operator/components/ApproveDialog.tsx

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { getPocketBase } from '../../../lib/pocketbase';
import { ApiError, approveRequest } from '../api';
import { formatDate, formatToman } from '../formatters';

interface Props {
  open: boolean;
  onClose: () => void;
  requestId: string;
  studentName: string;
  planName: string;
  amountToman: number;
  durationDays: number;
  currentExpiry: string | null | undefined;
  onSuccess: () => void;
}

export function ApproveDialog({
  open,
  onClose,
  requestId,
  studentName,
  planName,
  amountToman,
  durationDays,
  currentExpiry,
  onSuccess,
}: Props) {
  const [internalNote, setInternalNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleApprove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const pb = getPocketBase();
      const token = pb.authStore.token ?? '';
      await approveRequest(token, requestId, internalNote);
      setResult('اشتراک با موفقیت ایجاد شد.');
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در تأیید درخواست');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setInternalNote('');
      setError(null);
      setResult(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth aria-busy={submitting}>
      <DialogTitle>تأیید درخواست پرداخت</DialogTitle>
      <DialogContent>
        {result ? (
          <Stack sx={{ gap: 2, alignItems: 'center', py: 2 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 48 }} />
            <Typography>{result}</Typography>
          </Stack>
        ) : (
          <Stack sx={{ gap: 2, mt: 1 }}>
            <Typography variant="body2">
              <strong>دانشجو:</strong> {studentName}
            </Typography>
            <Typography variant="body2">
              <strong>پلن:</strong> {planName} — {formatToman(amountToman)}
            </Typography>
            <Typography variant="body2">
              <strong>مدت:</strong> {durationDays} روز
            </Typography>
            {currentExpiry && (
              <Typography variant="body2">
                <strong>اشتراک فعلی تا:</strong> {formatDate(currentExpiry)}
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              اشتراک جدید از زمان تأیید (یا پایان اشتراک فعلی، هرکدام دیرتر است) شروع می‌شود.
            </Typography>
            <TextField
              label="یادداشت داخلی (دلخواه)"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              multiline
              rows={2}
              size="small"
              fullWidth
            />
            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={submitting}>
              انصراف
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleApprove}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} /> : undefined}
              sx={{ minHeight: 44 }}
            >
              {submitting ? 'در حال تأیید...' : 'تأیید و فعال‌سازی'}
            </Button>
          </>
        ) : (
          <Button onClick={handleClose} variant="contained">
            بستن
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
