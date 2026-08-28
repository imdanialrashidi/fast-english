import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('test-design applies a value gate before creating maintenance cost', async () => {
  const source = await read('.omp/skills/test-design/SKILL.md');

  assert.match(source, /# Test Value Gate/);
  for (const criterion of [
    'Contract:',
    'Failure model:',
    'Evidence gap:',
    'Layer:',
    'Oracle:',
    'Sensitivity:',
  ]) {
    assert(source.includes(criterion), criterion);
  }
  assert.match(source, /No new test is a valid outcome/);
  assert.match(source, /adds no distinct failure mode/);
  assert.match(source, /Do not create tests to hit a count, percentage, uncovered line/);
  assert(
    source.split(/\r?\n/).length <= 190,
    'test-design should stay focused enough for progressive loading',
  );
});

test('test-design requires economical cases and an independent defect oracle', async () => {
  const source = await read('.omp/skills/test-design/SKILL.md');

  assert.match(source, /one representative per equivalence class/);
  assert.match(source, /do not enumerate a Cartesian product/);
  assert.match(source, /expected results from the accepted contract/);
  assert.match(source, /controlled focused mutation/);
  assert.match(source, /never blind-update/);
  assert.match(source, /Mock only an owned boundary/);
});

test('the OMP test command can intentionally retain existing evidence', async () => {
  const [prompt, agents, harness, _quality] = await Promise.all([
    read('.omp/commands/wf-test.md'),
    read('AGENTS.md'),
    read('docs/HARNESS.md'),
    read('docs/QUALITY.md'),
  ]);

  assert.match(prompt, /Apply the Test Value Gate/);
  assert.match(prompt, /`No new test` is valid/);
  assert.match(agents, /When tests are added or materially changed, use `test-design`/);
  assert.match(harness, /pass its Test Value Gate/);
  assert.match(
    await read('.omp/skills/test-design/SKILL.md'),
    /Do not create tests to hit a count, percentage, uncovered line/,
  );
});

test('the research record ties policy to behavior, browser, and mutation evidence', async () => {
  const research = await read('docs/RESEARCH.md');

  for (const source of [
    'TestGen-LLM',
    'Playwright best practices',
    'mutation-guided test generation',
    'design choices in LLM-based test generators',
  ]) {
    assert(research.includes(source), source);
  }
  assert.match(research, /Require an independently derived oracle/);
});
