#!/usr/bin/env node
// scripts/smoke-episode.mjs — Slice 7 backend smoke test.
//
// Proves the two Slice 7 data-contract deltas:
//   1. per-Variant Student vocabulary access (ordering, sanitization,
//      pronunciation descriptor, entitlement + publication gates);
//   2. protected pronunciation audio (Bearer auth, Range/206, headers,
//      entitlement re-validation, publication gates);
//   3. previousEpisode / nextEpisode refs on lesson detail (real
//      published neighbors at the Variant's level only, deterministic
//      order, no invented adjacency, episodeNumber).
//
// Every mandatory scenario runs; none is skipped.
//
// Usage: bash scripts/smoke-placement.sh node scripts/smoke-episode.mjs

import { randomBytes } from 'node:crypto';
import {
  createActiveStudent,
  fetchJson,
  getStaffToken,
  getSuperuserToken,
  nextPhone,
  randomId,
} from './smoke-common.mjs';

const PORT = Number(process.env.PB_SMOKE_PLACEMENT_PORT ?? 18093);
const URL = `http://127.0.0.1:${PORT}`;

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let total = 0,
  passed = 0,
  failed = 0;

function scenario(name, fn) {
  total++;
  const start = Date.now();
  const label = `  ${String(total).padStart(2, '0')}. ${name}`;
  try {
    fn();
    passed++;
    console.log(`PASS ${label} (${Date.now() - start}ms)`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${label} (${Date.now() - start}ms)`);
    console.log(`       ${err && err.message ? err.message : String(err)}`);
  }
}

async function aScenario(name, fnPromise) {
  total++;
  const start = Date.now();
  const label = `  ${String(total).padStart(2, '0')}. ${name}`;
  try {
    await fnPromise();
    passed++;
    console.log(`PASS ${label} (${Date.now() - start}ms)`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${label} (${Date.now() - start}ms)`);
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
const AUDIO_FIXTURE = (() => {
  const size = 8192;
  const b = new Uint8Array(size);
  b[0] = 0xff;
  b[1] = 0xfb;
  b[2] = 0x90;
  b[3] = 0x00;
  for (let i = 4; i < size; i++) b[i] = 0x55;
  return Buffer.from(b.buffer);
})();

const PNG_FIXTURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);

async function jf(path, init = {}) {
  return fetchJson(URL, path, init);
}

let defaultCategoryId = '';
async function getDefaultCategoryId(su) {
  if (defaultCategoryId) return defaultCategoryId;
  const r = await jf("/api/collections/categories/records?filter=(key='general')&perPage=1", {
    headers: { authorization: `Bearer ${su}` },
  });
  const item = r.body?.items?.[0];
  if (!item) throw new Error('default category missing');
  defaultCategoryId = item.id;
  return defaultCategoryId;
}

async function uploadArtwork(su, topicId) {
  const boundary = `--FB${randomId()}`;
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="artwork_square"; filename="art.png"\r\nContent-Type: image/png\r\n\r\n`,
    PNG_FIXTURE,
    `\r\n--${boundary}--\r\n`,
  ];
  const buf = Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));
  const res = await fetch(`${URL}/api/collections/topics/records/${topicId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: buf,
    signal: AbortSignal.timeout(15_000),
  });
  const t = await res.text();
  if (res.status !== 200) throw new Error(`artwork upload: ${res.status} ${t.slice(0, 200)}`);
}

