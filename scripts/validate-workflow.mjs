#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { benchmarkInputSnapshot } from './lib/eval-isolation.mjs';
import { validateVerificationConfig } from './verify-affected.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
export const compatibility = JSON.parse(read('.omp/compatibility.json'));

// A deliberately small JSON-compatible YAML subset keeps offline verification
// dependency-free. The native smoke ALSO parses these files with OMP itself.
export function flattenSettings(
  value,
  definitions = compatibility.settings,
  prefix = '',
  output = {},
) {
  for (const [key, item] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (definitions[name]) output[name] = item;
    else if (item !== null && typeof item === 'object' && !Array.isArray(item))
      flattenSettings(item, definitions, name, output);
    else throw new Error(`Unreviewed OMP setting: ${name}`);
  }
  return output;
}

export function validateConfig(config) {
  assert(
    config !== null && typeof config === 'object' && !Array.isArray(config),
    'Configuration must be an object',
  );
  const flat = flattenSettings(config);
  for (const [name, value] of Object.entries(flat)) {
    const definition = compatibility.settings[name];
    if (definition.type === 'enum')
      assert(definition.values.includes(value), `Invalid ${name}: ${value}`);
    else if (definition.type === 'record') {
      assert(
        value !== null && typeof value === 'object' && !Array.isArray(value),
        `${name} must be a record`,
      );
      for (const policy of Object.values(value))
        assert(definition.values.includes(policy), `Invalid ${name} policy`);
    } else assert.equal(typeof value, definition.type, `Invalid type for ${name}`);
    if (definition.type === 'number')
      assert(Number.isFinite(value) && value >= 0, `${name} must be finite and non-negative`);
  }
  return flat;
}

function sameSet(actual, expected, label) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), label);
}

