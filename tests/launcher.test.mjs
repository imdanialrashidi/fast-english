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
  fs.mkdirSync(path.join(temporaryDirectory, 'scripts'));
  fs.mkdirSync(path.join(temporaryDirectory, '.pi/npm/node_modules/pi-lsp-adapter'), {
    recursive: true,
  });
  for (const file of [
    'p',
    'scripts/pi-extension-compat.mjs',
    'scripts/pi-provider.mjs',
    '.pi/settings.json',
    '.pi/models.env',
  ]) {
    fs.copyFileSync(path.join(repositoryRoot, file), path.join(temporaryDirectory, file));
  }
  // Argument/environment tests start with an installed adapter. Actual missing-
  // package installation is exercised by the separate native CLI smoke check.
  fs.writeFileSync(
    path.join(temporaryDirectory, '.pi/npm/node_modules/pi-lsp-adapter/package.json'),
    JSON.stringify({
      name: 'pi-lsp-adapter',
      version: '0.1.3',
      dependencies: {},
      peerDependencies: { '@earendil-works/pi-tui': '*', typebox: '*' },
    }),
  );
  const fakePi = path.join(temporaryDirectory, 'pi');
  fs.writeFileSync(
    fakePi,
    `#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  args: process.argv.slice(2),
  guardMode: process.env.PI_GUARD_MODE,
  fileScope: process.env.PI_GUARD_FILE_SCOPE,
  gitMutation: process.env.PI_GIT_MUTATION,
  externalMutation: process.env.PI_GUARD_EXTERNAL_MUTATION,
  projectRoot: process.env.PI_PROJECT_ROOT,
  experimental: process.env.PI_EXPERIMENTAL,
  smartRead: process.env.PI_SMART_READ,
  smartReadBytes: process.env.PI_SMART_READ_BYTES,
  smartReadLines: process.env.PI_SMART_READ_LINES,
  blindRetryLimit: process.env.PI_BLIND_RETRY_LIMIT,
  continuity: process.env.PI_CONTINUITY,
}));
`,
    { mode: 0o755 },
  );

  try {
    const result = spawnSync('bash', ['p', ...extraArgs], {
      cwd: temporaryDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${temporaryDirectory}${path.delimiter}${process.env.PATH}`,
        PI_MAIN_MODEL: '',
        PI_MAIN_THINKING: '',
        PI_ENABLED_MODELS: '',
        PI_EXPERIMENTAL: '',
        PI_SMART_READ: '',
        PI_SMART_READ_BYTES: '',
        PI_SMART_READ_LINES: '',
        PI_BLIND_RETRY_LIMIT: '',
        PI_CONTINUITY: '',
        ...overrides,
      },
    });
    return { ...result, fixtureRoot: temporaryDirectory };
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function parsed(result) {
  assert.equal(result.status, 0, result.stderr);
  return { ...JSON.parse(result.stdout), fixtureRoot: result.fixtureRoot };
}

test('launcher grants trusted full-scope work while Git and external mutation fail closed', () => {
  const result = parsed(runLauncher({}, ['--mode', 'rpc']));
  assert.ok(result.args.includes('--approve'));
  assert.equal(result.args.includes('--no-approve'), false);
  assert.deepEqual(result.args.slice(-2), ['--mode', 'rpc']);
  assert.equal(result.guardMode, 'autonomous');
  assert.equal(result.fileScope, 'full');
  assert.equal(result.gitMutation, 'deny');
  assert.equal(result.externalMutation, 'deny');
  assert.equal(result.projectRoot, result.fixtureRoot);
});

test('repository does not force a provider, model, or thinking level', () => {
  const result = parsed(runLauncher());
  assert.equal(result.args.includes('--model'), false);
  assert.equal(result.args.includes('--thinking'), false);
  assert.equal(result.args.includes('--models'), false);
});

test('explicit model and thinking overrides pass through unchanged', () => {
  const result = parsed(
    runLauncher({
      PI_MAIN_MODEL: 'provider/model-id',
      PI_MAIN_THINKING: 'medium',
      PI_ENABLED_MODELS: 'provider/*',
    }),
  );
  assert.deepEqual(
    result.args.slice(result.args.indexOf('--model'), result.args.indexOf('--model') + 2),
    ['--model', 'provider/model-id'],
  );
  assert.deepEqual(
    result.args.slice(result.args.indexOf('--thinking'), result.args.indexOf('--thinking') + 2),
    ['--thinking', 'medium'],
  );
  assert.deepEqual(
    result.args.slice(result.args.indexOf('--models'), result.args.indexOf('--models') + 2),
    ['--models', 'provider/*'],
  );
});

test('project defaults keep native MCP discovery while launcher preserves explicit CLI tool selection', () => {
  const result = parsed(runLauncher());
  assert.equal(
    result.args.includes('--tools'),
    false,
    'CLI restrictions hide deferred native MCP tools',
  );
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(repositoryRoot, '.pi/settings.json'), 'utf8'))
      .defaultTools,
    ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls', 'harness_tools', 'tool_search'],
  );
  const restricted = parsed(runLauncher({}, ['--tools', 'read']));
  assert.deepEqual(restricted.args.slice(-2), ['--tools', 'read']);
});

test('launcher enables bounded runtime optimization defaults with explicit opt-outs', () => {
  const defaults = parsed(runLauncher());
  assert.equal(defaults.experimental, '', 'do not force Pi experimental UI or setup');
  assert.equal(defaults.smartRead, '1');
  assert.equal(defaults.smartReadBytes, '98304');
  assert.equal(defaults.smartReadLines, '400');
  assert.equal(defaults.blindRetryLimit, '2');
  assert.equal(defaults.continuity, '1');

  const disabled = parsed(
    runLauncher({
      PI_EXPERIMENTAL: '0',
      PI_SMART_READ: '0',
      PI_BLIND_RETRY_LIMIT: '0',
      PI_CONTINUITY: '0',
    }),
  );
  assert.equal(disabled.experimental, '0');
  assert.equal(disabled.smartRead, '0');
  assert.equal(disabled.blindRetryLimit, '0');
  assert.equal(disabled.continuity, '0');
});

test('launcher preserves explicit trust and guard overrides', () => {
  const ask = parsed(
    runLauncher({
      PI_PROJECT_TRUST: 'ask',
      PI_GUARD_MODE: 'strict',
      PI_GUARD_FILE_SCOPE: 'repository',
      PI_GIT_MUTATION: 'allow',
    }),
  );
  assert.equal(ask.args.includes('--approve'), false);
  assert.equal(ask.args.includes('--no-approve'), false);
  assert.equal(ask.guardMode, 'strict');
  assert.equal(ask.fileScope, 'repository');
  assert.equal(ask.gitMutation, 'allow');

  const never = parsed(runLauncher({ PI_PROJECT_TRUST: 'never' }));
  assert.ok(never.args.includes('--no-approve'));
  assert.equal(never.args.includes('--approve'), false);
});

test('launcher rejects an invalid project-trust mode', () => {
  const result = runLauncher({ PI_PROJECT_TRUST: 'sometimes' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /always, ask, never/);
});

test('native MCP subcommands are commands rather than accidental model prompts', () => {
  const result = parsed(
    runLauncher({ PI_MAIN_MODEL: 'provider/model-id' }, ['mcp', 'list', '--json']),
  );
  assert.deepEqual(result.args, ['mcp', 'list', '--json']);
});

test('native package installation and updates preserve command arguments', () => {
  for (const args of [
    ['install', '--local', 'npm:pi-lsp-adapter@0.1.3'],
    ['update', '--help'],
  ]) {
    assert.deepEqual(parsed(runLauncher({}, args)).args, args);
  }
});

test('custom-provider setup routes through Node before requiring Pi', () => {
  const result = runLauncher({}, ['--add-provider']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /interactive terminal/);
  assert.equal(result.stdout, '');
});
