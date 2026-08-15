// scripts/smoke-business-settings.mjs
// Business Configuration slice — real-backend smoke for:
//   - the canonical launch plan set (monthly 299,000 / quarterly 807,300,
//     NO yearly) seeded through the actual `seed:plans` CLI;
//   - the public settings endpoint (single source for the Landing) and its
//     propagation from Staff Business Settings edits;
//   - the staff-guarded Business Settings routes (plans/destination/site)
//     incl. single-active destination and validation negatives;
//   - the demo placement bank installed through the actual `seed:placement`
//     CLI (guards + 20 active questions, positions 1-20) and a real
//     placement submission against it (score 20 → C2);
//   - the public sample lesson contract matching the demo package content
//     ("A Typical Workday" — deterministic link with the Landing).
//
// Usage: bash scripts/smoke-placement.sh node scripts/smoke-business-settings.mjs

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeMp3 } from './content/fixtures.mjs';
import {
  fetchJson,
  getStaffToken,
  getSuperuserToken,
  nextPhone,
  randomId,
} from './smoke-common.mjs';

const URL = process.env.PB_SMOKE_URL || 'http://127.0.0.1:8090';

let total = 0;
let passed = 0;
function check(cond, msg) {
  total++;
  if (cond) {
    passed++;
    console.log(`  PASS  ${msg}`);
  } else {
    console.error(`  FAIL  ${msg}`);
  }
}

function runCli(script, args) {
  const out = execFileSync('node', [script, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FEP_PB_URL: URL,
      FEP_PB_SUPERUSER_EMAIL: process.env.PB_TEST_SU_EMAIL,
      FEP_PB_SUPERUSER_PASSWORD: process.env.PB_TEST_SU_PASSWORD,
    },
  });
  return out;
}

const DEMO_BANK = JSON.parse(
  readFileSync(join(process.cwd(), 'seeds/placement/demo-bank.v1.json'), 'utf8'),
);
const SAMPLE_MANIFEST = JSON.parse(
  readFileSync(join(process.cwd(), 'content-packages/typical-workday-sample/episode.json'), 'utf8'),
);
const SAMPLE_TRANSCRIPT = readFileSync(
  join(process.cwd(), 'content-packages/typical-workday-sample/transcripts/b1.md'),
  'utf8',
);

function jf(path, init = {}) {
  return fetchJson(URL, path, init);
}

async function createStaff(suToken) {
  const email = `staff-${randomId()}@fep-smoke.invalid`;
  const password = `Staff-${randomBytes(6).toString('hex')}!Aa1`;
  const r = await jf('/api/collections/staff_admins/records', {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      email,
      password,
      passwordConfirm: password,
      display_name: 'Smoke Staff',
      is_active: true,
      verified: true,
    }),
  });
  if (r.status !== 200) throw new Error(`staff create failed: ${r.status}`);
  const login = await jf('/api/collections/staff_admins/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: email, password }),
  });
  if (login.status !== 200) throw new Error('staff login failed');
  return login.body.token;
}

const AUDIO_FIXTURE = makeMp3(40);
const PNG_FIXTURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);

async function createPlainStudent() {
  const phone = nextPhone();
  const password = 'Test1234!';
  const signup = await jf('/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({ name: 'BS', phone, password, passwordConfirm: password }),
  });
  if (!signup.body?.id) throw new Error(`signup failed: ${JSON.stringify(signup.body)}`);
  const login = await jf('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: signup.body.phone, password }),
  });
  if (login.status !== 200) throw new Error('student login failed');
  return { token: login.body.token };
}

