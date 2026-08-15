// tests/placement-seed.test.mjs
// Business Configuration slice — deterministic regression coverage for the
// placement-bank/plans seeding tools and the canonical launch config.
//
// Proves:
//   - the canonical launch plan set is exactly monthly 299,000 / 30 days and
//     quarterly 807,300 / 90 days with NO yearly/365-day plan;
//   - the committed demo bank validates and cannot be confused with a
//     reviewed bank (kind=demo);
//   - every promotion guard behaves (demo -> production blocked without
//     explicit intent; non-loopback targets must declare intent; existing
//     active bank blocks import without --replace).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildQuestionRecords,
  enforcePlacementGuards,
  enforcePlansGuards,
  isDemoDataset,
  requireExplicitTargetForYes,
  resolveTarget,
  validateDataset,
} from '../scripts/seed/placement-core.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function readSeed(rel) {
  return JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));
}

const demoBank = readSeed('seeds/placement/demo-bank.v1.json');
const plansSeed = readSeed('seeds/business/plans.json');

// ---------------------------------------------------------------------------
// Canonical launch pricing contract
// ---------------------------------------------------------------------------

test('canonical plan seed is exactly monthly + quarterly with owner prices', () => {
  assert.equal(plansSeed.schemaVersion, 1);
  assert.ok(Array.isArray(plansSeed.plans));
  assert.equal(plansSeed.plans.length, 2, 'exactly two launch plans');
  const slugs = plansSeed.plans.map((p) => p.slug).sort();
  assert.deepEqual(slugs, ['monthly', 'quarterly']);

  const monthly = plansSeed.plans.find((p) => p.slug === 'monthly');
  const quarterly = plansSeed.plans.find((p) => p.slug === 'quarterly');

  assert.equal(monthly.durationDays, 30);
  assert.equal(monthly.priceToman, 299000);
  assert.equal(monthly.name, 'ماهانه');
  assert.equal(monthly.isActive, true);

  assert.equal(quarterly.durationDays, 90);
  assert.equal(quarterly.priceToman, 807300);
  assert.equal(quarterly.name, 'سه ماهه');
  assert.equal(quarterly.isActive, true);

  // Quarterly = 10% discount vs 3x monthly (897,000 * 0.9 = 807,300).
  assert.equal(3 * monthly.priceToman * 0.9, quarterly.priceToman);
});

test('no yearly/365-day plan exists anywhere in the launch seed', () => {
  assert.ok(
    plansSeed.plans.every((p) => p.durationDays !== 365 && p.slug !== 'yearly'),
    'yearly/365-day plan must be absent from the canonical seed',
  );
});

// ---------------------------------------------------------------------------
// Demo bank structure
// ---------------------------------------------------------------------------

test('committed demo bank validates and is marked demo', () => {
  const result = validateDataset(demoBank);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.equal(isDemoDataset(demoBank), true, 'dataset must be kind=demo');
  assert.equal(demoBank.kind, 'demo');
});

test('demo bank spreads correct answers across options (not all opt0)', () => {
  const distinct = new Set(demoBank.questions.map((q) => q.correct_option_id));
  assert.ok(distinct.size >= 3, `expected spread answers, got ${distinct.size} distinct ids`);
});

test('buildQuestionRecords produces exact collection contract records', () => {
  const records = buildQuestionRecords(demoBank);
  assert.equal(records.length, 20);
  records.forEach((rec, i) => {
    assert.equal(rec.position, i + 1, 'positions must be 1..20 in order');
    assert.equal(rec.is_active, true);
    assert.equal(rec.version, demoBank.version);
    const opts = JSON.parse(rec.options_text);
    assert.equal(opts.length, 4);
    assert.ok(
      opts.some((o) => o.id === rec.correct_option_id),
      'correct id must be in options',
    );
    assert.deepEqual(rec.options, opts, 'options and options_text must agree');
  });
});

// ---------------------------------------------------------------------------
// Validation negatives (defect sensitivity)
// ---------------------------------------------------------------------------

test('validation rejects wrong question count', () => {
  const bad = { ...demoBank, questions: demoBank.questions.slice(0, 19) };
  const result = validateDataset(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('exactly 20')));
});

test('validation rejects duplicate positions and duplicate keys', () => {
  const dupPos = JSON.parse(JSON.stringify(demoBank));
  dupPos.questions[1].position = dupPos.questions[0].position;
  const r1 = validateDataset(dupPos);
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.includes('duplicate position')));

  const dupKey = JSON.parse(JSON.stringify(demoBank));
  dupKey.questions[1].question_key = dupKey.questions[0].question_key;
  const r2 = validateDataset(dupKey);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes('duplicate question_key')));
});

test('validation rejects an out-of-set correct_option_id', () => {
  const bad = JSON.parse(JSON.stringify(demoBank));
  bad.questions[0].correct_option_id = 'opt9';
  const result = validateDataset(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('correct_option_id')));
});

