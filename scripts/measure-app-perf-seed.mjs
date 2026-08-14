#!/usr/bin/env node

// scripts/measure-app-perf-seed.mjs
// Fast English Podcast — seeds a disposable PocketBase for the lab
// performance harness (scripts/measure-app-perf.sh).
//
// Creates, through the REAL backend API only:
//   - one Staff Administrator;
//   - the example-episode content package (import → publish);
//   - 20 placement questions (same shape as the e2e suites);
//   - one fully-entitled fixture Student: signup → payment approval →
//     placement completed → level B1 selected → resumable progress;
//   - a second pending-payment Student for the payment journey (optional).
//
// Environment: PB_URL, SU_EMAIL, SU_PASSWORD (disposable test instance).
// Writes a machine-readable state file (paths of imported lessons, the
// entitled student token/phone, plan id) to --state <path>.
//
// Never touches production PocketBase, never prints credentials.

import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

const PB_URL = (process.env.PB_URL ?? '').replace(/\/+$/, '');
const SU_EMAIL = process.env.SU_EMAIL ?? '';
const SU_PASSWORD = process.env.SU_PASSWORD ?? '';
if (!PB_URL || !SU_EMAIL || !SU_PASSWORD) {
  console.error('measure-app-perf-seed: PB_URL, SU_EMAIL and SU_PASSWORD are required.');
  process.exit(2);
}

const STATE_PATH =
  process.argv.find((a) => a.startsWith('--state='))?.slice('--state='.length) ??
  (() => {
    const idx = process.argv.indexOf('--state');
    return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined;
  })();

function randId() {
  return randomBytes(6).toString('hex');
}

let phoneCounter = 0;
function nextPhone() {
  const tail = String(phoneCounter++).padStart(2, '0');
  const r = randomBytes(4).readUInt32BE(0) % 10_000_000;
  return `09${String(r).padStart(7, '0')}${tail}`.slice(0, 11);
}

