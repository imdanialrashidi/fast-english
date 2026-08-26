#!/usr/bin/env node
// scripts/seed/placement.mjs
// Business Configuration slice — placement-bank seeding tool.
//
//   pnpm seed:placement --file seeds/placement/demo-bank.v1.json [--replace] [--target=...] [--yes]
//
// Auth: FEP_PB_URL (default http://127.0.0.1:8090), FEP_PB_SUPERUSER_EMAIL,
// FEP_PB_SUPERUSER_PASSWORD — values stay OUTSIDE Git; never printed.
//
// Promotion guards (scripts/seed/placement-core.mjs):
//   - the dataset must validate against the collection contract (20
//     questions, positions 1-20, four options, valid correct answers);
//   - a kind=demo dataset CANNOT be installed into a production target
//     without --allow-demo (and --confirm-production);
//   - any non-loopback target without an explicit --target is refused;
//   - an existing active bank blocks the import unless --replace is given;
//   - --replace deactivates the current active set BEFORE inserting the
//     new bank, then verifies exactly 20 active questions.
//
// The final reviewed question bank remains HUMAN INPUT REQUIRED before
// live launch; this tool is the path that later accepts it.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildQuestionRecords,
  enforcePlacementGuards,
  requireExplicitTargetForYes,
  resolveTarget,
  SeedError,
  validateDataset,
} from './placement-core.mjs';

const DEFAULT_DEMO_FILE = 'seeds/placement/demo-bank.v1.json';

