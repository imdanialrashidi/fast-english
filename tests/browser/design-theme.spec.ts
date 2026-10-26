import { expect } from '@playwright/test';
import { test } from './helpers';

// Design slice: Premium editorial permanent-light theme (ADR-0002 +
// docs/DESIGN.md canonical palette) + studio player + keyboard/focus/
// reduced-motion health. Dark/system/sepia theming was removed by owner
// decision: there is no data-theme switching, no fe-theme storage, and
// no appearance choice anywhere. Screenshots land in
// test-results/browser-shots (gitignored artifacts); each is opened and
// inspected, not counted.

const READER = '/app/topics/city-park?level=A2';
const FRESH = () => ({ email: `design-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`, password: 'password-Test1' });

// Permanent light canvas (docs/DESIGN.md --color-canvas #F7F4EE).
const CANVAS_RGB = 'rgb(247, 244, 238)';

// Paid-only slice: learner captures need the subscribed lane account
// (fresh registrations land on the locked state by owner requirement).
async function loginAsSub(page) {
  await page.goto('/login');
  await page.getByLabel('ایمیل', { exact: true }).fill('browser-sub@example.com');
  await page.getByLabel('رمز عبور', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'ورود' }).click();
  await page.waitForURL('**/account**');
}

async function noOverflow(page) {
  const m = await page.evaluate(() => ({
    scroll: document.documentElement?.scrollWidth ?? 0,
    inner: window.innerWidth,
  }));
  expect(m.scroll).toBeLessThanOrEqual(m.inner);
}

async function expectTargets(page) {
  // Radio/checkbox/range inputs are small by design; their label rows
  // carry the 44px target.
  const small = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a, button, input'));
    return els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .filter((el) => !['radio', 'checkbox', 'range'].includes((el as HTMLInputElement).type))
      .map((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return { label: (el.getAttribute('id') ?? el.textContent ?? '').trim().slice(0, 30), w: r.width, h: r.height };
      })
      .filter((m) => m.w < 44 || m.h < 44);
  });
  expect(small).toEqual([]);
}

async function expectPermanentLight(page) {
  // No theme switching code anywhere: no data-theme attribute, no
  // fe-theme storage, no prefers-color-scheme script.
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  const stored = await page.evaluate(() => localStorage.getItem('fe-theme'));
  expect(stored).toBeNull();
  const canvas = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(canvas).toBe(CANVAS_RGB);
  const html = await page.content();
  expect(html).not.toContain('fe-theme');
  expect(html).not.toContain('prefers-color-scheme');
}

test('theme: permanent light under any OS scheme, no stored choice, no flash', async ({ browser }) => {
  // Dark OS, fresh context, no stored choice -> the same warm canvas.
  const darkCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const darkPage = await darkCtx.newPage();
  await darkPage.goto('/login');
  await expectPermanentLight(darkPage);
  await darkCtx.close();

  // The choice-free theme survives reload + navigation, and an OS change
  // never flips it.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await loginAsSub(page);
  await page.goto('/app/account/settings');
  await expectPermanentLight(page);
  // No appearance radios anywhere on the settings page.
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.locator('.fe-appearance-option')).toHaveCount(0);
  await page.reload();
  await expectPermanentLight(page);
  await page.goto('/app/today');
  await expectPermanentLight(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await expectPermanentLight(page);
  await ctx.close();

  // Light OS renders identically.
  const lightCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const lightPage = await lightCtx.newPage();
  await lightPage.goto('/login');
  await expectPermanentLight(lightPage);
  await lightCtx.close();
});

test('capture: auth at 390 in the permanent light theme', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'ورود به حساب' })).toBeVisible();
  await noOverflow(page);
  await expectTargets(page);
  await page.screenshot({ path: 'test-results/browser-shots/design-login-light-390.png' });
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'ساخت حساب' })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: 'test-results/browser-shots/design-register-light-390.png' });
  await ctx.close();
});

test('capture: library, reader, today, words, settings in the permanent light theme', async ({ sub: page }) => {
  // Paid-only slice: captures drive the shared subscribed page (one lane
  // login per worker, honoring the §16 throttle).
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'کشف مطالب' })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: 'test-results/browser-shots/design-library-light-390.png' });

  await page.goto(READER);
  await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration ?? NaN));
  await noOverflow(page);
  await expectTargets(page);
  await page.screenshot({ path: 'test-results/browser-shots/design-reader-light-390.png' });

  await page.goto('/app/today');
  await expect(page.getByText('هدف امروز')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: 'test-results/browser-shots/design-today-light-390.png' });

  await page.goto('/app/words');
  await expect(page.getByRole('heading', { name: 'واژه‌ها' })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: 'test-results/browser-shots/design-words-light-390.png' });

  await page.goto('/app/account/settings');
  await noOverflow(page);
  await expectTargets(page);
  await page.screenshot({ path: 'test-results/browser-shots/design-settings-light-390.png' });

  await page.goto('/app/account');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('اشتراک', { exact: true }).first()).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: 'test-results/browser-shots/design-account-light-390.png' });
});

