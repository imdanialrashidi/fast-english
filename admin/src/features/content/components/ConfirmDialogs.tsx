// admin/src/features/content/components/ConfirmDialogs.tsx
// Publish / Archive confirmation dialogs. Archive explains the impact
// (Student access disappears; records and Progress are never deleted).
// Success is shown only after the server acknowledges.

import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { safeErrorMessage } from '../errors';

export type PublishTargetKind = 'category' | 'episode' | 'variant';

export interface PublishDialogProps {
  open: boolean;
  kind: PublishTargetKind;
  title: string;
  /** Readiness issues (server-authoritative) to show before confirming. */
  issues: string[];
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

const PUBLISH_COPY: Record<PublishTargetKind, string> = {
  category: 'این دستهبندی برای دانشجویان منتشر میشود.',
  episode: 'این اپیزود و نسخههای منتشرشده آن برای دانشجویان در دسترس قرار میگیرند.',
  variant: 'این نسخه سطح برای دانشجویان در دسترس قرار میگیرد.',
};

export function PublishDialog({
  open,
  kind,
  title,
  issues,
  onConfirm,
  onClose,
}: PublishDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setError(null);
    setBusy(true);
    try {
      await onConfirm();
      setBusy(false);
      onClose();
    } catch (err) {
      setError(safeErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      data-testid="publish-dialog"
    >
      <DialogTitle>انتشار — {title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {issues.length > 0 ? (
            <Alert severity="warning">
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                این موارد هنوز مانع انتشار هستند:
              </Typography>
              <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                {issues.map((m, i) => (
                  <li key={i}>
                    <Typography variant="body2">{m}</Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert severity="success" icon={<CheckCircleRoundedIcon />}>
              {PUBLISH_COPY[kind]}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            {kind === 'variant'
              ? 'در صورت منتشرنبودن اپیزود والد، ابتدا اپیزود را منتشر کنید.'
              : 'پس از انتشار، محتوا بلافاصله در دسترس دانشجویان قرار میگیرد.'}
          </Typography>
          {error ? (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} sx={{ minHeight: 44 }}>
          انصراف
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={<CheckCircleRoundedIcon />}
          onClick={() => void confirm()}
          disabled={busy}
          data-testid="publish-confirm"
          sx={{ minHeight: 44 }}
        >
          انتشار
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export interface ArchiveDialogProps {
  open: boolean;
  kind: PublishTargetKind;
  title: string;
  impact: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

const ARCHIVE_IMPACT: Record<PublishTargetKind, string> = {
  category: 'اپیزودهای این دستهبندی در اپ دانشجو نمایش داده نمیشوند.',
  episode: 'تمام نسخههای این اپیزود از دسترس دانشجو خارج میشوند.',
  variant: 'این نسخه از کتابخانه دانشجو پنهان میشود، اما پیشرفت کاربران حذف نخواهد شد.',
};

export function ArchiveDialog({
  open,
  kind,
  title,
  impact,
  onConfirm,
  onClose,
}: ArchiveDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setError(null);
    setBusy(true);
    try {
      await onConfirm();
      setBusy(false);
      onClose();
    } catch (err) {
      setError(safeErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      data-testid="archive-dialog"
    >
      <DialogTitle>بایگانی — {title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="warning" icon={<ArchiveRoundedIcon />}>
            <Typography variant="body2">{impact || ARCHIVE_IMPACT[kind]}</Typography>
          </Alert>
          <Typography variant="body2" color="text.secondary">
            محتوای بایگانیشده حذف نمیشود و میتوانید بعداً دوباره منتشرش کنید.
          </Typography>
          {error ? (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} sx={{ minHeight: 44 }}>
          انصراف
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={() => void confirm()}
          disabled={busy}
          data-testid="archive-confirm"
          sx={{ minHeight: 44 }}
        >
          بایگانی
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export interface UnsavedBlockerDialogProps {
  open: boolean;
  onProceed: () => void;
  onStay: () => void;
}

export function UnsavedBlockerDialog({ open, onProceed, onStay }: UnsavedBlockerDialogProps) {
  return (
    <Dialog open={open} maxWidth="xs" fullWidth data-testid="unsaved-dialog">
      <DialogTitle>تغییرات ذخیرهنشده</DialogTitle>
      <DialogContent>
        <Typography variant="body2">تغییرات این صفحه هنوز ذخیره نشدهاند. خارج میشوید؟</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onStay} autoFocus sx={{ minHeight: 44 }} data-testid="unsaved-stay">
          ماندن در صفحه
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onProceed}
          sx={{ minHeight: 44 }}
          data-testid="unsaved-leave"
        >
          خروج بدون ذخیره
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Small shared confirmation for one-off actions (e.g. remove media). */
export function SimpleConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  confirmColor = 'error',
  onConfirm,
  onClose,
  testId,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  confirmColor?: 'error' | 'warning' | 'primary';
  onConfirm: () => Promise<void>;
  onClose: () => void;
  testId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setError(null);
    setBusy(true);
    try {
      await onConfirm();
      setBusy(false);
      onClose();
    } catch (err) {
      setError(safeErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      data-testid={testId}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2">{body}</Typography>
          {error ? (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy} sx={{ minHeight: 44 }}>
          انصراف
        </Button>
        <Button
          variant="contained"
          color={confirmColor}
          onClick={() => void confirm()}
          disabled={busy}
          sx={{ minHeight: 44 }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
