// admin/src/features/content/routes/ContentDashboardRoute.tsx
// Operational content overview: real numbers only (no invented
// statistics) plus quick actions.

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DraftsRoundedIcon from '@mui/icons-material/DraftsRounded';
import PublishedWithChangesRoundedIcon from '@mui/icons-material/PublishedWithChangesRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Alert, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { fetchImportHistory, fetchOverview } from '../api';
import { formatDateTime } from '../presentation';
import type { OverviewData } from '../types';

type State = { kind: 'loading' } | { kind: 'ready'; data: OverviewData } | { kind: 'error' };

export function ContentDashboardRoute() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const [overview, history] = await Promise.all([fetchOverview(), fetchImportHistory(5)]);
      setState({ kind: 'ready', data: { ...overview, recentImports: history.items } });
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title="محتوا"
        subtitle="نمای کلی عملیاتی محتوای پادکست"
        action={
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button
              component={RouterLink}
              to="/content/episodes/new"
              variant="contained"
              startIcon={<AddRoundedIcon />}
              data-testid="dashboard-new-episode"
              sx={{ minHeight: 44 }}
            >
              اپیزود جدید
            </Button>
            <Button
              component={RouterLink}
              to="/content/import"
              variant="outlined"
              startIcon={<CloudUploadRoundedIcon />}
              data-testid="dashboard-import"
              sx={{ minHeight: 44 }}
            >
              ورود بسته محتوا
            </Button>
          </Stack>
        }
      />
      {state.kind === 'loading' ? (
        <StatePanel variant="loading" title="در حال بارگذاری…" />
      ) : state.kind === 'error' ? (
        <StatePanel variant="error" title="دسترسی به اطلاعات ممکن نشد" />
      ) : (
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ flexWrap: 'wrap' }}>
            <StatCard
              icon={<DraftsRoundedIcon />}
              label="اپیزودهای پیشنویس"
              value={state.data.episodes.draft}
              testId="stat-draft"
            />
            <StatCard
              icon={<PublishedWithChangesRoundedIcon />}
              label="اپیزودهای منتشرشده"
              value={state.data.episodes.published}
              testId="stat-published"
            />
            <StatCard
              icon={<ArchiveRoundedIcon />}
              label="اپیزودهای بایگانیشده"
              value={state.data.episodes.archived}
              testId="stat-archived"
            />
            <StatCard
              icon={<WarningAmberRoundedIcon />}
              label="نسخههای دارای نقص محتوایی"
              value={state.data.variantsMissingRequired}
              testId="stat-incomplete"
            />
          </Stack>

          <Card>
            <CardContent>
              <Stack
                direction="row"
                spacing={2}
                sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <CategoryRoundedIcon color="primary" />
                  <Typography variant="titleMedium">دستهبندیها</Typography>
                </Stack>
                <Button
                  component={RouterLink}
                  to="/content/categories"
                  variant="outlined"
                  size="small"
                  sx={{ minHeight: 44 }}
                  data-testid="dashboard-categories"
                >
                  مدیریت دستهبندیها
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="titleMedium">ورودهای اخیر</Typography>
                {state.data.recentImports.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    هنوز بستهای وارد نشده است.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {state.data.recentImports.map((item) => (
                      <Stack
                        key={item.id}
                        direction="row"
                        spacing={2}
                        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                      >
                        <Typography variant="body2" dir="ltr" sx={{ fontWeight: 600 }}>
                          {item.contentKey}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(item.completedAt ?? item.startedAt)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          نسخه {item.contentVersion.toLocaleString('fa-IR')}
                        </Typography>
                        <ImportStatusLabel status={item.status} />
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>

          {state.data.variantsMissingRequired > 0 ? (
            <Alert severity="warning">
              {state.data.variantsMissingRequired.toLocaleString('fa-IR')} نسخه منتشرشده فیلدهای
              موردنیاز را ندارند (محتواهای قدیمی). انتشار مجدد آنها نیازمند تکمیل موارد است.
            </Alert>
          ) : null}
        </Stack>
      )}
    </PageContainer>
  );
}

function StatCard({
  icon,
  label,
  value,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <Card variant="outlined" sx={{ flex: '1 1 160px' }}>
      <CardContent>
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h2" data-testid={testId}>
            {value.toLocaleString('fa-IR')}
          </Typography>
        </Stack>
        {icon}
      </CardContent>
    </Card>
  );
}

function ImportStatusLabel({ status }: { status: string }) {
  const copy: Record<string, string> = {
    completed: 'موفق',
    no_change: 'بدون تغییر',
    failed: 'ناموفق',
    running: 'در حال اجرا',
    planned: 'برنامهریزی شده',
  };
  const color = status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'default';
  return (
    <Typography variant="caption" color={`${color}.main`} sx={{ fontWeight: 700 }}>
      {copy[status] ?? status}
    </Typography>
  );
}
