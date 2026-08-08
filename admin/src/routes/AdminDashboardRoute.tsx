// admin/src/routes/AdminDashboardRoute.tsx
// Staff dashboard: only real operational summaries already available from
// the payment-review API. Nothing is fabricated.

import { Card, CardContent, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { StatePanel } from '../../../shared/ui/StatePanel';
import { getPocketBase } from '../auth/pocketbase';
import { fetchQueue } from '../features/payments/api';

type SummaryState =
  | { kind: 'loading' }
  | { kind: 'ready'; pendingCount: number }
  | { kind: 'error' };

export function AdminDashboardRoute() {
  const [summary, setSummary] = useState<SummaryState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setSummary({ kind: 'loading' });
    const token = getPocketBase().authStore.token ?? '';
    try {
      const res = await fetchQueue(token, { status: 'pending', perPage: 1 });
      setSummary({ kind: 'ready', pendingCount: res.totalItems });
    } catch {
      setSummary({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageContainer maxWidth="md">
      <PageHeader title="داشبورد مدیریت" />
      <Stack spacing={2}>
        <Card>
          <CardContent>
            {summary.kind === 'loading' ? (
              <StatePanel variant="loading" title="در حال بارگذاری…" />
            ) : summary.kind === 'error' ? (
              <StatePanel variant="error" title="دسترسی به اطلاعات ممکن نشد" />
            ) : (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  درخواستهای پرداخت در انتظار بررسی
                </Typography>
                <Typography variant="h2" data-testid="dashboard-pending-count">
                  {summary.pendingCount}
                </Typography>
                <Typography component={RouterLink} to="/payments" variant="body2">
                  مشاهدهٔ درخواستها
                </Typography>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  );
}
