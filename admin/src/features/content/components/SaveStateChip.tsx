// admin/src/features/content/components/SaveStateChip.tsx
// Explicit save-state feedback: ذخیره نشده / در حال ذخیره / ذخیره شد /
// خطا در ذخیره. Never shows success before the server acked.

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import { Chip } from '@mui/material';

export type SaveState = 'dirty' | 'saving' | 'saved' | 'error';

export function saveStateOf(
  isDirty: boolean,
  isSaving: boolean,
  saved: 'saved' | 'error' | null,
): SaveState {
  if (isSaving) return 'saving';
  if (saved === 'error') return 'error';
  if (saved === 'saved' && !isDirty) return 'saved';
  if (isDirty) return 'dirty';
  return 'saved';
}

const COPY: Record<SaveState, { label: string; color: 'default' | 'success' | 'error' }> = {
  dirty: { label: 'ذخیره نشده', color: 'default' },
  saving: { label: 'در حال ذخیره', color: 'default' },
  saved: { label: 'ذخیره شد', color: 'success' },
  error: { label: 'خطا در ذخیره', color: 'error' },
};

export function SaveStateChip({ state, testId }: { state: SaveState; testId?: string }) {
  const copy = COPY[state];
  return (
    <Chip
      data-testid={testId}
      icon={
        state === 'saved' ? (
          <CheckCircleRoundedIcon />
        ) : state === 'saving' ? (
          <CloudSyncRoundedIcon />
        ) : state === 'error' ? (
          <ErrorRoundedIcon />
        ) : undefined
      }
      label={copy.label}
      size="small"
      variant={state === 'saved' ? 'filled' : 'outlined'}
      color={copy.color}
    />
  );
}
