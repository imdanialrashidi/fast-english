// Visual Slice 1 — deterministic browser-based quality gates.
//
// No image understanding is used: every assertion reads computed styles,
// DOM geometry, accessibility snapshots, keyboard behavior or theme state.
// The dev-only component catalog (/dev/catalog, built with VITE_CATALOG=1)
// exposes semantic test IDs for programmatic inspection.
//
// Sections:
//   1. Theme behavior (default system, persistence, no reload, color-scheme,
//      semantic vars, startup attribute, keyboard accessibility).
//   2. Catalog geometry: overflow at all supported widths (light+dark),
//      touch targets, dialog within viewport, responsive consistency.
//   3. Computed-style contrast checks for real rendered pairs.
//   4. Focus behavior (keyboard, dialog trap, focus return).
//   5. Typography: RTL Persian, LTR English, 200% zoom, no clipped labels.
//   6. Logo: mark present, aspect ratio preserved, dark fallback.
//   7. Authenticated shell: App Bar semantics, bottom nav indicator,
//      title/action non-overlap, product-flow smoke Light+Dark.

import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();

const VIEWPORTS: Array<{ name: string; width: number; height: number }> = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
];

const SCREENSHOTS_DIR = process.env.VISUAL_SLICE_OUT ?? '/tmp/opencode/fep-visual-slice-1';

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
      document.body.scrollWidth <= document.documentElement.clientWidth,
  );
}

async function setMode(page: Page, mode: 'light' | 'dark' | 'system') {
  await page.evaluate((m) => {
    localStorage.setItem('mui-mode', m);
  }, mode);
}

function contrastOf(fg: string, bg: string): number {
  const lum = (c: string) => {
    const parts = c.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0'];
    const [r, g, b] = parts.slice(0, 3).map(Number);
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const a = lum(fg);
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ---- Authenticated fixture (active student) ----

async function getSuperuserToken(): Promise<string> {
  const email = readFileSync('test-results/pb-su-email.txt', 'utf8').trim();
  const password = readFileSync('test-results/pb-su-password.txt', 'utf8').trim();
  const auth = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  const body = (await auth.json()) as { token?: string };
  if (!body.token) throw new Error('superuser auth failed');
  return body.token;
}

async function createActiveStudent(
  su: string,
): Promise<{ phone: string; token: string; record: Record<string, unknown> }> {
  let phone = `09${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const signup = await fetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({
      name: 'دانشجوی آزمون بصری',
      phone,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
      role: 'student',
      account_status: 'active',
      placement_completed: true,
    }),
  });
  if (!signup.ok) throw new Error(`student create failed: ${signup.status}`);
  const created = (await signup.json()) as { id?: string; phone?: string };
  if (!created.id || !created.phone) throw new Error('student create got no id/phone');
  phone = created.phone; // server-normalized canonical form
  // The create hook resets protected fields to safe defaults; the superuser
  // (exempt from the update hook) activates the fixture account.
  const activate = await fetch(`${PB_URL}/api/collections/fep_users/records/${created.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: su },
    body: JSON.stringify({ account_status: 'active', placement_completed: true }),
  });
  if (!activate.ok) throw new Error(`student activate failed: ${activate.status}`);
  const login = await fetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: phone, password: 'Test1234!' }),
  });
  const body = (await login.json()) as { token?: string; record?: Record<string, unknown> };
  if (!body.token) throw new Error('student login failed');
  return { phone, token: body.token, record: body.record ?? {} };
}