async function createActiveStudent(suToken) {
  const phone = nextPhone();
  const password = 'Test1234!';
  const signup = await jf('/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({ name: 'BS', phone, password, passwordConfirm: password }),
  });
  if (!signup.body?.id) throw new Error(`signup failed: ${JSON.stringify(signup.body)}`);
  const login = await jf('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: signup.body.phone, password }),
  });
  if (login.status !== 200) throw new Error('student login failed');
  const token = login.body.token;

  // Entitlement via the REAL payment flow (request → staff approve → the
  // subscription is created by the server in one transaction).
  await jf('/api/collections/payment_destination/records', {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      card_number: '0000000000000000',
      card_holder_name: 'T',
      bank_name: 'T',
      is_active: true,
    }),
  });
  const plan = await jf('/api/collections/plans/records', {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      name: 'P',
      slug: `p-${randomId()}`,
      duration_days: 90,
      price_toman: 100000,
      is_active: true,
    }),
  });
  const boundary = `----FormBoundary${randomId()}`;
  const headerStr = `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${plan.body.id}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`;
  const footerStr = `\r\n--${boundary}--\r\n`;
  const fullBody = Buffer.concat([Buffer.from(headerStr), PNG_FIXTURE, Buffer.from(footerStr)]);
  const pr = await fetchJson(URL, '/api/fast-english/payment-requests', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: fullBody,
  });
  if (pr.status !== 201) throw new Error(`payment request failed: ${pr.status}`);
  const opToken = await getStaffToken(URL, suToken);
  const approve = await jf(
    `/api/fast-english/operator/payment-requests/${pr.body.request.id}/approve`,
    {
      method: 'POST',
      headers: { authorization: opToken },
      body: JSON.stringify({}),
    },
  );
  if (approve.status !== 200) throw new Error(`approve failed: ${approve.status}`);
  return { token };
}

async function uploadArtwork(suToken, topicId) {
  const boundary = `--FB${randomId()}`;
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="artwork_square"; filename="art.png"\r\nContent-Type: image/png\r\n\r\n`,
    PNG_FIXTURE,
    `\r\n--${boundary}--\r\n`,
  ];
  const buf = Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));
  return fetchJson(URL, `/api/collections/topics/records/${topicId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${suToken}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: buf,
  });
}

