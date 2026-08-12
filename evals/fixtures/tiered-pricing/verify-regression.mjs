import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const fixtureRoot = import.meta.dirname;
const repositoryRoot = path.resolve(fixtureRoot, '../../..');
const sourceRelative = 'evals/fixtures/tiered-pricing/pricing.mjs';
const sourcePath = path.join(repositoryRoot, sourceRelative);
const testFiles = fs
  .readdirSync(fixtureRoot)
  .filter((file) => file.endsWith('.test.mjs'))
  .map((file) => path.join(fixtureRoot, file));

if (testFiles.length === 0) throw new Error('No regression test file exists.');

function runTests() {
  const testEnvironment = { ...process.env, NODE_DISABLE_COMPILE_CACHE: '1' };
  delete testEnvironment.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ['--test', ...testFiles], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 20_000,
    env: testEnvironment,
  });
}

const finalSource = fs.readFileSync(sourcePath);
const finalRun = runTests();
if (finalRun.status !== 0) {
  process.stderr.write(finalRun.stdout ?? '');
  process.stderr.write(finalRun.stderr ?? '');
  throw new Error('Final regression tests do not pass.');
}

const baselineSource = execFileSync('git', ['show', `HEAD:${sourceRelative}`], {
  cwd: repositoryRoot,
  encoding: 'buffer',
});

try {
  fs.writeFileSync(sourcePath, baselineSource);
  const baselineRun = runTests();
  if (baselineRun.status === 0) {
    throw new Error(
      `Regression tests still pass against the pre-fix implementation.\n${baselineRun.stdout ?? ''}\n${baselineRun.stderr ?? ''}`,
    );
  }
} finally {
  fs.writeFileSync(sourcePath, finalSource);
}

process.stdout.write('Regression proof passed: green after fix and red against pre-fix source.\n');
