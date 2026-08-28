// Bun-only, real installed OMP SDK contract check. No model/provider request.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compatibility, validateConfig } from './validate-workflow.mjs';

const cwd = path.resolve(import.meta.dir, '..');
const packageRoot = process.env.OMP_PACKAGE_ROOT;
assert(packageRoot, 'Set OMP_PACKAGE_ROOT to the installed @oh-my-pi/pi-coding-agent directory');
const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
assert.equal(pkg.name, compatibility.omp.package);
assert.equal(pkg.version, compatibility.omp.version);
const native = (file: string) => import(pathToFileURL(path.join(packageRoot, 'src', file)).href);

const { SETTINGS_SCHEMA } = await native('config/settings-schema.ts');
for (const file of ['config.yml', 'eval.config.yml']) {
  const text = readFileSync(path.join(cwd, '.omp', file), 'utf8');
  const parsed = Bun.YAML.parse(text);
  assert.deepEqual(parsed, JSON.parse(text), `Native YAML parse differs: ${file}`);
  for (const [key, value] of Object.entries(validateConfig(parsed))) {
    const definition = SETTINGS_SCHEMA[key];
    assert(definition, `Removed native setting: ${key}`);
    assert.equal(definition.type, compatibility.settings[key].type);
    if (definition.values)
      assert(definition.values.includes(value), `Unsupported native enum: ${key}`);
  }
}

await native('discovery/index.ts');
const { loadSlashCommands, expandSlashCommand } = await native('extensibility/slash-commands.ts');
const commands = await loadSlashCommands({ cwd });
for (const name of compatibility.commands) {
  const matches = commands.filter((command: { name: string }) => command.name === name);
  assert.equal(matches.length, 1, `Ambiguous or missing command: ${name}`);
  const expanded = expandSlashCommand(`/${name} native-discovery-marker`, commands);
  assert(!expanded.startsWith(`/${name}`), `Command not expanded: ${name}`);
  assert(expanded.includes('native-discovery-marker'), `Arguments lost: ${name}`);
  assert(!expanded.includes('$ARGUMENTS'), `Arguments left unexpanded: ${name}`);
}
const { loadSkills } = await native('extensibility/skills.ts');
const result = await loadSkills({ cwd });
for (const name of compatibility.skills) {
  const skill = result.skills.find((item: { name: string }) => item.name === name);
  assert(skill, `Missing native skill: ${name}`);
  assert.equal(path.resolve(skill.filePath), path.join(cwd, '.omp/skills', name, 'SKILL.md'));
}
const { discoverAgents } = await native('task/discovery.ts');
const { agents } = await discoverAgents(cwd);
for (const name of compatibility.nativeReplacements.agents) {
  const agent = agents.find((item: { name: string }) => item.name === name);
  assert(agent, `Missing bundled OMP agent: ${name}`);
  assert.equal(agent.source, 'bundled', `Project copy shadows bundled OMP agent: ${name}`);
}

const { loadExtensions } = await native('extensibility/extensions/loader.ts');
const loaded = await loadExtensions([path.join(cwd, '.omp/extensions/safety-guard.js')], cwd);
assert.equal(
  loaded.errors.length,
  0,
  `Native extension loader errors: ${JSON.stringify(loaded.errors)}`,
);
assert.equal(loaded.extensions.length, 1, 'Guard not loaded by real OMP');
const handlers = loaded.extensions[0].handlers.get('tool_call');
assert.equal(handlers?.length, 1, 'Guard hook not registered through native ExtensionAPI');
const blocked = await handlers[0](
  { type: 'tool_call', toolName: 'github', input: { op: 'pr_push' } },
  { cwd },
);
assert.equal(blocked?.block, true, 'Loaded native guard did not block an unscoped GitHub write');
for (const event of [
  { toolName: 'read', input: { path: `file://${path.join(cwd, '.env')}:raw` } },
  {
    toolName: 'edit',
    input: { input: '[README.md#1A2B]\nPUT 1.=1:\n+new\nMV /outside-omp/new.md\n' },
  },
  {
    toolName: 'write',
    input: { path: 'xd://read', content: JSON.stringify({ path: '.omp/agent.db:credentials' }) },
  },
]) {
  assert.equal(
    (await handlers[0]({ type: 'tool_call', ...event }, { cwd }))?.block,
    true,
    `Loaded guard bypass: ${event.toolName}`,
  );
}
console.log(
  `PASS installed OMP ${pkg.version}: YAML/schema, ${compatibility.commands.length} unique commands, ${compatibility.skills.length} project skills, bundled agents and native extension load`,
);