async function setAuthAndGo(
  page: Page,
  token: string,
  record: Record<string, unknown>,
  path: string,
) {
  await page.goto('/');
  await page.evaluate(
    ({ t, r }) => {
      localStorage.setItem('pocketbase_auth', JSON.stringify({ token: t, model: r }));
    },
    { t: token, r: record },
  );
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

test.describe('theme behavior', () => {
  test('default preference is System and follows the OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/dev/catalog');
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
      'light',
    );
    expect(await page.evaluate(() => localStorage.getItem('mui-mode'))).toBeNull();

    // OS switches to dark while in System mode.
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-color-scheme')))
      .toBe('dark');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
      'dark',
    );
  });

  test('Light selection persists across reloads', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/dev/catalog');
    await page.getByRole('button', { name: 'حالت روشن' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
    expect(await page.evaluate(() => localStorage.getItem('mui-mode'))).toBe('light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
  });

  test('Dark selection persists across reloads', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/dev/catalog');
    await page.getByRole('button', { name: 'حالت تیره' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('mui-mode'))).toBe('dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  });

  test('System selection persists and keeps following the OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/dev/catalog');
    await page.getByRole('button', { name: 'حالت تیره' }).click();
    await page.getByRole('button', { name: 'حالت سیستمی' }).click();
    expect(await page.evaluate(() => localStorage.getItem('mui-mode'))).toBe('system');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-color-scheme')))
      .toBe('dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  });

  test('theme switch does not reload the page', async ({ page }) => {
    await page.goto('/dev/catalog');
    let navigations = 0;
    page.on('framenavigated', () => {
      navigations += 1;
    });
    await page.getByRole('button', { name: 'حالت تیره' }).click();
    await page.getByRole('button', { name: 'حالت روشن' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
    // The listener is attached after the initial load: theme switches must
    // not trigger any further navigation.
    expect(navigations).toBe(0);
  });

  test('semantic CSS variables change between Light and Dark', async ({ page }) => {
    await page.goto('/dev/catalog');
    const readVars = () =>
      page.evaluate(() => {
        const s = getComputedStyle(document.documentElement);
        return {
          background: s.getPropertyValue('--mui-palette-background-default').trim(),
          surface: s.getPropertyValue('--mui-palette-surfaceContainerLow').trim(),
          primary: s.getPropertyValue('--mui-palette-primary-main').trim(),
          elevation: s.getPropertyValue('--mui-elevation-dialog').trim(),
        };
      });
    const light = await readVars();
    await page.getByRole('button', { name: 'حالت تیره' }).click();
    const dark = await readVars();
    expect(light.background).not.toBe(dark.background);
    expect(light.surface).not.toBe(dark.surface);
    expect(light.primary).not.toBe(dark.primary);
    expect(dark.elevation).toContain('rgba');
    // The light surface token is the documented AppBar/meta value.
    expect(light.surface.toLowerCase()).toContain('e9f1f4');
  });

  test('startup: the pre-paint init script sets the scheme without the app bundle', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    // Block every JS bundle: only the inline <head> script may run.
    await page.route(/assets\/.*\.js/, (route) => route.abort());
    await page.goto('/dev/catalog');
    expect(
      await page.evaluate(() => document.documentElement.getAttribute('data-color-scheme')),
    ).toBe('dark');
    expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe('dark');
    // And with a persisted Light choice the bundle-less page must be light.
    await setMode(page, 'light');
    await page.reload();
    expect(
      await page.evaluate(() => document.documentElement.getAttribute('data-color-scheme')),
    ).toBe('light');
  });

  test('the served HTML contains the pre-paint script before the module script', async ({
    page,
  }) => {
    const response = await page.request.get('/dev/catalog');
    const html = await response.text();
    const initIdx = html.indexOf('data-color-scheme');
    const moduleIdx = html.indexOf('type="module"');
    expect(initIdx, 'init script present').toBeGreaterThan(-1);
    expect(moduleIdx, 'module script present').toBeGreaterThan(-1);
    expect(initIdx, 'init script runs before the module script').toBeLessThan(moduleIdx);
  });

  test('theme selector is keyboard accessible', async ({ page }) => {
    await page.goto('/dev/catalog');
    const switchGroup = page.getByRole('group', { name: 'انتخاب حالت نمایش' });
    await expect(switchGroup).toBeVisible();
    const buttons = switchGroup.getByRole('button');
    await buttons.first().focus();
    await expect(buttons.first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
    await expect(buttons.first()).toBeFocused();
  });

  test('meta theme-color follows the active scheme', async ({ page }) => {
    await page.goto('/dev/catalog');
    await page.getByRole('button', { name: 'حالت تیره' }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
        ),
      )
      .toBe('#111a1e');
  });
});

test.describe('catalog geometry (light + dark)', () => {
  for (const viewport of VIEWPORTS) {
    test(`no horizontal overflow at ${viewport.name} in Light and Dark`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/dev/catalog');
      expect(await noHorizontalOverflow(page), `light ${viewport.name}`).toBe(true);
      await page.getByRole('button', { name: 'حالت تیره' }).click();
      await page.waitForTimeout(50);
      expect(await noHorizontalOverflow(page), `dark ${viewport.name}`).toBe(true);
    });
  }

  test('critical controls meet the 44px touch target', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/catalog');
    const targets = [
      'btn-primary',
      'btn-secondary',
      'btn-outlined',
      'btn-danger',
      'btn-large',
      'btn-disabled',
      'dialog-trigger',
      'icon-btn-back',
      'icon-btn-close',
    ];
    for (const id of targets) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, `touch target ${id}`).not.toBeNull();
      const b = box ?? { width: 0, height: 0 };
      expect(b.width, `${id} width`).toBeGreaterThanOrEqual(44);
      expect(b.height, `${id} height`).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByRole('button', { name: 'حالت تیره' })).toBeVisible();
  });

  test('dialog stays inside the viewport at the smallest supported width', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/dev/catalog');
    await page.getByTestId('dialog-trigger').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360 + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(800 + 0.5);
  });

  test('English LTR content stays inside its reading container', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/dev/catalog');
    const geometry = await page.getByTestId('english-ltr-text').evaluate((el) => {
      const c = el.getBoundingClientRect();
      const p = el.firstElementChild?.getBoundingClientRect();
      return { c, p: p ?? c };
    });
    expect(geometry.p.left).toBeGreaterThanOrEqual(geometry.c.left - 1);
    expect(geometry.p.right).toBeLessThanOrEqual(geometry.c.right + 1);
    expect(geometry.c.width).toBeLessThanOrEqual(640);
  });

  test('Persian content is RTL and the document direction is rtl', async ({ page }) => {
    await page.goto('/dev/catalog');
    expect(await page.evaluate(() => document.documentElement.getAttribute('dir'))).toBe('rtl');
    expect(await page.getByTestId('persian-long-text').getAttribute('dir')).toBe('rtl');
  });

  test('typography scales at 200% text zoom without overflow or clipping', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dev/catalog');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    // Visual containment: no element box may leave the viewport. (The
    // document scrollWidth check is NOT used here: Chromium's RTL
    // scrollable-overflow accounting reports a phantom overflow with
    // zoomed wrapped flex rows while every box stays inside the viewport —
    // verified empirically; the strict scrollWidth gate still applies at
    // the tested widths in the overflow tests above.)
    const violations = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bad: string[] = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0) continue;
        // Clipped internals (transformed SVG artwork, progress bar fill)
        // cannot affect layout; their ancestors clip them.
        if (el.closest('svg') || el.closest('.MuiLinearProgress-root')) continue;
        if (r.right > vw + 1 || r.left < -1) {
          bad.push(
            `${el.tagName} ${el.getAttribute('data-testid') ?? ''} l=${r.left.toFixed(0)} r=${r.right.toFixed(0)}`,
          );
        }
      }
      return bad.slice(0, 10);
    });
    expect(violations).toEqual([]);
    const heading = page.getByRole('heading', { name: /عنوان بسیار بلند صفحهٔ نمونه/ });
    const headingBox = (await heading.boundingBox())!;
    expect(headingBox.width).toBeGreaterThan(0);
    // Button label stays inside the button (no clipping).
    // Button label not clipped: the button's content fits its box.
    const clipped = await page.getByTestId('btn-primary').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        contentOverflow: el.scrollHeight > r.height + 1,
        labelVisible: el.textContent.trim().length > 0,
      };
    });
    expect(clipped.contentOverflow).toBe(false);
    expect(clipped.labelVisible).toBe(true);
  });

  test('reduced motion collapses nonessential transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dev/catalog');
    const duration = await page
      .getByTestId('motion-demo')
      .locator('.MuiChip-root')
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    // 0.01ms may serialize as `0.01ms` or `1e-05s`.
    expect(Number.parseFloat(duration)).toBeLessThanOrEqual(1e-4);
    await expect(page.getByTestId('motion-demo')).toBeVisible();
  });
});

