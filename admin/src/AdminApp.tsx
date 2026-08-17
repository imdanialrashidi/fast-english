// admin/src/AdminApp.tsx
// Unified Staff Admin Console (https://admin.fastenglishpodcast.com).
//
// Routes:
//   /login                 Staff login (public)
//   /                      Dashboard (staff-only)
//   /content               Content dashboard (staff-only)
//   /content/categories    Category management (staff-only)
//   /content/episodes      Episode workspace (staff-only)
//   /content/episodes/new  Create episode (staff-only)
//   /content/episodes/:episodeId        Episode editor (staff-only)
//   /content/episodes/:episodeId/variants/:level   Variant editor (staff-only)
//   /content/import        Content Package ZIP import (staff-only)
//   /content/preview/:episodeId         Staff draft preview (staff-only)
//   /payments              Payment review queue (staff-only)
//   /payments/:requestId   Payment review detail (staff-only)
//   /settings              Admin settings (staff-only; theme control here)
//
// The router is a DATA router (createBrowserRouter) because the Content
// editors use useBlocker for unsaved-changes protection — declarative
// <BrowserRouter> does not provide the blocker context.
//
// Unfinished Analytics and Student-management modules are intentionally
// NOT exposed.

import { Box } from '@mui/material';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  RouterProvider,
  useLocation,
} from 'react-router';
import { PageContainer } from '../../shared/ui/PageContainer';
import { StatePanel } from '../../shared/ui/StatePanel';
import {
  decideStaffRoute,
  StaffAuthProvider,
  type StaffRouteKind,
  useStaffAuth,
} from './auth/staffAuth';
import { CategoriesRoute } from './features/content/routes/CategoriesRoute';
import { ContentDashboardRoute } from './features/content/routes/ContentDashboardRoute';
import { EpisodeEditorRoute } from './features/content/routes/EpisodeEditorRoute';
import { EpisodeNewRoute } from './features/content/routes/EpisodeNewRoute';
import { EpisodePreviewRoute } from './features/content/routes/EpisodePreviewRoute';
import { EpisodesRoute } from './features/content/routes/EpisodesRoute';
import { ImportRoute } from './features/content/routes/ImportRoute';
import { VariantEditorRoute } from './features/content/routes/VariantEditorRoute';
import { HelpRoute } from './features/help/HelpRoute';
import { PaymentsRoute } from './features/payments/PaymentsRoute';
import { AdminDashboardRoute } from './routes/AdminDashboardRoute';
import { AdminLoginRoute } from './routes/AdminLoginRoute';
import { AdminNotFoundRoute } from './routes/AdminNotFoundRoute';
import { AdminSettingsRoute } from './routes/AdminSettingsRoute';
import { AdminShell } from './shell/AdminShell';

function Guard({ kind, children }: { kind: StaffRouteKind; children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useStaffAuth();
  const location = useLocation();
  if (isInitializing) {
    return (
      <PageContainer maxWidth="md">
        <StatePanel variant="loading" title="در حال بررسی نشست…" />
      </PageContainer>
    );
  }
  const decision = decideStaffRoute(kind, isAuthenticated);
  if (decision.kind === 'redirect') {
    const redirect = decision.to + (location.search ?? '') + (location.hash ?? '');
    return <Navigate to={redirect} replace />;
  }
  return <>{children}</>;
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route
        path="/login"
        element={
          <Guard kind="guest-only">
            <AdminLoginRoute />
          </Guard>
        }
      />
      <Route
        element={
          <Guard kind="staff-only">
            <AdminShell />
          </Guard>
        }
      >
        <Route index element={<AdminDashboardRoute />} />
        <Route path="payments" element={<PaymentsRoute />} />
        <Route path="payments/:requestId" element={<PaymentsRoute />} />
        <Route path="content" element={<ContentDashboardRoute />} />
        <Route path="content/categories" element={<CategoriesRoute />} />
        <Route path="content/episodes" element={<EpisodesRoute />} />
        <Route path="content/episodes/new" element={<EpisodeNewRoute />} />
        <Route path="content/episodes/:episodeId" element={<EpisodeEditorRoute />} />
        <Route
          path="content/episodes/:episodeId/variants/:level"
          element={<VariantEditorRoute />}
        />
        <Route path="content/import" element={<ImportRoute />} />
        <Route path="content/preview/:episodeId" element={<EpisodePreviewRoute />} />
        <Route path="settings" element={<AdminSettingsRoute />} />
        <Route path="help" element={<HelpRoute />} />
      </Route>
      <Route path="*" element={<AdminNotFoundRoute />} />
    </Route>,
  ),
);

export function AdminApp() {
  return (
    <StaffAuthProvider>
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
        <RouterProvider router={router} />
      </Box>
    </StaffAuthProvider>
  );
}
