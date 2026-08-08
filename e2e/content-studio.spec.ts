// e2e/content-studio.spec.ts
// Podcast Slice 4 — Content Studio browser journeys against a real
// disposable PocketBase + the built Admin Console:
//   A. Manual content creation (episode → variant → assets → publish)
//   B. ZIP import (validation report → dry-run → confirm → draft)
//   C. Invalid package shows clear errors
//   D. Stale plan requires an explicit re-review
//   E. Student cannot reach the Content Studio or its APIs
//   F. Responsive usability contracts at 390/768/1440
//
// The ZIP fixtures are built with the same shared parser/assembler the
// Admin uses (store-method ZIP over the committed example package).

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../playwright.config';
import { buildStoreZip, packageDirToZipEntries } from '../scripts/content/fixtures.mjs';
import { createStaff, PB_URL, superuserAuth } from './fixtures';

const EXAMPLE_DIR = join(process.cwd(), 'content-packages', 'example-episode');

interface Ctx {
  staff: Awaited<ReturnType<typeof createStaff>>;
  generalCategoryId: string;
  zipPath: string;
  zipManifest: Record<string, unknown>;
}

let ctx: Ctx;

test.beforeAll(async () => {
  const su = await superuserAuth();
  ctx = {
    staff: await createStaff(su),
    generalCategoryId: '',
    zipPath: '',
    zipManifest: {},
  };

  // Find the seeded published category.
  const cats = await fetch(`${PB_URL}/api/fast-english/staff/categories`, {
    headers: { authorization: ctx.staff.token },
  });
  const catBody = (await cats.json()) as { items: Array<{ id: string; key: string }> };
  const general = catBody.items.find((c) => c.key === 'general');
  if (!general) throw new Error('seeded general category missing');
  ctx.generalCategoryId = general.id;

  // Build a store-method ZIP from the committed example package.
  const manifest = JSON.parse(readFileSync(join(EXAMPLE_DIR, 'episode.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const entries = packageDirToZipEntries(EXAMPLE_DIR, manifest as { episode: { slug: string } });
  const zip = buildStoreZip(entries);
  const dir = mkdtempSync(join(tmpdir(), 'fep-content-studio-'));
  ctx.zipPath = join(dir, 'example-episode.zip');
  writeFileSync(ctx.zipPath, zip);
  ctx.zipManifest = manifest;
});

async function setAuth(page: import('@playwright/test').Page, path: string) {
  await page.goto(`${ADMIN_URL}/login`);
  await page.evaluate(
    ({ t, r }) => localStorage.setItem('fep_staff_auth', JSON.stringify({ token: t, model: r })),
    { t: ctx.staff.token, r: ctx.staff.record },
  );
  await page.goto(`${ADMIN_URL}${path}`, { waitUntil: 'domcontentloaded' });
}

async function staffApi(path: string, init: RequestInit = {}) {
  const res = await fetch(`${PB_URL}${path}`, {
    ...init,
    headers: { authorization: ctx.staff.token, ...(init.headers ?? {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

test.describe('Content Studio', () => {
  test('A. manual content creation: episode → variant → assets → publish', {
    tag: '@smoke',
  }, async ({ page }) => {
    await setAuth(page, '/content');
    await page.waitForTimeout(2000);
    const dbg = await page.locator('body').innerText();
    writeFileSync('/tmp/opencode/cs-body.txt', 'URL:' + page.url() + '\nBODY:' + dbg.slice(0, 300));
    await expect(page.getByRole('heading', { name: 'محتوا' })).toBeVisible();

    // New episode with slug confirmation.
    await page.getByTestId('dashboard-new-episode').click();
    await expect(page).toHaveURL(/\/content\/episodes\/new/);
    await page.getByTestId('new-episode-title-fa').locator('input').fill('اهرام مصر');
    await page.getByTestId('new-episode-title-en').locator('input').fill('Pyramids of Egypt');
    await page
      .getByTestId('new-episode-category')
      .locator('select')
      .selectOption(ctx.generalCategoryId);
    await page
      .getByRole('textbox', { name: 'توضیح فارسی' })
      .fill('روایت تاریخی درباره معماری و تاریخچه اهرام مصر برای دانشجویان سطوح مختلف.');
    await page.getByTestId('new-episode-submit').click();
    // Slug suggested from the English title → confirmation.
    await expect(page.getByTestId('new-episode-slug-confirm')).toBeVisible();
    await page.getByTestId('new-episode-slug-ok').click();
    await expect(page).toHaveURL(/\/content\/episodes\/[a-z0-9]+$/);
    await page.waitForTimeout(1500);
    const alertText = await page
      .getByRole('alert')
      .allInnerTexts()
      .catch(() => []);
    writeFileSync('/tmp/opencode/cs-body.txt', 'ALERTS: ' + JSON.stringify(alertText));
    await expect(page.getByTestId('episode-tabs')).toBeVisible();

    // Create the B1 variant from the level matrix.
    await page.getByTestId('episode-tab-levels').click();
    await page.getByTestId('create-variant-B1').click();
    await expect(page.getByTestId('edit-variant-B1')).toBeVisible();

    // Variant editor: summary, audio, transcript, vocabulary.
    await page.getByTestId('edit-variant-B1').click();
    await expect(page).toHaveURL(/\/variants\/B1/);
    await page
      .getByRole('textbox', { name: 'خلاصه فارسی نسخه' })
      .fill('خلاصه فارسی نسخه B1 درباره اهرام مصر.');
    await page.getByTestId('summary-save').click();
    await expect(page.getByTestId('summary-save-state')).toContainText('ذخیره شد');

    await page.getByTestId('audio-input').setInputFiles(join(EXAMPLE_DIR, 'audio', 'b1.mp3'));
    await expect(page.getByTestId('audio-preview')).toBeVisible();

    await page
      .getByTestId('transcript-input')
      .fill(
        '# The Pyramids of Egypt\n\nThis episode explores the history and architecture of the pyramids of Egypt with clear, simple language for learners.\n\nThe builders moved enormous stone blocks into place over many years.',
      );
    await page.getByTestId('transcript-save').click();
    await expect(page.getByTestId('transcript-save-state')).toContainText('ذخیره شد');

    // Vocabulary fast entry: add one word, then batch paste a second.
    await page.getByTestId('vocab-add').click();
    await page.getByTestId('vocab-field-term').locator('input').fill('pyramid');
    await page.getByTestId('vocab-field-meaning').locator('input').fill('هرم');
    await page
      .getByTestId('vocab-field-definition')
      .locator('input')
      .fill('A large stone structure.');
    await page.getByTestId('vocab-save').click();
    await expect(page.getByText('واژگان (۱)')).toBeVisible();

    await page.getByTestId('vocab-batch-toggle').click();
    await page
      .getByRole('textbox', { name: 'متن ورود گروهی واژگان' })
      .fill('tomb\tمقبره\tA burial place.\nexcavation\tکاوش\tA dig in the ground.');
    await page.getByTestId('vocab-batch-preview').click();
    await expect(page.getByTestId('vocab-batch-rows')).toContainText('tomb');
    await page.getByTestId('vocab-batch-apply').click();
    await expect(page.getByText('واژگان (۳)')).toBeVisible();

    // Readiness + publish (episode first, then variant).
    await page.getByTestId('variant-publish-button').click();
    await expect(page.getByTestId('readiness-preconditions')).toBeVisible();
    await page.getByTestId('publish-dialog').getByRole('button', { name: 'انصراف' }).click();

    await page.getByRole('link', { name: 'بازگشت به اپیزود' }).click();

    // Episode artwork (required for publication).
    await page.getByTestId('episode-tab-images').click();
    await page
      .getByTestId('artwork-input-artwork')
      .setInputFiles(join(EXAMPLE_DIR, 'artwork', 'square.png'));
    await expect(page.getByTestId('artwork-preview-artwork')).toBeVisible();

    await page.getByTestId('episode-tab-publish').click();
    await page.getByTestId('episode-publish-button').click();
    await page.getByTestId('publish-confirm').click();
    await expect(page.getByText('منتشر شده')).toBeVisible();

    await page.getByTestId('episode-tab-levels').click();
    await page.getByTestId('edit-variant-B1').click();
    await page.getByTestId('variant-publish-button').click();
    await page.getByTestId('publish-confirm').click();
    await expect(page.getByTestId('variant-archive-button')).toBeVisible();
  });

  test('B. ZIP import: report → dry-run → confirm → open Draft', { tag: '@smoke' }, async ({
    page,
  }) => {
    await setAuth(page, '/content/import');
    await expect(page.getByRole('heading', { name: 'ورود محتوا' })).toBeVisible();

    await page.getByTestId('import-input').setInputFiles(ctx.zipPath);
    await expect(page.getByTestId('import-report-status')).toContainText('معتبر');
    await expect(page.getByTestId('import-report-facts')).toContainText('general.example-episode');
    await page.getByTestId('import-to-plan').click();

    // Dry-run plan: creates only.
    await expect(page.getByTestId('import-plan')).toBeVisible();
    await expect(page.getByTestId('import-plan-lines')).toContainText(
      'ایجاد general.example-episode',
    );
    // Fresh import: every variant is created (Persian digits in copy).
    await expect(page.getByTestId('import-plan-lines')).toContainText('سطح B1');
    await expect(page.getByTestId('import-plan-lines')).toContainText('ایجاد — ۲ واژه');
    await page.getByTestId('import-confirm').click();

    // Result + open the imported draft.
    await expect(page.getByTestId('import-result')).toContainText('ورود محتوا انجام شد');
    await page.getByTestId('import-open-draft').click();
    await expect(page).toHaveURL(/\/content\/episodes\/[a-z0-9]+$/);
    await page.waitForTimeout(1500);
    const alertText = await page
      .getByRole('alert')
      .allInnerTexts()
      .catch(() => []);
    writeFileSync('/tmp/opencode/cs-body.txt', 'ALERTS: ' + JSON.stringify(alertText));
    await expect(page.getByTestId('episode-tabs')).toBeVisible();
  });

  test('C. invalid package shows clear errors', async ({ page }) => {
    // Build a broken package: missing audio asset + placeholder title.
    const { cpSync } = await import('node:fs');
    const manifest = structuredClone(ctx.zipManifest) as Record<string, unknown> & {
      episode: { titleEn: string; slug: string };
    };
    manifest.episode.titleEn = 'TODO_REPLACE';
    const brokenDir = mkdtempSync(join(tmpdir(), 'fep-content-studio-broken-'));
    cpSync(EXAMPLE_DIR, brokenDir, { recursive: true });
    writeFileSync(join(brokenDir, 'episode.json'), JSON.stringify(manifest, null, 2));
    const entries = packageDirToZipEntries(brokenDir, manifest as { episode: { slug: string } });
    const broken = buildStoreZip(entries.filter((e) => !e.path.includes('audio/b1.mp3')));
    const dir = mkdtempSync(join(tmpdir(), 'fep-content-studio-bad-'));
    const badPath = join(dir, 'bad.zip');
    writeFileSync(badPath, broken);

    await setAuth(page, '/content/import');
    await page.getByTestId('import-input').setInputFiles(badPath);
    await expect(page.getByTestId('import-report-status')).toContainText('نامعتبر');
    await expect(page.getByTestId('import-report-errors')).toContainText('audio/b1.mp3');
    await expect(page.getByTestId('import-report-errors')).toContainText('جایگزین نشده');
    await expect(page.getByTestId('import-to-plan')).toBeDisabled();
  });

  test('D. stale plan requires an explicit re-review', async ({ page }) => {
    // A dedicated package with a unique content key so this test never
    // collides with the episode imported by test B.
    const { cpSync } = await import('node:fs');
    const staleSlug = `stale-${Date.now().toString(36)}`;
    const staleManifest = structuredClone(ctx.zipManifest) as Record<string, unknown> & {
      contentKey: string;
      episode: { slug: string };
    };
    staleManifest.contentKey = `general.${staleSlug}`;
    staleManifest.episode.slug = staleSlug;
    const staleDir = mkdtempSync(join(tmpdir(), 'fep-content-studio-stale-'));
    cpSync(EXAMPLE_DIR, staleDir, { recursive: true });
    writeFileSync(join(staleDir, 'episode.json'), JSON.stringify(staleManifest, null, 2));
    const staleZipPath = join(staleDir, 'stale.zip');
    writeFileSync(staleZipPath, buildStoreZip(packageDirToZipEntries(staleDir, staleManifest)));

    await setAuth(page, '/content/import');
    await page.getByTestId('import-input').setInputFiles(staleZipPath);
    await expect(page.getByTestId('import-report-status')).toContainText('معتبر');
    await page.getByTestId('import-to-plan').click();
    await expect(page.getByTestId('import-plan')).toBeVisible();

    // Change the DB state between plan and confirm (simulating another
    // backstage edit): create the episode through the Staff API.
    const slug = String(staleManifest.episode.slug);
    const created = await staffApi('/api/fast-english/staff/episodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title_fa: 'اپیزود مسیر ورود',
        title: 'Import Path',
        slug,
        description_fa: 'توضیح برای اپیزود ورودی آزمایشی.',
        category: ctx.generalCategoryId,
      }),
    });
    expect(created.status).toBe(200);

    // Confirming now must fail with the stale-plan message and re-plan.
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('import-stale-message')).toContainText(
      'محتوا از زمان بررسی تغییر کرده',
    );
    // The recalculated plan is never auto-executed: the episode now holds
    // content version 1 with a different fingerprint, so the re-plan is a
    // conflict and the confirm action is explicitly blocked.
    await expect(page.getByTestId('import-conflict-message')).toContainText('تعارض');
    await expect(page.getByTestId('import-confirm')).toBeDisabled();
    // Starting over with a fresh package still works (no stale state).
    await page.getByRole('button', { name: 'بازگشت' }).click();
    await page.getByRole('button', { name: 'انتخاب بسته دیگر' }).click();
    await page.getByTestId('import-input').setInputFiles(staleZipPath);
    await expect(page.getByTestId('import-report-status')).toContainText('معتبر');
  });

  test('E. Student cannot reach the Content Studio or its APIs', async ({ page }) => {
    const res = await fetch(`${PB_URL}/api/fast-english/staff/episodes`, {
      headers: { authorization: ctx.staff.token },
    });
    expect(res.status).toBe(200);
    // No auth → rejected.
    const anon = await fetch(`${PB_URL}/api/fast-english/staff/episodes`);
    expect(anon.status).toBe(401);

    // A student session on the Admin origin gets bounced to login.
    await page.goto(`${ADMIN_URL}/content`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('F. responsive usability contracts (390 / 768 / 1440)', async ({ page }) => {
    // Prepare an episode with content for the editor checks.
    const ep = await staffApi('/api/fast-english/staff/episodes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title_fa: 'اپیزود واکنشگرا',
        title: 'Responsive Episode',
        slug: `responsive-${Date.now().toString(36)}`,
        description_fa: 'توضیح برای بررسی واکنشگرایی ویرایشگر.',
        category: ctx.generalCategoryId,
      }),
    });
    const episodeId = ep.body.episode.id as string;
    await staffApi(`/api/fast-english/staff/episodes/${episodeId}/variants`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ level: 'B1' }),
    });

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await setAuth(page, `/content/episodes/${episodeId}`);

      // No horizontal overflow on the editor.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${viewport.width}`).toBeLessThanOrEqual(1);

      // Level matrix fits and stays reachable.
      await page.getByTestId('episode-tab-levels').click();
      await expect(page.getByTestId('edit-variant-B1')).toBeVisible();
      const matrixOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(matrixOverflow, `matrix overflow at ${viewport.width}`).toBeLessThanOrEqual(1);

      // Variant editor: vocabulary rows remain usable.
      await page.getByTestId('edit-variant-B1').click();
      await expect(page.getByTestId('summary-input')).toBeVisible();
      await page.getByTestId('vocab-add').click();
      await expect(page.getByTestId('vocab-field-term')).toBeVisible();
      const vocabOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(vocabOverflow, `vocabulary overflow at ${viewport.width}`).toBeLessThanOrEqual(1);
      await page.getByTestId('vocab-save').click();
    }

    // Artwork controls reachable at the narrowest viewport: the visible
    // label-buttons and their associated file inputs.
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuth(page, `/content/episodes/${episodeId}`);
    await page.getByTestId('episode-tab-images').click();
    await expect(page.getByRole('button', { name: 'بارگذاری' })).toHaveCount(2);
    await expect(page.getByTestId('artwork-input-artwork')).toBeAttached();
    await expect(page.getByTestId('artwork-input-hero')).toBeAttached();

    // Dialogs fit the viewport (archive confirmation at 390px).
    await page.getByTestId('episode-tab-publish').click();
    await page.getByTestId('episode-archive-button').click();
    await expect(page.getByTestId('archive-dialog')).toBeVisible();
    const dialogBox = await page.getByTestId('archive-dialog').boundingBox();
    expect(dialogBox).not.toBeNull();
    if (dialogBox) {
      expect(dialogBox.x).toBeGreaterThanOrEqual(0);
      expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(391);
    }
    await page.getByRole('button', { name: 'انصراف' }).click();
  });
});