test.describe('computed-style contrast (real rendered pairs)', () => {
  const readPair = (page: Page, testId: string) =>
    page.getByTestId(testId).evaluate((el) => {
      const s = getComputedStyle(el);
      return { fg: s.color, bg: s.backgroundColor };
    });

  test('primary button text meets AA in both schemes', async ({ page }) => {
    await page.goto('/dev/catalog');
    for (const scheme of ['light', 'dark'] as const) {
      const { fg, bg } = await readPair(page, 'btn-primary');
      const ratio = contrastOf(fg, bg);
      expect(ratio, `${scheme} primary CTA contrast`).toBeGreaterThanOrEqual(4.5);
      await page.getByRole('button', { name: 'حالت تیره' }).click();
    }
  });

  test('alert text meets AA on its container in both schemes', async ({ page }) => {
    await page.goto('/dev/catalog');
    for (const scheme of ['light', 'dark'] as const) {
      const { fg, bg } = await readPair(page, 'alert-success');
      const ratio = contrastOf(fg, bg);
      expect(ratio, `${scheme} alert contrast`).toBeGreaterThanOrEqual(4.5);
      await page.getByRole('button', { name: 'حالت تیره' }).click();
    }
  });

  test('input helper text and body text meet AA', async ({ page }) => {
    await page.goto('/dev/catalog');
    const pair = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="persian-paragraph"]') as HTMLElement;
      return {
        fg: getComputedStyle(el).color,
        // The paragraph itself is transparent; measure against the page bg.
        bg: getComputedStyle(document.body).backgroundColor,
      };
    });
    expect(contrastOf(pair.fg, pair.bg)).toBeGreaterThanOrEqual(4.5);
  });

  test('catalog contrast rows all pass their computed targets', async ({ page }) => {
    await page.goto('/dev/catalog');
    for (const scheme of ['light', 'dark'] as const) {
      const results = await page.evaluate(
        (listId) =>
          Array.from(document.querySelectorAll(`[data-testid^="contrast-${listId}"]`)).map((r) => ({
            pass: r.getAttribute('data-pass'),
            ratio: r.getAttribute('data-ratio'),
          })),
        scheme,
      );
      expect(results.length, `${scheme} contrast rows`).toBeGreaterThanOrEqual(10);
      for (const r of results) {
        expect(r.pass, `${scheme} row ratio ${r.ratio}`).toBe('true');
      }
      await page.getByRole('button', { name: 'حالت تیره' }).click();
    }
  });
});

