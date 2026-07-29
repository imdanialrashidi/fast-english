// app/src/app/App.tsx
import { Box } from '@mui/material';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { PaymentRoute, PaymentStatusRoute } from '../features/payment';
import { AuthProvider, decideRoute, type RouteKind, useAuth } from '../lib/auth';
import { AccountRoute } from './routes/AccountRoute';
import { DashboardRoute } from './routes/DashboardRoute';
import { EntryRoute } from './routes/EntryRoute';
import { LessonDemoRoute } from './routes/LessonDemoRoute';
import { LessonsRoute } from './routes/LessonsRoute';
import { LoginRoute } from './routes/LoginRoute';
import { OperatorRoute } from './routes/OperatorRoute';
import { PlacementRoute } from './routes/PlacementRoute';
import { SignupRoute } from './routes/SignupRoute';
import { AppShell } from './shell/AppShell';
import { PageContainer } from './shell/PageContainer';
import { StatePanel } from './shell/StatePanel';

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
  if (decision.kind === 'deny') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel
          variant="permission"
          title="دسترسی ندارید"
          description="این بخش فقط برای اپراتورها در دسترس است."
        />
      </PageContainer>
    );
  }
  return <>{children}</>;
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
            background: '#0B1220',
            color: '#fff',
            borderRadius: 8,
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

        <Routes>
          <Route path="/" element={<EntryRoute />} />
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
            <Route
              path="/dashboard"
              element={
                <Guard kind="active-only">
                  <DashboardRoute />
                </Guard>
              }
            />
            <Route
              path="/placement"
              element={
                <Guard kind="active-only">
                  <PlacementRoute />
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
                  <LessonDemoRoute />
                </Guard>
              }
            />
            <Route
              path="/lessons/demo"
              element={
                <Guard kind="active-only">
                  <LessonDemoRoute />
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
            <Route
              path="/operator"
              element={
                <Guard kind="operator-only">
                  <OperatorRoute />
                </Guard>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </AuthProvider>
  );
}

export function App() {
  return <ThemedApp />;
}
