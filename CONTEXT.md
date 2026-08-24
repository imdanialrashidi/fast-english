# CONTEXT — Domain Glossary for Architecture Deepening

> This file gives names to good seams. ADRs in `docs/adr/` record decisions this command should not re-litigate.
> Created lazily during the 2026-08-24 architecture deepening (6 candidates).

## Podcast Domain (anti-corruption seam)

The database keeps legacy names to avoid migration risk; product code speaks domain names.

| DB collection | Domain term | Notes |
|---|---|---|
| `categories` | **Category** | Podcast Library category (published, sorted, featured). |
| `topics` | **Episode** | Canonical Episode shared across CEFR levels (one per slot). |
| `lessons` | **Variant** | Level-specific Episode Variant (one per Episode × CEFR level). |
| `lesson_vocabulary` | **Vocabulary** | Key term per Variant (normalized_term, phonetic, pronunciation_audio). |
| `lesson_progress` | **Progress** | Per-Variant Student Progress (per-Variant, independent across levels). |

**PodcastCatalog** — deep module that hides `topics/lessons` bulk-load, CEFR-order stitching, and artwork resolution behind `Episode` / `Variant` domain types (`shared/podcast/domain.ts` + `server/pb_hooks/podcast_domain.pb.js`). Callers never see DB names.

**Level semantics** — four separated concepts (see `docs/PODCAST_DOMAIN.md`):
- **recommendedLevel** — educational guidance from Placement (`suggested_level` → attempt fallback).
- **preferredLevel** — default browsing level (`selected_level` when valid, else recommended).
- **browsingLevel** — temporary per-request state (query param), never persisted.
- **entitlement** — active Student may access every Published Variant; level is not an auth boundary.

**CEFR_ORDER** — `['A1','A2','B1','B2','C1','C2']` canonical, single-sourced in `podcast_domain.*` (tests/cefr-consistency.test.mjs enforces sync).

## Payment Domain

**PaymentModule** — vertical slice owning `loadJourney() → Journey`, `submit()` (free vs paid branching + idempotency), and `receiptPreview()` lifecycle. Hides `plans` / `payment_destination` / `payment_requests` / `subscriptions` behind `Journey` types.

**BusinessSettings** — owner-controlled `plans` + `payment_destination` (is_active singleton) + `site_settings` (support_contact) via `business_settings_core.pb.js`.

## Telemetry Domain

**TelemetryModule** — single factory `shared/lib/telemetry/create.ts` (RingBuffer 200, Beacon, redactPath, sanitizeMessage). App and landing are thin adapters that only supply surface vocab (`FUNNEL_EVENTS` vs `ACQUISITION_EVENTS`).

## Player Domain

**PlayerProvider** — single `<audio>` host. Pure `lifecycle.ts` (bind transitions, retry-restore, reconcile) + `ProgressSink` (debounced, revision-gated queue) + `MediaSessionAdapter` seams.

**AudioFocus** — pronunciation exclusivity seam (pause episode → play clip → stay paused).

## Build Topology

**SurfaceFactory** — `vite.base.ts:createSurfaceConfig` hides version diagnostics, define, transformIndexHtml, build/server/preview/proxy/cacheDir. Surfaces `app`/`landing`/`admin` are adapters.

## Entitlement

**Entitlement** — `requireEntitlement(e, {needPlacement})` seam in `podcast_domain.pb.js` (Student role + active + placement + live subscription window). Single source for premium route authorization.
