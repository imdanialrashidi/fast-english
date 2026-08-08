// app/src/app/App.tsx
import { Box } from '@mui/material';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { StatePanel } from '../../../shared/ui/StatePanel';
import { HomeRoute } from '../features/home/routes/HomeRoute';
import { LessonDetailRoute, LessonsRoute, SampleRoute } from '../features/lessons';
import { LibraryRoute } from '../features/library/routes/LibraryRoute';
import { PaymentRoute, PaymentStatusRoute } from '../features/payment';
import { LevelResultRoute, PlacementRoute } from '../features/placement';
import { PlayerProvider } from '../features/player';
import { ProgressRoute } from '../features/progress/routes/ProgressRoute';
import { AuthProvider, decideRoute, type RouteKind, useAuth } from '../lib/auth';
import { AccountRoute } from './routes/AccountRoute';
import { CatalogRoute } from './routes/CatalogRoute';
import { EntryRoute } from './routes/EntryRoute';
import { LoginRoute } from './routes/LoginRoute';
import { NotFoundRoute } from './routes/NotFoundRoute';
import { SignupRoute } from './routes/SignupRoute';
import { AppShell } from './shell/AppShell';

// Development-only component catalog. Registered in dev builds and when the
// e2e build explicitly enables it (VITE_CATALOG=1); never part of the
// production navigation (no link anywhere) and absent from production builds
// without the flag.
const catalogEnabled = import.meta.env.DEV || import.meta.env.VITE_CATALOG === '1';

function Guard({ kind, children }: { kind: RouteKind; children: React.ReactNode }) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();
  if (isInitializing) {
    return (
      <PageContainer maxWidth="md">
        <StatePanel variant="loading" title="در حال بررسی نشست…" />
      </PageContainer>
    );
  }
  const decision = decideRoute(kind, user, isAuthenticated);
  if (decision.kind === 'redirect') {
    const redirect = decision.to + (location.search ?? '') + (location.hash ?? '');
    return <Navigate to={redirect} replace />;
  }
  return <>{children}</>;
}

/**
 * The app root: guests see the Entry route; authenticated active Students
 * with a completed placement see the Podcast-first Home inside the shared
 * shell; everyone else is routed to their correct journey (payment or
 * placement). The shared PlayerProvider lives above the routes so the
 * single audio element and the Mini Player survive navigation (Home is a
 * first-class destination, not a redirect target).
 */
function RootGate() {
  const { user, isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) {
    return (
      <PageContainer maxWidth="md">
        <StatePanel variant="loading" title="در حال بررسی نشست…" />
      </PageContainer>
    );
  }
  if (!isAuthenticated || !user) return <EntryRoute />;
  if (user.account_status === 'active') {
    if (user.placement_completed && user.selected_level) {
      return (
        <AppShell>
          <HomeRoute />
        </AppShell>
      );
    }
    return <Navigate to="/placement" replace />;
  }
  return <Navigate to="/payment" replace />;
}

function ThemedApp() {
  return (
    <AuthProvider>
      <Box>
        <a
          href="#main-content"
          style={{
            position: 'absolute',
            insetInlineStart: 8,
            top: 8,
            padding: '8px 12px',
            background: 'var(--mui-palette-inverseSurface)',
            color: 'var(--mui-palette-inverseOnSurface)',
            borderRadius: '10px',
            textDecoration: 'none',
            transform: 'translateY(-200%)',
            zIndex: 9999,
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-200%)';
          }}
        >
          پرش به محتوای اصلی
        </a>

        {/* Single shared audio element for the whole app (Mini Player
            constraint: never two simultaneous audio elements). */}
        <PlayerProvider>
          <Routes>
            <Route path="/" element={<RootGate />} />
            <Route
              path="/login"
              element={
                <Guard kind="guest-only">
                  <LoginRoute />
                </Guard>
              }
            />
            <Route
              path="/signup"
              element={
                <Guard kind="guest-only">
                  <SignupRoute />
                </Guard>
              }
            />

            <Route element={<AppShell />}>
              <Route
                path="/payment"
                element={
                  <Guard kind="pending-only">
                    <PaymentRoute />
                  </Guard>
                }
              />
              <Route
                path="/payment-status"
                element={
                  <Guard kind="pending-only">
                    <PaymentStatusRoute />
                  </Guard>
                }
              />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route
                path="/placement"
                element={
                  <Guard kind="active-only">
                    <PlacementRoute />
                  </Guard>
                }
              />
              <Route
                path="/placement/result"
                element={
                  <Guard kind="active-only">
                    <LevelResultRoute />
                  </Guard>
                }
              />
              <Route
                path="/lessons"
                element={
                  <Guard kind="active-only">
                    <LessonsRoute />
                  </Guard>
                }
              />
              <Route
                path="/lessons/:id"
                element={
                  <Guard kind="active-only">
                    <LessonDetailRoute />
                  </Guard>
                }
              />
              <Route
                path="/lessons/demo"
                element={
                  <Guard kind="active-only">
                    <LessonDetailRoute />
                  </Guard>
                }
              />
              <Route
                path="/library"
                element={
                  <Guard kind="active-only">
                    <LibraryRoute />
                  </Guard>
                }
              />
              <Route
                path="/progress"
                element={
                  <Guard kind="active-only">
                    <ProgressRoute />
                  </Guard>
                }
              />
              <Route
                path="/account"
                element={
                  <Guard kind="active-only">
                    <AccountRoute />
                  </Guard>
                }
              />
            </Route>

            <Route path="/sample" element={<SampleRoute />} />
            {catalogEnabled ? <Route path="/dev/catalog" element={<CatalogRoute />} /> : null}
            {/* Student-safe Not Found: legacy /operator, /admin and /staff
                paths land here, never in the Admin application. */}
            <Route path="*" element={<NotFoundRoute />} />
          </Routes>
        </PlayerProvider>
      </Box>
    </AuthProvider>
  );
}

export function App() {
  return <ThemedApp />;
}
