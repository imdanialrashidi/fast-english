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
const { default: registerGuard, isGitMutationCommand, isGitMutationTool } = await import(moduleUrl);

let handler;
registerGuard({
  on(eventName, callback) {
    assert.equal(eventName, 'tool_call');
    handler = callback;
  },
});

async function guard(toolName, input, overrides = {}) {
  const keys = [
    'PI_GUARD_MODE',
    'PI_GUARD_FILE_SCOPE',
    'PI_GUARD_EXTERNAL_MUTATION',
    'PI_GIT_MUTATION',
    'PI_PROJECT_ROOT',
    'AI_PR_DELIVERY',
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const environment = {
    PI_GUARD_MODE: 'autonomous',
    PI_GUARD_FILE_SCOPE: 'full',
    PI_GUARD_EXTERNAL_MUTATION: 'deny',
    PI_GIT_MUTATION: 'deny',
    PI_PROJECT_ROOT: repositoryRoot,
    AI_PR_DELIVERY: 'on',
    ...overrides,
  };
  try {
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await handler({ toolName, input }, { cwd: repositoryRoot });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('full-scope mode allows ordinary repository, temporary, and external writes', async () => {
  assert.equal(await guard('read', { path: 'README.md' }), undefined);
  assert.equal(await guard('write', { path: '.artifacts/report.json' }), undefined);
  assert.equal(await guard('write', { path: '/tmp/pi-guard-test.txt' }), undefined);
  assert.equal(
    await guard('write', { path: path.resolve(repositoryRoot, '..', 'outside.txt') }),
    undefined,
  );
});

test('repository and strict file scopes block external writes', async () => {
  const outside = path.resolve(repositoryRoot, '..', 'outside.txt');
  for (const overrides of [{ PI_GUARD_FILE_SCOPE: 'repository' }, { PI_GUARD_MODE: 'strict' }]) {
    const result = await guard('write', { path: outside }, overrides);
    assert.equal(result.block, true);
    assert.match(result.reason, /outside the repository/i);
  }
});

test('secret files are blocked through direct tools and shell', async () => {
  assert.match((await guard('read', { path: '.env' })).reason, /Sensitive file/);
  assert.match((await guard('bash', { command: "sed -n '1p' .env" })).reason, /secrets/i);
  assert.equal(await guard('read', { path: '.env.example' }), undefined);
});

test('read-only Git and GitHub inspection remains available', async () => {
  for (const command of [
    'git status --short --branch',
    'git diff --stat',
    'git log -5 --oneline',
    'git branch --show-current',
    "git -C . branch --list 'feature/*'",
    "git tag --list 'v*'",
    'git remote -v',
    'git config --get remote.origin.url',
    'gh pr view 12',
    'gh api repos/owner/repo',
    'gh api --method GET repos/owner/repo -f per_page=100',
  ]) {
    assert.equal(await guard('bash', { command }), undefined, command);
    assert.equal(isGitMutationCommand(command), false, command);
  }
});

test('owner-controlled mode blocks Git and GitHub mutations by default', async () => {
  for (const command of [
    'git switch -c agent/fix-boundary',
    'git checkout -b agent/fix-boundary',
    'git branch agent/fix-boundary',
    'git worktree add ../fix agent/fix-boundary',
    'git add src tests',
    "git commit -m 'fix boundary'",
    'git fetch origin',
    'git pull --ff-only',
    'git push -u origin agent/fix-boundary',
    'git merge feature',
    'git rebase main',
    'git tag v1.0.0',
    'git status --short && git commit -m hidden',
    'bash -lc "git commit -m nested"',
    'printf \'%s\\n\' "$(git commit -m substituted)"',
    'gh pr create --draft --fill',
    'gh --repo owner/repo pr edit 12 --title changed',
    'gh pr review 12 --approve',
    'gh issue comment 12 --body done',
    'gh api repos/owner/repo/issues -f title=new',
    'gh api -XPOST repos/owner/repo/issues -f title=new',
  ]) {
    const result = await guard('bash', { command });
    assert.match(result.reason, /owner-controlled/i, command);
    assert.equal(isGitMutationCommand(command), true, command);
  }
});

test('explicit Git override permits only non-destructive authorized forms', async () => {
  for (const command of [
    'git switch -c agent/fix-boundary',
    'git add src tests',
    "git commit -m 'fix boundary'",
    'git pull --ff-only',
    'git push -u origin agent/fix-boundary',
    'gh pr create --draft --fill',
  ]) {
    assert.equal(
      await guard('bash', { command }, { PI_GIT_MUTATION: 'allow' }),
      undefined,
      command,
    );
  }
});

test('destructive Git and direct metadata writes stay blocked after an override', async () => {
  for (const command of [
    'rm -rf build',
    'sudo systemctl restart app',
    'git reset --hard HEAD^',
    'git clean -fdx',
    'git checkout .',
    'git restore src/app.ts',
    'git push --force origin feature',
    'git push origin --delete feature',
    'git branch -D feature',
    'printf changed > .git/config',
  ]) {
    const result = await guard('bash', { command }, { PI_GIT_MUTATION: 'allow' });
    assert.equal(result.block, true, command);
  }
});

test('GitHub mutation through MCP is owner-controlled', async () => {
  for (const tool of [
    'github_create_commit',
    'github_update_ref',
    'github_create_pull_request',
    'github_reply_to_review_comment',
  ]) {
    assert.equal(isGitMutationTool(tool), true, tool);
    assert.match((await guard('mcp', { tool, args: {} })).reason, /owner-controlled/i);
    assert.match(
      (await guard(tool, { owner: 'example', repo: 'project' })).reason,
      /owner-controlled/i,
    );
  }
  assert.equal(isGitMutationTool('github_fetch_file'), false);
  assert.equal(await guard('mcp', { tool: 'github_fetch_file', args: {} }), undefined);
  assert.equal(
    await guard('mcp', { tool: 'github_create_commit', args: {} }, { PI_GIT_MUTATION: 'allow' }),
    undefined,
  );
});

test('workflow maintenance is allowed normally and locked in strict mode', async () => {
  assert.equal(await guard('edit', { path: '.pi/settings.json' }), undefined);
  assert.equal(await guard('bash', { command: 'printf x > .pi/settings.json' }), undefined);
  assert.match(
    (await guard('edit', { path: '.pi/settings.json' }, { PI_GUARD_MODE: 'strict' })).reason,
    /strict guard mode/,
  );
  assert.match(
    (await guard('bash', { command: 'printf x > .pi/settings.json' }, { PI_GUARD_MODE: 'strict' }))
      .reason,
    /strict guard mode/,
  );
});

test('strict mode blocks Git mutation even with an override', async () => {
  assert.match(
    (
      await guard(
        'bash',
        { command: 'git commit -m test' },
        { PI_GUARD_MODE: 'strict', PI_GIT_MUTATION: 'allow' },
      )
    ).reason,
    /strict guard mode/,
  );
});

test('external publication needs its separate explicit override', async () => {
  for (const command of [
    'npm publish',
    'docker push example/app:latest',
    'kubectl apply -f deploy.yaml',
    'terraform apply',
    'vercel deploy',
  ]) {
    assert.match(
      (await guard('bash', { command })).reason,
      /external|publication|deployment|cluster|infrastructure/i,
    );
    assert.equal(
      await guard('bash', { command }, { PI_GUARD_EXTERNAL_MUTATION: 'allow' }),
      undefined,
      command,
    );
  }
});

test('browser mode supports public QA while strict mode narrows it', async () => {
  assert.equal(
    await guard('mcp', {
      tool: 'browser_navigate',
      args: { url: 'https://example.com/docs' },
    }),
    undefined,
  );
  assert.equal(await guard('mcp', { tool: 'browser_evaluate', args: {} }), undefined);
  assert.match(
    (
      await guard(
        'mcp',
        { tool: 'browser_navigate', args: { url: 'https://example.com' } },
        { PI_GUARD_MODE: 'strict' },
      )
    ).reason,
    /local-only/,
  );
  assert.match(
    (await guard('mcp', { tool: 'browser_file_upload', args: {} })).reason,
    /Unsafe MCP/,
  );
  assert.match(
    (
      await guard('mcp', {
        tool: 'browser_navigate',
        args: { url: 'file:///etc/passwd' },
      })
    ).reason,
    /HTTP\(S\)/,
  );
});

test('invalid guard settings fail closed', async () => {
  assert.match(
    (await guard('read', { path: 'README.md' }, { PI_GIT_MUTATION: 'sometimes' })).reason,
    /deny or allow/,
  );
  assert.match(
    (await guard('write', { path: 'README.md' }, { PI_GUARD_FILE_SCOPE: 'sometimes' })).reason,
    /full or repository/,
  );
});

test('automatic PR delivery is recognized, scoped, and disabled in isolated sessions', async () => {
  const command = 'node scripts/ai-pr.mjs prepare';
  assert.equal(isGitMutationCommand(command), true);
  assert.equal(await guard('bash', { command }), undefined);
  for (const overrides of [{ PI_GUARD_MODE: 'strict' }, { AI_PR_DELIVERY: 'off' }]) {
    assert.equal((await guard('bash', { command }, overrides)).block, true);
  }
  assert.equal(
    (await guard('bash', { command: `${command} && git push origin main` })).block,
    true,
  );
});
