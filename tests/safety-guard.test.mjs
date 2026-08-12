import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const source = await fs.readFile(
  path.join(repositoryRoot, '.pi/extensions/safety-guard.js'),
  'utf8',
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

async function loadHandler(mode, label) {
  const previous = process.env.PI_GUARD_MODE;
  try {
    if (mode === undefined) delete process.env.PI_GUARD_MODE;
    else process.env.PI_GUARD_MODE = mode;
    const { default: registerGuard } = await import(`${moduleUrl}#${label}`);
    let handler;
    registerGuard({
      on(eventName, callback) {
        assert.equal(eventName, 'tool_call');
        handler = callback;
      },
    });
    return handler;
  } finally {
    if (previous === undefined) delete process.env.PI_GUARD_MODE;
    else process.env.PI_GUARD_MODE = previous;
  }
}

const autonomousHandler = await loadHandler(undefined, 'autonomous');
const strictHandler = await loadHandler('strict', 'strict');

async function guard(handler, toolName, input) {
  return handler({ toolName, input }, { cwd: repositoryRoot });
}

test('allows normal reads, artifacts, and temporary writes', async () => {
  assert.equal(await guard(autonomousHandler, 'read', { path: 'README.md' }), undefined);
  assert.equal(
    await guard(autonomousHandler, 'write', { path: '.artifacts/report.json' }),
    undefined,
  );
  assert.equal(
    await guard(autonomousHandler, 'write', { path: '/tmp/pi-guard-test.txt' }),
    undefined,
  );
});

test('blocks secret files through direct tools and shell', async () => {
  assert.match((await guard(autonomousHandler, 'read', { path: '.env' })).reason, /Sensitive file/);
  assert.match(
    (await guard(autonomousHandler, 'bash', { command: "sed -n '1p' .env" })).reason,
    /secrets/i,
  );
});

test('limits direct writes to the repository and OS temporary directory', async () => {
  const outside = path.resolve(repositoryRoot, '..', 'outside.txt');
  const result = await guard(autonomousHandler, 'write', { path: outside });
  assert.equal(result.block, true);
  assert.match(result.reason, /repository and OS temporary directory/);
});

test('blocks destructive host and Git operations in autonomous mode', async () => {
  for (const command of [
    'rm -rf build',
    'rm -R build',
    'sudo systemctl restart app',
    'git reset --hard HEAD^',
    'git reset --merge origin/main',
    'git clean -fdx',
    'git checkout .',
    'git restore src/app.ts',
    'git push --force origin feature',
    'git push -uf origin feature',
    'git branch -D feature',
    'gh pr merge 12 --squash',
  ]) {
    const result = await guard(autonomousHandler, 'bash', { command });
    assert.equal(result.block, true, command);
  }
});

test('allows routine repository delivery in autonomous mode', async () => {
  for (const command of [
    'git switch -c agent/finish-task',
    "git commit -m 'finish task'",
    'git pull --ff-only origin main',
    'git rebase origin/main',
    'git push -u origin agent/finish-task',
    'gh pr create --draft --fill',
  ]) {
    assert.equal(await guard(autonomousHandler, 'bash', { command }), undefined, command);
  }
});

test('allows workflow maintenance by default and locks it in strict mode', async () => {
  assert.equal(await guard(autonomousHandler, 'edit', { path: '.pi/settings.json' }), undefined);
  assert.equal(
    await guard(autonomousHandler, 'bash', { command: 'printf x > .pi/settings.json' }),
    undefined,
  );

  const direct = await guard(strictHandler, 'edit', { path: '.pi/settings.json' });
  assert.equal(direct.block, true);
  assert.match(direct.reason, /strict guard mode/);
  assert.match(
    (await guard(strictHandler, 'bash', { command: 'printf x > .pi/settings.json' })).reason,
    /strict guard mode/,
  );
});

test('strict mode additionally locks routine Git mutation', async () => {
  assert.match(
    (await guard(strictHandler, 'bash', { command: 'git commit -m test' })).reason,
    /strict guard mode/,
  );
  assert.match(
    (await guard(strictHandler, 'bash', { command: 'git -C . push origin feature' })).reason,
    /strict guard mode/,
  );
});

test('autonomous browser mode supports public HTTP(S) QA and page evaluation', async () => {
  assert.equal(
    await guard(autonomousHandler, 'mcp', {
      tool: 'browser_navigate',
      args: { url: 'https://example.com/docs' },
    }),
    undefined,
  );
  assert.equal(
    await guard(autonomousHandler, 'mcp', { tool: 'browser_evaluate', args: {} }),
    undefined,
  );
});

test('strict browser mode is local-only and both modes keep exfiltration hazards blocked', async () => {
  assert.match(
    (
      await guard(strictHandler, 'mcp', {
        tool: 'browser_navigate',
        args: { url: 'https://example.com' },
      })
    ).reason,
    /local-only/,
  );
  assert.equal(
    await guard(strictHandler, 'mcp', {
      tool: 'browser_navigate',
      args: { url: 'http://localhost:3000' },
    }),
    undefined,
  );
  assert.match(
    (await guard(strictHandler, 'mcp', { tool: 'browser_evaluate', args: {} })).reason,
    /Unsafe MCP/,
  );
  assert.match(
    (await guard(autonomousHandler, 'mcp', { tool: 'browser_file_upload', args: {} })).reason,
    /Unsafe MCP/,
  );
  assert.match(
    (
      await guard(autonomousHandler, 'mcp', {
        tool: 'browser_navigate',
        args: { url: 'file:///etc/passwd' },
      })
    ).reason,
    /HTTP\(S\)/,
  );
});
