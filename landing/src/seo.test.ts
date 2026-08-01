import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const landingDir = resolve(__dirname, '..');
const publicDir = resolve(landingDir, 'public');

interface PageMeta {
  file: string;
  title: string;
  description: string;
  canonical: string;
}

const PAGES: Array<{ file: string; canonicalPath: string }> = [
  { file: 'index.html', canonicalPath: '/' },
  { file: 'about.html', canonicalPath: '/about' },
  { file: 'how-it-works.html', canonicalPath: '/how-it-works' },
  { file: 'install.html', canonicalPath: '/install' },
  { file: 'collaboration.html', canonicalPath: '/collaboration' },
  { file: 'contact.html', canonicalPath: '/contact' },
  { file: 'privacy.html', canonicalPath: '/privacy' },
  { file: 'terms.html', canonicalPath: '/terms' },
  { file: 'sample.html', canonicalPath: '/sample' },
];

function readPage(file: string): string {
  return readFileSync(resolve(landingDir, file), 'utf8');
}

function extract(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

describe('public page metadata (source)', () => {
  it('every public route file exists with unique title, description and canonical', () => {
    const metas: PageMeta[] = [];
    for (const page of PAGES) {
      const html = readPage(page.file);
      const title = extract(html, /<title>([^<]+)<\/title>/);
      const description = extract(html, /<meta\s+name="description"\s+content="([^"]+)"/);
      const canonical = extract(html, /<link\s+rel="canonical"\s+href="([^"]+)"/);
      expect(title, `${page.file} title`).toBeTruthy();
      expect(description, `${page.file} description`).toBeTruthy();
      if (description) {
        expect(description.length, `${page.file} description length`).toBeLessThanOrEqual(170);
      }
      const expectedCanonical =
        page.canonicalPath === '/'
          ? 'https://fastenglishpodcast.com/'
          : `https://fastenglishpodcast.com${page.canonicalPath}`;
      expect(canonical, `${page.file} canonical`).toBe(expectedCanonical);
      metas.push({
        file: page.file,
        title: title ?? '',
        description: description ?? '',
        canonical: canonical ?? '',
      });
    }
    const titles = metas.map((m) => m.title);
    expect(new Set(titles).size).toBe(titles.length);
    const descriptions = metas.map((m) => m.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    const canonicals = metas.map((m) => m.canonical);
    expect(new Set(canonicals).size).toBe(canonicals.length);
  });

  it('every page has Persian language/RTL attributes and social metadata', () => {
    for (const page of PAGES) {
      const html = readPage(page.file);
      expect(html, `${page.file} lang`).toContain('<html lang="fa" dir="rtl">');
      expect(html, `${page.file} og:title`).toMatch(/property="og:title"\s+content="[^"]+"/);
      expect(html, `${page.file} og:description`).toMatch(
        /property="og:description"\s+content="[^"]+"/,
      );
      expect(html, `${page.file} og:url`).toMatch(
        /property="og:url" content="https:\/\/fastenglishpodcast\.com[^"]*"/,
      );
      expect(html, `${page.file} og:image`).toMatch(
        /property="og:image" content="https:\/\/fastenglishpodcast\.com\/og-image\.png"/,
      );
      expect(html, `${page.file} og:site_name`).toContain('content="فست انگلیش پادکست"');
      expect(html, `${page.file} twitter:card`).toMatch(/name="twitter:card" content="summary"/);
      expect(html, `${page.file} favicon`).toContain(
        'rel="icon" type="image/svg+xml" href="/favicon.svg"',
      );
      expect(html, `${page.file} viewport`).toContain('name="viewport"');
    }
  });

  it('does not reference index.html inside canonical or og:url values', () => {
    for (const page of PAGES) {
      const html = readPage(page.file);
      expect(html).not.toMatch(/canonical[^>]*index\.html/);
      expect(html).not.toMatch(/og:url[^>]*index\.html/);
    }
  });
});

describe('sitemap.xml (source)', () => {
  const sitemap = readFileSync(resolve(publicDir, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  it('lists exactly the 9 public canonical landing URLs', () => {
    const expected = PAGES.map((p) =>
      p.canonicalPath === '/'
        ? 'https://fastenglishpodcast.com/'
        : `https://fastenglishpodcast.com${p.canonicalPath}`,
    );
    expect(locs.sort()).toEqual(expected.sort());
  });

  it('never contains authenticated app routes or app subdomain', () => {
    const forbidden = [
      '/api/',
      'app.fastenglishpodcast.com',
      '/login',
      '/signup',
      '/payment',
      '/dashboard',
      '/placement',
      '/lessons',
      '/account',
      '/operator',
      'index.html',
      '.apk',
    ];
    for (const token of forbidden) {
      expect(sitemap, token).not.toContain(token);
    }
  });
});

describe('robots.txt (source)', () => {
  const robots = readFileSync(resolve(publicDir, 'robots.txt'), 'utf8');

  it('allows crawling of the landing and references the sitemap', () => {
    expect(robots).toMatch(/User-agent:\s*\*/);
    expect(robots).toMatch(/Allow:\s*\/\s*/);
    expect(robots).toContain('Sitemap: https://fastenglishpodcast.com/sitemap.xml');
  });

  it('does not block the landing and does not rely on robots for privacy', () => {
    expect(robots).not.toMatch(/^Disallow:/m);
    expect(robots.toLowerCase()).toContain('never be relied on');
  });
});

describe('legal pages (source)', () => {
  it('privacy and terms carry the review-placeholder marker and warning', () => {
    for (const file of ['privacy.html', 'terms.html']) {
      // The marker is rendered by the LegalNotice component used by both pages.
      const pageSource = readFileSync(
        resolve(landingDir, 'src', 'pages', file === 'privacy.html' ? 'PrivacyPage' : 'TermsPage') +
          '.tsx',
        'utf8',
      );
      expect(pageSource).toContain('LegalNotice');
    }
    const notice = readFileSync(
      resolve(landingDir, 'src', 'components', 'LegalNotice.tsx'),
      'utf8',
    );
    expect(notice).toContain('data-legal-status="needs-review"');
    expect(notice).toContain('LEGAL_REVIEW_TEXT');
    const content = readFileSync(resolve(landingDir, 'src', 'content', 'siteContent.ts'), 'utf8');
    expect(content).toContain('نیاز به تأیید مالک/حقوقی پیش از انتشار');
  });

  it('does not fabricate legal identity facts', () => {
    const privacy = readFileSync(resolve(landingDir, 'src', 'pages', 'PrivacyPage.tsx'), 'utf8');
    const terms = readFileSync(resolve(landingDir, 'src', 'pages', 'TermsPage.tsx'), 'utf8');
    for (const source of [privacy, terms]) {
      expect(source).not.toMatch(/شرکت\s+[^\s]+ با شناسه|کد اقتصادی|شناسه ملی\s+\d/);
    }
  });
});

describe('landing output file set', () => {
  it('contains exactly the expected static files in public/', () => {
    const files = readdirSync(publicDir).sort();
    expect(files).toEqual(['favicon.svg', 'og-image.png', 'robots.txt', 'sitemap.xml']);
    // No PWA manifest: site.webmanifest must NOT exist until P4-S2.
    expect(files).not.toContain('site.webmanifest');
  });
});
