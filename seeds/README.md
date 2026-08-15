# Seeds (Business Configuration slice)

Owner-controlled launch configuration and demo datasets. Everything here is
either owner-approved business data (`business/`) or explicitly-marked
demo/temporary data (`placement/demo-bank.v1.json`). Nothing in this
directory is ever auto-imported; every seed requires an explicit command
with target intent.

## `business/plans.json` — canonical launch plans (owner-approved)

- `monthly` — ماهانه, 30 days, **299,000 toman**, active.
- `quarterly` — سه ماهه, 90 days, **807,300 toman**, active
  (= 10% discount vs 3 × 299,000 = 897,000).
- **There is NO yearly/365-day plan.**

Install (upserts by slug; `--prune` deactivates plans not listed here):

```bash
export FEP_PB_URL=http://127.0.0.1:8090
export FEP_PB_SUPERUSER_EMAIL=...
export FEP_PB_SUPERUSER_PASSWORD=...
pnpm seed:plans --target=staging --yes
pnpm seed:plans --target=production --confirm-production --yes   # launch-time only
```

## `placement/demo-bank.v1.json` — DEMO placement bank

Exactly 20 questions, four options each, valid correct answers, positions
1–20. **kind=demo** — for development/staging/disposable environments only.
The final reviewed bank remains HUMAN INPUT REQUIRED before live launch.

Install (local/staging):

```bash
pnpm seed:demo:placement --yes                      # local default (loopback)
pnpm seed:demo:placement --target=staging --yes     # staging
```

Promotion guards (see `scripts/seed/placement-core.mjs`):

- a `kind=demo` dataset is REFUSED for a production target unless you pass
  both `--confirm-production` and `--allow-demo`;
- any non-loopback PocketBase URL requires an explicit `--target=...`;
- an existing active bank blocks the import unless `--replace` is given;
- after every import the tool verifies exactly 20 active questions with
  positions 1–20.

When the owner supplies the reviewed 20-question bank, commit it here as
`placement/reviewed-bank.v1.json` with `"kind": "reviewed"` and install it
with `pnpm seed:placement --file seeds/placement/reviewed-bank.v1.json
--replace --target=production --confirm-production --yes`.
