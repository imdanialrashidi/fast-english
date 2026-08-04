// e2e/fixtures.ts
// Shared owned-fixture helpers for the payment e2e specs.
//
// Ownership: every disposable plan created here carries a per-run
// unique name under the owned prefix ("E2E Monthly <run-id>") and
// every disposable destination carries the fixed E2E card number.
// The helpers deduplicate owned records left behind by earlier runs
// (deleting only records carrying the ownership markers — never
// unrelated data) and reuse the newest owned fixture, so exactly one
// owned plan/destination can exist at any time.
//
// Selection: specs select the exact plan through its record ID
// (data-testid="plan-<id>"), so a stale duplicate can never make a
// role/text locator resolve to more than one element.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

export const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
export const PB_DATA_DIR = readFileSync('test-results/pb-data-dir.txt', 'utf8').trim();

// Unmistakable ownership markers for disposable fixtures.
const OWNED_PLAN_PREFIX = 'E2E Monthly';
const OWNED_DEST_CARD = '0000000000000000';
const OWNED_DEST_HOLDER = 'E2E HOLDER';

export async function superuserAuth(): Promise<string> {
  const id = randomBytes(8).toString('hex');
  const email = `fixture-${id}@fep-smoke.invalid`;
  const password = `FX-${id}-${randomBytes(6).toString('hex')}`;
  spawnSync('server/pocketbase', ['superuser', 'upsert', email, password, '--dir', PB_DATA_DIR], {
    stdio: 'ignore',
  });
  const auth = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  const body = (await auth.json()) as { token?: string };
  if (!body.token) throw new Error('superuser auth failed');
  return body.token;
}

// Deterministic upsert for the suite-owned plan: delete older owned
// duplicates, then reuse the newest owned plan or create one with a
// per-run unique name. Returns the record ID and the exact name.
export async function ensureOwnedPlan(suToken: string): Promise<{ id: string; name: string }> {
  const owned = await listOwned(`${PB_URL}/api/collections/plans/records`, suToken, {
    filter: `name~'${OWNED_PLAN_PREFIX}'`,
  });
  for (const stale of owned.slice(1)) {
    await fetch(`${PB_URL}/api/collections/plans/records/${stale.id}`, {
      method: 'DELETE',
      headers: { authorization: suToken },
    });
  }
  if (owned[0]) return { id: owned[0].id, name: owned[0].name };

  const name = `${OWNED_PLAN_PREFIX} ${randomBytes(3).toString('hex')}`;
  const planRes = await fetch(`${PB_URL}/api/collections/plans/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: suToken },
    body: JSON.stringify({
      name,
      slug: `e2e-monthly-${randomBytes(3).toString('hex')}`,
      duration_days: 30,
      price_toman: 1_234_567,
      is_active: true,
      display_order: 0,
      description: 'Disposable e2e plan',
    }),
  });
  const planBody = (await planRes.json()) as { id?: string };
  if (!planBody.id) throw new Error('plan create failed');
  return { id: planBody.id, name };
}

// Deterministic upsert for the suite-owned destination.
export async function ensureOwnedDestination(suToken: string): Promise<string> {
  const owned = await listOwned(`${PB_URL}/api/collections/payment_destination/records`, suToken, {
    filter: `card_number='${OWNED_DEST_CARD}'`,
  });
  for (const stale of owned.slice(1)) {
    await fetch(`${PB_URL}/api/collections/payment_destination/records/${stale.id}`, {
      method: 'DELETE',
      headers: { authorization: suToken },
    });
  }
  if (owned[0]) return owned[0].id;

  const destRes = await fetch(`${PB_URL}/api/collections/payment_destination/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: suToken },
    body: JSON.stringify({
      card_number: OWNED_DEST_CARD,
      card_holder_name: OWNED_DEST_HOLDER,
      bank_name: 'E2E BANK',
      instructions: 'انتقال کارت به کارت — مبلغ را دقیقاً به همین کارت واریز کنید.',
      is_active: true,
    }),
  });
  if (destRes.status !== 200) throw new Error(`destination create failed: ${destRes.status}`);
  const destBody = (await destRes.json()) as { id?: string };
  if (!destBody.id) throw new Error('destination create failed');
  return destBody.id;
}

async function listOwned(
  baseUrl: string,
  suToken: string,
  query: { filter: string },
): Promise<Array<{ id: string; name?: string }>> {
  // NOTE: this PB build rejects sort=created/-created with HTTP 400
  // (the system created/updated fields are not usable), so owned
  // duplicates are listed without a sort. Which surviving record the
  // upsert keeps is irrelevant: specs select fixtures by record ID.
  const params = new URLSearchParams({
    filter: query.filter,
    perPage: '200',
  });
  const r = await fetch(`${baseUrl}?${params}`, { headers: { authorization: suToken } });
  if (!r.ok) throw new Error(`owned fixture list failed: ${r.status}`);
  const body = (await r.json()) as { items?: Array<{ id: string; name?: string }> };
  return body.items ?? [];
}

// The plan card renders data-testid="plan-<record-id>" with a radio
// action area inside; select the exact owned plan by record ID.
export function planRadio(page: Page, planId: string) {
  return page.getByTestId(`plan-${planId}`).getByRole('radio');
}
