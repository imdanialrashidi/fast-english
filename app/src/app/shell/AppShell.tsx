import { Box, Stack } from '@mui/material';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { layout } from '../../../../shared/ui/tokens/spacing';
import { MiniPlayer } from '../../features/player';
import { AppHeader } from './AppHeader';
import { RouteTransition } from './RouteTransition';
import { StudentBottomNav } from './StudentBottomNav';
import { StudentSideNav } from './StudentSideNav';

// The shared chrome for all student-facing routes. RootGate passes the
// Home as children (the '/' route cannot be a nested Outlet route); every
// other authenticated route arrives through the Outlet.
export function AppShell({ children }: { children?: React.ReactNode }) {
  const location = useLocation();

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
        <StudentSideNav />
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{
            flex: 1,
            minWidth: 0,
            // MUI's permanent Drawer paper is fixed by design. Reserve its
            // physical rail in the student main column so it cannot cover
            // content or actions at tablet/desktop widths.
            boxSizing: 'border-box',
            paddingInlineStart: {
              md: `${layout.navigationRailWidth}px`,
              lg: `${layout.desktopNavigationWidth}px`,
            },
          }}
        >
          <RouteTransition>{children ?? <Outlet />}</RouteTransition>
        </Box>
      </Stack>
      <StudentBottomNav />
      <MiniPlayer />
    </Stack>
  );
}
