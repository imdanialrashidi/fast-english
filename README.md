# Fast English Podcast

Persian-first English-learning podcast app for Iranian Android users — a
calm, mobile-first listening product with manual card-to-card payment, an
operator review workspace, a placement test, and level-graded podcast
episodes with protected audio. PWA + Android (Capacitor) + static landing.

## Surfaces

| Surface | Dir | Stack | URL |
|---|---|---|---|
| Student App | `app/` | React 19 + MUI v9 | `app.fastenglishpodcast.com` |
| Staff Admin Console | `admin/` | React 19 + MUI v9 | `admin.fastenglishpodcast.com` |
| Landing | `landing/` | React + Tailwind (static) | `fastenglishpodcast.com` |
| Backend | `server/` | PocketBase 0.39.9 (Go, SQLite, JS hooks) | `/api/*` behind Caddy |

One repo, one `package.json`, no workspace. PocketBase migrations and all
server logic live in `server/pb_migrations/` and `server/pb_hooks/`
(ES5, PB 0.39 goja JSVM — see the file headers).

## Quick start

```bash
pnpm install
pnpm setup:pocketbase        # downloads the pinned PB binary (server/VERSION)
pnpm dev:server              # starts PocketBase against persistent server/pb_data
pnpm dev:app                 # Student app with /api proxy
pnpm dev:landing             # landing
pnpm dev:admin               # Staff console
```

Requires `corepack enable` for pnpm 11.17 (see `scripts/ci-install.sh`).

Node ≥ 24 (`.nvmrc`); pnpm 11. Android debug: `pnpm android:build:debug`.

## Verification gates

```bash
pnpm verify:fast     # everyday gate: typecheck + Biome + Vitest (~30s)
pnpm verify:feature  # fast + affected real-backend smokes + @critical Playwright
pnpm verify:full     # canonical full gate: all 18 smoke suites + builds + full Playwright
```

Real-PocketBase smoke suites (`pnpm smoke:*`, 18 suites) each run a
disposable PocketBase in `/tmp` — they never touch `server/pb_data/`.
CI runs the same gates in parallel lanes (`.github/workflows/quality.yml`).

## Docs

- `docs/TOOLING_SETUP.md` — full toolchain, env vars, verification lanes
- `docs/QUALITY.md` — quality contract and gates
- `docs/PRODUCT.md` — product contract
- `docs/ARCHITECTURE.md` — architecture decisions and invariants
- `docs/DESIGN.md` — accepted visual direction
- `docs/PLAN.md` — slice-by-slice implementation log (the session map)
- `docs/CONTENT_PIPELINE.md` — content packages, CLI, import
- `CONTRIBUTING.md` — contribution and change contract

## Security

No secrets in the tree. `.env.example` documents variable names only;
Android signing keys come from `FEP_ANDROID_*` env vars; production
secrets live on the server under `/opt/fast-english/shared/secrets/`.
Report vulnerabilities per `SECURITY.md`.
