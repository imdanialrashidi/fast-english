#!/usr/bin/env node
// scripts/smoke-content-admin.mjs — Podcast Slice 4 Staff Content Studio smoke.
//
// Runs against a disposable PocketBase (wired via `pnpm smoke:content-admin`
// → scripts/smoke-placement.sh on port 18097). Proves the 28 scenarios
// required by the slice brief (§38). Every record is disposable and owned
// (randomized slugs/content keys); every request carries a timeout.
//
// The import scenarios reuse the existing Slice 3 plan/execute routes and
// additionally prove the browser ZIP ingestion path: a store-method ZIP is
// built from the fixture package and parsed with the same shared modules
// the Admin UI uses (shared/content-package/zip.ts + zipPackage.ts).

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseZip } from '../shared/content-package/zip.ts';
import { assemblePackageFromZip } from '../shared/content-package/zipPackage.ts';
import {
  buildStoreZip,
  makeMp3,
  makePng,
  packageDirToZipEntries,
  writeFixturePackage,
} from './content/fixtures.mjs';
import {
  fetchJson,
  getLegacyOperatorToken,
  getSuperuserToken,
  login,
  nextPhone,
  randomId,
  staffLogin,
} from './smoke-common.mjs';

const URL = process.env.PB_SMOKE_URL;

