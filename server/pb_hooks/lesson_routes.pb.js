// server/pb_hooks/lesson_routes.pb.js
// P3-S1 — Lesson list, lesson detail, public sample, premium audio proxy.
//
// CRITICAL: PocketBase 0.39 JSVM recompiles the routerAdd handler in
// the executor's scope, so it CANNOT see top-level var declarations
// or function declarations in this file. Every helper and constant
// used inside the closures must be inlined into the closure bodies.
//
// Routes:
//   GET /api/fast-english/lessons
//     - Requires full premium entitlement (active student, active sub,
//       placement completed, matching level).
//     - Returns published lessons for the student's selected level.
//     - Sanitized metadata only; no body, no audio filename or record.
//     - Cache-Control: private, no-store
//
//   GET /api/fast-english/lessons/{lessonId}
//     - Requires full premium entitlement + level match.
//     - Returns full lesson body + direct audio URL.
//     - Cache-Control: private, no-store
//
//   GET /api/fast-english/lessons/{lessonId}/audio
//     - Requires full premium entitlement + level match.
//     - Serves the protected premium audio file with Range/206 support.
//     - This replaces the PB built-in protected file approach because
//       PB 0.39 filter rules cannot express cross-collection back-
//       reference queries (e.g. @collection.subscriptions) needed to
//       verify live subscription at file-request time.
//     - Cache-Control: private, no-store
//
//   GET /api/fast-english/public/sample
//     - No authentication required.
//     - Returns the single published public sample lesson or sample_unavailable.
//     - Never exposes premium lessons, subscription data, or internal notes.
//
//   GET /api/fast-english/public/sample/audio
//     - No authentication required.
//     - Serves the public sample audio file with Range/206 support.
//     - Never exposes premium audio or record data.

try {
  $app.logger().info("lesson_routes: hook file loaded");
} catch (_) {}



// =====================================================================
// GET /api/fast-english/lessons
// Premium lesson list for the student's selected level.
// =====================================================================

