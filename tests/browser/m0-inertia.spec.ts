import { expect, test } from '@playwright/test';

// M0 Inertia foundation: the landing page renders through the full
// Laravel → Inertia → React path with real seeded data (S1 sample +
// S5 plans). Persian copy parity with the Blade landing is asserted on
// the rendered DOM; the HTTP contract lives in M0InertiaFoundationTest.
test('landing renders the React page with the real sample and one plans state', async ({ page }) => {
  const pageErrors: string[] = [];
  const badResponses: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      pageErrors.push(message.text());
    }
  });
  // Lane note: two S3 cover fixtures are absent from this checkout's
  // storage/ (the Blade /app library 403s on the same files), so
  // fixture misses under /storage/ are tolerated here — anything else
  // failing is a real regression.
  page.on('response', (response) => {
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });

  await page.goto('/');

  // Document contract: fa RTL, permanent light (no theme attribute).
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const hasThemeAttr = await page.locator('html').evaluate((el) => el.hasAttribute('data-theme'));
  expect(hasThemeAttr).toBe(false);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);

  // Transport proof: the React root mounted the Landing page component.
  // (Inertia v3.5 encodes the page in <script data-page type=json>.)
  const component = await page.locator('script[data-page="app"]').evaluate((el) => {
    const raw = el.textContent;
    if (!raw) throw new Error('empty page JSON');
    return (JSON.parse(raw) as { component: string }).component;
  });
  expect(component).toBe('Landing/Index');
  await expect(page.locator('#app')).not.toBeEmpty();
  await expect(page.locator('#app')).toContainText('انگلیسی را با داستان‌های کوتاه و صوت هماهنگ یاد بگیر');

  // Hero: staged real sample with a level deep link (seeded S1 sample).
  // Paid-only slice: the deep link targets the public sample experience.
  await expect(page.getByRole('heading', { name: 'یک نمونه واقعی، بدون ثبت‌نام' })).toBeVisible();
  const sampleLink = page.locator('section[aria-label="نمونه واقعی"] a[href*="level="]').first();
  await expect(sampleLink).toBeVisible();
  expect(await sampleLink.getAttribute('href')).toMatch(/\/sample\?topic=.+&level=[A-C][12]/);

  // Preview copy + one rendered sample sentence.
  await expect(page.locator('#app')).toContainText('پیش‌نمایش روش کار با متن واقعی');
  await expect(page.locator('ol[aria-label="سه جمله از نمونه واقعی"] li').first()).not.toBeEmpty();

  // Plans: exactly one of the two sales states renders (one purchase
  // CTA per plan card when sales are on, one preparing panel when off).
  const ctaCount = await page.getByText('مشاهده پلن‌ها و خرید').count();
  const prepCount = await page.getByText('در دست آماده‌سازی').count();
  if (prepCount === 1) {
    expect(ctaCount).toBe(0);
  } else {
    expect(ctaCount).toBeGreaterThanOrEqual(1);
    expect(prepCount).toBe(0);
  }

  // FAQ + final CTA + install links all render.
  await expect(page.locator('#app')).toContainText('بدون اشتراک می‌توانم امتحان کنم؟');
  await expect(page.getByRole('link', { name: 'شروع با نمونه رایگان' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'صفحه دانلود' }).first()).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(badResponses.filter((line) => !line.includes('/storage/'))).toEqual([]);

  await page.screenshot({ path: 'test-results/browser-shots/m0-landing-desktop.png' });
});

test('landing has no horizontal overflow on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({ path: 'test-results/browser-shots/m0-landing-390.png', fullPage: false });
});
