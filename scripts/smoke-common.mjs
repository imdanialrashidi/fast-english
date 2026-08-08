// scripts/smoke-common.mjs
// Shared, deterministic fixtures and HTTP primitives for the real-PocketBase
// smoke suites (scripts/smoke-*.mjs). Each suite binds its own base URL and
// keeps scenario-specific helpers local; everything duplicated verbatim across
// suites lives here so setup is written once and behaves identically.
//
// All helpers are stateless (base URL is passed in) and fail loudly: no broad
// catch, no silent retries. Rate limiting observed in probes is PB
// transport-level only; hook-level per-user limits are asserted by the suites
// themselves where intended.

import { randomBytes } from 'node:crypto';

export async function fetchJson(base, path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text };
  }
  return { status: res.status, body, headers: res.headers };
}

let phoneCounter = 0;

// Deterministic, unique-per-suite phone: random digits + monotonic tail.
export function nextPhone() {
  const tail = String(phoneCounter++).padStart(2, '0');
  const r = randomBytes(4).readUInt32BE(0) % 10_000_000;
  return `09${String(r).padStart(7, '0')}${tail}`.slice(0, 11);
}

export function randomId() {
  return randomBytes(6).toString('hex');
}

// Auth as the disposable superuser created by the shell wrapper.
export async function getSuperuserToken(base) {
  const email = process.env.PB_TEST_SU_EMAIL;
  const password = process.env.PB_TEST_SU_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'PB_TEST_SU_EMAIL/PASSWORD not set; shell wrapper must create superuser before serve',
    );
  }
  const r = await fetchJson(base, '/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: email, password }),
  });
  if (r.status !== 200 || !r.body?.token)
    throw new Error(`superuser auth failed: status=${r.status}`);
  return r.body.token;
}

export async function login(base, phone, password = 'Test1234!') {
  const r = await fetchJson(base, '/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: phone, password }),
  });
  if (r.status !== 200 || !r.body?.token) throw new Error(`login failed: status=${r.status}`);
  return r.body.token;
}

export async function staffLogin(base, email, password) {
  const r = await fetchJson(base, '/api/collections/staff_admins/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: email, password }),
  });
  if (r.status !== 200 || !r.body?.token) throw new Error(`staff login failed: status=${r.status}`);
  return r.body.token;
}

// Create one active, verified Staff Administrator (the single backstage
// identity of this slice) and return its token. Only superuser tooling
// (and the controlled bootstrap command) can create staff records.
export async function getStaffToken(base, suToken) {
  const email = `staff-${randomId()}@fep-smoke.invalid`;
  const password = 'Test1234!';
  const s = await fetchJson(base, '/api/collections/staff_admins/records', {
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
  if (!s.body?.id) throw new Error(`staff create failed: ${JSON.stringify(s.body)}`);
  return staffLogin(base, email, password);
}

// Legacy fep_users "operator" account: still exists for migration safety,
// but must no longer be accepted by Staff routes (and requireStudent
// rejects it on Student routes too).
export async function getLegacyOperatorToken(base, suToken) {
  const phone = nextPhone();
  const s = await fetchJson(base, '/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Legacy Op',
      phone,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
    }),
  });
  const uid = s.body?.id || '';
  await fetchJson(base, `/api/collections/fep_users/records/${uid}`, {
    method: 'PATCH',
    headers: { authorization: suToken },
    body: JSON.stringify({ role: 'operator', account_status: 'active' }),
  });
  return login(base, s.body?.phone || phone);
}

// Full canonical Student fixture: signup → active payment destination and
// plan → receipt submission → operator approval → fresh session token.
// Returns { token, userId, phone }.
export async function createActiveStudent(base, suToken) {
  const staffToken = await getStaffToken(base, suToken);
  const phone = nextPhone();
  const password = 'Test1234!';
  const signupRes = await fetchJson(base, '/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({ name: 'S', phone, password, passwordConfirm: password }),
  });
  if (!signupRes.body?.id) throw new Error(`Signup failed: ${JSON.stringify(signupRes.body)}`);
  const userId = signupRes.body.id;
  const canonicalPhone = signupRes.body.phone;
  const token = await login(base, canonicalPhone, password);

  // Create active payment destination
  await fetchJson(base, '/api/collections/payment_destination/records', {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      card_number: '0000000000000000',
      card_holder_name: 'TEST',
      bank_name: 'TEST',
      is_active: true,
    }),
  });

  // Create plan
  const planRes = await fetchJson(base, '/api/collections/plans/records', {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      name: 'T',
      slug: `t-${randomId()}`,
      duration_days: 90,
      price_toman: 100000,
      is_active: true,
    }),
  });
  const planId = planRes.body?.id;
  if (!planId) throw new Error(`Plan failed: ${JSON.stringify(planRes.body)}`);

  // Create payment request with multipart PNG
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
  ]);
  const boundary = `----FormBoundary${randomId()}`;
  const headerStr = `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${planId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`;
  const footerStr = `\r\n--${boundary}--\r\n`;
  const fullBody = Buffer.concat([Buffer.from(headerStr), pngBytes, Buffer.from(footerStr)]);
  const prRes = await fetch(`${base}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: fullBody,
  });
  const prText = await prRes.text();
  let prBody;
  try {
    prBody = JSON.parse(prText);
  } catch {
    prBody = { _raw: prText };
  }
  if (prRes.status !== 201) throw new Error(`PR failed: ${prRes.status} ${JSON.stringify(prBody)}`);
  const prId = prBody?.request?.id;
  if (!prId) throw new Error(`No PR ID: ${JSON.stringify(prBody)}`);

  // Approve via Staff Administrator
  const approveRes = await fetchJson(
    base,
    `/api/fast-english/operator/payment-requests/${prId}/approve`,
    {
      method: 'POST',
      headers: { authorization: staffToken },
      body: JSON.stringify({}),
    },
  );
  if (approveRes.status !== 200)
    throw new Error(`Approve failed: ${approveRes.status} ${JSON.stringify(approveRes.body)}`);

  // Refresh token so the returned session is current
  const refreshRes = await fetchJson(base, '/api/collections/fep_users/auth-refresh', {
    method: 'POST',
    headers: { authorization: token },
  });
  return { token: refreshRes.body?.token || token, userId, phone: canonicalPhone };
}
