// server/pb_hooks/podcast_domain.pb.js
// Podcast Slice 2 — centralized Podcast domain helpers.
//
// Single source for:
//   - the canonical CEFR order (A1, A2, B1, B2, C1, C2);
//   - level normalization (normalizeLevel);
//   - recommended / preferred level derivation
//     (getRecommendedLevel / getPreferredLevel);
//   - published Category/Episode/Variant checks
//     (requirePublishedCategory / requirePublishedTopic /
//      requireNewVariantInvariants);
//   - published Variant listing for one Episode in CEFR order
//     (listPublishedLevelsForEpisode);
//   - artwork URL resolution (resolveEpisodeArtwork / resolveHeroArtworkUrl);
//   - deterministic vocabulary term normalization (normalizeVocabularyTerm).
//
// Do NOT duplicate level-order arrays or publication checks in other hook
// files — load this module and call it.
//
// PB 0.39 JSVM quirk: routerAdd handlers cannot see top-level declarations
// of the hook file, but `require(__hooks + '/podcast_domain.pb.js')`
// returns this module (same pattern as guards.pb.js). The module is also
// installed on globalThis as `__fepPodcast` so model hooks (which have no
// proven `require`) can use it fail-closed.
//
// Level semantics (documented in docs/PODCAST_DOMAIN.md):
//   recommendedLevel — educational guidance from the completed Placement
//                      result (fep_users.suggested_level, falling back to
//                      placement_attempts.suggested_level). Never changes
//                      when a Student browses another level.
//   preferredLevel    — default browsing level (fep_users.selected_level
//                      when valid, else recommendedLevel).
//   browsingLevel     — temporary per-request state (e.g. the `level`
//                      query parameter of the lesson list route). Never
//                      persisted.
//   entitlement       — active eligible Students may access every Published
//                      Episode Variant from A1 through C2; level is NOT an
//                      authorization boundary.

try {
  $app.logger().info('podcast_domain: hook file loaded');
} catch (_) {}