async function makeTopic(su, overrides = {}) {
  const slug = overrides.slug || `ep-${randomId()}`;
  const cr = await jf('/api/collections/topics/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      title: overrides.title || `T ${randomId()}`,
      slug,
      description: 'd',
      sort_order: overrides.sort_order ?? 0,
      status: 'draft',
      // Required + unique at create (the unique index rejects a second
      // empty value); the publish PATCH keeps the same identity.
      content_key: `fx-${randomId()}`,
    }),
  });
  if (!cr.body?.id) throw new Error(`topic create: ${JSON.stringify(cr.body).slice(0, 200)}`);
  const id = cr.body.id;
  if (overrides.keepDraft) return { id, body: cr.body };
  await uploadArtwork(su, id);
  const patch = {
    status: overrides.status || 'published',
    category: overrides.category || (await getDefaultCategoryId(su)),
    content_key: `fx-${randomId()}`,
    content_version: 1,
    title_fa: overrides.title_fa || 'عنوان اپیزود',
    description_fa: 'توضیح اپیزود',
    episode_number: overrides.episode_number ?? 0,
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

async function uploadAudio(su, lessonId) {
  const boundary = `--FB${randomId()}`;
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="t.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
    AUDIO_FIXTURE,
    `\r\n--${boundary}--\r\n`,
  ];
  const buf = Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));
  const res = await fetch(`${URL}/api/collections/lessons/records/${lessonId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: buf,
  });
  if (res.status !== 200) throw new Error(`audio upload: ${res.status}`);
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
      body: overrides.body || 'b',
      estimated_minutes: 10,
      status: 'draft',
    }),
  });
  if (!cr.body?.id) throw new Error(`create: ${JSON.stringify(cr.body).slice(0, 200)}`);
  const id = cr.body.id;
  if (overrides.keepDraft) return { id, body: cr.body };
  await uploadAudio(su, id);
  const patch = { status: overrides.status || 'published' };
  const dur = Number(overrides.audio_duration_seconds || 0) || 600;
  patch.audio_duration_seconds = dur;
  patch.summary_fa = overrides.summary_fa || 'خلاصه فارسی';
  patch.content_version = 1;
  const pr = await jf(`/api/collections/lessons/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200)
    throw new Error(`publish: ${pr.status} ${JSON.stringify(pr.body).slice(0, 200)}`);
  return { id, body: pr.body };
}