async function uploadAudio(suToken, lessonId) {
  const boundary = `--FB${randomId()}`;
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="t.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
    AUDIO_FIXTURE,
    `\r\n--${boundary}--\r\n`,
  ];
  const buf = Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p)));
  return fetchJson(URL, `/api/collections/lessons/records/${lessonId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${suToken}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: buf,
  });
}

async function main() {
  console.log('\n=== Business Settings Smoke ===\n');
  const suToken = await getSuperuserToken(URL);
  check(!!suToken, 'B0: superuser auth works');

  // ------------------------------------------------------------------
  // 1. seed:plans CLI — canonical launch plans
  // ------------------------------------------------------------------
  const plansOut = runCli('scripts/seed/plans.mjs', ['--target=local', '--yes']);
  check(/OK — 2 plan\(s\) upserted/.test(plansOut), 'B1: seed:plans upserts the two launch plans');
  const plansRes = await jf('/api/collections/plans/records?perPage=50', {
    headers: { authorization: suToken },
  });
  const plans = (plansRes.body?.items || []).filter((p) => p.is_active === true);
  check(plans.length === 2, `B2: exactly 2 active plans (got ${plans.length})`);
  const bySlug = Object.fromEntries(plans.map((p) => [p.slug, p]));
  check(
    bySlug.monthly &&
      bySlug.monthly.price_toman === 299000 &&
      bySlug.monthly.duration_days === 30 &&
      bySlug.monthly.name === 'ماهانه',
    'B3: monthly = 299,000 toman / 30 days',
  );
  check(
    bySlug.quarterly &&
      bySlug.quarterly.price_toman === 807300 &&
      bySlug.quarterly.duration_days === 90 &&
      bySlug.quarterly.name === 'سه ماهه',
    'B4: quarterly = 807,300 toman / 90 days',
  );
  check(
    !(plansRes.body?.items || []).some((p) => p.duration_days === 365 || p.slug === 'yearly'),
    'B5: no yearly/365-day plan exists',
  );

  // ------------------------------------------------------------------
  // 2. Public settings endpoint
  // ------------------------------------------------------------------
  const pub1 = await jf('/api/fast-english/public/settings');
  check(pub1.status === 200, `B6: public settings 200 (${pub1.status})`);
  check(
    pub1.body?.plans?.length === 2 &&
      pub1.body.plans.every((p) => ['monthly', 'quarterly'].includes(p.slug)),
    'B7: public settings expose exactly the two active plans',
  );
  check(
    pub1.body?.plans?.find((p) => p.slug === 'monthly')?.priceToman === 299000,
    'B8: public settings carry the real monthly price',
  );
  check(pub1.body?.support?.supportContact === '', 'B9: support contact starts unset (honest)');
  check(
    !('destination' in (pub1.body || {})) && !('isActive' in (pub1.body?.plans?.[0] || {})),
    'B10: public payload carries no destination/operator fields',
  );

  // ------------------------------------------------------------------
  // 3. Staff guards
  // ------------------------------------------------------------------
  const staffToken = await createStaff(suToken);
  check(!!staffToken, 'B11: staff account created');
  const noAuth = await jf('/api/fast-english/staff/business-settings');
  check(noAuth.status === 401, `B12: staff settings without auth → 401 (${noAuth.status})`);
  const plainStudent = await createPlainStudent();
  const studentDenied = await jf('/api/fast-english/staff/business-settings', {
    headers: { authorization: plainStudent.token },
  });
  check(
    studentDenied.status === 403,
    `B13: student token on staff settings → 403 (${studentDenied.status})`,
  );

  // ------------------------------------------------------------------
  // 4. Staff Business Settings: plans + destination + site
  // ------------------------------------------------------------------
  const staffGet = await jf('/api/fast-english/staff/business-settings', {
    headers: { authorization: staffToken },
  });
  check(
    staffGet.status === 200 &&
      staffGet.body?.plans?.length === 2 &&
      staffGet.body?.destination === null,
    'B14: staff GET returns plans + null destination + site',
  );

  const monthlyId = staffGet.body.plans.find((p) => p.slug === 'monthly').id;
  const patchPlan = await jf(`/api/fast-english/staff/business-settings/plans/${monthlyId}`, {
    method: 'PATCH',
    headers: { authorization: staffToken },
    body: JSON.stringify({ price_toman: 310000 }),
  });
  check(patchPlan.status === 200, `B15: staff PATCH plan price (${patchPlan.status})`);
  const pub2 = await jf('/api/fast-english/public/settings');
  check(
    pub2.body?.plans?.find((p) => p.slug === 'monthly')?.priceToman === 310000,
    'B16: public settings reflect the staff edit (canonical propagation)',
  );
  // Restore the canonical price for later assertions.
  await jf(`/api/fast-english/staff/business-settings/plans/${monthlyId}`, {
    method: 'PATCH',
    headers: { authorization: staffToken },
    body: JSON.stringify({ price_toman: 299000 }),
  });

  const dest = await jf('/api/fast-english/staff/business-settings/destination', {
    method: 'PUT',
    headers: { authorization: staffToken },
    body: JSON.stringify({
      card_number: '6037 9912 3456 7890',
      card_holder_name: 'HOLDER',
      bank_name: 'BANK',
      instructions: 'مبلغ را دقیقاً به همین کارت واریز کنید.',
      review_sla_text: '',
      support_contact: '',
      is_active: true,
    }),
  });
  check(
    dest.status === 200 && dest.body?.destination?.cardNumber === '6037991234567890',
    `B17: staff PUT destination (normalized card) (${dest.status})`,
  );
  const studentDest = await jf('/api/collections/payment_destination/records');
  check(
    studentDest.body?.items?.length === 1 && studentDest.body.items[0].is_active === true,
    'B18: student-facing destination list shows exactly the active one',
  );
  // Single-active invariant: PUT a second active destination → first is deactivated.
  await jf('/api/fast-english/staff/business-settings/destination', {
    method: 'PUT',
    headers: { authorization: staffToken },
    body: JSON.stringify({
      card_number: '6219861034529007',
      card_holder_name: 'H2',
      bank_name: 'B2',
      instructions: '',
      review_sla_text: 'حداکثر تا ۲۴ ساعت',
      support_contact: '',
      is_active: true,
    }),
  });
  const dests = await jf('/api/collections/payment_destination/records?perPage=50', {
    headers: { authorization: suToken },
  });
  const activeDests = (dests.body?.items || []).filter((d) => d.is_active === true);
  check(activeDests.length === 1, `B19: at most one active destination (${activeDests.length})`);
  check(
    activeDests[0]?.review_sla_text === 'حداکثر تا ۲۴ ساعت',
    'B20: review ETA text persists from Business Settings',
  );

  const badDest = await jf('/api/fast-english/staff/business-settings/destination', {
    method: 'PUT',
    headers: { authorization: staffToken },
    body: JSON.stringify({ card_number: '123', card_holder_name: 'T', bank_name: 'B' }),
  });
  check(badDest.status === 400, `B21: invalid card number rejected (${badDest.status})`);
  const letterCard = await jf('/api/fast-english/staff/business-settings/destination', {
    method: 'PUT',
    headers: { authorization: staffToken },
    body: JSON.stringify({ card_number: 'AAAAAAAAAAAA', card_holder_name: 'T', bank_name: 'B' }),
  });
  check(
    letterCard.status === 400 && letterCard.body?.code === 'CARD_INVALID',
    `B21b: non-digit card rejected server-side (${letterCard.status})`,
  );
  const yearly = await jf('/api/fast-english/staff/business-settings/plans', {
    method: 'POST',
    headers: { authorization: staffToken },
    body: JSON.stringify({
      name: 'سالانه',
      slug: 'yearly',
      duration_days: 365,
      price_toman: 1000000,
      is_active: true,
      display_order: 9,
    }),
  });
  check(
    yearly.status === 400 && yearly.body?.code === 'YEARLY_NOT_OFFERED',
    `B21c: 365-day/yearly plan rejected server-side (${yearly.status} ${yearly.body?.code})`,
  );
  const yearlyPatch = await jf(`/api/fast-english/staff/business-settings/plans/${monthlyId}`, {
    method: 'PATCH',
    headers: { authorization: staffToken },
    body: JSON.stringify({ duration_days: 365 }),
  });
  check(
    yearlyPatch.status === 400 && yearlyPatch.body?.code === 'YEARLY_NOT_OFFERED',
    `B21d: PATCH to 365 days rejected server-side (${yearlyPatch.status})`,
  );

  const site = await jf('/api/fast-english/staff/business-settings/site', {
    method: 'PATCH',
    headers: { authorization: staffToken },
    body: JSON.stringify({ support_contact: 'https://t.me/fep-smoke' }),
  });
  check(site.status === 200, `B22: staff PATCH site contact (${site.status})`);
  const badSite = await jf('/api/fast-english/staff/business-settings/site', {
    method: 'PATCH',
    headers: { authorization: staffToken },
    body: JSON.stringify({ support_contact: 'not-a-url' }),
  });
  check(badSite.status === 400, `B23: invalid support URL rejected (${badSite.status})`);
  const pub3 = await jf('/api/fast-english/public/settings');
  check(
    pub3.body?.support?.supportContact === 'https://t.me/fep-smoke',
    'B24: public settings carry the canonical support contact',
  );
  // Rate-limit response contract: after 60 writes in the window, the next
  // write must return 429 with a machine-readable code (the admin client
  // reads body.code). The write bucket is shared per staff member, so this
  // must run AFTER the other write scenarios.
  let lastStatus = 0;
  let lastBody = null;
  for (let i = 0; i < 61; i++) {
    const r = await jf('/api/fast-english/staff/business-settings/site', {
      method: 'PATCH',
      headers: { authorization: staffToken },
      body: JSON.stringify({ support_contact: 'https://t.me/fep-smoke' }),
    });
    lastStatus = r.status;
    lastBody = r.body;
    if (r.status === 429) break;
  }
  check(
    lastStatus === 429 && typeof lastBody?.code === 'string' && lastBody.code.length > 0,
    `B22b: rate-limited response carries a machine-readable code (status=${lastStatus} code=${lastBody?.code})`,
  );

  // ------------------------------------------------------------------
  // 5. seed:placement CLI — demo bank + guards
  // ------------------------------------------------------------------
  const student = await createActiveStudent(suToken);
  check(!!student.token, 'B24b: active student created through the real payment flow');
  let refused = '';
  try {
    runCli('scripts/seed/placement.mjs', ['--target=production', '--confirm-production', '--yes']);
  } catch (err) {
    refused = String(err.stderr || err.message);
  }
  // The production-targeted run must be refused by a guard: either the
  // demo→production gate (--allow-demo) or the target/host cross-validation
  // (production intent on a loopback URL). Both are explicit-intent guards.
  check(
    refused.includes('--allow-demo') ||
      refused.includes('production') ||
      refused.includes('--target'),
    `B25: production-targeted demo seeding refused by a guard (${refused.slice(0, 120)})`,
  );

  const placementOut = runCli('scripts/seed/placement.mjs', ['--target=local', '--yes']);
  check(/OK — 20 inserted/.test(placementOut), 'B26: seed:placement installs 20 questions');
  let blocked = '';
  try {
    runCli('scripts/seed/placement.mjs', ['--target=local', '--yes']);
  } catch (err) {
    blocked = String(err.stderr || err.message);
  }
  check(blocked.includes('--replace'), 'B27: existing active bank blocks without --replace');
  const replaceOut = runCli('scripts/seed/placement.mjs', ['--target=local', '--replace', '--yes']);
  check(/20 updated/.test(replaceOut), 'B28: --replace upserts idempotently');

  const qRes = await jf('/api/collections/placement_questions/records?perPage=200', {
    headers: { authorization: suToken },
  });
  const activeQ = (qRes.body?.items || []).filter((q) => q.is_active === true);
  check(activeQ.length === 20, `B29: exactly 20 active questions (${activeQ.length})`);
  const positions = activeQ.map((q) => Number(q.position)).sort((a, b) => a - b);
  check(
    positions.every((p, i) => p === i + 1),
    'B30: positions are exactly 1-20',
  );
  check(
    activeQ.every((q) => JSON.parse(q.options_text).length === 4),
    'B31: every question has four options',
  );

  // Real placement flow against the demo bank (all-correct → score 20 → C2).
  const start = await jf('/api/fast-english/placement/attempts/start', {
    method: 'POST',
    headers: { authorization: student.token },
  });
  check(
    start.status === 200 || start.status === 201,
    `B32: placement starts with demo bank (${start.status})`,
  );
  const attemptId = start.body?.attempt?.id;
  const questions = start.body?.questions || [];
  check(
    questions.length === 20 && questions.every((q) => q.options?.length === 4),
    'B33: 20 questions × 4 options served to the student',
  );
  check(
    !JSON.stringify(start.body).includes('correct_option_id'),
    'B34: no correct answers leak to the client',
  );
  // Correct answers come ONLY from the committed demo dataset file — the
  // placement API must never reveal them. This also proves the bank's
  // correct-answer data is valid against the real scoring implementation.
  const correctByPosition = new Map(
    DEMO_BANK.questions.map((q) => [q.position, q.correct_option_id]),
  );
  check(
    questions.every((q) => correctByPosition.has(Number(q.position))),
    'B35: every served question exists in the demo dataset',
  );
  let revision = 1;
  for (const q of questions) {
    const ans = await jf(`/api/fast-english/placement/attempts/${attemptId}/answer`, {
      method: 'PUT',
      headers: { authorization: student.token },
      body: JSON.stringify({
        questionId: q.id,
        optionId: correctByPosition.get(Number(q.position)),
        expectedRevision: revision,
      }),
    });
    if (ans.status !== 200) throw new Error(`answer save failed: ${ans.status}`);
    revision = ans.body?.attempt?.revision || revision + 1;
  }
  check(revision === 21, `B35: all 20 answers saved (revision ${revision})`);
  const submit = await jf(`/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: student.token },
    body: JSON.stringify({ expectedRevision: revision }),
  });
  check(submit.status === 200, `B36: demo bank submission accepted (${submit.status})`);
  check(
    submit.body?.attempt?.score === 20,
    `B37: score 20 with all-correct answers (${submit.body?.attempt?.score})`,
  );
  const attemptRec = await jf(`/api/collections/placement_attempts/records/${attemptId}`, {
    headers: { authorization: suToken },
  });
  check(
    attemptRec.body?.suggested_level === 'C2',
    `B38: score 20 maps to C2 (current scoring, stored=${attemptRec.body?.suggested_level})`,
  );

  // ------------------------------------------------------------------
  // 6. Public sample contract (demo package ↔ /sample)
  // ------------------------------------------------------------------
  const before = await jf('/api/fast-english/public/sample');
  check(
    before.status === 200 && before.body?.kind === 'sample_unavailable',
    'B39: sample endpoint honest before a published sample exists',
  );
  const cat = await jf('/api/collections/categories/records', {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      key: `gen-${randomId()}`,
      slug: `gen-${randomId()}`,
      title_fa: 'عمومی',
      title_en: 'General',
      description_fa: 'دسته‌بندی عمومی',
      publication_status: 'published',
      sort_order: 1,
    }),
  });
  check(cat.status === 200, 'B40: category created');
  const topic = await jf('/api/collections/topics/records', {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      slug: `sample-${randomId()}`,
      title: SAMPLE_MANIFEST.episode.titleEn,
      description: 'd',
      sort_order: 1,
      status: 'draft',
    }),
  });
  check(topic.status === 200, 'B40: topic draft created');
  const artwork = await uploadArtwork(suToken, topic.body.id);
  check(artwork.status === 200, 'B40: topic artwork uploaded');
  const topicPub = await jf(`/api/collections/topics/records/${topic.body.id}`, {
    method: 'PATCH',
    headers: { authorization: suToken },
    body: JSON.stringify({
      status: 'published',
      category: cat.body.id,
      content_key: `sample.${SAMPLE_MANIFEST.contentKey}`,
      content_version: 1,
      title_fa: SAMPLE_MANIFEST.episode.titleFa,
      description_fa: SAMPLE_MANIFEST.episode.descriptionFa,
    }),
  });
  check(topicPub.status === 200, 'B40: topic published');
  const lesson = await jf('/api/collections/lessons/records', {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      topic: topic.body.id,
      level: SAMPLE_MANIFEST.variants[0].level,
      title: SAMPLE_MANIFEST.episode.titleEn,
      summary: 's',
      body: SAMPLE_TRANSCRIPT.trim(),
      estimated_minutes: 10,
      status: 'draft',
    }),
  });
  check(lesson.status === 200, 'B40: lesson draft created');
  const audio = await uploadAudio(suToken, lesson.body.id);
  check(audio.status === 200, 'B40: lesson audio uploaded');
  const lessonPub = await jf(`/api/collections/lessons/records/${lesson.body.id}`, {
    method: 'PATCH',
    headers: { authorization: suToken },
    body: JSON.stringify({
      status: 'published',
      is_public_sample: true,
      audio_duration_seconds: 600,
    }),
  });
  check(lessonPub.status === 200, 'B40: sample lesson created from demo package content');
  const sample = await jf('/api/fast-english/public/sample');
  check(
    sample.status === 200 &&
      sample.body?.kind === 'sample' &&
      sample.body?.lesson?.title === 'A Typical Workday',
    `B41: /sample serves the Landing-promised title (kind=${sample.body?.kind})`,
  );
  check(
    (sample.body?.lesson?.body || '').includes('Sara starts her day at half past seven.'),
    'B42: /sample body matches the Landing-promised transcript',
  );

  const fail = total - passed;
  console.log(`\n=== Results: ${passed}/${total} passed, ${fail} failed ===\n`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
