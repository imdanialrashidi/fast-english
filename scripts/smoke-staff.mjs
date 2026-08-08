#!/usr/bin/env node
// scripts/smoke-staff.mjs
// Podcast Slice 1 — Staff Auth smoke: schema, locked public rules, the
// cross-token authorization matrix, and bootstrap fail-safes.
//
// Usage: PB_SMOKE_PAY_PORT=18092 bash scripts/smoke-payment.sh node scripts/smoke-staff.mjs
//
// Coverage:
//   1.  staff_admins exists as an Auth collection
//   2.  public rules locked (list/view/create/update/delete = null)
//   3.  smallest field model (display_name + is_active; no role field)
//   4.  one Staff account model: email/password auth enabled
//   5.  public registration / record creation disabled
//   6.  inactive Staff cannot authenticate (login rejected)
//   7.  deactivated Staff: auth-refresh rejected, old token rejected by routes
//   8.  unverified Staff cannot authenticate
//   9.  Student token: accepted by Student routes, rejected by Staff routes
//  10.  Staff token: accepted by Staff routes, rejected by Student routes
//  11.  unauthenticated: rejected by both protected areas
//  12.  legacy fep_users operator token: rejected by Staff AND Student routes
//  13.  Student identity cannot sign into staff_admins; Staff identity
//      cannot sign into fep_users
//  14.  bootstrap: missing env fails without secrets
//  15.  bootstrap: weak placeholder password refused
//  16.  bootstrap: creates exactly one active+verified record
//  17.  bootstrap: refuses to create a second record silently
//  18.  bootstrap: --replace explicitly resets (old password stops working)
//  19.  bootstrap output leaks no credentials
//  20.  legacy diagnostic reports counts only; IDs only with --ids

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fetchJson, getSuperuserToken } from './smoke-common.mjs';

const PORT = Number(process.env.PB_SMOKE_PAY_PORT ?? 18091);
const URL = `http://127.0.0.1:${PORT}`;

let exitCode = 0;
function check(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    exitCode = 1;
    return false;
  }
  console.log(`✓ ${msg}`);
  return true;
}

async function runScenario(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`✗ scenario ${label} threw: ${err?.stack ?? err}`);
    exitCode = 1;
  }
}

const STAFF_PASSWORD = 'Probe-Staff-12345!';
const STUDENT_PASSWORD = 'Test1234!';

