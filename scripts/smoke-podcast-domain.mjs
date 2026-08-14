#!/usr/bin/env node
// scripts/smoke-podcast-domain.mjs — Podcast Slice 2 backend smoke suite.
//
// Proves the 28 required scenarios:
//   1.  migration creates Categories
//   2.  existing Topics are assigned to the default Category
//   3.  existing Lessons remain linked
//   4.  existing Progress counts remain unchanged
//   5.  Published Episode and Variant serialize correctly
//   6.  Draft Category is hidden
//   7.  Archived Category is hidden
//   8.  Draft Episode is hidden
//   9.  Archived Episode is hidden
//  10.  Draft Variant is hidden
//  11.  Archived Variant is hidden
//  12.  active Student can access recommended Level
//  13.  active Student can access another Published Level
//  14.  browsing another Level does not change recommended Level
//  15.  browsing another Level does not change preferred Level
//  16.  B1 and B2 Progress are independent
//  17.  audio access works for another Published Level
//  18.  expired Student remains denied
//  19.  suspended Student remains denied
//  20.  Staff Admin remains denied from Student Episode APIs
//  21.  vocabulary uniqueness works
//  22.  unpublished Vocabulary cannot leak through public APIs
//  23.  availableLevels contains only Published Variants
//  24.  availableLevels is in CEFR order
//  25.  Category archival hides child content
//  26.  Progress survives archival
//  27.  republish restores existing Progress access
//  28.  direct Student CRUD remains denied
//
// Part 1 runs a genuine migration test: a disposable PocketBase is started
// with ONLY the pre-slice migrations (0000–0018), legacy topics/lessons/
// progress are seeded through the raw API, the instance is restarted with
// the full migration set, and the backfill is asserted (default Category,
// content_key = "legacy.<slug>", content_version = 1, links and Progress
// counts unchanged, legacy published content stays visible — the
// grandfathering strategy).
//
// Part 2 runs the domain scenarios against the wrapper-started instance.
//
// Usage: bash scripts/smoke-placement.sh node scripts/smoke-podcast-domain.mjs

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  fetchJson,
  getStaffToken,
  getSuperuserToken,
  nextPhone,
  randomId,
  seedPlacementQuestions,
} from './smoke-common.mjs';

const URL = process.env.PB_SMOKE_URL;
const REPO_ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let total = 0,
  passed = 0,
  failed = 0;

function scenario(name, fn) {
  total++;
  const label = `  ${String(total).padStart(2, '0')}. ${name}`;
  try {
    fn();
    passed++;
    console.log(`PASS ${label}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${label}`);
    console.log(`       ${err && err.message ? err.message : String(err)}`);
  }
}

async function aScenario(name, fnPromise) {
  total++;
  const label = `  ${String(total).padStart(2, '0')}. ${name}`;
  try {
    await fnPromise();
    passed++;
    console.log(`PASS ${label}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${label}`);
    console.log(`       ${err && err.message ? err.message : String(err)}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

async function assertHttp(res, expected, msg) {
  if (res.status !== expected)
    throw new Error(
      `${msg}: expected ${expected}, got ${res.status}, body=${JSON.stringify(res.body).slice(0, 200)}`,
    );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);

const AUDIO_FIXTURE = (() => {
  const size = 8192;
  const b = new Uint8Array(size);
  b[0] = 0xff;
  b[1] = 0xfb;
  b[2] = 0x90;
  for (let i = 4; i < size; i++) b[i] = 0x55;
  return Buffer.from(b.buffer);
})();

async function jf(path, init = {}) {
  return fetchJson(URL, path, init);
}

async function multipartPatch(base, path, su, field, filename, mime, bytes) {
  const boundary = `--FB${randomId()}`;
  const buf = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await fetch(`${base}${path}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: buf,
    signal: AbortSignal.timeout(15_000),
  });
  const t = await res.text();
  if (res.status !== 200) throw new Error(`multipart ${field}: ${res.status} ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

async function getDefaultCategoryId(su) {
  const r = await jf("/api/collections/categories/records?filter=(key='general')&perPage=1", {
    headers: { authorization: `Bearer ${su}` },
  });
  const item = r.body?.items?.[0];
  if (!item) throw new Error('default category missing');
  return item.id;
}

// Category: created as draft unless overridden; published requires
// description_fa (hook invariant).
async function makeCategory(su, overrides = {}) {
  const r = await jf('/api/collections/categories/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      key: `cat-${randomId()}`,
      slug: `cat-${randomId()}`,
      title_fa: 'دسته',
      description_fa: 'توضیح دسته',
      sort_order: 0,
      publication_status: overrides.publication_status ?? 'draft',
      ...overrides,
    }),
  });
  if (!r.body?.id) throw new Error(`category create: ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body;
}

// Topic: draft -> artwork upload -> publish (all Episode invariants).
async function makeTopic(su, categoryId, overrides = {}) {
  const slug = overrides.slug || `t-${randomId()}`;
  const cr = await jf('/api/collections/topics/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      title: overrides.title || `T ${randomId()}`,
      slug,
      description: 'd',
      sort_order: overrides.sort_order ?? 0,
      status: 'draft',
    }),
  });
  if (!cr.body?.id) throw new Error(`topic create: ${JSON.stringify(cr.body).slice(0, 200)}`);
  const id = cr.body.id;

  if (overrides.keepDraft) return { id, body: cr.body };

  await multipartPatch(
    URL,
    `/api/collections/topics/records/${id}`,
    su,
    'artwork_square',
    'art.png',
    'image/png',
    PNG,
  );
  if (overrides.withArtwork === false) {
    // skip artwork -> publish must fail (proved elsewhere); not used here
  }
  if (overrides.noArtwork) return { id, body: cr.body };

  const patch = {
    status: overrides.status || 'published',
    category: categoryId,
    content_key: overrides.content_key || `fx-${randomId()}`,
    content_version: 1,
    title_fa: overrides.title_fa || 'عنوان اپیزود',
    description_fa: overrides.description_fa || 'توضیح اپیزود',
  };
  const pr = await jf(`/api/collections/topics/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200)
    throw new Error(`topic publish: ${pr.status} ${JSON.stringify(pr.body).slice(0, 200)}`);
  return { id, body: pr.body };
}

// Lesson: draft -> audio -> publish (all Variant invariants).
async function makeLesson(su, topicId, overrides = {}) {
  const cr = await jf('/api/collections/lessons/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      topic: topicId,
      level: overrides.level || 'B1',
      title: overrides.title || `L ${randomId()}`,
      summary: overrides.summary || 's',
      body: overrides.body || 'b',
      estimated_minutes: overrides.estimated_minutes ?? 10,
      status: 'draft',
    }),
  });
  if (!cr.body?.id) throw new Error(`lesson create: ${JSON.stringify(cr.body).slice(0, 200)}`);
  const id = cr.body.id;
  await multipartPatch(
    URL,
    `/api/collections/lessons/records/${id}`,
    su,
    'audio',
    't.mp3',
    'audio/mpeg',
    AUDIO_FIXTURE,
  );

  if (overrides.keepDraft) return { id, body: cr.body };

  const patch = {
    status: overrides.status || 'published',
    audio_duration_seconds: overrides.audio_duration_seconds ?? 600,
    summary_fa: overrides.summary_fa || 'خلاصه فارسی',
    content_version: 1,
  };
  if (overrides.is_public_sample) patch.is_public_sample = true;
  const pr = await jf(`/api/collections/lessons/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200)
    throw new Error(`lesson publish: ${pr.status} ${JSON.stringify(pr.body).slice(0, 200)}`);
  return { id, body: pr.body };
}

