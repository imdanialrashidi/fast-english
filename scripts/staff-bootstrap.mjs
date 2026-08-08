#!/usr/bin/env node
// scripts/staff-bootstrap.mjs
// Podcast Slice 1 — controlled one-time Staff Administrator bootstrap.
//
// Creates (or, with --replace, explicitly updates) exactly one
// `staff_admins` record and marks it active + verified. This is the ONLY
// supported path for making a usable Staff account; no Production password
// is ever seeded in a migration and no legacy password hash is copied from
// `fep_users`.
//
// Usage:
//   pnpm staff:bootstrap [--replace]
//
// Required environment variables (names only — values stay outside Git):
//   FEP_PB_URL                  PocketBase base URL (default http://127.0.0.1:8090)
//   FEP_PB_SUPERUSER_EMAIL      approved PocketBase superuser email
//   FEP_PB_SUPERUSER_PASSWORD   approved PocketBase superuser password
//   FEP_STAFF_EMAIL             Staff login email (unique)
//   FEP_STAFF_PASSWORD          strong Staff password (>= 12 chars)
//   FEP_STAFF_DISPLAY_NAME      Staff display name
//
// Behavior:
//   - fails when any required value is missing;
//   - refuses weak placeholder passwords;
//   - creates one record when none exists;
//   - refuses to create a second record when one already exists
//     (use --replace to explicitly reset the existing record);
//   - never prints passwords, tokens, emails or credentials.

const PB_URL = process.env.FEP_PB_URL ?? 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.FEP_PB_SUPERUSER_EMAIL ?? '';
const SU_PASSWORD = process.env.FEP_PB_SUPERUSER_PASSWORD ?? '';
const STAFF_EMAIL = process.env.FEP_STAFF_EMAIL ?? '';
const STAFF_PASSWORD = process.env.FEP_STAFF_PASSWORD ?? '';
const STAFF_DISPLAY_NAME = process.env.FEP_STAFF_DISPLAY_NAME ?? '';
const REPLACE = process.argv.includes('--replace');

function fail(message) {
  console.error(`staff-bootstrap: ${message}`);
  process.exit(1);
}

// --- Validation (fail-fast, no secrets echoed) ---
if (!SU_EMAIL || !SU_PASSWORD) {
  fail('FEP_PB_SUPERUSER_EMAIL and FEP_PB_SUPERUSER_PASSWORD are required');
}
if (!STAFF_EMAIL || !STAFF_PASSWORD || !STAFF_DISPLAY_NAME) {
  fail('FEP_STAFF_EMAIL, FEP_STAFF_PASSWORD and FEP_STAFF_DISPLAY_NAME are required');
}
const email = String(STAFF_EMAIL).trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail('FEP_STAFF_EMAIL must be a valid email address');
}
const displayName = String(STAFF_DISPLAY_NAME).trim();
if (displayName.length < 2 || displayName.length > 120) {
  fail('FEP_STAFF_DISPLAY_NAME must be 2-120 characters');
}
const password = String(STAFF_PASSWORD);
if (password.length < 12) {
  fail('FEP_STAFF_PASSWORD must be at least 12 characters');
}
const weakPlaceholders = ['password', 'changeme', '12345678', 'staffpassword', email];
if (weakPlaceholders.some((w) => password.toLowerCase() === w.toLowerCase())) {
  fail('FEP_STAFF_PASSWORD is a weak placeholder — choose a real password');
}

async function jsonFetch(path, init = {}) {
  const res = await fetch(`${PB_URL}${path}`, {
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
  return { status: res.status, body };
}

async function main() {
  // 1. Superuser authentication (credentials never logged).
  const suAuth = await jsonFetch('/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: SU_EMAIL, password: SU_PASSWORD }),
  });
  if (suAuth.status !== 200 || !suAuth.body?.token) {
    fail(
      `superuser authentication failed (status ${suAuth.status}) — check FEP_PB_SUPERUSER_* credentials`,
    );
  }
  const suToken = suAuth.body.token;

  // 2. Find the existing record by email (exactly one Staff identity).
  const list = await jsonFetch(
    `/api/collections/staff_admins/records?perPage=1&filter=${encodeURIComponent(
      `email = '${email}'`,
    )}`,
    { headers: { authorization: suToken } },
  );
  if (list.status !== 200) {
    fail('could not list staff_admins — is the staff_admins migration applied?');
  }
  const existing = list.body?.items?.[0] ?? null;

  // 3. Create or explicitly replace.
  let result;
  if (existing) {
    if (!REPLACE) {
      fail(
        'a Staff record with this email already exists — refusing to create a second one. ' +
          'Use --replace to explicitly reset it (sets active + verified + new password).',
      );
    }
    const patch = await jsonFetch(`/api/collections/staff_admins/records/${existing.id}`, {
      method: 'PATCH',
      headers: { authorization: suToken },
      body: JSON.stringify({
        display_name: displayName,
        password,
        passwordConfirm: password,
        is_active: true,
        verified: true,
      }),
    });
    if (patch.status !== 200) {
      fail(`replacing the Staff record failed (status ${patch.status})`);
    }
    result = patch.body;
    console.log(`staff-bootstrap: replaced existing Staff record ${result.id}`);
  } else {
    const created = await jsonFetch('/api/collections/staff_admins/records', {
      method: 'POST',
      headers: { authorization: suToken },
      body: JSON.stringify({
        email,
        password,
        passwordConfirm: password,
        display_name: displayName,
        is_active: true,
        verified: true,
      }),
    });
    if (created.status !== 200) {
      fail(`creating the Staff record failed (status ${created.status})`);
    }
    result = created.body;
    console.log(`staff-bootstrap: created Staff record ${result.id}`);
  }

  // 4. Verify the record is usable (active + verified persisted).
  if (result.is_active !== true || result.verified !== true) {
    fail('the Staff record was not persisted as active+verified');
  }
  console.log('staff-bootstrap: done — the Staff account is active and verified.');
}

main().catch((err) => {
  fail(`unexpected error: ${err?.message ?? err}`);
});