async function createStaffViaSuperuser(suToken, { email, active = true, verified = true }) {
  const r = await fetchJson(URL, '/api/collections/staff_admins/records', {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      email,
      password: STAFF_PASSWORD,
      passwordConfirm: STAFF_PASSWORD,
      display_name: 'Smoke Staff',
      is_active: active,
      verified,
    }),
  });
  if (r.status !== 200)
    throw new Error(`staff create failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

function staffEmail(prefix) {
  return `${prefix}-${randomBytes(4).toString('hex')}@fep-smoke.invalid`;
}

async function main() {
  console.log(`smoke-staff: target = ${URL}`);
  const suToken = await getSuperuserToken(URL);

  // ---- Schema and rules ----
  await runScenario('1-staff-admins-auth-collection', async () => {
    const cols = await fetchJson(URL, '/api/collections', { headers: { authorization: suToken } });
    const staff = cols.body?.items?.find((c) => c.name === 'staff_admins');
    check(!!staff, 'staff_admins collection exists');
    check(staff.type === 'auth', `staff_admins type = auth (got ${staff?.type})`);
  });

  await runScenario('2-public-rules-locked', async () => {
    const cols = await fetchJson(URL, '/api/collections', { headers: { authorization: suToken } });
    const staff = cols.body?.items?.find((c) => c.name === 'staff_admins');
    const rules = [
      staff.listRule,
      staff.viewRule,
      staff.createRule,
      staff.updateRule,
      staff.deleteRule,
    ];
    check(
      rules.every((r) => r === null),
      `all five rules are null (got ${JSON.stringify(rules)})`,
    );
    check(staff.manageRule === undefined || staff.manageRule === null, 'no public manage rule');
  });

  await runScenario('3-smallest-field-model', async () => {
    const cols = await fetchJson(URL, '/api/collections', { headers: { authorization: suToken } });
    const staff = cols.body?.items?.find((c) => c.name === 'staff_admins');
    const names = staff.fields.map((f) => f.name);
    check(!names.includes('role'), 'no role field');
    check(
      names.includes('display_name') && names.includes('is_active'),
      'display_name + is_active present',
    );
    const custom = names.filter(
      (n) =>
        ![
          'id',
          'password',
          'tokenKey',
          'email',
          'emailVisibility',
          'verified',
          'created',
          'updated',
        ].includes(n),
    );
    check(
      custom.length === 2 && custom.includes('display_name') && custom.includes('is_active'),
      `smallest practical fields only (got ${custom.join(',')})`,
    );
    check(staff.passwordAuth?.enabled === true, 'password auth enabled');
    check(
      JSON.stringify(staff.passwordAuth?.identityFields) === JSON.stringify(['email']),
      `email identity only (got ${JSON.stringify(staff.passwordAuth?.identityFields)})`,
    );
    const emailField = staff.fields.find((f) => f.name === 'email');
    check(emailField?.required === true, 'email required');
  });

  await runScenario('4-public-registration-disabled', async () => {
    // Unauthenticated create / list / view must all fail.
    const create = await fetchJson(URL, '/api/collections/staff_admins/records', {
      method: 'POST',
      body: JSON.stringify({
        email: staffEmail('anon'),
        password: STAFF_PASSWORD,
        passwordConfirm: STAFF_PASSWORD,
        display_name: 'Anon',
      }),
    });
    check(create.status === 403, `public create rejected (got ${create.status})`);
    const list = await fetchJson(URL, '/api/collections/staff_admins/records');
    check(list.status === 403, `public list rejected (got ${list.status})`);
    const view = await fetchJson(URL, '/api/collections/staff_admins/records/whateverid');
    check(view.status === 403 || view.status === 404, `public view rejected (got ${view.status})`);
    const update = await fetchJson(URL, '/api/collections/staff_admins/records/whateverid', {
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'x' }),
    });
    check(update.status === 403, `public update rejected (got ${update.status})`);
    const del = await fetchJson(URL, '/api/collections/staff_admins/records/whateverid', {
      method: 'DELETE',
    });
    check(del.status === 403, `public delete rejected (got ${del.status})`);
  });

  // ---- Identities ----
  const activeStaff = await createStaffViaSuperuser(suToken, { email: staffEmail('active') });
  const activeStaffEmail = activeStaff.email;
  const activeLogin = await fetchJson(URL, '/api/collections/staff_admins/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: activeStaffEmail, password: STAFF_PASSWORD }),
  });
  const staffToken = activeLogin.body?.token ?? '';
  check(activeLogin.status === 200 && !!staffToken, '5: active+verified Staff authenticates');

  const studentPhone = `09${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}91`;
  const signup = await fetchJson(URL, '/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({
      name: 'St',
      phone: studentPhone,
      password: STUDENT_PASSWORD,
      passwordConfirm: STUDENT_PASSWORD,
    }),
  });
  const studentLogin = await fetchJson(URL, '/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({
      identity: signup.body?.phone ?? studentPhone,
      password: STUDENT_PASSWORD,
    }),
  });
  const studentToken = studentLogin.body?.token ?? '';

  // ---- Inactive / unverified ----
  await runScenario('6-inactive-staff-login-rejected', async () => {
    const inactive = await createStaffViaSuperuser(suToken, {
      email: staffEmail('inactive'),
      active: false,
    });
    const r = await fetchJson(URL, '/api/collections/staff_admins/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: inactive.email, password: STAFF_PASSWORD }),
    });
    check(r.status >= 400, `inactive Staff login rejected (got ${r.status})`);
  });

  await runScenario('7-deactivated-staff-rejected', async () => {
    await fetchJson(URL, `/api/collections/staff_admins/records/${activeStaff.id}`, {
      method: 'PATCH',
      headers: { authorization: suToken },
      body: JSON.stringify({ is_active: false }),
    });
    const refresh = await fetchJson(URL, '/api/collections/staff_admins/auth-refresh', {
      method: 'POST',
      headers: { authorization: staffToken },
    });
    check(refresh.status >= 400, `deactivated refresh rejected (got ${refresh.status})`);
    const queue = await fetchJson(URL, '/api/fast-english/operator/payment-requests', {
      headers: { authorization: staffToken },
    });
    check(queue.status === 403, `deactivated staff route rejected (got ${queue.status})`);
    // Re-activate for the rest of the matrix.
    await fetchJson(URL, `/api/collections/staff_admins/records/${activeStaff.id}`, {
      method: 'PATCH',
      headers: { authorization: suToken },
      body: JSON.stringify({ is_active: true }),
    });
  });

  await runScenario('8-unverified-staff-login-rejected', async () => {
    const unverified = await createStaffViaSuperuser(suToken, {
      email: staffEmail('unverified'),
      verified: false,
    });
    const r = await fetchJson(URL, '/api/collections/staff_admins/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: unverified.email, password: STAFF_PASSWORD }),
    });
    check(r.status >= 400, `unverified Staff login rejected (got ${r.status})`);
  });

  // ---- Cross-token matrix ----
  await runScenario('9-student-token-matrix', async () => {
    const current = await fetchJson(URL, '/api/fast-english/payment-requests/current', {
      headers: { authorization: studentToken },
    });
    check(
      current.status === 200,
      `student token accepted on Student route (got ${current.status})`,
    );
    const queue = await fetchJson(URL, '/api/fast-english/operator/payment-requests', {
      headers: { authorization: studentToken },
    });
    check(queue.status === 403, `student token rejected on Staff route (got ${queue.status})`);
  });

  await runScenario('10-staff-token-matrix', async () => {
    const queue = await fetchJson(URL, '/api/fast-english/operator/payment-requests', {
      headers: { authorization: staffToken },
    });
    check(queue.status === 200, `staff token accepted on Staff route (got ${queue.status})`);
    const lessons = await fetchJson(URL, '/api/fast-english/lessons', {
      headers: { authorization: staffToken },
    });
    check(
      lessons.status === 401 || lessons.status === 403,
      `staff token rejected on Student route (got ${lessons.status})`,
    );
    const current = await fetchJson(URL, '/api/fast-english/payment-requests/current', {
      headers: { authorization: staffToken },
    });
    check(
      current.status === 401 || current.status === 403,
      `staff token rejected on Student payment route (got ${current.status})`,
    );
  });

  await runScenario('11-unauthenticated-rejected', async () => {
    const current = await fetchJson(URL, '/api/fast-english/payment-requests/current');
    check(current.status === 401, `unauth Student route rejected (got ${current.status})`);
    const queue = await fetchJson(URL, '/api/fast-english/operator/payment-requests');
    check(queue.status === 401, `unauth Staff route rejected (got ${queue.status})`);
  });

  await runScenario('12-legacy-operator-token-rejected', async () => {
    // Legacy fep_users role=operator record (kept for migration safety).
    const phone = `09${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}92`;
    const s = await fetchJson(URL, '/api/collections/fep_users/records', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Legacy Op',
        phone,
        password: STUDENT_PASSWORD,
        passwordConfirm: STUDENT_PASSWORD,
      }),
    });
    await fetchJson(URL, `/api/collections/fep_users/records/${s.body.id}`, {
      method: 'PATCH',
      headers: { authorization: suToken },
      body: JSON.stringify({ role: 'operator', account_status: 'active' }),
    });
    const login = await fetchJson(URL, '/api/collections/fep_users/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: s.body?.phone ?? phone, password: STUDENT_PASSWORD }),
    });
    const legacyToken = login.body?.token ?? '';
    const queue = await fetchJson(URL, '/api/fast-english/operator/payment-requests', {
      headers: { authorization: legacyToken },
    });
    check(queue.status === 403, `legacy operator rejected on Staff route (got ${queue.status})`);
    const current = await fetchJson(URL, '/api/fast-english/payment-requests/current', {
      headers: { authorization: legacyToken },
    });
    check(
      current.status === 403,
      `legacy operator rejected on Student route (got ${current.status})`,
    );
  });

  await runScenario('13-cross-collection-identity-rejected', async () => {
    const staffAsStudent = await fetchJson(URL, '/api/collections/fep_users/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: activeStaffEmail, password: STAFF_PASSWORD }),
    });
    check(
      staffAsStudent.status >= 400,
      `Staff identity cannot sign into fep_users (got ${staffAsStudent.status})`,
    );
    const studentAsStaff = await fetchJson(
      URL,
      '/api/collections/staff_admins/auth-with-password',
      {
        method: 'POST',
        body: JSON.stringify({
          identity: signup.body?.phone ?? studentPhone,
          password: STUDENT_PASSWORD,
        }),
      },
    );
    check(
      studentAsStaff.status >= 400,
      `Student identity cannot sign into staff_admins (got ${studentAsStaff.status})`,
    );
  });

  // ---- Bootstrap fail-safes ----
  const BOOTSTRAP_EMAIL = staffEmail('bootstrap');
  const BOOTSTRAP_PASSWORD = 'Bootstrap-Staff-9876!';
  const BOOTSTRAP_NEW_PASSWORD = 'Bootstrap-Staff-5432!';
  const baseBootstrapEnv = {
    ...process.env,
    FEP_PB_URL: URL,
    FEP_PB_SUPERUSER_EMAIL: process.env.PB_TEST_SU_EMAIL,
    FEP_PB_SUPERUSER_PASSWORD: process.env.PB_TEST_SU_PASSWORD,
    FEP_STAFF_EMAIL: BOOTSTRAP_EMAIL,
    FEP_STAFF_PASSWORD: BOOTSTRAP_PASSWORD,
    FEP_STAFF_DISPLAY_NAME: 'Bootstrap Staff',
  };

  await runScenario('14-bootstrap-missing-env-fails', async () => {
    const env = { ...baseBootstrapEnv };
    delete env.FEP_STAFF_PASSWORD;
    const r = spawnSync('node', ['scripts/staff-bootstrap.mjs'], { env, encoding: 'utf8' });
    check(r.status !== 0, 'bootstrap fails when required env is missing');
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    check(
      !out.includes('Probe-Staff') && !out.includes('Bootstrap-Staff-9876'),
      'no secret echoed on failure',
    );
  });

  await runScenario('15-bootstrap-weak-password-refused', async () => {
    const env = { ...baseBootstrapEnv, FEP_STAFF_PASSWORD: 'password' };
    const r = spawnSync('node', ['scripts/staff-bootstrap.mjs'], { env, encoding: 'utf8' });
    check(r.status !== 0, 'weak placeholder password refused');
  });

  await runScenario('16-bootstrap-creates-one-record', async () => {
    const r = spawnSync('node', ['scripts/staff-bootstrap.mjs'], {
      env: baseBootstrapEnv,
      encoding: 'utf8',
    });
    check(r.status === 0, `bootstrap create succeeds (status ${r.status})`);
    const login = await fetchJson(URL, '/api/collections/staff_admins/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: BOOTSTRAP_EMAIL, password: BOOTSTRAP_PASSWORD }),
    });
    check(login.status === 200, 'bootstrapped account can authenticate');
  });

  await runScenario('17-bootstrap-refuses-second-record', async () => {
    const r = spawnSync('node', ['scripts/staff-bootstrap.mjs'], {
      env: baseBootstrapEnv,
      encoding: 'utf8',
    });
    check(r.status !== 0, 'second bootstrap run without --replace fails');
    check(
      (r.stdout + r.stderr).includes('already exists'),
      'failure message explains the existing record',
    );
    const list = await fetchJson(
      URL,
      `/api/collections/staff_admins/records?perPage=50&filter=${encodeURIComponent(
        `email = '${BOOTSTRAP_EMAIL}'`,
      )}`,
      { headers: { authorization: suToken } },
    );
    check((list.body?.items ?? []).length === 1, 'exactly one record exists');
  });

  await runScenario('18-bootstrap-replace-resets', async () => {
    const env = { ...baseBootstrapEnv, FEP_STAFF_PASSWORD: BOOTSTRAP_NEW_PASSWORD };
    const r = spawnSync('node', ['scripts/staff-bootstrap.mjs', '--replace'], {
      env,
      encoding: 'utf8',
    });
    check(r.status === 0, '--replace succeeds');
    const oldLogin = await fetchJson(URL, '/api/collections/staff_admins/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: BOOTSTRAP_EMAIL, password: BOOTSTRAP_PASSWORD }),
    });
    check(oldLogin.status >= 400, 'old password stops working after replace');
    const newLogin = await fetchJson(URL, '/api/collections/staff_admins/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: BOOTSTRAP_EMAIL, password: BOOTSTRAP_NEW_PASSWORD }),
    });
    check(newLogin.status === 200, 'new password works after replace');
  });

  await runScenario('19-bootstrap-no-credential-leak', async () => {
    const env = {
      ...baseBootstrapEnv,
      FEP_STAFF_PASSWORD: BOOTSTRAP_NEW_PASSWORD,
    };
    const r = spawnSync('node', ['scripts/staff-bootstrap.mjs', '--replace'], {
      env,
      encoding: 'utf8',
    });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    check(
      !out.includes(BOOTSTRAP_NEW_PASSWORD) &&
        !out.includes(BOOTSTRAP_EMAIL) &&
        !out.includes(process.env.PB_TEST_SU_PASSWORD),
      'bootstrap output leaks no credentials',
    );
  });

  // ---- Legacy diagnostic ----
  await runScenario('20-legacy-diag-safe', async () => {
    const env = {
      ...process.env,
      FEP_PB_URL: URL,
      FEP_PB_SUPERUSER_EMAIL: process.env.PB_TEST_SU_EMAIL,
      FEP_PB_SUPERUSER_PASSWORD: process.env.PB_TEST_SU_PASSWORD,
    };
    const r = spawnSync('node', ['scripts/staff-legacy-diag.mjs'], { env, encoding: 'utf8' });
    check(r.status === 0, 'legacy diag runs');
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    check(/legacy non-Student fep_users record\(s\)/.test(out), 'diag prints the count');
    check(!/09\d{9}/.test(out), 'diag prints no phone numbers');
    check(!/@fep-smoke\.invalid/.test(out), 'diag prints no emails');
    const rIds = spawnSync('node', ['scripts/staff-legacy-diag.mjs', '--ids'], {
      env,
      encoding: 'utf8',
    });
    check(/id=[a-z0-9]+/.test(rIds.stdout ?? ''), '--ids prints record IDs only');
  });

  if (exitCode === 0) {
    console.log('\nsmoke-staff: ALL CHECKS PASSED');
  } else {
    console.error('\nsmoke-staff: FAILED');
  }
  process.exit(exitCode);
}

main();