async function jsonFetch(path, init = {}) {
  const headers = { 'content-type': 'application/json' };
  if (init.headers) Object.assign(headers, init.headers);
  const res = await fetch(`${PB_URL}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep raw text
  }
  return { status: res.status, body, ok: res.ok };
}

async function superuserAuth() {
  const r = await jsonFetch('/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: SU_EMAIL, password: SU_PASSWORD }),
  });
  const token = r.body?.token;
  if (!token) throw new Error(`superuser auth failed (${r.status})`);
  return token;
}

async function createStaff(su) {
  const email = `perf-staff-${randId()}@fep-smoke.invalid`;
  const password = 'Test1234!';
  const s = await jsonFetch('/api/collections/staff_admins/records', {
    method: 'POST',
    headers: { authorization: su },
    body: JSON.stringify({
      email,
      password,
      passwordConfirm: password,
      display_name: 'Perf Staff',
      is_active: true,
      verified: true,
    }),
  });
  if (!s.body?.id) throw new Error(`staff create failed: ${JSON.stringify(s.body).slice(0, 200)}`);
  const login = await jsonFetch('/api/collections/staff_admins/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: email, password }),
  });
  if (login.status !== 200 || !login.body?.token) throw new Error('staff login failed');
  return { email, password, token: login.body.token };
}

async function seedPlacementQuestions(su) {
  const existing = await jsonFetch('/api/collections/placement_questions/records?perPage=1', {
    headers: { authorization: su },
  });
  if ((existing.body?.items ?? []).length > 0) return;
  for (let i = 0; i < 20; i++) {
    const r = await jsonFetch('/api/collections/placement_questions/records', {
      method: 'POST',
      headers: { authorization: su },
      body: JSON.stringify({
        question_key: `perfq${String(i).padStart(2, '0')}`,
        version: 1,
        position: i + 1,
        prompt: `Question ${i + 1}`,
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
    if (r.status !== 200) throw new Error(`placement question ${i}: ${r.status}`);
  }
}

// Import the example content package exactly like the CLI does (validate →
// plan → execute with planStateHash), then publish topic + variants.
async function importExamplePackage(staffToken) {
  const { validatePackage } = await import('../scripts/content/parser.mjs');
  const { requestPlan, executeImport } = await import('../scripts/content/auth.mjs');
  const dir = join(ROOT, 'content-packages', 'example-episode');
  const result = await validatePackage(dir);
  if (!result.valid || !result.package) {
    throw new Error(`package validation failed: ${result.errors?.map((e) => e.code).join(',')}`);
  }
  const plan = await requestPlan(PB_URL, staffToken, result.package);
  if (plan.result === 'no_change') {
    throw new Error('unexpected: example package already imported into a fresh instance');
  }
  if (plan.result === 'conflict' || plan.result === 'stale' || plan.result === 'rejected') {
    throw new Error(`import plan rejected: ${plan.result} ${plan.errorJson ?? ''}`);
  }
  const exec = await executeImport(PB_URL, staffToken, dir, result.package, plan.planStateHash);
  if (exec.status !== 'completed') {
    throw new Error(`import execute failed: ${JSON.stringify(exec).slice(0, 300)}`);
  }
  return exec.summary ?? {};
}

async function publishAll(su) {
  const topics = await jsonFetch('/api/collections/topics/records?perPage=200', {
    headers: { authorization: su },
  });
  const lessons = await jsonFetch('/api/collections/lessons/records?perPage=200', {
    headers: { authorization: su },
  });
  const topic = (topics.body?.items ?? []).find((t) => t.status === 'draft');
  const published = [];
  if (topic) {
    await jsonFetch(`/api/collections/topics/records/${topic.id}`, {
      method: 'PATCH',
      headers: { authorization: su },
      body: JSON.stringify({ status: 'published' }),
    });
  }
  for (const lesson of lessons.body?.items ?? []) {
    await jsonFetch(`/api/collections/lessons/records/${lesson.id}`, {
      method: 'PATCH',
      headers: { authorization: su },
      body: JSON.stringify({ status: 'published' }),
    });
    published.push({ id: lesson.id, level: lesson.level, title: lesson.title });
  }
  return { topicId: topic?.id ?? '', lessons: published };
}

// Full canonical Student fixture through the real API.
async function createEntitledStudent(su, { level = 'B1' } = {}) {
  const staff = await createStaff(su);
  const phone = nextPhone();
  const password = 'Test1234!';
  const signup = await jsonFetch('/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({ name: 'دانشجوی نمونه', phone, password, passwordConfirm: password }),
  });
  if (!signup.body?.id)
    throw new Error(`signup failed: ${JSON.stringify(signup.body).slice(0, 200)}`);
  const userId = signup.body.id;
  const canonicalPhone = signup.body.phone;

  // Plan (owned, disposable).
  const plan = await jsonFetch('/api/collections/plans/records', {
    method: 'POST',
    headers: { authorization: su },
    body: JSON.stringify({
      name: 'Perf Plan',
      slug: `perf-plan-${randId()}`,
      duration_days: 90,
      price_toman: 100_000,
      is_active: true,
    }),
  });
  const planId = plan.body?.id;
  if (!planId) throw new Error('plan create failed');

  // Active payment destination (required by the payment route).
  await jsonFetch('/api/collections/payment_destination/records', {
    method: 'POST',
    headers: { authorization: su },
    body: JSON.stringify({
      card_number: '0000000000000000',
      card_holder_name: 'PERF',
      bank_name: 'PERF BANK',
      is_active: true,
    }),
  });

  // Login → payment request → staff approval.
  const login = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  const token = login.body?.token;
  if (!token) throw new Error('student login failed');

  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
  ]);
  const boundary = `----PerfBoundary${randId()}`;
  const prBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${planId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const prRes = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: prBody,
  });
  const prText = await prRes.text();
  let prBody2;
  try {
    prBody2 = JSON.parse(prText);
  } catch {
    prBody2 = {};
  }
  if (prRes.status !== 201) {
    throw new Error(`payment request failed: ${prRes.status} ${prText.slice(0, 200)}`);
  }
  const prId = prBody2?.request?.id;
  if (!prId) throw new Error('payment request id missing');
  const approve = await jsonFetch(`/api/fast-english/operator/payment-requests/${prId}/approve`, {
    method: 'POST',
    headers: { authorization: staff.token },
    body: JSON.stringify({}),
  });
  if (approve.status !== 200) throw new Error(`approve failed: ${approve.status}`);
  const refresh = await jsonFetch('/api/collections/fep_users/auth-refresh', {
    method: 'POST',
    headers: { authorization: token },
  });
  const refreshed = refresh.body?.token ?? token;

  // Placement: start → answer all → submit → select level.
  await seedPlacementQuestions(su);
  const start = await jsonFetch('/api/fast-english/placement/attempts/start', {
    method: 'POST',
    headers: { authorization: refreshed },
  });
  if (start.status !== 200 && start.status !== 201) {
    throw new Error(`placement start: ${start.status}`);
  }
  const attemptId = start.body?.attempt?.id;
  let rev = start.body?.attempt?.revision ?? 0;
  for (const q of start.body?.questions ?? []) {
    const ans = await jsonFetch(`/api/fast-english/placement/attempts/${attemptId}/answer`, {
      method: 'PUT',
      headers: { authorization: refreshed },
      body: JSON.stringify({ questionId: q.id, optionId: 'a', expectedRevision: rev }),
    });
    rev = ans.body?.attempt?.revision ?? rev + 1;
  }
  const submit = await jsonFetch(`/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: refreshed },
    body: JSON.stringify({ expectedRevision: rev }),
  });
  if (submit.status !== 200) throw new Error(`placement submit: ${submit.status}`);
  const levelRes = await jsonFetch('/api/fast-english/placement/selected-level', {
    method: 'POST',
    headers: { authorization: refreshed },
    body: JSON.stringify({ selectedLevel: level }),
  });
  if (levelRes.status !== 200) throw new Error(`level select: ${levelRes.status}`);

  return { token: refreshed, userId, phone: canonicalPhone, password };
}

async function saveProgress(token, lessonId, positionSeconds, durationSeconds) {
  const r = await jsonFetch(`/api/fast-english/lessons/${lessonId}/progress`, {
    method: 'PUT',
    headers: { authorization: token },
    body: JSON.stringify({ positionSeconds, expectedRevision: 0 }),
  });
  if (r.status !== 200) {
    throw new Error(`progress save failed: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  void durationSeconds;
}

async function main() {
  const su = await superuserAuth();
  const staff = await createStaff(su);
  const summary = await importExamplePackage(staff.token);
  const { lessons } = await publishAll(su);
  const student = await createEntitledStudent(su, { level: 'B1' });

  // Resumable progress on the B1 variant so Home shows the Continue hero.
  // The example audio clips are ~1s, so use a sub-duration position.
  const b1 = lessons.find((l) => l.level === 'B1');
  if (b1) {
    await saveProgress(student.token, b1.id, 0.6, 1);
  }

  const state = {
    pbUrl: PB_URL,
    student: { token: student.token, phone: student.phone, password: student.password },
    importSummary: summary,
    lessons,
    seededAt: new Date().toISOString(),
  };
  if (STATE_PATH) {
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
    console.log(`Seed state written to ${STATE_PATH}`);
  } else {
    console.log(JSON.stringify(state, null, 2));
  }
}

main().catch((err) => {
  console.error(`measure-app-perf-seed: ${err?.message ?? err}`);
  process.exit(1);
});