routerAdd(
  "GET",
  "/api/fast-english/lessons",
  function (e) {
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";
    var USERS_C = "fep_users";

    // Inline rate limit
    if (typeof globalThis.__fepLessonsList === "undefined") { globalThis.__fepLessonsList = {}; }
    var RATE_WIN = globalThis.__fepLessonsList;
    var RATE_MAX = 30;
    var RATE_MS = 300000;

    function checkRate(uid) {
      if (!uid) return null;
      var now = Date.now(); var ws = now - RATE_MS;
      var b = RATE_WIN[uid]; if (!b || !Array.isArray(b)) { b = []; RATE_WIN[uid] = b; }
      var keep = []; for (var wi = 0; wi < b.length; wi++) { if (b[wi] > ws) keep.push(b[wi]); }
      b.length = 0; for (var wj = 0; wj < keep.length; wj++) b.push(keep[wj]);
      if (b.length >= RATE_MAX) { var retry = Math.ceil((b[0] + RATE_MS - now) / 1000); if (retry < 1) retry = 1; return { status: 429, body: { code: "rate_limited", message: "Too many requests." } }; }
      b.push(now);
      return null;
    }

    // Sanitized lesson shape (no body, no audio filename, no internal notes)
    function shapeLessonListItem(rec, pd) {
      if (!rec) return null;
      var topicId = "";
      try { topicId = String(rec.get("topic") || ""); } catch (_) {}
      var topicTitle = "";
      var topicSlug = "";
      var topicContentKey = "";
      var topicTitleFa = "";
      var topicDescFa = "";
      var topicFeatured = false;
      var episodeArtwork = "";
      var episodeHero = "";
      var categoryInfo = null;
      if (topicId) {
        try {
          var t = $app.findRecordById(TOPICS_C, topicId);
          if (t) {
            topicTitle = String(t.get("title") || "");
            topicSlug = String(t.get("slug") || "");
            topicContentKey = String(t.get("content_key") || "");
            topicTitleFa = String(t.get("title_fa") || "");
            topicDescFa = String(t.get("description_fa") || "");
            topicFeatured = Boolean(t.get("is_featured"));
            episodeArtwork = pd && pd.resolveEpisodeArtwork ? pd.resolveEpisodeArtwork(String(rec.id || "")) : "";
            if (t.get("hero_image_wide")) {
              episodeHero = pd && pd.resolveHeroArtworkUrl ? pd.resolveHeroArtworkUrl(String(rec.id || "")) : "";
            }
            var catId = "";
            try { catId = String(t.get("category") || ""); } catch (_) {}
            if (catId) {
              try {
                var cat = $app.findRecordById("categories", catId);
                if (cat) {
                  categoryInfo = {
                    id: String(cat.id || ""),
                    key: String(cat.get("key") || ""),
                    slug: String(cat.get("slug") || ""),
                    titleFa: String(cat.get("title_fa") || ""),
                  };
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
      // Server-authoritative duration. Published lessons always carry
      // audio_duration_seconds (enforced by the publish hook); never fall back
      // to estimated_minutes so client-visible metadata stays authoritative.
      var authoritativeDuration = Number(rec.get("audio_duration_seconds") || 0);

      return {
        id: String(rec.id || ""),
        topicId: topicId,
        topicTitle: topicTitle,
        topicSlug: topicSlug,
        title: String(rec.get("title") || ""),
        summary: String(rec.get("summary") || ""),
        level: String(rec.get("level") || ""),
        estimatedMinutes: Number(rec.get("estimated_minutes") || 0),
        audioDurationSeconds: authoritativeDuration,
        publishedAt: rec.get("published_at") || null,
        isPublicSample: Boolean(rec.get("is_public_sample")),
        episode: {
          id: topicId,
          slug: topicSlug,
          contentKey: topicContentKey,
          title: topicTitle,
          titleFa: topicTitleFa,
          descriptionFa: topicDescFa,
          category: categoryInfo,
          artwork: episodeArtwork,
          heroImage: episodeHero || null,
          featured: topicFeatured,
        },
      };
    }

    try {
      // Full entitlement check (inlined)
      var USERS_C = "fep_users";
      var SUBS_C = "subscriptions";
      var entitlementErr = null;
      if (!e.auth || !e.auth.id) {
        entitlementErr = { status: 401, body: { code: "auth_required", message: "Authentication required." } };
      } else {
        var uid = String(e.auth.id || "");
        var student = null;
        try { student = $app.findRecordById(USERS_C, uid); } catch (_) {}
        if (!student) {
          entitlementErr = { status: 401, body: { code: "user_not_found", message: "User not found." } };
        } else {
          // Central Student guard (guards.pb.js): Auth Collection must
          // be `fep_users` with role === 'student'. Legacy Staff
          // records are rejected here.
          var g = null;
          try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
          // Fail closed: an unavailable guard must not let the request through.
          var guardErr = (g && g.requireStudent) ? g.requireStudent(e) : { status: 500, code: "unexpected_error", message: "Internal error." };
          if (guardErr) {
            entitlementErr = { status: guardErr.status, body: { code: guardErr.code, message: guardErr.message } };
          } else {
            var acct = String(student.get("account_status") || "");
            if (acct === "suspended") {
              entitlementErr = { status: 403, body: { code: "account_suspended", message: "Account is suspended." } };
            } else if (acct !== "active") {
              entitlementErr = { status: 403, body: { code: "subscription_required", message: "Active subscription required." } };
            } else {
              var pc = Boolean(student.get("placement_completed"));
              var selLvl = String(student.get("selected_level") || "");
              if (!pc || !selLvl) {
                entitlementErr = { status: 403, body: { code: "placement_incomplete", message: "Placement must be completed first." } };
              } else {
                var nowMs = Date.now();
                var hasSub = false;
                try {
                  var subs = $app.findRecordsByFilter(SUBS_C, "user = {:uid} && status = 'active'", "", 0, 0, { uid: uid });
                  for (var si = 0; si < subs.length; si++) {
                    var s = subs[si];
                    var expStr = String(s.get("expires_at") || "");
                    var startStr = String(s.get("starts_at") || "");
                    if (!expStr || !startStr) continue;
                    var expMs = new Date(expStr).getTime();
                    var startMs = new Date(startStr).getTime();
                    if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) {
                      hasSub = true;
                      break;
                    }
                  }
                } catch (_) {}
                if (!hasSub) {
                  entitlementErr = { status: 403, body: { code: "subscription_required", message: "Active subscription required." } };
                }
              }
            }
          }
        }
      }
      if (entitlementErr) return e.json(entitlementErr.status, entitlementErr.body);

      var uid = String(e.auth.id || "");

      // Load the live student; resolve recommended/preferred levels.
      var student = null;
      try { student = $app.findRecordById(USERS_C, uid); } catch (_) {}
      if (!student) return e.json(401, { code: "user_not_found", message: "User not found." });
      var pd = null;
      try { pd = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd = null; }
      if (!pd) return e.json(500, { code: "unexpected_error", message: "Internal error." });
      var recommendedLevel = pd.getRecommendedLevel($app, student);
      var preferredLevel = pd.getPreferredLevel(student, recommendedLevel);

      // Browsing level: temporary per-request state (never persisted).
      // Defaults to the preferred level; the level equality check is no
      // longer an authorization requirement (entitlement grants access to
      // every Published Variant, A1–C2).
      var requestedLevel = "";
      try {
        var qLevel = e.request.url.query().get("level");
        if (qLevel) {
          requestedLevel = pd.normalizeLevel(qLevel);
          if (!requestedLevel) {
            return e.json(400, { code: "invalid_level", message: "Invalid level. Must be one of: A1, A2, B1, B2, C1, C2." });
          }
        }
      } catch (_) {}
      if (!requestedLevel) requestedLevel = preferredLevel;
      if (!requestedLevel) return e.json(403, { code: "no_level", message: "No level selected." });

      // Rate limit
      var rateErr = checkRate(uid);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      // Pagination
      var page = 1;
      var perPage = 50;
      try {
        var qPage = e.request.url.query().get("page");
        if (qPage) { var np = parseInt(qPage, 10); if (np > 0) page = np; }
        var qPer = e.request.url.query().get("perPage");
        if (qPer) { var np2 = parseInt(qPer, 10); if (np2 > 0 && np2 <= 100) perPage = np2; }
      } catch (_) {}

      // Find published lessons for the requested browsing level, ordered by topic sort_order then published_at
      var allMatching = [];
      try {
        allMatching = $app.findRecordsByFilter(
          LESSONS_C,
          "level = {:lvl} && status = 'published'",
          "-published_at",
          0,
          0,
          { lvl: requestedLevel }
        );
      } catch (qe) {}

      // Filter to only those with published topics AND published parent
      // Categories (Category archival hides all child content). This runs
      // BEFORE pagination so hidden records never consume page slots or
      // inflate totalItems.
      var visible = [];
      for (var li = 0; li < (allMatching ? allMatching.length : 0); li++) {
        var lesson = allMatching[li];
        if (!lesson) continue;
        var tId = "";
        try { tId = String(lesson.get("topic") || ""); } catch (_) {}
        var topicPublished = false;
        if (tId) {
          try {
            var tRec = $app.findRecordById(TOPICS_C, tId);
            if (tRec && tRec.get("status") === "published") {
              var catRes = pd.requirePublishedCategory($app, tRec.get("category"));
              if (catRes.ok) topicPublished = true;
            }
          } catch (_) {}
        }
        if (topicPublished) {
          visible.push(lesson);
        }
      }

      var totalItems = visible.length;
      var skip = (page - 1) * perPage;
      var filtered = [];
      for (var vi = skip; vi < visible.length && filtered.length < perPage; vi++) {
        filtered.push(shapeLessonListItem(visible[vi], pd));
      }

      try { e.response.header().set("Cache-Control", "private, no-store"); } catch (_) {}
      try { e.response.header().set("Pragma", "no-cache"); } catch (_) {}

      return e.json(200, {
        lessons: filtered,
        page: page,
        perPage: perPage,
        totalItems: totalItems,
        level: requestedLevel,
        recommendedLevel: recommendedLevel,
        preferredLevel: preferredLevel,
      });
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("lesson_routes: LIST error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("fep_users")
);

// =====================================================================
// GET /api/fast-english/lessons/{lessonId}
// Premium lesson detail.
// =====================================================================

routerAdd(
  "GET",
  "/api/fast-english/lessons/{lessonId}",
  function (e) {
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";
    var USERS_C = "fep_users";

    // Inline rate limit
    if (typeof globalThis.__fepLessonsDetail === "undefined") { globalThis.__fepLessonsDetail = {}; }
    var RATE_WIN = globalThis.__fepLessonsDetail;
    var RATE_MAX = 30;
    var RATE_MS = 300000;

    function checkRate(uid) {
      if (!uid) return null;
      var now = Date.now(); var ws = now - RATE_MS;
      var b = RATE_WIN[uid]; if (!b || !Array.isArray(b)) { b = []; RATE_WIN[uid] = b; }
      var keep = []; for (var wi = 0; wi < b.length; wi++) { if (b[wi] > ws) keep.push(b[wi]); }
      b.length = 0; for (var wj = 0; wj < keep.length; wj++) b.push(keep[wj]);
      if (b.length >= RATE_MAX) { var retry = Math.ceil((b[0] + RATE_MS - now) / 1000); if (retry < 1) retry = 1; return { status: 429, body: { code: "rate_limited", message: "Too many requests." } }; }
      b.push(now);
      return null;
    }

    try {
      // Full entitlement check (inlined)
      var USERS_C = "fep_users";
      var SUBS_C = "subscriptions";
      var entitlementErr = null;
      if (!e.auth || !e.auth.id) {
        entitlementErr = { status: 401, body: { code: "auth_required", message: "Authentication required." } };
      } else {
        var uid = String(e.auth.id || "");
        var student = null;
        try { student = $app.findRecordById(USERS_C, uid); } catch (_) {}
        if (!student) {
          entitlementErr = { status: 401, body: { code: "user_not_found", message: "User not found." } };
        } else {
          // Central Student guard (guards.pb.js): Auth Collection must
          // be `fep_users` with role === 'student'. Legacy Staff
          // records are rejected here.
          var g = null;
          try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
          // Fail closed: an unavailable guard must not let the request through.
          var guardErr = (g && g.requireStudent) ? g.requireStudent(e) : { status: 500, code: "unexpected_error", message: "Internal error." };
          if (guardErr) {
            entitlementErr = { status: guardErr.status, body: { code: guardErr.code, message: guardErr.message } };
          } else {
            var acct = String(student.get("account_status") || "");
            if (acct === "suspended") {
              entitlementErr = { status: 403, body: { code: "account_suspended", message: "Account is suspended." } };
            } else if (acct !== "active") {
              entitlementErr = { status: 403, body: { code: "subscription_required", message: "Active subscription required." } };
            } else {
              var pc = Boolean(student.get("placement_completed"));
              var selLvl = String(student.get("selected_level") || "");
              if (!pc || !selLvl) {
                entitlementErr = { status: 403, body: { code: "placement_incomplete", message: "Placement must be completed first." } };
              } else {
                var nowMs = Date.now();
                var hasSub = false;
                try {
                  var subs = $app.findRecordsByFilter(SUBS_C, "user = {:uid} && status = 'active'", "", 0, 0, { uid: uid });
                  for (var si = 0; si < subs.length; si++) {
                    var s = subs[si];
                    var expStr = String(s.get("expires_at") || "");
                    var startStr = String(s.get("starts_at") || "");
                    if (!expStr || !startStr) continue;
                    var expMs = new Date(expStr).getTime();
                    var startMs = new Date(startStr).getTime();
                    if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) {
                      hasSub = true;
                      break;
                    }
                  }
                } catch (_) {}
                if (!hasSub) {
                  entitlementErr = { status: 403, body: { code: "subscription_required", message: "Active subscription required." } };
                }
              }
            }
          }
        }
      }
      if (entitlementErr) return e.json(entitlementErr.status, entitlementErr.body);

      var uid = String(e.auth.id || "");

      // Load the live student; resolve recommended/preferred levels.
      var student = null;
      try { student = $app.findRecordById(USERS_C, uid); } catch (_) {}
      if (!student) return e.json(401, { code: "user_not_found", message: "User not found." });
      var pd = null;
      try { pd = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd = null; }
      if (!pd) return e.json(500, { code: "unexpected_error", message: "Internal error." });
      var recommendedLevel = pd.getRecommendedLevel($app, student);
      var preferredLevel = pd.getPreferredLevel(student, recommendedLevel);

      // Path parameter
      var lessonId = "";
      try { lessonId = String(e.request.pathValue("lessonId") || ""); } catch (_) {}
      if (!lessonId) return e.json(400, { code: "invalid_request", message: "Missing lessonId." });

      // Rate limit
      var rateErr = checkRate(uid);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      // Load lesson
      var lesson = null;
      try { lesson = $app.findRecordById(LESSONS_C, lessonId); } catch (_) {}
      if (!lesson) return e.json(404, { code: "not_found", message: "Lesson not found." });

      // Cross-level access: the level equality check is removed — an
      // entitled Student may open any Published Variant (A1–C2).
      var lessonLevel = String(lesson.get("level") || "");
      var lessonStatus = String(lesson.get("status") || "");
      if (lessonStatus !== "published") {
        return e.json(404, { code: "not_found", message: "Lesson not found." });
      }

      // Verify topic is published
      var topicId = "";
      try { topicId = String(lesson.get("topic") || ""); } catch (_) {}
      var topicPublished = false;
      var topicTitle = "";
      var topicSlug = "";
      var topicContentKey = "";
      var topicTitleFa = "";
      var topicDescFa = "";
      var topicFeatured = false;
      var episodeHero = "";
      var topicEpisodeNumber = 0;
      var categoryInfo = null;
      if (topicId) {
        try {
          var tRec = $app.findRecordById(TOPICS_C, topicId);
          if (tRec) {
            topicTitle = String(tRec.get("title") || "");
            topicSlug = String(tRec.get("slug") || "");
            topicContentKey = String(tRec.get("content_key") || "");
            topicTitleFa = String(tRec.get("title_fa") || "");
            topicDescFa = String(tRec.get("description_fa") || "");
            topicFeatured = Boolean(tRec.get("is_featured"));
            topicEpisodeNumber = Number(tRec.get("episode_number") || 0);
            if (tRec.get("hero_image_wide")) {
              episodeHero = pd.resolveHeroArtworkUrl(String(lesson.id || ""));
            }
            if (tRec.get("status") === "published") {
              var catRes = pd.requirePublishedCategory($app, tRec.get("category"));
              if (catRes.ok) topicPublished = true;
            }
            var catId2 = "";
            try { catId2 = String(tRec.get("category") || ""); } catch (_) {}
            if (catId2) {
              try {
                var cat2 = $app.findRecordById("categories", catId2);
                if (cat2) {
                  categoryInfo = {
                    id: String(cat2.id || ""),
                    key: String(cat2.get("key") || ""),
                    slug: String(cat2.get("slug") || ""),
                    titleFa: String(cat2.get("title_fa") || ""),
                  };
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
      if (!topicPublished) {
        return e.json(404, { code: "not_found", message: "Lesson not found." });
      }

      // Detect audio MIME type
      var audioFile = "";
      try { audioFile = String(lesson.get("audio") || ""); } catch (_) {}
      var audioContentType = "audio/mpeg";
      var lowerAudio = audioFile.toLowerCase();
      if (lowerAudio.indexOf(".mp4") >= 0 || lowerAudio.indexOf(".m4a") >= 0) {
        audioContentType = "audio/mp4";
      } else if (lowerAudio.indexOf(".ogg") >= 0) {
        audioContentType = "audio/ogg";
      } else if (lowerAudio.indexOf(".webm") >= 0) {
        audioContentType = "audio/webm";
      }

      // Set private cache headers
      try { e.response.header().set("Cache-Control", "private, no-store"); } catch (_) {}
      try { e.response.header().set("Pragma", "no-cache"); } catch (_) {}

      // Server-authoritative duration (publish hook enforces it is set).
      var authoritativeDuration = Number(lesson.get("audio_duration_seconds") || 0);

      // Available levels for the same Episode: only Published Variants
      // (parent Episode and Category already proven published), in the
      // canonical CEFR order, with enough information for a future Level
      // Switcher. Draft/archived Variant IDs are never included.
      var availableLevels = [];
      var levelList = pd.listPublishedLevelsForEpisode($app, topicId);
      for (var ai = 0; ai < levelList.length; ai++) {
        var entry = levelList[ai];
        availableLevels.push({
          level: entry.level,
          variantId: entry.variantId,
          available: true,
          isRecommended: entry.level === recommendedLevel,
          isPreferred: entry.level === preferredLevel,
        });
      }

      // Vocabulary count for this Variant (single query).
      var vocabularyCount = 0;
      try {
        var vocabHits = $app.findRecordsByFilter(
          "lesson_vocabulary",
          "lesson = {:lid}",
          "",
          0,
          0,
          { lid: String(lesson.id || "") }
        );
        vocabularyCount = vocabHits ? vocabHits.length : 0;
      } catch (_) {}

      // ------------------------------------------------------------------
      // Previous/next Episode refs (Slice 7): real published neighbors at
      // the current Variant's level only. Deterministic order: Episode
      // sort_order, then Variant published date, then content key. The
      // current Variant is located inside the same ordered list, so prev
      // and next are its immediate neighbors. Nothing is invented
      // client-side: absent neighbors stay null.
      // ------------------------------------------------------------------
      var prevEpisode = null;
      var nextEpisode = null;
      try {
        var sibRows = [];
        try {
          sibRows = $app.findRecordsByFilter(
            LESSONS_C,
            "level = {:lvl} && status = 'published'",
            "",
            0,
            0,
            { lvl: lessonLevel }
          );
        } catch (_) {}
        var sibList = [];
        var sibTopicCache = {};
        if (sibRows && sibRows.length > 0) {
          for (var si2 = 0; si2 < sibRows.length; si2++) {
            var sib = sibRows[si2];
            if (!sib) continue;
            var sibTid = "";
            try { sibTid = String(sib.get("topic") || ""); } catch (_) {}
            if (!sibTid) continue;
            var sibTopic = sibTopicCache[sibTid];
            if (sibTopicCache[sibTid] === undefined) {
              try { sibTopic = $app.findRecordById(TOPICS_C, sibTid); } catch (_) { sibTopic = null; }
              sibTopicCache[sibTid] = sibTopic;
            }
            if (!sibTopic || String(sibTopic.get("status") || "") !== "published") continue;
            var sibCatRes = pd.requirePublishedCategory($app, sibTopic.get("category"));
            if (!sibCatRes.ok) continue;
            sibList.push({ lesson: sib, topic: sibTopic });
          }
        }
        sibList.sort(function (a, b) {
          var oa = Number(a.topic.get("sort_order") || 0);
          var ob = Number(b.topic.get("sort_order") || 0);
          if (oa !== ob) return oa - ob;
          var pa = String(a.lesson.get("published_at") || "");
          var pb = String(b.lesson.get("published_at") || "");
          if (pa !== pb) return pa < pb ? -1 : 1;
          var ka = String(a.topic.get("content_key") || "");
          var kb = String(b.topic.get("content_key") || "");
          if (ka !== kb) return ka < kb ? -1 : 1;
          return String(a.lesson.id || "") < String(b.lesson.id || "") ? -1 : 1;
        });
        var curIdx = -1;
        for (var ci2 = 0; ci2 < sibList.length; ci2++) {
          if (String(sibList[ci2].lesson.id || "") === String(lesson.id || "")) { curIdx = ci2; break; }
        }
        function shapeNeighbor(entry) {
          return {
            episodeId: String(entry.topic.id || ""),
            variantId: String(entry.lesson.id || ""),
            title: String(entry.topic.get("title") || ""),
            titleFa: String(entry.topic.get("title_fa") || ""),
            level: String(entry.lesson.get("level") || ""),
            artwork: pd.resolveEpisodeArtwork(String(entry.lesson.id || "")),
          };
        }
        if (curIdx >= 0) {
          if (curIdx > 0) prevEpisode = shapeNeighbor(sibList[curIdx - 1]);
          if (curIdx < sibList.length - 1) nextEpisode = shapeNeighbor(sibList[curIdx + 1]);
        }
      } catch (_) {}

      return e.json(200, {
        id: String(lesson.id || ""),
        topic: {
          id: topicId,
          title: topicTitle,
          slug: topicSlug,
        },
        title: String(lesson.get("title") || ""),
        level: lessonLevel,
        body: String(lesson.get("body") || ""),
        estimatedMinutes: Number(lesson.get("estimated_minutes") || 0),
        audioDurationSeconds: authoritativeDuration,
        isPublicSample: Boolean(lesson.get("is_public_sample")),
        publishedAt: lesson.get("published_at") || null,
        audio: {
          url: "/api/fast-english/lessons/" + String(lesson.id || "") + "/audio",
          contentType: audioContentType,
          estimatedMinutes: Number(lesson.get("estimated_minutes") || 0),
        },
        episode: {
          id: topicId,
          slug: topicSlug,
          contentKey: topicContentKey,
          title: topicTitle,
          titleFa: topicTitleFa,
          descriptionFa: topicDescFa,
          category: categoryInfo,
          artwork: pd.resolveEpisodeArtwork(String(lesson.id || "")),
          heroImage: episodeHero || null,
          featured: topicFeatured,
          episodeNumber: topicEpisodeNumber,
        },
        variant: {
          id: String(lesson.id || ""),
          level: lessonLevel,
          summaryFa: String(lesson.get("summary_fa") || ""),
          transcript: String(lesson.get("body") || ""),
          audioDurationSeconds: authoritativeDuration,
          publicationStatus: lessonStatus,
        },
        recommendedLevel: recommendedLevel,
        preferredLevel: preferredLevel,
        availableLevels: availableLevels,
        vocabularyCount: vocabularyCount,
        previousEpisode: prevEpisode,
        nextEpisode: nextEpisode,
      });
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("lesson_routes: DETAIL error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("fep_users")
);

// =====================================================================
// GET /api/fast-english/public/sample
// Public sample lesson — no authentication required.
// =====================================================================

routerAdd(
  "GET",
  "/api/fast-english/public/sample",
  function (e) {
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";

    // Rate limit (per-IP)
    if (typeof globalThis.__fepPublicSample === "undefined") { globalThis.__fepPublicSample = []; }
    var RATE_WIN = globalThis.__fepPublicSample;
    var RATE_MAX = 30;
    var RATE_MS = 300000;

    function checkRate() {
      var now = Date.now(); var ws = now - RATE_MS;
      var keep = []; for (var wi = 0; wi < RATE_WIN.length; wi++) { if (RATE_WIN[wi] > ws) keep.push(RATE_WIN[wi]); }
      RATE_WIN.length = 0; for (var wj = 0; wj < keep.length; wj++) RATE_WIN.push(keep[wj]);
      if (RATE_WIN.length >= RATE_MAX) { var retry = Math.ceil((RATE_WIN[0] + RATE_MS - now) / 1000); if (retry < 1) retry = 1; return { status: 429, body: { code: "rate_limited", message: "Too many requests." } }; }
      RATE_WIN.push(now);
      return null;
    }

    try {
      var rateErr = checkRate();
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      // Find the single published public sample
      var sample = null;
      try {
        var hits = $app.findRecordsByFilter(
          LESSONS_C,
          "is_public_sample = true && status = 'published'",
          "",
          1,
          0
        );
        if (hits && hits.length > 0) sample = hits[0];
      } catch (_) {}

      if (!sample) {
        try { e.response.header().set("Cache-Control", "public, max-age=3600"); } catch (_) {}
        return e.json(200, { kind: "sample_unavailable" });
      }

      // Verify topic is published AND its parent Category is published
      // (Category archival hides all child content, including samples).
      var topicId = "";
      try { topicId = String(sample.get("topic") || ""); } catch (_) {}
      var topicPublished = false;
      var topicTitle = "";
      var topicSlug = "";
      if (topicId) {
        try {
          var tRec = $app.findRecordById(TOPICS_C, topicId);
          if (tRec) {
            topicTitle = String(tRec.get("title") || "");
            topicSlug = String(tRec.get("slug") || "");
            if (tRec.get("status") === "published") {
              var pdS = null;
              try { pdS = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pdS = null; }
              if (pdS) {
                var catS = pdS.requirePublishedCategory($app, tRec.get("category"));
                if (catS.ok) topicPublished = true;
              }
            }
          }
        } catch (_) {}
      }
      if (!topicPublished) {
        try { e.response.header().set("Cache-Control", "public, max-age=3600"); } catch (_) {}
        return e.json(200, { kind: "sample_unavailable" });
      }

      // Return bounded sample text (no premium lesson, no sub data, no internal notes)
      var body = String(sample.get("body") || "");
      // Truncate body to a reasonable sample size
      var sampleBody = body;
      if (sampleBody.length > 1000) {
        sampleBody = sampleBody.substring(0, 1000) + "...";
      }

      var audioFile = "";
      try { audioFile = String(sample.get("audio") || ""); } catch (_) {}
      var sampleContentType = "audio/mpeg";
      var lowerSample = audioFile.toLowerCase();
      if (lowerSample.indexOf(".mp4") >= 0 || lowerSample.indexOf(".m4a") >= 0) {
        sampleContentType = "audio/mp4";
      } else if (lowerSample.indexOf(".ogg") >= 0) {
        sampleContentType = "audio/ogg";
      } else if (lowerSample.indexOf(".webm") >= 0) {
        sampleContentType = "audio/webm";
      }

      try { e.response.header().set("Cache-Control", "public, max-age=3600"); } catch (_) {}

      // Server-authoritative duration (publish hook enforces it is set).
      var sampleDuration = Number(sample.get("audio_duration_seconds") || 0);

      return e.json(200, {
        kind: "sample",
        lesson: {
          id: String(sample.id || ""),
          topic: {
            id: topicId,
            title: topicTitle,
            slug: topicSlug,
          },
          title: String(sample.get("title") || ""),
          level: String(sample.get("level") || ""),
          summary: String(sample.get("summary") || ""),
          body: sampleBody,
          estimatedMinutes: Number(sample.get("estimated_minutes") || 0),
          audioDurationSeconds: sampleDuration,
          audio: {
            url: "/api/fast-english/public/sample/audio",
            contentType: sampleContentType,
            estimatedMinutes: Number(sample.get("estimated_minutes") || 0),
          },
        },
      });
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("lesson_routes: SAMPLE error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  }
);

// =====================================================================
// GET /api/fast-english/public/sample/audio
// Public sample audio proxy — no authentication required.
// Serves the audio file with Range/206 support for browser playback.
// =====================================================================

routerAdd(
  "GET",
  "/api/fast-english/public/sample/audio",
  function (e) {
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";
    var MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

    // Per-IP rate limit
    if (typeof globalThis.__fepSampleAudio === "undefined") { globalThis.__fepSampleAudio = []; }
    var RATE_WIN = globalThis.__fepSampleAudio;
    var RATE_MAX = 60;
    var RATE_MS = 300000;

    function checkRate() {
      var now = Date.now(); var ws = now - RATE_MS;
      var keep = []; for (var wi = 0; wi < RATE_WIN.length; wi++) { if (RATE_WIN[wi] > ws) keep.push(RATE_WIN[wi]); }
      RATE_WIN.length = 0; for (var wj = 0; wj < keep.length; wj++) RATE_WIN.push(keep[wj]);
      if (RATE_WIN.length >= RATE_MAX) { var retry = Math.ceil((RATE_WIN[0] + RATE_MS - now) / 1000); if (retry < 1) retry = 1; return { status: 429, body: { code: "rate_limited", message: "Too many requests." } }; }
      RATE_WIN.push(now);
      return null;
    }

    try {
      var rateErr = checkRate();
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      // Find the published public sample
      var sample = null;
      try {
        var hits = $app.findRecordsByFilter(
          LESSONS_C,
          "is_public_sample = true && status = 'published'",
          "",
          1,
          0
        );
        if (hits && hits.length > 0) sample = hits[0];
      } catch (_) {}

      if (!sample) {
        return e.json(404, { code: "not_found", message: "Sample not found." });
      }

      // Verify topic + parent Category are published (Category archival
      // hides all child content, including the public sample audio).
      var saTopicId = "";
      try { saTopicId = String(sample.get("topic") || ""); } catch (_) {}
      var saTopicPublished = false;
      if (saTopicId) {
        try {
          var saTopic = $app.findRecordById(TOPICS_C, saTopicId);
          if (saTopic && saTopic.get("status") === "published") {
            var pdSA = null;
            try { pdSA = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pdSA = null; }
            if (pdSA) {
              var catSA = pdSA.requirePublishedCategory($app, saTopic.get("category"));
              if (catSA.ok) saTopicPublished = true;
            }
          }
        } catch (_) {}
      }
      if (!saTopicPublished) {
        return e.json(404, { code: "not_found", message: "Sample not found." });
      }

      // Get audio filename
      var storedName = "";
      try { storedName = String(sample.get("audio") || ""); } catch (_) {}
      if (!storedName) {
        return e.json(404, { code: "not_found", message: "Audio not found." });
      }

      // Resolve file path
      var dataDir = "";
      try { dataDir = String($app.dataDir() || ""); } catch (_) {}
      var basePath = "";
      try { basePath = String(sample.baseFilesPath() || ""); } catch (_) {}
      if (!dataDir || !basePath) {
        return e.json(500, { code: "unexpected_error", message: "Internal error." });
      }
      var absPath = "";
      try { absPath = $filepath.join(dataDir, "storage", basePath, storedName); } catch (_) {}
      if (!absPath) {
        return e.json(500, { code: "unexpected_error", message: "Internal error." });
      }

      // Containment check
      var baseNormalized = "";
      try { baseNormalized = $filepath.clean($filepath.join(dataDir, "storage", basePath)); } catch (_) {}
      var absNormalized = "";
      try { absNormalized = $filepath.clean(absPath); } catch (_) {}
      var prefixOk = false;
      try {
        var baseWithSep = baseNormalized;
        var lastCh = baseWithSep.charAt(baseWithSep.length - 1);
        if (lastCh !== "/" && lastCh !== "\\") { baseWithSep = baseWithSep + "/"; }
        prefixOk = absNormalized.indexOf(baseWithSep) === 0;
      } catch (_) { prefixOk = false; }
      if (!prefixOk) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }

      // Read the file
      var raw = null;
      try { raw = $os.readFile(absNormalized); } catch (_) { raw = null; }
      if (!raw) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }

      // Convert to byte array
      var bytes = null;
      if (typeof raw === "string") {
        var arr = [];
        for (var si = 0; si < raw.length; si++) { arr.push(raw.charCodeAt(si) & 0xff); }
        bytes = arr;
      } else if (Array.isArray(raw)) {
        bytes = raw;
      } else {
        bytes = null;
      }
      if (!bytes || bytes.length === 0) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }
      if (bytes.length > MAX_AUDIO_BYTES) {
        return e.json(413, { code: "audio_too_large", message: "Audio exceeds limit." });
      }

      var fileSize = bytes.length;

      // Detect audio MIME type from the stored filename extension
      var contentType = "audio/mpeg"; // default
      var lowerName = storedName.toLowerCase();
      if (lowerName.indexOf(".mp4") >= 0 || lowerName.indexOf(".m4a") >= 0) {
        contentType = "audio/mp4";
      } else if (lowerName.indexOf(".ogg") >= 0) {
        contentType = "audio/ogg";
      } else if (lowerName.indexOf(".webm") >= 0) {
        contentType = "audio/webm";
      }

      // Parse Range header
      var rangeHeader = "";
      try { rangeHeader = String(e.request.header.get("Range") || ""); } catch (_) {}
      rangeHeader = rangeHeader.trim();

      var header = e.response.header();
      try {
        header.set("Accept-Ranges", "bytes");
        header.set("Content-Type", contentType);
        header.set("X-Content-Type-Options", "nosniff");
        header.set("Cache-Control", "public, max-age=3600");
      } catch (_) {}

      if (rangeHeader && rangeHeader.indexOf("bytes=") === 0) {
        // RFC 7233 single-range parsing (sample audio): malformed units,
        // missing dashes, suffix "-0" and multi-range requests answer 416
        // instead of silently serving the whole file or the first range.
        var rangeVal = rangeHeader.substring(6).trim();
        var dashIdx = rangeVal.indexOf("-");
        var rangeStart;
        var rangeEnd;
        if (rangeVal.indexOf(",") >= 0 || dashIdx < 0) {
          try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
          return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
        }
        if (dashIdx === 0) {
          var suffixLen = parseInt(rangeVal.substring(1), 10);
          if (isNaN(suffixLen) || suffixLen <= 0) {
            try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
            return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
          }
          rangeStart = Math.max(0, fileSize - suffixLen);
          rangeEnd = fileSize - 1;
        } else {
          rangeStart = parseInt(rangeVal.substring(0, dashIdx), 10);
          if (isNaN(rangeStart) || rangeStart < 0) {
            try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
            return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
          }
          if (dashIdx + 1 < rangeVal.length) {
            rangeEnd = parseInt(rangeVal.substring(dashIdx + 1), 10);
            if (isNaN(rangeEnd)) {
              try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
              return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
            }
          } else {
            rangeEnd = fileSize - 1;
          }
        }
        if (rangeStart > rangeEnd || rangeStart >= fileSize) {
          try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
          return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
        }
        if (rangeEnd >= fileSize) rangeEnd = fileSize - 1;
        var chunkSize = rangeEnd - rangeStart + 1;
        var chunk = [];
        for (var bi = rangeStart; bi <= rangeEnd && bi < bytes.length; bi++) {
          chunk.push(bytes[bi]);
        }
        try {
          header.set("Content-Range", "bytes " + rangeStart + "-" + rangeEnd + "/" + fileSize);
          header.set("Content-Length", String(chunkSize));
        } catch (_) {}
        try { e.response.writeHeader(206); } catch (_) {}
        try { e.response.write(chunk); } catch (_) {}
        return e;
      }

      // No Range header — full content
      try {
        header.set("Content-Length", String(fileSize));
      } catch (_) {}
      try { e.response.write(bytes); } catch (_) {}
      return e;
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("lesson_routes: SAMPLE AUDIO error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  }
);

// =====================================================================
// GET /api/fast-english/lessons/{lessonId}/audio
// Premium audio proxy — full entitlement check + Range/206 support.
//
// Supports two auth methods:
//   1. Authorization: Bearer <auth_token> (for JS SDK API calls)
//   2. ?token=<file_token> (for <audio> elements that can't set headers)
// =====================================================================

routerAdd(
  "GET",
  "/api/fast-english/lessons/{lessonId}/audio",
  function (e) {
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";
    var USERS_C = "fep_users";
    var SUBS_C = "subscriptions";
    var MAX_AUDIO_BYTES = 10 * 1024 * 1024;

    // Inline rate limit
    if (typeof globalThis.__fepPremiumAudio === "undefined") { globalThis.__fepPremiumAudio = {}; }
    var RATE_WIN = globalThis.__fepPremiumAudio;
    var RATE_MAX = 30;
    var RATE_MS = 300000;

    function checkRate(uid) {
      if (!uid) return null;
      var now = Date.now(); var ws = now - RATE_MS;
      var b = RATE_WIN[uid]; if (!b || !Array.isArray(b)) { b = []; RATE_WIN[uid] = b; }
      var keep = []; for (var wi = 0; wi < b.length; wi++) { if (b[wi] > ws) keep.push(b[wi]); }
      b.length = 0; for (var wj = 0; wj < keep.length; wj++) b.push(keep[wj]);
      if (b.length >= RATE_MAX) { var retry = Math.ceil((b[0] + RATE_MS - now) / 1000); if (retry < 1) retry = 1; return { status: 429, body: { code: "rate_limited", message: "Too many requests." } }; }
      b.push(now);
      return null;
    }

    try {
      // === Manual auth resolution ===
      // Supports:
      //   1. Authorization: Bearer <auth_token> (JS SDK API calls)
      //   2. ?token=<file_token> (<audio> elements that can't set auth header)
      var student = null;
      var uid = "";

      // Try Authorization header
      var authHdr = "";
      try { authHdr = String(e.request.header.get("Authorization") || ""); } catch (_) {}
      if (authHdr && authHdr.indexOf("Bearer ") === 0) {
        var bearerToken = authHdr.substring(7);
        if (bearerToken) {
          try {
            var authRec = $app.findAuthRecordByToken(bearerToken, "auth");
            if (authRec) {
              uid = String(authRec.id || "");
              if (uid) { try { student = $app.findRecordById(USERS_C, uid); } catch (_) {} }
            }
          } catch (_) {}
        }
      }

      // Fall back to file token from query param (for <audio> elements)
      if (!student) {
        try {
          var qToken = String(e.request.url.query().get("token") || "");
          if (qToken) {
            try {
              var fileRec = $app.findAuthRecordByToken(qToken, "file");
              if (fileRec) {
                uid = String(fileRec.id || "");
                if (uid) { try { student = $app.findRecordById(USERS_C, uid); } catch (_) {} }
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      if (!student) {
        return e.json(401, { code: "auth_required", message: "Authentication required." });
      }

      // Student rule on the resolved record. This route accepts a Bearer
      // token OR a file token (for <audio> elements); a file token has no
      // e.auth record, so the same rule as the central guard (guards.pb.js:
      // fep_users collection, role === 'student') is applied to the record
      // resolved from either token. Legacy Staff records are rejected.
      var role = String(student.get("role") || "");
      if (role !== "student") {
        return e.json(403, { code: "access_denied", message: "Access denied." });
      }

      // Account status check
      var acct = String(student.get("account_status") || "");
      if (acct === "suspended") {
        return e.json(403, { code: "account_suspended", message: "Account is suspended." });
      } else if (acct !== "active") {
        return e.json(403, { code: "subscription_required", message: "Active subscription required." });
      }

      // Placement check
      var pc = Boolean(student.get("placement_completed"));
      var selLvl = String(student.get("selected_level") || "");
      if (!pc || !selLvl) {
        return e.json(403, { code: "placement_incomplete", message: "Placement must be completed first." });
      }

      // Subscription check — live from DB at request time
      var nowMs = Date.now();
      var hasSub = false;
      try {
        var subs = $app.findRecordsByFilter(SUBS_C, "user = {:uid} && status = 'active'", "", 0, 0, { uid: uid });
        for (var si = 0; si < subs.length; si++) {
          var s = subs[si];
          var expStr = String(s.get("expires_at") || "");
          var startStr = String(s.get("starts_at") || "");
          if (!expStr || !startStr) continue;
          var expMs = new Date(expStr).getTime();
          var startMs = new Date(startStr).getTime();
          if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) {
            hasSub = true;
            break;
          }
        }
      } catch (_) {}
      if (!hasSub) {
        return e.json(403, { code: "subscription_required", message: "Active subscription required." });
      }

      // Rate limit
      var rateErr = checkRate(uid);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      // === Load lesson ===
      var lessonId = "";
      try { lessonId = String(e.request.pathValue("lessonId") || ""); } catch (_) {}
      if (!lessonId) return e.json(400, { code: "invalid_request", message: "Missing lessonId." });

      var lesson = null;
      try { lesson = $app.findRecordById(LESSONS_C, lessonId); } catch (_) {}
      if (!lesson) return e.json(404, { code: "not_found", message: "Lesson not found." });

      // Lesson status
      var lessonStatus = String(lesson.get("status") || "");
      if (lessonStatus !== "published") {
        return e.json(404, { code: "not_found", message: "Lesson not found." });
      }

      // Topic published check + published parent Category check.
      // (Cross-level access: no level equality check — an entitled
      // Student may stream any Published Variant, A1–C2.)
      var topicId = "";
      try { topicId = String(lesson.get("topic") || ""); } catch (_) {}
      var topicPublished = false;
      if (topicId) {
        try {
          var tRec = $app.findRecordById(TOPICS_C, topicId);
          if (tRec && tRec.get("status") === "published") {
            var pdCat = null;
            try { pdCat = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pdCat = null; }
            if (pdCat) {
              var catRes = pdCat.requirePublishedCategory($app, tRec.get("category"));
              if (catRes.ok) topicPublished = true;
            }
          }
        } catch (_) {}
      }
      if (!topicPublished) {
        return e.json(404, { code: "not_found", message: "Lesson not found." });
      }

      // === Get audio file path ===
      var storedName = "";
      try { storedName = String(lesson.get("audio") || ""); } catch (_) {}
      if (!storedName) {
        return e.json(404, { code: "not_found", message: "Audio not found." });
      }

      var dataDir = "";
      try { dataDir = String($app.dataDir() || ""); } catch (_) {}
      var basePath = "";
      try { basePath = String(lesson.baseFilesPath() || ""); } catch (_) {}
      if (!dataDir || !basePath) {
        return e.json(500, { code: "unexpected_error", message: "Internal error." });
      }
      var absPath = "";
      try { absPath = $filepath.join(dataDir, "storage", basePath, storedName); } catch (_) {}
      if (!absPath) {
        return e.json(500, { code: "unexpected_error", message: "Internal error." });
      }

      // Containment check
      var baseNormalized = "";
      try { baseNormalized = $filepath.clean($filepath.join(dataDir, "storage", basePath)); } catch (_) {}
      var absNormalized = "";
      try { absNormalized = $filepath.clean(absPath); } catch (_) {}
      var prefixOk = false;
      try {
        var baseWithSep = baseNormalized;
        var lastCh = baseWithSep.charAt(baseWithSep.length - 1);
        if (lastCh !== "/" && lastCh !== "\\") { baseWithSep = baseWithSep + "/"; }
        prefixOk = absNormalized.indexOf(baseWithSep) === 0;
      } catch (_) { prefixOk = false; }
      if (!prefixOk) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }

      // Read file
      var raw = null;
      try { raw = $os.readFile(absNormalized); } catch (_) { raw = null; }
      if (!raw) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }

      // Convert to byte array
      var bytes = null;
      if (typeof raw === "string") {
        var arr = [];
        for (var si = 0; si < raw.length; si++) { arr.push(raw.charCodeAt(si) & 0xff); }
        bytes = arr;
      } else if (Array.isArray(raw)) {
        bytes = raw;
      } else {
        bytes = null;
      }
      if (!bytes || bytes.length === 0) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }
      if (bytes.length > MAX_AUDIO_BYTES) {
        return e.json(413, { code: "audio_too_large", message: "Audio exceeds limit." });
      }

      var fileSize = bytes.length;

      // Detect MIME type
      var contentType = "audio/mpeg";
      var lowerName = storedName.toLowerCase();
      if (lowerName.indexOf(".mp4") >= 0 || lowerName.indexOf(".m4a") >= 0) {
        contentType = "audio/mp4";
      } else if (lowerName.indexOf(".ogg") >= 0) {
        contentType = "audio/ogg";
      } else if (lowerName.indexOf(".webm") >= 0) {
        contentType = "audio/webm";
      }

      // === Parse Range header ===
      var rangeHeader = "";
      try { rangeHeader = String(e.request.header.get("Range") || ""); } catch (_) {}
      rangeHeader = rangeHeader.trim();

      var header = e.response.header();
      try {
        header.set("Accept-Ranges", "bytes");
        header.set("Content-Type", contentType);
        header.set("X-Content-Type-Options", "nosniff");
        header.set("Cache-Control", "private, no-store");
      } catch (_) {}

      if (rangeHeader && rangeHeader.indexOf("bytes=") === 0) {
        // RFC 7233 single-range parsing (premium audio): malformed units,
        // missing dashes, suffix "-0" and multi-range requests answer 416
        // instead of silently serving the whole file or the first range.
        // (Artwork is intentionally NOT a Range consumer: published
        // artwork is public, cacheable, full-content — see the artwork
        // policy in docs/PODCAST_DOMAIN.md.)
        var rangeVal = rangeHeader.substring(6).trim();
        var dashIdx = rangeVal.indexOf("-");
        var rangeStart;
        var rangeEnd;
        if (rangeVal.indexOf(",") >= 0 || dashIdx < 0) {
          try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
          return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
        }
        if (dashIdx === 0) {
          var suffixLen = parseInt(rangeVal.substring(1), 10);
          if (isNaN(suffixLen) || suffixLen <= 0) {
            try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
            return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
          }
          rangeStart = Math.max(0, fileSize - suffixLen);
          rangeEnd = fileSize - 1;
        } else {
          rangeStart = parseInt(rangeVal.substring(0, dashIdx), 10);
          if (isNaN(rangeStart) || rangeStart < 0) {
            try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
            return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
          }
          if (dashIdx + 1 < rangeVal.length) {
            rangeEnd = parseInt(rangeVal.substring(dashIdx + 1), 10);
            if (isNaN(rangeEnd)) {
              try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
              return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
            }
          } else {
            rangeEnd = fileSize - 1;
          }
        }
        if (rangeStart > rangeEnd || rangeStart >= fileSize) {
          try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
          return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
        }
        if (rangeEnd >= fileSize) rangeEnd = fileSize - 1;
        var chunkSize = rangeEnd - rangeStart + 1;
        var chunk = [];
        for (var bi = rangeStart; bi <= rangeEnd && bi < bytes.length; bi++) {
          chunk.push(bytes[bi]);
        }
        try {
          header.set("Content-Range", "bytes " + rangeStart + "-" + rangeEnd + "/" + fileSize);
          header.set("Content-Length", String(chunkSize));
        } catch (_) {}
        try { e.response.writeHeader(206); } catch (_) {}
        try { e.response.write(chunk); } catch (_) {}
        return e;
      }

      // No Range — full content
      try { header.set("Content-Length", String(fileSize)); } catch (_) {}
      try { e.response.write(bytes); } catch (_) {}
      return e;
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("lesson_routes: PREMIUM AUDIO error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  }
);

// =====================================================================
// GET /api/fast-english/artwork/{lessonId}
// Public Episode artwork (Podcast Slice 2).
//
// Artwork policy (docs/PODCAST_DOMAIN.md): Published Episode artwork is
// public and cacheable because it appears in Library discovery. Draft and
// archived artwork remains inaccessible (404). The route is public (no
// auth) but only serves bytes when the Variant, its Episode and its
// Category are all published.
//
// Resolution order (server-side, single source):
//   lesson.thumbnail_override -> topic.artwork_square -> Product fallback
// The fallback is a controlled, deterministic inline SVG asset — never a
// broken image. No artwork copy is stored per Variant.
//
//   GET /api/fast-english/artwork/{lessonId}/hero
// Optional wide presentation image (topic.hero_image_wide); 404 when the
// Episode has no wide image. Same published-state gating.
//
// The shared byte-serving helpers live in podcast_domain.pb.js (PB 0.39
// JSVM does not share top-level declarations with routerAdd closures).
// =====================================================================

routerAdd(
  "GET",
  "/api/fast-english/artwork/{lessonId}",
  function (e) {
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";

    // Per-IP rate limit. Buckets are keyed by the real client IP so one
    // caller cannot exhaust the budget for every user; the map is bounded
    // by evicting stale windows once it grows large.
    if (typeof globalThis.__fepArtwork === "undefined") { globalThis.__fepArtwork = {}; }
    var RATE_WIN = globalThis.__fepArtwork;
    var RATE_MAX = 60;
    var RATE_MS = 300000;

    var pd = null;
    try { pd = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd = null; }

    function checkRate() {
      var key = (pd && pd.clientIp) ? pd.clientIp(e) : "unknown";
      var now = Date.now(); var ws = now - RATE_MS;
      try {
        if (Object.keys(RATE_WIN).length >= 2048) {
          var keys = Object.keys(RATE_WIN);
          for (var ki = 0; ki < keys.length; ki++) {
            var w2 = RATE_WIN[keys[ki]];
            if (!w2 || !w2.length || w2[w2.length - 1] <= ws) delete RATE_WIN[keys[ki]];
          }
        }
      } catch (_) {}
      var win = RATE_WIN[key]; if (!win || !Array.isArray(win)) { win = []; RATE_WIN[key] = win; }
      var keep = []; for (var wi = 0; wi < win.length; wi++) { if (win[wi] > ws) keep.push(win[wi]); }
      win.length = 0; for (var wj = 0; wj < keep.length; wj++) win.push(keep[wj]);
      if (win.length >= RATE_MAX) { var retry = Math.ceil((win[0] + RATE_MS - now) / 1000); if (retry < 1) retry = 1; return { status: 429, body: { code: "rate_limited", message: "Too many requests." } }; }
      win.push(now);
      return null;
    }

    try {
      var rateErr = checkRate();
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      var lessonId = "";
      try { lessonId = String(e.request.pathValue("lessonId") || ""); } catch (_) {}
      if (!lessonId) return e.json(400, { code: "invalid_request", message: "Missing lessonId." });

      if (!pd || !pd.artworkCheckTopicPublished) return e.json(500, { code: "unexpected_error", message: "Internal error." });

      var lesson = null;
      try { lesson = $app.findRecordById(LESSONS_C, lessonId); } catch (_) {}
      if (!lesson) return e.json(404, { code: "not_found", message: "Not found." });
      if (String(lesson.get("status") || "") !== "published") {
        return e.json(404, { code: "not_found", message: "Not found." });
      }
      var topicId = "";
      try { topicId = String(lesson.get("topic") || ""); } catch (_) {}
      var topic = null;
      if (topicId) { try { topic = $app.findRecordById(TOPICS_C, topicId); } catch (_) {} }
      if (!pd.artworkCheckTopicPublished($app, topic)) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }

      // Resolution order: thumbnail_override -> artwork_square -> fallback.
      var storedName = String(lesson.get("thumbnail_override") || "");
      var serveRecord = lesson;
      if (!storedName) {
        storedName = String(topic.get("artwork_square") || "");
        serveRecord = topic;
      }
      return pd.serveArtworkBytes($app, e, serveRecord, storedName, pd.artworkContentType(storedName), pd.fallbackArtworkSvg());
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("lesson_routes: ARTWORK error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  }
);

routerAdd(
  "GET",
  "/api/fast-english/artwork/{lessonId}/hero",
  function (e) {
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";

    // Per-IP rate limit. Buckets are keyed by the real client IP so one
    // caller cannot exhaust the budget for every user; the map is bounded
    // by evicting stale windows once it grows large.
    if (typeof globalThis.__fepHeroArt === "undefined") { globalThis.__fepHeroArt = {}; }
    var RATE_WIN = globalThis.__fepHeroArt;
    var RATE_MAX = 60;
    var RATE_MS = 300000;

    var pd = null;
    try { pd = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd = null; }

    function checkRate() {
      var key = (pd && pd.clientIp) ? pd.clientIp(e) : "unknown";
      var now = Date.now(); var ws = now - RATE_MS;
      try {
        if (Object.keys(RATE_WIN).length >= 2048) {
          var keys = Object.keys(RATE_WIN);
          for (var ki = 0; ki < keys.length; ki++) {
            var w2 = RATE_WIN[keys[ki]];
            if (!w2 || !w2.length || w2[w2.length - 1] <= ws) delete RATE_WIN[keys[ki]];
          }
        }
      } catch (_) {}
      var win = RATE_WIN[key]; if (!win || !Array.isArray(win)) { win = []; RATE_WIN[key] = win; }
      var keep = []; for (var wi = 0; wi < win.length; wi++) { if (win[wi] > ws) keep.push(win[wi]); }
      win.length = 0; for (var wj = 0; wj < keep.length; wj++) win.push(keep[wj]);
      if (win.length >= RATE_MAX) { var retry = Math.ceil((win[0] + RATE_MS - now) / 1000); if (retry < 1) retry = 1; return { status: 429, body: { code: "rate_limited", message: "Too many requests." } }; }
      win.push(now);
      return null;
    }

    try {
      var rateErr = checkRate();
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      var lessonId = "";
      try { lessonId = String(e.request.pathValue("lessonId") || ""); } catch (_) {}
      if (!lessonId) return e.json(400, { code: "invalid_request", message: "Missing lessonId." });

      if (!pd || !pd.artworkCheckTopicPublished) return e.json(500, { code: "unexpected_error", message: "Internal error." });

      var lesson = null;
      try { lesson = $app.findRecordById(LESSONS_C, lessonId); } catch (_) {}
      if (!lesson) return e.json(404, { code: "not_found", message: "Not found." });
      if (String(lesson.get("status") || "") !== "published") {
        return e.json(404, { code: "not_found", message: "Not found." });
      }
      var topicId = "";
      try { topicId = String(lesson.get("topic") || ""); } catch (_) {}
      var topic = null;
      if (topicId) { try { topic = $app.findRecordById(TOPICS_C, topicId); } catch (_) {} }
      if (!pd.artworkCheckTopicPublished($app, topic)) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }

      var heroName = String(topic.get("hero_image_wide") || "");
      if (!heroName) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }
      return pd.serveArtworkBytes($app, e, topic, heroName, pd.artworkContentType(heroName), null);
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("lesson_routes: HERO error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  }
);

// =====================================================================
// GET /api/fast-english/lessons/{lessonId}/vocabulary
// Slice 7 — per-Variant Student vocabulary (key words).
//   - Requires full premium entitlement + published Variant/Episode/
//     Category (same contract as lesson detail).
//   - Ordered by the authoritative sort_order; sanitized items only —
//     no normalized_term, no internal/staff fields, no raw file names.
//   - pronunciation is a controlled proxy path (or null) — the proxy
//     re-checks entitlement at request time.
//   - Cache-Control: private, no-store
// =====================================================================

routerAdd(
  "GET",
  "/api/fast-english/lessons/{lessonId}/vocabulary",
  function (e) {
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";
    var USERS_C = "fep_users";
    var SUBS_C = "subscriptions";
    var VOCAB_C = "lesson_vocabulary";

    // Inline per-user rate limit (same window shape as the detail route).
    // The map is bounded with the repository's stale-entry eviction
    // pattern: once it grows large, windows whose newest entry has left
    // the window are deleted instead of accumulating forever.
    if (typeof globalThis.__fepLessonVocab === "undefined") { globalThis.__fepLessonVocab = {}; }
    var RATE_WIN = globalThis.__fepLessonVocab;
    var RATE_MAX = 30;
    var RATE_MS = 300000;

    function checkRate(uid) {
      if (!uid) return null;
      var now = Date.now(); var ws = now - RATE_MS;
      try {
        if (Object.keys(RATE_WIN).length >= 2048) {
          var keys = Object.keys(RATE_WIN);
          for (var ki = 0; ki < keys.length; ki++) {
            var w2 = RATE_WIN[keys[ki]];
            if (!w2 || !w2.length || w2[w2.length - 1] <= ws) delete RATE_WIN[keys[ki]];
          }
        }
      } catch (_) {}
      var b = RATE_WIN[uid]; if (!b || !Array.isArray(b)) { b = []; RATE_WIN[uid] = b; }
      var keep = []; for (var wi = 0; wi < b.length; wi++) { if (b[wi] > ws) keep.push(b[wi]); }
      b.length = 0; for (var wj = 0; wj < keep.length; wj++) b.push(keep[wj]);
      if (b.length >= RATE_MAX) { var retry = Math.ceil((b[0] + RATE_MS - now) / 1000); if (retry < 1) retry = 1; return { status: 429, body: { code: "rate_limited", message: "Too many requests." } }; }
      b.push(now);
      return null;
    }

    try {
      // Full entitlement check (inlined — identical to lesson detail).
      var entitlementErr = null;
      if (!e.auth || !e.auth.id) {
        entitlementErr = { status: 401, body: { code: "auth_required", message: "Authentication required." } };
      } else {
        var uid = String(e.auth.id || "");
        var student = null;
        try { student = $app.findRecordById(USERS_C, uid); } catch (_) {}
        if (!student) {
          entitlementErr = { status: 401, body: { code: "user_not_found", message: "User not found." } };
        } else {
          var g = null;
          try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
          var guardErr = (g && g.requireStudent) ? g.requireStudent(e) : { status: 500, code: "unexpected_error", message: "Internal error." };
          if (guardErr) {
            entitlementErr = { status: guardErr.status, body: { code: guardErr.code, message: guardErr.message } };
          } else {
            var acct = String(student.get("account_status") || "");
            if (acct === "suspended") {
              entitlementErr = { status: 403, body: { code: "account_suspended", message: "Account is suspended." } };
            } else if (acct !== "active") {
              entitlementErr = { status: 403, body: { code: "subscription_required", message: "Active subscription required." } };
            } else {
              var pc = Boolean(student.get("placement_completed"));
              var selLvl = String(student.get("selected_level") || "");
              if (!pc || !selLvl) {
                entitlementErr = { status: 403, body: { code: "placement_incomplete", message: "Placement must be completed first." } };
              } else {
                var nowMs = Date.now();
                var hasSub = false;
                try {
                  var subs = $app.findRecordsByFilter(SUBS_C, "user = {:uid} && status = 'active'", "", 0, 0, { uid: uid });
                  for (var si = 0; si < subs.length; si++) {
                    var s = subs[si];
                    var expStr = String(s.get("expires_at") || "");
                    var startStr = String(s.get("starts_at") || "");
                    if (!expStr || !startStr) continue;
                    var expMs = new Date(expStr).getTime();
                    var startMs = new Date(startStr).getTime();
                    if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) {
                      hasSub = true;
                      break;
                    }
                  }
                } catch (_) {}
                if (!hasSub) {
                  entitlementErr = { status: 403, body: { code: "subscription_required", message: "Active subscription required." } };
                }
              }
            }
          }
        }
      }
      if (entitlementErr) return e.json(entitlementErr.status, entitlementErr.body);

      var uid = String(e.auth.id || "");
      var pd = null;
      try { pd = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd = null; }
      if (!pd) return e.json(500, { code: "unexpected_error", message: "Internal error." });

      var rateErr = checkRate(uid);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      var lessonId = "";
      try { lessonId = String(e.request.pathValue("lessonId") || ""); } catch (_) {}
      if (!lessonId) return e.json(400, { code: "invalid_request", message: "Missing lessonId." });

      var lesson = null;
      try { lesson = $app.findRecordById(LESSONS_C, lessonId); } catch (_) {}
      if (!lesson) return e.json(404, { code: "not_found", message: "Lesson not found." });
      if (String(lesson.get("status") || "") !== "published") {
        return e.json(404, { code: "not_found", message: "Lesson not found." });
      }
      var topicId = "";
      try { topicId = String(lesson.get("topic") || ""); } catch (_) {}
      var topicPublished = false;
      if (topicId) {
        try {
          var tRec = $app.findRecordById(TOPICS_C, topicId);
          if (tRec && tRec.get("status") === "published") {
            var catRes = pd.requirePublishedCategory($app, tRec.get("category"));
            if (catRes.ok) topicPublished = true;
          }
        } catch (_) {}
      }
      if (!topicPublished) {
        return e.json(404, { code: "not_found", message: "Lesson not found." });
      }

      // Authoritative ordering by sort_order (tie-break: stable by id).
      var rows = [];
      try {
        rows = $app.findRecordsByFilter(VOCAB_C, "lesson = {:lid}", "", 0, 0, { lid: String(lesson.id || "") });
      } catch (_) {}
      var items = [];
      var sortable = [];
      if (rows && rows.length > 0) {
        for (var ri = 0; ri < rows.length; ri++) {
          var v = rows[ri];
          if (!v) continue;
          sortable.push(v);
        }
        sortable.sort(function (a, b) {
          var sa = Number(a.get("sort_order") || 0);
          var sb = Number(b.get("sort_order") || 0);
          if (sa !== sb) return sa - sb;
          return String(a.id || "") < String(b.id || "") ? -1 : 1;
        });
      }
      function pronMime(storedName) {
        var lower = String(storedName || "").toLowerCase();
        if (lower.indexOf(".m4a") >= 0 || lower.indexOf(".mp4") >= 0) return "audio/mp4";
        return "audio/mpeg";
      }
      for (var vi = 0; vi < sortable.length; vi++) {
        var rec = sortable[vi];
        var pronFile = "";
        try { pronFile = String(rec.get("pronunciation_audio") || ""); } catch (_) {}
        items.push({
          id: String(rec.id || ""),
          term: String(rec.get("term") || ""),
          phonetic: String(rec.get("phonetic") || ""),
          partOfSpeech: String(rec.get("part_of_speech") || ""),
          meaningFa: String(rec.get("meaning_fa") || ""),
          definitionEn: String(rec.get("definition_en") || ""),
          exampleSentence: String(rec.get("example_sentence") || ""),
          pronunciation: pronFile
            ? { url: "/api/fast-english/vocabulary/" + String(rec.id || "") + "/pronunciation", contentType: pronMime(pronFile) }
            : null,
        });
      }

      try { e.response.header().set("Cache-Control", "private, no-store"); } catch (_) {}
      try { e.response.header().set("Pragma", "no-cache"); } catch (_) {}

      return e.json(200, { items: items, total: items.length });
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("lesson_routes: VOCAB error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("fep_users")
);

// =====================================================================
// GET /api/fast-english/vocabulary/{vocabId}/pronunciation
// Slice 7 — protected pronunciation audio for one vocabulary entry.
//   - Same auth modes as the premium Episode audio proxy: Bearer token
//     or ?token=<file_token> (for <audio> elements).
//   - Live entitlement re-validation on EVERY request + the vocabulary
//     entry's parent Variant must be published with a published Episode
//     and a published parent Category.
//   - Range/206 support; private, no-store; nosniff; 2 MB cap (the
//     upload bound for pronunciation files).
// =====================================================================

routerAdd(
  "GET",
  "/api/fast-english/vocabulary/{vocabId}/pronunciation",
  function (e) {
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";
    var USERS_C = "fep_users";
    var SUBS_C = "subscriptions";
    var VOCAB_C = "lesson_vocabulary";
    var MAX_PRON_BYTES = 2 * 1024 * 1024;

    // Inline per-user rate limit, bounded with the repository's
    // stale-entry eviction pattern (see the vocabulary route).
    if (typeof globalThis.__fepPronAudio === "undefined") { globalThis.__fepPronAudio = {}; }
    var RATE_WIN = globalThis.__fepPronAudio;
    var RATE_MAX = 30;
    var RATE_MS = 300000;

    function checkRate(uid) {
      if (!uid) return null;
      var now = Date.now(); var ws = now - RATE_MS;
      try {
        if (Object.keys(RATE_WIN).length >= 2048) {
          var keys = Object.keys(RATE_WIN);
          for (var ki = 0; ki < keys.length; ki++) {
            var w2 = RATE_WIN[keys[ki]];
            if (!w2 || !w2.length || w2[w2.length - 1] <= ws) delete RATE_WIN[keys[ki]];
          }
        }
      } catch (_) {}
      var b = RATE_WIN[uid]; if (!b || !Array.isArray(b)) { b = []; RATE_WIN[uid] = b; }
      var keep = []; for (var wi = 0; wi < b.length; wi++) { if (b[wi] > ws) keep.push(b[wi]); }
      b.length = 0; for (var wj = 0; wj < keep.length; wj++) b.push(keep[wj]);
      if (b.length >= RATE_MAX) { var retry = Math.ceil((b[0] + RATE_MS - now) / 1000); if (retry < 1) retry = 1; return { status: 429, body: { code: "rate_limited", message: "Too many requests." } }; }
      b.push(now);
      return null;
    }

    try {
      // === Manual auth resolution (Bearer or file token) ===
      var student = null;
      var uid = "";
      var authHdr = "";
      try { authHdr = String(e.request.header.get("Authorization") || ""); } catch (_) {}
      if (authHdr && authHdr.indexOf("Bearer ") === 0) {
        var bearerToken = authHdr.substring(7);
        if (bearerToken) {
          try {
            var authRec = $app.findAuthRecordByToken(bearerToken, "auth");
            if (authRec) {
              uid = String(authRec.id || "");
              if (uid) { try { student = $app.findRecordById(USERS_C, uid); } catch (_) {} }
            }
          } catch (_) {}
        }
      }
      if (!student) {
        try {
          var qToken = String(e.request.url.query().get("token") || "");
          if (qToken) {
            try {
              var fileRec = $app.findAuthRecordByToken(qToken, "file");
              if (fileRec) {
                uid = String(fileRec.id || "");
                if (uid) { try { student = $app.findRecordById(USERS_C, uid); } catch (_) {} }
              }
            } catch (_) {}
          }
        } catch (_) {}
      }
      if (!student) {
        // A Bearer token can also belong to a staff account — PB resolves
        // it into e.auth (same mechanism the shared guard uses). Deny by
        // role (403), not as an unknown principal (401).
        var staffColl = "";
        try {
          var ea = e.auth;
          if (ea) {
            var c2 = ea.collection();
            if (c2 && c2.name) staffColl = String(c2.name);
          }
        } catch (_) { staffColl = ""; }
        if (staffColl === "staff_admins") {
          return e.json(403, { code: "access_denied", message: "Access denied." });
        }
        return e.json(401, { code: "auth_required", message: "Authentication required." });
      }
      var role = String(student.get("role") || "");
      if (role !== "student") {
        return e.json(403, { code: "access_denied", message: "Access denied." });
      }
      var acct = String(student.get("account_status") || "");
      if (acct === "suspended") {
        return e.json(403, { code: "account_suspended", message: "Account is suspended." });
      } else if (acct !== "active") {
        return e.json(403, { code: "subscription_required", message: "Active subscription required." });
      }
      var pc = Boolean(student.get("placement_completed"));
      var selLvl = String(student.get("selected_level") || "");
      if (!pc || !selLvl) {
        return e.json(403, { code: "placement_incomplete", message: "Placement must be completed first." });
      }
      var nowMs = Date.now();
      var hasSub = false;
      try {
        var subs = $app.findRecordsByFilter(SUBS_C, "user = {:uid} && status = 'active'", "", 0, 0, { uid: uid });
        for (var si = 0; si < subs.length; si++) {
          var s = subs[si];
          var expStr = String(s.get("expires_at") || "");
          var startStr = String(s.get("starts_at") || "");
          if (!expStr || !startStr) continue;
          var expMs = new Date(expStr).getTime();
          var startMs = new Date(startStr).getTime();
          if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) {
            hasSub = true;
            break;
          }
        }
      } catch (_) {}
      if (!hasSub) {
        return e.json(403, { code: "subscription_required", message: "Active subscription required." });
      }

      var rateErr = checkRate(uid);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      var vocabId = "";
      try { vocabId = String(e.request.pathValue("vocabId") || ""); } catch (_) {}
      if (!vocabId) return e.json(400, { code: "invalid_request", message: "Missing vocabId." });

      var vocabRec = null;
      try { vocabRec = $app.findRecordById(VOCAB_C, vocabId); } catch (_) {}
      if (!vocabRec) return e.json(404, { code: "not_found", message: "Not found." });

      // Parent Variant published + published Episode + published Category.
      var parentLessonId = "";
      try { parentLessonId = String(vocabRec.get("lesson") || ""); } catch (_) {}
      if (!parentLessonId) return e.json(404, { code: "not_found", message: "Not found." });
      var lesson = null;
      try { lesson = $app.findRecordById(LESSONS_C, parentLessonId); } catch (_) {}
      if (!lesson || String(lesson.get("status") || "") !== "published") {
        return e.json(404, { code: "not_found", message: "Not found." });
      }
      var topicId = "";
      try { topicId = String(lesson.get("topic") || ""); } catch (_) {}
      var topicPublished = false;
      if (topicId) {
        try {
          var tRec = $app.findRecordById(TOPICS_C, topicId);
          if (tRec && tRec.get("status") === "published") {
            var pdCat = null;
            try { pdCat = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pdCat = null; }
            if (pdCat) {
              var catRes = pdCat.requirePublishedCategory($app, tRec.get("category"));
              if (catRes.ok) topicPublished = true;
            }
          }
        } catch (_) {}
      }
      if (!topicPublished) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }

      var storedName = "";
      try { storedName = String(vocabRec.get("pronunciation_audio") || ""); } catch (_) {}
      if (!storedName) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }

      var dataDir = "";
      try { dataDir = String($app.dataDir() || ""); } catch (_) {}
      var basePath = "";
      try { basePath = String(vocabRec.baseFilesPath() || ""); } catch (_) {}
      if (!dataDir || !basePath) {
        return e.json(500, { code: "unexpected_error", message: "Internal error." });
      }
      var absPath = "";
      try { absPath = $filepath.join(dataDir, "storage", basePath, storedName); } catch (_) {}
      if (!absPath) {
        return e.json(500, { code: "unexpected_error", message: "Internal error." });
      }
      var baseNormalized = "";
      try { baseNormalized = $filepath.clean($filepath.join(dataDir, "storage", basePath)); } catch (_) {}
      var absNormalized = "";
      try { absNormalized = $filepath.clean(absPath); } catch (_) {}
      var prefixOk = false;
      try {
        var baseWithSep = baseNormalized;
        var lastCh = baseWithSep.charAt(baseWithSep.length - 1);
        if (lastCh !== "/" && lastCh !== "\\") { baseWithSep = baseWithSep + "/"; }
        prefixOk = absNormalized.indexOf(baseWithSep) === 0;
      } catch (_) { prefixOk = false; }
      if (!prefixOk) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }

      var raw = null;
      try { raw = $os.readFile(absNormalized); } catch (_) { raw = null; }
      if (!raw) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }
      var bytes = null;
      if (typeof raw === "string") {
        var arr = [];
        for (var si2 = 0; si2 < raw.length; si2++) { arr.push(raw.charCodeAt(si2) & 0xff); }
        bytes = arr;
      } else if (Array.isArray(raw)) {
        bytes = raw;
      } else {
        bytes = null;
      }
      if (!bytes || bytes.length === 0) {
        return e.json(404, { code: "not_found", message: "Not found." });
      }
      if (bytes.length > MAX_PRON_BYTES) {
        return e.json(413, { code: "audio_too_large", message: "Audio exceeds limit." });
      }
      var fileSize = bytes.length;

      var contentType = "audio/mpeg";
      var lowerName = storedName.toLowerCase();
      if (lowerName.indexOf(".m4a") >= 0 || lowerName.indexOf(".mp4") >= 0) {
        contentType = "audio/mp4";
      }

      var rangeHeader = "";
      try { rangeHeader = String(e.request.header.get("Range") || ""); } catch (_) {}
      rangeHeader = rangeHeader.trim();

      var header = e.response.header();
      try {
        header.set("Accept-Ranges", "bytes");
        header.set("Content-Type", contentType);
        header.set("X-Content-Type-Options", "nosniff");
        header.set("Cache-Control", "private, no-store");
        header.set("Pragma", "no-cache");
      } catch (_) {}

      if (rangeHeader && rangeHeader.indexOf("bytes=") === 0) {
        // RFC 7233 single-range parsing (pronunciation): malformed units,
        // missing dashes, suffix "-0" and multi-range requests answer 416
        // instead of silently serving the whole file or the first range.
        var rangeVal = rangeHeader.substring(6).trim();
        var dashIdx = rangeVal.indexOf("-");
        var rangeStart;
        var rangeEnd;
        if (rangeVal.indexOf(",") >= 0 || dashIdx < 0) {
          try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
          return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
        }
        if (dashIdx === 0) {
          var suffixLen = parseInt(rangeVal.substring(1), 10);
          if (isNaN(suffixLen) || suffixLen <= 0) {
            try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
            return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
          }
          rangeStart = Math.max(0, fileSize - suffixLen);
          rangeEnd = fileSize - 1;
        } else {
          rangeStart = parseInt(rangeVal.substring(0, dashIdx), 10);
          if (isNaN(rangeStart) || rangeStart < 0) {
            try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
            return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
          }
          if (dashIdx + 1 < rangeVal.length) {
            rangeEnd = parseInt(rangeVal.substring(dashIdx + 1), 10);
            if (isNaN(rangeEnd)) {
              try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
              return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
            }
          } else {
            rangeEnd = fileSize - 1;
          }
        }
        if (rangeStart > rangeEnd || rangeStart >= fileSize) {
          try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
          return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
        }
        if (rangeEnd >= fileSize) rangeEnd = fileSize - 1;
        var chunkSize = rangeEnd - rangeStart + 1;
        var chunk = [];
        for (var bi = rangeStart; bi <= rangeEnd && bi < bytes.length; bi++) {
          chunk.push(bytes[bi]);
        }
        try {
          header.set("Content-Range", "bytes " + rangeStart + "-" + rangeEnd + "/" + fileSize);
          header.set("Content-Length", String(chunkSize));
        } catch (_) {}
        try { e.response.writeHeader(206); } catch (_) {}
        try { e.response.write(chunk); } catch (_) {}
        return e;
      }

      try { header.set("Content-Length", String(fileSize)); } catch (_) {}
      try { e.response.write(bytes); } catch (_) {}
      return e;
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("lesson_routes: PRON error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  }
);
