#!/usr/bin/env node
// scripts/prerender-landing.mjs
//
// Build-time static pre-rendering for the landing surface (P4-S1).
//
// After `vite build` produces the multi-page HTML output, this script
// renders each page component to static HTML with React's
// `renderToString` (via Vite's SSR module loader) and injects it into
// the built `dist-landing/<page>.html` inside `<div id="root">`.
// It also injects site-wide WebSite/Organization JSON-LD into `<head>`.
//
// Result: every public route is complete, crawlable HTML with essential
// content and metadata — no JavaScript required to read the pages.
// No framework or server runtime is added; Vite and react-dom are
// already repository dependencies.
//
// Usage: node scripts/prerender-landing.mjs [--out dist-landing]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Landing pages now use React hooks (usePublicSettings). React must be a
// SINGLE instance between the page modules (loaded through Vite's SSR
// loader) and react-dom/server: without a forced production build, Vite
// loads the dev React while Node's react-dom/server resolves the
// production build, and every hook throws "Cannot read properties of
// null (reading 'useState')". The dynamic import guarantees NODE_ENV is
// set before react-dom/server is evaluated (ESM static imports hoist).
process.env.NODE_ENV = 'production';
const { renderToString } = await import('react-dom/server');

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const outDir = resolve(rootDir, outArg >= 0 ? process.argv[outArg + 1] : 'dist-landing');

// Public routes: built html file name -> page module under `landing/src/pages/`.
const PAGES = {
  index: 'HomePage',
  about: 'AboutPage',
  'how-it-works': 'HowItWorksPage',
  install: 'InstallPage',
  collaboration: 'CollaborationPage',
  contact: 'ContactPage',
  privacy: 'PrivacyPage',
  terms: 'TermsPage',
  sample: 'SamplePage',
};

// Only values that are accurate today. Nothing fabricated.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://fastenglishpodcast.com/#website',
      url: 'https://fastenglishpodcast.com/',
      name: 'فست انگلیش پادکست',
      inLanguage: 'fa-IR',
    },
    {
      '@type': 'Organization',
      '@id': 'https://fastenglishpodcast.com/#organization',
      url: 'https://fastenglishpodcast.com/',
      name: 'Fast English Podcast',
    },
  ],
};
const JSON_LD_HTML = `  <script type="application/ld+json">${JSON.stringify(JSON_LD)}</script>\n`;

const server = await createServer({
  configFile: resolve(rootDir, 'vite.landing.config.ts'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  mkdirSync(outDir, { recursive: true });
  for (const [file, pageComponent] of Object.entries(PAGES)) {
    const module = await server.ssrLoadModule(`/src/pages/${pageComponent}.tsx`);
    const component = module[pageComponent];
    if (typeof component !== 'function') {
      throw new Error(`Page module ${pageComponent} does not export a component`);
    }
    const body = renderToString(component());
    const filePath = resolve(outDir, `${file}.html`);
    const built = readFileSync(filePath, 'utf8');
    const rootMarker = '<div id="root"></div>';
    if (!built.includes(rootMarker)) {
      throw new Error(`Built ${filePath} is missing the #root placeholder`);
    }
    const injected = built
      .replace(rootMarker, `<div id="root">${body}</div>`)
      .replace('</head>', `${JSON_LD_HTML}</head>`);
    writeFileSync(filePath, injected);
    console.log(`prerendered ${file}.html (${body.length} chars)`);
  }
} finally {
  await server.close();
}

console.log(`prerender complete -> ${outDir}`);
