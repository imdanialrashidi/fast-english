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

const items = [
  { label: 'خانه', value: '/dashboard', icon: <HomeRoundedIcon /> },
  { label: 'درس‌ها', value: '/lessons', icon: <MenuBookRoundedIcon /> },
  { label: 'پیشرفت', value: '/placement', icon: <TimelineRoundedIcon /> },
  { label: 'حساب', value: '/account', icon: <PersonRoundedIcon /> },
] as const;

// Tablet and desktop navigation:
//   - md–lg (tablet): a compact Navigation Rail — icons only, tonal selected
//     pill, still in-flow so content is never covered;
//   - lg+ (desktop): the full Side Navigation with brand, labels and footer.
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
      data-testid="student-side-nav"
      sx={{
        display: { xs: 'none', md: 'block' },
        '& .MuiDrawer-paper': {
          width: { md: layout.navigationRailWidth, lg: layout.desktopNavigationWidth },
          boxSizing: 'border-box',
          borderInlineEnd: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        },
      }}
    >
      <Stack sx={{ height: '100%' }} role="navigation" aria-label="ناوبری اصلی">
        <Box sx={{ p: 2.5, pb: 2, display: { md: 'none', lg: 'flex' } }}>
          <Brand variant="compact" size="sm" />
        </Box>
        <List sx={{ px: 1.5, flex: 1 }} aria-label="ناوبری اصلی">
          {items.map((item) => {
            const selected = current === item.value;
            return (
              <ListItem key={item.value} disablePadding sx={{ mb: 0.5, justifyContent: 'center' }}>
                <ListItemButton
                  selected={selected}
                  onClick={() => navigate(item.value)}
                  aria-label={item.label}
                  aria-current={selected ? 'page' : undefined}
                  sx={{
                    minHeight: 44,
                    justifyContent: { md: 'center', lg: 'flex-start' },
                    px: { md: 0, lg: 2 },
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
                      justifyContent: 'center',
                      color: selected ? 'onSecondaryContainer' : 'onSurfaceVariant',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    sx={{ display: { md: 'none', lg: 'block' } }}
                    slotProps={{
                      primary: { sx: { fontWeight: selected ? 600 : 500 } },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: { md: 'none', lg: 'block' },
          }}
        >
          <Typography variant="caption" color="text.secondary">
            یادگیری، پرداخت و پشتیبانی در همین برنامه
          </Typography>
        </Box>
      </Stack>
    </Drawer>
  );
}