var __podcastModule = (function () {
  // Keep in sync with shared/podcast/domain.ts (tests/cefr-consistency.test.mjs).
  var CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  function normalizeLevel(lvl) {
    var s = typeof lvl === 'string' ? lvl : String(lvl || '');
    s = s.replace(/^\s+|\s+$/g, '');
    for (var i = 0; i < CEFR_ORDER.length; i++) {
      if (s === CEFR_ORDER[i]) return s;
    }
    return '';
  }

  // recommendedLevel: the actual Placement result. Source of truth is
  // fep_users.suggested_level; when that is empty/missing (legacy or
  // partially completed records) fall back to the persisted Attempt
  // suggested_level. Never derives from a score here — the deterministic
  // score mapping lives in placement_level_routes and is persisted.
  function getRecommendedLevel(app, student) {
    var fromUser = '';
    try { fromUser = String(student.get('suggested_level') || ''); } catch (_) {}
    if (normalizeLevel(fromUser)) return normalizeLevel(fromUser);
    var uid = '';
    try { uid = String(student.id || ''); } catch (_) {}
    if (uid && app) {
      try {
        var hits = app.findRecordsByFilter('placement_attempts', 'user = {:uid}', '', 1, 0, { uid: uid });
        if (hits && hits.length > 0) {
          var attemptLevel = String(hits[0].get('suggested_level') || '');
          if (normalizeLevel(attemptLevel)) return normalizeLevel(attemptLevel);
        }
      } catch (_) {}
    }
    return '';
  }

  // preferredLevel: the Student's default browsing level. Reuses the
  // existing `selected_level` field when it holds a valid CEFR level
  // (documented mapping), otherwise falls back to recommendedLevel.
  // Invalid legacy values produce the safe fallback without crashing.
  function getPreferredLevel(student, recommendedLevel) {
    var selected = '';
    try { selected = String(student.get('selected_level') || ''); } catch (_) {}
    var normalized = normalizeLevel(selected);
    if (normalized) return normalized;
    return normalizeLevel(recommendedLevel);
  }

  // resolveCategoryId — relation value may be an id string or an object.
  function resolveId(value) {
    if (!value) return '';
    if (typeof value === 'object' && value.id) return String(value.id);
    return String(value);
  }

  // Published Category check (read-side + publish invariant).
  // Returns { ok: true } or { ok: false, reason }.
  function requirePublishedCategory(app, categoryId) {
    var catId = resolveId(categoryId);
    if (!catId) return { ok: false, reason: 'Episode has no Category.' };
    var category = null;
    try { category = app.findRecordById('categories', catId); } catch (_) {}
    if (!category) return { ok: false, reason: 'Category not found.' };
    if (String(category.get('publication_status') || '') !== 'published') {
      return { ok: false, reason: 'Category is not published.' };
    }
    return { ok: true, reason: '' };
  }

  // Published Episode invariant check (used by the topics publish hook).
  // New-field requirements apply only to NEW publishes / republishes
  // (see docs/PODCAST_DOMAIN.md — grandfathering strategy).
  function requirePublishedTopic(app, topic) {
    if (!topic) return { ok: false, reason: 'Topic not found.' };
    if (String(topic.get('status') || '') !== 'published') {
      return { ok: false, reason: 'Topic is not published.' };
    }
    var slug = String(topic.get('slug') || '');
    if (!slug) return { ok: false, reason: 'Published Episode requires a slug.' };
    var contentKey = String(topic.get('content_key') || '');
    if (!contentKey) return { ok: false, reason: 'Published Episode requires a stable content key.' };
    var cv = Number(topic.get('content_version') || 0);
    if (!(cv > 0)) return { ok: false, reason: 'Published Episode requires a positive content version.' };
    var titleFa = String(topic.get('title_fa') || '');
    if (!titleFa) return { ok: false, reason: 'Published Episode requires a Persian title.' };
    var descFa = String(topic.get('description_fa') || '');
    if (!descFa) return { ok: false, reason: 'Published Episode requires a Persian description.' };
    var artwork = String(topic.get('artwork_square') || '');
    if (!artwork) return { ok: false, reason: 'Published Episode requires artwork.' };
    var category = requirePublishedCategory(app, topic.get('category'));
    if (!category.ok) return category;
    return { ok: true, reason: '' };
  }

  // New published-Variant invariants (summary_fa + content_version).
  // The remaining published-Variant invariants (published parent Episode,
  // valid A1–C2 level, transcript/body, audio, positive authoritative
  // duration, published timestamp) are enforced inline by the lessons
  // hooks in main.pb.js (pre-existing P3-S1 rules, unchanged).
  function requireNewVariantInvariants(app, lesson) {
    if (!lesson) return { ok: false, reason: 'Lesson not found.' };
    var summaryFa = String(lesson.get('summary_fa') || '');
    if (!summaryFa) return { ok: false, reason: 'Published Variant requires a Persian summary.' };
    var cv = Number(lesson.get('content_version') || 0);
    if (!(cv > 0)) return { ok: false, reason: 'Published Variant requires a positive content version.' };
    return { ok: true, reason: '' };
  }

  // All published Variants of one Episode (published parent Episode and
  // published Category are preconditions of the caller) as
  // [{ level, variantId }] in canonical CEFR order. Draft/archived
  // Variant IDs are never returned.
  function listPublishedLevelsForEpisode(app, topicId) {
    var result = [];
    if (!app || !topicId) return result;
    var lessons = [];
    try {
      lessons = app.findRecordsByFilter('lessons', 'topic = {:tid} && status = {:st}', '', 0, 0, {
        tid: String(topicId),
        st: 'published',
      });
    } catch (_) {}
    var byLevel = {};
    if (lessons && lessons.length > 0) {
      for (var i = 0; i < lessons.length; i++) {
        var lesson = lessons[i];
        if (!lesson) continue;
        var level = normalizeLevel(lesson.get('level'));
        if (!level) continue;
        if (!byLevel[level]) byLevel[level] = String(lesson.id || '');
      }
    }
    for (var j = 0; j < CEFR_ORDER.length; j++) {
      var lvl = CEFR_ORDER[j];
      if (byLevel[lvl]) result.push({ level: lvl, variantId: byLevel[lvl] });
    }
    return result;
  }

  // Artwork URL for a Variant. The route /api/fast-english/artwork/{lessonId}
  // resolves the file chain server-side:
  //   lesson.thumbnail_override -> topic.artwork_square -> Product fallback.
  function resolveEpisodeArtwork(lessonId) {
    return '/api/fast-english/artwork/' + String(lessonId || '');
  }

  // Optional wide hero image URL for the Episode (topic.hero_image_wide);
  // the route returns 404 when the Episode has no wide image.
  function resolveHeroArtworkUrl(lessonId) {
    return '/api/fast-english/artwork/' + String(lessonId || '') + '/hero';
  }

  // Deterministic vocabulary term normalization: trim, collapse repeated
  // whitespace, lowercase for uniqueness. No stemming or linguistic
  // transformation; the original display term is stored separately.
  function normalizeVocabularyTerm(term) {
    var s = typeof term === 'string' ? term : String(term || '');
    s = s.replace(/^\s+|\s+$/g, '');
    s = s.replace(/\s+/g, ' ');
    return s.toLowerCase();
  }

  // --- Artwork serving (used by /api/fast-english/artwork routes) --------
  // topic must exist, be published, and have a published parent Category.
  function artworkCheckTopicPublished(app, topic) {
    if (!topic || String(topic.get('status') || '') !== 'published') return false;
    var cat = requirePublishedCategory(app, topic.get('category'));
    return cat.ok;
  }

  function artworkContentType(storedName) {
    var lower = String(storedName || '').toLowerCase();
    if (lower.indexOf('.png') >= 0) return 'image/png';
    if (lower.indexOf('.webp') >= 0) return 'image/webp';
    if (lower.indexOf('.jpg') >= 0 || lower.indexOf('.jpeg') >= 0) return 'image/jpeg';
    return 'image/jpeg';
  }

  // Controlled Product fallback artwork: a deterministic branded SVG. Served
  // only for published Episodes that have no artwork file yet (legacy
  // grandfathered content). Not a broken image; never a placeholder claiming
  // real artwork.
  function fallbackArtworkSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
      '<rect width="640" height="360" fill="#0B1220"/>' +
      '<circle cx="320" cy="180" r="72" fill="none" stroke="#7C4DFF" stroke-width="6"/>' +
      '<text x="320" y="196" font-family="Vazirmatn, sans-serif" font-size="40" fill="#F6F8FC" text-anchor="middle">FEP</text>' +
      '</svg>';
  }

  // Shared byte-serving core for the artwork routes. `storedName` is the
  // record's file field value; `fallbackSvg` (optional) is served when no
  // file exists. Returns the request object after writing the response.
  function serveArtworkBytes(app, e, record, storedName, contentType, fallbackSvg) {
    var MAX_ARTWORK_BYTES = 5 * 1024 * 1024;
    var header = e.response.header();
    try {
      header.set('X-Content-Type-Options', 'nosniff');
      header.set('Cache-Control', 'public, max-age=3600');
    } catch (_) {}

    if (!storedName) {
      if (fallbackSvg) {
        var svgBytes = [];
        for (var si = 0; si < fallbackSvg.length; si++) { svgBytes.push(fallbackSvg.charCodeAt(si) & 0xff); }
        try {
          header.set('Content-Type', 'image/svg+xml');
          header.set('Content-Length', String(svgBytes.length));
        } catch (_) {}
        try { e.response.write(svgBytes); } catch (_) {}
        return e;
      }
      return e.json(404, { code: 'not_found', message: 'Not found.' });
    }

    var dataDir = '';
    try { dataDir = String(app.dataDir() || ''); } catch (_) {}
    var basePath = '';
    try { basePath = String(record.baseFilesPath() || ''); } catch (_) {}
    if (!dataDir || !basePath) {
      return e.json(500, { code: 'unexpected_error', message: 'Internal error.' });
    }
    var absPath = '';
    try { absPath = $filepath.join(dataDir, 'storage', basePath, storedName); } catch (_) {}
    if (!absPath) {
      return e.json(500, { code: 'unexpected_error', message: 'Internal error.' });
    }

    // Containment check
    var baseNormalized = '';
    try { baseNormalized = $filepath.clean($filepath.join(dataDir, 'storage', basePath)); } catch (_) {}
    var absNormalized = '';
    try { absNormalized = $filepath.clean(absPath); } catch (_) {}
    var prefixOk = false;
    try {
      var baseWithSep = baseNormalized;
      var lastCh = baseWithSep.charAt(baseWithSep.length - 1);
      if (lastCh !== '/' && lastCh !== '\\') { baseWithSep = baseWithSep + '/'; }
      prefixOk = absNormalized.indexOf(baseWithSep) === 0;
    } catch (_) { prefixOk = false; }
    if (!prefixOk) {
      return e.json(404, { code: 'not_found', message: 'Not found.' });
    }

    var raw = null;
    try { raw = $os.readFile(absNormalized); } catch (_) { raw = null; }
    if (!raw) {
      return e.json(404, { code: 'not_found', message: 'Not found.' });
    }

    var bytes = null;
    if (typeof raw === 'string') {
      var arr = [];
      for (var si2 = 0; si2 < raw.length; si2++) { arr.push(raw.charCodeAt(si2) & 0xff); }
      bytes = arr;
    } else if (Array.isArray(raw)) {
      bytes = raw;
    } else {
      bytes = null;
    }
    if (!bytes || bytes.length === 0) {
      return e.json(404, { code: 'not_found', message: 'Not found.' });
    }
    if (bytes.length > MAX_ARTWORK_BYTES) {
      return e.json(413, { code: 'artwork_too_large', message: 'Artwork exceeds limit.' });
    }

    try {
      header.set('Content-Type', contentType);
      header.set('Content-Length', String(bytes.length));
    } catch (_) {}
    try { e.response.write(bytes); } catch (_) {}
    return e;
  }

  // ---------------------------------------------------------------------------
  // Entitlement seam — single source for premium route authorization.
  // Deep module: small interface hides Student + active + placement +
  // live subscription window checks that were duplicated 7×.
  // Returns null on success (entitled), or { status, body } on denial.
  // opts.requirePlacement (default true) controls the placement gate.
  // ---------------------------------------------------------------------------
  function requireEntitlement(app, e, opts) {
    var requirePlacement = true;
    try { if (opts && opts.requirePlacement === false) requirePlacement = false; } catch (_) {}
    if (!e || !e.auth || !e.auth.id) {
      return { status: 401, body: { code: 'auth_required', message: 'Authentication required.' } };
    }
    var uid = String(e.auth.id || '');
    var student = null;
    try { student = app.findRecordById('fep_users', uid); } catch (_) {}
    if (!student) {
      return { status: 401, body: { code: 'user_not_found', message: 'User not found.' } };
    }
    var g = null;
    try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
    var guardErr = (g && g.requireStudent) ? g.requireStudent(e) : { status: 500, code: 'unexpected_error', message: 'Internal error.' };
    if (guardErr) {
      return { status: guardErr.status, body: { code: guardErr.code, message: guardErr.message } };
    }
    var acct = '';
    try { acct = String(student.get('account_status') || ''); } catch (_) {}
    if (acct === 'suspended') {
      return { status: 403, body: { code: 'account_suspended', message: 'Account is suspended.' } };
    }
    if (acct !== 'active') {
      return { status: 403, body: { code: 'subscription_required', message: 'Active subscription required.' } };
    }
    if (requirePlacement) {
      var pc = false;
      try { pc = Boolean(student.get('placement_completed')); } catch (_) {}
      var sel = '';
      try { sel = String(student.get('selected_level') || ''); } catch (_) {}
      if (!pc || !sel) {
        return { status: 403, body: { code: 'placement_incomplete', message: 'Placement must be completed first.' } };
      }
    }
    // Live subscription window: user active subscription where start <= now < expires.
    var nowMs = Date.now();
    var hasSub = false;
    try {
      var subs = app.findRecordsByFilter('subscriptions', "user = {:uid} && status = 'active'", '', 0, 0, { uid: uid });
      for (var si = 0; si < subs.length; si++) {
        var s = subs[si];
        var expStr = String(s.get('expires_at') || '');
        var startStr = String(s.get('starts_at') || '');
        if (!expStr || !startStr) continue;
        var expMs = new Date(expStr).getTime();
        var startMs = new Date(startStr).getTime();
        if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) { hasSub = true; break; }
      }
    } catch (_) {}
    if (!hasSub) {
      return { status: 403, body: { code: 'subscription_required', message: 'Active subscription required.' } };
    }
    return null;
  }

  // Best-effort real client IP for rate limiting. In production PocketBase
  // binds to 127.0.0.1 behind Caddy, which appends the client IP as the LAST
  // X-Forwarded-For entry; client-supplied values always precede it and
  // cannot spoof the last hop. Falls back to the direct peer address.
  function clientIp(e) {
    try {
      var fwd = String(e.request.header.get("X-Forwarded-For") || "");
      if (fwd) {
        var parts = fwd.split(",");
        var last = parts[parts.length - 1].trim();
        if (last) return last;
      }
    } catch (_) {}
    try {
      var rip = String(e.request.remoteIP() || "");
      if (rip) return rip;
    } catch (_) {}
    return "unknown";
  }

  return {
    CEFR_ORDER: CEFR_ORDER,
    normalizeLevel: normalizeLevel,
    getRecommendedLevel: getRecommendedLevel,
    getPreferredLevel: getPreferredLevel,
    requirePublishedCategory: requirePublishedCategory,
    requirePublishedTopic: requirePublishedTopic,
    requireNewVariantInvariants: requireNewVariantInvariants,
    listPublishedLevelsForEpisode: listPublishedLevelsForEpisode,
    resolveEpisodeArtwork: resolveEpisodeArtwork,
    resolveHeroArtworkUrl: resolveHeroArtworkUrl,
    normalizeVocabularyTerm: normalizeVocabularyTerm,
    artworkCheckTopicPublished: artworkCheckTopicPublished,
    artworkContentType: artworkContentType,
    fallbackArtworkSvg: fallbackArtworkSvg,
    serveArtworkBytes: serveArtworkBytes,
    requireEntitlement: requireEntitlement,
    clientIp: clientIp,
  };
})();

// Export for `require(__hooks + '/podcast_domain.pb.js')` from routerAdd
// handlers (the handler scope cannot see file-level globals, but `require`
// is available and returns this module). The module object only exists when
// the file is loaded through `require`, not when PB loads it as a hook.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = __podcastModule;
}
// Also install on globalThis for model-hook scopes (same pattern as
// guards.pb.js and the rate-limit state).
globalThis.__fepPodcast = __podcastModule;
