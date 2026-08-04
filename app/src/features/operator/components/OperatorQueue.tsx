// app/src/features/operator/components/OperatorQueue.tsx
// The operator request queue: real Backend data, status filter + search
// in the URL query params, pending-first Backend ordering (no client-side
// sorting over incomplete data), explicit loading / empty / filtered-empty
// / error states. Filter commits are debounced (350 ms) and superseded
// requests are aborted.

import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { StatePanel } from '../../../app/shell/StatePanel';
import { getPocketBase } from '../../../lib/pocketbase';
import { fetchQueue } from '../api';
import { toOperatorError } from '../errors';
import { emptyStateKind, statusViewLabel } from '../logic';
import type { QueueItem, QueueResponse, QueueStatusFilter } from '../types';
import { OperatorEmptyState } from './OperatorEmptyState';
import { OperatorQueueToolbar } from './OperatorQueueToolbar';
import { OperatorRequestItem } from './OperatorRequestItem';

const PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 350;
const VALID_STATUSES: QueueStatusFilter[] = ['all', 'pending', 'approved', 'rejected', 'cancelled'];

interface Props {
  /** Currently selected request (highlighted row). */
  selectedId: string | null;
  onOpen: (id: string) => void;
  /** Bump to re-fetch (e.g. after a decision changed the queue). */
  reloadKey: number;
  /**
   * Keep the queue header (heading + filters) sticky inside its scroll
   * pane. Only the split workspace enables this — the pane scrolls below
   * the Top App Bar, so sticky top:0 cannot overlap the app chrome.
   * On mobile the header scrolls away with the page (no overlap risk).
   */
  stickyHeader?: boolean;
}

interface QueueState {
  response: QueueResponse | null;
  loading: boolean;
  error: string | null;
}

export function OperatorQueue({ selectedId, onOpen, reloadKey, stickyHeader = false }: Props) {
  const token = useMemo(() => getPocketBase().authStore.token ?? '', []);
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') ?? '1') || 1;
  const statusParam = (searchParams.get('status') ?? 'all') as QueueStatusFilter;
  const searchParam = searchParams.get('search') ?? '';
  const statusFilter = VALID_STATUSES.includes(statusParam) ? statusParam : 'all';

  const [searchInput, setSearchInput] = useState(searchParam);
  const [data, setData] = useState<QueueState>({ response: null, loading: true, error: null });
  const [retryKey, setRetryKey] = useState(0);
  const debounceRef = useRef<number | null>(null);

  // Keep the input in sync when the URL changes externally (back nav).
  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  const loadQueue = useCallback(
    async (p: number, st: QueueStatusFilter, q: string, signal?: AbortSignal) => {
      setData((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetchQueue(
          token,
          { page: p, perPage: PER_PAGE, status: st, search: q },
          signal,
        );
        if (!signal?.aborted) setData({ response: res, loading: false, error: null });
      } catch (err) {
        if (signal?.aborted) return;
        // Safe Persian mapping — never raw server text or PB internals.
        setData((prev) => ({ ...prev, loading: false, error: toOperatorError(err).message }));
      }
    },
    [token],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    loadQueue(page, statusFilter, searchParam, ctrl.signal);
    return () => ctrl.abort();
  }, [page, statusFilter, searchParam, loadQueue, reloadKey, retryKey]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  // Commit filter state to the URL. `replace` keeps the back/forward
  // history clean while typing searches; the queue state survives in the
  // entry pushed when a request is opened.
  const commitFilters = useCallback(
    (nextStatus: QueueStatusFilter, nextSearch: string) => {
      const params = new URLSearchParams();
      params.set('page', '1');
      if (nextStatus !== 'all') params.set('status', nextStatus);
      const trimmed = nextSearch.trim();
      if (trimmed) params.set('search', trimmed);
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const handleStatusChange = useCallback(
    (val: QueueStatusFilter) => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      setSearchInput(searchParam);
      commitFilters(val, searchParam);
    },
    [commitFilters, searchParam],
  );

  const handleSearchInputChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        commitFilters(statusFilter, value);
      }, SEARCH_DEBOUNCE_MS);
    },
    [statusFilter, commitFilters],
  );

  const handleSearchCommit = useCallback(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    commitFilters(statusFilter, searchInput);
  }, [statusFilter, searchInput, commitFilters]);

  const handleClearSearch = useCallback(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    setSearchInput('');
    commitFilters(statusFilter, '');
  }, [statusFilter, commitFilters]);

  const handleClearFilters = useCallback(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    setSearchInput('');
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const handlePageChange = useCallback(
    (_: unknown, p: number) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', String(p));
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const { response, loading, error } = data;
  const hasActiveFilters = statusFilter !== 'all' || searchParam.length > 0;
  const emptyKind =
    !loading && !error && response
      ? emptyStateKind(statusFilter, searchParam, response.totalItems)
      : null;

  return (
    <Box data-testid="operator-queue">
      {/* Sticky queue header: heading names the view being shown, the
          count comes from the bounded Backend response (never computed by
          fetching unrestricted data on the client). */}
      <Box
        sx={{
          position: stickyHeader ? 'sticky' : 'static',
          top: 0,
          zIndex: 2,
          backgroundColor: 'var(--mui-palette-background-default)',
          px: { xs: 2, md: 2 },
          pt: { xs: 2, md: 2.5 },
          pb: 1.5,
        }}
      >
        <Typography component="h1" variant="h3" sx={{ mb: 0.5 }}>
          صف درخواست‌ها
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {response && !loading
            ? `نمایش: ${statusViewLabel(statusFilter)} — ${response.totalItems} درخواست`
            : 'در حال بارگذاری…'}
        </Typography>
        <OperatorQueueToolbar
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          searchInput={searchInput}
          onSearchInputChange={handleSearchInputChange}
          onSearchCommit={handleSearchCommit}
          onClearSearch={handleClearSearch}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      </Box>

      {loading && <QueueSkeleton />}

      {!loading && error && (
        <Box sx={{ px: 2 }}>
          <StatePanel
            variant="error"
            title="بارگذاری صف ناموفق بود"
            description={error}
            action={
              <Button onClick={() => setRetryKey((k) => k + 1)} data-testid="queue-retry">
                تلاش دوباره
              </Button>
            }
          />
        </Box>
      )}

      {!loading && !error && emptyKind && (
        <Box sx={{ px: 2 }}>
          <OperatorEmptyState kind={emptyKind} onClearFilters={handleClearFilters} />
        </Box>
      )}

      {!loading && !error && response && response.items.length > 0 && (
        <>
          <Box
            component="ul"
            data-testid="operator-queue-list"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              px: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}
          >
            {response.items.map((item: QueueItem) => (
              <OperatorRequestItem
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onOpen={onOpen}
              />
            ))}
          </Box>

          {response.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
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
            color="text.secondary"
            sx={{ py: 1, textAlign: 'center', display: 'block' }}
          >
            {response.totalItems} درخواست — صفحه {response.page} از {response.totalPages}
          </Typography>
        </>
      )}
    </Box>
  );
}

function QueueSkeleton() {
  return (
    <Stack sx={{ gap: 1, px: 2, pt: 1 }} data-testid="operator-queue-loading">
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            p: 2,
            borderRadius: '12px',
            backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
          }}
        >
          <Stack sx={{ gap: 1 }}>
            <Skeleton variant="text" width="45%" sx={{ fontSize: '1rem' }} />
            <Skeleton variant="text" width="75%" sx={{ fontSize: '0.875rem' }} />
            <Skeleton variant="text" width="35%" sx={{ fontSize: '0.75rem' }} />
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
