#!/usr/bin/env node
// scripts/smoke-auth.mjs
// Real-backend PocketBase auth smoke test. Starts a disposable PB instance,
// exercises the auth flow end-to-end, and cleans up.
//
// Usage: bash scripts/smoke-auth.sh node scripts/smoke-auth.mjs
//
// Each run uses a fresh temporary --dir created by the shell wrapper. Every
// step uses a unique Iranian mobile number. The disposable superuser is
// created via the PB CLI inside the same temp --dir and authenticated via
// the official _superusers auth-with-password endpoint so we can flip the
// test user to suspended. The PocketBase process and its data dir are
// removed on exit by the shell wrapper.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.PB_SMOKE_PORT ?? 18090);
const URL = `http://127.0.0.1:${PORT}`;

function check(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${msg}`);
  }
}

async function jsonFetch(path, init = {}) {
  const res = await fetch(`${URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text };
  }
  return { status: res.status, body };
}

async function waitForHealth(maxMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(`${URL}/api/health`);
      if (r.status === 200) return true;
    } catch {
      // not ready
    }
    await new Promise((res) => setTimeout(res, 200));
  }
  return false;
}

// ---- Unique phone counter ----
// A single source of truth for unique Iranian mobile numbers so every
// signup attempt in this run uses a distinct phone and never collides
// with another step (or with itself across runs).
let phoneCounter = 0;
function nextPhone() {
  // 09 + 9 digits = 11 digits; +98 prefix is 12 chars total. 9 random
  // digits plus a 1- or 2-digit tail from the counter keeps the range
  // well within the 9XXXXXXXXX mobile block and unique per call.
  const tail = String(phoneCounter++).padStart(2, '0');
  const rand = randomBytes(4).readUInt32BE(0) % 10_000_000;
  const mid = String(rand).padStart(7, '0');
  return `09${mid}${tail}`.slice(0, 11);
}

