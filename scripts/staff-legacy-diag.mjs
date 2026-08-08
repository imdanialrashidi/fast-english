#!/usr/bin/env node
// scripts/staff-legacy-diag.mjs
// Podcast Slice 1 — safe diagnostic for legacy non-Student `fep_users`
// records (the old operator/content_manager accounts).
//
// The transition rule for legacy Staff accounts is:
//   legacy fep_users Staff account
//     → no longer accepted by Staff routes
//     → no longer shown Staff navigation
//     → manually re-enrolled once into staff_admins
//
// Nothing is deleted, demoted or rewritten here, and no password hash is
// ever read or migrated. Ordinary output contains only the COUNT of legacy
// records; record IDs are printed only with `--ids` for an explicit
// migration operation. Phone numbers, emails, tokens and passwords are
// never printed.
//
// Usage:
//   pnpm staff:diag [--ids]
//
// Required environment variables (names only):
//   FEP_PB_URL                PocketBase base URL (default http://127.0.0.1:8090)
//   FEP_PB_SUPERUSER_EMAIL    approved PocketBase superuser email
//   FEP_PB_SUPERUSER_PASSWORD approved PocketBase superuser password

const PB_URL = process.env.FEP_PB_URL ?? 'http://127.0.0.1:8090';
const SU_EMAIL = process.env.FEP_PB_SUPERUSER_EMAIL ?? '';
const SU_PASSWORD = process.env.FEP_PB_SUPERUSER_PASSWORD ?? '';
const SHOW_IDS = process.argv.includes('--ids');

function fail(message) {
  console.error(`staff-legacy-diag: ${message}`);
  process.exit(1);
}

if (!SU_EMAIL || !SU_PASSWORD) {
  fail('FEP_PB_SUPERUSER_EMAIL and FEP_PB_SUPERUSER_PASSWORD are required');
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
  const suAuth = await jsonFetch('/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: SU_EMAIL, password: SU_PASSWORD }),
  });
  if (suAuth.status !== 200 || !suAuth.body?.token) {
    fail(`superuser authentication failed (status ${suAuth.status})`);
  }
  const suToken = suAuth.body.token;

  // Only IDs are fetched; the filter never selects sensitive fields.
  const list = await jsonFetch(
    '/api/collections/fep_users/records?perPage=200&filter=' +
      encodeURIComponent("role != 'student'") +
      '&fields=id,role',
    { headers: { authorization: suToken } },
  );
  if (list.status !== 200) {
    fail(`could not list fep_users (status ${list.status})`);
  }
  const items = list.body?.items ?? [];
  const roles = {};
  for (const item of items) {
    const role = String(item.role ?? '');
    roles[role] = (roles[role] ?? 0) + 1;
  }
  console.log(`staff-legacy-diag: ${items.length} legacy non-Student fep_users record(s)`);
  for (const [role, count] of Object.entries(roles)) {
    console.log(`staff-legacy-diag:   role=${role} count=${count}`);
  }
  if (SHOW_IDS) {
    for (const item of items) {
      console.log(`staff-legacy-diag:   id=${item.id}`);
    }
  } else {
    console.log(
      'staff-legacy-diag: pass --ids to print record IDs for an explicit migration operation',
    );
  }
}

main().catch((err) => {
  fail(`unexpected error: ${err?.message ?? err}`);
});