// Fully-entitled student (payment -> approval -> placement -> level select).
// All placement answers are correct -> score 20 -> suggested C2. The
// selected level is the requested one, so recommendedLevel=C2 and
// preferredLevel=requested level are distinct (proves the mapping).
async function makeFullStudent(su, level = 'B1') {
  const staffToken = await getStaffToken(URL, su);
  const phone = nextPhone();
  const password = 'Test1234!';

  const signup = await jf('/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({ name: 'S', phone, password, passwordConfirm: password }),
  });
  if (!signup.body?.id) throw new Error(`signup: ${JSON.stringify(signup.body)}`);
  const userId = signup.body.id;
  const canonicalPhone = signup.body.phone;

  const login = await jf('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  const token = login.body?.token;
  if (!token) throw new Error('login failed');

  await jf('/api/collections/payment_destination/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      card_number: '0000000000000000',
      card_holder_name: 'T',
      bank_name: 'T',
      is_active: true,
    }),
  });
  const plan = await jf('/api/collections/plans/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      name: 'P',
      slug: `p-${randomId()}`,
      duration_days: 90,
      price_toman: 100000,
      is_active: true,
    }),
  });
  const planId = plan.body?.id;
  if (!planId) throw new Error('plan failed');

  const boundary = `--FB${randomId()}`;
  const prBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${planId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    PNG,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const prRes = await fetch(`${URL}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: prBody,
    signal: AbortSignal.timeout(15_000),
  });
  if (prRes.status !== 201) throw new Error(`PR: ${prRes.status}`);
  const prj = await prRes.json();
  const prId = prj?.request?.id;
  if (!prId) throw new Error('PR id missing');

  const approve = await jf(`/api/fast-english/operator/payment-requests/${prId}/approve`, {
    method: 'POST',
    headers: { authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({}),
  });
  if (approve.status !== 200) throw new Error(`approve: ${approve.status}`);

  const refresh = await jf('/api/collections/fep_users/auth-refresh', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const refreshedToken = refresh.body?.token || token;

  // Placement questions (shared helper: q01..q20, opt0 correct —
  // idempotent against the unique (question_key, version) index).
  await seedPlacementQuestions(URL, su);

  const start = await jf('/api/fast-english/placement/attempts/start', {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
  });
  const attemptId = start.body?.attempt?.id;
  let rev = start.body?.attempt?.revision;
  for (const q of start.body?.questions || []) {
    const ans = await jf(`/api/fast-english/placement/attempts/${attemptId}/answer`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${refreshedToken}` },
      body: JSON.stringify({ questionId: q.id, optionId: q.options[0].id, expectedRevision: rev }),
    });
    rev = ans.body?.attempt?.revision || rev + 1;
  }
  const submit = await jf(`/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
    body: JSON.stringify({ expectedRevision: rev }),
  });
  if (submit.status !== 200) throw new Error(`submit: ${submit.status}`);

  const lr = await jf('/api/fast-english/placement/selected-level', {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
    body: JSON.stringify({ selectedLevel: level }),
  });
  if (lr.status !== 200) throw new Error(`level select: ${lr.status}`);

  return { phone: canonicalPhone, password, token: refreshedToken, userId };
}

// ---------------------------------------------------------------------------
// Part 1 — genuine migration backfill proof
// ---------------------------------------------------------------------------
const PRE_PORT = 18121;
const POST_PORT = 18122;
const PRE_BASE = `http://127.0.0.1:${PRE_PORT}`;
const POST_BASE = `http://127.0.0.1:${POST_PORT}`;

function waitForHealth(base, maxMs = 30_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(3000) });
        if (r.status === 200) return resolve();
      } catch (_) {}
      if (Date.now() - start > maxMs) return reject(new Error(`${base} not ready`));
      setTimeout(tick, 250);
    };
    void tick();
  });
}