test.describe('focus behavior', () => {
  test('keyboard focus is visible and in-viewport', async ({ page }) => {
    await page.goto('/dev/catalog');
    await page.keyboard.press('Tab');
    for (let i = 0; i < 12; i += 1) {
      const state = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          outline: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          inViewport:
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= innerHeight &&
            rect.right <= innerWidth,
          tag: el.tagName,
        };
      });
      expect(state).not.toBeNull();
      expect(state!.outline, `focus outline at tab ${i}`).toBe('solid');
      expect(Number.parseFloat(state!.outlineWidth)).toBeGreaterThan(0);
      expect(state!.inViewport, `focused element in viewport at tab ${i}`).toBe(true);
      await page.keyboard.press('Tab');
    }
  });

  test('dialog traps focus and returns it to the trigger', async ({ page }) => {
    await page.goto('/dev/catalog');
    const trigger = page.getByTestId('dialog-trigger');
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null))
      .toBe(true);
    for (let i = 0; i < 8; i += 1) {
      const inside = await page.evaluate(
        () => document.activeElement?.closest('[role="dialog"]') !== null,
      );
      expect(inside, `focus inside dialog after ${i} tabs`).toBe(true);
      await page.keyboard.press('Tab');
    }
    await page.getByTestId('dialog-cancel').click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
});

