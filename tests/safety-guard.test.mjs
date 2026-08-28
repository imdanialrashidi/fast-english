import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const source = await fs.readFile(
  path.join(repositoryRoot, '.omp/extensions/safety-guard.js'),
  'utf8',
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const {
  default: registerGuard,
  isGitMutationCommand,
  isGitMutationTool,
  canonicalToolCall,
  isNativeGitMutation,
} = await import(moduleUrl);

let handler;
registerGuard({
  on(eventName, callback) {
    assert.equal(eventName, 'tool_call');
    handler = callback;
  },
});

async function guard(toolName, input, overrides = {}) {
  const keys = [
    'OMP_GUARD_MODE',
    'OMP_GUARD_FILE_SCOPE',
    'OMP_GUARD_EXTERNAL_MUTATION',
    'OMP_GIT_MUTATION',
    'OMP_PROJECT_ROOT',
    'AI_PR_DELIVERY',
    'OMP_EVAL_RUN',
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const environment = {
    OMP_GUARD_MODE: 'autonomous',
    OMP_GUARD_FILE_SCOPE: 'full',
    OMP_GUARD_EXTERNAL_MUTATION: 'deny',
    OMP_GIT_MUTATION: 'deny',
    OMP_PROJECT_ROOT: repositoryRoot,
    AI_PR_DELIVERY: 'on',
    OMP_EVAL_RUN: undefined,
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
  assert.equal(await guard('write', { path: '/tmp/omp-guard-test.txt' }), undefined);
  assert.equal(
    await guard('write', { path: path.resolve(repositoryRoot, '..', 'outside.txt') }),
    undefined,
  );
});

test('repository and strict file scopes block external writes', async () => {
  const outside = path.resolve(repositoryRoot, '..', 'outside.txt');
  for (const overrides of [{ OMP_GUARD_FILE_SCOPE: 'repository' }, { OMP_GUARD_MODE: 'strict' }]) {
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
      await guard('bash', { command }, { OMP_GIT_MUTATION: 'allow' }),
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
    const result = await guard('bash', { command }, { OMP_GIT_MUTATION: 'allow' });
    assert.equal(result.block, true, command);
  }
});

test('native GitHub operations and newly connected mutation tools remain owner-controlled', async () => {
  for (const tool of [
    'github_create_commit',
    'github_update_ref',
    'github_create_pull_request',
    'github_reply_to_review_comment',
  ]) {
    assert.equal(isGitMutationTool(tool), true, tool);
    assert.match(
      (await guard(tool, { owner: 'example', repo: 'project' })).reason,
      /owner-controlled/i,
    );
  }
  assert.equal(isGitMutationTool('github_fetch_file'), false);
  assert.equal(await guard('github', { op: 'file_read', path: 'README.md' }), undefined);
  for (const op of ['pr_create', 'pr_push', 'pr_checkout', 'unknown_future_operation']) {
    assert.equal(isNativeGitMutation('github', { op }), true);
    assert.match((await guard('github', { op })).reason, /owner-controlled/i);
  }
  assert.equal((await guard('mcp_example_read', {})).block, true);
  assert.equal(
    await guard('github', { op: 'pr_create' }, { OMP_GIT_MUTATION: 'allow' }),
    undefined,
  );
});

test('workflow maintenance is allowed normally and locked in strict mode', async () => {
  assert.equal(await guard('edit', { path: '.omp/config.yml' }), undefined);
  assert.equal(await guard('bash', { command: 'printf x > .omp/config.yml' }), undefined);
  assert.match(
    (await guard('edit', { path: '.omp/config.yml' }, { OMP_GUARD_MODE: 'strict' })).reason,
    /strict guard mode/,
  );
  assert.match(
    (await guard('bash', { command: 'printf x > .omp/config.yml' }, { OMP_GUARD_MODE: 'strict' }))
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
        { OMP_GUARD_MODE: 'strict', OMP_GIT_MUTATION: 'allow' },
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
      await guard('bash', { command }, { OMP_GUARD_EXTERNAL_MUTATION: 'allow' }),
      undefined,
      command,
    );
  }
});

test('browser mode supports public QA while strict mode narrows it', async () => {
  assert.equal(
    await guard('browser', {
      action: 'open',
      url: 'https://example.com/docs',
    }),
    undefined,
  );
  assert.equal(
    await guard('browser', { action: 'run', code: 'return await tab.ariaSnapshot()' }),
    undefined,
  );
  assert.match(
    (
      await guard(
        'browser',
        { action: 'open', url: 'https://example.com' },
        { OMP_GUARD_MODE: 'strict' },
      )
    ).reason,
    /disabled/,
  );
  assert.match(
    (await guard('browser', { action: 'run', code: "await element.uploadFile('/tmp/a')" })).reason,
    /upload/,
  );
  assert.match(
    (
      await guard('browser', {
        action: 'open',
        url: 'file:///etc/passwd',
      })
    ).reason,
    /HTTP\(S\)/,
  );
});

test('native lazy dispatch obeys the same guard as direct tools and fails closed', async () => {
  const dispatch = (tool, input) => ({ path: `xd://${tool}`, content: JSON.stringify(input) });
  assert.deepEqual(canonicalToolCall('write', dispatch('github', { op: 'pr_push' })), {
    toolName: 'github',
    input: { op: 'pr_push' },
  });
  for (const [name, input] of [
    ['github', { op: 'pr_push' }],
    ['bash', { command: 'git push origin main' }],
    ['read', { path: '.omp/agent.db' }],
  ]) {
    assert.equal((await guard('write', dispatch(name, input))).block, true, name);
  }
  assert.equal(await guard('write', dispatch('github', { op: 'repo_view' })), undefined);
  assert.equal(await guard('write', { path: 'xd://github', content: 'schema' }), undefined);
  assert.equal((await guard('write', { path: 'xd://github', content: '{bad json' })).block, true);
  assert.equal((await guard('write', { path: 'xd://../../escape', content: '{}' })).block, true);
});

test('native credential stores and local overlays are sensitive', async () => {
  for (const file of [
    '.omp/agent.db',
    '.omp/agent.db-wal',
    '.omp/config.local.yml',
    '.omp/sessions/session.jsonl',
    'docs/private/profile.md',
    '.npmrc',
  ]) {
    assert.equal((await guard('read', { path: file })).block, true, file);
  }
  assert.equal(await guard('read', { path: '.omp/config.yml' }), undefined);
});

test('native hashline and apply_patch inspect every source and move target, directly and through xd', async () => {
  const hashline = (file) => `[${file}#1A2B]\nPUT 1.=1:\n+changed\n`;
  for (const patch of [
    hashline('.omp/config.yml'),
    `${hashline('README.md')}\n${hashline('.env')}`,
    `${hashline('README.md')}MV /outside-omp/new.md\n`,
    '*** Begin Patch\n*** Update File: .omp/config.yml\n@@\n-old\n+new\n*** End Patch',
  ]) {
    for (const tool of ['edit', 'apply_patch']) {
      assert.equal((await guard(tool, { input: patch }, { OMP_GUARD_MODE: 'strict' })).block, true);
      assert.equal(
        (
          await guard(
            'write',
            { path: `xd://${tool}`, content: JSON.stringify({ input: patch }) },
            { OMP_GUARD_MODE: 'strict' },
          )
        ).block,
        true,
      );
    }
  }
  assert.equal(await guard('edit', { input: hashline('README.md') }), undefined);
  assert.equal(
    await guard('edit', { input: `${hashline('README.md')}MV "docs/new name.md"\n` }),
    undefined,
  );
  assert.equal(
    await guard('apply_patch', {
      input: '*** Begin Patch\n*** Add File: docs/new.md\n+new\n*** End Patch',
    }),
    undefined,
  );
  assert.equal((await guard('edit', { input: 'some recovered/guessed patch' })).block, true);
  assert.equal(
    (await guard('edit', { input: `${hashline('README.md')}file: .env\n` })).block,
    true,
  );
});

test('native local read selectors, SQLite selectors and file URLs cannot bypass credential checks', async () => {
  for (const file of [
    '.env:raw',
    '.env:1-3:raw',
    '.env:raw:1-3',
    '.omp/agent.db:credentials',
    '.omp/agent.db?q=SELECT+1',
    `file://${repositoryRoot}/.env`,
    `file://${repositoryRoot}/%2Eenv:raw`,
  ]) {
    assert.equal((await guard('read', { path: file })).block, true, file);
    assert.equal(
      (await guard('write', { path: 'xd://read', content: JSON.stringify({ path: file }) })).block,
      true,
      file,
    );
  }
  assert.equal(await guard('read', { path: 'README.md:1-3:raw' }), undefined);
  assert.equal(await guard('read', { path: 'https://example.com/docs:1-3' }), undefined);
  assert.equal((await guard('read', { path: 'missing-suffix.md' })).block, true);
  assert.equal((await guard('read', { path: 'README.md;.env' })).block, true);
});

test('native bundled task roles preserve one active writer', async () => {
  for (const agent of ['scout', 'reviewer', 'security-reviewer', 'librarian']) {
    assert.equal(
      await guard('task', { context: 'read only', tasks: [{ agent, task: 'inspect' }] }),
      undefined,
    );
  }
  for (const agent of ['designer', 'sonic', 'task']) {
    assert.equal(
      await guard('task', { context: 'one writer', tasks: [{ agent, task: 'implement' }] }),
      undefined,
    );
  }
  assert.equal(
    (
      await guard('task', {
        context: 'too many writers',
        tasks: [
          { agent: 'designer', task: 'implement UI' },
          { agent: 'task', task: 'implement API' },
        ],
      })
    ).block,
    true,
  );
  for (const item of [
    { agent: 'unknown' },
    { agent: 'scout', isolated: true },
    { task: 'implement' },
  ]) {
    assert.equal((await guard('task', { context: 'inspect', tasks: [item] })).block, true);
  }
});

test('eval and strict sessions cannot route through broad host runtimes', async () => {
  for (const tool of ['eval', 'browser', 'computer', 'security_scan', 'security_publish']) {
    assert.equal((await guard(tool, {}, { OMP_EVAL_RUN: '1' })).block, true, tool);
    assert.equal(
      (await guard('write', { path: `xd://${tool}`, content: '{}' }, { OMP_GUARD_MODE: 'strict' }))
        .block,
      true,
      tool,
    );
  }
  assert.equal(
    (await guard('github', { op: 'pr_push' }, { AI_PR_DELIVERY: 'off', OMP_GIT_MUTATION: 'allow' }))
      .block,
    true,
  );
});

test('repository scope follows symlink ancestors for paths not yet created', async () => {
  const os = await import('node:os');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'omp-guard-links-'));
  try {
    // The link points at a real non-temporary parent; no data there is touched.
    await fs.symlink(path.parse(repositoryRoot).root, path.join(temporary, 'escape'));
    const result = await guard(
      'write',
      { path: path.join(temporary, 'escape', 'outside-omp', 'new.txt') },
      { OMP_GUARD_FILE_SCOPE: 'repository' },
    );
    assert.equal(result.block, true);
    assert.match(result.reason, /outside the repository/);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test('invalid guard settings fail closed', async () => {
  assert.match(
    (await guard('read', { path: 'README.md' }, { OMP_GIT_MUTATION: 'sometimes' })).reason,
    /deny or allow/,
  );
  assert.match(
    (await guard('write', { path: 'README.md' }, { OMP_GUARD_FILE_SCOPE: 'sometimes' })).reason,
    /full or repository/,
  );
});

test('automatic PR delivery is recognized, scoped, and disabled in isolated sessions', async () => {
  const command = 'node scripts/ai-pr.mjs prepare';
  assert.equal(isGitMutationCommand(command), true);
  assert.equal(await guard('bash', { command }), undefined);
  for (const overrides of [{ OMP_GUARD_MODE: 'strict' }, { AI_PR_DELIVERY: 'off' }]) {
    assert.equal((await guard('bash', { command }, overrides)).block, true);
  }
  assert.equal(
    (await guard('bash', { command: `${command} && git push origin main` })).block,
    true,
  );
});
