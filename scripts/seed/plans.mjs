#!/usr/bin/env node
// scripts/seed/plans.mjs
// Business Configuration slice — canonical plan seeding tool.
//
//   pnpm seed:plans [--prune] [--target=...] [--yes]
//
// Upserts the two owner-approved launch plans from seeds/business/plans.json
// (monthly 299,000 toman / 30 days; quarterly 807,300 toman / 90 days = 10%
// discount vs 3x monthly; NO yearly plan). Plans are matched by slug; an
// existing plan with the same slug is updated to the seeded values.
//
// Auth + guards: same as scripts/seed/placement.mjs (FEP_PB_URL +
// FEP_PB_SUPERUSER_*; non-loopback targets require --target and, for
// production, --confirm-production). `--prune` deactivates any plan NOT
// listed in the seed file (default: off — never touches unlisted plans).
//
// Values are owner-approved pricing data, not invented values.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  enforcePlansGuards,
  requireExplicitTargetForYes,
  resolveTarget,
  SeedError,
} from './placement-core.mjs';

const PLANS_SEED = 'seeds/business/plans.json';

function fail(message, exitCode = 1) {
  console.error(`seed:plans: ${message}`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { prune: false, target: null, confirmProduction: false, yes: false };
  for (const a of argv) {
    if (a === '--prune') args.prune = true;
    else if (a === '--confirm-production') args.confirmProduction = true;
    else if (a === '--yes') args.yes = true;
    else if (a.startsWith('--target=')) args.target = a.slice('--target='.length);
    else if (a === '--target') fail(`${a} requires a value`);
    else fail(`unknown argument: ${a}`);
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

  let seed;
  try {
    seed = JSON.parse(readFileSync(resolve(PLANS_SEED), 'utf8'));
  } catch (err) {
    fail(`cannot read ${PLANS_SEED}: ${err.message}`, 2);
  }
  if (!seed || !Array.isArray(seed.plans) || seed.plans.length === 0) {
    fail(`invalid seed file ${PLANS_SEED}`, 2);
  }
  const bySlug = new Map(seed.plans.map((p) => [p.slug, p]));

  requireExplicitTargetForYes({ yes: args.yes, explicitTarget: args.target });
  const { target } = resolveTarget({ baseUrl, explicitTarget: args.target });
  enforcePlansGuards({ target, confirmProduction: args.confirmProduction });
  console.log(
    `seed:plans: target=${target} url=${baseUrl} plans=${seed.plans.map((p) => p.slug).join(',')}`,
  );

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

  let existing = [];
  try {
    const res = await fetch(`${baseUrl}/api/collections/plans/records?perPage=200`, {
      headers: { authorization: token },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status !== 200) fail(`cannot list plans (status ${res.status})`, 2);
    existing = body.items || [];
  } catch (err) {
    fail(`could not reach PocketBase at ${baseUrl}: ${err?.message}`, 2);
  }

  if (!args.yes) {
    process.stdout.write(
      `Upsert ${seed.plans.length} plan(s) into ${target}? Type "seed" to confirm: `,
    );
    const answer = await new Promise((resolvePromise) => {
      process.stdin.once('data', (d) => resolvePromise(String(d).trim().toLowerCase()));
    });
    if (answer !== 'seed') fail('aborted (confirmation mismatch)', 1);
  }

  const existingBySlug = new Map(existing.map((p) => [p.slug, p]));
  let upserted = 0;
  for (const plan of seed.plans) {
    const record = existingBySlug.get(plan.slug);
    const body = {
      name: plan.name,
      slug: plan.slug,
      duration_days: plan.durationDays,
      price_toman: plan.priceToman,
      display_order: plan.displayOrder,
      is_active: plan.isActive,
      description: plan.description || '',
    };
    const res = await fetch(
      record
        ? `${baseUrl}/api/collections/plans/records/${record.id}`
        : `${baseUrl}/api/collections/plans/records`,
      {
        method: record ? 'PATCH' : 'POST',
        headers: { authorization: token, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (res.status !== 200 && res.status !== 201) {
      fail(`failed to ${record ? 'update' : 'create'} plan ${plan.slug} (status ${res.status})`, 1);
    }
    upserted++;
    console.log(
      `seed:plans: ${record ? 'updated' : 'created'} ${plan.slug} — ${plan.name}, ${plan.durationDays} days, ${plan.priceToman} toman`,
    );
  }

  if (args.prune) {
    let pruned = 0;
    for (const rec of existing) {
      if (bySlug.has(rec.slug)) continue;
      const res = await fetch(`${baseUrl}/api/collections/plans/records/${rec.id}`, {
        method: 'PATCH',
        headers: { authorization: token, 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status !== 200)
        fail(`failed to deactivate unlisted plan ${rec.slug} (status ${res.status})`, 1);
      pruned++;
      console.log(`seed:plans: deactivated unlisted plan ${rec.slug}`);
    }
    console.log(`seed:plans: prune done (${pruned} deactivated)`);
  }

  console.log(`seed:plans: OK — ${upserted} plan(s) upserted`);
}

main().catch((err) => {
  if (err instanceof SeedError) {
    console.error(`seed:plans: ${err.message}`);
    process.exit(err.exitCode || 1);
  }
  console.error(`seed:plans: unexpected error: ${err?.stack || err}`);
  process.exit(1);
});