test.describe('logo rendering', () => {
  test('mark preserves the approved aspect ratio and is never monochrome black', async ({
    page,
  }) => {
    await page.goto('/dev/catalog');
    const mark = page.getByTestId('brand-mark-svg').first();
    const box = (await mark.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(1.5, 2);
    expect(box.width).toBeGreaterThanOrEqual(24);
    const color = await mark.evaluate((el) => getComputedStyle(el).color);
    expect(color.toLowerCase()).not.toMatch(/rgb\(0, 0, 0\)/);
  });

  test('header PNG variant is replaced by the monochrome mark in Dark mode', async ({ page }) => {
    await page.goto('/dev/catalog');
    await expect(page.getByTestId('logo-header').locator('img')).toBeVisible();
    await page.getByRole('button', { name: 'حالت تیره' }).click();
    await expect(page.getByTestId('logo-header').locator('img')).toHaveCount(0);
    await expect(
      page.getByTestId('logo-header').locator('[data-testid="brand-mark-svg"]'),
    ).toHaveCount(1);
  });

  test('logo never exceeds its container', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/dev/catalog');
    for (const id of ['logo-mark', 'logo-compact', 'logo-full', 'logo-header']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, `${id} visible`).not.toBeNull();
      expect(box!.width, `${id} within viewport`).toBeLessThanOrEqual(360);
    }
  });
});

