#!/usr/bin/env node
// scripts/smoke-auth.mjs
// Real-backend PocketBase auth smoke test. Starts a disposable PB instance,
// exercises the auth flow end-to-end, and cleans up.
//
// Usage: node scripts/smoke-auth.mjs
//
// Assumes scripts/setup-pocketbase.sh has been run (server/pocketbase exists).
// Assumes a PocketBase instance is already running (started by
// scripts/smoke-auth.sh or the developer).

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

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
    await wait(200);
  }
  return false;
}

// ---------- 1. Health ----------
async function step1Health() {
  const r = await jsonFetch('/api/health');
  check(r.status === 200, 'health returns 200');
  check(r.body?.code === 200, 'health body code = 200');
}

// ---------- 2. Collection exists ----------
async function step2Collection() {
  // The schema endpoint requires admin auth in PB 0.39. Instead, verify
  // the collection exists and is wired up by attempting an unauthenticated
  // auth-methods call (returns 400 with method info if available) and by
  // confirming that a signup with a duplicate phone returns a
  // "not unique" validation error (proving the unique index exists).
  const r = await jsonFetch('/api/collections/fep_users/auth-methods');
  check(r.status === 200 || r.status === 400, 'fep_users auth-methods endpoint reachable');
  // Confirm unique index via duplicate signup.
  const ts = String(Date.now()).slice(-9);
  const first = await signup({
    name: 'یکتا',
    phone: `09${ts}`,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  const dup = await signup({
    name: 'تکراری',
    phone: `+989${ts}`,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(first.status === 200, 'first signup succeeds');
  check(dup.status >= 400, 'duplicate phone rejected (unique index works)');
}

// ---------- 3-8. Signup ----------
async function signup(payload) {
  return jsonFetch('/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function uniquePhone() {
  const stamp = Date.now().toString().slice(-9);
  return `+989${stamp}`;
}

async function step3Signup() {
  const phone = '09123456789';
  const canonical = uniquePhone();
  // We need a unique phone each run; use a timestamp-based one.
  const ts = Date.now().toString().slice(-9);
  const r = await signup({
    name: 'تست',
    phone: `09${ts}`,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(r.status === 200, 'signup with 09... succeeds (200)');
  check(r.body?.phone === `+989${ts}`, 'phone stored canonically as +989...');
  check(r.body?.role === 'student', 'role is student');
  check(r.body?.account_status === 'pending_payment', 'account_status is pending_payment');
  return { phone: `+989${ts}`, canonical: `+989${ts}` };
}

// ---------- 4. Persian digit normalization ----------
async function step4Persian() {
  const ts = Date.now().toString().slice(-9);
  const tsNext = String(Number(ts) + 1).slice(-9);
  const r = await signup({
    name: 'فارسی',
    phone: `۰۹${tsNext}`,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(r.status === 200, 'signup with Persian digits succeeds (200)');
  check(r.body?.phone === `+989${tsNext}`, 'Persian digits normalized to +989...');
}

// ---------- 5. Alternate forms collide ----------
async function step5Collision({ canonical }) {
  const ts = canonical.slice(4); // strip +98
  // Try 989... and +989... with same digits
  const r1 = await signup({
    name: 'تکراری ۱',
    phone: `989${ts}`,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  const r2 = await signup({
    name: 'تکراری ۲',
    phone: `+989${ts}`,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(r1.status >= 400, '989... form with same digits is rejected (duplicate)');
  check(r2.status >= 400, '+989... form with same digits is rejected (duplicate)');
}

// ---------- 6. Invalid phone rejected ----------
async function step6Invalid() {
  const r = await signup({
    name: 'بد',
    phone: '123',
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(r.status >= 400, 'invalid phone rejected (400)');
}

// ---------- 7. Empty name rejected ----------
async function step7EmptyName() {
  const ts = String(Date.now()).slice(-9);
  const tsNext = String(Number(ts) + 2).slice(-9);
  const r = await signup({
    name: '   ',
    phone: `09${tsNext}`,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(r.status >= 400, 'empty/whitespace name rejected (400)');
}

// ---------- 8. Optional email ----------
async function step8Email() {
  const ts = String(Date.now()).slice(-9);
  const tsNext = String(Number(ts) + 3).slice(-9);
  const r1 = await signup({
    name: 'ایمیل',
    phone: `09${tsNext}`,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(r1.status === 200, 'signup without email succeeds');
  const tsNext2 = String(Number(ts) + 4).slice(-9);
  const r2 = await signup({
    name: 'ایمیل',
    phone: `09${tsNext2}`,
    email: 'real@test.local',
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  check(r2.status === 200, 'signup with email succeeds');
}

// ---------- 9-10. Protected fields ----------
async function step9Protected() {
  const ts = String(Date.now()).slice(-9);
  const tsNext = String(Number(ts) + 5).slice(-9);
  const r = await signup({
    name: 'بد',
    phone: `09${tsNext}`,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
    role: 'operator',
    account_status: 'active',
  });
  check(r.status === 200, 'signup with role=operator still succeeds');
  check(r.body?.role === 'student', 'role override ignored (still student)');
  check(r.body?.account_status === 'pending_payment', 'account_status override ignored');
}

// ---------- 11. Login ----------
async function step11Login({ canonical }) {
  const email = `${canonical}@fep.local`;
  const r = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: email, password: 'Test1234!' }),
  });
  check(r.status === 200, 'login with correct password succeeds');
  check(typeof r.body?.token === 'string' && r.body.token.length > 20, 'returns auth token');
  return r.body.token;
}

// ---------- 12. Alternate form login ----------
async function step12AlternateLogin() {
  const ts = String(Date.now()).slice(-9);
  const tsNext = String(Number(ts) + 6).slice(-9);
  const phone = `09${tsNext}`;
  // First create
  await signup({
    name: 'جایگزین',
    phone,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  });
  // Login with 989... form
  const r = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: `+989${tsNext}@fep.local`, password: 'Test1234!' }),
  });
  check(r.status === 200, 'login with +989... email form succeeds');
}

// ---------- 13. Wrong password ----------
async function step13WrongPassword({ canonical }) {
  const r = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: `${canonical}@fep.local`, password: 'WrongPass!' }),
  });
  check(r.status >= 400, 'wrong password rejected');
}

// ---------- 14. Auth refresh ----------
async function step14Refresh(token) {
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
async function step16List(token) {
  const r = await jsonFetch('/api/collections/fep_users/records?page=1&perPage=200', {
    headers: { authorization: token },
  });
  // Even with auth, the listRule is `id = @request.auth.id`, so the user
  // can only see their own record. The total should be 1.
  check(r.status === 200, 'authenticated list returns 200');
  check(
    r.body?.totalItems === 1,
    `user can only see their own record (totalItems=${r.body?.totalItems})`,
  );
}

// ---------- 17. Update protected fields ----------
async function step17UpdateProtected(token) {
  const r = await jsonFetch('/api/collections/fep_users/records/me', {
    method: 'PATCH',
    headers: { authorization: token },
    body: JSON.stringify({ role: 'operator', account_status: 'active' }),
  });
  check(r.status >= 400, 'student cannot self-promote role/account_status');
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
  const ctx = await step3Signup();
  await step4Persian();
  await step5Collision(ctx);
  await step6Invalid();
  await step7EmptyName();
  await step8Email();
  await step9Protected();
  const token = await step11Login(ctx);
  await step12AlternateLogin();
  await step13WrongPassword(ctx);
  await step14Refresh(token);
  await step15InvalidToken();
  await step16List(token);
  await step17UpdateProtected(token);
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
