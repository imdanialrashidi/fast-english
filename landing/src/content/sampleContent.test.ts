// landing/src/content/sampleContent.test.ts
// Business Configuration slice — deterministic link between the Landing's
// public-sample promise and the app's `/sample` route.
//
// The Landing renders SAMPLE_TITLE_EN / SAMPLE_PARAGRAPHS_EN. The app's
// `/sample` route serves a real database lesson flagged `is_public_sample`
// (server/pb_hooks/lesson_routes.pb.js). The committed demo content package
// (content-packages/typical-workday-sample) is what produces that lesson in
// disposable/local/staging environments. This test pins the relationship:
// if either side drifts, the Landing would promise a different lesson than
// the app serves.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  SAMPLE_LEVEL,
  SAMPLE_PARAGRAPHS_EN,
  SAMPLE_TITLE_EN,
  SAMPLE_TITLE_FA,
} from './sampleContent';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

test('demo sample package transcript equals the Landing sample text', () => {
  const manifest = JSON.parse(
    readFileSync(path.join(ROOT, 'content-packages/typical-workday-sample/episode.json'), 'utf8'),
  );
  const transcript = readFileSync(
    path.join(ROOT, 'content-packages/typical-workday-sample/transcripts/b1.md'),
    'utf8',
  );
  const normalized = transcript.replace(/\r/g, '').trim();

  // The package title must be the exact title the Landing promises.
  assert.equal(manifest.episode.titleEn, SAMPLE_TITLE_EN);
  assert.equal(manifest.episode.titleFa, SAMPLE_TITLE_FA);
  assert.equal(manifest.variants[0].level, SAMPLE_LEVEL);

  // Every Landing paragraph must appear verbatim in the package transcript.
  for (const paragraph of SAMPLE_PARAGRAPHS_EN) {
    assert.ok(
      normalized.includes(paragraph),
      `Landing paragraph missing from demo package transcript: ${paragraph.slice(0, 60)}…`,
    );
  }
});

test('Landing sample copy renders a B1 "A Typical Workday" promise', () => {
  assert.equal(SAMPLE_TITLE_EN, 'A Typical Workday');
  assert.equal(SAMPLE_LEVEL, 'B1');
  assert.equal(SAMPLE_PARAGRAPHS_EN.length, 2);
  assert.ok(SAMPLE_PARAGRAPHS_EN[0].includes('Sara starts her day'));
  assert.ok(SAMPLE_PARAGRAPHS_EN[1].includes('her English podcast'));
});
