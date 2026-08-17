#!/usr/bin/env node
// scripts/restore-proof.mjs
// Record-level backup/restore proof for the hard release gate (C):
//
//   create:  (against a disposable PocketBase with migrations+hooks)
//      1. signup a real Student (fep_users)
//      2. active payment destination + plan
//      3. REAL payment-request route: receipt file upload (multipart)
//      4. REAL staff approval route -> subscription (one transaction)
//      5. published content fixture (category/episode/variant)
//      6. progress fixture (lesson_progress record)
//      7. placement attempt fixture
//      8. site_settings fixture
//      9. PocketBase Backups API -> backup ZIP (writes name to stdout)
//
//   verify:  (against the RESTORED instance in a clean data dir)
//      - health; superuser auth
//      - same record IDs + important fields for every fixture
//      - the same Student can authenticate (password auth persisted)
//      - the receipt FILE exists in the restored storage tree and its
//        bytes match the original upload exactly (sha256)
//      - payment/subscription/progress/placement/content fixtures intact
//
// The wrapper (scripts/restore-proof.sh) wipes the original data dir and
// restores the ZIP into a clean directory between the two modes, exactly
// like the production restore path (deploy/restore-drill.sh).
//
// Usage:
//   node scripts/restore-proof.mjs create   (env PB_SMOKE_URL)
//   node scripts/restore-proof.mjs verify   (env PB_SMOKE_URL, PB_PROOF_* envs)
//
// Exit: 0 when every check passes; 1 otherwise. Fail-closed.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const URL = process.env.PB_SMOKE_URL ?? 'http://127.0.0.1:18097';
const MODE = process.argv[2];

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ok ' : 'FAIL '}${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
}

async function jsonFetch(base, path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

function nextPhone() {
  // Canonical +98 + 10 digits starting with 9 (e.g. +98912XXXXXXX).
  return `+989${String(120000000 + Math.floor(Math.random() * 89999999))}`;
}

function randomId() {
  return randomBytes(5).toString('hex');
}

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);

async function getSuperuserToken(base) {
  const email = process.env.PB_TEST_SU_EMAIL ?? 'pbtest@fep-smoke.invalid';
  const password = process.env.PB_TEST_SU_PASSWORD ?? '';
  const r = await jsonFetch(base, '/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: email, password }),
  });
  if (r.status !== 200) throw new Error(`superuser auth failed: ${r.status}`);
  return r.body.token;
}