test('validation rejects unknown kind and missing positions', () => {
  const badKind = { ...demoBank, kind: 'final' };
  assert.equal(validateDataset(badKind).ok, false);

  const noPos = JSON.parse(JSON.stringify(demoBank));
  delete noPos.questions[3].position;
  assert.equal(validateDataset(noPos).ok, false);
});

// ---------------------------------------------------------------------------
// Target + promotion guards
// ---------------------------------------------------------------------------

test('resolveTarget: loopback defaults to local; explicit target wins', () => {
  assert.deepEqual(resolveTarget({ baseUrl: 'http://127.0.0.1:8090', explicitTarget: null }), {
    target: 'local',
    hostname: '127.0.0.1',
  });
  assert.deepEqual(resolveTarget({ baseUrl: 'http://127.0.0.1:8090', explicitTarget: 'staging' }), {
    target: 'staging',
    hostname: '127.0.0.1',
  });
  assert.deepEqual(
    resolveTarget({ baseUrl: 'https://app.fastenglishpodcast.com', explicitTarget: 'production' }),
    { target: 'production', hostname: 'app.fastenglishpodcast.com' },
  );
});

test('resolveTarget cross-validates the declared target against the hostname', () => {
  // local on a non-loopback host would silently downgrade production guards.
  assert.throws(
    () => resolveTarget({ baseUrl: 'https://app.fastenglishpodcast.com', explicitTarget: 'local' }),
    /--target=local with a non-loopback/,
  );
  // production on a loopback host (e.g. an SSH tunnel) is refused too.
  assert.throws(
    () => resolveTarget({ baseUrl: 'http://127.0.0.1:8090', explicitTarget: 'production' }),
    /--target=production with a loopback/,
  );
});

test('resolveTarget refuses a non-loopback URL without an explicit target', () => {
  assert.throws(
    () => resolveTarget({ baseUrl: 'https://app.fastenglishpodcast.com', explicitTarget: null }),
    /--target=staging or --target=production/,
  );
});

test('non-interactive seeding requires an explicit target (tunnel protection)', () => {
  // An SSH-tunnelled production PocketBase looks like a loopback URL; with
  // --yes it must NOT silently default to "local" guards.
  assert.throws(
    () => requireExplicitTargetForYes({ yes: true, explicitTarget: null }),
    /explicit --target/,
  );
  assert.doesNotThrow(() => requireExplicitTargetForYes({ yes: true, explicitTarget: 'local' }));
  assert.doesNotThrow(() => requireExplicitTargetForYes({ yes: false, explicitTarget: null }));
});

test('demo bank cannot be promoted to production without explicit intent', () => {
  // No confirm flag at all.
  assert.throws(
    () =>
      enforcePlacementGuards({
        dataset: demoBank,
        target: 'production',
        confirmProduction: false,
        allowDemo: false,
        replace: false,
        hasActiveQuestions: false,
      }),
    /--confirm-production/,
  );
  // Confirmed production but demo dataset without --allow-demo.
  assert.throws(
    () =>
      enforcePlacementGuards({
        dataset: demoBank,
        target: 'production',
        confirmProduction: true,
        allowDemo: false,
        replace: false,
        hasActiveQuestions: false,
      }),
    /--allow-demo/,
  );
  // Full explicit intent passes.
  assert.doesNotThrow(() =>
    enforcePlacementGuards({
      dataset: demoBank,
      target: 'production',
      confirmProduction: true,
      allowDemo: true,
      replace: false,
      hasActiveQuestions: false,
    }),
  );
});

test('a reviewed dataset needs only production confirmation', () => {
  const reviewed = { ...demoBank, kind: 'reviewed' };
  assert.throws(
    () =>
      enforcePlacementGuards({
        dataset: reviewed,
        target: 'production',
        confirmProduction: false,
        allowDemo: false,
        replace: false,
        hasActiveQuestions: false,
      }),
    /--confirm-production/,
  );
  assert.doesNotThrow(() =>
    enforcePlacementGuards({
      dataset: reviewed,
      target: 'production',
      confirmProduction: true,
      allowDemo: false,
      replace: false,
      hasActiveQuestions: false,
    }),
  );
});

test('an existing active bank blocks the import unless --replace is given', () => {
  assert.throws(
    () =>
      enforcePlacementGuards({
        dataset: demoBank,
        target: 'local',
        confirmProduction: false,
        allowDemo: false,
        replace: false,
        hasActiveQuestions: true,
      }),
    /--replace/,
  );
  assert.doesNotThrow(() =>
    enforcePlacementGuards({
      dataset: demoBank,
      target: 'local',
      confirmProduction: false,
      allowDemo: false,
      replace: true,
      hasActiveQuestions: true,
    }),
  );
});

test('plans guard requires production confirmation', () => {
  assert.throws(
    () => enforcePlansGuards({ target: 'production', confirmProduction: false }),
    /--confirm-production/,
  );
  assert.doesNotThrow(() => enforcePlansGuards({ target: 'production', confirmProduction: true }));
  assert.doesNotThrow(() => enforcePlansGuards({ target: 'local', confirmProduction: false }));
});
