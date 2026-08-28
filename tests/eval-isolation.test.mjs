import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { benchmarkInputSnapshot, isolatedGitEnvironment } from '../scripts/lib/eval-isolation.mjs';
import { aggregateRecords, compareSummaries } from '../scripts/lib/workflow-evals.mjs';
import { fileManifest, manifestDiff } from '../scripts/run-workflow-evals.mjs';

const root = path.resolve(import.meta.dirname, '..');
test('nested disposable eval Git inspection cannot inherit or discover its source checkout', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-eval-git-'));
  const workspace = path.join(temporary, 'workspace');
  fs.mkdirSync(path.join(workspace, 'nested'), { recursive: true });
  try {
    const env = isolatedGitEnvironment(workspace, {
      ...process.env,
      GIT_DIR: path.join(root, '.git'),
      GIT_WORK_TREE: root,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.bare',
      GIT_CONFIG_VALUE_0: 'false',
    });
    assert.equal(env.GIT_DIR, undefined);
    assert.equal(env.GIT_WORK_TREE, undefined);
    assert.equal(env.GIT_CONFIG_COUNT, undefined);
    const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: path.join(workspace, 'nested'),
      env,
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not a git repository/);
    assert.equal(
      spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).status,
      0,
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('input manifest permits a declared harness treatment but rejects fixture, grader or contract drift', () => {
  const manifest = new Map([
    ['.omp/APPEND_SYSTEM.md', 'prompt-v1'],
    ['evals/fixtures/a.mjs', 'fixture-v1'],
    ['scripts/lib/workflow-evals.mjs', 'grader-v1'],
  ]);
  const original = benchmarkInputSnapshot(manifest, ['.omp/**']);
  const changedPrompt = benchmarkInputSnapshot(
    new Map(manifest).set('.omp/APPEND_SYSTEM.md', 'prompt-v2'),
    ['.omp/**'],
  );
  assert.equal(original.inputFingerprint, changedPrompt.inputFingerprint);
  assert.notDeepEqual(original.fileManifest, changedPrompt.fileManifest);
  for (const file of ['evals/fixtures/a.mjs', 'scripts/lib/workflow-evals.mjs']) {
    assert.notEqual(
      original.inputFingerprint,
      benchmarkInputSnapshot(new Map(manifest).set(file, 'changed'), ['.omp/**']).inputFingerprint,
    );
  }
  assert.notEqual(
    original.inputContractFingerprint,
    benchmarkInputSnapshot(manifest, ['.omp/**', 'README.md']).inputContractFingerprint,
  );
  assert.throws(() => benchmarkInputSnapshot(manifest, ['**']), /Overbroad/);
});

test('comparison rejects immutable-input drift and missing required metrics', () => {
  const record = {
    id: 'example',
    durationMs: 100,
    stats: { tokens: { total: 5 }, cost: 0 },
    trace: { toolCalls: 1, duplicateToolCalls: 0, repairRounds: 0, fullGateCalls: 0 },
    changes: [],
    deterministic: { status: 'PASS', checks: [] },
  };
  const baseline = {
    schemaVersion: 2,
    model: 'p/m',
    thinking: null,
    trials: 1,
    timeoutMs: 1000,
    ompVersion: '18.0.6',
    nodeVersion: '22.23.2',
    suiteFingerprint: 'same',
    inputFingerprint: 'fixture-v1',
    inputContractFingerprint: 'contract-v1',
    aggregate: aggregateRecords([record]),
  };
  const changed = compareSummaries({ ...baseline, inputFingerprint: 'fixture-v2' }, baseline);
  assert.equal(changed.decision, 'REJECT');
  assert(changed.reasons.some((reason) => reason.includes('inputFingerprint')));
  const missing = compareSummaries(
    { ...baseline, aggregate: aggregateRecords([{ ...record, stats: {} }]) },
    baseline,
  );
  assert.equal(missing.decision, 'REJECT');
  assert(missing.reasons.some((reason) => reason.includes('missing or nonfinite: tokens')));
});

test('real manifests detect symlink retargeting and mode changes without following links', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-eval-manifest-'));
  try {
    const target = path.join(temporary, 'fixture.mjs');
    const link = path.join(temporary, 'grader.mjs');
    fs.writeFileSync(target, 'export const value = 1;\n', { mode: 0o644 });
    fs.symlinkSync('fixture.mjs', link);
    const before = await fileManifest(temporary);
    fs.unlinkSync(link);
    fs.symlinkSync('different.mjs', link);
    const relinked = await fileManifest(temporary);
    assert.deepEqual(
      manifestDiff(before, relinked).map((item) => item.file),
      ['grader.mjs'],
    );
    assert.notEqual(
      benchmarkInputSnapshot(before, []).inputFingerprint,
      benchmarkInputSnapshot(relinked, []).inputFingerprint,
    );
    fs.chmodSync(target, 0o755);
    const executable = await fileManifest(temporary);
    assert.deepEqual(
      manifestDiff(relinked, executable).map((item) => item.file),
      ['fixture.mjs'],
    );
    assert.notEqual(
      benchmarkInputSnapshot(relinked, []).inputFingerprint,
      benchmarkInputSnapshot(executable, []).inputFingerprint,
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
