// app/src/features/podcast/podcast-static-guards.test.ts
// Podcast Slice 2 — static guards over the domain contract:
//   - no duplicate semantic fields in the schema migrations;
//   - no deprecated publication Boolean anywhere;
//   - no UI-side browsing mutation of the preferred level;
//   - no raw file-path leakage in the client response types.
//
// These are static (file-reading) gates: they keep the schema and the
// client contract honest even when runtime coverage misses a path.

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const migrationsDir = resolve(repoRoot, 'server', 'pb_migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.js'))
  .sort()
  .map((f) => ({ name: f, content: readFileSync(resolve(migrationsDir, f), 'utf8') }));

const hooksDir = resolve(repoRoot, 'server', 'pb_hooks');
const hookFiles = readdirSync(hooksDir)
  .filter((f) => f.endsWith('.pb.js'))
  .map((f) => readFileSync(resolve(hooksDir, f), 'utf8'));

const podcastMigrations = migrationFiles.filter(
  (m) => m.name.includes('1700000020') || m.name.includes('1700000021'),
);

// Field-name declarations only (strip JS comments first so prose about the
// schema cannot produce false positives/negatives).
function declaredFieldNames(src: string): string[] {
  const withoutComments = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/^\s*$/gm, '');
  const names: string[] = [];
  for (const m of withoutComments.matchAll(/name:\s*'([^']+)'/g)) {
    names.push(m[1]);
  }
  return names;
}

describe('no duplicate semantic fields', () => {
  it('topics keeps exactly one publication field (the status enum)', () => {
    const topicsUpgrade = podcastMigrations.find((m) => m.name.includes('1700000020'));
    expect(topicsUpgrade).toBeDefined();
    const names = declaredFieldNames(topicsUpgrade?.content ?? '');
    expect(names.filter((n) => n === 'status')).toHaveLength(0); // status exists since P3-S1
    expect(names).not.toContain('publication_status');
    expect(names).not.toContain('is_published');
    // The status field itself is never duplicated by this slice.
    const lessonsUpgrade = podcastMigrations.find((m) => m.name.includes('1700000021'));
    const lessonNames = declaredFieldNames(lessonsUpgrade?.content ?? '');
    expect(lessonNames).not.toContain('status');
    expect(lessonNames).not.toContain('publication_status');
    expect(lessonNames).not.toContain('is_published');
  });

  it('topics gains exactly one canonical artwork field (legacy cover_image grandfathered)', () => {
    const topicsUpgrade = podcastMigrations.find((m) => m.name.includes('1700000020'));
    expect(topicsUpgrade).toBeDefined();
    const names = declaredFieldNames(topicsUpgrade?.content ?? '');
    expect(names.filter((n) => n === 'artwork_square')).toHaveLength(1);
    // Only one canonical artwork FILE field is added (alt text is not an
    // image field); the legacy cover_image (migration 13) is retained.
    expect(names).not.toContain('cover_image');
    expect(names.filter((n) => n === 'hero_image_wide')).toEqual(['hero_image_wide']);
    expect(names.filter((n) => n === 'artwork_alt_fa')).toEqual(['artwork_alt_fa']);
  });

  it('lessons keeps a single transcript source (body) — no second transcript field', () => {
    const lessonsUpgrade = podcastMigrations.find((m) => m.name.includes('1700000021'));
    expect(lessonsUpgrade).toBeDefined();
    const names = declaredFieldNames(lessonsUpgrade?.content ?? '');
    expect(names).not.toContain('transcript');
    expect(names).not.toContain('body');
    expect(names.filter((n) => n.includes('summary'))).toEqual(['summary_fa']);
  });

  it('no parallel episodes/episode_variants/episode_progress collections are created', () => {
    const all = migrationFiles.map((m) => m.content).join('\n');
    expect(all).not.toMatch(/name: 'episodes'/);
    expect(all).not.toMatch(/name: 'episode_variants'/);
    expect(all).not.toMatch(/name: 'episode_progress'/);
  });

  it('categories uses publication_status; topics/lessons do not', () => {
    const categoriesMigration = migrationFiles.find((m) => m.name.includes('1700000019'));
    expect(declaredFieldNames(categoriesMigration?.content ?? '')).toContain('publication_status');
    for (const m of podcastMigrations) {
      expect(declaredFieldNames(m.content)).not.toContain('publication_status');
    }
  });
});

describe('no new code reading a deprecated publication Boolean', () => {
  it('no hook or app code reads is_published', () => {
    const allHooks = hookFiles.join('\n');
    expect(allHooks).not.toMatch(/is_published/);
  });

  it('no migration introduces an is_published Boolean', () => {
    const all = migrationFiles.map((m) => m.content).join('\n');
    expect(all).not.toMatch(/name: 'is_published'/);
  });

  it('hooks read the status enum only', () => {
    const allHooks = hookFiles.join('\n');
    // Every publication-state read in hooks must use the enum values.
    expect(allHooks).toMatch(/get\("status"\)/);
    // `categories` uses publication_status (the recommended name for the
    // new collection, asserted by the migration test above). The Staff
    // content routes read publication_status ONLY for category records;
    // every other hook file must read the status enum only.
    const nonCategoryHooks = hookFiles.filter((f) => !f.includes('content_admin_')).join('\n');
    expect(nonCategoryHooks).not.toMatch(/get\("publication_status"\)/);
  });
});

describe('no UI-side browsing mutation of the preferred level', () => {
  const lessonsApi = readFileSync(
    resolve(repoRoot, 'app', 'src', 'features', 'lessons', 'api.ts'),
    'utf8',
  );
  const lessonsTypes = readFileSync(
    resolve(repoRoot, 'app', 'src', 'features', 'lessons', 'types.ts'),
    'utf8',
  );

  it('the lessons API never calls the selected-level (preferred) mutation endpoint', () => {
    expect(lessonsApi).not.toMatch(/selected-level/);
    expect(lessonsApi).not.toMatch(/placement\//);
  });

  it('level browsing is a read-only query parameter', () => {
    expect(lessonsApi).toMatch(/params\.set\('level'/);
    expect(lessonsApi).toMatch(/method: 'GET'/);
  });

  it('response types expose only sanitized metadata (no file paths)', () => {
    expect(lessonsTypes).not.toMatch(/fileName/);
    expect(lessonsTypes).not.toMatch(/filePath/);
    expect(lessonsTypes).not.toMatch(/recordId/);
    expect(lessonsTypes).not.toMatch(/storage\//);
  });
});