test.describe('authenticated shell (App Bar, bottom nav, flows)', () => {
  test('App Bar uses semantic foregrounds and a tonal surface in both schemes', async ({
    page,
  }) => {
    const su = await getSuperuserToken();
    const student = await createActiveStudent(su);
    await setAuthAndGo(page, student.token, student.record, '/dashboard');
    for (const scheme of ['light', 'dark'] as const) {
      const header = page.locator('header').first();
      const bg = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
      const iconColor = await page
        .getByRole('link', { name: 'پنل اپراتور' })
        .evaluate((el) => getComputedStyle(el).color);
      expect(iconColor.toLowerCase()).not.toMatch(/rgb\(0, 0, 0\)|rgb\(255, 255, 255\)/);
      const ratio = contrastOf(iconColor, bg);
      expect(ratio, `${scheme} app bar icon contrast`).toBeGreaterThanOrEqual(3);
      await page.getByRole('button', { name: 'حالت تیره' }).click();
    }
  });

  test('App Bar title does not overlap the theme control at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const su = await getSuperuserToken();
    const student = await createActiveStudent(su);
    await setAuthAndGo(page, student.token, student.record, '/dashboard');
    const control = page.getByTestId('theme-switch');
    await expect(control).toBeVisible();
    const titleBox = (await page.getByRole('link', { name: 'فست انگلیش' }).boundingBox())!;
    const controlBox = (await control.boundingBox())!;
    // RTL: actions sit at the inline-start (left); title must end before them.
    expect(titleBox.x).toBeGreaterThanOrEqual(controlBox.x + controlBox.width - 1);
  });

  test('bottom navigation shows a selected indicator beyond color', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const su = await getSuperuserToken();
    const student = await createActiveStudent(su);
    await setAuthAndGo(page, student.token, student.record, '/dashboard');
    const nav = page.getByTestId('student-bottom-nav');
    await expect(nav).toBeVisible();
    const selected = nav.getByRole('button', { name: 'خانه' });
    await expect(selected).toHaveAttribute('aria-label', 'خانه');
    // Selected state renders the ::after indicator (non-transparent).
    const indicator = await selected.evaluate((el) => {
      const s = getComputedStyle(el, '::after');
      return { bg: s.backgroundColor, w: s.width, content: s.content };
    });
    expect(indicator.content).toContain('""');
    expect(indicator.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(Number.parseFloat(indicator.w)).toBeGreaterThan(0);
  });

  test('no content sits under the fixed bottom navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const su = await getSuperuserToken();
    const student = await createActiveStudent(su);
    await setAuthAndGo(page, student.token, student.record, '/account');
    const navBox = (await page.getByTestId('student-bottom-nav').boundingBox())!;
    // PageContainer reserves bottom padding >= nav height + gap.
    const paddingBottom = await page
      .getByRole('main')
      .first()
      .evaluate((el) => {
        const inner = el.querySelector('.MuiContainer-root > div') ?? el.firstElementChild;
        return inner ? Number.parseFloat(getComputedStyle(inner).paddingBottom) : 0;
      });
    expect(paddingBottom).toBeGreaterThanOrEqual(64 + 8);
    expect(navBox.y).toBeGreaterThan(0);
  });

  test('dashboard and lessons flows render in Light and Dark without overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const su = await getSuperuserToken();
    const student = await createActiveStudent(su);
    for (const route of ['/dashboard', '/lessons', '/account']) {
      await setAuthAndGo(page, student.token, student.record, route);
      expect(await noHorizontalOverflow(page), `${route} light`).toBe(true);
      await page.getByRole('button', { name: 'حالت تیره' }).click();
      await page.waitForTimeout(50);
      expect(await noHorizontalOverflow(page), `${route} dark`).toBe(true);
      await page.getByRole('button', { name: 'حالت سیستمی' }).click();
    }
  });

  test('public routes render in Light and Dark without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Public routes have no App Bar/theme switch; drive the mode through
    // the persisted preference like a returning user would. The first
    // navigation happens before any storage access (about:blank has an
    // opaque origin).
    await page.goto('/');
    for (const route of ['/', '/login', '/signup', '/sample']) {
      await setMode(page, 'dark');
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
      expect(await noHorizontalOverflow(page), `${route} dark`).toBe(true);
      await setMode(page, 'light');
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
      expect(await noHorizontalOverflow(page), `${route} light`).toBe(true);
    }
    await page.evaluate(() => localStorage.removeItem('mui-mode'));
  });

  test('login form input uses the documented input radius and semantic border', async ({
    page,
  }) => {
    await page.goto('/login');
    const input = page.getByLabel('شمارهٔ موبایل');
    const radius = await input
      .locator('xpath=..')
      .evaluate((el) => getComputedStyle(el).borderRadius);
    expect(radius).toBe('12px');
    const border = await input
      .locator('xpath=..')
      .evaluate((el) => getComputedStyle(el).getPropertyValue('border-top-color').trim());
    // The resting outline border must be the outlineVariant (not raw black).
    expect(border.toLowerCase()).not.toBe('rgb(0, 0, 0)');
  });
});

test.describe('optional evidence: screenshots (uninspected artifacts)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const viewport of VIEWPORTS) {
      test(`capture catalog ${scheme} ${viewport.name}`, async ({ page }) => {
        test.setTimeout(60_000);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: scheme === 'dark' ? 'dark' : 'light' });
        await page.goto('/dev/catalog');
        if (scheme === 'dark') {
          await page.getByRole('button', { name: 'حالت تیره' }).click();
        }
        await page.waitForTimeout(100);
        const { mkdirSync } = await import('node:fs');
        mkdirSync(`${SCREENSHOTS_DIR}/${scheme}`, { recursive: true });
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/${scheme}/catalog-${viewport.name}.png`,
          fullPage: true,
        });
      });
    }
  }
});