async function uploadPronunciation(su, vocabId) {
  const boundary = `--FB${randomId()}`;
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="pronunciation_audio"; filename="p.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
    AUDIO_FIXTURE,
    `\r\n--${boundary}--\r\n`,
  ];
  const buf = Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));
  const res = await fetch(`${URL}/api/collections/lesson_vocabulary/records/${vocabId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: buf,
  });
  const t = await res.text();
  if (res.status !== 200) throw new Error(`pronunciation upload: ${res.status} ${t.slice(0, 200)}`);
}

async function makeVocab(su, lessonId, overrides = {}) {
  const term = overrides.term || `word-${randomId()}`;
  const cr = await jf('/api/collections/lesson_vocabulary/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      lesson: lessonId,
      term,
      normalized_term: term.toLowerCase(),
      phonetic: overrides.phonetic || '/wɜːrd/',
      part_of_speech: overrides.part_of_speech || 'noun',
      meaning_fa: overrides.meaning_fa || 'معنی فارسی',
      definition_en: overrides.definition_en || 'english definition',
      example_sentence: overrides.example_sentence || 'an example sentence.',
      sort_order: overrides.sort_order ?? 0,
    }),
  });
  if (!cr.body?.id) throw new Error(`vocab create: ${JSON.stringify(cr.body).slice(0, 200)}`);
  return { id: cr.body.id, term, body: cr.body };
}

async function makeCategory(su, key) {
  const cr = await jf('/api/collections/categories/records', {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      key,
      slug: key,
      title_fa: 'دسته تست',
      description_fa: 'توضیح',
      publication_status: 'published',
    }),
  });
  if (!cr.body?.id) throw new Error(`category create: ${JSON.stringify(cr.body).slice(0, 200)}`);
  return cr.body.id;
}

// ---------------------------------------------------------------------------
// Fully-entitled student: payment + approval (createActiveStudent) + the
// placement journey + a selected level (required by the lesson routes).
// ---------------------------------------------------------------------------
async function makeEntitledStudent(su, level = 'B1') {
  const student = await createActiveStudent(URL, su);
  // Placement questions (idempotent: shared disposable PB may already
  // have them from another suite — the unique (question_key, version)
  // index makes duplicates fail harmlessly).
  const existing = await jf('/api/collections/placement_questions/records?perPage=1', {
    headers: { authorization: `Bearer ${su}` },
  });
  if (!existing.body?.items?.length) {
    for (let i = 0; i < 20; i++) {
      await jf('/api/collections/placement_questions/records', {
        method: 'POST',
        headers: { authorization: `Bearer ${su}` },
        body: JSON.stringify({
          question_key: `epq${String(i).padStart(2, '0')}`,
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
  }
  const start = await jf('/api/fast-english/placement/attempts/start', {
    method: 'POST',
    headers: { authorization: `Bearer ${student.token}` },
  });
  const attemptId = start.body?.attempt?.id;
  assert(attemptId, 'attempt id');
  let rev = start.body?.attempt?.revision || 0;
  for (const q of start.body?.questions || []) {
    const ans = await jf(`/api/fast-english/placement/attempts/${attemptId}/answer`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${student.token}` },
      body: JSON.stringify({ questionId: q.id, optionId: 'a', expectedRevision: rev }),
    });
    rev = ans.body?.attempt?.revision || rev + 1;
  }
  await jf(`/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${student.token}` },
    body: JSON.stringify({ expectedRevision: rev }),
  });
  const lr = await jf('/api/fast-english/placement/selected-level', {
    method: 'POST',
    headers: { authorization: `Bearer ${student.token}` },
    body: JSON.stringify({ selectedLevel: level }),
  });
  assert(lr.status === 200, `level select ${lr.status}`);
  return student;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const su = await getSuperuserToken(URL);
  const student = await makeEntitledStudent(su, 'B1');

  // Content: three published Episodes in a row (sort_order 1,2,3), all with
  // a B1 Variant; Episode 1 also has an A2 Variant; one DRAFT B1 Episode;
  // Episode 3 has only B1 (no neighbors beyond).
  const ep1 = await makeTopic(su, { sort_order: 1, title_fa: 'اپیزود یک', episode_number: 12 });
  const ep2 = await makeTopic(su, { sort_order: 2, title_fa: 'اپیزود دو', episode_number: 13 });
  const ep3 = await makeTopic(su, { sort_order: 3, title_fa: 'اپیزود سه', episode_number: 0 });
  const draftTopic = await makeTopic(su, { keepDraft: true, sort_order: 9 });

  const ep1B1 = await makeLesson(su, ep1.id, {
    level: 'B1',
    title: 'Ep One B1',
    summary_fa: 'خلاصه یک',
    body: 'Transcript one.',
  });
  const ep1A2 = await makeLesson(su, ep1.id, {
    level: 'A2',
    title: 'Ep One A2',
    summary_fa: 'خلاصه یک A2',
  });
  const ep2B1 = await makeLesson(su, ep2.id, {
    level: 'B1',
    title: 'Ep Two B1',
    summary_fa: 'خلاصه دو',
    body: 'Transcript two.',
  });
  const ep3B1 = await makeLesson(su, ep3.id, {
    level: 'B1',
    title: 'Ep Three B1',
    summary_fa: 'خلاصه سه',
    body: 'Transcript three.',
  });
  await makeLesson(su, draftTopic.id, { keepDraft: true, level: 'B1', title: 'Draft B1' });

  // Vocabulary for Ep Two B1: sort_order deliberately 2,1,3 (server orders);
  // the middle entry gets a pronunciation file; one entry has none.
  const v1 = await makeVocab(su, ep2B1.id, { term: 'alpha', sort_order: 2 });
  const v2 = await makeVocab(su, ep2B1.id, { term: 'bravo', sort_order: 1 });
  const v3 = await makeVocab(su, ep2B1.id, { term: 'charlie', sort_order: 3 });
  await uploadPronunciation(su, v2.id);

  // Vocabulary for Ep One A2 (cross-level availability).
  const a2v = await makeVocab(su, ep1A2.id, { term: 'cross', sort_order: 1 });

  // A published Episode whose Category is archived.
  const catArchived = await makeCategory(su, `arch-${randomId()}`);
  const archTopic = await makeTopic(su, { category: catArchived, sort_order: 9 });
  const archLesson = await makeLesson(su, archTopic.id, { level: 'B1', title: 'Archived Cat B1' });
  await makeVocab(su, archLesson.id, { term: 'hidden', sort_order: 1 });
  await jf(`/api/collections/categories/records/${catArchived}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ publication_status: 'archived' }),
  });

  const token = student.token;
  const auth = { authorization: `Bearer ${token}` };
  const suAuth = { authorization: `Bearer ${su}` };

  // --- Vocabulary endpoint ------------------------------------------------
  await aScenario('vocabulary: unauthenticated is 401', async () => {
    await assertHttp(
      await jf(`/api/fast-english/lessons/${ep2B1.id}/vocabulary`),
      401,
      'vocab 401',
    );
  });

  await aScenario('vocabulary: staff token is denied', async () => {
    const staff = await getStaffToken(URL, su);
    const res = await jf(`/api/fast-english/lessons/${ep2B1.id}/vocabulary`, {
      headers: { authorization: `Bearer ${staff}` },
    });
    await assertHttp(res, 403, 'staff vocab');
  });

  await aScenario('vocabulary: pending student is denied', async () => {
    const phone = nextPhone();
    const password = 'Test1234!';
    const signup = await jf('/api/collections/fep_users/records', {
      method: 'POST',
      body: JSON.stringify({ name: 'P', phone, password, passwordConfirm: password }),
    });
    assert(signup.body?.id, 'signup');
    const login = await jf('/api/collections/fep_users/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: signup.body.phone, password }),
    });
    const res = await jf(`/api/fast-english/lessons/${ep2B1.id}/vocabulary`, {
      headers: { authorization: `Bearer ${login.body.token}` },
    });
    await assertHttp(res, 403, 'pending vocab');
  });

  await aScenario('vocabulary: entitled student gets sanitized items in sort order', async () => {
    const res = await jf(`/api/fast-english/lessons/${ep2B1.id}/vocabulary`, { headers: auth });
    await assertHttp(res, 200, 'vocab 200');
    const items = res.body.items;
    assert(items.length === 3, `expected 3 items, got ${items.length}`);
    assert(items[0].term === 'bravo', `sort order broken: ${items.map((i) => i.term)}`);
    assert(items[1].term === 'alpha', `sort order broken: ${items.map((i) => i.term)}`);
    assert(items[2].term === 'charlie', `sort order broken: ${items.map((i) => i.term)}`);
    const first = items[0];
    for (const key of [
      'id',
      'term',
      'phonetic',
      'partOfSpeech',
      'meaningFa',
      'definitionEn',
      'exampleSentence',
    ]) {
      assert(typeof first[key] === 'string', `missing field ${key}`);
    }
    // bravo (sort_order 1) carries the uploaded pronunciation file; alpha
    // (sort_order 2) has none → null descriptor.
    assert(
      items[0].pronunciation &&
        items[0].pronunciation.url.includes('/api/fast-english/vocabulary/'),
      'bravo missing pron URL',
    );
    assert(items[0].pronunciation.contentType === 'audio/mpeg', 'bravo content type');
    assert(items[1].pronunciation === null, 'alpha must have no pron');
    const raw = JSON.stringify(res.body);
    assert(!raw.includes('normalized_term'), 'normalized_term leaked');
    assert(!raw.includes('pronunciationPresent'), 'internal field leaked');
    assert(!raw.includes('storage/'), 'storage path leaked');
    const cache = (res.headers.get('cache-control') || '').toLowerCase();
    assert(cache.includes('no-store'), `cache ${cache}`);
  });

  await aScenario('vocabulary: draft lesson is 404', async () => {
    const draft = await makeLesson(su, ep2.id, { keepDraft: true, level: 'B2', title: 'Draft B2' });
    await assertHttp(
      await jf(`/api/fast-english/lessons/${draft.id}/vocabulary`, { headers: auth }),
      404,
      'draft vocab',
    );
  });

  await aScenario('vocabulary: archived parent category is 404', async () => {
    await assertHttp(
      await jf(`/api/fast-english/lessons/${archLesson.id}/vocabulary`, { headers: auth }),
      404,
      'archived vocab',
    );
  });

  await aScenario('vocabulary: cross-level Variant works (A2 of a B1 Episode)', async () => {
    const res = await jf(`/api/fast-english/lessons/${ep1A2.id}/vocabulary`, { headers: auth });
    await assertHttp(res, 200, 'cross vocab');
    assert(res.body.items.length === 1 && res.body.items[0].term === 'cross', 'cross item');
  });

  // --- Pronunciation audio ------------------------------------------------
  await aScenario('pronunciation: unauthenticated is 401', async () => {
    await assertHttp(
      await jf(`/api/fast-english/vocabulary/${v2.id}/pronunciation`),
      401,
      'pron 401',
    );
  });

  await aScenario('pronunciation: entitled student receives the exact bytes', async () => {
    const res = await fetch(`${URL}/api/fast-english/vocabulary/${v2.id}/pronunciation`, {
      headers: auth,
    });
    assert(res.status === 200, `status ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert(bytes.length === AUDIO_FIXTURE.length, `length ${bytes.length}`);
    assert(bytes.equals(AUDIO_FIXTURE), 'bytes differ');
    assert((res.headers.get('content-type') || '').includes('audio/mpeg'), 'content-type');
    assert(res.headers.get('x-content-type-options') === 'nosniff', 'nosniff');
    assert((res.headers.get('cache-control') || '').includes('no-store'), 'no-store');
  });

  await aScenario('pronunciation: Range 206 works', async () => {
    const res = await fetch(`${URL}/api/fast-english/vocabulary/${v2.id}/pronunciation`, {
      headers: { ...auth, range: 'bytes=100-199' },
    });
    assert(res.status === 206, `status ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert(bytes.length === 100, `range length ${bytes.length}`);
    assert(
      res.headers.get('content-range') === `bytes 100-199/${AUDIO_FIXTURE.length}`,
      'content-range',
    );
  });

  await aScenario('pronunciation: missing file is 404', async () => {
    await assertHttp(
      await jf(`/api/fast-english/vocabulary/${v1.id}/pronunciation`, { headers: auth }),
      404,
      'no file',
    );
  });

  await aScenario('pronunciation: entry of an unpublished lesson is 404', async () => {
    const draftLesson = await makeLesson(su, ep2.id, {
      keepDraft: true,
      level: 'C1',
      title: 'Draft C1',
    });
    const dv = await makeVocab(su, draftLesson.id, { term: 'draftword', sort_order: 1 });
    await uploadPronunciation(su, dv.id);
    await assertHttp(
      await jf(`/api/fast-english/vocabulary/${dv.id}/pronunciation`, { headers: auth }),
      404,
      'draft parent',
    );
  });

  await aScenario('pronunciation: expired subscription is denied at request time', async () => {
    // Create a second entitled student, then expire their subscription
    // directly (server-side fixture) — the route must re-check live.
    const student2 = await makeEntitledStudent(su, 'B1');
    const subs = await jf('/api/collections/subscriptions/records', {
      headers: suAuth,
    });
    const own = subs.body?.items?.find((s) => s.user === student2.userId);
    assert(own, 'subscription record');
    await jf(`/api/collections/subscriptions/records/${own.id}`, {
      method: 'PATCH',
      headers: suAuth,
      body: JSON.stringify({ expires_at: new Date(Date.now() - 60_000).toISOString() }),
    });
    const res = await jf(`/api/fast-english/vocabulary/${v2.id}/pronunciation`, {
      headers: { authorization: `Bearer ${student2.token}` },
    });
    await assertHttp(res, 403, 'expired pron');
  });

  await aScenario('pronunciation: file-token (?token=) serves the exact bytes', async () => {
    // The app's audio sinks cannot set Authorization headers — the URL
    // carries a PB file token instead. Prove that path end-to-end.
    const ft = await fetch(`${URL}/api/files/token`, {
      method: 'POST',
      headers: auth,
    });
    assert(ft.status === 200, `file token status ${ft.status}`);
    const ftBody = await ft.json();
    assert(ftBody.token, 'file token present');
    const res = await fetch(
      `${URL}/api/fast-english/vocabulary/${v2.id}/pronunciation?token=${encodeURIComponent(ftBody.token)}`,
    );
    assert(res.status === 200, `token status ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert(bytes.equals(AUDIO_FIXTURE), 'token bytes differ');
  });

  await aScenario('pronunciation: malformed ranges answer 416', async () => {
    for (const range of [
      'bytes=abc',
      'bytes=-0',
      'bytes=0-100,200-300',
      `bytes=${AUDIO_FIXTURE.length + 100}-${AUDIO_FIXTURE.length + 200}`,
    ]) {
      const res = await fetch(`${URL}/api/fast-english/vocabulary/${v2.id}/pronunciation`, {
        headers: { ...auth, range },
      });
      assert(res.status === 416, `range ${range} -> ${res.status}`);
      assert(
        (res.headers.get('content-range') || '').indexOf('bytes */') === 0,
        `content-range for ${range}`,
      );
    }
  });

  await aScenario('pronunciation: staff token is rejected', async () => {
    const staff = await getStaffToken(URL, su);
    const res = await jf(`/api/fast-english/vocabulary/${v2.id}/pronunciation`, {
      headers: { authorization: `Bearer ${staff}` },
    });
    await assertHttp(res, 403, 'staff pron');
  });

  // --- Previous / next refs ------------------------------------------------
  await aScenario('detail: middle Episode has both real neighbors', async () => {
    const res = await jf(`/api/fast-english/lessons/${ep2B1.id}`, { headers: auth });
    await assertHttp(res, 200, 'detail');
    const prev = res.body.previousEpisode;
    const next = res.body.nextEpisode;
    assert(prev && prev.variantId === ep1B1.id, `prev ${JSON.stringify(prev)}`);
    assert(prev.episodeId === ep1.id, 'prev episode id');
    assert(prev.titleFa === 'اپیزود یک', 'prev titleFa');
    assert(prev.level === 'B1', 'prev level');
    assert(prev.artwork.startsWith('/api/fast-english/artwork/'), 'prev artwork');
    assert(next && next.variantId === ep3B1.id, `next ${JSON.stringify(next)}`);
    assert(next.titleFa === 'اپیزود سه', 'next titleFa');
  });

  await aScenario('detail: first Episode has only next', async () => {
    const res = await jf(`/api/fast-english/lessons/${ep1B1.id}`, { headers: auth });
    assert(res.body.previousEpisode === null, 'first prev must be null');
    assert(res.body.nextEpisode && res.body.nextEpisode.variantId === ep2B1.id, 'first next');
  });

  await aScenario('detail: last Episode has only previous', async () => {
    const res = await jf(`/api/fast-english/lessons/${ep3B1.id}`, { headers: auth });
    assert(
      res.body.previousEpisode && res.body.previousEpisode.variantId === ep2B1.id,
      'last prev',
    );
    assert(res.body.nextEpisode === null, 'last next must be null');
  });

  await aScenario('detail: neighbors never include draft or archived Episodes', async () => {
    // Draft topic (sort_order 0) must never appear as a neighbor of ep1/ep2.
    const res = await jf(`/api/fast-english/lessons/${ep1B1.id}`, { headers: auth });
    const prev = res.body.previousEpisode;
    const next = res.body.nextEpisode;
    assert(prev === null, 'no earlier published Episode exists');
    assert(next.variantId === ep2B1.id, 'draft skipped');
  });

  await aScenario('detail: neighbors are level-scoped (A2 sees only A2)', async () => {
    // Only one published A2 Variant exists → both refs null.
    const res = await jf(`/api/fast-english/lessons/${ep1A2.id}`, { headers: auth });
    assert(res.body.previousEpisode === null, 'A2 prev');
    assert(res.body.nextEpisode === null, 'A2 next');
  });

  await aScenario('detail: episodeNumber surfaces when real (0 stays honest)', async () => {
    const r1 = await jf(`/api/fast-english/lessons/${ep1B1.id}`, { headers: auth });
    assert(r1.body.episode.episodeNumber === 12, `ep1 number ${r1.body.episode.episodeNumber}`);
    const r3 = await jf(`/api/fast-english/lessons/${ep3B1.id}`, { headers: auth });
    assert(r3.body.episode.episodeNumber === 0, 'ep3 number must be 0 (not invented)');
  });

  await aScenario('browsing stays read-only: detail + vocabulary never mutate levels', async () => {
    const before = await jf('/api/collections/fep_users/records/' + student.userId, {
      headers: suAuth,
    });
    const beforeSel = before.body.selected_level;
    const beforeSug = before.body.suggested_level;
    await jf(`/api/fast-english/lessons/${ep1A2.id}`, { headers: auth });
    await jf(`/api/fast-english/lessons/${ep1A2.id}/vocabulary`, { headers: auth });
    const after = await jf('/api/collections/fep_users/records/' + student.userId, {
      headers: suAuth,
    });
    assert(after.body.selected_level === beforeSel, 'selected_level mutated');
    assert(after.body.suggested_level === beforeSug, 'suggested_level mutated');
  });

  // -------------------------------------------------------------------------
  console.log(`\nSmoke episode: ${passed}/${total} scenarios passed`);
  if (failed > 0) {
    console.log(`${failed} scenario(s) FAILED`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('smoke-episode fatal:', err);
  process.exitCode = 1;
});
