// server/pb_migrations/1700000005_extend_rate_limits_for_payment.js
// P1-S1 — Extend PocketBase rate limiting for the payment upload route.
//
// The base rules from migration 1700000001 cover record CRUD and auth.
// Payment uploads need a separate cap so:
//   - a single client cannot repeat-upload large files to abuse storage,
//   - normal mobile retries (dropped network, hit-and-retry) still work,
//   - the smoke test gets a real HTTP 429 when it intentionally exceeds.
//
// PocketBase 0.39 accepts a path-prefix label for custom routes (see
// RateLimitRule.label docs: "users:create", "*:create", "POST /api/...").
// We use the explicit path label so the rule only matches the upload
// route, not the whole `/api/fast-english/` prefix.
//
// CRITICAL: PocketBase 0.39's rate-limit `audience: '@auth'` is NOT
// honored for custom routes — the global middleware always falls back
// to per-IP for path-prefix rules. The per-user 5/10min window is
// therefore enforced inside the route handler itself (see
// server/pb_hooks/payment_routes.pb.js). The PB-level rule below
// stays in place as a coarse transport-level burst guard (a single
// IP is allowed up to 100 attempts in 10 min — enough for a normal
// office or mobile carrier NAT where many users share one egress
// IP — while still blocking the worst flooding).

migrate(
  (app) => {
    const settings = app.settings();
    settings.rateLimits.enabled = true;
    settings.rateLimits.excludedIPs = [];

    const existing = Array.isArray(settings.rateLimits.rules)
      ? settings.rateLimits.rules
      : [];
    const label = 'POST /api/fast-english/payment-requests';
    const next = existing.filter((r) => r && r.label !== label);
    next.push({
      label,
      duration: 60 * 10,
      maxRequests: 100,
      audience: '',
    });
    settings.rateLimits.rules = next;
    app.save(settings);
  },
  (app) => {
    // Down: remove only the rule added by this migration. The base
    // rules stay in place until 1700000001 is reverted.
    const settings = app.settings();
    const label = 'POST /api/fast-english/payment-requests';
    if (Array.isArray(settings.rateLimits.rules)) {
      settings.rateLimits.rules = settings.rateLimits.rules.filter(
        (r) => r && r.label !== label,
      );
      app.save(settings);
    }
  },
);
