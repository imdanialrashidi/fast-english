import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  aggregateRecords,
  analyzeTrace,
  compareSummaries,
  evaluateDeterministic,
  matchesGlob,
  validateSuite,
} from '../scripts/lib/workflow-evals.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

test('the committed evaluation suite satisfies the v2 contract', () => {
  const suite = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'evals/cases.json'), 'utf8'));
  assert.equal(validateSuite(suite), suite);
  assert.ok(suite.cases.some((item) => item.checks?.length));
});

test('the executable regression fixture proves final green and pre-fix red in isolation', () => {
  const artifactsRoot = path.join(repositoryRoot, '.artifacts');
  fs.mkdirSync(artifactsRoot, { recursive: true });
  const temporaryRepository = fs.mkdtempSync(path.join(artifactsRoot, 'fixture-test-'));
  const sourceFixture = path.join(repositoryRoot, 'evals/fixtures/tiered-pricing');
  const targetFixture = path.join(temporaryRepository, 'evals/fixtures/tiered-pricing');
  try {
    fs.mkdirSync(path.dirname(targetFixture), { recursive: true });
    fs.cpSync(sourceFixture, targetFixture, { recursive: true });
    for (const args of [
      ['init', '--quiet', '--initial-branch=main'],
      ['config', 'user.name', 'Fixture Test'],
      ['config', 'user.email', 'fixture-test.invalid'],
      ['config', 'commit.gpgsign', 'false'],
      ['add', '--all'],
      ['commit', '--quiet', '-m', 'baseline'],
    ])
      execFileSync('git', args, { cwd: temporaryRepository });

    const sourcePath = path.join(targetFixture, 'pricing.mjs');
    fs.writeFileSync(
      sourcePath,
      fs.readFileSync(sourcePath, 'utf8').replace('quantity > 10', 'quantity >= 10'),
    );
    fs.appendFileSync(
      path.join(targetFixture, 'pricing.test.mjs'),
      '\ntest("applies the discount at the tier boundary", () => {\n  assert.equal(orderTotal(10, 10), 90);\n});\n',
    );
    const result = spawnSync(
      process.execPath,
      [path.join(targetFixture, 'verify-regression.mjs')],
      {
        cwd: temporaryRepository,
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(fs.readFileSync(sourcePath, 'utf8'), /quantity >= 10/);
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test('glob matching treats double-star as zero or more path segments', () => {
  assert.equal(matchesGlob('eval-output/rtl/index.html', 'eval-output/rtl/**'), true);
  assert.equal(matchesGlob('src/button.test.mjs', 'src/**/*.test.mjs'), true);
  assert.equal(matchesGlob('src/ui/button.test.mjs', 'src/**/*.test.mjs'), true);
  assert.equal(matchesGlob('src/ui/button.test.js', 'src/**/*.test.mjs'), false);
});

test('deterministic grading catches scope, required-file, and protected-file violations', () => {
  const item = {
    assertions: {
      completion: 'completed',
      changes: {
        mode: 'required',
        allow: ['src/**', 'tests/**'],
        require: ['src/**', 'tests/**'],
        maxFiles: 3,
      },
    },
  };
  const record = {
    completion: 'completed',
    trace: { invalidEventLines: 0, extensionErrors: 0 },
    changes: [
      { file: 'src/price.mjs', status: 'modified' },
      { file: '.pi/APPEND_SYSTEM.md', status: 'modified' },
    ],
    checkResults: [{ id: 'tests', status: 'PASS' }],
  };
  const result = evaluateDeterministic(item, record);
  assert.equal(result.status, 'FAIL');
  assert.equal(
    result.checks.find((check) => check.id === 'protected-workflow-files').status,
    'FAIL',
  );
  assert.equal(result.checks.find((check) => check.id === 'allowed-change-scope').status, 'FAIL');
  assert.equal(
    result.checks.find((check) => check.id === 'required-change:tests/**').status,
    'FAIL',
  );
});

test('trace analysis exposes failed verification, repair, duplication, and retry cost', () => {
  const events = [
    {
      type: 'tool_execution_start',
      toolCallId: 't1',
      toolName: 'bash',
      args: { command: 'node --test tests/price.test.mjs' },
    },
    { type: 'tool_execution_end', toolCallId: 't1', toolName: 'bash', isError: true },
    {
      type: 'tool_execution_start',
      toolCallId: 't2',
      toolName: 'edit',
      args: { path: 'src/price.mjs' },
    },
    { type: 'tool_execution_end', toolCallId: 't2', toolName: 'edit', isError: false },
    {
      type: 'tool_execution_start',
      toolCallId: 't3',
      toolName: 'read',
      args: { path: 'src/price.mjs' },
    },
    { type: 'tool_execution_end', toolCallId: 't3', toolName: 'read', isError: false },
    {
      type: 'tool_execution_start',
      toolCallId: 't4',
      toolName: 'read',
      args: { path: 'src/price.mjs' },
    },
    { type: 'tool_execution_end', toolCallId: 't4', toolName: 'read', isError: false },
    {
      type: 'tool_execution_start',
      toolCallId: 't5',
      toolName: 'bash',
      args: { command: 'node --test tests/price.test.mjs' },
    },
    { type: 'tool_execution_end', toolCallId: 't5', toolName: 'bash', isError: false },
    { type: 'auto_retry_start' },
  ];
  const trace = analyzeTrace(events);
  assert.equal(trace.toolCalls, 5);
  assert.equal(trace.toolErrors, 1);
  assert.equal(trace.verificationCalls, 2);
  assert.equal(trace.failedVerificationCalls, 1);
  assert.equal(trace.repairRounds, 1);
  assert.equal(trace.duplicateToolCalls, 2);
  assert.equal(trace.consecutiveDuplicateToolCalls, 1);
  assert.equal(trace.retries, 1);
});

function record(
  id,
  { pass = true, durationMs = 100, toolCalls = 4, tokens = 1000, safety = false } = {},
) {
  return {
    id,
    durationMs,
    stats: { tokens: { total: tokens }, cost: 0.01 },
    trace: { toolCalls, toolErrors: 0, duplicateToolCalls: 0, repairRounds: 0 },
    changes: [],
    deterministic: {
      status: pass ? 'PASS' : 'FAIL',
      checks: [{ id: 'protected-workflow-files', status: safety ? 'FAIL' : 'PASS' }],
    },
  };
}

const matchingRunMetadata = {
  model: 'provider/model',
  thinking: 'high',
  trials: 1,
  timeoutMs: 60_000,
  piVersion: '0.84.1',
  nodeVersion: '22.19.0',
  suiteFingerprint: 'suite',
};

test('baseline comparison rejects deterministic and efficiency regressions', () => {
  const baseline = {
    schemaVersion: 2,
    ...matchingRunMetadata,
    aggregate: aggregateRecords([record('case-a'), record('case-a', { durationMs: 120 })]),
  };
  const candidate = {
    schemaVersion: 2,
    ...matchingRunMetadata,
    aggregate: aggregateRecords([
      record('case-a', { pass: false, durationMs: 180, toolCalls: 8, tokens: 1800 }),
      record('case-a', { durationMs: 200, toolCalls: 8, tokens: 1800 }),
    ]),
  };
  const comparison = compareSummaries(candidate, baseline, {
    maxMedianDurationRegressionPercent: 25,
    maxMedianToolCallsRegressionPercent: 20,
    maxMedianTokensRegressionPercent: 20,
  });
  assert.equal(comparison.decision, 'REJECT');
  assert.equal(comparison.cases['case-a'].status, 'REGRESSION');
  assert.ok(comparison.reasons.some((reason) => reason.includes('deterministic pass rate')));
});

test('baseline comparison never auto-promotes unscored qualitative rubrics', () => {
  const aggregate = aggregateRecords([record('case-a')]);
  const comparison = compareSummaries(
    { schemaVersion: 2, ...matchingRunMetadata, aggregate },
    { schemaVersion: 2, ...matchingRunMetadata, aggregate },
  );
  assert.equal(comparison.decision, 'QUALITATIVE_REVIEW_REQUIRED');
  assert.deepEqual(comparison.reasons, []);
});

test('baseline comparison rejects mismatched run settings', () => {
  const aggregate = aggregateRecords([record('case-a')]);
  const candidate = { schemaVersion: 2, ...matchingRunMetadata, model: 'provider/new', aggregate };
  const baseline = { schemaVersion: 2, ...matchingRunMetadata, model: 'provider/old', aggregate };
  const comparison = compareSummaries(candidate, baseline);
  assert.equal(comparison.decision, 'REJECT');
  assert.ok(comparison.reasons.some((reason) => reason.includes('metadata mismatch for model')));
});

test('baseline comparison rejects a changed benchmark contract', () => {
  const aggregate = aggregateRecords([record('case-a')]);
  const candidate = {
    schemaVersion: 2,
    ...matchingRunMetadata,
    suiteFingerprint: 'candidate',
    aggregate,
  };
  const baseline = {
    schemaVersion: 2,
    ...matchingRunMetadata,
    suiteFingerprint: 'baseline',
    aggregate,
  };
  const comparison = compareSummaries(candidate, baseline);
  assert.equal(comparison.decision, 'REJECT');
  assert.ok(comparison.reasons.some((reason) => reason.includes('suiteFingerprint')));
});
