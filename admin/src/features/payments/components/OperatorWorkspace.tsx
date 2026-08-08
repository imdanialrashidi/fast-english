// admin/src/features/payments/components/OperatorWorkspace.tsx
// The operator operations workspace. One component renders both routes
// (`/payments` and `/payments/:requestId`), so the queue pane
// stays mounted during selection: filter state, scroll position and
// loaded data survive.
//
// Responsive model (deterministic by width, never device name):
//  - md+ (≥768px, custom theme breakpoints): split workspace — bounded
//    queue pane (340px md / 400px lg) with a sticky toolbar, detail pane
//    in the remaining space; both panes scroll independently and the root
//    height is capped below the Top App Bar (no nested scroll traps).
//  - below md: queue route ↔ full detail surface; Back returns to the
//    same queue state (filters in the URL, scroll saved/restored).

import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { layout } from '../../../../../shared/ui/tokens';
import { OperatorEmptyState } from './OperatorEmptyState';
import { OperatorQueue } from './OperatorQueue';
import { OperatorRequestDetail } from './OperatorRequestDetail';

export function OperatorWorkspace() {
  const theme = useTheme();
  const isSplit = useMediaQuery(theme.breakpoints.up('md'));
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [queueReloadKey, setQueueReloadKey] = useState(0);
  const [focusSignal, setFocusSignal] = useState(0);
  const savedQueueScroll = useRef(0);

  // Arriving at the operator route starts at the top (the shared shell
  // does not reset operator scroll — the workspace owns it).
  useEffect(() => {
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // Mobile: keep the queue's scroll position across queue → detail →
  // back navigation.
  useEffect(() => {
    if (!isSplit && !requestId) {
      const raf = requestAnimationFrame(() => window.scrollTo(0, savedQueueScroll.current));
      return () => cancelAnimationFrame(raf);
    }
    if (!isSplit && requestId) {
      window.scrollTo(0, 0);
    }
  }, [isSplit, requestId]);

  const openRequest = useCallback(
    (id: string) => {
      if (!isSplit) {
        savedQueueScroll.current = window.scrollY;
      }
      // Preserve the queue's filter query so Back (and a full reload of
      // the detail URL) returns to the same queue state.
      navigate(`/payments/${id}${location.search}`);
    },
    [isSplit, navigate, location.search],
  );

  const handleBackToQueue = useCallback(() => {
    navigate(`/payments${location.search}`);
  }, [navigate, location.search]);

  const handleDecisionDone = useCallback(() => {
    setQueueReloadKey((k) => k + 1);
    setFocusSignal((s) => s + 1);
  }, []);

  const queuePane = useMemo(
    () => (
      <OperatorQueue
        selectedId={requestId ?? null}
        onOpen={openRequest}
        reloadKey={queueReloadKey}
        stickyHeader={isSplit}
      />
    ),
    [requestId, openRequest, queueReloadKey, isSplit],
  );

  const detailPane = useMemo(
    () =>
      requestId ? (
        <OperatorRequestDetail
          key={requestId}
          requestId={requestId}
          isSplit={isSplit}
          onBack={isSplit ? undefined : handleBackToQueue}
          onDecisionDone={handleDecisionDone}
          focusSignal={focusSignal}
        />
      ) : null,
    [requestId, isSplit, handleBackToQueue, handleDecisionDone, focusSignal],
  );

  if (isSplit) {
    return (
      <Box
        data-testid="operator-workspace-split"
        sx={{
          display: 'flex',
          height: `calc(100dvh - ${layout.headerHeight.md}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <Box
          component="section"
          aria-label="صف درخواست‌ها"
          data-testid="queue-pane"
          sx={{
            width: { md: 340, lg: 400 },
            flexShrink: 0,
            borderInlineEnd: '1px solid',
            borderColor: 'var(--mui-palette-outlineVariant)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            backgroundColor: 'var(--mui-palette-background-default)',
            minWidth: 0,
          }}
        >
          {queuePane}
        </Box>
        <Box
          component="section"
          aria-label="جزئیات درخواست"
          data-testid="detail-pane"
          sx={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            backgroundColor: 'var(--mui-palette-background-default)',
          }}
        >
          {detailPane ?? <OperatorEmptyState kind="select" />}
        </Box>
      </Box>
    );
  }

  return (
    <PageContainer maxWidth="lg">
      <Box sx={{ display: requestId ? 'none' : undefined }}>{queuePane}</Box>
      <Box sx={{ display: requestId ? undefined : 'none' }}>{detailPane}</Box>
    </PageContainer>
  );
}
