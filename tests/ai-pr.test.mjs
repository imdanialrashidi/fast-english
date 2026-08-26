import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { githubRepository, parseOptions, runDelivery } from '../scripts/ai-pr.mjs';

const root = path.resolve(import.meta.dirname, '..');
const repository = 'test-owner/workflow';
const testEnv = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  AI_PR_DELIVERY: 'on',
};
delete testEnv.NODE_TEST_CONTEXT;
delete testEnv.PI_GUARD_MODE;

function fixture(t) {
  const artifacts = path.join(root, '.artifacts');
  mkdirSync(artifacts, { recursive: true });
  const directory = mkdtempSync(path.join(artifacts, 'ai-pr-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const cwd = path.join(directory, 'work');
  const remote = path.join(directory, 'origin.git');
  mkdirSync(cwd);
  function git(...args) {
    return execFileSync('git', args, {
      cwd,
      env: testEnv,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  }
  git('init', '--bare', '--initial-branch=main', remote);
  git('init', '--initial-branch=main');
  git('config', 'user.name', 'Workflow Test');
  git('config', 'user.email', 'workflow@example.invalid');
  writeFileSync(path.join(cwd, '.gitignore'), '.artifacts/\nbuild/\n');
  writeFileSync(path.join(cwd, 'owned.txt'), 'before\n');
  writeFileSync(path.join(cwd, 'user.txt'), 'user before\n');
  git('add', '--', '.gitignore', 'owned.txt', 'user.txt');
  git('commit', '-m', 'seed');
  git('remote', 'add', 'origin', remote);
  git('branch', 'ai-changes');
  git('push', 'origin', 'main', 'ai-changes');
  git('switch', 'ai-changes');
  mkdirSync(path.join(cwd, '.artifacts'), { recursive: true });
  writeFileSync(
    path.join(cwd, '.artifacts/evidence.md'),
    'Result: accepted change.\nVerified: focused fixture assertion passed.\nRisks: none in fixture.\n',
  );
  const state = {
    prs: [],
    comments: [],
    creates: 0,
    patches: 0,
    failPush: false,
    loseCreateResponse: false,
    missingBranch: false,
    authFailure: false,
    wrongPushUrl: false,
    remoteReads: 0,
    race: false,
    requests: [],
  };
  const remoteSha = () => git(`--git-dir=${remote}`, 'rev-parse', 'refs/heads/ai-changes');
  const materialize = (pr) => ({
    ...pr,
    head: { ...pr.head, sha: pr.state === 'open' ? remoteSha() : pr.head.sha },
  });
  function run(program, args, options) {
    if (program === 'git') {
      if (args[0] === 'remote' && args[1] === 'get-url') {
        const value =
          state.wrongPushUrl && args.includes('--push') ? 'other-owner/unrelated' : repository;
        return { status: 0, stdout: `https://github.com/${value}.git\n` };
      }
      if (args[0] === 'ls-remote') {
        state.remoteReads++;
        if (state.missingBranch) return { status: 0, stdout: '' };
        if (state.race && state.remoteReads >= 2)
          return { status: 0, stdout: `${'a'.repeat(40)}\trefs/heads/ai-changes\n` };
      }
      if (args[0] === 'push' && state.beforePush) state.beforePush();
      if (args[0] === 'push' && state.failPush)
        return { status: 1, stderr: 'simulated network failure' };
      return spawnSync(program, args, options);
    }
    assert.equal(program, 'gh');
    const method = args[4];
    const endpoint = args[5];
    assert.deepEqual(args.slice(0, 4), ['api', '--hostname', 'github.com', '--method']);
    state.requests.push({ method, endpoint });
    if (state.authFailure) return { status: 1, stderr: 'simulated auth failure' };
    let data;
    if (endpoint === `repos/${repository}`)
      data = { full_name: repository, default_branch: 'main', delete_branch_on_merge: false };
    else if (endpoint.includes('/pulls?')) {
      const selected = endpoint.includes('state=closed') ? 'closed' : 'open';
      data = state.prs.filter((pr) => pr.state === selected).map(materialize);
    } else if (endpoint === `repos/${repository}/pulls` && method === 'POST') {
      const body = JSON.parse(options.input);
      assert.equal(body.head, 'ai-changes');
      assert.equal(body.base, 'main');
      assert.equal(body.draft, false);
      const pr = {
        ...body,
        number: state.prs.length + 1,
        state: 'open',
        merged: false,
        merged_at: null,
        head: { ref: 'ai-changes', sha: remoteSha(), repo: { full_name: repository } },
        base: { ref: 'main', repo: { full_name: repository } },
        html_url: `https://github.com/${repository}/pull/${state.prs.length + 1}`,
      };
      state.prs.push(pr);
      state.creates++;
      if (state.loseCreateResponse) return { status: 1, stderr: 'response lost' };
      data = materialize(pr);
    } else if (endpoint.includes('/issues/comments/')) {
      data = state.comments.find((item) => item.id === Number(endpoint.split('/').at(-1)));
      assert(data);
    } else if (endpoint.includes('/issues/')) {
      const number = Number(endpoint.match(/\/issues\/(\d+)\/comments/)[1]);
      if (method === 'POST') {
        if (state.concurrentOwnerNote)
          state.prs.find((pr) => pr.number === number).body += '\nConcurrent owner note.\n';
        data = { ...JSON.parse(options.input), id: state.comments.length + 1, number };
        data.html_url = `https://github.com/${repository}/pull/${number}#issuecomment-${data.id}`;
        state.comments.push(data);
        if (state.loseCommentResponse) return { status: 1, stderr: 'response lost' };
      } else data = state.comments.filter((item) => item.number === number);
    } else {
      const number = Number(endpoint.split('/').at(-1));
      const pr = state.prs.find((item) => item.number === number);
      assert(pr, `Unexpected API endpoint: ${endpoint}`);
      if (method === 'PATCH') {
        if (state.concurrentOwnerNote) pr.body += '\nConcurrent owner note.\n';
        Object.assign(pr, JSON.parse(options.input));
        state.patches++;
      }
      data = materialize(pr);
    }
    return { status: 0, stdout: JSON.stringify(data) };
  }
  const deliverArgs = (extra = []) => [
    'deliver',
    '--message',
    'fix: accepted outcome',
    '--title',
    'Accepted outcome',
    '--body-file',
    '.artifacts/evidence.md',
    '--file',
    'owned.txt',
    ...extra,
  ];
  return {
    cwd,
    remote,
    git,
    state,
    remoteSha,
    deliverArgs,
    invoke: (args, env = testEnv) => runDelivery(args, { cwd, env, run }),
    write: (file, content) => writeFileSync(path.join(cwd, file), content),
  };
}

test('delivery commits only explicit task files, preserves user work, and leaves main unchanged', (t) => {
  const f = fixture(t);
  const main = f.git('rev-parse', 'main');
  f.write('owned.txt', 'after\n');
  f.write('user.txt', 'unrelated user work\n');
  const result = f.invoke(f.deliverArgs());
  assert.equal(result.status, 'published');
  assert.equal(result.commit, f.remoteSha());
  assert.equal(f.git(`--git-dir=${f.remote}`, 'rev-parse', 'main'), main);
  assert.equal(f.git(`--git-dir=${f.remote}`, 'show', 'ai-changes:owned.txt'), 'after');
  assert.equal(f.git(`--git-dir=${f.remote}`, 'show', 'ai-changes:user.txt'), 'user before');
  assert.equal(readFileSync(path.join(f.cwd, 'user.txt'), 'utf8'), 'unrelated user work\n');
  assert.equal(f.state.creates, 1);
  assert.equal(result.url, 'https://github.com/test-owner/workflow/pull/1');
  assert.equal(f.git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'), 'owned.txt');
});

test('related changes update one PR and retain owner notes outside the managed section', (t) => {
  const f = fixture(t);
  f.write('owned.txt', 'first\n');
  f.invoke(f.deliverArgs());
  f.state.prs[0].body += '\nOwner note: retain this.\n';
  f.write('owned.txt', 'second\n');
  assert.throws(() => f.invoke(f.deliverArgs()), /exact --pr/);
  const result = f.invoke(f.deliverArgs(['--pr', '1']));
  assert.equal(result.pr, 1);
  assert.equal(f.state.creates, 1);
  assert.equal(f.state.patches, 0);
  assert.equal(f.state.comments.length, 1);
  assert.match(f.state.prs[0].body, /Owner note: retain this/);
  assert.equal(f.git(`--git-dir=${f.remote}`, 'show', 'ai-changes:owned.txt'), 'second');
});

test('main and pre-staged user changes are never committed by the helper', (t) => {
  const f = fixture(t);
  const before = f.remoteSha();
  f.git('switch', 'main');
  f.write('owned.txt', 'change\n');
  assert.throws(() => f.invoke(f.deliverArgs()), /only on ai-changes/);
  f.git('switch', 'ai-changes'); // Test owner moves its own fixture change.
  f.git('add', 'user.txt');
  f.write('user.txt', 'staged user edit\n');
  f.git('add', 'user.txt');
  assert.throws(() => f.invoke(f.deliverArgs()), /staged changes/);
  assert.equal(f.git('diff', '--cached', '--name-only'), 'user.txt');
  assert.equal(f.remoteSha(), before);
  assert.equal(f.state.creates, 0);
});

test('delivery rejects unsafe paths and credential-like content before staging', (t) => {
  const f = fixture(t);
  const before = f.remoteSha();
  f.write('owned.txt', 'change\n');
  mkdirSync(path.join(f.cwd, 'folder'));
  symlinkSync('owned.txt', path.join(f.cwd, 'link.txt'));
  for (const file of ['../owned.txt', '.', 'folder', '.env', ':(glob)**', 'link.txt']) {
    const args = f.deliverArgs();
    args[args.length - 1] = file;
    assert.throws(() => f.invoke(args), /relative|traversal|directories|Sensitive|Symlink/);
  }
  f.write('owned.txt', `ghp_${'x'.repeat(30)}\n`);
  assert.throws(() => f.invoke(f.deliverArgs()), /Credential-like/);
  assert.equal(f.git('diff', '--cached', '--name-only'), '');
  assert.equal(f.remoteSha(), before);
});

test('missing branch, divergent push URL, opt-out, and missing authorization fail without remote writes', (t) => {
  const f = fixture(t);
  const before = f.remoteSha();
  f.write('owned.txt', 'change\n');
  for (const [flag, message] of [
    ['missingBranch', /branch is missing/],
    ['wrongPushUrl', /repositories differ/],
    ['authFailure', /gh api failed/],
  ]) {
    f.state[flag] = true;
    assert.throws(() => f.invoke(f.deliverArgs()), message);
    f.state[flag] = false;
  }
  assert.throws(() => f.invoke(f.deliverArgs(), { ...testEnv, AI_PR_DELIVERY: 'off' }), /disabled/);
  assert.throws(
    () => f.invoke(f.deliverArgs(), { ...testEnv, PI_GUARD_MODE: 'strict' }),
    /disabled/,
  );
  assert.equal(f.git('rev-parse', 'HEAD'), before);
  assert.equal(f.remoteSha(), before);
  assert.equal(f.state.creates, 0);
});

test('a failed push preserves one local commit and exact-SHA resume does not duplicate it', (t) => {
  const f = fixture(t);
  const before = f.remoteSha();
  f.write('owned.txt', 'after\n');
  f.state.failPush = true;
  assert.throws(() => f.invoke(f.deliverArgs()), /git push failed/);
  const commit = f.git('rev-parse', 'HEAD');
  assert.notEqual(commit, before);
  assert.equal(f.remoteSha(), before);
  assert.equal(f.state.creates, 0);
  f.state.failPush = false;
  const result = f.invoke([
    'deliver',
    '--resume',
    commit,
    '--title',
    'Accepted outcome',
    '--body-file',
    '.artifacts/evidence.md',
  ]);
  assert.equal(result.commit, commit);
  assert.equal(f.remoteSha(), commit);
  assert.equal(f.git('rev-list', '--count', `${before}..HEAD`), '1');
  assert.equal(f.state.creates, 1);
});

test('lost PR-create responses are reconciled by reads instead of creating duplicate PRs', (t) => {
  const f = fixture(t);
  f.write('owned.txt', 'after\n');
  f.state.loseCreateResponse = true;
  const result = f.invoke(f.deliverArgs());
  assert.equal(result.status, 'published');
  assert.equal(f.state.creates, 1);
  f.write('owned.txt', 'updated\n');
  f.state.loseCommentResponse = true;
  assert.equal(f.invoke(f.deliverArgs(['--pr', '1'])).status, 'published');
  assert.equal(f.state.comments.length, 1);
});

test('a concurrent remote update stops before push or PR mutation', (t) => {
  const f = fixture(t);
  const before = f.remoteSha();
  f.write('owned.txt', 'after\n');
  f.state.race = true;
  assert.throws(() => f.invoke(f.deliverArgs()), /concurrent writer/);
  assert.equal(f.remoteSha(), before);
  assert.equal(f.state.creates, 0);
  assert.notEqual(f.git('rev-parse', 'HEAD'), before); // Recoverable local commit, not lost work.
});

test('prepare reuses the same branch after an owner squash-merge, without rewriting history or creating remote refs', (t) => {
  const f = fixture(t);
  f.git('switch', 'main');
  assert.equal(f.invoke(['prepare']).branch, 'ai-changes');
  f.write('owned.txt', 'first\n');
  f.invoke(f.deliverArgs());
  const mergedHead = f.remoteSha();
  f.git('switch', 'main');
  f.git('merge', '--squash', 'ai-changes');
  f.git('commit', '-m', 'owner squash');
  f.git('push', 'origin', 'main');
  const main = f.git('rev-parse', 'main');
  Object.assign(f.state.prs[0], {
    state: 'closed',
    merged: true,
    merged_at: '2026-08-26T00:00:00Z',
  });
  f.state.prs[0].head.sha = mergedHead;
  f.invoke(['prepare']);
  assert.equal(f.git('diff', 'main', 'ai-changes'), '');
  assert.equal(f.git(`--git-dir=${f.remote}`, 'rev-parse', 'main'), main);
  f.write('owned.txt', 'second task\n');
  assert.equal(f.invoke(f.deliverArgs()).pr, 2);
  assert.deepEqual(
    f.git(`--git-dir=${f.remote}`, 'for-each-ref', '--format=%(refname)', 'refs/heads').split('\n'),
    ['refs/heads/ai-changes', 'refs/heads/main'],
  );
});

test('CLI cannot change the fixed target and repository parsing rejects credential-bearing or alternate hosts', () => {
  assert.equal(githubRepository('git@github.com:owner/project.git'), 'owner/project');
  assert.equal(githubRepository('https://github.com/owner/project.git'), 'owner/project');
  for (const url of [
    'https://token@github.com/owner/project',
    'https://other.example/owner/project',
    'https://github.com/owner/project?x=1',
  ]) {
    assert.throws(() => githubRepository(url), /credential-free/);
  }
  assert.throws(() => parseOptions(['prepare', '--branch', 'main']), /Unknown/);
  assert.throws(
    () => parseOptions(['deliver', '--title', 'x', '--body-file', 'body.md', '--resume', 'abc']),
    /exact previously verified SHA/,
  );
});

test('resume cannot publish an arbitrary unpublished commit without a matching helper receipt', (t) => {
  const f = fixture(t);
  const before = f.remoteSha();
  f.write('.env', 'INTERNAL_NOTE=fixture-only\n');
  f.git('add', '-f', '.env');
  f.git('commit', '-m', 'unrelated owner commit');
  const commit = f.git('rev-parse', 'HEAD');
  assert.throws(
    () =>
      f.invoke([
        'deliver',
        '--resume',
        commit,
        '--title',
        'Outcome',
        '--body-file',
        '.artifacts/evidence.md',
      ]),
    /receipt|Sensitive/,
  );
  assert.equal(f.remoteSha(), before);
  assert.equal(f.state.creates, 0);
});

test('prepare preserves ignored user files when the target branch tracks the same path', (t) => {
  const f = fixture(t);
  mkdirSync(path.join(f.cwd, 'build'));
  f.write('build/notes.txt', 'branch copy\n');
  f.git('add', '-f', 'build/notes.txt');
  f.git('commit', '-m', 'another task');
  f.git('push', 'origin', 'ai-changes');
  f.git('switch', 'main');
  mkdirSync(path.join(f.cwd, 'build'), { recursive: true });
  f.write('build/notes.txt', 'irreplaceable user notes\n');
  assert.throws(() => f.invoke(['prepare']));
  assert.equal(
    readFileSync(path.join(f.cwd, 'build/notes.txt'), 'utf8'),
    'irreplaceable user notes\n',
  );
});

test('delivery never follows annotated tags from user Git configuration', (t) => {
  const f = fixture(t);
  f.git('config', 'push.followTags', 'true');
  f.git('tag', '-a', 'owner-tag', '-m', 'do not publish this tag');
  f.write('owned.txt', 'after\n');
  f.invoke(f.deliverArgs());
  assert.equal(f.git(`--git-dir=${f.remote}`, 'tag', '--list'), '');
});

test('updating a PR never overwrites concurrently added owner notes', (t) => {
  const f = fixture(t);
  f.write('owned.txt', 'first\n');
  f.invoke(f.deliverArgs());
  f.state.concurrentOwnerNote = true;
  f.write('owned.txt', 'second\n');
  f.invoke(f.deliverArgs(['--pr', '1']));
  assert.match(f.state.prs[0].body, /Concurrent owner note/);
});

test('a local HEAD race cannot publish a commit outside the verified receipt', (t) => {
  const f = fixture(t);
  f.write('owned.txt', 'verified change\n');
  let verified;
  f.state.beforePush = () => {
    verified = f.git('rev-parse', 'HEAD');
    f.write('user.txt', 'concurrent private work\n');
    f.git('add', 'user.txt');
    f.git('commit', '-m', 'another writer');
  };
  assert.throws(() => f.invoke(f.deliverArgs()));
  assert.equal(f.remoteSha(), verified);
  assert.equal(f.git(`--git-dir=${f.remote}`, 'show', 'ai-changes:user.txt'), 'user before');
  assert.notEqual(f.git('rev-parse', 'HEAD'), verified);
  assert.equal(f.state.creates, 0);
});

test('the remote update rejects deletion or advancement after the final preflight', (t) => {
  for (const change of ['delete', 'advance']) {
    const f = fixture(t);
    const before = f.remoteSha();
    let concurrent;
    f.write('owned.txt', 'verified change\n');
    f.state.beforePush = () => {
      if (change === 'delete')
        f.git(`--git-dir=${f.remote}`, 'update-ref', '-d', 'refs/heads/ai-changes', before);
      else {
        concurrent = f.git(
          'commit-tree',
          f.git('rev-parse', 'main^{tree}'),
          '-p',
          before,
          '-m',
          'concurrent remote writer',
        );
        f.git('push', 'origin', `${concurrent}:refs/heads/ai-changes`);
      }
    };
    assert.throws(() => f.invoke(f.deliverArgs()), /push failed/);
    if (change === 'delete') assert.throws(() => f.remoteSha());
    else assert.equal(f.remoteSha(), concurrent);
    assert.equal(f.state.creates, 0);
  }
});
