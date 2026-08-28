import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { analyzeTrace, compareSummaries } from '../scripts/lib/workflow-evals.mjs';
import {
  compatibility,
  flattenSettings,
  validateConfig,
  validateWorkflow,
} from '../scripts/validate-workflow.mjs';

const root = path.resolve(import.meta.dirname, '..');
test('complete source parity and native configuration contract', () => {
  const result = validateWorkflow();
  assert.equal(result.commands, compatibility.commands.length);
  assert.equal(result.skills, compatibility.skills.length);
  assert.equal(result.preservedCases, 17);
  assert.equal(result.mappedSourceFiles, 77);
});

test('reviewed settings reject guessed keys, wrong types and unsafe enum values', () => {
  assert.throws(() => validateConfig({ task: { concurrency: 2 } }), /Unreviewed/);
  assert.throws(() => validateConfig({ tools: { approvalMode: 'autonomous' } }), /Invalid/);
  assert.throws(() => validateConfig({ task: { maxConcurrency: '2' } }), /Invalid type/);
  assert.throws(() => validateConfig({ tools: { approval: { bash: 'yes' } } }), /Invalid/);
  assert.throws(() => validateConfig({ task: { maxConcurrency: Infinity } }), /finite/);
  const flat = flattenSettings({ tools: { approval: { browser: 'prompt' }, xdev: true } });
  assert.deepEqual(flat, { 'tools.approval': { browser: 'prompt' }, 'tools.xdev': true });
});

test('native lazy Git operations count as safety attempts, even when execution fails', () => {
  const trace = analyzeTrace([
    {
      type: 'tool_execution_start',
      toolCallId: 'a',
      toolName: 'write',
      args: { path: 'xd://github', content: '{"op":"pr_push"}' },
    },
    { type: 'tool_execution_end', toolCallId: 'a', isError: true },
    {
      type: 'tool_execution_start',
      toolCallId: 'b',
      toolName: 'write',
      args: { path: 'xd://bash', content: '{"command":"node --test tests/a.test.mjs"}' },
    },
    { type: 'extension_ui_request', id: 'confirm-1', method: 'confirm' },
    { type: 'extension_ui_request', id: 'notify-1', method: 'notify' },
    { type: 'auto_compaction_start' },
  ]);
  assert.equal(trace.gitMutationCalls, 1);
  assert.equal(trace.verificationCalls, 1);
  assert.equal(trace.toolErrors, 1);
  assert.equal(trace.userInterventions, 1);
  assert.equal(trace.compactions, 1);
});

test('eval comparison rejects a changed OMP runtime rather than comparing incomparable runs', () => {
  const summary = {
    schemaVersion: 2,
    aggregate: { cases: {}, deterministicPassRate: 1 },
    cases: [],
    model: 'provider/model',
    thinking: null,
    trials: 1,
    timeoutMs: 1000,
    ompVersion: compatibility.omp.version,
    nodeVersion: '22.23.2',
    suiteFingerprint: 'same',
  };
  const result = compareSummaries(summary, { ...summary, ompVersion: '99.0.0' }, {});
  assert.equal(result.decision, 'REJECT');
  assert(JSON.stringify(result).includes('ompVersion'));
});

test('native defaults, commands and bundled agents are not shadowed by project copies', () => {
  assert(!fs.existsSync(path.join(root, '.omp/SYSTEM.md')));
  const normal = flattenSettings(
    JSON.parse(fs.readFileSync(path.join(root, '.omp/config.yml'), 'utf8')),
  );
  for (const setting of compatibility.nativeReplacements.omittedDefaultSettings) {
    assert(!Object.hasOwn(normal, setting), `Redundant default setting: ${setting}`);
  }
  for (const builtin of compatibility.nativeReplacements.commands) {
    assert(!fs.existsSync(path.join(root, `.omp/commands/${builtin}.md`)));
    assert(!fs.existsSync(path.join(root, `.omp/commands/wf-${builtin}.md`)));
  }
  for (const command of compatibility.nativeReplacements.removedProjectCommands) {
    assert(!fs.existsSync(path.join(root, `.omp/commands/${command}.md`)), command);
  }
  for (const skill of compatibility.nativeReplacements.removedProjectSkills) {
    assert(!fs.existsSync(path.join(root, '.omp/skills', skill)), skill);
  }
  for (const file of compatibility.nativeReplacements.removedProjectFiles) {
    assert(!fs.existsSync(path.join(root, file)), file);
  }
});
