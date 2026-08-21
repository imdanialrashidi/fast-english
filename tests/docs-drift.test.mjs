// tests/docs-drift.test.mjs
// Structural guard for doc drift — plan 023.
// Mirrors style of tests/hook-rate-limit.test.mjs (node:test + string counts).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('README quick-start uses setup:pocketbase colon and no hyphen typo', () => {
  const src = read('README.md');
  assert.ok(src.includes('setup:pocketbase'), 'README must contain setup:pocketbase (colon)');
  // Hyphen typo as a code command should not exist (allow hyphen in comments outside code? we forbid the exact pnpm hyphen command)
  assert.ok(
    !src.includes('pnpm setup-pocketbase'),
    'README must not contain pnpm setup-pocketbase (hyphen typo)',
  );
});

test('ARCHITECTURE lists three Vite surfaces', () => {
  const src = read('docs/ARCHITECTURE.md');
  assert.ok(src.includes('vite.admin.config.ts'), 'ARCHITECTURE must contain vite.admin.config.ts');
  assert.ok(src.includes('Three isolated Vite'), 'ARCHITECTURE must contain "Three isolated Vite"');
  assert.ok(
    !src.includes('Two isolated Vite'),
    'ARCHITECTURE must not contain "Two isolated Vite"',
  );
});

test('suite counts are 18 in docs and verify header', () => {
  const readme = read('README.md');
  const arch = read('docs/ARCHITECTURE.md');
  const quality = read('docs/QUALITY.md');
  const tooling = read('docs/TOOLING_SETUP.md');
  const verify = read('scripts/project-verify.sh');
  // Each must mention 18 suites/suites in relevant context (allow "18 real-PocketBase suites")
  for (const [name, src] of [
    ['README', readme],
    ['ARCHITECTURE', arch],
    ['QUALITY', quality],
    ['TOOLING_SETUP', tooling],
  ]) {
    assert.ok(
      /18[^\n]*?(suite|smoke)/i.test(src),
      `${name} must contain "18" near "suite"/"smoke"`,
    );
  }
  assert.ok(/18[^\n]*?(smoke|suite)/i.test(verify), 'project-verify.sh header must mention 18');
  // Negative: no stale 16/15 suite mentions in docs
  for (const [name, src] of [
    ['README', readme],
    ['ARCHITECTURE', arch],
    ['QUALITY', quality],
    ['TOOLING_SETUP', tooling],
  ]) {
    assert.ok(!/16 (suite|smoke)/.test(src), `${name} must not contain "16 suite/smoke" (stale)`);
    assert.ok(!/15 (suite|smoke)/.test(src), `${name} must not contain "15 suite/smoke" (stale)`);
  }
  assert.ok(!/16 smoke/.test(verify), 'project-verify.sh must not contain "16 smoke"');
});

test('CONTRIBUTING Node version is 24 and not 22.19', () => {
  const src = read('CONTRIBUTING.md');
  assert.ok(src.includes('Node 24'), 'CONTRIBUTING must contain Node 24');
  assert.ok(!src.includes('22.19'), 'CONTRIBUTING must not contain 22.19');
});

test('.env.example contains dev-only vars', () => {
  const src = read('.env.example');
  assert.ok(src.includes('VITE_CATALOG'), '.env.example must contain VITE_CATALOG');
  assert.ok(src.includes('PB_CORS_ORIGINS'), '.env.example must contain PB_CORS_ORIGINS');
});

test('package.json smoke:* count is 18 and docs match', () => {
  const pkg = JSON.parse(read('package.json'));
  const smokes = Object.keys(pkg.scripts).filter((k) => k.startsWith('smoke:'));
  assert.equal(
    smokes.length,
    18,
    `expected 18 smoke:* scripts, got ${smokes.length}: ${smokes.join(', ')}`,
  );
});