let total = 0;
let passed = 0;
let failed = 0;
async function scenario(name, fn) {
  total++;
  const label = `  ${String(total).padStart(2, '0')}. ${name}`;
  try {
    await fn();
    passed++;
    console.log(`PASS ${label}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${label}`);
    console.log(`       ${err?.message ? err.message : String(err)}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message || 'assertion failed');
}

function multipart(parts) {
  const boundary = `----FepSmoke${randomId()}`;
  const chunks = [];
  for (const p of parts) {
    if (typeof p === 'string') {
      chunks.push(Buffer.from(p));
    } else {
      chunks.push(p);
    }
  }
  return { boundary, body: Buffer.concat(chunks) };
}

async function staffJson(path, init = {}) {
  const r = await fetchJson(URL, path, init);
  return r;
}

let suToken;
let staffToken;
let studentToken;

async function main() {
  const su = await getSuperuserToken(URL);
  suToken = su;

  // Staff + student fixtures (owned, unique).
  const staffEmail = `content-admin-${randomId()}@fep-smoke.invalid`;
  const staffPassword = 'Test1234!';
  const s = await fetchJson(URL, '/api/collections/staff_admins/records', {
    method: 'POST',
    headers: { authorization: su },
    body: JSON.stringify({
      email: staffEmail,
      password: staffPassword,
      passwordConfirm: staffPassword,
      display_name: 'Content Smoke',
      is_active: true,
      verified: true,
    }),
  });
  assert(s.body?.id, `staff create failed: ${JSON.stringify(s.body)}`);
  staffToken = await staffLogin(URL, staffEmail, staffPassword);

  const phone = nextPhone();
  const signup = await fetchJson(URL, '/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({ name: 'S', phone, password: 'Test1234!', passwordConfirm: 'Test1234!' }),
  });
  assert(signup.body?.id, `student signup failed: ${JSON.stringify(signup.body)}`);
  studentToken = await login(URL, signup.body.phone, 'Test1234!');
  const studentUserId = signup.body.id;

  // Shared mutable state across scenarios.
  const state = {
    categoryId: '',
    categorySlug: '',
    episodeId: '',
    episodeKey: '',
    variantId: '',
    importedEpisodeId: '',
    importedKey: '',
  };

  // ------------------------------------------------------------------
  // 1–5: Categories
  // ------------------------------------------------------------------

  await scenario('Staff lists Categories', async () => {
    const r = await staffJson('/api/fast-english/staff/categories', {
      headers: { authorization: staffToken },
    });
    assert(r.status === 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(Array.isArray(r.body.items), 'items array missing');
    assert(
      r.body.items.some((c) => c.key === 'general'),
      'seeded general category missing',
    );
    const general = r.body.items.find((c) => c.key === 'general');
    assert(
      general.episodeCounts && typeof general.episodeCounts.total === 'number',
      'episode counts missing',
    );
  });

  await scenario('Student cannot use Content Admin routes', async () => {
    const r = await staffJson('/api/fast-english/staff/categories', {
      headers: { authorization: studentToken },
    });
    assert(r.status === 403, `expected 403 got ${r.status}`);
    assert(r.body.code === 'staff_access_denied', `wrong code ${r.body.code}`);
  });

  await scenario('Create Draft Category', async () => {
    const slug = `cat-${randomId()}`;
    const r = await staffJson('/api/fast-english/staff/categories', {
      method: 'POST',
      headers: { authorization: staffToken },
      body: JSON.stringify({
        title_fa: 'دسته آزمایشی',
        title_en: 'Test Category',
        slug,
        description_fa: 'توضیح دسته آزمایشی برای اسموک.',
      }),
    });
    assert(r.status === 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.category.publicationStatus === 'draft', 'must be draft');
    assert(r.body.category.key === slug, 'key must equal slug');
    state.categoryId = r.body.category.id;
    state.categorySlug = slug;
  });

  await scenario('Edit Category', async () => {
    const r = await staffJson(`/api/fast-english/staff/categories/${state.categoryId}`, {
      method: 'PATCH',
      headers: { authorization: staffToken },
      body: JSON.stringify({ title_fa: 'دسته آزمایشی ویرایششده' }),
    });
    assert(r.status === 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.category.titleFa === 'دسته آزمایشی ویرایششده', 'title not updated');
    assert(r.body.category.key === state.categorySlug, 'key must stay stable on edit');
  });

  await scenario('Publish valid Category', async () => {
    // The DB schema requires the publish-critical fields at create time
    // (description_fa is a required text field), so a valid Category is
    // publishable directly; the publish route re-checks invariants.
    const r = await staffJson(`/api/fast-english/staff/categories/${state.categoryId}/publish`, {
      method: 'POST',
      headers: { authorization: staffToken },
    });
    assert(r.status === 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.category.publicationStatus === 'published', 'must be published');
  });

  // ------------------------------------------------------------------
  // 6–13: Episode + Variant content
  // ------------------------------------------------------------------

  await scenario('Create Draft Episode', async () => {
    const slug = `ep-${randomId()}`;
    const r = await staffJson('/api/fast-english/staff/episodes', {
      method: 'POST',
      headers: { authorization: staffToken },
      body: JSON.stringify({
        title_fa: 'اپیزود آزمایشی',
        title: 'Smoke Episode',
        slug,
        description_fa: 'توضیح فارسی کامل برای اپیزود آزمایشی اسموک.',
        category: state.categoryId,
        episode_number: 2,
      }),
    });
    assert(r.status === 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.episode.status === 'draft', 'must be draft');
    assert(r.body.episode.contentKey === `${state.categorySlug}.${slug}`, 'contentKey contract');
    state.episodeId = r.body.episode.id;
    state.episodeKey = r.body.episode.contentKey;
  });

  await scenario('Add Artwork', async () => {
    const png = makePng(640, 640);
    const b = `----Art${randomId()}`;
    const body = multipart([
      `--${b}\r\nContent-Disposition: form-data; name="media"; filename="square.png"\r\nContent-Type: image/png\r\n\r\n`,
      png,
      `\r\n--${b}--\r\n`,
    ]);
    const r = await staffJson(`/api/fast-english/staff/episodes/${state.episodeId}/artwork`, {
      method: 'POST',
      headers: { authorization: staffToken, 'content-type': `multipart/form-data; boundary=${b}` },
      body: body.body,
    });
    assert(r.status === 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.episode.artworkPresent === true, 'artwork must be present');
  });

  await scenario('Add Variant', async () => {
    const r = await staffJson(`/api/fast-english/staff/episodes/${state.episodeId}/variants`, {
      method: 'POST',
      headers: { authorization: staffToken },
      body: JSON.stringify({ level: 'B1' }),
    });
    assert(r.status === 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.variant.status === 'draft', 'variant must be draft');
    assert(r.body.variant.readiness.errors.length > 0, 'new variant must report readiness errors');
    state.variantId = r.body.variant.id;
  });

  await scenario('Add Audio', async () => {
    const mp3 = makeMp3(400);
    const b = `----Aud${randomId()}`;
    const body = multipart([
      `--${b}\r\nContent-Disposition: form-data; name="audio"; filename="b1.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
      mp3,
      `\r\n--${b}--\r\n`,
    ]);
    const r = await staffJson(`/api/fast-english/staff/variants/${state.variantId}/audio`, {
      method: 'POST',
      headers: { authorization: staffToken, 'content-type': `multipart/form-data; boundary=${b}` },
      body: body.body,
    });
    assert(r.status === 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(
      Number(r.body.variant.audioDurationSeconds) > 0,
      'authoritative duration must be positive',
    );
  });

  await scenario('Add Transcript', async () => {
    const r = await staffJson(`/api/fast-english/staff/variants/${state.variantId}/transcript`, {
      method: 'PUT',
      headers: { authorization: staffToken },
      body: JSON.stringify({
        transcript:
          '# Smoke Episode\n\nThis is the transcript of the smoke episode variant with enough real text.\n\nParagraph two continues the episode content for the readiness checks.\n',
      }),
    });
    assert(r.status === 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await scenario('Add Summary', async () => {
    const r = await staffJson(`/api/fast-english/staff/variants/${state.variantId}`, {
      method: 'PATCH',
      headers: { authorization: staffToken },
      body: JSON.stringify({ summary_fa: 'خلاصه فارسی نسخه B1 برای اسموک.' }),
    });
    assert(r.status === 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await scenario('Add Vocabulary', async () => {
    const r = await staffJson(`/api/fast-english/staff/variants/${state.variantId}/vocabulary`, {
      method: 'POST',
      headers: { authorization: staffToken },
      body: JSON.stringify({
        term: 'pyramid',
        phonetic: '/ˈpɪrəmɪd/',
        part_of_speech: 'noun',
        meaning_fa: 'هرم',
        definition_en: 'A large stone structure with triangular sides.',
        example_sentence: 'The pyramid is ancient.',
      }),
    });
    assert(r.status === 200, `expected 200 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.vocabulary.term === 'pyramid', 'term mismatch');
  });

  await scenario('Duplicate Vocabulary rejected', async () => {
    const r = await staffJson(`/api/fast-english/staff/variants/${state.variantId}/vocabulary`, {
      method: 'POST',
      headers: { authorization: staffToken },
      body: JSON.stringify({ term: 'Pyramid', meaning_fa: 'هرم', definition_en: 'duplicate' }),
    });
    assert(r.status === 409, `expected 409 got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body.code === 'VOCAB_TERM_DUPLICATE', `wrong code ${r.body.code}`);
  });

  // ------------------------------------------------------------------
  // 14–18: Readiness + publish + archive
  // ------------------------------------------------------------------

  await scenario('Publication readiness reports errors', async () => {
    // A second, still-incomplete variant must report blocking errors.
    const a2 = await staffJson(`/api/fast-english/staff/episodes/${state.episodeId}/variants`, {
      method: 'POST',
      headers: { authorization: staffToken },
      body: JSON.stringify({ level: 'A2' }),
    });
    assert(a2.status === 200, `variant create failed: ${JSON.stringify(a2.body)}`);
    const r = await staffJson(`/api/fast-english/staff/episodes/${state.episodeId}`, {
      headers: { authorization: staffToken },
    });
    assert(r.status === 200, `expected 200 got ${r.status}`);
    const readiness = r.body.episode.readiness;
    assert(
      readiness.variants.A2.errors.length >= 3,
      `A2 must report errors, got ${JSON.stringify(readiness.variants.A2)}`,
    );
    assert(
      readiness.variants.A2.errors.some((e) => e.code === 'VARIANT_AUDIO_MISSING'),
      'audio error missing',
    );
  });

  await scenario('Complete Variant becomes ready', async () => {
    const r = await staffJson(`/api/fast-english/staff/episodes/${state.episodeId}`, {
      headers: { authorization: staffToken },
    });
    const b1 = r.body.episode.readiness.variants.B1;
    assert(b1.ready === true, `B1 must be ready: ${JSON.stringify(b1.errors)}`);
    assert(b1.errors.length === 0, 'B1 must have no errors');
    assert(
      b1.preconditions.some((p) => p.code === 'EPISODE_NOT_PUBLISHED'),
      'precondition must guide parent publish',
    );
  });

  await scenario('Publish Episode/Variant', async () => {
    // Variant publish before the episode is blocked with guidance.
    const early = await staffJson(`/api/fast-english/staff/variants/${state.variantId}/publish`, {
      method: 'POST',
      headers: { authorization: staffToken },
    });
    assert(
      early.status === 400 && early.body.code === 'parent_not_published',
      `expected parent_not_published got ${JSON.stringify(early.body)}`,
    );

    // Incomplete variant publish must be blocked by readiness.
    const a2Id = (
      await staffJson(`/api/fast-english/staff/episodes/${state.episodeId}`, {
        headers: { authorization: staffToken },
      })
    ).body.episode.variants.find((v) => v.level === 'A2').id;
    const a2Pub = await staffJson(`/api/fast-english/staff/variants/${a2Id}/publish`, {
      method: 'POST',
      headers: { authorization: staffToken },
    });
    assert(
      a2Pub.status === 400 && a2Pub.body.code === 'not_ready',
      `expected not_ready got ${JSON.stringify(a2Pub.body)}`,
    );

    const epPub = await staffJson(`/api/fast-english/staff/episodes/${state.episodeId}/publish`, {
      method: 'POST',
      headers: { authorization: staffToken },
    });
    assert(epPub.status === 200, `episode publish failed: ${JSON.stringify(epPub.body)}`);
    assert(epPub.body.episode.status === 'published', 'episode must be published');

    const vPub = await staffJson(`/api/fast-english/staff/variants/${state.variantId}/publish`, {
      method: 'POST',
      headers: { authorization: staffToken },
    });
    assert(vPub.status === 200, `variant publish failed: ${JSON.stringify(vPub.body)}`);
    assert(vPub.body.variant.status === 'published', 'variant must be published');
  });

  await scenario('Archive Variant', async () => {
    // Create a progress record first (owned disposable student).
    const progress = await fetchJson(URL, '/api/collections/lesson_progress/records', {
      method: 'POST',
      headers: { authorization: suToken },
      body: JSON.stringify({
        user: studentUserId,
        lesson: state.variantId,
        position_seconds: 10,
        furthest_seconds: 10,
        duration_seconds: 10,
        last_played_at: new Date().toISOString(),
        revision: 1,
      }),
    });
    assert(progress.body?.id, `progress create failed: ${JSON.stringify(progress.body)}`);
    const progressId = progress.body.id;

    const r = await staffJson(`/api/fast-english/staff/variants/${state.variantId}/archive`, {
      method: 'POST',
      headers: { authorization: staffToken },
    });
    assert(r.status === 200, `archive failed: ${JSON.stringify(r.body)}`);
    assert(r.body.variant.status === 'archived', 'variant must be archived');
    state.progressId = progressId;
  });

  await scenario('Progress/content records are not deleted', async () => {
    const prog = await fetchJson(
      URL,
      `/api/collections/lesson_progress/records/${state.progressId}`,
      {
        headers: { authorization: suToken },
      },
    );
    assert(prog.status === 200, `progress record deleted: ${prog.status}`);
    const lesson = await fetchJson(URL, `/api/collections/lessons/records/${state.variantId}`, {
      headers: { authorization: suToken },
    });
    assert(
      lesson.status === 200 && lesson.body.status === 'archived',
      'lesson record must remain archived, not deleted',
    );
  });

  // ------------------------------------------------------------------
  // 19–20: Draft preview
  // ------------------------------------------------------------------

  await scenario('Staff can preview Draft', async () => {
    // A fresh draft episode (unpublished) must be previewable by Staff.
    const slug = `preview-${randomId()}`;
    const ep = await staffJson('/api/fast-english/staff/episodes', {
      method: 'POST',
      headers: { authorization: staffToken },
      body: JSON.stringify({
        title_fa: 'پیشنمایش',
        title: 'Preview',
        slug,
        description_fa: 'توضیح برای پیشنمایش.',
        category: state.categoryId,
      }),
    });
    state.previewEpisodeId = ep.body.episode.id;
    const v = await staffJson(
      `/api/fast-english/staff/episodes/${state.previewEpisodeId}/variants`,
      {
        method: 'POST',
        headers: { authorization: staffToken },
        body: JSON.stringify({ level: 'C1' }),
      },
    );
    await staffJson(`/api/fast-english/staff/variants/${v.body.variant.id}/vocabulary`, {
      method: 'POST',
      headers: { authorization: staffToken },
      body: JSON.stringify({
        term: 'monument',
        meaning_fa: 'یادمان',
        definition_en: 'A structure built to remember someone.',
      }),
    });
    const r = await staffJson(
      `/api/fast-english/staff/preview/episodes/${state.previewEpisodeId}`,
      {
        headers: { authorization: staffToken },
      },
    );
    assert(r.status === 200, `preview failed: ${r.status} ${JSON.stringify(r.body)}`);
    assert(r.body.episode.status === 'draft', 'draft content in preview');
    assert(
      r.body.variants.length === 1 && r.body.variants[0].vocabulary.length === 1,
      'preview variant vocabulary missing',
    );
  });

  await scenario('Student cannot preview Draft', async () => {
    const r = await staffJson(
      `/api/fast-english/staff/preview/episodes/${state.previewEpisodeId}`,
      {
        headers: { authorization: studentToken },
      },
    );
    assert(r.status === 403, `expected 403 got ${r.status}`);
    // Public student routes must also hide the draft.
    const lessonId = (
      await staffJson(`/api/fast-english/staff/preview/episodes/${state.previewEpisodeId}`, {
        headers: { authorization: staffToken },
      })
    ).body.variants[0].id;
    const pub = await staffJson(`/api/fast-english/lessons/${lessonId}`, {
      headers: { authorization: studentToken },
    });
    assert([403, 404].includes(pub.status), `draft must be hidden for students, got ${pub.status}`);
  });

  // ------------------------------------------------------------------
  // 21–27: Content import (existing Slice 3 pipeline + ZIP ingestion)
  // ------------------------------------------------------------------

  const importSlug = `import-${randomId()}`;
  const importKey = `general.${importSlug}`;

  async function planFor(fixtureManifest, assetList) {
    return staffJson('/api/fast-english/staff/content-import/plan', {
      method: 'POST',
      headers: { authorization: staffToken },
      body: JSON.stringify({ manifest: JSON.stringify(fixtureManifest), assets: assetList }),
    });
  }

  await scenario('Import validation works (ZIP path)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fep-ca-smoke-'));
    const { manifest: fixtureManifest } = writeFixturePackage(root, importSlug, {
      categoryKey: state.categorySlug,
    });
    // Fix the categoryKey of the fixture (writeFixturePackage uses 'general').
    fixtureManifest.categoryKey = state.categorySlug;
    fixtureManifest.contentKey = importKey;
    const entries = packageDirToZipEntries(join(root, importSlug), fixtureManifest);
    const zipBytes = buildStoreZip(entries);
    const parsed = await parseZip(new Uint8Array(zipBytes));
    assert(parsed.ok, `zip parse failed: ${JSON.stringify(parsed)}`);
    const pkg = await assemblePackageFromZip(parsed.entries);
    assert(pkg.ok, `zip package validation failed: ${JSON.stringify(pkg.errors)}`);
    assert(pkg.manifest.contentKey === importKey, 'content key mismatch');
    assert(
      pkg.assets.length === 6,
      `expected 6 assets (square, hero, 2 audio, 2 transcript), got ${pkg.assets.length}`,
    );
    state.zipAssets = pkg.assets;
    state.zipManifest = pkg.manifest;
  });

  await scenario('Import plan works (dry-run, zero mutation)', async () => {
    const before = (
      await fetchJson(URL, '/api/collections/topics/records?perPage=200', {
        headers: { authorization: suToken },
      })
    ).body.items.length;
    const assetList = state.zipAssets.map((a) => ({
      path: a.path,
      sizeBytes: a.sizeBytes,
      sha256: a.sha256,
    }));
    const r = await planFor(state.zipManifest, assetList);
    assert(r.status === 200, `plan failed: ${r.status} ${JSON.stringify(r.body)}`);
    assert(r.body.result === 'new', `expected new decision, got ${r.body.result}`);
    assert(/^[0-9a-f]{64}$/.test(r.body.planStateHash), 'planStateHash missing');
    assert(r.body.variants.length === 2, 'plan variants missing');
    assert(
      r.body.variants.every((v) => v.action === 'create'),
      'all variants must be creates',
    );
    state.planStateHash = r.body.planStateHash;
    const after = (
      await fetchJson(URL, '/api/collections/topics/records?perPage=200', {
        headers: { authorization: suToken },
      })
    ).body.items.length;
    assert(before === after, 'plan must not mutate the database');
  });

  await scenario('Missing planStateHash fails', async () => {
    const b = `----Exec${randomId()}`;
    const parts = [
      `--${b}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n${JSON.stringify(state.zipManifest)}\r\n`,
    ];
    for (const a of state.zipAssets) {
      parts.push(
        `--${b}\r\nContent-Disposition: form-data; name="${a.path}"; filename="${a.path.split('/').pop()}"\r\nContent-Type: ${a.mimeType}\r\n\r\n`,
      );
      parts.push(a.bytes);
      parts.push('\r\n');
    }
    parts.push(`--${b}--\r\n`);
    const body = Buffer.concat(
      parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : Buffer.from(p))),
    );
    const r = await staffJson('/api/fast-english/staff/content-import/execute', {
      method: 'POST',
      headers: { authorization: staffToken, 'content-type': `multipart/form-data; boundary=${b}` },
      body,
    });
    assert(
      r.status === 400 && r.body.code === 'plan_state_required',
      `expected plan_state_required got ${r.status} ${JSON.stringify(r.body)}`,
    );
  });

  await scenario('Stale plan fails', async () => {
    // Change the DB state between plan and execute: create the Episode
    // through the admin route with the same content key.
    const generalCat = (
      await staffJson('/api/fast-english/staff/categories', {
        headers: { authorization: staffToken },
      })
    ).body.items.find((c) => c.key === 'general');
    const ep = await staffJson('/api/fast-english/staff/episodes', {
      method: 'POST',
      headers: { authorization: staffToken },
      body: JSON.stringify({
        title_fa: 'مسیر ورود',
        title: 'Import Path',
        slug: importSlug,
        description_fa: 'توضیح برای اپیزود ورودی.',
        category: generalCat.id,
      }),
    });
    assert(ep.status === 200, `episode create failed: ${JSON.stringify(ep.body)}`);
    state.importedEpisodeId = ep.body.episode.id;

    const b = `----Exec${randomId()}`;
    const parts = [
      `--${b}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n${JSON.stringify(state.zipManifest)}\r\n`,
    ];
    for (const a of state.zipAssets) {
      parts.push(
        `--${b}\r\nContent-Disposition: form-data; name="${a.path}"; filename="${a.path.split('/').pop()}"\r\nContent-Type: ${a.mimeType}\r\n\r\n`,
      );
      parts.push(a.bytes);
      parts.push('\r\n');
    }
    parts.push(`--${b}--\r\n`);
    const body = Buffer.concat(
      parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : Buffer.from(p))),
    );
    const r = await staffJson(
      `/api/fast-english/staff/content-import/execute?planStateHash=${state.planStateHash}`,
      {
        method: 'POST',
        headers: {
          authorization: staffToken,
          'content-type': `multipart/form-data; boundary=${b}`,
        },
        body,
      },
    );
    assert(
      r.status === 409 && r.body.code === 'plan_stale',
      `expected plan_stale got ${r.status} ${JSON.stringify(r.body)}`,
    );
  });

  await scenario('Execute creates/updates Draft', async () => {
    // Bump the content version: the admin-created episode already holds
    // contentVersion 1 with a different fingerprint, so the import must
    // be a higher-version update into Draft.
    state.zipManifest.contentVersion = 2;
    const assetList = state.zipAssets.map((a) => ({
      path: a.path,
      sizeBytes: a.sizeBytes,
      sha256: a.sha256,
    }));
    const plan = await planFor(state.zipManifest, assetList);
    assert(plan.status === 200, `re-plan failed: ${JSON.stringify(plan.body)}`);
    assert(plan.body.result === 'update', `expected update decision, got ${plan.body.result}`);

    const b = `----Exec${randomId()}`;
    const parts = [
      `--${b}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n${JSON.stringify(state.zipManifest)}\r\n`,
    ];
    for (const a of state.zipAssets) {
      parts.push(
        `--${b}\r\nContent-Disposition: form-data; name="${a.path}"; filename="${a.path.split('/').pop()}"\r\nContent-Type: ${a.mimeType}\r\n\r\n`,
      );
      parts.push(a.bytes);
      parts.push('\r\n');
    }
    parts.push(`--${b}--\r\n`);
    const body = Buffer.concat(
      parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : Buffer.from(p))),
    );
    const r = await staffJson(
      `/api/fast-english/staff/content-import/execute?planStateHash=${plan.body.planStateHash}`,
      {
        method: 'POST',
        headers: {
          authorization: staffToken,
          'content-type': `multipart/form-data; boundary=${b}`,
        },
        body,
      },
    );
    assert(r.status === 200, `execute failed: ${r.status} ${JSON.stringify(r.body)}`);
    assert(r.body.result === 'completed', `expected completed got ${r.body.result}`);
    state.importedAuditId = r.body.auditId;

    const ep = await staffJson(`/api/fast-english/staff/episodes/${state.importedEpisodeId}`, {
      headers: { authorization: staffToken },
    });
    assert(ep.body.episode.status === 'draft', 'imported episode must stay draft');
    assert(ep.body.episode.variants.length === 2, 'two imported variants expected');
  });

  await scenario('Exact replay returns no_change', async () => {
    const assetList = state.zipAssets.map((a) => ({
      path: a.path,
      sizeBytes: a.sizeBytes,
      sha256: a.sha256,
    }));
    const plan = await planFor(state.zipManifest, assetList);
    assert(plan.body.result === 'no_change', `expected no_change got ${plan.body.result}`);

    const b = `----Exec${randomId()}`;
    const parts = [
      `--${b}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n${JSON.stringify(state.zipManifest)}\r\n`,
    ];
    for (const a of state.zipAssets) {
      parts.push(
        `--${b}\r\nContent-Disposition: form-data; name="${a.path}"; filename="${a.path.split('/').pop()}"\r\nContent-Type: ${a.mimeType}\r\n\r\n`,
      );
      parts.push(a.bytes);
      parts.push('\r\n');
    }
    parts.push(`--${b}--\r\n`);
    const body = Buffer.concat(
      parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : Buffer.from(p))),
    );
    const r = await staffJson(
      `/api/fast-english/staff/content-import/execute?planStateHash=${plan.body.planStateHash}`,
      {
        method: 'POST',
        headers: {
          authorization: staffToken,
          'content-type': `multipart/form-data; boundary=${b}`,
        },
        body,
      },
    );
    assert(
      r.status === 200 && r.body.result === 'no_change',
      `expected no_change got ${r.status} ${JSON.stringify(r.body)}`,
    );
  });

  await scenario('Import audit exists', async () => {
    const list = await staffJson('/api/fast-english/staff/imports?limit=20', {
      headers: { authorization: staffToken },
    });
    assert(list.status === 200, `imports list failed: ${list.status}`);
    assert(
      list.body.items.some((i) => i.status === 'completed'),
      'completed import audit missing',
    );
    assert(
      list.body.items.some((i) => i.status === 'no_change'),
      'no_change audit missing',
    );
    const detail = await staffJson(
      `/api/fast-english/staff/content-imports/${state.importedAuditId}`,
      {
        headers: { authorization: staffToken },
      },
    );
    assert(detail.status === 200, `audit detail failed: ${detail.status}`);
    assert(detail.body.contentKey === importKey, 'audit content key mismatch');
    assert(detail.body.status === 'completed', 'audit status mismatch');
  });

  // ------------------------------------------------------------------
  // 28: Unauthorized access
  // ------------------------------------------------------------------

  await scenario('Unauthorized access rejected', async () => {
    const anon = await staffJson('/api/fast-english/staff/episodes');
    assert(anon.status === 401, `expected 401 got ${anon.status}`);
    const legacy = await getLegacyOperatorToken(URL, suToken);
    const legacyHit = await staffJson('/api/fast-english/staff/categories', {
      headers: { authorization: legacy },
    });
    assert(legacyHit.status === 403, `expected 403 got ${legacyHit.status}`);
  });

  console.log(`\ncontent-admin smoke: ${passed}/${total} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('content-admin smoke crashed:', err);
  process.exit(1);
});
