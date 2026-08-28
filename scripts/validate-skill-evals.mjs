#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compatibility } from './validate-workflow.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

export function validateSkillEvalManifest(manifest, expectedSkills = compatibility.domainSkills) {
  assert(
    manifest && typeof manifest === 'object' && !Array.isArray(manifest),
    'Skill eval manifest must be an object',
  );
  assert.equal(manifest.version, 1, 'Skill eval manifest version must be 1');
  assert(
    Array.isArray(expectedSkills) && expectedSkills.length > 0,
    'At least one domain skill is required',
  );
  assert(
    Array.isArray(manifest.cases) && manifest.cases.length > 0,
    'Skill eval manifest needs cases',
  );

  const ids = new Set();
  const counts = new Map(expectedSkills.map((skill) => [skill, { positive: 0, negative: 0 }]));
  for (const item of manifest.cases) {
    assert(item && typeof item === 'object', 'Skill eval case must be an object');
    assert(
      typeof item.id === 'string' && /^[a-z0-9-]+$/.test(item.id),
      'Skill eval IDs must be lowercase hyphenated',
    );
    assert(!ids.has(item.id), `Duplicate skill eval ID: ${item.id}`);
    ids.add(item.id);
    assert(counts.has(item.skill), `Unknown or non-domain skill in evals: ${item.skill}`);
    assert.equal(typeof item.shouldTrigger, 'boolean', `Missing trigger label: ${item.id}`);
    assert(
      typeof item.prompt === 'string' && item.prompt.trim().length >= 30,
      `Prompt too short: ${item.id}`,
    );
    assert(
      Array.isArray(item.acceptance) && item.acceptance.length >= 2,
      `Acceptance evidence missing: ${item.id}`,
    );
    assert(
      item.acceptance.every((value) => typeof value === 'string' && value.trim()),
      `Invalid acceptance evidence: ${item.id}`,
    );
    const count = counts.get(item.skill);
    count[item.shouldTrigger ? 'positive' : 'negative'] += 1;
  }
  for (const [skill, count] of counts) {
    assert.equal(count.positive, 3, `${skill} needs exactly 3 positive routing cases`);
    assert.equal(count.negative, 2, `${skill} needs exactly 2 negative routing cases`);
  }
  return { cases: manifest.cases.length, skills: counts.size, counts: Object.fromEntries(counts) };
}

export function loadSkillEvalManifest() {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'evals/skill-cases.json'), 'utf8'));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    console.log(
      'PASS skill eval contract',
      JSON.stringify(validateSkillEvalManifest(loadSkillEvalManifest())),
    );
  } catch (error) {
    console.error(`FAIL skill eval contract: ${error.message}`);
    process.exitCode = 1;
  }
}
