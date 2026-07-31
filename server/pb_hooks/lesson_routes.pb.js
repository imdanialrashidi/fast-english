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
    function shapeLessonListItem(rec) {
      if (!rec) return null;
      var topicId = "";
      try { topicId = String(rec.get("topic") || ""); } catch (_) {}
      var topicTitle = "";
      var topicSlug = "";
      if (topicId) {
        try {
          var t = $app.findRecordById(TOPICS_C, topicId);
          if (t) {
            topicTitle = String(t.get("title") || "");
            topicSlug = String(t.get("slug") || "");
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
          var role = String(student.get("role") || "");
          if (role !== "student") {
            entitlementErr = { status: 403, body: { code: "access_denied", message: "Access denied." } };
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
                  var sub = $app.findFirstRecordByFilter(SUBS_C, "user = {:uid} && status = 'active'", { uid: uid });
                  if (sub) {
                    var expStr = String(sub.get("expires_at") || "");
                    var startStr = String(sub.get("starts_at") || "");
                    if (expStr && startStr) {
                      var expMs = new Date(expStr).getTime();
                      var startMs = new Date(startStr).getTime();
                      if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) {
                        hasSub = true;
                      }
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

      // Get selected level from live user
      var student = null;
      try { student = $app.findRecordById(USERS_C, uid); } catch (_) {}
      if (!student) return e.json(401, { code: "user_not_found", message: "User not found." });
      var selLvl = String(student.get("selected_level") || "");
      if (!selLvl) return e.json(403, { code: "no_level", message: "No level selected." });

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

      // Find published lessons for the student's level, ordered by topic sort_order then published_at
      var lessons = [];
      var totalItems = 0;
      try {
        // First count
        var countHits = $app.findRecordsByFilter(
          LESSONS_C,
          "level = {:lvl} && status = 'published'",
          "",
          0,
          0,
          { lvl: selLvl }
        );
        totalItems = countHits ? countHits.length : 0;

        // Paginated fetch — ordered by created desc (stable sort)
        var skip = (page - 1) * perPage;
        lessons = $app.findRecordsByFilter(
          LESSONS_C,
          "level = {:lvl} && status = 'published'",
          "-published_at",
          perPage,
          skip,
          { lvl: selLvl }
        );
      } catch (qe) {}

      // Filter to only those with published topics
      var filtered = [];
      for (var li = 0; li < (lessons ? lessons.length : 0); li++) {
        var lesson = lessons[li];
        if (!lesson) continue;
        var tId = "";
        try { tId = String(lesson.get("topic") || ""); } catch (_) {}
        var topicPublished = false;
        if (tId) {
          try {
            var tRec = $app.findRecordById(TOPICS_C, tId);
            if (tRec && tRec.get("status") === "published") topicPublished = true;
          } catch (_) {}
        }
        if (topicPublished) {
          filtered.push(shapeLessonListItem(lesson));
        }
      }

      try { e.response.header().set("Cache-Control", "private, no-store"); } catch (_) {}
      try { e.response.header().set("Pragma", "no-cache"); } catch (_) {}

      return e.json(200, {
        lessons: filtered,
        page: page,
        perPage: perPage,
        totalItems: totalItems,
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
          var role = String(student.get("role") || "");
          if (role !== "student") {
            entitlementErr = { status: 403, body: { code: "access_denied", message: "Access denied." } };
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
                  var sub = $app.findFirstRecordByFilter(SUBS_C, "user = {:uid} && status = 'active'", { uid: uid });
                  if (sub) {
                    var expStr = String(sub.get("expires_at") || "");
                    var startStr = String(sub.get("starts_at") || "");
                    if (expStr && startStr) {
                      var expMs = new Date(expStr).getTime();
                      var startMs = new Date(startStr).getTime();
                      if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) {
                        hasSub = true;
                      }
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

      // Get selected level from live user
      var student = null;
      try { student = $app.findRecordById(USERS_C, uid); } catch (_) {}
      if (!student) return e.json(401, { code: "user_not_found", message: "User not found." });
      var selLvl = String(student.get("selected_level") || "");
      if (!selLvl) return e.json(403, { code: "no_level", message: "No level selected." });

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

      // Verify it's published and matches the student's level
      var lessonLevel = String(lesson.get("level") || "");
      var lessonStatus = String(lesson.get("status") || "");
      if (lessonStatus !== "published" || lessonLevel !== selLvl) {
        return e.json(404, { code: "not_found", message: "Lesson not found." });
      }

      // Verify topic is published
      var topicId = "";
      try { topicId = String(lesson.get("topic") || ""); } catch (_) {}
      var topicPublished = false;
      var topicTitle = "";
      var topicSlug = "";
      if (topicId) {
        try {
          var tRec = $app.findRecordById(TOPICS_C, topicId);
          if (tRec) {
            topicTitle = String(tRec.get("title") || "");
            topicSlug = String(tRec.get("slug") || "");
            if (tRec.get("status") === "published") topicPublished = true;
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

      // Verify topic is published
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
            if (tRec.get("status") === "published") topicPublished = true;
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
        // Parse range
        var rangeVal = rangeHeader.substring(6);
        var dashIdx = rangeVal.indexOf("-");
        var rangeStart = 0;
        var rangeEnd = fileSize - 1;

        if (dashIdx > 0) {
          rangeStart = parseInt(rangeVal.substring(0, dashIdx), 10);
          if (dashIdx + 1 < rangeVal.length) {
            var re = parseInt(rangeVal.substring(dashIdx + 1), 10);
            if (!isNaN(re)) rangeEnd = re;
          }
        } else if (dashIdx === 0) {
          // suffix range: -N → last N bytes
          var suffixLen = parseInt(rangeVal.substring(1), 10);
          if (!isNaN(suffixLen) && suffixLen > 0) {
            rangeStart = Math.max(0, fileSize - suffixLen);
          }
        }

        // Validate
        if (isNaN(rangeStart)) rangeStart = 0;
        if (isNaN(rangeEnd)) rangeEnd = fileSize - 1;
        if (rangeStart > rangeEnd || rangeStart >= fileSize) {
          try {
            header.set("Content-Range", "bytes */" + fileSize);
          } catch (_) {}
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

        try {
          e.response.writeHeader(206);
        } catch (_) {}

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

      // Role check
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
        var sub = $app.findFirstRecordByFilter(SUBS_C, "user = {:uid} && status = 'active'", { uid: uid });
        if (sub) {
          var expStr = String(sub.get("expires_at") || "");
          var startStr = String(sub.get("starts_at") || "");
          if (expStr && startStr) {
            var expMs = new Date(expStr).getTime();
            var startMs = new Date(startStr).getTime();
            if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) {
              hasSub = true;
            }
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

      // Level match
      var lessonLevel = String(lesson.get("level") || "");
      if (lessonLevel !== selLvl) {
        return e.json(404, { code: "not_found", message: "Lesson not found." });
      }

      // Lesson status
      var lessonStatus = String(lesson.get("status") || "");
      if (lessonStatus !== "published") {
        return e.json(404, { code: "not_found", message: "Lesson not found." });
      }

      // Topic published check
      var topicId = "";
      try { topicId = String(lesson.get("topic") || ""); } catch (_) {}
      var topicPublished = false;
      if (topicId) {
        try {
          var tRec = $app.findRecordById(TOPICS_C, topicId);
          if (tRec && tRec.get("status") === "published") topicPublished = true;
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
        var rangeVal = rangeHeader.substring(6);
        var dashIdx = rangeVal.indexOf("-");
        var rangeStart = 0;
        var rangeEnd = fileSize - 1;

        if (dashIdx > 0) {
          rangeStart = parseInt(rangeVal.substring(0, dashIdx), 10);
          if (dashIdx + 1 < rangeVal.length) {
            var re = parseInt(rangeVal.substring(dashIdx + 1), 10);
            if (!isNaN(re)) rangeEnd = re;
          }
        } else if (dashIdx === 0) {
          var suffixLen = parseInt(rangeVal.substring(1), 10);
          if (!isNaN(suffixLen) && suffixLen > 0) {
            rangeStart = Math.max(0, fileSize - suffixLen);
          }
        }

        if (isNaN(rangeStart)) rangeStart = 0;
        if (isNaN(rangeEnd)) rangeEnd = fileSize - 1;
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
