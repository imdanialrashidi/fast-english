// tests/restore-drill-collections.test.mjs
// Business Configuration slice — deterministic collection-contract
// regression for deploy/restore-drill.sh.
//
// The restore drill must fail when a restored backup is missing ANY
// launch-critical collection. Its collection list is derived here from
// the actual migrations (server/pb_migrations/*.js): every collection
// created by a `new Collection({...})` migration must appear in the
// drill's loop. A future migration that adds a collection will fail this
// test until the drill list is updated — the exact defect found in the
// release-readiness audit (the drill verified a stale list and could
// pass while newer product collections were missing).

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');

/** Parse the physical collection names created by the migrations. */
function migrationCollections() {
  const dir = path.join(ROOT, 'server', 'pb_migrations');
  const names = new Set();
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort()) {
    const src = readFileSync(path.join(dir, file), 'utf8');
    if (!/new\s+Collection\s*\(/.test(src)) continue;
    // Pattern A: `const COLLECTION = 'x';` + `name: COLLECTION` inside the
    // Collection options (used by most migrations).
    const decl = src.match(/const\s+([A-Z_]+)\s*=\s*'([a-z_][a-z0-9_]*)'\s*;/);
    if (decl && new RegExp(`name:\\s*${decl[1]}`).test(src)) {
      names.add(decl[2]);
      continue;
    }
    // Pattern B: literal `name: 'x'` directly inside `new Collection({...})`.
    const m = src.match(/new\s+Collection\s*\(\s*\{[\s\S]*?name\s*:\s*'([a-z_][a-z0-9_]*)'/);
    if (m) names.add(m[1]);
  }
  return names;
}

/** Parse the drill's `for col in ...` list. */
function drillCollections() {
  const src = readFileSync(path.join(ROOT, 'deploy', 'restore-drill.sh'), 'utf8');
  const m = src.match(/for col in ([a-z0-9_ ]+); do/);
  assert.ok(m, 'restore-drill.sh must contain a `for col in ...; do` loop');
  return new Set(m[1].trim().split(/\s+/));
}

test('restore drill verifies every collection created by the migrations', () => {
  const fromMigrations = migrationCollections();
  const inDrill = drillCollections();

  const missing = [...fromMigrations].filter((c) => !inDrill.has(c)).sort();
  assert.deepEqual(
    missing,
    [],
    `restore-drill.sh is missing collections created by migrations: ${missing.join(', ')}. ` +
      'Update the `for col in ...` list in deploy/restore-drill.sh.',
  );

  const stale = [...inDrill].filter((c) => c !== '_superusers' && !fromMigrations.has(c)).sort();
  assert.deepEqual(
    stale,
    [],
    `restore-drill.sh lists collections that no migration creates: ${stale.join(', ')}`,
  );
});

test('restore drill covers the full launch-critical contract (count)', () => {
  const fromMigrations = migrationCollections();
  const inDrill = drillCollections();
  assert.ok(inDrill.has('_superusers'), 'drill must always verify superuser auth');
  // Every product collection + _superusers.
  assert.equal(inDrill.size, fromMigrations.size + 1);
});

test('current migration set contains the known launch-critical collections', () => {
  const fromMigrations = migrationCollections();
  for (const expected of [
    'fep_users',
    'plans',
    'payment_destination',
    'payment_requests',
    'subscriptions',
    'placement_questions',
    'placement_attempts',
    'topics',
    'lessons',
    'lesson_progress',
    'staff_admins',
    'categories',
    'lesson_vocabulary',
    'content_imports',
    'content_operations',
    'site_settings',
  ]) {
    assert.ok(fromMigrations.has(expected), `migrations must create ${expected}`);
  }
  // rate_limits is NOT a collection: migrations 1700000001/0005 only tune
  // PocketBase built-in rate-limit settings (a drill entry for it would 404).
  assert.ok(!fromMigrations.has('rate_limits'), 'rate_limits is not a real collection');
});
