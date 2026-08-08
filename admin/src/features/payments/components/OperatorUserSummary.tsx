// admin/src/features/payments/components/OperatorUserSummary.tsx
// Safe student context for a payment decision: masked phone, account
// status, placement/level. Read-only values only — no editing controls.

import { Stack, Typography } from '@mui/material';
import { accountStatusLabel } from '../formatters';
import type { DetailStudent } from '../types';
import { OperatorDetailRow } from './OperatorDetailRow';

export function OperatorUserSummary({ student }: { student: DetailStudent | null }) {
  return (
    <Stack sx={{ gap: 1.5 }}>
      <Typography variant="subtitle2">کاربر و وضعیت حساب</Typography>
      {!student ? (
        <Typography variant="body2" color="text.secondary">
          اطلاعات کاربر در دسترس نیست.
        </Typography>
      ) : (
        <Stack sx={{ gap: 1.25 }}>
          <OperatorDetailRow label="نام" value={student.name || 'بدون نام'} />
          <OperatorDetailRow label="شماره تلفن" value={student.phone || '—'} valueDir="ltr" />
          <OperatorDetailRow label="وضعیت حساب" value={accountStatusLabel(student.accountStatus)} />
          <OperatorDetailRow
            label="تعیین سطح"
            value={student.placementCompleted ? 'تکمیل شده' : 'انجام نشده'}
          />
          {student.selectedLevel ? (
            <OperatorDetailRow label="سطح انتخابی" value={student.selectedLevel} />
          ) : null}
          {student.suspended ? (
            <Typography variant="body2" sx={{ color: 'var(--mui-palette-error-main)' }}>
              حساب این کاربر معلق است؛ فعال‌سازی اشتراک برای او ممکن نیست.
            </Typography>
          ) : null}
        </Stack>
      )}
    </Stack>
  );
}
