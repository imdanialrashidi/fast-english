#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { compatibility, validateConfig } from './validate-workflow.mjs';

const cwd = path.resolve(import.meta.dirname, '..');
function omp(args, env = process.env) {
  const result = spawnSync('omp', args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `OMP ${args.join(' ')} failed (${result.error?.code ?? result.status}); no compatibility claim is possible.`,
    );
  return result.stdout;
}
try {
  const version = omp(['--version']).trim();
  assert.equal(
    version.match(/\b\d+\.\d+\.\d+\b/)?.[0],
    compatibility.omp.version,
    `Expected the reviewed OMP ${compatibility.omp.version}`,
  );
  const effective = JSON.parse(omp(['config', 'list', '--json']));
  const expected = validateConfig(
    JSON.parse(fs.readFileSync(path.join(cwd, '.omp/config.yml'), 'utf8')),
  );
  for (const [key, value] of Object.entries(expected)) {
    assert(effective[key], `Installed OMP does not recognize ${key}`);
    if (key === 'tools.approval') {
      for (const [tool, policy] of Object.entries(value))
        assert.equal(effective[key].value?.[tool], policy, `Effective approval differs: ${tool}`);
    } else
      assert.deepEqual(effective[key].value, value, `Effective project setting differs: ${key}`);
  }
  // Never print the config catalog: it may contain user-local data.
  console.log(
    `PASS live OMP ${compatibility.omp.version}: ${Object.keys(expected).length} effective project settings; no model request`,
  );
} catch (error) {
  console.error(`FAIL native compatibility: ${error.message}`);
  process.exitCode = 1;
}
