import { Box, Stack } from '@mui/material';
import { Outlet, useLocation } from 'react-router';
import { AppHeader } from './AppHeader';
import { StudentBottomNav } from './StudentBottomNav';
import { StudentSideNav } from './StudentSideNav';

// The shared chrome for all student-facing routes. The operator surface
// intentionally reuses the AppHeader (to keep the brand visible) but does
// not use the student side nav or bottom nav.
export function AppShell() {
  const location = useLocation();
  const isOperator = location.pathname.startsWith('/operator');

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
          sx={{
            flex: 1,
            minWidth: 0,
            // Side nav is on the right in RTL; leave that gutter on md+.
            // The AppBar already offsets by 248px so the content aligns
            // with the header's right edge.
          }}
        >
          <Outlet />
        </Box>
      </Stack>
      {!isOperator ? <StudentBottomNav /> : null}
    </Stack>
  );
}
