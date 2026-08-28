import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { selectVerificationPlan, validateVerificationConfig } from '../scripts/verify-affected.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

test('the committed verification routing config is valid', () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, '.omp/verification.json'), 'utf8'),
  );
  assert.equal(validateVerificationConfig(config), config);
});

test('affected routes select and deduplicate only matching commands', () => {
  const config = {
    version: 1,
    routes: [
      { id: 'source', include: ['src/**'], commands: [['node', '--test', 'tests/unit.mjs']] },
      {
        id: 'shared',
        include: ['src/shared/**'],
        commands: [
          ['node', '--test', 'tests/unit.mjs'],
          ['npm', 'run', 'typecheck'],
        ],
      },
    ],
    fallback: [['bash', 'scripts/verify.sh']],
  };
  const plan = selectVerificationPlan(config, ['src/shared/price.mjs']);
  assert.deepEqual(
    plan.routes.map((route) => route.id),
    ['source', 'shared'],
  );
  assert.equal(plan.commands.length, 2);
  assert.deepEqual(plan.commands[0].sources, ['source', 'shared']);
  assert.deepEqual(plan.unmatchedFiles, []);
});

test('an unmatched change triggers the conservative full-gate fallback', () => {
  const config = {
    version: 1,
    routes: [{ id: 'docs', include: ['docs/**'], commands: [['node', 'scripts/check-docs.mjs']] }],
    fallback: [['bash', 'scripts/verify.sh']],
  };
  const plan = selectVerificationPlan(config, ['docs/guide.md', 'src/unknown.mjs']);
  assert.deepEqual(plan.unmatchedFiles, ['src/unknown.mjs']);
  assert.deepEqual(
    plan.commands.map((item) => item.command),
    [
      ['node', 'scripts/check-docs.mjs'],
      ['bash', 'scripts/verify.sh'],
    ],
  );
});

test('route exclusions do not silently skip unmatched files', () => {
  const config = {
    version: 1,
    routes: [
      {
        id: 'unit',
        include: ['src/**'],
        exclude: ['src/generated/**'],
        commands: [['npm', 'test']],
      },
    ],
    fallback: [['npm', 'run', 'verify:full']],
  };
  const plan = selectVerificationPlan(config, ['src/generated/client.mjs']);
  assert.deepEqual(plan.routes, []);
  assert.deepEqual(plan.unmatchedFiles, ['src/generated/client.mjs']);
  assert.deepEqual(plan.commands[0].sources, ['fallback']);
});
