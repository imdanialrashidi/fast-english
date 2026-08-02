import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router';
import { Brand } from '../brand/Brand';
import { layout } from '../theme/tokens/spacing';

const SIDENAV_WIDTH = layout.desktopNavigationWidth;

const items = [
  { label: 'خانه', value: '/dashboard', icon: <HomeRoundedIcon /> },
  { label: 'درس‌ها', value: '/lessons', icon: <MenuBookRoundedIcon /> },
  { label: 'پیشرفت', value: '/placement', icon: <TimelineRoundedIcon /> },
  { label: 'حساب', value: '/account', icon: <PersonRoundedIcon /> },
] as const;

// Tablet and desktop navigation: persistent side rail.
// Hidden on mobile (replaced by StudentBottomNav).
export function StudentSideNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const current = items.find((i) => location.pathname.startsWith(i.value))?.value ?? items[0].value;

  return (
    <Drawer
      variant="permanent"
      // Emotion's RTL transform mirrors physical Drawer anchors. `left`
      // therefore places this rail on the physical right edge of the RTL UI.
      anchor="left"
      dir="rtl"
      sx={{
        display: { xs: 'none', md: 'block' },
        '& .MuiDrawer-paper': {
          width: SIDENAV_WIDTH,
          boxSizing: 'border-box',
          borderInlineEnd: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        },
      }}
    >
      <Stack sx={{ height: '100%' }} role="navigation" aria-label="ناوبری اصلی">
        <Box sx={{ p: 3, pb: 2 }}>
          <Brand variant="compact" size="sm" />
        </Box>
        <List sx={{ px: 1.5, flex: 1 }} aria-label="ناوبری اصلی">
          {items.map((item) => {
            const selected = current === item.value;
            return (
              <ListItem key={item.value} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  selected={selected}
                  onClick={() => navigate(item.value)}
                  aria-current={selected ? 'page' : undefined}
                  sx={{
                    minHeight: 44,
                    color: selected ? 'onSecondaryContainer' : 'onSurfaceVariant',
                    '&.Mui-selected': {
                      backgroundColor: 'secondaryContainer',
                      color: 'onSecondaryContainer',
                      '&:hover': { backgroundColor: 'secondaryContainer' },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 36,
                      color: selected ? 'onSecondaryContainer' : 'onSurfaceVariant',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    slotProps={{ primary: { sx: { fontWeight: selected ? 600 : 500 } } }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            یادگیری، پرداخت و پشتیبانی در همین برنامه
          </Typography>
        </Box>
      </Stack>
    </Drawer>
  );
}
