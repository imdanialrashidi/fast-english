// app/src/features/operator/components/OperatorEmptyState.tsx
// The three calm operator empty states. `no-pending` must read as a
// healthy operational state (nothing to review), never as an application
// error; `filtered` is actionable; `select` is the desktop detail-pane
// placeholder before a request is chosen.

import { Button } from '@mui/material';
import { StatePanel } from '../../../app/shell/StatePanel';
import type { QueueEmptyKind } from '../logic';

interface Props {
  kind: QueueEmptyKind | 'select';
  /** Clears every queue filter (only meaningful for `filtered`). */
  onClearFilters?: () => void;
}

export function OperatorEmptyState({ kind, onClearFilters }: Props) {
  if (kind === 'no-pending') {
    return (
      <StatePanel
        variant="success"
        title="درخواست در انتظار بررسی وجود ندارد."
        description="صف بررسی خالی است. درخواست جدید پس از ثبت، اینجا نمایش داده می‌شود."
        data-testid="queue-empty-no-pending"
      />
    );
  }
  if (kind === 'select') {
    return (
      <StatePanel
        variant="empty"
        title="درخواستی انتخاب نشده است"
        description="یک درخواست از صف انتخاب کنید تا جزئیات، رسید و اقدامات تصمیم‌گیری نمایش داده شوند."
        data-testid="detail-empty-select"
      />
    );
  }
  return (
    <StatePanel
      variant="empty"
      title="درخواستی با این فیلترها یافت نشد"
      description="جستجو یا فیلتر وضعیت را تغییر دهید."
      action={
        onClearFilters ? (
          <Button onClick={onClearFilters} data-testid="queue-filtered-clear">
            پاک‌کردن فیلترها
          </Button>
        ) : undefined
      }
      data-testid="queue-empty-filtered"
    />
  );
}
