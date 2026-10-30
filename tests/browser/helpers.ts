import { readFileSync } from 'node:fs';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect, test as baseTest } from '@playwright/test';

/**
 * Paid-only lane helpers.
 *
 * The real login throttle (5/min per account+IP, scope §16) is product
 * behavior the lane must not hammer: every subscribed-journey test in a
 * worker shares ONE authenticated context for browser-sub (one login per
 * worker per run). Pages stay per-test (fresh cookies-jar slice, own
 * viewport); only the login is shared. No test in the lane logs
 * browser-sub out — logout journeys use their own accounts.
 */

/**
 * Complete the owner-mandated email-verification gate for a freshly
 * registered browser user. The local lane uses the log mailer, so the
 * six-digit code is read from the mail block addressed to this exact
 * email. Production uses SMTP and a real mailbox; nothing here ships.
 */
export async function completeEmailVerification(page: Page, email: string): Promise<void> {
  if (!page.url().includes('/email/verify')) {
    await page.waitForURL(/\/email\/verify/, { timeout: 15_000 });
  }

  const code = await verificationCodeFromLog(email);
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'تأیید ایمیل' }).click();
  await page.waitForURL('**/account**', { timeout: 15_000 });
}

async function verificationCodeFromLog(email: string): Promise<string> {
  const marker = `To: ${email}`;

  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const log = readFileSync('storage/logs/laravel.log', 'utf8');
      // Registration used to emit two mails for the same address (the code
      // mail and Laravel's default signed-link mail). Search every block,
      // newest first, for the one that actually carries the six-digit code.
      const starts: number[] = [];
      let from = 0;
      while ((from = log.indexOf(marker, from)) !== -1) {
        starts.push(from);
        from += marker.length;
      }

      for (const start of starts.reverse()) {
        const block = log.slice(start);
        const match = block.match(
          /<div dir="ltr" style="[^"]*letter-spacing:10px;[^"]*">\s*(\d{6})\s*<\/div>/,
        );
        if (match !== null) {
          return match[1];
        }
      }
    } catch {
      // The log file may not exist yet on a cold lane.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`verification code for ${email} not found in the log mailer`);
}

async function loginAsSub(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('ایمیل', { exact: true }).fill('browser-sub@example.com');
  await page.getByLabel('رمز عبور', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'ورود', exact: true }).click();
  await page.waitForURL('**/account**');
}

let cachedSubCtx: BrowserContext | null = null;

async function sharedSubCtx(browser: Browser): Promise<BrowserContext> {
  if (cachedSubCtx === null) {
    cachedSubCtx = await browser.newContext();
    const loginPage = await cachedSubCtx.newPage();
    await loginAsSub(loginPage);
    await loginPage.close();
  }
  return cachedSubCtx;
}

/** A fresh subscribed page (shared login, per-test page). Close via done. */
export async function subPage(browser: Browser): Promise<{ page: Page; done: () => Promise<void> }> {
  const ctx = await sharedSubCtx(browser);
  const page = await ctx.newPage();
  return { page, done: () => page.close() };
}

/**
 * Drop-in test with a `sub` fixture: a fresh subscribed page per test,
 * one shared lane login per worker. Import { test } from here instead
 * of '@playwright/test' (keep importing expect from there). Mixed files
 * keep the plain `page` fixture for anonymous legs.
 */
export const test = baseTest.extend<{ sub: Page }>({
  sub: async ({ browser }, use) => {
    const handle = await subPage(browser);
    await use(handle.page);
    await handle.done();
  },
});

let cachedStaffCtx: BrowserContext | null = null;

/** One staff session per worker: Filament login is rate-limited, so the
 * approval lane never logs staff in per test. Staff never logs out. */
async function sharedStaffPage(browser: Browser): Promise<{ staff: Page; done: () => Promise<void> }> {
  if (cachedStaffCtx === null) {
    cachedStaffCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const loginPage = await cachedStaffCtx.newPage();
    await loginPage.goto('/admin/login');
    await loginPage.getByLabel('Email').fill('browser-staff@example.com');
    await loginPage.getByRole('textbox', { name: /Password/ }).fill('password');
    await loginPage.getByRole('button', { name: 'Sign in' }).click();
    await loginPage.waitForURL(/\/admin$/);
    await loginPage.close();
  }
  const staff = await cachedStaffCtx.newPage();
  return { staff, done: () => staff.close() };
}

/**
 * Paid-only lane helper: a fresh learner registers, subscribes with a
 * real receipt, and staff approves from the Filament queue — the same
 * end-to-end path as s6-queue.spec.ts. Each call mints an isolated
 * learner (single-open rule + 24h restart rule), so reruns stay
 * deterministic. Placement attempts start clean for a fresh approval.
 */
export async function registerSubscribeAndApprove(
  browser: Browser,
  tag: string,
): Promise<{ learnerCtx: BrowserContext; learner: Page }> {
  const learnerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const learner = await learnerCtx.newPage();
  const { staff, done: doneStaff } = await sharedStaffPage(browser);

  try {
    const email = `s7-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    await learner.goto('/register');
    await learner.getByLabel('نام').fill(`S7 ${tag}`);
    await learner.getByLabel('ایمیل', { exact: true }).fill(email);
    await learner.getByLabel('رمز عبور', { exact: true }).fill('password123');
    await learner.getByLabel('تکرار رمز عبور').fill('password123');
    await learner.getByRole('button', { name: 'ساخت حساب' }).click();
    await learner.waitForURL(/\/email\/verify|\/account/);
    if (learner.url().includes('/email/verify')) {
      await completeEmailVerification(learner, email);
    }

    await learner.goto('/app/subscribe');
    await learner.getByRole('button', { name: 'انتخاب این پلن' }).first().click();
    await learner.waitForURL('**/app/payments/*');
    await learner.locator('#receipt').setInputFiles('database/seeders/fixtures/s3-cover-fixture.jpg');
    await learner.getByRole('button', { name: 'ثبت رسید' }).click();
    await learner.waitForURL('**/app/payments/*');

    await staff.goto('/admin/payment-requests');
    await staff.getByRole('searchbox', { name: 'Search', exact: true }).fill(email);
    await staff.getByRole('link', { name: email }).click();
    await staff.waitForURL('**/admin/payment-requests/*');
    await staff.getByRole('button', { name: 'Approve', exact: true }).first().click();
    await staff.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(staff.getByText('Approved; subscription extended.')).toBeVisible();
  } finally {
    await doneStaff();
  }

  return { learnerCtx, learner };
}
