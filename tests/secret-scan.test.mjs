import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const filterPath = path.join(repositoryRoot, 'scripts', 'secret-scan-filter.mjs');
const allowlistPath = path.join(repositoryRoot, 'scripts', 'secret-scan-allowlist.json');

function runFilter(inputLines) {
  const result = spawnSync(process.execPath, [filterPath], {
    cwd: repositoryRoot,
    input: `${inputLines.join('\n')}\n`,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `filter failed: ${result.stderr}`);
  return result.stdout.split('\n').filter(Boolean);
}

// The same pattern pi-doctor.sh greps with.
const SCAN_PATTERN =
  'sk-[A-Za-z0-9_-]{16,}|(API_KEY|ACCESS_TOKEN|SECRET|PASSWORD)[[:space:]]*=[[:space:]]*[^"<${][^[:space:]]+';

function runRepoScan() {
  const result = spawnSync(
    'bash',
    [
      '-c',
      `find . -maxdepth 6 -type f ! -path './.git/*' ! -path './.artifacts/*' ! -path './node_modules/*' ! -path './.pi/npm/*' -print0 | xargs -0 grep -En '${SCAN_PATTERN}'`,
    ],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  // grep exits 1 when nothing matches — that is a valid empty scan.
  assert.ok([0, 1].includes(result.status), `repo scan failed: ${result.stderr}`);
  return result.stdout.split('\n').filter(Boolean);
}

// Probe credentials are assembled from parts so this test file itself never
// contains a literal secret pattern (the doctor scans the whole tree,
// including tests/).
const probeSk = 'sk-real' + '1234567890123456789012';
const probeSmtp = 'Real-Smtp' + '-Secret-9x8z7y';
const probeWhsec = 'whsec_real_live_secret_' + 'abc123def456';
const probeStaff = 'Probe-Staff-' + '12345!';
const probeSentinel = 'S3NT1NEL-SUPER-' + 'PASS-8f3a9c2d';

test('the secret-scan allowlist is valid and documented', () => {
  const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  assert.equal(allowlist.version, 1);
  assert.ok(Array.isArray(allowlist.entries) && allowlist.entries.length > 0);
  for (const entry of allowlist.entries) {
    assert.equal(typeof entry.path, 'string');
    assert.equal(typeof entry.value, 'string');
    assert.equal(typeof entry.why, 'string');
    assert.ok(entry.why.length > 20, 'every allowlist entry must document its purpose');
  }
});

test('every allowlist entry corresponds to a real current scan hit at its exact path', () => {
  const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  const scan = new Set(runRepoScan().map((line) => line.replace(/^\.\//, '')));
  for (const entry of allowlist.entries) {
    const prefix = `${entry.path}:`;
    const hit = [...scan].find((line) => line.startsWith(prefix) && line.includes(entry.value));
    assert.ok(
      hit,
      `allowlist entry ${entry.path} = ${entry.value} no longer matches a scan hit (stale entry)`,
    );
  }
});

test('filtering the current repo scan leaves zero suspicious lines', () => {
  const scan = runRepoScan();
  if (scan.length === 0) return; // nothing to filter
  const remaining = runFilter(scan);
  assert.deepEqual(
    remaining,
    [],
    'unexpected secret-pattern hits remain after the documented exemptions',
  );
});

// Fake lines are assembled at runtime so this file itself never contains
// the literal `NAME = value` sequence the scan looks for.
function fakeLine(path, line, name, value) {
  return `${path}:${line}:const ${name} = '${value}';`;
}

test('a real-looking committed credential still fails the filter', () => {
  const remaining = runFilter([
    fakeLine('src/config.ts', 1, 'API_KEY', probeSk),
    fakeLine('deploy/configure.sh', 1, 'FEP_SMTP_PASSWORD', probeSmtp),
    fakeLine('server/hooks.js', 1, 'STRIPE_SECRET', probeWhsec),
    fakeLine('scripts/smoke-other.mjs', 1, 'STAFF_PASSWORD', probeStaff),
  ]);
  assert.equal(remaining.length, 4, 'every real-looking credential line must remain flagged');
});

test('the same synthetic value at an unexpected path still fails', () => {
  const line = fakeLine('app/src/lib/x.ts', 2, 'PASSWORD', probeSentinel);
  const remaining = runFilter([line]);
  assert.deepEqual(remaining, [line]);
});

test('documented placeholder and env-reference lines are exempted', () => {
  const remaining = runFilter([
    '.env.example:23:# FEP_ANDROID_KEYSTORE_PASSWORD=...',
    'deploy/env.production.example:9:# FEP_SUPERUSER_PASSWORD=change-me-32-chars-min',
    "scripts/staff-bootstrap.mjs:32:const SU_PASSWORD = process.env.FEP_PB_SUPERUSER_PASSWORD ?? '';",
  ]);
  assert.deepEqual(remaining, []);
});

test('the allowlist never hides an entry whose value appears outside its documented paths', () => {
  const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  const scan = runRepoScan();
  for (const entry of allowlist.entries) {
    const allowedPaths = new Set(
      allowlist.entries.filter((other) => other.value === entry.value).map((other) => other.path),
    );
    const foreign = scan.filter((line) => {
      if (!line.includes(entry.value)) return false;
      const path = line.replace(/^\.\//, '').split(':')[0];
      return !allowedPaths.has(path);
    });
    assert.deepEqual(
      foreign,
      [],
      `${entry.value} must only appear in its documented allowlist paths: ${[...allowedPaths].join(', ')}`,
    );
  }
});
