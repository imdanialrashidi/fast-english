import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const skillPath = path.join(root, '.pi/skills/quick-fix/SKILL.md');

test('quick-fix has valid Pi skill metadata and multilingual triggers', async () => {
  const source = await readFile(skillPath, 'utf8');
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1] ?? '';

  assert.match(frontmatter, /^name: quick-fix$/m);
  assert(description.length > 80 && description.length <= 1024);
  for (const trigger of ['quick fix', 'tiny change', 'تغییر ریز', 'الکی پیچیده نکن']) {
    assert(description.includes(trigger), trigger);
  }
});

test('quick-fix stays low-ceremony and escalates risky or expanding work', async () => {
  const source = await readFile(skillPath, 'utf8');

  assert.match(
    source,
    /Do not create a formal acceptance matrix, plan, ExecPlan, todo list, or subagent task/,
  );
  assert.match(
    source,
    /Do not run broad suites, builds, browser matrices, or the full repository gate unless/,
  );
  assert.match(source, /run `git diff --check`/);
  assert.match(source, /switch to the Standard `\/build` path/);
  for (const boundary of ['auth/access', 'money', 'public contract', 'dependency', 'deployment']) {
    assert(source.includes(boundary), `quick-fix escalation omits ${boundary}`);
  }
});

test('the Pi workflow advertises the native quick-fix route', async () => {
  const files = ['AGENTS.md', 'README.md', 'docs/HARNESS.md', 'docs/TOOLING_SETUP.md'];
  for (const file of files) {
    const source = await readFile(path.join(root, file), 'utf8');
    assert(source.includes('/skill:quick-fix'), file);
  }
});
