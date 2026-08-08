import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { AppBar, Box, IconButton, Toolbar, Typography, useScrollTrigger } from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import { Brand } from '../../../../shared/ui/brand/Brand';
import { duration, easing } from '../../../../shared/ui/tokens';

const isDetailPath = (pathname: string): boolean =>
  pathname.startsWith('/lessons/') && pathname !== '/lessons';

/**
 * Student Top App Bar.
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
 * - No theme control here: display preference lives only in Account
 *   Settings (تنظیمات نمایش) per Podcast Slice 1.
 */
export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 8 });
  const showBack = isDetailPath(location.pathname);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/lessons');
    }
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
          <RouterLink
            to="/"
            aria-label="فست انگلیش — صفحهٔ اصلی"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Brand variant="compact" size="sm" />
          </RouterLink>
        </Box>

        <Typography
          component={RouterLink}
          to="/"
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

        <Box sx={{ flex: 1 }} />
      </Toolbar>
    </AppBar>
  );
}
