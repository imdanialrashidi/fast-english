// app/src/app/shell/RouteTransition.tsx
// Visual Slice 2 — controlled route-content entrance.
//
// The Outlet content is keyed by pathname so every route change mounts a
// fresh wrapper that plays a short fade + rise (opacity/transform only — no
// layout-heavy properties). The theme's global `prefers-reduced-motion` rule
// collapses the animation duration to ~0, so reduced-motion users get an
// instant state change. Nothing here delays user actions.

import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { duration, easing } from '../theme/tokens';

export function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  // The operator workspace is one route surface rendered for both the
  // queue index and the selected request (`/operator` +
  // `/operator/payment-requests/:id`). A stable key keeps the workspace —
  // and therefore the mounted queue pane — alive during selection
  // navigation, so filter state, scroll position and loaded data survive
  // without refetching (queue context is not lost on selection). All other
  // routes keep the pathname key and their entrance animation.
  const transitionKey = location.pathname.startsWith('/operator')
    ? 'operator-workspace'
    : location.pathname;
  return (
    <Box
      key={transitionKey}
      data-testid="route-transition"
      sx={{
        animation: `fep-route-enter ${duration.durationStandard}ms ${easing.easingStandard} both`,
      }}
    >
      {children}
    </Box>
  );
}
