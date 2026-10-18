# ADR-0002 — Learner/public frontend migrates to Inertia 3 + React 19 + TypeScript; Filament stays; single light theme

Status: accepted (owner-approved architectural change, 2026-10-10).
Supersedes (explicitly, history preserved): scope §2 Blade/Livewire/Alpine learner-stack sentences; PRODUCT.md 2026-10-09 amendment 1 (dark mode into v1); DESIGN.md theme-behavior `system/light/dark`, both-theme token tables, and pre-paint/`fe-theme`/Settings-appearance design; ARCHITECTURE.md "Current system — Learner UI", state-ownership rows for Livewire/forms, JS player file, theme row, code homes for `app/Livewire`/`resources/views` learner layouts/`resources/js/player.js`, and `@persist`/`wire:navigate` player rule — for the public and learner-facing surfaces only. Filament/staff stack is NOT superseded. Earlier ADRs and scope sections remain in force except where this ADR names them.

## Context

The checkout is a working Laravel 13 + PostgreSQL product: domain models, migrations, policies, `ApprovePayment`/`PublishLesson`/`SubmitPlacement` actions, private media delivery with Range, PWA shell, and a Blade + Livewire 4 + Alpine learner UI with `wire:navigate`, `@persist('fe-player')`, `resources/js/reader-player.js`, `resources/js/theme.js`, and `system/light/dark` theming. Scope §2 anticipates exactly this change: "استفاده قطعی از package اصلی `shadcn/ui` نیازمند تغییر ثبت‌شده به Laravel + Inertia + React است؛ دو frontend موازی ساخته نشوند."

## Owner decision (2026-10-10, authoritative per scope §0)

1. Keep Laravel 13, PostgreSQL, existing domain models, migrations, server-side authorization, payment/subscription rules, private media delivery, and operational boundaries. No database replacement, no Laravel regeneration, no discarded functionality, no fresh starter kit installed over the repository.
2. Replace the public and learner-facing Blade/Livewire UI with Inertia 3 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui. One learner frontend only.
3. Keep Filament for the staff/admin panel. Its internal Livewire dependency is acceptable and stays isolated to `/admin`; do not build a second learner frontend.
4. Remove dark mode completely. The product has one permanent light theme.
5. Use the exact owner-approved palette for the next design phase with no substitution. Interim canonical palette is the owner-approved Modern Hybrid light table (2026-10-10); when the owner supplies the next-phase hex table it supersedes this table by explicit amendment, never by silent substitution.

## Single permanent light theme (exact, no substitution)

`docs/DESIGN.md` (Premium editorial publication, 2026-10-10) is the single
source of truth for the exact 12 hexes; `resources/css/inertia.css`
`@theme` implements them verbatim and components use tokens/utilities
only (locked by `M0InertiaFoundationTest`). The Modern Hybrid light table
previously pasted here was superseded by that DESIGN.md amendment — it is
not reproduced here so the palette cannot drift between two copies.
Preserved server-rendered pages (staff 2FA, error pages) keep the
pre-existing light-only `--fe-*` tokens in `resources/css/app.css`
(dark block retired; locked light-only by `S3DesignTest`) pending a
dedicated server-surface alignment slice — explicitly not a second
application palette.

## Consequences

- Controllers, policies, actions, jobs, migrations, seeders, file routes, PWA/TWA boundaries, and money/time rules are transport-agnostic and stay. Only the HTML transport for public/learner pages changes (Blade → Inertia responses + React pages).
- Session auth (Fortify), CSRF, rate limits, `private, no-store`, Range contract, SW allowlist, and Filament panel behavior are unchanged and re-proven per slice.
- Learner Livewire/Alpine artifacts (`app/Livewire`, learner Blade layouts/views, `reader-player.js`, `theme.js`, `auth.js` learner parts as applicable, `wire:navigate`, `@persist`, pre-paint theme scripts, appearance radios) are removed only after per-slice parity proof; Filament's Livewire stays.
- Version pins for Inertia 3 / React 19 / TS / shadcn/ui are resolved by the build agent against version-matched official docs at build time; this ADR does not invent them.

## Rejected

- Fresh starter kit overwriting the repository; parallel Blade + Inertia learner frontends; second learner design system; new invented palette; keeping dark mode alongside the single light theme.

## Revisit trigger

Revisit only by explicit owner instruction: a new approved palette table, a Filament-major change forcing staff-panel rework, or an Inertia/React major incompatibility proven against official docs. Record the outcome here before changing.
