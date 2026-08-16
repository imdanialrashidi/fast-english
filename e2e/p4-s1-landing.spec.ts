// e2e/p4-s1-landing.spec.ts
// P4-S1 — real-browser checks for the public landing site:
//   - every public route serves complete, crawlable HTML
//   - H1, Persian language metadata, and unique titles
//   - CTA targets (web app, public sample, Android honest state)
//   - skip-to-content link, mobile navigation, FAQ disclosure
//   - no horizontal overflow on mobile
//   - robots.txt / sitemap.xml served at the site root
import { expect, test } from '@playwright/test';
import { LANDING_URL_E2E } from '../playwright.config';

const LANDING = LANDING_URL_E2E;
const WEB_APP_DEFAULT = 'https://app.fastenglishpodcast.com';

const ROUTES = [
  { path: '/', titlePart: 'فست انگلیش پادکست', h1: 'یک موضوع، شش سطح' },
  { path: '/about', titlePart: 'دربارهٔ فست انگلیش پادکست', h1: 'دربارهٔ فست انگلیش پادکست' },
  { path: '/how-it-works', titlePart: 'چگونه کار می‌کند', h1: 'چگونه کار می‌کند؟' },
  { path: '/install', titlePart: 'نصب اپلیکیشن', h1: 'نصب اپلیکیشن' },
  {
    path: '/collaboration',
    titlePart: 'همکاری با فست انگلیش پادکست',
    h1: 'همکاری با فست انگلیش پادکست',
  },
  { path: '/contact', titlePart: 'تماس و پشتیبانی', h1: 'تماس و پشتیبانی' },
  { path: '/privacy', titlePart: 'حریم خصوصی', h1: 'حریم خصوصی' },
  { path: '/terms', titlePart: 'شرایط استفاده', h1: 'شرایط استفاده' },
  { path: '/sample', titlePart: 'نمونه درس', h1: 'نمونهٔ درس' },
];

test.use({ baseURL: LANDING });

for (const route of ROUTES) {
  test(`route ${route.path} serves crawlable content with correct metadata`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));

    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText(route.h1);

    const title = await page.title();
    expect(title).toContain(route.titlePart);
    expect(title.length).toBeGreaterThan(10);

    const htmlLang = await page.locator('html').getAttribute('lang');
    const htmlDir = await page.locator('html').getAttribute('dir');
    expect(htmlLang).toBe('fa');
    expect(htmlDir).toBe('rtl');

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe(
      `https://fastenglishpodcast.com${route.path === '/' ? '/' : route.path}`,
    );

    // No uncaught page errors (e.g. hydration mismatches).
    expect(errors).toEqual([]);
  });
}

test('homepage CTA targets are correct and safe', async ({ page }) => {
  await page.goto('/');

  // Primary CTA: the web app.
  const webAppLink = page.locator('a[href="https://app.fastenglishpodcast.com"]').first();
  await expect(webAppLink).toBeVisible();
  await expect(webAppLink).toHaveAttribute('target', '_blank');
  await expect(webAppLink).toHaveAttribute('rel', /noopener/);
  await expect(webAppLink).toHaveAttribute('rel', /noreferrer/);

  // Secondary CTA: the public sample page.
  const sampleLink = page.locator('a[href="/sample"]').first();
  await expect(sampleLink).toBeVisible();

  // Android CTA: honest unavailable state in the default build.
  await expect(page.getByText('نسخهٔ اندروید به‌زودی منتشر می‌شود').first()).toBeVisible();

  // No fabricated APK links anywhere.
  expect(await page.locator('a[href*=".apk"]').count()).toBe(0);
});

test('public sample page links to the live sample inside the web app', async ({ page }) => {
  await page.goto('/sample');
  const liveSample = page.locator(`a[href="${WEB_APP_DEFAULT}/sample"]`);
  await expect(liveSample).toHaveCount(1);
  await expect(liveSample).toHaveAttribute('target', '_blank');
  await expect(liveSample).toHaveAttribute('rel', /noopener/);
});

test('install page explains installation without unsafe guidance', async ({ page }) => {
  await page.goto('/install');
  await expect(page.getByRole('heading', { name: 'نصب اپلیکیشن', level: 1 })).toBeVisible();
  await expect(page.getByText('وب‌اپ — بدون نصب')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'نصب روی iPhone / iPad' })).toBeVisible();
  await expect(page.locator('#ios')).toContainText('Add to Home Screen');
  await expect(page.getByText('وقتی اندروید اجازهٔ نصب از مرورگر را می‌خواهد')).toBeVisible();
  await expect(page.getByText('بررسی اصالت دانلود')).toBeVisible();
  // Never encourages disabling Android security globally.
  await expect(page.getByText('محافظ‌های امنیتی اندروید را به‌صورت کلی غیرفعال نکنید')).toBeVisible();
  await expect(page.getByText('نسخهٔ اندروید به‌زودی منتشر می‌شود')).toBeVisible();
});

test('campaign parameters are preserved on the primary CTA, unknown params are dropped', async ({
  page,
}) => {
  await page.goto('/?utm_source=e2e&utm_campaign=launch&token=SECRET&fbclid=xyz');
  const cta = page.locator('main a[href^="https://app.fastenglishpodcast.com"]').first();
  // AppCta applies the campaign params in an effect after hydration;
  // poll until the enriched href is visible.
  await expect.poll(() => cta.getAttribute('href')).toContain('utm_source=e2e');
  const href = await cta.getAttribute('href');
  expect(href).toContain('utm_campaign=launch');
  expect(href).not.toContain('token=');
  expect(href).not.toContain('fbclid=');
});

