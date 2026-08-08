// admin/src/features/payments/components/OperatorDetailRow.tsx
// Read-only label/value row for detail surfaces. Values are plain text —
// nothing editable-looking — and long values wrap instead of overflowing.

import { Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function OperatorDetailRow({
  label,
  value,
  valueDir,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Force a writing direction for Latin values (e.g. bank references). */
  valueDir?: 'ltr' | 'rtl';
}) {
  return (
    <Stack sx={{ gap: 0.25 }}>
      <Typography variant="caption" color="text.secondary" component="span">
        {label}
      </Typography>
      <Typography variant="body2" dir={valueDir} sx={{ overflowWrap: 'anywhere', fontWeight: 500 }}>
        {value}
      </Typography>
    </Stack>
  );
}
