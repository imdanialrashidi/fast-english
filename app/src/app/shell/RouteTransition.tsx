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
  return (
    <Box
      key={location.pathname}
      data-testid="route-transition"
      sx={{
        animation: `fep-route-enter ${duration.durationStandard}ms ${easing.easingStandard} both`,
      }}
    >
      {children}
    </Box>
  );
}
