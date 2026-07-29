// server/pb_migrations/1700000001_rate_limits.js
// Configure PocketBase built-in rate limiting for the Fast English Podcast
// MVP. Conservative, documented, reversible values that:
//   - cover public signup, password authentication, and token refresh
//   - allow normal mobile retries (e.g. a user mistyping a password)
//   - do not make the disposable smoke suite flaky
//   - are applied in disposable data and can be removed by reverting
//
// PocketBase 0.39 rate-limit labels (Context7-verified from
// apis/record_crud.go + apis/record_auth.go + apis/middlewares_rate_limit.go):
//   recordCreate  -> "create"
//   authWithPassword -> "authWithPassword", "auth"
//   authRefresh   -> "authRefresh"
//
// `checkCollectionRateLimit(e, collection, "create")` first looks up the
// most specific rule `<collectionName>:create`, then falls back to `*:create`.
// The regex for labels is `^(\w+\ \/[\w\/-]*|\/[\w\/-]*|^\w+\:\w+|\*\:\w+|\w+)$`
// so the "wrong" label `*:createRecord` was accepted by validation but
// never matched an actual endpoint tag, and the rule was silently
// inert. The labels below are the ones PB uses internally.
//
// Audience values: "" (all), "@guest", "@auth". Per-IP throttling is
// the default (see RealIP in core/event_request.go).

migrate(
  (app) => {
    const settings = app.settings();

    // Enable the rate limiter and replace the rule list with our explicit,
    // documented set so the behaviour is predictable and reviewable.
    settings.rateLimits.enabled = true;
    settings.rateLimits.excludedIPs = [];
    settings.rateLimits.rules = [
      // Public fep_users record creation (signup). 30 per hour per IP
      // is enough for normal retries and a tiny disposable test
      // environment, while still blocking scripted bulk signups.
      // The smoke test consumes ~13 unique signups in the pre-rate
      // scenarios and then sends 25 more in the rate-limit scenario
      // to hit 429 within the hour window.
      {
        label: '*:create',
        duration: 60 * 60,
        maxRequests: 30,
        audience: '',
      },
      {
        label: 'fep_users:create',
        duration: 60 * 60,
        maxRequests: 30,
        audience: '',
      },
      // Password auth + any auth-with-* endpoint. 60 per 5 minutes per
      // IP. Lets a user mistype a few times, supports mobile app
      // re-auth on flaky networks, and still blocks password spraying
      // (a brute-force loop would do hundreds per minute, not 12).
      {
        label: '*:auth',
        duration: 60 * 5,
        maxRequests: 60,
        audience: '',
      },
      {
        label: '*:authWithPassword',
        duration: 60 * 5,
        maxRequests: 60,
        audience: '',
      },
      {
        label: 'fep_users:auth',
        duration: 60 * 5,
        maxRequests: 60,
        audience: '',
      },
      {
        label: 'fep_users:authWithPassword',
        duration: 60 * 5,
        maxRequests: 60,
        audience: '',
      },
      // Token refresh. Higher cap to support reconnect/retry.
      {
        label: '*:authRefresh',
        duration: 60 * 5,
        maxRequests: 30,
        audience: '',
      },
      {
        label: 'fep_users:authRefresh',
        duration: 60 * 5,
        maxRequests: 30,
        audience: '',
      },
    ];

    app.save(settings);
  },
  (app) => {
    // Down: disable the rate limiter (fall back to PB defaults).
    const settings = app.settings();
    settings.rateLimits.enabled = false;
    settings.rateLimits.rules = [];
    app.save(settings);
  },
);
