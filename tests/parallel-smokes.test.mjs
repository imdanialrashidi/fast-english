import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

// The parallel smoke runner (CI backend lane) and the canonical serial
// project-verify.sh gate must cover exactly the same smoke suites. A suite
// dropped from either list would silently shrink the release gate.
// Identity key: the smoke script name (smoke-*.mjs), which is unique per
// suite even though several suites share a wrapper (smoke-payment.sh /
// smoke-placement.sh).
test('parallel smoke runner covers the same suites as the serial gate', () => {
  const parallel = fs.readFileSync(
    path.join(repositoryRoot, 'scripts/verify-smokes-parallel.sh'),
    'utf8',
  );
  const serial = fs.readFileSync(path.join(repositoryRoot, 'scripts/project-verify.sh'), 'utf8');

  const parallelScripts = [...parallel.matchAll(/smoke-[a-z-]+\.mjs/gm)].map((m) => m[0]);
  const serialScripts = [...serial.matchAll(/smoke-[a-z-]+\.mjs/gm)].map((m) => m[0]);

  assert.ok(parallelScripts.length > 0, 'no suites found in scripts/verify-smokes-parallel.sh');
  assert.deepEqual(
    [...parallelScripts].sort(),
    [...serialScripts].sort(),
    'parallel runner and serial gate must list the same smoke suites',
  );
  assert.equal(new Set(parallelScripts).size, 16, 'expected exactly 16 distinct smoke suites');
  assert.equal(
    parallelScripts.length,
    new Set(parallelScripts).size,
    'parallel runner must not duplicate a suite',
  );
});

test('every parallel suite maps to a unique disposable port', () => {
  const parallel = fs.readFileSync(
    path.join(repositoryRoot, 'scripts/verify-smokes-parallel.sh'),
    'utf8',
  );
  // Ports are assigned sequentially from BASE_PORT; uniqueness is implied by
  // the single counter, but the BASE_PORT range must not collide with the
  // e2e ports (18101-18104) or the serial smoke defaults (18090-18099).
  const baseMatch = parallel.match(/BASE_PORT=(\d+)/);
  assert.ok(baseMatch, 'BASE_PORT must be defined');
  const base = Number(baseMatch[1]);
  const suiteCount = new Set([...parallel.matchAll(/smoke-[a-z-]+\.mjs/gm)].map((m) => m[0])).size;
  assert.ok(base >= 18110, 'BASE_PORT must not collide with e2e/serial smoke ports');
  assert.ok(base + suiteCount < 20000, 'BASE_PORT range must stay in the ephemeral-safe space');
});
