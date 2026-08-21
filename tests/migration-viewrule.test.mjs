// tests/migration-viewrule.test.mjs
// Structural guard for lessons viewRule drift fix — plan 024.
// Asserts the additive migration removes level gating while preserving other conjuncts.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const migPath = path.resolve(
  import.meta.dirname,
  '..',
  'server',
  'pb_migrations',
  '1700000031_fix_lessons_viewrule_cross_level.js',
);

test('lessons viewRule migration exists', () => {
  assert.ok(fs.existsSync(migPath), `migration file must exist at ${migPath}`);
});

test('lessons viewRule no longer gates on level', () => {
  const src = fs.readFileSync(migPath, 'utf8');
  const parts = src.split('collection.viewRule =');
  assert.ok(parts.length >= 3, 'migration must have 2 viewRule assignments');
  const upSlice = parts[1];
  assert.ok(
    !upSlice.includes('level = @request.auth.selected_level'),
    'up viewRule must not contain level = @request.auth.selected_level',
  );
  assert.ok(
    upSlice.includes("status = 'published'"),
    "up viewRule must contain status = 'published'",
  );
  assert.ok(
    upSlice.includes("topic.status = 'published'"),
    "up viewRule must contain topic.status = 'published'",
  );
  assert.ok(
    upSlice.includes("@request.context = 'protectedFile'"),
    'up viewRule must contain protectedFile context',
  );
  assert.ok(
    upSlice.includes("@request.auth.role = 'student'"),
    'up viewRule must contain role student',
  );
});

test('migration down branch restores level for reversibility (best-effort)', () => {
  const src = fs.readFileSync(migPath, 'utf8');
  // The file should contain two viewRule assignments (up and down)
  const count = (src.match(/collection\.viewRule =/g) || []).length;
  assert.equal(count, 2, 'migration must have exactly 2 viewRule assignments (up + down)');
  // Down branch should contain the level clause
  const lastIndex = src.lastIndexOf('collection.viewRule =');
  const downSlice = src.slice(lastIndex, lastIndex + 800);
  assert.ok(
    downSlice.includes('level = @request.auth.selected_level'),
    'down viewRule should restore level gating',
  );
});

test('no stale viewRule remains in migrations history (except revert branch)', () => {
  const migDir = path.resolve(import.meta.dirname, '..', 'server', 'pb_migrations');
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith('.js') && f !== '1700000031_fix_lessons_viewrule_cross_level.js');
  for (const f of files) {
    if (f === '1700000014_create_lessons.js') {
      // Original creation still has the drift; that's expected history — skip assert for it
      continue;
    }
    const src = fs.readFileSync(path.join(migDir, f), 'utf8');
    // No other migration should reintroduce the level-gated viewRule for lessons
    if (src.includes('lessons') && src.includes('viewRule')) {
      assert.ok(
        !src.includes('level = @request.auth.selected_level'),
        `${f} must not reintroduce level gating in viewRule`,
      );
    }
  }
});