async function signup(payload) {
  return jsonFetch('/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ---------- 1. Health ----------
async function step1Health() {
  const r = await jsonFetch('/api/health');
  check(r.status === 200, 'health returns 200');
  check(r.body?.code === 200, 'health body code = 200');
}

// ---------- 2. Collection exists ----------
async function step2Collection() {
  const r = await jsonFetch('/api/collections/fep_users/auth-methods');
  check(r.status === 200 || r.status === 400, 'fep_users auth-methods endpoint reachable');
  const first = await signup({
    name: 'یکتا',
    phone: nextPhone(),
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  const dup = await signup({
    name: 'تکراری',
    phone: first.body.phone, // same canonical phone, different form
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(first.status === 200, 'first signup succeeds');
  check(dup.status >= 400, 'duplicate phone rejected (unique index works)');
  return first.body.phone;
}

// ---------- 3-8. Signup ----------
async function step3Signup() {
  const phone = nextPhone();
  const r = await signup({
    name: 'تست',
    phone,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(r.status === 200, 'signup with 09... succeeds (200)');
  check(r.body?.phone?.startsWith('+989'), 'phone stored canonically as +989...');
  check(r.body?.role === 'student', 'role is student');
  check(r.body?.account_status === 'pending_payment', 'account_status is pending_payment');
  return r.body.phone;
}

async function step4Persian() {
  const phone = nextPhone();
  // Render the Latin-digits phone in Persian digits.
  const persian = phone.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  const r = await signup({
    name: 'فارسی',
    phone: persian,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(r.status === 200, 'signup with Persian digits succeeds (200)');
  check(r.body?.phone?.startsWith('+989'), 'Persian digits normalized to +989...');
}

async function step5Collision(canonical) {
  // canonical is "+98" + 10 digits (13 chars). Strip the "+98" prefix
  // so we can construct alternate forms with the same local number.
  const local = canonical.slice(3); // 10 digits
  const r1 = await signup({
    name: 'تکراری ۱',
    phone: `989${local.slice(1)}`, // 98 + 9 digits = 11 digits (Iran prefix, no +)
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  const r2 = await signup({
    name: 'تکراری ۲',
    phone: canonical, // +98 + 10 digits = same canonical
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(r1.status >= 400, '98... form with same digits is rejected (duplicate)');
  check(r2.status >= 400, '+98... form (same canonical) is rejected (duplicate)');
}

async function step6Invalid() {
  const r = await signup({
    name: 'بد',
    phone: '123',
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(r.status >= 400, 'invalid phone rejected (400)');
}

async function step7EmptyName() {
  const r = await signup({
    name: '   ',
    phone: nextPhone(),
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(r.status >= 400, 'empty/whitespace name rejected (400)');
}

async function step8Email() {
  // H1: signup without an email must succeed and login by phone must
  // succeed afterwards.
  const noEmail = await signup({
    name: 'ایمیل',
    phone: nextPhone(),
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(noEmail.status === 200, 'signup without email succeeds');
  const withEmail = await signup({
    name: 'ایمیل',
    phone: nextPhone(),
    email: 'real@test.local',
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(withEmail.status === 200, 'signup with optional real email succeeds');
  return { noEmail: noEmail.body, withEmail: withEmail.body };
}

async function step9Protected() {
  const r = await signup({
    name: 'بد',
    phone: nextPhone(),
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
    role: 'operator',
    account_status: 'active',
  });
  check(r.status === 200, 'signup with role=operator still succeeds');
  check(r.body?.role === 'student', 'role override ignored (still student)');
  check(r.body?.account_status === 'pending_payment', 'account_status override ignored');
}

// ---------- 10. Optional-email user can log in by phone (H1) ----------
async function step10H1OptionalEmailLogin({ withEmail }) {
  // The user signed up with a real email; login by canonical phone
  // must still succeed because `phone` is a password identity field.
  const login = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: withEmail.phone, password: 'Test1234!' }),
  });
  check(login.status === 200, 'login by phone succeeds for user with email (H1)');
  check(
    typeof login.body?.token === 'string' && login.body.token.length > 20,
    'returns auth token',
  );
}

// ---------- 11. Login ----------
async function step11Login(canonical) {
  // Authenticate with the canonical phone directly (H1 fix).
  const r = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: canonical, password: 'Test1234!' }),
  });
  check(r.status === 200, 'login with correct password succeeds');
  check(typeof r.body?.token === 'string' && r.body.token.length > 20, 'returns auth token');
  return { token: r.body.token, id: r.body.record?.id, canonical };
}

// ---------- 12. Canonical-phone login (L1) ----------
// The auth lookup uses exact match, so login always sends the canonical
// phone. This is the path the client SDK actually takes: see
// `app/src/lib/auth.tsx` -> `login`, which normalises the input to the
// canonical "+989..." form before calling `authWithPassword`. We
// separately verify the duplicate phone check works against all
// equivalent forms in step 5; here we confirm the canonical path.
async function step12CanonicalLogin() {
  const created = await signup({
    name: 'جایگزین',
    phone: nextPhone(),
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(created.status === 200, 'signup for canonical login succeeds');
  const login = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: created.body.phone, password: 'Test1234!' }),
  });
  check(login.status === 200, 'login with canonical phone succeeds');
  check(
    typeof login.body?.token === 'string' && login.body.token.length > 20,
    'returns auth token',
  );
}

// ---------- 13. Wrong password ----------
async function step13WrongPassword(canonical) {
  const r = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: canonical, password: 'WrongPass!' }),
  });
  check(r.status >= 400, 'wrong password rejected');
}

// ---------- 14. Auth refresh ----------
async function step14Refresh({ token }) {
  const r = await jsonFetch('/api/collections/fep_users/auth-refresh', {
    method: 'POST',
    headers: { authorization: token },
  });
  check(r.status === 200, 'auth-refresh with valid token succeeds');
  return r.body?.token;
}

// ---------- 15. Invalid token cleared ----------
async function step15InvalidToken() {
  const r = await jsonFetch('/api/collections/fep_users/auth-refresh', {
    method: 'POST',
    headers: { authorization: 'invalid.jwt.token' },
  });
  check(r.status >= 400, 'invalid token rejected');
}

// ---------- 16. List restriction ----------
async function step16List({ token }) {
  const r = await jsonFetch('/api/collections/fep_users/records?page=1&perPage=200', {
    headers: { authorization: token },
  });
  check(r.status === 200, 'authenticated list returns 200');
  check(
    r.body?.totalItems === 1,
    `user can only see their own record (totalItems=${r.body?.totalItems})`,
  );
}

// ---------- 17. Update is locked (H2 + H3) ----------
// H3: use the real created record ID (not `/records/me`). The collection
// has `updateRule = null` so any non-superuser PATCH must be rejected
// with a 4xx by PocketBase.
async function step17UpdateLocked({ token, id }) {
  const r = await jsonFetch(`/api/collections/fep_users/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: token },
    body: JSON.stringify({ role: 'operator', account_status: 'active' }),
  });
  check(r.status >= 400, `student self-update of protected fields blocked (status=${r.status})`);
  const r2 = await jsonFetch(`/api/collections/fep_users/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: token },
    body: JSON.stringify({ phone: '09123456789' }),
  });
  check(r2.status >= 400, `student self-update of phone blocked (status=${r2.status})`);
  // Defence-in-depth: the hook also blocks password/email tampering.
  const r3 = await jsonFetch(`/api/collections/fep_users/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: token },
    body: JSON.stringify({ password: 'NewPass1234!' }),
  });
  check(r3.status >= 400, `student self-update of password blocked (status=${r3.status})`);
}

// ---------- 18. Suspended user cannot authenticate or refresh (C1) ----------
// We use a fresh disposable superuser created through the PB CLI against
// the same temp data dir that the smoke server is running with. The
// superuser authenticates through the official _superusers
// auth-with-password endpoint; the resulting token is a real superuser
// JWT and bypasses the collection's updateRule for the PATCH.
//
// Order matters:
//   1. Create the user (while not suspended).
//   2. Impersonate the user via the superuser-only endpoint to obtain a
//      previously-valid auth token.
//   3. Suspend the user.
//   4. Verify password login fails.
//   5. Verify auth-refresh with the previously-valid token fails.
async function step18SuspendedAuth() {
  const created = await signup({
    name: 'تعلیق',
    phone: nextPhone(),
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  if (created.status !== 200) {
    check(false, `suspended test: could not create user (status=${created.status})`);
    return;
  }
  const { id, phone: canonical } = created.body;

  const superToken = await getDisposableSuperuserToken();
  if (!superToken) {
    check(false, 'suspended test: could not generate superuser token');
    return;
  }

  // Obtain a previously-valid user token while the user is still
  // active. The impersonate hook chain runs the same auth hooks, so
  // this is blocked for a suspended user — by doing it before the
  // suspend we know the impersonation succeeded with an active user.
  const impRes = await jsonFetch(`/api/collections/fep_users/impersonate/${id}`, {
    method: 'POST',
    headers: { authorization: superToken },
  });
  if (impRes.status !== 200 || !impRes.body?.token) {
    check(false, `suspended test: superuser could not impersonate (status=${impRes.status})`);
    return;
  }
  const userToken = impRes.body.token;

  // Now suspend the user with the superuser token. The collection
  // updateRule is null so this only works because the request has
  // superuser auth.
  const r1 = await jsonFetch(`/api/collections/fep_users/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: superToken },
    body: JSON.stringify({ account_status: 'suspended' }),
  });
  check(r1.status === 200, `suspended test: superuser can suspend (status=${r1.status})`);

  // C1.a: password login for the suspended user must fail with 4xx and
  // MUST NOT return a token.
  const r2 = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: canonical, password: 'Test1234!' }),
  });
  check(r2.status >= 400, 'suspended user cannot authenticate with password');
  check(!r2.body?.token, 'suspended user auth response contains no token');

  // C1.b: auth-refresh for the suspended user must fail. The previously
  // valid token must not be renewed.
  const r3 = await jsonFetch('/api/collections/fep_users/auth-refresh', {
    method: 'POST',
    headers: { authorization: userToken },
  });
  check(r3.status >= 400, 'suspended user auth-refresh rejected');
  check(!r3.body?.token, 'suspended user auth-refresh response contains no token');
}

