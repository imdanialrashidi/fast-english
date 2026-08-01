// app/src/features/operator/components/RejectDialog.tsx
import {
  Alert,
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
import { ApiError, rejectRequest } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
  requestId: string;
  onSuccess: () => void;
}

export function RejectDialog({ open, onClose, requestId, onSuccess }: Props) {
  const [reason, setReason] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleReject = async () => {
    if (!reason.trim() || reason.trim().length < 3) {
      setError('دلیل رد باید حداقل ۳ حرف باشد.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const pb = getPocketBase();
      const token = pb.authStore.token ?? '';
      await rejectRequest(token, requestId, reason.trim(), internalNote);
      setResult('درخواست با موفقیت رد شد.');
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در رد درخواست');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setReason('');
      setInternalNote('');
      setError(null);
      setResult(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth aria-busy={submitting}>
      <DialogTitle>رد درخواست پرداخت</DialogTitle>
      <DialogContent>
        {result ? (
          <Stack sx={{ gap: 2, alignItems: 'center', py: 2 }}>
            <Typography>{result}</Typography>
          </Stack>
        ) : (
          <Stack sx={{ gap: 2, mt: 1 }}>
            <Alert severity="warning" sx={{ mb: 1 }}>
              دلیل رد به دانشجو نمایش داده می‌شود. یادداشت داخلی فقط برای اپراتورها قابل مشاهده است.
            </Alert>
            <TextField
              label="دلیل رد (عمومی)"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              multiline
              rows={3}
              required
              fullWidth
              slotProps={{ htmlInput: { maxLength: 500 } }}
              error={!!error && reason.trim().length < 3}
              helperText={
                error && reason.trim().length < 3 ? error : `حداقل ۳ حرف (${reason.length}/۵۰۰)`
              }
            />
            <TextField
              label="یادداشت داخلی (دلخواه)"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              multiline
              rows={2}
              size="small"
              fullWidth
            />
            {error && reason.trim().length >= 3 && (
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
              color="error"
              onClick={handleReject}
              disabled={submitting || reason.trim().length < 3}
              startIcon={submitting ? <CircularProgress size={16} /> : undefined}
              sx={{ minHeight: 44 }}
            >
              {submitting ? 'در حال رد...' : 'رد درخواست'}
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