export function validateWorkflow() {
  assert(
    Array.isArray(compatibility.domainSkills) && compatibility.domainSkills.length > 0,
    'Domain skill manifest is required',
  );
  for (const skill of compatibility.domainSkills) {
    assert(compatibility.skills.includes(skill), `Domain skill is not discoverable: ${skill}`);
    assert(
      !compatibility.nativeReplacements.removedProjectSkills.includes(skill),
      `Domain skill collides with removed native wrapper: ${skill}`,
    );
  }
  const normal = validateConfig(JSON.parse(read('.omp/config.yml')));
  const evaluation = validateConfig(JSON.parse(read('.omp/eval.config.yml')));
  assert.equal(normal['tools.approvalMode'], 'write');
  assert(normal['task.maxConcurrency'] >= 1 && normal['task.maxConcurrency'] <= 2);
  for (const name of compatibility.nativeReplacements.omittedDefaultSettings) {
    assert(
      !Object.hasOwn(normal, name),
      `OMP default must not be repeated in project config: ${name}`,
    );
  }
  for (const tool of ['eval', 'browser']) assert.equal(normal['tools.approval'][tool], 'prompt');
  for (const tool of ['eval', 'browser', 'computer', 'security_scan', 'security_publish'])
    assert.equal(evaluation['tools.approval'][tool], 'deny');

  const commands = fs
    .readdirSync(path.join(root, '.omp/commands'))
    .filter((name) => name.endsWith('.md'));
  sameSet(
    commands.map((name) => name.slice(0, -3)),
    compatibility.commands,
    'Project commands must match the unique workflow manifest',
  );
  for (const file of commands) {
    const text = read(`.omp/commands/${file}`);
    assert(
      text.startsWith('---\n') && /\ndescription: .+\n/.test(text),
      `Missing native description: ${file}`,
    );
    assert(text.includes('$ARGUMENTS'), `Missing native argument substitution: ${file}`);
    assert(!text.includes('${ARGUMENTS:-'), `Shell substitution is not native OMP: ${file}`);
    assert(file.startsWith('wf-'), `Builtin command collision: ${file}`);
  }
  const skills = fs.readdirSync(path.join(root, '.omp/skills'));
  sameSet(
    skills,
    compatibility.skills,
    'Project skills must match the non-native workflow manifest',
  );
  for (const skill of skills) {
    const text = read(`.omp/skills/${skill}/SKILL.md`);
    assert(text.startsWith(`---\nname: ${skill}\n`), `Skill name mismatch: ${skill}`);
    assert(/\ndescription: .+\n/.test(text), `Missing skill description: ${skill}`);
  }

  const suite = JSON.parse(read('evals/cases.json'));
  const inputContract = JSON.parse(read('.omp/eval-inputs.json'));
  benchmarkInputSnapshot(new Map(), inputContract.harnessTreatmentPaths);
  for (const file of inputContract.harnessTreatmentPaths) {
    assert(
      (!file.startsWith('evals/') || file === 'evals/skill-cases.json') &&
        !file.startsWith('scripts/lib/') &&
        file !== 'scripts/run-workflow-evals.mjs',
      `Benchmark fixtures and graders must stay immutable: ${file}`,
    );
  }
  for (const id of compatibility.preservedEvalIds)
    assert(
      suite.cases.some((item) => item.id === id),
      `Lost source evaluation: ${id}`,
    );
  assert.equal(
    new Set(suite.cases.map((item) => item.id)).size,
    suite.cases.length,
    'Duplicate eval IDs',
  );
  const mapping = JSON.parse(read('.omp/migration-map.json'));
  assert.equal(mapping.sourceCommit, compatibility.source.commit);
  assert.equal(mapping.entries.length, compatibility.source.files);
  assert.equal(
    new Set(mapping.entries.map((item) => item.source)).size,
    compatibility.source.files,
  );
  for (const entry of mapping.entries) {
    assert(/^[a-f0-9]{40}$/.test(entry.sourceBlob), `Missing source blob: ${entry.source}`);
    assert(entry.reason && entry.targets.length, `Unexplained migration: ${entry.source}`);
    for (const target of entry.targets)
      assert(fs.statSync(path.join(root, target)).isFile(), `Missing migration target: ${target}`);
  }
  const routing = validateVerificationConfig(JSON.parse(read('.omp/verification.json')));
  for (const route of [...routing.routes, { commands: routing.fallback }]) {
    for (const argv of route.commands)
      for (const argument of argv) {
        if (/^(?:scripts|tests)\//.test(argument))
          assert(
            fs.existsSync(path.join(root, argument)),
            `Dangling verification command: ${argument}`,
          );
      }
  }
  for (const removed of [
    '.pi',
    '.mcp.json',
    '.omp/settings.json',
    '.omp/models.env',
    '.omp/SYSTEM.md',
    '.omp/extensions/harness-runtime.js',
  ]) {
    assert(
      !fs.existsSync(path.join(root, removed)),
      `Obsolete or conflicting integration: ${removed}`,
    );
  }
  for (const command of compatibility.nativeReplacements.removedProjectCommands) {
    assert(
      !fs.existsSync(path.join(root, '.omp/commands', `${command}.md`)),
      `Native/default command wrapper remains: ${command}`,
    );
  }
  for (const skill of compatibility.nativeReplacements.removedProjectSkills) {
    assert(
      !fs.existsSync(path.join(root, '.omp/skills', skill)),
      `Native agent/default skill wrapper remains: ${skill}`,
    );
  }
  for (const file of compatibility.nativeReplacements.removedProjectFiles) {
    assert(!fs.existsSync(path.join(root, file)), `Native surface is shadowed: ${file}`);
  }
  assert(Buffer.byteLength(read('AGENTS.md')) <= 9000, 'Keep always-on AGENTS.md small');
  assert(
    Buffer.byteLength(read('.omp/APPEND_SYSTEM.md')) <= 3000,
    'Keep APPEND_SYSTEM small; never replace the native system prompt',
  );
  return {
    commands: commands.length,
    skills: skills.length,
    preservedCases: compatibility.preservedEvalIds.length,
    cases: suite.cases.length,
    mappedSourceFiles: mapping.entries.length,
    settings: Object.keys(normal).length,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    console.log('PASS workflow contract', JSON.stringify(validateWorkflow()));
  } catch (error) {
    console.error(`FAIL workflow contract: ${error.message}`);
    process.exitCode = 1;
  }
}
