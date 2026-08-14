// tests/cefr-consistency.test.mjs
// Static guard (plan 017): the CEFR ladder A1 A2 B1 B2 C1 C2 is declared
// in five places across two runtimes (goja hooks cannot import TS), and
// its ORDER is behavioral — variant resolution, the Edition Rail, level
// normalization, import validation, and the level sort all depend on it.
//
// The goja files cannot share the TS constant, so the cheapest mechanical
// enforcement is this gate: parse all five declarations and assert they
// are identical as ordered arrays to the canonical list. Adding or
// reordering a level forces all five files to change together.
//
// Structural checks only (regex over source text), like the other
// static-guard suites in this repo. This test does not parse JavaScript.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

// Canonical order — mirrors shared/podcast/domain.ts.
const CANONICAL = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const declarations = [
  {
    file: 'server/pb_hooks/podcast_domain.pb.js',
    name: 'CEFR_ORDER',
  },
  {
    file: 'server/pb_hooks/content_import_core.pb.js',
    name: 'CEFR_LEVELS',
  },
  {
    file: 'server/pb_hooks/content_admin_core.pb.js',
    name: 'CEFR_ORDER',
  },
  {
    file: 'shared/podcast/domain.ts',
    name: 'CEFR_ORDER',
  },
  {
    file: 'shared/ui/tokens/cefr.ts',
    name: 'cefrLevels',
  },
];

// Extract the level-list array literal from one declaration. Tolerates
// the declaration differences: CEFR_ORDER / CEFR_LEVELS / cefrLevels,
// single/double quotes, `as const`, and type annotations like
// `cefrLevels: readonly CefrLevel[] = [...]`.
function extractLevelList(file, name) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const pattern = new RegExp(`${name}\\s*(?::\\s*[^=\\n]+)?=\\s*(\\[[^\\]]*\\])`);
  const match = src.match(pattern);
  if (!match) return null;
  const items = [...match[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
  return items;
}

for (const { file, name } of declarations) {
  test(`${file} declares the canonical CEFR order`, () => {
    const list = extractLevelList(file, name);
    assert.ok(list, `no ${name} array literal found in ${file}`);
    assert.deepEqual(list, CANONICAL, `${file} ${name} diverges from ${CANONICAL.join(' ')}`);
  });
}

test('all five CEFR declarations agree as ordered arrays', () => {
  const lists = declarations.map(({ file, name }) => {
    const list = extractLevelList(file, name);
    assert.ok(list, `no array literal found in ${file}`);
    return list;
  });
  for (const list of lists) {
    assert.deepEqual(list, lists[0]);
  }
});

test('every declared list contains exactly the six CEFR levels', () => {
  const six = new Set(CANONICAL);
  for (const { file, name } of declarations) {
    const list = extractLevelList(file, name);
    assert.ok(list, `no ${name} array literal found in ${file}`);
    assert.equal(list.length, 6, `${file}: expected 6 levels, got ${list.length}`);
    for (const level of list) {
      assert.ok(six.has(level), `${file}: unknown level ${level}`);
    }
    assert.equal(new Set(list).size, 6, `${file}: duplicate levels`);
  }
});
