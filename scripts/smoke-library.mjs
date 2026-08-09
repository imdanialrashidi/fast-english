#!/usr/bin/env node
// scripts/smoke-library.mjs — Podcast Slice 6 backend smoke suite.
//
// Proves the Library & Discovery contract against a real disposable
// PocketBase (no mocks, no Production-like shared records):
//   1.  unauthenticated Student is denied
//   2.  default discovery returns one canonical item per Episode
//   3.  one Episode with multiple published Levels -> exactly one item
//   4.  Published Categories only (draft/archived absent) + counts
//   5.  Published Episodes only (draft/archived Topics absent)
//   6.  Published Variants only (draft Variant id never in availableLevels)
//   7.  publication filtering happens BEFORE pagination
//   8.  deterministic pagination (identical order across requests)
//   9.  suggested sort (featured first, preferred compatibility)
//  10.  latest sort uses the authoritative published date
//  11.  search by Persian metadata
//  12.  search by English metadata (case-insensitive)
//  13.  search with no match -> empty result with totalItems 0
//  14.  query length is bounded (400)
//  15.  Category filter narrows to the Category
//  16.  archived Category id -> empty result, never listed
//  17.  explicit Level filter resolves that published Variant
//  18.  explicit Level with no published Variant -> empty result
//  19.  preferred -> recommended -> first-CEFR fallback chain
//  20.  Progress filter (not_started / in_progress / completed)
//  21.  per-Variant Progress isolation (B1 never leaks into A1)
//  22.  Continue Listening rail: bounded, in-progress only
//  23.  browsing never mutates recommended/preferred levels
//  24.  expired / pending Students remain denied
//  25.  Staff Admin + legacy Staff tokens remain denied
//  26.  invalid enums -> 400; page/perPage clamped into bounds
//  27.  responses are sanitized (no body/audio/internal metadata)
//
// Usage: bash scripts/smoke-placement.sh node scripts/smoke-library.mjs

import {
  fetchJson,
  getStaffToken,
  getSuperuserToken,
  nextPhone,
  randomId,
} from './smoke-common.mjs';

const URL = process.env.PB_SMOKE_URL;

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let total = 0,
  passed = 0,
  failed = 0;

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
    console.log(`       ${err?.message ? err.message : String(err)}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

async function assertHttp(res, expected, msg) {
  if (res.status !== expected)
    throw new Error(
      `${msg}: expected ${expected}, got ${res.status}, body=${JSON.stringify(res.body).slice(0, 300)}`,
    );
}

// ---------------------------------------------------------------------------
// Fixtures (all disposable, owned by this suite)
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

async function multipartPatch(path, su, field, filename, mime, bytes) {
  const boundary = `--FB${randomId()}`;
  const buf = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await fetch(`${URL}${path}`, {
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
      publication_status: 'draft',
      ...overrides,
    }),
  });
  if (!r.body?.id) throw new Error(`category create: ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body;
}

async function makeTopic(su, categoryId, overrides = {}) {
  const cr = await jf('/api/collections/topics/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      title: overrides.title || `T ${randomId()}`,
      slug: `t-${randomId()}`,
      description: 'd',
      sort_order: overrides.sort_order ?? 0,
      status: 'draft',
      // Set at create (even for drafts): the unique content_key index
      // rejects a second empty value, and draft fixtures stay un-published.
      content_key: overrides.content_key || `fx-${randomId()}`,
    }),
  });
  if (!cr.body?.id) throw new Error(`topic create: ${JSON.stringify(cr.body).slice(0, 200)}`);
  const id = cr.body.id;
  if (overrides.keepDraft) return { id, body: cr.body };

  await multipartPatch(
    `/api/collections/topics/records/${id}`,
    su,
    'artwork_square',
    'art.png',
    'image/png',
    PNG,
  );
  const patch = {
    status: overrides.status || 'published',
    category: categoryId,
    content_key: overrides.content_key || `fx-${randomId()}`,
    content_version: 1,
    title_fa: overrides.title_fa || 'عنوان اپیزود',
    description_fa: overrides.description_fa || 'توضیح اپیزود',
  };
  if (overrides.published_at) patch.published_at = overrides.published_at;
  if (overrides.is_featured) patch.is_featured = true;
  const pr = await jf(`/api/collections/topics/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200)
    throw new Error(`topic publish: ${pr.status} ${JSON.stringify(pr.body).slice(0, 200)}`);
  return { id, body: pr.body };
}

async function makeLesson(su, topicId, overrides = {}) {
  const cr = await jf('/api/collections/lessons/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      topic: topicId,
      level: overrides.level || 'B1',
      title: overrides.title || `L ${randomId()}`,
      summary: 's',
      body: 'b',
      estimated_minutes: 10,
      status: 'draft',
    }),
  });
  if (!cr.body?.id) throw new Error(`lesson create: ${JSON.stringify(cr.body).slice(0, 200)}`);
  const id = cr.body.id;
  await multipartPatch(
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
  const pr = await jf(`/api/collections/lessons/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200)
    throw new Error(`lesson publish: ${pr.status} ${JSON.stringify(pr.body).slice(0, 200)}`);
  return { id, body: pr.body };
}

