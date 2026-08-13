// app/src/app/App.tsx
import { Box } from '@mui/material';
import { type ComponentType, lazy, type ReactNode, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { StatePanel } from '../../../shared/ui/StatePanel';
import { HomeRoute } from '../features/home/routes/HomeRoute';
import { PlayerProvider } from '../features/player';
import { AuthProvider, decideRoute, type RouteKind, useAuth } from '../lib/auth';
import {
  FUNNEL_EVENTS,
  redactPath,
  sanitizeMessage,
  setSurface,
  trackFunnel,
} from '../lib/telemetry';
import { CatalogRoute } from './routes/CatalogRoute';
import { EntryRoute } from './routes/EntryRoute';
import { NotFoundRoute } from './routes/NotFoundRoute';
import { AppShell } from './shell/AppShell';
import { RouteLoadFallback } from './shell/RouteLoadFallback';

// ---------------------------------------------------------------------------
// Route-level code splitting (production performance).
//
// Only the first-paint surfaces stay in the entry chunk: EntryRoute (guest
// landing), HomeRoute (active-student landing), NotFoundRoute, the shared
// shell chrome (AppShell) and the always-mounted PlayerProvider. Every
// other route loads its feature chunk on first navigation, so the initial
// payload never carries payment/placement/library/episode/lessons feature
// code or their exclusive dependencies (e.g. react-hook-form + zod move to
// the login/signup/payment chunks).
//
// `lazyNamed` maps a named export to the default export React.lazy wants;
// the `path=` strings below stay static (App.routes.test.ts asserts them).
// ---------------------------------------------------------------------------

function lazyNamed<T extends ComponentType<unknown>>(
  importer: () => Promise<Record<string, unknown>>,
  name: string,
) {
  return lazy(() => importer().then((m) => ({ default: m[name] as T })));
}

const LoginRoute = lazyNamed(() => import('./routes/LoginRoute'), 'LoginRoute');
const SignupRoute = lazyNamed(() => import('./routes/SignupRoute'), 'SignupRoute');
const PaymentRoute = lazyNamed(
  () => import('../features/payment/routes/PaymentRoute'),
  'PaymentRoute',
);
const PaymentStatusRoute = lazyNamed(
  () => import('../features/payment/routes/PaymentStatusRoute'),
  'PaymentStatusRoute',
);
const PlacementRoute = lazyNamed(
  () => import('../features/placement/routes/PlacementRoute'),
  'PlacementRoute',
);
const LevelResultRoute = lazyNamed(
  () => import('../features/placement/routes/LevelResultRoute'),
  'LevelResultRoute',
);
const LessonsRoute = lazyNamed(
  () => import('../features/lessons/routes/LessonsRoute'),
  'LessonsRoute',
);
const LessonDetailRoute = lazyNamed(
  () => import('../features/lessons/routes/LessonDetailRoute'),
  'LessonDetailRoute',
);
const SampleRoute = lazyNamed(
  () => import('../features/lessons/routes/SampleRoute'),
  'SampleRoute',
);
const LibraryRoute = lazyNamed(
  () => import('../features/library/routes/LibraryRoute'),
  'LibraryRoute',
);
const ProgressRoute = lazyNamed(
  () => import('../features/progress/routes/ProgressRoute'),
  'ProgressRoute',
);
const AccountRoute = lazyNamed(() => import('./routes/AccountRoute'), 'AccountRoute');
// Dev-only component catalog (imported eagerly; tree-shaken out of
// production builds where `catalogEnabled` folds to false).
const catalogEnabled = import.meta.env.DEV || import.meta.env.VITE_CATALOG === '1';

/** Suspense boundary for a single lazy route element: only the route
 *  content suspends, never the shared shell or the Player. */
function Suspended({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoadFallback />}>{children}</Suspense>;
}

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
  const location = useLocation();

  // Route/surface context for telemetry: the redacted pathname is
  // attached to every event; one route_change event per navigation
  // (never per render).
  useEffect(() => {
    setSurface(location.pathname);
    trackFunnel(FUNNEL_EVENTS.routeChange, {
      path: sanitizeMessage(redactPath(location.pathname)),
    });
  }, [location.pathname]);

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
                  <Suspended>
                    <LoginRoute />
                  </Suspended>
                </Guard>
              }
            />
            <Route
              path="/signup"
              element={
                <Guard kind="guest-only">
                  <Suspended>
                    <SignupRoute />
                  </Suspended>
                </Guard>
              }
            />

            <Route element={<AppShell />}>
              <Route
                path="/payment"
                element={
                  <Guard kind="pending-only">
                    <Suspended>
                      <PaymentRoute />
                    </Suspended>
                  </Guard>
                }
              />
              <Route
                path="/payment-status"
                element={
                  <Guard kind="pending-only">
                    <Suspended>
                      <PaymentStatusRoute />
                    </Suspended>
                  </Guard>
                }
              />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route
                path="/placement"
                element={
                  <Guard kind="active-only">
                    <Suspended>
                      <PlacementRoute />
                    </Suspended>
                  </Guard>
                }
              />
              <Route
                path="/placement/result"
                element={
                  <Guard kind="active-only">
                    <Suspended>
                      <LevelResultRoute />
                    </Suspended>
                  </Guard>
                }
              />
              <Route
                path="/lessons"
                element={
                  <Guard kind="active-only">
                    <Suspended>
                      <LessonsRoute />
                    </Suspended>
                  </Guard>
                }
              />
              <Route
                path="/lessons/:id"
                element={
                  <Guard kind="active-only">
                    <Suspended>
                      <LessonDetailRoute />
                    </Suspended>
                  </Guard>
                }
              />
              <Route
                path="/lessons/demo"
                element={
                  <Guard kind="active-only">
                    <Suspended>
                      <LessonDetailRoute />
                    </Suspended>
                  </Guard>
                }
              />
              <Route
                path="/library"
                element={
                  <Guard kind="active-only">
                    <Suspended>
                      <LibraryRoute />
                    </Suspended>
                  </Guard>
                }
              />
              <Route
                path="/progress"
                element={
                  <Guard kind="active-only">
                    <Suspended>
                      <ProgressRoute />
                    </Suspended>
                  </Guard>
                }
              />
              <Route
                path="/account"
                element={
                  <Guard kind="active-only">
                    <Suspended>
                      <AccountRoute />
                    </Suspended>
                  </Guard>
                }
              />
            </Route>

            <Route
              path="/sample"
              element={
                <Suspended>
                  <SampleRoute />
                </Suspended>
              }
            />
            {catalogEnabled ? (
              <Route
                path="/dev/catalog"
                element={
                  <Suspended>
                    <CatalogRoute />
                  </Suspended>
                }
              />
            ) : null}
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