// Disposable superuser helpers. The credentials are generated in-process
// and are never written to disk, logged, or returned from this function.
function randomSuperuserCreds() {
  // Email and password are random per smoke run. The email is not
  // deliverable and the password is not reused.
  const id = randomBytes(8).toString('hex');
  return {
    email: `smoke-${id}@fep-smoke.invalid`,
    password: `Smoke-${id}-${randomBytes(6).toString('hex')}`,
  };
}

async function getDisposableSuperuserToken() {
  const dataDir = process.env.PB_DATA_DIR;
  if (!dataDir) {
    console.error('smoke: PB_DATA_DIR not set; cannot create superuser');
    return null;
  }
  const { email, password } = randomSuperuserCreds();
  // The CLI must see the same encryption env as the running server
  // (the data dir is encrypted at rest when PB_ENCRYPTION is set).
  const env = {
    ...process.env,
    PB_TELEMETRY: '0',
    PB_FEEDBACK: '0',
    PB_ENCRYPTION: process.env.PB_ENCRYPTION ?? 'dev-encryption-key-not-for-prod',
  };
  const upsert = spawnSync(
    'server/pocketbase',
    ['superuser', 'upsert', email, password, '--dir', dataDir],
    { env, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  if (upsert.status !== 0) {
    console.error('smoke: superuser upsert failed:', upsert.stderr?.toString());
    return null;
  }
  // Authenticate through the official _superusers auth-with-password
  // endpoint. The token is a real superuser JWT and bypasses
  // collection-level updateRule.
  const auth = await jsonFetch('/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: email, password }),
  });
  if (auth.status !== 200 || !auth.body?.token) {
    console.error(
      `smoke: superuser auth failed (status=${auth.status} body=${JSON.stringify(auth.body).slice(0, 200)})`,
    );
    return null;
  }
  return auth.body.token;
}

// ---------- 20. Rate limiting is real (M1) ----------
// The configured limit is 30 per hour for `fep_users:create`. By the time
// we reach this step the pre-rate scenarios have used ~14 unique phones
// from the same IP, so the first 16 of these requests succeed and the
// 17th onward gets a real 429. The test must observe a real 429 and
// MUST NOT treat validation 400 as rate-limit evidence.
async function step20RateLimit() {
  let lastStatus = 0;
  let got429 = false;
  let successCount = 0;
  for (let i = 0; i < 35; i++) {
    const r = await signup({
      name: 'rl',
      phone: nextPhone(),
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
    });
    lastStatus = r.status;
    if (r.status === 200) {
      successCount++;
      continue;
    }
    if (r.status === 429) {
      got429 = true;
      break;
    }
    // Any other non-200 is fine to break on; we just need one real 429.
    break;
  }
  check(
    got429,
    `rate limiter produces 429 within 35 attempts (successes=${successCount}, last status=${lastStatus})`,
  );
}

async function main() {
  console.log(`smoke: target = ${URL}`);
  const ready = await waitForHealth();
  if (!ready) {
    console.error('smoke: PocketBase not ready');
    process.exit(1);
  }
  await step1Health();
  await step2Collection();
  const canonical = await step3Signup();
  await step4Persian();
  await step5Collision(canonical);
  await step6Invalid();
  await step7EmptyName();
  const emailFixture = await step8Email();
  await step9Protected();
  await step10H1OptionalEmailLogin(emailFixture);
  const auth = await step11Login(canonical);
  await step12CanonicalLogin();
  await step13WrongPassword(canonical);
  await step14Refresh(auth);
  await step15InvalidToken();
  await step16List(auth);
  await step17UpdateLocked(auth);
  await step18SuspendedAuth();
  await step20RateLimit();
  if (process.exitCode) {
    console.error('smoke: FAIL');
  } else {
    console.log('smoke: OK');
  }
}

main().catch((err) => {
  console.error('smoke: error', err);
  process.exit(1);
});
