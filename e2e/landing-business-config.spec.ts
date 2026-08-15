// e2e/landing-business-config.spec.ts
// Business Configuration slice — real-browser proof that the static
// Landing consumes the runtime public business settings:
//   - real plan prices render from the canonical `plans` collection
//     (seeded through the same payload the production seed tool writes);
//   - unset support contact renders the honest "not announced" state;
//   - a configured support contact renders as the canonical link on both
//     /contact and /collaboration;
//   - the iOS install CTA reaches /install#ios; no App Store/direct-install
//     claim exists.
//
// The landing preview server proxies /api to the disposable PocketBase
// (playwright.config.ts), so this exercises the same runtime path as
// production Caddy.

import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { LANDING_URL_E2E } from '../playwright.config';
import { superuserAuth } from './fixtures';

const LANDING = LANDING_URL_E2E;
const OWNED_PLAN_PREFIX = 'E2E Landing Plan';

test.describe
  .serial('landing runtime business settings', () => {
    test.use({ baseURL: LANDING });

    let suToken: string;
    let planSlug = '';

    test.beforeAll(async () => {
      suToken = await superuserAuth();
      // Seed one owned plan with a deterministic price (same shape the
      // production seed tool writes).
      const res = await fetch(
        `http://127.0.0.1:${Number(process.env.PB_E2E_PORT ?? 18101)}/api/collections/plans/records`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: suToken },
          body: JSON.stringify({
            name: `${OWNED_PLAN_PREFIX} ${randomBytes(3).toString('hex')}`,
            slug: `e2e-landing-${randomBytes(3).toString('hex')}`,
            duration_days: 30,
            price_toman: 299000,
            is_active: true,
            display_order: 99,
          }),
        },
      );
      const body = (await res.json()) as { id?: string; slug?: string };
      if (!body.id || !body.slug) throw new Error('landing plan seeding failed');
      planSlug = body.slug;
    });

    test('prices render from the public settings endpoint (no hard-coded copy)', async ({
      page,
      request,
    }) => {
      await page.goto('/');
      const card = page.getByTestId(`plan-card-${planSlug}`).first();
      // The seeded plan card carries its real price in Persian digits — served
      // at RUNTIME from the public settings endpoint.
      await expect(card).toContainText('۲۹۹٬۰۰۰');
      // The raw prerendered HTML must NOT contain the price: it is never baked
      // into the static build (single source of truth = the plans collection).
      const raw = await request.get('/');
      expect(await raw.text()).not.toContain('۲۹۹٬۰۰۰');
    });

    test('support contact is honestly unset before configuration', async ({ page }) => {
      // No site_settings record exists in the shared disposable PB yet.
      await page.goto('/contact');
      await expect(page.getByTestId('support-unavailable').first()).toBeVisible();
      await expect(page.getByText('هنوز اعلام نشده است')).toBeVisible();
    });

    test('configured support contact renders on /contact and /collaboration', async ({ page }) => {
      // Configure the canonical contact through the same collection the
      // Admin Business Settings surface writes to.
      await fetch(
        `http://127.0.0.1:${Number(process.env.PB_E2E_PORT ?? 18101)}/api/collections/site_settings/records`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: suToken },
          body: JSON.stringify({ support_contact: 'https://t.me/fep-e2e' }),
        },
      );
      await page.goto('/contact');
      const link = page.getByTestId('support-link').first();
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', 'https://t.me/fep-e2e');
      await expect(link).toHaveAttribute('target', '_blank');

      await page.goto('/collaboration');
      const collab = page.getByTestId('support-link').first();
      await expect(collab).toBeVisible();
      await expect(collab).toHaveAttribute('href', 'https://t.me/fep-e2e');
    });

    test('iOS install CTA reaches the anchored Safari guide', async ({ page }) => {
      // Home section CTA.
      await page.goto('/');
      const homeCta = page.locator('a[href="/install#ios"]').first();
      await expect(homeCta).toBeVisible();
      await expect(homeCta).toContainText('نصب روی iPhone / iPad');

      // The install page has the anchored iOS section with the honest flow.
      await page.goto('/install#ios');
      await expect(page.getByRole('heading', { name: 'نصب روی iPhone / iPad' })).toBeVisible();
      // Scoped to the iOS section (the PWA bullet also mentions the phrase).
      await expect(page.locator('#ios')).toContainText('Add to Home Screen');
      await expect(page.locator('#ios')).toContainText('Open as Web App');
      // Honest: no App Store app and no direct-install claim.
      await expect(page.getByText('فروشگاه اپل وجود ندارد')).toBeVisible();
      expect(
        await page.locator('a[href*="apps.apple.com"], a[href*="itunes.apple.com"]').count(),
      ).toBe(0);
    });
  });
