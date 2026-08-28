// tests/cefr-consistency.test.mjs
// Static guard (plan 017, deepened in plan architecture-deepening):
// the CEFR ladder A1 A2 B1 B2 C1 C2 is declared in EIGHT places as an
// ordered array literal plus ONE delegation (library_routes via
// podcast_domain). Its ORDER is behavioral — variant resolution, the
// Edition Rail, level normalization, import validation, the library level
// sort, and the selected-level validation all depend on it.
//
// Goja files that can import TS constants delegate to podcast_domain.pb.js
// instead of re-declaring the array. The cheapest mechanical enforcement is
// this gate: parse the eight literal declarations and assert they are
// identical to the canonical list, plus verify the delegated route does not
// re-declare a literal. Adding or reordering a level forces all
// declarations to change together.

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
    file: 'server/pb_hooks/placement_level_routes.pb.js',
    name: 'ALLOWED_LEVELS',
  },
  {
    file: 'shared/podcast/domain.ts',
    name: 'CEFR_ORDER',
  },
  {
    file: 'shared/ui/tokens/cefr.ts',
    name: 'cefrLevels',
  },
  {
    file: 'app/src/features/placement/constants.ts',
    name: 'CEFR_LEVELS',
  },
  {
    file: 'app/src/features/placement/schemas.ts',
    name: 'cefrLevelSchema',
    // zod enum: `cefrLevelSchema = z.enum([...])`
    pattern: String.raw`cefrLevelSchema\s*=\s*z\.enum\(\s*(\[[^\]]*\])\s*\)`,
  },
];

const delegatedRoutes = [
  {
    file: 'server/pb_hooks/library_routes.pb.js',
    expected: 'pd.CEFR_ORDER',
  },
];

// Extract the level-list array literal from one declaration. Tolerates
// the declaration differences: CEFR_ORDER / CEFR_LEVELS / ALLOWED_LEVELS /
// cefrLevels, single/double quotes, `as const`, type annotations like
// `cefrLevels: readonly CefrLevel[] = [...]`, and the zod `z.enum([...])`
// wrapper.
function extractLevelList(declaration) {
  const { file, name } = declaration;
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const pattern = new RegExp(
    declaration.pattern ?? String.raw`${name}\s*(?::\s*[^=\n]+)?=\s*(\[[^\]]*\])`,
  );
  const match = src.match(pattern);
  if (!match) return null;
  const items = [...match[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
  return items;
}

for (const declaration of declarations) {
  const { file, name } = declaration;
  test(`${file} declares the canonical CEFR order`, () => {
    const list = extractLevelList(declaration);
    assert.ok(list, `no ${name} array literal found in ${file}`);
    assert.deepEqual(list, CANONICAL, `${file} ${name} diverges from ${CANONICAL.join(' ')}`);
  });
}

test('all CEFR declarations agree as ordered arrays', () => {
  const lists = declarations.map((declaration) => {
    const list = extractLevelList(declaration);
    assert.ok(list, `no array literal found in ${declaration.file}`);
    return list;
  });
  for (const list of lists) {
    assert.deepEqual(list, lists[0]);
  }
});

test('every declared list contains exactly the six CEFR levels', () => {
  const six = new Set(CANONICAL);
  for (const declaration of declarations) {
    const { file, name } = declaration;
    const list = extractLevelList(declaration);
    assert.ok(list, `no ${name} array literal found in ${file}`);
    assert.equal(list.length, 6, `${file}: expected 6 levels, got ${list.length}`);
    for (const level of list) {
      assert.ok(six.has(level), `${file}: unknown level ${level}`);
    }
    assert.equal(new Set(list).size, 6, `${file}: duplicate levels`);
  }
});

for (const route of delegatedRoutes) {
  test(`${route.file} delegates CEFR order to ${route.expected}`, () => {
    const src = fs.readFileSync(path.join(root, route.file), 'utf8');
    assert.ok(
      src.includes(route.expected),
      `expected ${route.file} to delegate to ${route.expected}`,
    );
    assert.ok(
      /CEFR_ORDER\s*=\s*pd\.CEFR_ORDER/.test(src),
      `${route.file} should assign CEFR_ORDER from pd.CEFR_ORDER`,
    );
  });
}
