import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

const items = [
  { label: 'خانه', value: '/dashboard', icon: <HomeRoundedIcon /> },
  { label: 'درس‌ها', value: '/lessons', icon: <MenuBookRoundedIcon /> },
  { label: 'پیشرفت', value: '/placement', icon: <TimelineRoundedIcon /> },
  { label: 'حساب', value: '/account', icon: <PersonRoundedIcon /> },
] as const;

export function StudentBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const current = items.find((i) => location.pathname.startsWith(i.value))?.value ?? items[0].value;

  const handleChange = useCallback(
    (_: unknown, next: string) => {
      if (next) navigate(next);
    },
    [navigate],
  );

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        insetInlineStart: 0,
        insetInlineEnd: 0,
        bottom: 0,
        zIndex: (t) => t.zIndex.appBar,
        borderTop: 1,
        borderColor: 'divider',
        // Respect iOS / Android safe areas.
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        display: { xs: 'block', md: 'none' },
        backgroundColor: 'background.paper',
      }}
    >
      <BottomNavigation
        value={current}
        onChange={handleChange}
        showLabels
        aria-label="ناوبری اصلی"
        sx={{ height: 64 }}
      >
        {items.map((item) => (
          <BottomNavigationAction
            key={item.value}
            value={item.value}
            label={item.label}
            icon={item.icon}
            aria-label={item.label}
            sx={{ minWidth: 64, '& .MuiBottomNavigationAction-label': { fontWeight: 500 } }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
