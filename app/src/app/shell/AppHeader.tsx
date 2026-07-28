import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { AppBar, Box, IconButton, Stack, Toolbar, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router';
import { BrandMark } from './BrandMark';

export function AppHeader() {
  const location = useLocation();
  const isOperator = location.pathname.startsWith('/operator');

  return (
    <AppBar
      position="sticky"
      sx={{
        // Side nav occupies the right edge on tablet/desktop in RTL.
        // The app bar spans the remaining content column.
        mr: { md: '248px' },
        width: { md: 'calc(100% - 248px)' },
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 56, md: 64 }, gap: 1.5 }}>
        {isOperator ? null : (
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <BrandMark size={32} />
          </Box>
        )}
        {isOperator ? (
          <Typography component="h1" variant="h6" sx={{ fontWeight: 700 }}>
            پنل اپراتور
          </Typography>
        ) : (
          <Typography
            component={RouterLink}
            to="/dashboard"
            variant="h6"
            sx={{
              fontWeight: 700,
              color: 'inherit',
              textDecoration: 'none',
              display: { xs: 'block', md: 'none' },
            }}
          >
            فست انگلیش
          </Typography>
        )}

        <Box sx={{ flex: 1 }} />

        <Stack spacing={0.5} sx={{ flexDirection: 'row', alignItems: 'center' }}>
          {isOperator ? null : (
            <Tooltip title="پنل اپراتور">
              <IconButton
                component={RouterLink}
                to="/operator"
                size="medium"
                aria-label="پنل اپراتور"
                sx={{ color: 'inherit' }}
              >
                <MenuRoundedIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
