// app/src/features/operator/routes/OperatorQueueRoute.tsx
// P1-S2 — Operator payment-requests queue view.

import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  OutlinedInput,
  Pagination,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PageContainer } from '../../../app/shell/PageContainer';
import { PageHeader } from '../../../app/shell/PageHeader';
import { StatePanel } from '../../../app/shell/StatePanel';
import { getPocketBase } from '../../../lib/pocketbase';
import { ApiError, fetchQueue } from '../api';
import { formatAge, formatDateTime, formatToman, statusLabel } from '../formatters';
import type { QueueItem, QueueStatusFilter } from '../types';

const PER_PAGE = 20;
const VALID_STATUSES: QueueStatusFilter[] = ['all', 'pending', 'approved', 'rejected', 'cancelled'];

export function OperatorQueueRoute() {
  const token = useMemo(() => getPocketBase().authStore.token ?? '', []);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') ?? '1');
  const statusParam = (searchParams.get('status') ?? 'all') as QueueStatusFilter;
  const searchParam = searchParams.get('search') ?? '';

  const [searchInput, setSearchInput] = useState(searchParam);
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>(
    VALID_STATUSES.includes(statusParam) ? statusParam : 'all',
  );

  const [data, setData] = useState<{
    response: {
      page: number;
      perPage: number;
      totalItems: number;
      totalPages: number;
      items: QueueItem[];
    } | null;
    loading: boolean;
    error: string | null;
  }>({
    response: null,
    loading: true,
    error: null,
  });

  const loadQueue = useCallback(
    async (p: number, st: QueueStatusFilter, q: string, signal?: AbortSignal) => {
      setData((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetchQueue(token, { page: p, perPage: PER_PAGE, status: st, search: q });
        if (!signal?.aborted) {
          setData({ response: res, loading: false, error: null });
        }
      } catch (err) {
        if (signal?.aborted) return;
        const msg = err instanceof ApiError ? err.message : 'خطا در بارگذاری درخواست‌ها';
        setData((prev) => ({ ...prev, loading: false, error: msg }));
      }
    },
    [token],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    loadQueue(page, statusFilter, searchParam, ctrl.signal);
    return () => ctrl.abort();
  }, [page, statusFilter, searchParam, loadQueue]);

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', '1');
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (searchInput.trim()) params.set('search', searchInput.trim());
    setSearchParams(params);
  }, [statusFilter, searchInput, setSearchParams]);

  const handleStatusChange = useCallback(
    (val: QueueStatusFilter) => {
      setStatusFilter(val);
      const params = new URLSearchParams(searchParams);
      params.set('page', '1');
      if (val !== 'all') params.set('status', val);
      else params.delete('status');
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const handlePageChange = useCallback(
    (_: unknown, p: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', String(p));
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const openDetail = useCallback(
    (id: string) => navigate(`/operator/payment-requests/${id}`),
    [navigate],
  );

  const { response, loading, error } = data;

  return (
    <PageContainer maxWidth="lg">
      <PageHeader title="صف درخواست‌های پرداخت" subtitle="بررسی، تأیید یا رد درخواست‌ها" />

      <Stack sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <Select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as QueueStatusFilter)}
            aria-label="فیلتر وضعیت"
          >
            <MenuItem value="all">همه</MenuItem>
            <MenuItem value="pending">در انتظار</MenuItem>
            <MenuItem value="approved">تأیید شده</MenuItem>
            <MenuItem value="rejected">رد شده</MenuItem>
            <MenuItem value="cancelled">لغو شده</MenuItem>
          </Select>
        </FormControl>

        <OutlinedInput
          size="small"
          placeholder="جستجو با مرجع بانکی یا شناسه..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
          sx={{ flex: { xs: '1 1 auto', sm: '0 1 300px' } }}
          endAdornment={
            <InputAdornment position="end">
              <IconButton
                onClick={handleSearch}
                aria-label="جستجو"
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <SearchIcon />
              </IconButton>
            </InputAdornment>
          }
        />
      </Stack>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && error && <StatePanel variant="error" title="خطا" description={error} />}

      {!loading && !error && response && response.items.length === 0 && (
        <StatePanel
          variant="empty"
          title="درخواستی یافت نشد"
          description="هیچ درخواستی با فیلترهای انتخاب شده وجود ندارد."
        />
      )}

      {!loading && !error && response && response.items.length > 0 && (
        <>
          <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>وضعیت</TableCell>
                  <TableCell>دانشجو</TableCell>
                  <TableCell>پلن</TableCell>
                  <TableCell>مبلغ</TableCell>
                  <TableCell>سن درخواست</TableCell>
                  <TableCell>زمان انتقال</TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>عملیات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {response.items.map((item: QueueItem) => (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openDetail(item.id)}
                  >
                    <TableCell>
                      <StatusChip status={item.status} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.student.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {item.student.maskedPhone}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ typography: 'body2' }}>{item.planName}</TableCell>
                    <TableCell sx={{ typography: 'body2' }}>
                      {formatToman(item.amountToman)}
                    </TableCell>
                    <TableCell sx={{ typography: 'body2' }}>
                      {formatAge(item.requestAgeSeconds)}
                    </TableCell>
                    <TableCell sx={{ typography: 'body2' }}>
                      {formatDateTime(item.transferAt)}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(item.id);
                        }}
                        aria-label="مشاهده"
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack sx={{ display: { xs: 'flex', md: 'none' }, gap: 2 }}>
            {response.items.map((item: QueueItem) => (
              <Card
                key={item.id}
                sx={{ cursor: 'pointer' }}
                onClick={() => openDetail(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDetail(item.id);
                  }
                }}
              >
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Stack
                    sx={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography sx={{ fontWeight: 600 }}>{item.student.name}</Typography>
                    <StatusChip status={item.status} />
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {item.student.maskedPhone} — {item.planName}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {formatToman(item.amountToman)} — {formatAge(item.requestAgeSeconds)}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>

          {response.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={response.totalPages}
                page={Math.min(response.page, response.totalPages)}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}

          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', mt: 2, textAlign: 'center', display: 'block' }}
          >
            {response.totalItems} درخواست — صفحه {response.page} از {response.totalPages}
          </Typography>
        </>
      )}
    </PageContainer>
  );
}

function StatusChip({ status }: { status: string }) {
  const colorMap: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'error',
    cancelled: 'default',
  };
  return (
    <Chip
      label={statusLabel(status)}
      color={colorMap[status] ?? 'default'}
      size="small"
      variant="outlined"
    />
  );
}
