import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  loadSkillEvalManifest,
  validateSkillEvalManifest,
} from '../scripts/validate-skill-evals.mjs';
import { compatibility } from '../scripts/validate-workflow.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('domain skills are discoverable, bounded, and distinct from native wrappers', () => {
  assert.deepEqual(compatibility.domainSkills, [
    'accessibility-audit',
    'web-performance',
    'technical-seo',
    'rtl-i18n',
  ]);
  for (const name of compatibility.domainSkills) {
    assert(compatibility.skills.includes(name), `${name} is not in the project skill manifest`);
    const source = fs.readFileSync(path.join(root, '.omp/skills', name, 'SKILL.md'), 'utf8');
    assert.match(source, new RegExp(`^---\\nname: ${name}\\n`));
    assert.match(source, /\ndescription: .+\n/);
    assert(source.split(/\r?\n/).length < 180, `${name} should remain cheap to load`);
    assert.match(
      source,
      /do(?:es)?\s+not\s+(?:install|add) (?:a |an |the )?/i,
      `${name} lacks a duplicate-tool boundary`,
    );
    for (const status of ['PASS', 'FAIL', 'UNPROVEN', 'BLOCKED'])
      assert(source.includes(status), `${name} lacks ${status} evidence vocabulary`);
  }
});

test('skill routing fixtures have positive and negative controls for every domain skill', () => {
  const result = validateSkillEvalManifest(loadSkillEvalManifest());
  assert.equal(result.cases, compatibility.domainSkills.length * 5);
  for (const skill of compatibility.domainSkills) {
    assert.equal(result.counts[skill].positive, 3);
    assert.equal(result.counts[skill].negative, 2);
  }
});

test('domain skills preserve native capability boundaries', () => {
  const manifest = loadSkillEvalManifest();
  for (const item of manifest.cases.filter((candidate) => !candidate.shouldTrigger)) {
    assert(
      !item.prompt.includes(`$${item.skill}`),
      `Negative control explicitly invokes ${item.skill}`,
    );
  }
  for (const skill of compatibility.domainSkills) {
    assert.equal(
      manifest.cases.filter((item) => item.prompt.includes(`$${skill}`)).length,
      1,
      `${skill} needs one explicit invocation case`,
    );
  }
});