test('acquisition telemetry records route surface and signup intent without PII', async ({
  page,
}) => {
  await page.goto('/?utm_source=e2e');
  await expect
    .poll(() =>
      page.evaluate(() =>
        typeof window.__fepTelemetry === 'function' ? window.__fepTelemetry() : null,
      ),
    )
    .not.toBeNull();
  // route_change recorded exactly once per page load, surface redacted.
  const before = await page.evaluate(() => window.__fepTelemetry().events);
  const routes = before.filter((e) => e.name === 'route_change');
  expect(routes).toHaveLength(1);
  expect(routes[0].surface).toBe('/');
  // Clicking the hero CTA records signup_intent with a fixed place.
  await page.locator('main a[href^="https://app.fastenglishpodcast.com"]:visible').first().click();
  await expect
    .poll(() => page.evaluate(() => window.__fepTelemetry().events.map((e) => e.name)))
    .toContain('signup_intent');
  const after = await page.evaluate(() => window.__fepTelemetry().events);
  const signup = after.find((e) => e.name === 'signup_intent');
  expect(signup?.fields?.where).toBe('hero');
  // No query params / campaign values ever enter the event payload.
  expect(JSON.stringify(after)).not.toContain('utm_');
});

test('install page explains per-browser PWA flows and records install intent', async ({ page }) => {
  await page.goto('/install');
  await expect(page.getByText('نصب وب‌اپ روی صفحهٔ اصلی (PWA)')).toBeVisible();
  // The dedicated iOS section replaced the old in-list bullet.
  await expect(page.locator('#ios')).toBeVisible();
  await expect(page.locator('#ios')).toContainText('Add to Home Screen');
  await expect(page.getByText('هیچ مرورگری تضمین نمی‌کند که این گزینه را نشان دهد')).toBeVisible();
  // beforeinstallprompt → install_intent (shared contract event).
  await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
  });
  await expect
    .poll(() => page.evaluate(() => window.__fepTelemetry().events.map((e) => e.name)))
    .toContain('install_intent');
});

test('skip link is keyboard-accessible and targets main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skipLink = page.locator('a:has-text("پرش به محتوای اصلی")');
  await expect(skipLink).toBeFocused();
  await skipLink.click();
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator('#main-content')).toBeVisible();
});

test('mobile menu opens and navigates on a small viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menuButton = page.getByRole('button', { name: 'باز/بستن منو' });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  const mobileNav = page.locator('#mobile-nav');
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole('link', { name: 'همکاری' })).toBeVisible();
  await mobileNav.getByRole('link', { name: 'درباره' }).click();
  await expect(page).toHaveURL(/\/about$/);
});

test('no horizontal overflow on mobile viewports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ROUTES) {
    await page.goto(route.path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${route.path} horizontal overflow`).toBeLessThanOrEqual(0);
  }
});

test('FAQ disclosure opens and reveals the answer', async ({ page }) => {
  await page.goto('/');
  const faq = page.locator('details').first();
  await expect(faq.locator('summary')).toContainText('فست انگلیش پادکست چیست؟');
  await expect(faq.locator('p')).toBeHidden();
  await faq.locator('summary').click();
  await expect(faq.locator('p')).toBeVisible();
});

test('robots.txt and sitemap.xml are served and correct', async ({ request }) => {
  const robots = await request.get(`${LANDING}/robots.txt`);
  expect(robots.status()).toBe(200);
  const robotsText = await robots.text();
  expect(robotsText).toContain('User-agent: *');
  expect(robotsText).toContain('Allow: /');
  expect(robotsText).toContain('Sitemap: https://fastenglishpodcast.com/sitemap.xml');

  const sitemap = await request.get(`${LANDING}/sitemap.xml`);
  expect(sitemap.status()).toBe(200);
  const sitemapText = await sitemap.text();
  for (const path of [
    '/about',
    '/how-it-works',
    '/install',
    '/collaboration',
    '/contact',
    '/privacy',
    '/terms',
    '/sample',
  ]) {
    expect(sitemapText).toContain(`<loc>https://fastenglishpodcast.com${path}</loc>`);
  }
  // Authenticated app routes must never be listed.
  for (const forbidden of [
    '/login',
    '/signup',
    '/payment',
    '/dashboard',
    '/placement',
    '/lessons',
    '/operator',
    'app.fastenglishpodcast.com',
  ]) {
    expect(sitemapText).not.toContain(forbidden);
  }
});

test('legal pages carry the review placeholder banner', async ({ page }) => {
  for (const path of ['/privacy', '/terms']) {
    await page.goto(path);
    const notice = page.locator('[data-legal-status="needs-review"]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('نیاز به تأیید');
  }
});

test('header navigation reaches every public page', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'ناوبری اصلی' });
  for (const [label, path] of [
    ['خانه', '/'],
    ['چگونه کار می‌کند', '/how-it-works'],
    ['نصب', '/install'],
    ['نمونه درس', '/sample'],
    ['درباره', '/about'],
    ['همکاری', '/collaboration'],
    ['تماس', '/contact'],
  ]) {
    const link = nav.getByRole('link', { name: label });
    await expect(link).toHaveAttribute('href', path);
  }
  // Footer legal links.
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'حریم خصوصی' })).toHaveAttribute(
    'href',
    '/privacy',
  );
  await expect(footer.getByRole('link', { name: 'شرایط استفاده' })).toHaveAttribute(
    'href',
    '/terms',
  );
});
