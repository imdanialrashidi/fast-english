// landing/src/mount.tsx
// Shared client entry helper. When the built HTML already contains the
// pre-rendered page (see `scripts/prerender-landing.mjs`) the container
// is hydrated instead of re-rendered, so the page stays fully readable
// even before JavaScript loads.
import { type ComponentType, StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './styles.css';

export function mountApp(Page: ComponentType) {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root container #root is missing');
  }
  const app = (
    <StrictMode>
      <Page />
    </StrictMode>
  );
  if (container.hasChildNodes()) {
    hydrateRoot(container, app);
  } else {
    createRoot(container).render(app);
  }
}