// Fully-entitled Student with recommended=C2 (all-correct placement) and
// selected (preferred) level A1 — recommended and preferred are distinct.
async function makeStudent(su) {
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
  const approve = await jf(
    `/api/fast-english/operator/payment-requests/${prj?.request?.id}/approve`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({}),
    },
  );
  if (approve.status !== 200) throw new Error(`approve: ${approve.status}`);

  const refresh = await jf('/api/collections/fep_users/auth-refresh', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const refreshedToken = refresh.body?.token || token;

  for (let i = 0; i < 20; i++) {
    await jf('/api/collections/placement_questions/records', {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        question_key: `q${String(i).padStart(2, '0')}`,
        version: 1,
        position: i + 1,
        prompt: `Q${i + 1}`,
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
          { id: 'c', text: 'C' },
          { id: 'd', text: 'D' },
        ],
        options_text: JSON.stringify([
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
          { id: 'c', text: 'C' },
          { id: 'd', text: 'D' },
        ]),
        correct_option_id: 'a',
        is_active: true,
      }),
    });
  }

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
  await jf(`/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
    body: JSON.stringify({ expectedRevision: rev }),
  });
  const lr = await jf('/api/fast-english/placement/selected-level', {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
    body: JSON.stringify({ selectedLevel: 'A1' }),
  });
  if (lr.status !== 200) throw new Error(`level select: ${lr.status}`);

  return { phone: canonicalPhone, password, token: refreshedToken, userId };
}

async function saveProgress(token, lessonId, positionSeconds) {
  const r = await jf(`/api/fast-english/lessons/${lessonId}/progress`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ positionSeconds, expectedRevision: 0 }),
  });
  if (r.status !== 200) throw new Error(`progress save: ${r.status}`);
  return r.body;
}

function library(token, params) {
  return jf(`/api/fast-english/library?${new URLSearchParams(params).toString()}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
let su;
let student; // preferred A1, recommended C2
let catA, catB, catArchived;
let ep; // id map
let varId; // variant id map
const VISIBLE_EPISODE_KEYS = [
  'ep1',
  'ep2',
  'ep3',
  'ep4',
  'ep5',
  'ep8',
  'ep9',
  'ep10',
  'ep11',
  'ep12',
];
const ALL_VISIBLE = new Set();

const MAIN = async () => {
  su = await getSuperuserToken(URL);
  assert(su, 'superuser token');

  catA = await makeCategory(su, {
    key: 'cat-alpha',
    slug: 'cat-alpha',
    title_fa: 'دسته آلفا',
    sort_order: 1,
    publication_status: 'published',
  });
  catB = await makeCategory(su, {
    key: 'cat-beta',
    slug: 'cat-beta',
    title_fa: 'دسته بتا',
    sort_order: 2,
    publication_status: 'published',
  });
  await makeCategory(su, {
    key: 'cat-draft',
    slug: 'cat-draft',
    title_fa: 'دسته پیشنویس',
  });
  catArchived = await makeCategory(su, {
    key: 'cat-arch',
    slug: 'cat-arch',
    title_fa: 'دسته بایگانیشده',
    publication_status: 'published',
  });
  await jf(`/api/collections/categories/records/${catArchived.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ publication_status: 'archived' }),
  });

  const mkEp = async (key, categoryId, overrides = {}) => {
    const t = await makeTopic(su, categoryId, overrides);
    ep[key] = t.id;
    return t.id;
  };

  ep = {};
  varId = {};
  await mkEp('ep1', catA.id, {
    title: 'Alpha Episode',
    title_fa: 'اپیزود آلفا',
    sort_order: 1,
    published_at: '2026-01-10T00:00:00.000Z',
    is_featured: true,
  });
  await mkEp('ep2', catA.id, {
    title: 'Beta Episode',
    title_fa: 'اپیزود بتا',
    sort_order: 2,
    published_at: '2026-01-09T00:00:00.000Z',
  });
  await mkEp('ep3', catB.id, {
    title: 'Gamma Episode',
    title_fa: 'اپیزود گاما',
    sort_order: 3,
    published_at: '2026-01-08T00:00:00.000Z',
  });
  await mkEp('ep4', catB.id, {
    title: 'Delta Episode',
    title_fa: 'اپیزود دلتا',
    sort_order: 4,
    published_at: '2026-01-07T00:00:00.000Z',
  });
  await mkEp('ep5', catA.id, {
    title: 'Epsilon Episode',
    title_fa: 'اپیزود اپسیلون',
    sort_order: 5,
    published_at: '2026-01-06T00:00:00.000Z',
  });
  // Draft Topic with a draft Variant -> hidden everywhere.
  {
    const draftTopic = await makeTopic(su, catA.id, {
      title: 'Draft Topic',
      title_fa: 'اپیزود پیشنویس',
      keepDraft: true,
      sort_order: 99,
    });
    ep.draft = draftTopic.id;
  }
  // Archived Topic -> hidden everywhere (Progress would survive; not needed here).
  {
    const archTopic = await makeTopic(su, catA.id, {
      title: 'Archived Topic',
      title_fa: 'اپیزود بایگانیشده',
      published_at: '2026-01-05T00:00:00.000Z',
      sort_order: 100,
    });
    ep.archived = archTopic.id;
    const archLesson = await makeLesson(su, archTopic.id, { level: 'A1' });
    await jf(`/api/collections/topics/records/${archTopic.id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({ status: 'archived' }),
    });
    assert(archLesson.id, 'archived lesson created');
  }
  await mkEp('ep8', catB.id, {
    title: 'Search Episode',
    title_fa: 'اپیزود جستجوی ویژه',
    sort_order: 6,
    published_at: '2026-01-04T00:00:00.000Z',
  });
  await mkEp('ep9', catA.id, {
    title: 'Eta Episode',
    title_fa: 'اپیزود حتا',
    sort_order: 7,
    published_at: '2026-01-03T00:00:00.000Z',
  });
  await mkEp('ep10', catA.id, {
    title: 'Theta Episode',
    title_fa: 'اپیزود تتا',
    sort_order: 8,
    published_at: '2026-01-02T00:00:00.000Z',
  });
  await mkEp('ep11', catA.id, {
    title: 'Iota Episode',
    title_fa: 'اپیزود یوتا',
    sort_order: 9,
    published_at: '2026-01-01T12:00:00.000Z',
  });
  await mkEp('ep12', catA.id, {
    title: 'Kappa Episode',
    title_fa: 'اپیزود کاپا',
    sort_order: 10,
    published_at: '2026-01-01T00:00:00.000Z',
  });

  for (const key of VISIBLE_EPISODE_KEYS) ALL_VISIBLE.add(ep[key]);

  const mkVar = async (key, level, opts = {}) => {
    const l = await makeLesson(su, ep[key], { level, ...opts });
    varId[`${key}:${level}`] = l.id;
    return l.id;
  };

  // ep1: three published Levels (the canonical-grouping Episode).
  await mkVar('ep1', 'A1');
  await mkVar('ep1', 'B1');
  await mkVar('ep1', 'C1');
  // ep2: one published Level.
  await mkVar('ep2', 'A1');
  // ep3: two published Levels (A2 before B1 in CEFR order).
  await mkVar('ep3', 'A2');
  await mkVar('ep3', 'B1');
  // ep4: only C1 (first-CEFR fallback for a preferred/recommended miss).
  await mkVar('ep4', 'C1');
  // ep5: one published + one draft Variant (draft id must never surface).
  await mkVar('ep5', 'A1');
  await mkVar('ep5', 'B1', { keepDraft: true });
  await mkVar('ep8', 'A2');
  await mkVar('ep9', 'A1');
  await mkVar('ep9', 'B1');
  await mkVar('ep10', 'A1');
  await mkVar('ep11', 'A1');
  await mkVar('ep12', 'A1');

  student = await makeStudent(su);

  // Progress fixtures: independent per Variant.
  //   ep9 B1: in progress (150s of 600)
  //   ep2 A1: completed (600 of 600)
  //   ep3 A2: in progress (30s)
  //   ep8 A2: in progress (10s)
  //   ep12 A1: in progress (5s)  -> 4th candidate for the Continue cap
  await saveProgress(student.token, varId['ep9:B1'], 150);
  await saveProgress(student.token, varId['ep2:A1'], 600);
  await saveProgress(student.token, varId['ep3:A2'], 30);
  await saveProgress(student.token, varId['ep8:A2'], 10);
  await saveProgress(student.token, varId['ep12:A1'], 5);

  // ------------------------------------------------------------------
  // Scenarios
  // ------------------------------------------------------------------
  await aScenario('01. unauthenticated Student is denied', async () => {
    const res = await jf('/api/fast-english/library');
    await assertHttp(res, 401, 'unauthenticated');
  });

  await aScenario('02. default discovery: one canonical item per Episode', async () => {
    const res = await library(student.token, {});
    await assertHttp(res, 200, 'default library');
    const body = res.body;
    assert(body.totalItems === 10, `totalItems=${body.totalItems} (expected 10)`);
    assert(body.items.length === 10, `items=${body.items.length}`);
    const ids = new Set(body.items.map((i) => i.episode.id));
    assert(ids.size === 10, 'one item per Episode (no duplicates)');
    for (const key of VISIBLE_EPISODE_KEYS) assert(ids.has(ep[key]), `missing ${key}`);
    assert(!ids.has(ep.archived) && !ids.has(ep.draft), 'no hidden Episodes');
    assert(body.page === 1 && body.perPage === 20, 'default pagination');
    assert(body.preferredLevel === 'A1' && body.recommendedLevel === 'C2', 'level echo');
  });

  await aScenario('03. Episode with three published Levels -> exactly one item', async () => {
    const res = await library(student.token, {});
    const item = res.body.items.find((i) => i.episode.id === ep.ep1);
    assert(item, 'ep1 present');
    assert(item.availableLevels.map((l) => l.level).join(',') === 'A1,B1,C1', 'CEFR order');
    assert(
      item.availableLevels.map((l) => l.variantId).join(',') ===
        [varId['ep1:A1'], varId['ep1:B1'], varId['ep1:C1']].join(','),
      'published Variant ids only',
    );
    assert(item.resolvedVariant.level === 'A1', 'resolved to preferred level');
    assert(item.resolvedVariant.id === varId['ep1:A1'], 'resolved variant id');
    assert(item.resolvedVariant.isPreferred === true, 'isPreferred flag');
    assert(item.resolvedVariant.durationSeconds === 600, 'duration for resolved Variant');
  });

  await aScenario('04. published Categories only, with Episode counts', async () => {
    const res = await library(student.token, {});
    const cats = res.body.categories;
    const titles = cats.map((c) => c.titleFa).join(',');
    assert(titles.includes('دسته آلفا') && titles.includes('دسته بتا'), 'published categories');
    assert(!titles.includes('پیشنویس') && !titles.includes('بایگانیشده'), 'no draft/archived');
    const alpha = cats.find((c) => c.id === catA.id);
    const beta = cats.find((c) => c.id === catB.id);
    assert(alpha && alpha.episodeCount === 7, `catA count=${alpha?.episodeCount} (7)`);
    assert(beta && beta.episodeCount === 3, `catB count=${beta?.episodeCount} (3)`);
  });

  await aScenario('05. published Episodes only (draft/archived Topics absent)', async () => {
    const res = await library(student.token, {});
    const ids = res.body.items.map((i) => i.episode.id);
    assert(!ids.includes(ep.draft) && !ids.includes(ep.archived), 'hidden Episodes absent');
  });

  await aScenario('06. published Variants only (draft Variant id never surfaces)', async () => {
    const res = await library(student.token, {});
    const item = res.body.items.find((i) => i.episode.id === ep.ep5);
    assert(item, 'ep5 present');
    assert(
      item.availableLevels.length === 1 && item.availableLevels[0].level === 'A1',
      'draft B1 excluded',
    );
    const allVariantIds = new Set();
    for (const i of res.body.items) {
      allVariantIds.add(i.resolvedVariant.id);
      for (const l of i.availableLevels) allVariantIds.add(l.variantId);
    }
    assert(!allVariantIds.has(varId['ep5:B1']), 'draft Variant id never exposed');
  });

  await aScenario('07. publication filtering happens BEFORE pagination', async () => {
    // Hidden records (draft Topic, archived Topic, draft Variant) must not
    // consume page slots: pages over the visible set must contain exactly
    // the 12 visible Episodes and totalItems must be 12.
    const seen = [];
    let total = 0;
    for (let page = 1; page <= 3; page++) {
      const res = await library(student.token, {
        page: String(page),
        perPage: '5',
        sort: 'latest',
      });
      await assertHttp(res, 200, `page ${page}`);
      total = res.body.totalItems;
      for (const i of res.body.items) seen.push(i.episode.id);
    }
    assert(total === 10, `totalItems=${total} (hidden records never counted)`);
    assert(seen.length === 10, '10 visible slots across pages');
    assert(new Set(seen).size === 10, 'no duplicates across pages');
    for (const key of VISIBLE_EPISODE_KEYS) assert(seen.includes(ep[key]), `slot ${key}`);
  });

  await aScenario('08. deterministic pagination and latest sort', async () => {
    const expected = [...VISIBLE_EPISODE_KEYS].sort((a, b) => {
      const dates = {
        ep1: '2026-01-10',
        ep2: '2026-01-09',
        ep3: '2026-01-08',
        ep4: '2026-01-07',
        ep8: '2026-01-04',
        ep9: '2026-01-03',
        ep10: '2026-01-02',
        ep11: '2026-01-01T12',
        ep12: '2026-01-01T00',
        ep5: '2026-01-06',
      };
      if (dates[a] !== dates[b]) return dates[a] > dates[b] ? -1 : 1;
      return a < b ? -1 : 1;
    });
    const run1 = await library(student.token, { sort: 'latest', perPage: '20' });
    const run2 = await library(student.token, { sort: 'latest', perPage: '20' });
    const ids1 = run1.body.items.map((i) => i.episode.id);
    const ids2 = run2.body.items.map((i) => i.episode.id);
    assert(JSON.stringify(ids1) === JSON.stringify(ids2), 'identical order across requests');
    const expectedIds = expected.map((k) => ep[k]);
    assert(
      JSON.stringify(ids1) === JSON.stringify(expectedIds),
      `latest order = ${ids1.join(',')}`,
    );
  });

  await aScenario('09. suggested sort: featured first, then preferred compatibility', async () => {
    const res = await library(student.token, { sort: 'suggested', perPage: '20' });
    const ids = res.body.items.map((i) => i.episode.id);
    assert(ids[0] === ep.ep1, 'featured Episode first');
    const first = res.body.items[0];
    assert(first.episode.featured === true, 'featured flag');
    // preferred-compatible group: ep2, ep5, ep9, ep10-12 (resolved A1).
    const prefGroup = ids.slice(1, 8);
    for (const key of ['ep2', 'ep5', 'ep9', 'ep10', 'ep11', 'ep12']) {
      assert(prefGroup.includes(ep[key]), `${key} in preferred group`);
    }
    // non-preferred resolved Episodes come after: ep3, ep4, ep8.
    for (const key of ['ep3', 'ep4', 'ep8']) {
      assert(ids.indexOf(ep[key]) > ids.indexOf(ep.ep9), `${key} after preferred group`);
    }
  });

  await aScenario('10. search by Persian metadata', async () => {
    const res = await library(student.token, { q: 'جستجوی ویژه' });
    await assertHttp(res, 200, 'search');
    assert(res.body.totalItems === 1, `totalItems=${res.body.totalItems}`);
    assert(res.body.items[0].episode.id === ep.ep8, 'only the matching Episode');
  });

  await aScenario('11. search by English metadata (case-insensitive)', async () => {
    const res = await library(student.token, { q: 'BETA' });
    assert(res.body.totalItems === 1 && res.body.items[0].episode.id === ep.ep2, 'beta match');
    const res2 = await library(student.token, { q: 'alpha' });
    assert(res2.body.totalItems === 1 && res2.body.items[0].episode.id === ep.ep1, 'alpha match');
  });

  await aScenario('12. search with no match -> empty result', async () => {
    const res = await library(student.token, { q: 'zqx-nothing-matches' });
    await assertHttp(res, 200, 'no-match search');
    assert(res.body.totalItems === 0 && res.body.items.length === 0, 'empty result');
  });

  await aScenario('13. query length is bounded', async () => {
    const res = await library(student.token, { q: 'x'.repeat(61) });
    await assertHttp(res, 400, 'over-long query');
    assert(res.body.code === 'query_too_long', 'query_too_long code');
  });

  await aScenario('14. Category filter narrows to the Category', async () => {
    const res = await library(student.token, { category: catA.id });
    await assertHttp(res, 200, 'category filter');
    assert(res.body.totalItems === 7, `catA totalItems=${res.body.totalItems}`);
    for (const i of res.body.items) assert(i.episode.category.id === catA.id, 'category matches');
  });

  await aScenario('15. archived Category id -> empty result, never listed', async () => {
    const res = await library(student.token, { category: catArchived.id });
    await assertHttp(res, 200, 'archived category');
    assert(res.body.totalItems === 0 && res.body.items.length === 0, 'no archived content');
    assert(!res.body.categories.some((c) => c.id === catArchived.id), 'not in categories');
  });

  await aScenario('16. explicit Level filter resolves that published Variant', async () => {
    const res = await library(student.token, { level: 'B1' });
    await assertHttp(res, 200, 'level B1');
    const ids = res.body.items.map((i) => i.episode.id);
    assert(ids.includes(ep.ep1) && ids.includes(ep.ep3) && ids.includes(ep.ep9), 'B1 Episodes');
    for (const i of res.body.items) {
      assert(i.resolvedVariant.level === 'B1', 'resolved to the explicit level');
      assert(i.resolvedVariant.isPreferred === false, 'no preferred flag for explicit level');
    }
    const ep3Item = res.body.items.find((i) => i.episode.id === ep.ep3);
    assert(ep3Item.resolvedVariant.id === varId['ep3:B1'], 'explicit Variant used');
    // availableLevels stays complete under an explicit Level filter
    // (independent of the filter, for the Level Switcher data).
    const ep1Item = res.body.items.find((i) => i.episode.id === ep.ep1);
    assert(
      ep1Item.availableLevels.map((l) => l.level).join(',') === 'A1,B1,C1',
      'availableLevels complete under level filter',
    );
  });

  await aScenario('17. explicit Level with no published Variant -> empty result', async () => {
    const res = await library(student.token, { level: 'C2' });
    await assertHttp(res, 200, 'level C2');
    assert(res.body.totalItems === 0 && res.body.items.length === 0, 'no C2 published');
  });

  await aScenario('18. preferred -> recommended -> first-CEFR fallback chain', async () => {
    const res = await library(student.token, {});
    const resolvedOf = (key) =>
      res.body.items.find((i) => i.episode.id === ep[key])?.resolvedVariant.level;
    // preferred (A1) published -> preferred wins.
    assert(resolvedOf('ep1') === 'A1', 'ep1 -> A1 (preferred)');
    assert(resolvedOf('ep2') === 'A1', 'ep2 -> A1 (preferred)');
    // preferred A1 missing, recommended C2 missing -> first published CEFR.
    assert(resolvedOf('ep3') === 'A2', 'ep3 -> A2 (first CEFR)');
    assert(resolvedOf('ep4') === 'C1', 'ep4 -> C1 (first CEFR)');
    assert(resolvedOf('ep8') === 'A2', 'ep8 -> A2 (first CEFR)');
    // preferred published on one of two levels -> preferred wins over CEFR.
    assert(resolvedOf('ep9') === 'A1', 'ep9 -> A1 (preferred over B1)');
    // isRecommended flag on the resolved Variant.
    const ep4Item = res.body.items.find((i) => i.episode.id === ep.ep4);
    assert(ep4Item.resolvedVariant.isRecommended === false, 'C1 is not recommended (C2 is)');
  });

  await aScenario('19. Progress filter over the resolved Variant', async () => {
    const inProg = await library(student.token, { progress: 'in_progress' });
    assert(inProg.body.totalItems === 3, `in_progress=${inProg.body.totalItems} (ep3, ep8, ep12)`);
    const inIds = inProg.body.items.map((i) => i.episode.id);
    assert(
      inIds.includes(ep.ep3) && inIds.includes(ep.ep8) && inIds.includes(ep.ep12),
      'resolved in_progress set',
    );
    assert(!inIds.includes(ep.ep2), 'completed Episode excluded from in_progress');

    const done = await library(student.token, { progress: 'completed' });
    assert(done.body.totalItems === 1 && done.body.items[0].episode.id === ep.ep2, 'completed set');

    const fresh = await library(student.token, { progress: 'not_started' });
    assert(fresh.body.totalItems === 6, `not_started=${fresh.body.totalItems}`);
  });

  await aScenario('20. per-Variant Progress isolation (B1 never leaks into A1)', async () => {
    // Progress lives on ep9's B1 Variant only.
    const defaultView = await library(student.token, {});
    const ep9Default = defaultView.body.items.find((i) => i.episode.id === ep.ep9);
    assert(ep9Default.resolvedVariant.level === 'A1', 'default resolves A1');
    assert(ep9Default.resolvedVariant.progress.state === 'not_started', 'A1 progress untouched');
    assert(ep9Default.resolvedVariant.progress.positionSeconds === 0, 'no B1 position leak');

    const b1View = await library(student.token, { level: 'B1' });
    const ep9B1 = b1View.body.items.find((i) => i.episode.id === ep.ep9);
    assert(ep9B1.resolvedVariant.progress.state === 'in_progress', 'B1 progress visible on B1');
    assert(ep9B1.resolvedVariant.progress.positionSeconds === 150, 'B1 position 150');
    assert(
      ep9B1.resolvedVariant.progress.percent === 25,
      `B1 percent=${ep9B1.resolvedVariant.progress.percent}`,
    );

    // progress=in_progress at the default level excludes ep9 (its resolved
    // A1 Variant is not started); combined with level=B1 it includes it.
    const mix = await library(student.token, { progress: 'in_progress', level: 'B1' });
    const mixIds = mix.body.items.map((i) => i.episode.id);
    assert(mixIds.includes(ep.ep9), 'B1 filter reveals the B1 progress');
  });

  await aScenario('21. Continue Listening rail: bounded, in-progress only', async () => {
    const res = await library(student.token, {});
    const rail = res.body.continueListening;
    assert(Array.isArray(rail) && rail.length === 3, `continue length=${rail.length} (cap 3)`);
    for (const item of rail) {
      assert(item.progress.state === 'in_progress', 'only in-progress items');
      assert(item.progress.completed === false, 'never completed');
      assert(item.variant.id && item.episode.id && item.episode.artwork, 'shape complete');
    }
    const railIds = rail.map((i) => i.variant.id);
    assert(!railIds.includes(varId['ep2:A1']), 'completed Variant never resumable');
    const railEpIds = new Set(rail.map((i) => i.episode.id));
    // The four candidates (ep9 B1, ep3 A2, ep8 A2, ep12 A1) are all
    // in-progress; the rail draws exactly 3 of them, never completed ones.
    assert(railEpIds.size === 3, 'rail draws only from in-progress candidates');
  });

  await aScenario('22. browsing never mutates recommended/preferred levels', async () => {
    for (const level of ['A2', 'B1', 'C1', 'all', 'preferred']) {
      const res = await library(student.token, { level });
      await assertHttp(res, 200, `browse ${level}`);
    }
    const me = await jf(`/api/collections/fep_users/records/${student.userId}`, {
      headers: { authorization: `Bearer ${student.token}` },
    });
    await assertHttp(me, 200, 'read own record');
    assert(me.body.selected_level === 'A1', `selected_level unchanged (${me.body.selected_level})`);
    assert(
      me.body.suggested_level === 'C2',
      `suggested_level unchanged (${me.body.suggested_level})`,
    );
    assert(me.body.placement_completed === true, 'placement untouched');
  });

  await aScenario('23. expired and pending Students remain denied', async () => {
    // Expired: signup -> superuser marks account_status expired.
    {
      const phone = nextPhone();
      const password = 'Test1234!';
      const signup = await jf('/api/collections/fep_users/records', {
        method: 'POST',
        body: JSON.stringify({ name: 'E', phone, password, passwordConfirm: password }),
      });
      const uid = signup.body?.id;
      await jf(`/api/collections/fep_users/records/${uid}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${su}` },
        body: JSON.stringify({ account_status: 'expired' }),
      });
      const login = await jf('/api/collections/fep_users/auth-with-password', {
        method: 'POST',
        body: JSON.stringify({ identity: signup.body.phone, password }),
      });
      const res = await library(login.body.token, {});
      await assertHttp(res, 403, 'expired Student');
    }
    // Pending payment: fresh signup only.
    {
      const phone = nextPhone();
      const password = 'Test1234!';
      const signup = await jf('/api/collections/fep_users/records', {
        method: 'POST',
        body: JSON.stringify({ name: 'P', phone, password, passwordConfirm: password }),
      });
      const login = await jf('/api/collections/fep_users/auth-with-password', {
        method: 'POST',
        body: JSON.stringify({ identity: signup.body.phone, password }),
      });
      const res = await library(login.body.token, {});
      await assertHttp(res, 403, 'pending Student');
    }
  });

  await aScenario('24. Staff Admin and legacy Staff tokens remain denied', async () => {
    const staffToken = await getStaffToken(URL, su);
    const res = await library(staffToken, {});
    await assertHttp(res, 403, 'staff admin token');

    // Legacy fep_users operator token is rejected by requireStudent.
    const legacyPhone = nextPhone();
    const legacy = await jf('/api/collections/fep_users/records', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Legacy Op',
        phone: legacyPhone,
        password: 'Test1234!',
        passwordConfirm: 'Test1234!',
      }),
    });
    await jf(`/api/collections/fep_users/records/${legacy.body.id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({ role: 'operator', account_status: 'active' }),
    });
    const legacyLogin = await jf('/api/collections/fep_users/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: legacy.body.phone, password: 'Test1234!' }),
    });
    const res2 = await library(legacyLogin.body.token, {});
    await assertHttp(res2, 403, 'legacy operator token');
  });

  await aScenario('25. invalid enums -> 400; page/perPage clamped into bounds', async () => {
    for (const [params, code] of [
      [{ level: 'XYZ' }, 'invalid_level'],
      [{ progress: 'weird' }, 'invalid_progress'],
      [{ sort: 'popular' }, 'invalid_sort'],
    ]) {
      const res = await library(student.token, params);
      await assertHttp(res, 400, `bad ${Object.keys(params)[0]}`);
      assert(res.body.code === code, `code ${res.body.code}`);
    }
    const low = await library(student.token, { page: '0', perPage: '0' });
    assert(low.body.page === 1 && low.body.perPage === 1, 'clamped to minimums');
    const high = await library(student.token, { page: '999', perPage: '999' });
    assert(high.body.page === 50 && high.body.perPage === 50, 'clamped to maximums');
  });

  await aScenario('26. responses are sanitized', async () => {
    const res = await library(student.token, {});
    const json = JSON.stringify(res.body);
    for (const leak of [
      '"body"',
      '"audio"',
      'content_version',
      'storage',
      'summary_fa',
      'transcript',
    ]) {
      assert(!json.includes(leak), `no ${leak} leak`);
    }
    for (const i of res.body.items) {
      assert(
        String(i.episode.artwork).startsWith('/api/fast-english/artwork/'),
        'proxy artwork only',
      );
    }
    const cats = res.body.categories;
    assert(
      cats.every((c) => !('cover_image' in c)),
      'no raw category cover fields',
    );
  });

  await aScenario('27. empty query returns the normal discovery', async () => {
    const a = await library(student.token, { q: '' });
    const b = await library(student.token, {});
    assert(a.body.totalItems === b.body.totalItems, 'empty q == no q');
    assert(a.body.totalItems === 10, 'full discovery');
  });

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log(`\nsmoke-library: ${passed}/${total} scenarios passed`);
  if (failed > 0) {
    console.error(`smoke-library: ${failed} FAILED`);
    process.exit(1);
  }
};

MAIN().catch((err) => {
  console.error('smoke-library: fatal', err);
  process.exit(1);
});
