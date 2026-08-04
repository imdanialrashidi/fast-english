import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import {
  AppBar,
  Box,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useScrollTrigger,
} from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth';
import { Brand } from '../brand/Brand';
import { ThemeSwitch } from '../theme/ThemeSwitch';
import { duration, easing } from '../theme/tokens';

const isDetailPath = (pathname: string): boolean =>
  pathname.startsWith('/lessons/') && pathname !== '/lessons';

/**
 * Shared Top App Bar foundation.
 *
 * - Semantic foregrounds only (`onSurface`/`onSurfaceVariant`); no raw
 *   black or white icon colors.
 * - Icons: 44px minimum touch target (theme MuiIconButton default).
 * - RTL-correct Back icon: in RTL, "back" points right (ArrowForward).
 * - Title truncates instead of colliding with actions.
 * - Safe-area top padding on notched devices.
 * - Sticky and in-flow: never covers content.
 * - Scroll elevation is a documented state (`data-scrolled`) driven by
 *   MUI's ScrollTrigger; the shadow comes from the elevation tokens.
 */
export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const isOperator = location.pathname.startsWith('/operator');
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 8 });
  const showBack = !isOperator && isDetailPath(location.pathname);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/lessons');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <AppBar
      position="sticky"
      data-scrolled={scrolled ? 'true' : 'false'}
      sx={{
        // Notched devices: extend the bar into the status bar area.
        paddingTop: 'env(safe-area-inset-top, 0px)',
        transition: `box-shadow ${duration.durationFast}ms ${easing.easingStandard}`,
        ...(scrolled ? { boxShadow: 'var(--mui-elevation-sticky)' } : { boxShadow: 'none' }),
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        {showBack ? (
          <IconButton
            onClick={handleBack}
            aria-label="بازگشت"
            data-testid="app-header-back"
            sx={{ color: 'onSurface', display: { xs: 'inline-flex', md: 'none' } }}
          >
            <ArrowForwardRoundedIcon />
          </IconButton>
        ) : null}

        <Box sx={{ display: { xs: 'none', md: 'block' }, flexShrink: 0 }}>
          {isOperator ? (
            <Brand variant="compact" size="sm" />
          ) : (
            <RouterLink
              to="/dashboard"
              aria-label="فست انگلیش — داشبورد"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Brand variant="compact" size="sm" />
            </RouterLink>
          )}
        </Box>

        {isOperator ? (
          // Not a heading: the operator workspace owns the page's primary
          // heading (queue or selected request). This label only identifies
          // the chrome, so screen readers get exactly one h1 per view.
          <Typography
            component="span"
            variant="titleMedium"
            sx={{
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            پنل اپراتور
          </Typography>
        ) : (
          <Typography
            component={RouterLink}
            to="/dashboard"
            variant="titleMedium"
            sx={{
              fontWeight: 700,
              color: 'onSurface',
              textDecoration: 'none',
              display: { xs: 'block', md: 'none' },
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            فست انگلیش
          </Typography>
        )}

        <Box sx={{ flex: 1 }} />

        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
          {!isOperator && (
            <Tooltip title="پنل اپراتور">
              <IconButton
                component={RouterLink}
                to="/operator"
                aria-label="پنل اپراتور"
                sx={{ color: 'onSurface' }}
              >
                <AdminPanelSettingsRoundedIcon />
              </IconButton>
            </Tooltip>
          )}
          {isOperator && (
            <Tooltip title="خروج از پنل اپراتور">
              <IconButton
                onClick={handleLogout}
                aria-label="خروج"
                data-testid="operator-logout"
                sx={{ color: 'onSurface' }}
              >
                <LogoutRoundedIcon />
              </IconButton>
            </Tooltip>
          )}
          <ThemeSwitch />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
