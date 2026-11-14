import { expect, test } from '@playwright/test';

// S8 SEO head: the server first paint owns the crawler tags, and an
// Inertia visit replaces them (not appends) using the same data-inertia
// keys. This is the regression guard for stale canonical/OG tags.
test('inertia navigation updates canonical description and open graph once', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  const landingCanonical = await page.locator('link[rel="canonical"]').evaluate((el) => (el as HTMLLinkElement).href);
  expect(landingCanonical).toMatch(/\/$/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /\/images\/og\/fast-english-1200x630\.png$/,
  );

  await page.locator('a[href="/faq"]:visible').first().click();
  await page.waitForURL('**/faq');

  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/faq$/);
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /\/faq$/);
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /پاسخ پرسش/);
  expect(await page.title()).toContain('پرسش‌های پرتکرار');

  // The FAQ page ships matching FAQPage structured data.
  const faqSchema = page.locator('script[type="application/ld+json"]');
  await expect(faqSchema).toHaveCount(1);
  const schemaText = await faqSchema.evaluate((el) => el.textContent ?? '');
  expect(schemaText).toContain('"@type":"FAQPage"');

  // Direct load: the server tags and the hydrated tags must collapse to
  // one each (no duplicate canonical/description/OG from the partial).
  await page.goto('/about');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:type"]')).toHaveCount(1);

  // The sample is the only public content page: article type, one
  // canonical, one Article graph, and no leftover FAQ tags.
  await page.goto('/sample');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/sample$/);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  const articleSchema = await page.locator('script[type="application/ld+json"]').evaluate((el) => el.textContent ?? '');
  expect(articleSchema).toContain('"@type":"Article"');
  expect(articleSchema).toContain('"datePublished"');
});
