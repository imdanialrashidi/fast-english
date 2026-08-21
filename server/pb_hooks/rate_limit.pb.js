// @ts-nocheck
// server/pb_hooks/rate_limit.pb.js
// Shared sliding-window rate limiter for custom routes.
//
// Windows live on globalThis (they must survive across hook reloads and
// require() calls, like guards.pb.js / podcast_domain.pb.js). Maps are
// bounded: when a window map exceeds EVICT_AT keys, stale buckets (whose
// newest entry is already outside the window) are deleted, so memory stays
// O(active users) instead of O(distinct users ever seen).
//
// Usage inside a routerAdd closure:
//   var rl = require(__hooks + '/rate_limit.pb.js');
//   var err = rl.checkRate(rl.window("__fepMyRoute"), uid, 30, 300000);
//   if (err) return e.json(err.status, err.body);

if (typeof globalThis.__fepRateLimit === "undefined") {
  var EVICT_AT = 2048;

  function window(name) {
    if (typeof globalThis[name] === "undefined") { globalThis[name] = {}; }
    return globalThis[name];
  }

  function checkRate(win, key, max, ms) {
    if (!win || !key) return null;
    var now = Date.now(); var ws = now - ms;
    try {
      if (Object.keys(win).length >= EVICT_AT) {
        var keys = Object.keys(win);
        for (var ki = 0; ki < keys.length; ki++) {
          var w2 = win[keys[ki]];
          if (!w2 || !w2.length || w2[w2.length - 1] <= ws) delete win[keys[ki]];
        }
        if (Object.keys(win).length >= EVICT_AT) {
          var oldestKey = null;
          var oldestTs = Infinity;
          var allKeys = Object.keys(win);
          for (var k2 = 0; k2 < allKeys.length; k2++) {
            var w3 = win[allKeys[k2]];
            var last = w3 && w3.length ? w3[w3.length - 1] : 0;
            if (last < oldestTs) { oldestTs = last; oldestKey = allKeys[k2]; }
          }
          if (oldestKey !== null) { try { delete win[oldestKey]; } catch (_) {} }
        }
      }
    } catch (_) {}
    var b = win[key]; if (!b || !Array.isArray(b)) { b = []; win[key] = b; }
    var keep = []; for (var wi = 0; wi < b.length; wi++) { if (b[wi] > ws) keep.push(b[wi]); }
    b.length = 0; for (var wj = 0; wj < keep.length; wj++) b.push(keep[wj]);
    if (b.length >= max) { var retry = Math.ceil((b[0] + ms - now) / 1000); if (retry < 1) retry = 1; return { status: 429, retryAfterSec: retry, body: { code: "rate_limited", message: "Too many requests." } }; }
    b.push(now);
    return null;
  }

  var __fepRateLimitModule = { window: window, checkRate: checkRate, EVICT_AT: EVICT_AT };
} else {
  var __fepRateLimitModule = globalThis.__fepRateLimit;
}
if (typeof module !== 'undefined' && module.exports) { module.exports = __fepRateLimitModule; }
globalThis.__fepRateLimit = __fepRateLimitModule;