test('capture: player playing state with progress fill', async ({ sub: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(READER);
  await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration ?? NaN));
  // Cycle the speed once (1 -> 1.25) to prove the control, then play.
  await page.locator('#player-speed').click();
  await expect(page.locator('#player-speed-label')).toHaveText('1.25×');
  await page.locator('#player-play').click();
  await expect.poll(() => page.evaluate(() => !document.querySelector<HTMLAudioElement>('#lesson-audio')?.paused)).toBe(true);
  await page.waitForTimeout(2500);
  await expect(page.locator('#player-play')).toHaveAccessibleName('توقف');
  // Open the console so the seek slider + transport are proven visible.
  await page.locator('#player-toggle').click();
  await expect(page.locator('#player-seek')).toBeVisible();
  const fill = await page.locator('#player-seek').evaluate((el) => el.style.getPropertyValue('--fe-seek-pct'));
  expect(parseFloat(fill)).toBeGreaterThan(0);
  await noOverflow(page);
  await page.screenshot({ path: 'test-results/browser-shots/design-playing-light-390.png' });
});

test('capture: library cards scrolled + landing regression', async ({ browser, sub: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  const firstCard = page.locator('.fe-card').first();
  await expect(firstCard.locator('.fe-card-media').first()).toBeVisible();
  await firstCard.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -8));
  await noOverflow(page);
  await page.screenshot({ path: 'test-results/browser-shots/design-library-cards-390.png' });

  // Landing shares tokens but keeps its own composition (out of scope):
  // it must still render without overflow or missing headings.
  const pub = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const pubPage = await pub.newPage();
  await pubPage.goto('/');
  await noOverflow(pubPage);
  await expect(pubPage.getByRole('heading').first()).toBeVisible();
  await pubPage.screenshot({ path: 'test-results/browser-shots/design-landing-390.png', fullPage: true });
  await pub.close();
});

test('account: active subscription shows renewal and the desktop rail stays compact', async ({ sub: page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/account');

  await expect(page.getByText(/اشتراک فعال تا/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'تمدید اشتراک' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'انتخاب پلن' })).toHaveCount(0);

  // The active desktop rail item is a normal 44px pill, not a stretched
  // grid cell (regression: it used to fill the whole column height).
  const activeRail = page.locator('aside a[aria-current="page"]');
  const box = await activeRail.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeLessThan(80);
  expect(box!.width).toBeGreaterThan(100);
  await page.screenshot({ path: 'test-results/browser-shots/account-active-1440.png' });

  // Landing is guest-only: a signed-in learner lands back in the app.
  await page.goto('/');
  await expect(page).toHaveURL(/\/app\/today$/);
});

test('keyboard, focus, reduced-motion, console health', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // Login entirely by keyboard: email -> password -> toggle -> submit.
  await page.goto('/login');
  await page.getByLabel('ایمیل', { exact: true }).click();
  await page.keyboard.press('Tab');
  await expect(page.locator('#password')).toBeFocused();
  const user = FRESH();
  await page.getByLabel('ایمیل', { exact: true }).fill(user.email);
  await page.getByLabel('رمز عبور', { exact: true }).fill(user.password);
  // Visible focus ring on the password field (3px primary, >=3:1).
  const outline = await page.locator('#password').evaluate((el) => ({
    w: getComputedStyle(el).outlineWidth,
    s: getComputedStyle(el).outlineStyle,
  }));
  expect(outline.s).toBe('solid');
  expect(parseFloat(outline.w)).toBeGreaterThanOrEqual(2);
  // Toggle by keyboard flips the input type and keeps the name.
  await page.locator('#password').press('Tab');
  await expect(page.getByRole('button', { name: 'نمایش رمز عبور' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#password')).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'پنهان کردن رمز عبور' })).toBeFocused();

  // Reduced motion: state transitions collapse to none.
  const dur = await page.locator('form button[type="submit"]').first().evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(dur === '0s' || dur === '0s, 0s' || dur === '').toBe(true);

  // Reader by keyboard: the play control works with no sentence-level
  // text interaction (same subscribed session as above — no second login).
  await page.goto(READER);
  await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration ?? NaN));
  await expect(page.locator('article.fe-english-body p').first()).toBeVisible();
  await expect(page.locator('.fe-sentence')).toHaveCount(0);
  const play = page.locator('#player-play');
  await play.focus();
  await expect(play).toBeFocused();
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => document.querySelector<HTMLAudioElement>('#lesson-audio')?.paused ?? true))
    .toBe(false);
  await page.keyboard.press('Enter');
  expect(errors).toEqual([]);
  await ctx.close();
});

test('capture: responsive sweep of the reader + library', async ({ sub: page }) => {
  for (const width of [360, 390, 430, 768, 1024, 1360]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(READER);
    await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration ?? NaN));
    await noOverflow(page);
    await page.screenshot({ path: `test-results/browser-shots/design-reader-light-${width}.png` });
    await page.goto('/app');
    await noOverflow(page);
    await page.screenshot({ path: `test-results/browser-shots/design-library-light-${width}.png` });
  }
});