function startPb(dataDir, migrationsDir, hooksDir, port) {
  const proc = spawn(
    'server/pocketbase',
    [
      'serve',
      '--dev',
      '--http',
      `127.0.0.1:${port}`,
      '--dir',
      dataDir,
      '--migrationsDir',
      migrationsDir,
      '--hooksDir',
      hooksDir,
      '--origins',
      'http://localhost:5173,http://127.0.0.1:5173,http://localhost,https://localhost',
      '--encryptionEnv',
      'dev-encryption-key-not-for-prod',
    ],
    {
      env: { ...process.env, PB_TELEMETRY: '0', PB_FEEDBACK: '0' },
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );
  return proc;
}

async function killPb(proc) {
  if (!proc || proc.exitCode !== null) return;
  proc.kill('SIGTERM');
  await new Promise((res) => setTimeout(res, 1500));
  if (proc.exitCode === null) proc.kill('SIGKILL');
  await new Promise((res) => setTimeout(res, 500));
}

// Pre-stage instance: only migrations 0000–0018 + NO hooks (raw legacy
// seeding); post-stage instance: full migrations + full hooks on the SAME
// data dir — the backfill migration runs against real legacy data.
async function runMigrationBackfillProof() {
  const work = join('/tmp', `fep-podcast-backfill-${Date.now()}`);
  const preMigDir = join(work, 'mig-pre');
  const emptyHooks = join(work, 'hooks-empty');
  const dataDir = join(work, 'data');
  mkdirSync(preMigDir, { recursive: true });
  mkdirSync(emptyHooks, { recursive: true });
  mkdirSync(dataDir, { recursive: true });

  const allMigrations = readdirSync(join(REPO_ROOT, 'server', 'pb_migrations'))
    .filter((f) => f.endsWith('.js'))
    .sort();
  for (const f of allMigrations) {
    if (f.startsWith('1700000019') || f.startsWith('170000002') || f.startsWith('1700000018'))
      continue;
    if (f > '1700000018') continue;
    copyFileSync(join(REPO_ROOT, 'server', 'pb_migrations', f), join(preMigDir, f));
  }

  const suEmail = `pre-${randomId()}@fep-smoke.invalid`;
  const suPassword = `pre-${randomId()}`;
  const upsert = spawnSync(
    'server/pocketbase',
    ['superuser', 'upsert', suEmail, suPassword, '--dir', dataDir],
    { stdio: 'ignore' },
  );
  if (upsert.status !== 0) throw new Error('pre-stage superuser upsert failed');

  // ---- Pre-stage: seed legacy content (raw records, no hooks) ----
  const pre = startPb(dataDir, preMigDir, emptyHooks, PRE_PORT);
  let cleanupPre = true;
  try {
    await waitForHealth(PRE_BASE);
    const auth = await fetchJson(PRE_BASE, '/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: suEmail, password: suPassword }),
    });
    const su = auth.body?.token;
    if (!su) throw new Error('pre-stage superuser auth failed');

    const user = await fetchJson(PRE_BASE, '/api/collections/fep_users/records', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Legacy',
        phone: `+989${randomBytes(4).readUInt32BE(0) % 10_000_000}`,
        email: `legacy-${randomId()}@fep.invalid`,
        password: 'Test1234!',
        passwordConfirm: 'Test1234!',
        // Raw record: no hooks run pre-stage, so the fields the create
        // hook normally defaults must be provided explicitly.
        role: 'student',
        account_status: 'active',
        placement_completed: false,
      }),
    });
    const legacyUserId = user.body?.id;
    if (!legacyUserId) throw new Error('pre-stage user failed');

    const topic = await fetchJson(PRE_BASE, '/api/collections/topics/records', {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        title: 'Legacy Topic',
        slug: 'legacy-topic-1',
        description: 'legacy description',
        sort_order: 1,
        status: 'published',
      }),
    });
    const legacyTopicId = topic.body?.id;
    if (!legacyTopicId) throw new Error('pre-stage topic failed');

    const lesson = await fetchJson(PRE_BASE, '/api/collections/lessons/records', {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        topic: legacyTopicId,
        level: 'B1',
        title: 'Legacy Lesson',
        summary: 'legacy summary',
        body: 'legacy body',
        estimated_minutes: 10,
        status: 'published',
        audio_duration_seconds: 600,
      }),
    });
    const legacyLessonId = lesson.body?.id;
    if (!legacyLessonId) throw new Error('pre-stage lesson failed');

    // Audio file upload (core file handling, no hooks).
    const boundary = `--FB${randomId()}`;
    const buf = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="t.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
      ),
      AUDIO_FIXTURE,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const audioRes = await fetch(`${PRE_BASE}/api/collections/lessons/records/${legacyLessonId}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${su}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: buf,
      signal: AbortSignal.timeout(15_000),
    });
    if (audioRes.status !== 200) throw new Error('pre-stage audio upload failed');

    const progress = await fetchJson(PRE_BASE, '/api/collections/lesson_progress/records', {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        user: legacyUserId,
        lesson: legacyLessonId,
        position_seconds: 120,
        furthest_seconds: 240,
        duration_seconds: 600,
        completed: false,
        last_played_at: new Date().toISOString(),
        revision: 3,
      }),
    });
    if (!progress.body?.id) throw new Error('pre-stage progress failed');
    const legacyProgressId = progress.body.id;
    await killPb(pre);
    cleanupPre = false;

    // ---- Post-stage: full migrations + hooks on the same data dir ----
    const post = startPb(
      dataDir,
      join(REPO_ROOT, 'server', 'pb_migrations'),
      join(REPO_ROOT, 'server', 'pb_hooks'),
      POST_PORT,
    );
    try {
      await waitForHealth(POST_BASE);
      const auth2 = await fetchJson(POST_BASE, '/api/collections/_superusers/auth-with-password', {
        method: 'POST',
        body: JSON.stringify({ identity: suEmail, password: suPassword }),
      });
      const su2 = auth2.body?.token;
      if (!su2) throw new Error('post-stage superuser auth failed');

      const jf2 = (path, init = {}) => fetchJson(POST_BASE, path, init);

      // 1. Categories created (default Category).
      const cats = await jf2('/api/collections/categories/records?perPage=100', {
        headers: { authorization: `Bearer ${su2}` },
      });
      const general = (cats.body?.items || []).find((c) => c.key === 'general');
      aScenario('migration creates Categories (default general/published)', async () => {
        assert(general, 'default category missing');
        assert(general.publication_status === 'published', 'default category not published');
      });

      // 2. Existing Topics assigned to the default Category + deterministic
      //    content_key + content_version 1.
      const topics = await jf2('/api/collections/topics/records?perPage=100', {
        headers: { authorization: `Bearer ${su2}` },
      });
      const legacyTopic = (topics.body?.items || []).find((t) => t.id === legacyTopicId);
      aScenario('existing Topics are assigned to the default Category', async () => {
        assert(legacyTopic, 'legacy topic missing');
        assert(legacyTopic.category === general.id, `category=${legacyTopic?.category}`);
        assert(
          legacyTopic.content_key === 'legacy.legacy-topic-1',
          `content_key=${legacyTopic?.content_key}`,
        );
        assert(legacyTopic.content_version === 1, `version=${legacyTopic?.content_version}`);
        assert(legacyTopic.status === 'published', 'legacy topic unpublised by migration');
      });

      // 3. Existing Lessons remain linked (topic + identity + version).
      const lessons = await jf2('/api/collections/lessons/records?perPage=100', {
        headers: { authorization: `Bearer ${su2}` },
      });
      const legacyLesson = (lessons.body?.items || []).find((l) => l.id === legacyLessonId);
      aScenario('existing Lessons remain linked to their Topic', async () => {
        assert(legacyLesson, 'legacy lesson missing');
        assert(legacyLesson.topic === legacyTopicId, 'lesson topic link changed');
        assert(legacyLesson.level === 'B1', 'lesson level changed');
        assert(legacyLesson.content_version === 1, `version=${legacyLesson?.content_version}`);
      });

      // 4. Existing Progress counts and relations remain unchanged.
      const progressRecs = await jf2('/api/collections/lesson_progress/records?perPage=100', {
        headers: { authorization: `Bearer ${su2}` },
      });
      aScenario('existing Progress counts remain unchanged', async () => {
        const recs = progressRecs.body?.items || [];
        assert(recs.length === 1, `progress count=${recs.length}`);
        const p = recs[0];
        assert(p.id === legacyProgressId, 'progress id changed');
        assert(p.lesson === legacyLessonId, 'progress lesson link changed');
        assert(p.furthest_seconds === 240, 'progress values changed');
        assert(p.revision === 3, 'progress revision changed');
      });

      // Grandfathering: legacy published content without the new fields
      // stays visible and its artwork resolves to the Product fallback.
      const artRes = await fetch(`${POST_BASE}/api/fast-english/artwork/${legacyLessonId}`, {
        signal: AbortSignal.timeout(10_000),
      });
      aScenario(
        'legacy published Episode artwork falls back to a controlled Product asset',
        async () => {
          assert(artRes.status === 200, `artwork status=${artRes.status}`);
          const ct = artRes.headers.get('content-type') || '';
          assert(ct.startsWith('image/svg+xml'), `content-type=${ct}`);
          const cc = artRes.headers.get('cache-control') || '';
          assert(cc === 'public, max-age=3600', `cache-control=${cc}`);
        },
      );
    } finally {
      await killPb(post);
    }
  } finally {
    if (cleanupPre) await killPb(pre);
    rmSync(work, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Part 2 — domain scenarios against the wrapper PB
// ---------------------------------------------------------------------------
async function runDomainScenarios() {
  const su = await getSuperuserToken(URL);
  scenario('got superuser token', () => assert(!!su, 'no token'));
  if (!su) process.exit(1);

  const defaultCategoryId = await getDefaultCategoryId(su);
  scenario('default Category lookup works', () => assert(!!defaultCategoryId, 'no category'));

  // ---- Fixtures ----
  // Main Episode: published B1 (preferred) + B2 + C2 (recommended) +
  // a draft C1 Variant. Separate topics for draft/archived states.
  const mainTopic = await makeTopic(su, defaultCategoryId, {
    sort_order: 1,
    title: 'Main Episode',
  });
  const mainTopicId = mainTopic.id;
  const b1 = await makeLesson(su, mainTopicId, { level: 'B1', title: 'B1 Variant' });
  const b2 = await makeLesson(su, mainTopicId, { level: 'B2', title: 'B2 Variant' });
  const c2 = await makeLesson(su, mainTopicId, { level: 'C2', title: 'C2 Variant' });
  const c1Draft = await makeLesson(su, mainTopicId, {
    level: 'C1',
    title: 'C1 Draft Variant',
    keepDraft: true,
  });

  // CEFR-order topic: created out of order (C2 first, then A1).
  const orderTopic = await makeTopic(su, defaultCategoryId, {
    sort_order: 2,
    title: 'Order Episode',
  });
  await makeLesson(su, orderTopic.id, { level: 'C2', title: 'C2 first' });
  await makeLesson(su, orderTopic.id, { level: 'A1', title: 'A1 second' });

  // Draft Episode (topic drafted AFTER its Variant was published — the
  // only way the grandfathered "published Variant under draft Episode"
  // state can exist).
  const draftTopic = await makeTopic(su, defaultCategoryId, {
    sort_order: 3,
    title: 'Draft Episode',
  });
  await makeLesson(su, draftTopic.id, { level: 'B1', title: 'Draft Episode Variant' });
  await jf(`/api/collections/topics/records/${draftTopic.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ status: 'draft' }),
  });

  // Archived Episode.
  const archTopic = await makeTopic(su, defaultCategoryId, {
    sort_order: 4,
    title: 'Archived Episode',
  });
  await makeLesson(su, archTopic.id, { level: 'B1', title: 'Archived Episode Variant' });
  await jf(`/api/collections/topics/records/${archTopic.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ status: 'archived' }),
  });

  // Draft Category with a published Episode/Variant under it (reachable
  // state: publish under the default Category, then retarget the Topic to
  // the draft Category — a grandfathered state).
  const draftCat = await makeCategory(su, { publication_status: 'draft' });
  const draftCatTopic = await makeTopic(su, defaultCategoryId, {
    sort_order: 5,
    title: 'Draft Category Episode',
  });
  await makeLesson(su, draftCatTopic.id, { level: 'B1', title: 'Draft Category Variant' });
  await jf(`/api/collections/topics/records/${draftCatTopic.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ category: draftCat.id }),
  });
  const draftCatLessons = await jf(
    `/api/collections/lessons/records?filter=(topic='${draftCatTopic.id}')&perPage=5`,
    { headers: { authorization: `Bearer ${su}` } },
  );
  const draftCatVariantId = draftCatLessons.body?.items?.[0]?.id;

  // Archived Category (with Progress proof later).
  const archCat = await makeCategory(su, { publication_status: 'published' });
  const archCatTopic = await makeTopic(su, archCat.id, {
    sort_order: 6,
    title: 'Archive Category Episode',
  });
  const archCatVariant = await makeLesson(su, archCatTopic.id, {
    level: 'B1',
    title: 'Archive Category Variant',
  });

  // Vocabulary fixtures
  const vocab1 = await jf('/api/collections/lesson_vocabulary/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      lesson: b1.id,
      term: 'Hello',
      normalized_term: 'hello',
      meaning_fa: 'سلام',
      definition_en: 'greeting',
      sort_order: 0,
    }),
  });
  scenario('vocabulary record created', () =>
    assert(vocab1.body?.id, JSON.stringify(vocab1.body).slice(0, 120)),
  );
  const vocabDraft = await jf('/api/collections/lesson_vocabulary/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      lesson: c1Draft.id,
      term: 'Secret',
      normalized_term: 'secret',
      meaning_fa: 'مخفی',
      definition_en: 'hidden',
      sort_order: 0,
    }),
  });
  scenario('vocabulary under draft Variant created (fixture)', () =>
    assert(vocabDraft.body?.id, 'no id'),
  );

  // Students
  const student = await makeFullStudent(su, 'B1'); // recommended C2, preferred B1
  const sToken = student.token;
  scenario('entitled student created (recommended C2, preferred B1)', () =>
    assert(!!sToken, 'no token'),
  );

  const staffToken = await getStaffToken(URL, su);
  scenario('staff token created', () => assert(!!staffToken, 'no staff token'));

  // ---- 5. Serialization ----
  const detail = await jf(`/api/fast-english/lessons/${b1.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('Published Episode and Variant serialize correctly', async () => {
    await assertHttp(detail, 200, 'detail');
    const d = detail.body;
    assert(d.episode?.id === mainTopicId, 'episode.id');
    assert(d.episode?.contentKey, 'episode.contentKey');
    assert(d.episode?.titleFa === 'عنوان اپیزود', 'episode.titleFa');
    assert(d.episode?.category?.key === 'general', 'episode.category');
    assert(d.episode?.artwork === `/api/fast-english/artwork/${b1.id}`, 'episode.artwork');
    assert(d.variant?.id === b1.id, 'variant.id');
    assert(d.variant?.level === 'B1', 'variant.level');
    assert(d.variant?.summaryFa === 'خلاصه فارسی', 'variant.summaryFa');
    assert(d.variant?.transcript === 'b', 'variant.transcript');
    assert(d.variant?.publicationStatus === 'published', 'variant.publicationStatus');
    assert(d.variant?.audioDurationSeconds === 600, 'variant.audioDurationSeconds');
    assert(d.recommendedLevel === 'C2', `recommended=${d.recommendedLevel}`);
    assert(d.preferredLevel === 'B1', `preferred=${d.preferredLevel}`);
    assert(d.vocabularyCount === 1, `vocabularyCount=${d.vocabularyCount}`);
    // legacy fields preserved
    assert(d.topic?.title && d.body === 'b' && d.audio?.url, 'legacy fields');
  });
  const ds = JSON.stringify(detail.body);
  aScenario('no filesystem paths or internal names in detail', async () => {
    assert(!ds.includes('storage/'), 'storage leak');
    assert(!ds.includes('"fileName"'), 'fileName leak');
    assert(!ds.includes('recordId'), 'recordId leak');
  });

  // ---- 6/7. Category states ----
  const draftCatDetail = await jf(`/api/fast-english/lessons/${draftCatVariantId}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('Draft Category is hidden', async () => {
    await assertHttp(draftCatDetail, 404, 'draft category');
  });

  // ---- 8/9. Episode states ----
  const draftTopicLessons = await jf(
    `/api/collections/lessons/records?filter=(topic='${draftTopic.id}')&perPage=5`,
    { headers: { authorization: `Bearer ${su}` } },
  );
  const draftEpVariant = draftTopicLessons.body?.items?.[0];
  const draftEpDetail = await jf(`/api/fast-english/lessons/${draftEpVariant.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('Draft Episode is hidden', async () => {
    await assertHttp(draftEpDetail, 404, 'draft episode');
  });

  const archTopicLessons = await jf(
    `/api/collections/lessons/records?filter=(topic='${archTopic.id}')&perPage=5`,
    { headers: { authorization: `Bearer ${su}` } },
  );
  const archEpVariant = archTopicLessons.body?.items?.[0];
  const archEpDetail = await jf(`/api/fast-english/lessons/${archEpVariant.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('Archived Episode is hidden', async () => {
    await assertHttp(archEpDetail, 404, 'archived episode');
  });

  // ---- 10/11. Variant states ----
  const c1Detail = await jf(`/api/fast-english/lessons/${c1Draft.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('Draft Variant is hidden', async () => {
    await assertHttp(c1Detail, 404, 'draft variant');
  });

  const archLesson = await jf('/api/collections/lessons/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      topic: orderTopic.id,
      level: 'B2',
      title: 'To Archive',
      summary: 's',
      body: 'b',
      estimated_minutes: 10,
      status: 'draft',
    }),
  });
  const archLessonId = archLesson.body?.id;
  await multipartPatch(
    URL,
    `/api/collections/lessons/records/${archLessonId}`,
    su,
    'audio',
    't.mp3',
    'audio/mpeg',
    AUDIO_FIXTURE,
  );
  await jf(`/api/collections/lessons/records/${archLessonId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      status: 'published',
      audio_duration_seconds: 600,
      summary_fa: 'خلاصه',
      content_version: 1,
    }),
  });
  await jf(`/api/collections/lessons/records/${archLessonId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ status: 'archived' }),
  });
  const archVarDetail = await jf(`/api/fast-english/lessons/${archLessonId}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('Archived Variant is hidden', async () => {
    await assertHttp(archVarDetail, 404, 'archived variant');
  });

  // ---- 12/13. Cross-level access ----
  const recDetail = await jf(`/api/fast-english/lessons/${c2.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('active Student can access recommended Level (C2)', async () => {
    await assertHttp(recDetail, 200, 'recommended level');
  });
  const otherDetail = await jf(`/api/fast-english/lessons/${b2.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('active Student can access another Published Level (B2)', async () => {
    await assertHttp(otherDetail, 200, 'other level');
  });

  // ---- 14/15. Browsing does not change levels ----
  const levelCtxBefore = await jf('/api/fast-english/placement/level-context', {
    headers: { authorization: `Bearer ${sToken}` },
  });
  await jf(`/api/fast-english/lessons/${b2.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  await jf(`/api/fast-english/lessons/${c2.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  await jf(`/api/fast-english/lessons/${b1.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  const levelCtxAfter = await jf('/api/fast-english/placement/level-context', {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('browsing another Level does not change recommended Level', async () => {
    assert(
      levelCtxBefore.body?.suggestedLevel === 'C2',
      `before=${levelCtxBefore.body?.suggestedLevel}`,
    );
    assert(
      levelCtxAfter.body?.suggestedLevel === 'C2',
      `after=${levelCtxAfter.body?.suggestedLevel}`,
    );
  });
  aScenario('browsing another Level does not change preferred Level', async () => {
    assert(
      levelCtxBefore.body?.selectedLevel === 'B1',
      `before=${levelCtxBefore.body?.selectedLevel}`,
    );
    assert(
      levelCtxAfter.body?.selectedLevel === 'B1',
      `after=${levelCtxAfter.body?.selectedLevel}`,
    );
  });

  // ---- 16. Progress independence ----
  const p1 = await jf(`/api/fast-english/lessons/${b1.id}/progress`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${sToken}` },
    body: JSON.stringify({ positionSeconds: 100, expectedRevision: 0 }),
  });
  const p2 = await jf(`/api/fast-english/lessons/${b2.id}/progress`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${sToken}` },
    body: JSON.stringify({ positionSeconds: 250, expectedRevision: 0 }),
  });
  aScenario('B1 and B2 Progress are independent', async () => {
    assert(p1.status === 200 && p2.status === 200, `p1=${p1.status} p2=${p2.status}`);
    assert(p1.body?.positionSeconds === 100, `b1 pos=${p1.body?.positionSeconds}`);
    assert(p2.body?.positionSeconds === 250, `b2 pos=${p2.body?.positionSeconds}`);
  });
  const b1Read = await jf(`/api/fast-english/lessons/${b1.id}/progress`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  const b2Read = await jf(`/api/fast-english/lessons/${b2.id}/progress`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('Progress records stay per-Variant (B1 != B2)', async () => {
    assert(
      b1Read.body?.positionSeconds === 100 && b2Read.body?.positionSeconds === 250,
      'positions mixed',
    );
    assert(b1Read.body?.lessonId === b1.id && b2Read.body?.lessonId === b2.id, 'lesson link mixed');
  });
  // monotonic per variant
  await jf(`/api/fast-english/lessons/${b1.id}/progress`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${sToken}` },
    body: JSON.stringify({ positionSeconds: 50, expectedRevision: 1 }),
  });
  const b1After = await jf(`/api/fast-english/lessons/${b1.id}/progress`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('furthest position remains monotonic per Variant', async () => {
    assert(b1After.body?.furthestSeconds === 100, `furthest=${b1After.body?.furthestSeconds}`);
    assert(b1After.body?.positionSeconds === 50, `pos=${b1After.body?.positionSeconds}`);
  });

  // ---- 17. Audio cross-level ----
  const audioRes = await fetch(`${URL}/api/fast-english/lessons/${b2.id}/audio`, {
    headers: { authorization: `Bearer ${sToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  aScenario('audio access works for another Published Level', async () => {
    assert(audioRes.status === 200, `status=${audioRes.status}`);
  });

  // ---- 18/19. Expired / suspended ----
  const expiredStudent = await makeFullStudent(su, 'B1');
  const subs = await jf('/api/collections/subscriptions/records?perPage=50', {
    headers: { authorization: `Bearer ${su}` },
  });
  for (const sub of subs.body?.items || []) {
    if (sub.user === expiredStudent.userId) {
      await jf(`/api/collections/subscriptions/records/${sub.id}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${su}` },
        body: JSON.stringify({ expires_at: new Date(Date.now() - 86_400_000).toISOString() }),
      });
    }
  }
  const expDetail = await jf(`/api/fast-english/lessons/${b1.id}`, {
    headers: { authorization: `Bearer ${expiredStudent.token}` },
  });
  aScenario('expired Student remains denied', async () => {
    await assertHttp(expDetail, 403, 'expired');
  });

  const suspStudent = await makeFullStudent(su, 'B1');
  await jf(`/api/collections/fep_users/records/${suspStudent.userId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ account_status: 'suspended' }),
  });
  const suspDetail = await jf(`/api/fast-english/lessons/${b1.id}`, {
    headers: { authorization: `Bearer ${suspStudent.token}` },
  });
  aScenario('suspended Student remains denied', async () => {
    await assertHttp(suspDetail, 403, 'suspended');
  });

  // ---- 20. Staff Admin denied ----
  const staffList = await jf('/api/fast-english/lessons', {
    headers: { authorization: `Bearer ${staffToken}` },
  });
  const staffDetail = await jf(`/api/fast-english/lessons/${b1.id}`, {
    headers: { authorization: `Bearer ${staffToken}` },
  });
  aScenario('Staff Admin remains denied from Student Episode APIs', async () => {
    assert(staffList.status === 401 || staffList.status === 403, `list=${staffList.status}`);
    assert(
      staffDetail.status === 401 || staffDetail.status === 403,
      `detail=${staffDetail.status}`,
    );
  });

  // ---- 21. Vocabulary uniqueness ----
  const dupVocab = await jf('/api/collections/lesson_vocabulary/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      lesson: b1.id,
      term: 'hello',
      normalized_term: 'hello',
      meaning_fa: 'x',
      definition_en: 'y',
      sort_order: 0,
    }),
  });
  aScenario('vocabulary uniqueness works (lesson + normalized_term)', async () => {
    assert(dupVocab.status === 400 || dupVocab.status === 409, `status=${dupVocab.status}`);
  });
  const crossVocab = await jf('/api/collections/lesson_vocabulary/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      lesson: b2.id,
      term: 'Hello',
      normalized_term: 'hello',
      meaning_fa: 'سلام',
      definition_en: 'greeting',
      sort_order: 0,
    }),
  });
  aScenario('same term allowed for another Variant', () => assert(crossVocab.body?.id, 'no id'));

  // ---- 22. Unpublished vocabulary cannot leak ----
  const draftVariantDetail = await jf(`/api/fast-english/lessons/${c1Draft.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('unpublished Vocabulary cannot leak through public APIs', async () => {
    await assertHttp(draftVariantDetail, 404, 'draft variant with vocab');
  });
  const b1Detail2 = await jf(`/api/fast-english/lessons/${b1.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('published Variant exposes only its own vocabularyCount', async () => {
    assert(b1Detail2.body?.vocabularyCount === 1, `count=${b1Detail2.body?.vocabularyCount}`);
  });

  // ---- 23. availableLevels sanitized ----
  const avail = await jf(`/api/fast-english/lessons/${b1.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('availableLevels contains only Published Variants', async () => {
    const levels = (avail.body?.availableLevels || []).map((a) => a.level);
    assert(
      JSON.stringify(levels) === JSON.stringify(['B1', 'B2', 'C2']),
      `levels=${JSON.stringify(levels)}`,
    );
    const variantIds = (avail.body?.availableLevels || []).map((a) => a.variantId);
    assert(!variantIds.includes(c1Draft.id), 'draft variant id leaked');
  });
  aScenario('availableLevels flags isRecommended/isPreferred', async () => {
    const byLevel = {};
    for (const a of avail.body?.availableLevels || []) byLevel[a.level] = a;
    assert(byLevel.C2.isRecommended === true, 'C2 not recommended');
    assert(byLevel.B1.isPreferred === true, 'B1 not preferred');
    assert(
      byLevel.B2.isRecommended === false && byLevel.B2.isPreferred === false,
      'B2 flags wrong',
    );
  });

  // ---- 24. CEFR order ----
  const orderLessons = await jf(
    `/api/collections/lessons/records?filter=(topic='${orderTopic.id}')&perPage=10`,
    { headers: { authorization: `Bearer ${su}` } },
  );
  const orderA1 = (orderLessons.body?.items || []).find((l) => l.level === 'A1');
  const orderDetail = await jf(`/api/fast-english/lessons/${orderA1.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('availableLevels is in CEFR order', async () => {
    const levels = (orderDetail.body?.availableLevels || []).map((a) => a.level);
    assert(
      JSON.stringify(levels) === JSON.stringify(['A1', 'C2']),
      `levels=${JSON.stringify(levels)}`,
    );
  });

  // Lesson list level param
  const listB2 = await jf('/api/fast-english/lessons?level=B2', {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('lesson list ?level=B2 returns B2 variants', async () => {
    assert(listB2.status === 200, `status=${listB2.status}`);
    const lessons = listB2.body?.lessons || [];
    assert(lessons.length > 0 && lessons.every((l) => l.level === 'B2'), 'not all B2');
    assert(listB2.body?.level === 'B2', 'response level');
    assert(listB2.body?.recommendedLevel === 'C2', 'recommended in list');
    assert(listB2.body?.preferredLevel === 'B1', 'preferred in list');
  });
  const listDefault = await jf('/api/fast-english/lessons', {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('lesson list defaults to preferred Level (B1)', async () => {
    const lessons = listDefault.body?.lessons || [];
    assert(lessons.length > 0 && lessons.every((l) => l.level === 'B1'), 'default not B1');
  });
  const listInvalid = await jf('/api/fast-english/lessons?level=B9', {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('invalid browsing level rejected (400)', async () => {
    await assertHttp(listInvalid, 400, 'invalid level');
  });

  // ---- 25/26/27. Category archival + Progress survival + republish ----
  const progBefore = await jf(`/api/fast-english/lessons/${archCatVariant.id}/progress`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${sToken}` },
    body: JSON.stringify({ positionSeconds: 77, expectedRevision: 0 }),
  });
  aScenario('progress fixture on archive-category Variant', () =>
    assert(progBefore.status === 200, `status=${progBefore.status}`),
  );

  await jf(`/api/collections/categories/records/${archCat.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ publication_status: 'archived' }),
  });
  const hiddenDetail = await jf(`/api/fast-english/lessons/${archCatVariant.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('Category archival hides child content', async () => {
    await assertHttp(hiddenDetail, 404, 'archived category detail');
  });
  const hiddenList = await jf('/api/fast-english/lessons', {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('Category archival hides child content from lists', async () => {
    assert(
      !(hiddenList.body?.lessons || []).some((l) => l.id === archCatVariant.id),
      'still listed',
    );
  });
  const hiddenAudio = await fetch(`${URL}/api/fast-english/lessons/${archCatVariant.id}/audio`, {
    headers: { authorization: `Bearer ${sToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  aScenario('Category archival hides child audio', async () => {
    assert(hiddenAudio.status === 404, `status=${hiddenAudio.status}`);
  });
  const progRecs = await jf('/api/collections/lesson_progress/records?perPage=200', {
    headers: { authorization: `Bearer ${su}` },
  });
  const archProg = (progRecs.body?.items || []).filter((p) => p.lesson === archCatVariant.id);
  aScenario('Progress survives archival', async () => {
    assert(archProg.length === 1, `progress count=${archProg.length}`);
    assert(archProg[0].position_seconds === 77, 'progress value changed');
  });

  await jf(`/api/collections/categories/records/${archCat.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ publication_status: 'published' }),
  });
  const restoredDetail = await jf(`/api/fast-english/lessons/${archCatVariant.id}`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('republish restores existing Progress access', async () => {
    await assertHttp(restoredDetail, 200, 'restored detail');
  });
  const restoredProg = await jf(`/api/fast-english/lessons/${archCatVariant.id}/progress`, {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario('republish restores the same Progress values', async () => {
    assert(restoredProg.body?.positionSeconds === 77, `pos=${restoredProg.body?.positionSeconds}`);
    assert(
      restoredProg.body?.furthestSeconds === 77,
      `furthest=${restoredProg.body?.furthestSeconds}`,
    );
  });

  // ---- 28. Direct Student CRUD denied ----
  const studentCreateCat = await jf('/api/collections/categories/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${sToken}` },
    body: JSON.stringify({ key: 'x', slug: 'x', title_fa: 'x', publication_status: 'draft' }),
  });
  const studentPatchTopic = await jf(`/api/collections/topics/records/${mainTopicId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${sToken}` },
    body: JSON.stringify({ title_fa: 'hack' }),
  });
  const studentPatchLesson = await jf(`/api/collections/lessons/records/${b1.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${sToken}` },
    body: JSON.stringify({ summary_fa: 'hack' }),
  });
  const studentCreateVocab = await jf('/api/collections/lesson_vocabulary/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${sToken}` },
    body: JSON.stringify({
      lesson: b1.id,
      term: 'x',
      normalized_term: 'x',
      meaning_fa: 'x',
      definition_en: 'x',
    }),
  });
  const studentListTopics = await jf('/api/collections/topics/records', {
    headers: { authorization: `Bearer ${sToken}` },
  });
  const studentListLessons = await jf('/api/collections/lessons/records', {
    headers: { authorization: `Bearer ${sToken}` },
  });
  aScenario(
    'direct Student CRUD remains denied (categories/topics/lessons/vocabulary)',
    async () => {
      assert(studentCreateCat.status >= 400, `create cat=${studentCreateCat.status}`);
      assert(studentPatchTopic.status >= 400, `patch topic=${studentPatchTopic.status}`);
      assert(studentPatchLesson.status >= 400, `patch lesson=${studentPatchLesson.status}`);
      assert(studentCreateVocab.status >= 400, `create vocab=${studentCreateVocab.status}`);
      assert(studentListTopics.status >= 400, `list topics=${studentListTopics.status}`);
      assert(studentListLessons.status >= 400, `list lessons=${studentListLessons.status}`);
    },
  );
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n=== Podcast Domain Smoke Test ===\n');

  console.log('-- Part 1: migration backfill proof (disposable pre/post stage) --');
  await runMigrationBackfillProof();

  console.log('-- Part 2: domain scenarios --');
  await runDomainScenarios();

  const skipped = total - passed - failed;
  console.log(`\nResults: ${passed}/${total} passed, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) {
    console.error(`FAILED: ${failed} checks failed`);
    process.exit(1);
  }
  console.log('All checks passed.\n');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