// ---------------------------------------------------------------- create --
async function createFixture() {
  console.log(`restore-proof: create mode against ${URL}`);
  const suToken = await getSuperuserToken(URL);
  const suHeaders = { authorization: suToken };

  // --- student signup (real route) ---
  const phone = nextPhone();
  const password = 'Proof-1234!';
  const signup = await jsonFetch(URL, '/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({ name: 'Proof User', phone, password, passwordConfirm: password }),
  });
  if (signup.status !== 200)
    throw new Error(`signup failed: ${signup.status} ${JSON.stringify(signup.body)}`);
  const userId = signup.body.id;
  const canonicalPhone = signup.body.phone;

  const auth = await jsonFetch(URL, '/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  const studentToken = auth.body.token;

  // --- active destination + plan (real canonical shape) ---
  await jsonFetch(URL, '/api/collections/payment_destination/records', {
    method: 'POST',
    headers: suHeaders,
    body: JSON.stringify({
      card_number: '0000000000000000',
      card_holder_name: 'PROOF',
      bank_name: 'PROOF BANK',
      is_active: true,
    }),
  });
  const plan = await jsonFetch(URL, '/api/collections/plans/records', {
    method: 'POST',
    headers: suHeaders,
    body: JSON.stringify({
      name: 'Proof Plan',
      slug: `proof-${randomId()}`,
      duration_days: 30,
      price_toman: 299000,
      is_active: true,
    }),
  });
  const planId = plan.body.id;

  // --- payment request with a REAL receipt upload ---
  const boundary = `----ProofBoundary${randomId()}`;
  const headerStr = `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${planId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="receipt.png"\r\nContent-Type: image/png\r\n\r\n`;
  const footerStr = `\r\n--${boundary}--\r\n`;
  const prRes = await fetch(`${URL}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${studentToken}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: Buffer.concat([Buffer.from(headerStr), PNG_BYTES, Buffer.from(footerStr)]),
  });
  const prBody = await prRes.json();
  if (prRes.status !== 201) throw new Error(`payment request failed: ${prRes.status}`);
  const requestId = prBody.request.id;
  const receiptFile = prBody.request.receipt?.fileName;
  const amountSnapshot = prBody.request.amountToman;
  if (!receiptFile || amountSnapshot === undefined) {
    throw new Error(`payment request response missing receipt/amount: ${JSON.stringify(prBody)}`);
  }

  // --- staff approval (real route; creates the subscription) ---
  const staffEmail = `staff-${randomId()}@fep-smoke.invalid`;
  const staffPassword = 'Proof-Staff-1234!';
  await jsonFetch(URL, '/api/collections/staff_admins/records', {
    method: 'POST',
    headers: suHeaders,
    body: JSON.stringify({
      email: staffEmail,
      password: staffPassword,
      passwordConfirm: staffPassword,
      display_name: 'Proof Staff',
      is_active: true,
      verified: true,
    }),
  });
  const staffAuth = await jsonFetch(URL, '/api/collections/staff_admins/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: staffEmail, password: staffPassword }),
  });
  const approve = await jsonFetch(
    URL,
    `/api/fast-english/operator/payment-requests/${requestId}/approve`,
    { method: 'POST', headers: { authorization: `Bearer ${staffAuth.body.token}` }, body: '{}' },
  );
  if (approve.status !== 200) throw new Error(`approve failed: ${approve.status}`);

  // --- published content fixture (category/episode/variant) ---
  const category = await jsonFetch(URL, '/api/collections/categories/records', {
    method: 'POST',
    headers: suHeaders,
    body: JSON.stringify({
      key: `proof-cat-${randomId()}`,
      slug: `proof-cat-${randomId()}`,
      title_fa: 'دستهٔ نمونه',
      description_fa: 'دستهٔ نمونه برای اثبات بازیابی',
      publication_status: 'published',
      sort_order: 1,
    }),
  });
  const episode = await jsonFetch(URL, '/api/collections/topics/records', {
    method: 'POST',
    headers: suHeaders,
    body: JSON.stringify({
      title: 'Proof Episode',
      slug: `proof-ep-${randomId()}`,
      description: 'd',
      sort_order: 1,
      category: category.body.id,
      content_key: `proof-ep-${randomId()}`,
      title_fa: 'اپیزود نمونه',
      description_fa: 'توضیح اپیزود نمونه',
      content_version: 1,
      status: 'draft',
      episode_number: 1,
      is_featured: false,
    }),
  });
  if (episode.status !== 200)
    throw new Error(`episode create failed: ${episode.status} ${JSON.stringify(episode.body)}`);
  const variant = await jsonFetch(URL, '/api/collections/lessons/records', {
    method: 'POST',
    headers: suHeaders,
    body: JSON.stringify({
      title: 'Proof Variant B1',
      slug: `proof-v-${randomId()}`,
      sort_order: 1,
      estimated_minutes: 2,
      summary: 's',
      topic: episode.body.id,
      content_key: `proof-v-${randomId()}`,
      level: 'B1',
      title_fa: 'اپیزود نمونه — B1',
      summary_fa: 'خلاصهٔ اپیزود نمونه',
      content_version: 1,
      status: 'draft',
      audio_duration_seconds: 120,
      body: 'A short proof transcript.',
    }),
  });
  if (variant.status !== 200)
    throw new Error(`variant create failed: ${variant.status} ${JSON.stringify(variant.body)}`);
  const variantId = variant.body.id;

  // --- progress fixture (lesson_progress) ---
  const progress = await jsonFetch(URL, '/api/collections/lesson_progress/records', {
    method: 'POST',
    headers: suHeaders,
    body: JSON.stringify({
      user: userId,
      lesson: variantId,
      position_seconds: 47,
      furthest_seconds: 47,
      duration_seconds: 120,
      completed: false,
      last_played_at: new Date().toISOString(),
      revision: 3,
    }),
  });
  if (progress.status !== 200) {
    throw new Error(`progress create failed: ${progress.status} ${JSON.stringify(progress.body)}`);
  }

  // --- placement attempt fixture ---
  const attempt = await jsonFetch(URL, '/api/collections/placement_attempts/records', {
    method: 'POST',
    headers: suHeaders,
    body: JSON.stringify({
      user: userId,
      status: 'submitted',
      score: 14,
      max_score: 20,
      revision: 1,
      started_at: new Date(Date.now() - 3600_000).toISOString(),
      submitted_at: new Date().toISOString(),
    }),
  });
  if (attempt.status !== 200) {
    throw new Error(`attempt create failed: ${attempt.status} ${JSON.stringify(attempt.body)}`);
  }

  // --- site_settings fixture ---
  await jsonFetch(URL, '/api/collections/site_settings/records', {
    method: 'POST',
    headers: suHeaders,
    body: JSON.stringify({ support_contact: 'https://support.example.proof' }),
  });

  // --- backup via the PocketBase Backups API ---
  const name = `proof-backup-${Date.now()}.zip`;
  const backupRes = await fetch(`${URL}/api/backups`, {
    method: 'POST',
    headers: { authorization: suToken, 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (backupRes.status !== 204 && backupRes.status !== 201 && backupRes.status !== 200) {
    throw new Error(`backup creation failed: ${backupRes.status}`);
  }
  // Poll until the backup is listed (created asynchronously).
  let listed = false;
  for (let i = 0; i < 40; i += 1) {
    const list = await jsonFetch(URL, '/api/backups', { headers: suHeaders });
    // 0.39.9 lists backups as a plain array of {key, ...} entries.
    const entries = Array.isArray(list.body) ? list.body : (list.body?.items ?? []);
    if (entries.some((b) => b.key === name)) {
      listed = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!listed) throw new Error('backup never appeared in the backups list');

  // Persist the fixture expectations for the verify mode (wrapper keeps
  // them in env): every value needed to prove record identity + content.
  const expect = {
    userId,
    canonicalPhone,
    password,
    requestId,
    receiptFile,
    amountSnapshot,
    planId,
    categoryId: category.body.id,
    episodeId: episode.body.id,
    variantId,
    progressId: progress.body.id,
    progressPosition: 47,
    progressRevision: 3,
    attemptId: attempt.body.id,
    attemptScore: 14,
    backupName: name,
    receiptSha256: createHash('sha256').update(PNG_BYTES).digest('hex'),
  };
  console.log(`PROOF_STATE=${JSON.stringify(expect)}`);
  console.log(`PROOF_BACKUP=${name}`);
  console.log(
    'restore-proof: fixture created (user, payment+receipt, subscription, content, progress, placement, settings)',
  );
}

// ---------------------------------------------------------------- verify --
async function verifyRestore() {
  console.log(`restore-proof: verify mode against ${URL}`);
  const state = JSON.parse(process.env.PB_PROOF_STATE ?? '{}');
  const suToken = await getSuperuserToken(URL);

  // --- health + superuser auth (drill baseline) ---
  const health = await fetch(`${URL}/api/health`);
  check('health endpoint', health.status === 200);

  // --- the same Student authenticates (password auth persisted) ---
  const auth = await jsonFetch(URL, '/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: state.canonicalPhone, password: state.password }),
  });
  check('student password auth after restore', auth.status === 200);

  // --- user record: same ID + important fields ---
  const user = await jsonFetch(URL, `/api/collections/fep_users/records/${state.userId}`, {
    headers: { authorization: suToken },
  });
  check('user record id', user.status === 200 && user.body.id === state.userId);
  check('user phone', user.body?.phone === state.canonicalPhone);
  check('user role', user.body?.role === 'student');
  check('user account_status (active after approval)', user.body?.account_status === 'active');

  // --- payment request: same ID + snapshot ---
  const pr = await jsonFetch(URL, `/api/collections/payment_requests/records/${state.requestId}`, {
    headers: { authorization: suToken },
  });
  check('payment request id', pr.status === 200 && pr.body.id === state.requestId);
  check('payment request status', pr.body?.status === 'approved');
  check('payment request amount snapshot', pr.body?.amount_snapshot === state.amountSnapshot);
  check('payment request user link', pr.body?.user === state.userId);

  // --- subscription created by the approval ---
  const subs = await jsonFetch(
    URL,
    `/api/collections/subscriptions/records?filter=${encodeURIComponent(
      `payment_request='${state.requestId}'`,
    )}`,
    { headers: { authorization: suToken } },
  );
  const sub = subs.body?.items?.[0];
  check('subscription exists (approval transaction restored)', !!sub);
  check('subscription user link', sub?.user === state.userId);
  check('subscription plan snapshot', sub?.plan_name_snapshot === 'Proof Plan');

  // --- receipt FILE bytes survive in the restored storage tree ---
  const receiptPath = `${process.env.PB_RESTORED_DIR ?? ''}/storage`;
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  let foundSha = null;
  try {
    // execFile with an args array only — the server-derived filename is a
    // value, never shell-interpolated. find's stderr is ignored by the
    // promisified call only when the exit code is 0; any failure rejects
    // and is reported as a scan failure below.
    const { stdout } = await execFileAsync('find', [
      receiptPath,
      '-type',
      'f',
      '-name',
      state.receiptFile,
    ]);
    const found = stdout.trim().split('\n').find(Boolean) ?? '';
    if (found && !found.startsWith(receiptPath)) {
      check('receipt file found within the restored storage tree', false, found);
    } else if (found) {
      foundSha = createHash('sha256').update(readFileSync(found)).digest('hex');
      check('receipt file present in restored storage', true, found);
      check('receipt file bytes identical (sha256)', foundSha === state.receiptSha256);
    } else {
      check('receipt file present in restored storage', false, 'not found');
    }
  } catch {
    check('receipt file present in restored storage', false, 'storage scan failed');
  }

  // --- progress fixture ---
  const progress = await jsonFetch(
    URL,
    `/api/collections/lesson_progress/records/${state.progressId}`,
    { headers: { authorization: suToken } },
  );
  check('progress record id', progress.status === 200 && progress.body.id === state.progressId);
  check('progress position', progress.body?.position_seconds === state.progressPosition);
  check('progress revision', progress.body?.revision === state.progressRevision);
  check('progress user link', progress.body?.user === state.userId);

  // --- placement attempt fixture ---
  const attempt = await jsonFetch(
    URL,
    `/api/collections/placement_attempts/records/${state.attemptId}`,
    { headers: { authorization: suToken } },
  );
  check('placement attempt id', attempt.status === 200 && attempt.body.id === state.attemptId);
  check('placement attempt score', attempt.body?.score === state.attemptScore);

  // --- published content fixtures ---
  const cat = await jsonFetch(URL, `/api/collections/categories/records/${state.categoryId}`, {
    headers: { authorization: suToken },
  });
  check(
    'category id + published',
    cat.status === 200 && cat.body.publication_status === 'published',
  );
  const ep = await jsonFetch(URL, `/api/collections/topics/records/${state.episodeId}`, {
    headers: { authorization: suToken },
  });
  check('episode id + title', ep.status === 200 && ep.body.title_fa === 'اپیزود نمونه');
  const variant = await jsonFetch(URL, `/api/collections/lessons/records/${state.variantId}`, {
    headers: { authorization: suToken },
  });
  check('variant id + level', variant.status === 200 && variant.body.level === 'B1');

  // --- site settings ---
  const settings = await jsonFetch(URL, '/api/collections/site_settings/records', {
    headers: { authorization: suToken },
  });
  check(
    'site_settings support contact',
    (settings.body?.items ?? []).some((s) => s.support_contact === 'https://support.example.proof'),
  );
}

if (MODE === 'create') {
  await createFixture();
} else if (MODE === 'verify') {
  await verifyRestore();
} else {
  console.error('usage: node scripts/restore-proof.mjs create|verify');
  process.exit(2);
}

if (failures > 0) {
  console.error(`restore-proof: ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('restore-proof: all checks passed');
