// admin/src/shell/AdminShell.tsx
// Unified Staff Admin Console chrome: brand, primary navigation
// (داشبورد / پرداختها / تنظیمات) and خروج. No Student navigation, no
// theme control here (display preference lives only in Admin Settings).

import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { AppBar, Box, Button, Stack, Toolbar, Typography } from '@mui/material';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { Brand } from '../../../shared/ui/brand/Brand';
import { layout } from '../../../shared/ui/tokens';
import { useStaffAuth } from '../auth/staffAuth';

const NAV_ITEMS = [
  { to: '/', label: 'داشبورد', end: true },
  { to: '/content', label: 'محتوا', end: false },
  { to: '/content/import', label: 'ورود محتوا', end: true },
  { to: '/payments', label: 'پرداختها', end: false },
  { to: '/settings', label: 'تنظیمات', end: false },
  { to: '/help', label: 'راهنما', end: true },
];

export function AdminShell() {
  const { logout } = useStaffAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clears only the Staff session; the Student app is untouched.
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Stack sx={{ minHeight: '100dvh', backgroundColor: 'background.default' }}>
      <AppBar
        position="sticky"
        sx={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <Brand variant="compact" size="sm" />
          <Typography variant="titleMedium" sx={{ fontWeight: 700 }}>
            مدیریت
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<LogoutRoundedIcon />}
            onClick={handleLogout}
            data-testid="admin-logout"
          >
            خروج
          </Button>
        </Toolbar>
        <Toolbar
          component="nav"
          aria-label="ناوبری مدیریت"
          sx={{
            minHeight: 48,
            gap: 1,
            paddingInline: 2,
            borderTop: '1px solid',
            borderColor: 'outlineVariant',
            // Six nav items — on narrow viewports the row scrolls INSIDE
            // its own bar instead of pushing the document wider (390px QA
            // gate: zero horizontal overflow at document level).
            minWidth: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
            flexWrap: 'nowrap',
          }}
        >
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.end}
              size="small"
              sx={{
                minHeight: 40,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                color: 'onSurfaceVariant',
                '&.active': {
                  color: 'primary.main',
                  fontWeight: 700,
                },
              }}
            >
              {item.label}
            </Button>
          ))}
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          paddingBottom: `calc(${layout.bottomNavigationHeight}px + 0px)`,
        }}
      >
        <Outlet />
      </Box>
    </Stack>
  );
}
