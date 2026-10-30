import { expect, test } from '@playwright/test';
import { completeEmailVerification } from './helpers';

// S5-8 rendered mobile: subscribe, request, and receipt-upload step at 360
// and 390 CSS px have no horizontal scroll, touch targets are >=44px, and
// form error states are visible. Screenshots are captured and must be
// inspected as pixels (not counts), including the Persian toman formatting.

async function registerFreshStudent(page, tag: string) {
  const email = `s5m-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = 'password123';
  await page.goto('/register');
  await page.getByLabel('نام').fill(`S5M ${tag}`);
  await page.getByLabel('ایمیل', { exact: true }).fill(email);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByLabel('تکرار رمز عبور').fill(password);
  await page.getByRole('button', { name: 'ساخت حساب' }).click();
  await page.waitForURL(/\/email\/verify|\/account/);
  if (page.url().includes('/email/verify')) {
    await completeEmailVerification(page, email);
  }
}

async function noHorizontalScroll(page) {
  return page.evaluate(() => ({
    scroll: document.scrollingElement?.scrollWidth ?? 0,
    inner: window.innerWidth,
  }));
}

async function assertS5Targets(page) {
  // Every primary control on the S5 pages meets the 44px rule.
  for (const button of await page.getByRole('button').all()) {
    if (!(await button.isVisible())) continue;
    const box = await button.boundingBox();
    if (!box) continue;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  for (const link of await page.locator('a.fe-btn').all()) {
    if (!(await link.isVisible())) continue;
    const box = await link.boundingBox();
    if (!box) continue;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  for (const input of await page.locator('#receipt, #bank_reference, #sender_last4, #transferred_at').all()) {
    if (!(await input.isVisible())) continue;
    const box = await input.boundingBox();
    if (!box) continue;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  for (const nav of await page.getByRole('link', { name: /مطالب|ذخیره‌شده‌ها|حساب/ }).all()) {
    if (!(await nav.isVisible())) continue;
    const box = await nav.boundingBox();
    if (!box) continue;
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

for (const width of [360, 390]) {
  test(`S5-8 subscribe at ${width}px: no scroll, Persian toman, 44px targets`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await registerFreshStudent(page, `sub${width}`);
    await page.goto('/app/subscribe');
    await page.getByRole('heading', { name: 'انتخاب پلن' }).waitFor();

    const { scroll, inner } = await noHorizontalScroll(page);
    expect(scroll).toBeLessThanOrEqual(inner);

    // Persian number formatting of the toman amounts (Persian digits + تومان).
    const bodyText = (await page.locator('#fe-content').textContent()) ?? '';
    expect(bodyText).toContain('تومان');
    expect(bodyText).toMatch(/[۰-۹]/);

    await assertS5Targets(page);
    await page.screenshot({ path: `test-results/browser-shots/s5-subscribe-${width}.png` });
  });

  test(`S5-8 request + receipt upload at ${width}px: no scroll, errors visible, 44px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await registerFreshStudent(page, `req${width}`);
    await page.goto('/app/subscribe');
    await page.getByRole('button', { name: 'انتخاب این پلن' }).first().click();
    await page.waitForURL('**/app/payments/*');
    await page.getByRole('heading', { name: 'درخواست پرداخت' }).waitFor();

    // Request page: snapshot + explicit next step, no horizontal scroll.
    let measured = await noHorizontalScroll(page);
    expect(measured.scroll).toBeLessThanOrEqual(measured.inner);
    await expect(page.getByText('قدم بعدی: واریز و ارسال رسید')).toBeVisible();
    await assertS5Targets(page);
    await page.screenshot({ path: `test-results/browser-shots/s5-request-${width}.png` });

    // Error state: a rejected SVG shows a server field error, still no scroll.
    // (The file input carries required, so empty-submit stops at native
    // browser validation — the server error leg is the SVG below.)
    await page.locator('#receipt').setInputFiles('database/seeders/fixtures/s5-rejected-fixture.svg');
    await page.getByRole('button', { name: 'ثبت رسید' }).click();
    const formError = page.locator('form.fe-filters .fe-alert').first();
    await expect(formError).toBeVisible();
    await expect(page.getByText('قدم بعدی: واریز و ارسال رسید')).toBeVisible();
    measured = await noHorizontalScroll(page);
    expect(measured.scroll).toBeLessThanOrEqual(measured.inner);
    await page.locator('form.fe-filters').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/browser-shots/s5-upload-error-${width}.png` });

    // Valid fixture upload moves to pending with an explicit next step.
    await page.locator('#receipt').setInputFiles('database/seeders/fixtures/s3-cover-fixture.jpg');
    await page.getByRole('button', { name: 'ثبت رسید' }).click();
    await page.waitForURL('**/app/payments/*');
    await expect(page.getByText('قدم بعدی: انتظار برای بررسی')).toBeVisible();
    measured = await noHorizontalScroll(page);
    expect(measured.scroll).toBeLessThanOrEqual(measured.inner);
    await assertS5Targets(page);
    await page.screenshot({ path: `test-results/browser-shots/s5-pending-${width}.png` });
  });
}
