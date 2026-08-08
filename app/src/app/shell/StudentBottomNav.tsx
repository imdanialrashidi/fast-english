import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PodcastsRoundedIcon from '@mui/icons-material/PodcastsRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { productCopy } from '../copy/productCopy';

// Final Student destinations (Podcast Slice 5): خانه / کتابخانه / پیشرفت /
// حساب. Home is the exact '/' route; everything else matches by prefix.
export const studentNavItems = [
  { label: productCopy.nav.home, value: '/', icon: <HomeRoundedIcon /> },
  { label: productCopy.nav.library, value: '/library', icon: <PodcastsRoundedIcon /> },
  { label: productCopy.nav.progress, value: '/progress', icon: <TimelineRoundedIcon /> },
  { label: productCopy.nav.account, value: '/account', icon: <PersonRoundedIcon /> },
] as const;

/** Selected destination for a pathname ('' when none matches). */
export function currentNavValue(pathname: string): string {
  for (const item of studentNavItems) {
    if (item.value === '/') {
      if (pathname === '/') return item.value;
    } else if (pathname.startsWith(item.value)) {
      return item.value;
    }
  }
  return '';
}

export function StudentBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const current = currentNavValue(location.pathname);

  const handleChange = useCallback(
    (_: unknown, next: string) => {
      if (next) navigate(next);
    },
    [navigate],
  );

  return (
    <Paper
      elevation={0}
      data-testid="student-bottom-nav"
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
        {studentNavItems.map((item) => (
          <BottomNavigationAction
            key={item.value}
            value={item.value}
            label={item.label}
            icon={item.icon}
            aria-label={item.label}
            aria-current={current === item.value ? 'page' : undefined}
            sx={{ minWidth: 64, '& .MuiBottomNavigationAction-label': { fontWeight: 500 } }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