function fail(message, exitCode = 1) {
  console.error(`seed:placement: ${message}`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    file: null,
    replace: false,
    target: null,
    confirmProduction: false,
    allowDemo: false,
    yes: false,
  };
  for (const a of argv) {
    if (a === '--replace') args.replace = true;
    else if (a === '--confirm-production') args.confirmProduction = true;
    else if (a === '--allow-demo') args.allowDemo = true;
    else if (a === '--yes') args.yes = true;
    else if (a.startsWith('--file=')) args.file = a.slice('--file='.length);
    else if (a.startsWith('--target=')) args.target = a.slice('--target='.length);
    else if (a === '--file' || a === '--target') fail(`${a} requires a value`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(process.env.FEP_PB_URL || 'http://127.0.0.1:8090').replace(/\/+$/, '');
  const suEmail = process.env.FEP_PB_SUPERUSER_EMAIL || '';
  const suPassword = process.env.FEP_PB_SUPERUSER_PASSWORD || '';
  if (!suEmail || !suPassword) {
    fail('FEP_PB_SUPERUSER_EMAIL and FEP_PB_SUPERUSER_PASSWORD are required', 2);
  }

  const filePath = resolve(args.file || DEFAULT_DEMO_FILE);
  let dataset;
  try {
    dataset = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`cannot read dataset ${filePath}: ${err.message}`, 2);
  }
  const validation = validateDataset(dataset);
  if (!validation.ok) {
    console.error('seed:placement: dataset validation failed:');
    for (const e of validation.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  requireExplicitTargetForYes({ yes: args.yes, explicitTarget: args.target });
  const { target } = resolveTarget({ baseUrl, explicitTarget: args.target });
  console.log(`seed:placement: target=${target} url=${baseUrl} file=${filePath}`);
  console.log(`seed:placement: dataset kind=${dataset.kind} version=${dataset.version}`);

  // ---- Auth (superuser, never printed) ----
  let token = '';
  try {
    const res = await fetch(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identity: suEmail, password: suPassword }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status !== 200 || !body.token) {
      fail(`superuser authentication failed (status ${res.status})`, 2);
    }
    token = body.token;
  } catch (err) {
    fail(`could not reach PocketBase at ${baseUrl}: ${err?.message}`, 2);
  }

  // ---- Active-bank check ----
  let allRecords = [];
  try {
    const res = await fetch(`${baseUrl}/api/collections/placement_questions/records?perPage=200`, {
      headers: { authorization: token },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status !== 200) fail(`cannot list placement questions (status ${res.status})`, 2);
    allRecords = body.items || [];
  } catch (err) {
    fail(`could not reach PocketBase at ${baseUrl}: ${err?.message}`, 2);
  }
  const activeRecords = allRecords.filter((q) => q.is_active === true);
  console.log(`seed:placement: ${activeRecords.length} active question(s) currently present`);

  enforcePlacementGuards({
    dataset,
    target,
    confirmProduction: args.confirmProduction,
    allowDemo: args.allowDemo,
    replace: args.replace,
    hasActiveQuestions: activeRecords.length > 0,
  });

  // ---- Confirmation (skip with --yes) ----
  if (!args.yes) {
    process.stdout.write(
      `Install ${dataset.questions.length} questions (kind=${dataset.kind}, version=${dataset.version}) into ${target}? ` +
        `Type "seed" to confirm: `,
    );
    const answer = await new Promise((resolvePromise) => {
      process.stdin.once('data', (d) => resolvePromise(String(d).trim().toLowerCase()));
    });
    if (answer !== 'seed') fail('aborted (confirmation mismatch)', 1);
  }

  // ---- Replace: deactivate EVERY currently-active row the new bank will
  //      touch — the stale set AND any same (question_key, version) row that
  //      the upsert will re-activate (e.g. after a position reorder, where
  //      the active-position unique index would otherwise reject the PATCH).
  //      Not atomic by design: each step fails loudly and the final
  //      20-active/positions verification exits non-zero, so a partial
  //      failure is detected and a re-run repairs it. ----
  const _newKeys = new Set(
    buildQuestionRecords(dataset).map((r) => `${r.question_key}:${r.version}`),
  );
  if (args.replace && activeRecords.length > 0) {
    console.log(
      `seed:placement: deactivating ${activeRecords.length} active question(s) before replace...`,
    );
    for (const rec of activeRecords) {
      const res = await fetch(`${baseUrl}/api/collections/placement_questions/records/${rec.id}`, {
        method: 'PATCH',
        headers: { authorization: token, 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status !== 200)
        fail(`failed to deactivate question ${rec.id} (status ${res.status})`, 1);
    }
  }

  // ---- Upsert by (question_key, version): PATCH existing rows (re-activate
  //      + refresh content), POST new rows. ----
  const existingByKey = new Map(allRecords.map((q) => [`${q.question_key}:${q.version}`, q]));
  const records = buildQuestionRecords(dataset);
  let inserted = 0;
  let updated = 0;
  for (const rec of records) {
    const existing = existingByKey.get(`${rec.question_key}:${rec.version}`);
    const url = existing
      ? `${baseUrl}/api/collections/placement_questions/records/${existing.id}`
      : `${baseUrl}/api/collections/placement_questions/records`;
    const res = await fetch(url, {
      method: existing ? 'PATCH' : 'POST',
      headers: { authorization: token, 'content-type': 'application/json' },
      body: JSON.stringify(rec),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status !== 200 && res.status !== 201) {
      fail(
        `failed to ${existing ? 'update' : 'insert'} ${rec.question_key} (status ${res.status})`,
        1,
      );
    }
    if (existing) updated++;
    else inserted++;
  }

  // ---- Verify exactly 20 active ----
  const check = await fetch(
    `${baseUrl}/api/collections/placement_questions/records?filter=${encodeURIComponent('is_active = true')}&perPage=200`,
    { headers: { authorization: token }, signal: AbortSignal.timeout(15_000) },
  );
  const checkBody = await check.json().catch(() => ({}));
  const active = (checkBody.items || []).filter((q) => q.is_active === true);
  if (active.length !== 20) {
    fail(`verification failed: expected 20 active questions, got ${active.length}`, 1);
  }
  const positions = active.map((q) => Number(q.position)).sort((a, b) => a - b);
  for (let p = 1; p <= 20; p++) {
    if (positions[p - 1] !== p) fail(`verification failed: missing position ${p}`, 1);
  }

  console.log(
    `seed:placement: OK — ${inserted} inserted, ${updated} updated, ${active.length} active, positions 1-20 verified (kind=${dataset.kind})`,
  );
}

main().catch((err) => {
  if (err instanceof SeedError) {
    console.error(`seed:placement: ${err.message}`);
    process.exit(err.exitCode || 1);
  }
  console.error(`seed:placement: unexpected error: ${err?.stack || err}`);
  process.exit(1);
});
