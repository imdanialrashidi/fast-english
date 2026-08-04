import { Box, Stack } from '@mui/material';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { MiniPlayer } from '../../features/player';
import { layout } from '../theme/tokens/spacing';
import { AppHeader } from './AppHeader';
import { RouteTransition } from './RouteTransition';
import { StudentBottomNav } from './StudentBottomNav';
import { StudentSideNav } from './StudentSideNav';

// The shared chrome for all student-facing routes. The operator surface
// intentionally reuses the AppHeader (to keep the brand visible) but does
// not use the student side nav, bottom nav or Mini Player.
export function AppShell() {
  const location = useLocation();
  const isOperator = location.pathname.startsWith('/operator');

  // Client-side navigation keeps the scroll position of the previous route;
  // reset to the top so every route starts at its own beginning (the
  // browser restores positions for full reloads on its own).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <Stack sx={{ minHeight: '100dvh', backgroundColor: 'background.default' }}>
      <AppHeader />
      <Stack
        sx={{
          flex: 1,
          minHeight: 0,
          flexDirection: 'row',
        }}
      >
        {!isOperator ? <StudentSideNav /> : null}
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{
            flex: 1,
            minWidth: 0,
            // MUI's permanent Drawer paper is fixed by design. Reserve its
            // physical rail in the student main column so it cannot cover
            // content or actions at tablet/desktop widths. Operator routes
            // have no rail and therefore keep the full viewport width.
            boxSizing: 'border-box',
            paddingInlineStart: !isOperator
              ? { md: `${layout.navigationRailWidth}px`, lg: `${layout.desktopNavigationWidth}px` }
              : undefined,
          }}
        >
          <RouteTransition>
            <Outlet />
          </RouteTransition>
        </Box>
      </Stack>
      {!isOperator ? <StudentBottomNav /> : null}
      {!isOperator ? <MiniPlayer /> : null}
    </Stack>
  );
}
