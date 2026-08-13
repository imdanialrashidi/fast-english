import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const artifactsRoot = path.join(repositoryRoot, '.artifacts');

function runLauncher(overrides = {}, extraArgs = []) {
  fs.mkdirSync(artifactsRoot, { recursive: true });
  const temporaryDirectory = fs.mkdtempSync(path.join(artifactsRoot, 'launcher-test-'));
  const fakePi = path.join(temporaryDirectory, 'pi');
  fs.writeFileSync(
    fakePi,
    `#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  args: process.argv.slice(2),
  guardMode: process.env.PI_GUARD_MODE,
}));
`,
    { mode: 0o755 },
  );

  try {
    return spawnSync('bash', ['p', ...extraArgs], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${temporaryDirectory}${path.delimiter}${process.env.PATH}`,
        PI_MAIN_MODEL: '',
        PI_MAIN_THINKING: '',
        PI_ENABLED_MODELS: '',
        ...overrides,
      },
    });
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function parsed(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('launcher trusts this repository and enables autonomous guard mode by default', () => {
  const result = parsed(runLauncher({}, ['--mode', 'rpc']));
  assert.ok(result.args.includes('--approve'));
  assert.equal(result.args.includes('--no-approve'), false);
  assert.deepEqual(result.args.slice(-2), ['--mode', 'rpc']);
  assert.equal(result.guardMode, 'autonomous');
});

test('launcher keeps explicit trust and guard overrides', () => {
  const ask = parsed(runLauncher({ PI_PROJECT_TRUST: 'ask', PI_GUARD_MODE: 'strict' }));
  assert.equal(ask.args.includes('--approve'), false);
  assert.equal(ask.args.includes('--no-approve'), false);
  assert.equal(ask.guardMode, 'strict');

  const never = parsed(runLauncher({ PI_PROJECT_TRUST: 'never' }));
  assert.ok(never.args.includes('--no-approve'));
  assert.equal(never.args.includes('--approve'), false);
});

test('launcher rejects an invalid project-trust mode', () => {
  const result = runLauncher({ PI_PROJECT_TRUST: 'sometimes' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /always, ask, never/);
});
