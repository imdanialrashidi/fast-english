// server/pb_hooks/progress_routes.pb.js
// P3-S2 Closure — Lesson progress custom routes.
//
// CRITICAL: PocketBase 0.39 JSVM recompiles the routerAdd handler in
// the executor's scope, so it CANNOT see top-level var declarations
// or function declarations. Every helper and constant must be inlined
// into each closure body.
//
// P3-S2 Closure changes:
//   - PUT accepts only { positionSeconds, expectedRevision }.
//   - positionSeconds 0 is rejected with 400 invalid_position on create
//     AND update (PB required NumberFields reject 0 on save; 0 means
//     "not started" and is never stored). On update, a stale revision
//     (409) is reported before the 0 rejection.
//   - Duration is always server-authoritative (from Lesson.audio_duration_seconds).
//   - All mutations run inside $app.runInTransaction.
//   - Strict numeric validation (rejects null, strings, booleans, arrays, objects).
//   - Completion = monotonic, server-calculated via authoritative duration × 0.9.
//
// Routes:
//   GET  /api/fast-english/lessons/{lessonId}/progress
//   PUT  /api/fast-english/lessons/{lessonId}/progress
//   GET  /api/fast-english/progress/summary
//   GET  /api/fast-english/progress/continue

try {
  $app.logger().info("progress_routes: hook file loaded");
} catch (_) {}

// =====================================================================
// GET /api/fast-english/lessons/{lessonId}/progress
// Read the authenticated student's progress for a specific lesson.
// =====================================================================

routerAdd(
  "GET",
  "/api/fast-english/lessons/{lessonId}/progress",
  function (e) {
    var USERS_C = "fep_users";
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";
    var SUBS_C = "subscriptions";
    var PROGRESS_C = "lesson_progress";
    var rl = require(__hooks + '/rate_limit.pb.js');

    try {
      // Full entitlement check (inlined)
      var entitlementErr = null;
      var uid = "";
      var selLvl = "";
      if (!e.auth || !e.auth.id) {
        entitlementErr = { status: 401, body: { code: "auth_required", message: "Authentication required." } };
      } else {
        uid = String(e.auth.id || "");
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
              selLvl = String(student.get("selected_level") || "");
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

      // Parse lessonId from path
      var lessonId = "";
      try { lessonId = String(e.request.pathValue("lessonId") || ""); } catch (_) {}
      if (!lessonId) return e.json(400, { code: "invalid_request", message: "Missing lessonId." });

      // Rate limit
      var rateErr = rl.checkRate(rl.window("__fepProgRead"), uid, 30, 300000);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      // Load lesson and verify published (cross-level: no level equality
      // check — an entitled Student may track progress on any Published
      // Variant, A1–C2).
      var lesson = null;
      try { lesson = $app.findRecordById(LESSONS_C, lessonId); } catch (_) {}
      if (!lesson) return e.json(404, { code: "not_found", message: "Lesson not found." });

      var lessonStatus = String(lesson.get("status") || "");
      if (lessonStatus !== "published") {
        return e.json(404, { code: "not_found", message: "Lesson not found." });
      }

      // Verify topic is published AND its parent Category is published
      // (Category archival hides all child content but retains Progress).
      var topicId = "";
      try { topicId = String(lesson.get("topic") || ""); } catch (_) {}
      var topicPublished = false;
      if (topicId) {
        try {
          var tRec = $app.findRecordById(TOPICS_C, topicId);
          if (tRec && tRec.get("status") === "published") {
            var pdG = null;
            try { pdG = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pdG = null; }
            if (pdG) {
              var catG = pdG.requirePublishedCategory($app, tRec.get("category"));
              if (catG.ok) topicPublished = true;
            }
          }
        } catch (_) {}
      }
      if (!topicPublished) {
        return e.json(404, { code: "not_found", message: "Lesson not found." });
      }

      // Server-authoritative duration: priority is lesson.audio_duration_seconds,
      // fallback to estimated_minutes * 60 for backward compatibility.
      var authoritativeDuration = Number(lesson.get("audio_duration_seconds") || 0);
      if (!(authoritativeDuration > 0)) {
        authoritativeDuration = Number(lesson.get("estimated_minutes") || 0) * 60;
      }

      // Find existing progress record
      var progress = null;
      try {
        var hits = $app.findRecordsByFilter(PROGRESS_C, "user = {:uid} && lesson = {:lid}", "", 1, 0, { uid: uid, lid: lessonId });
        if (hits && hits.length > 0) progress = hits[0];
      } catch (_) {}

      if (!progress) {
        // No progress yet — return default empty state with authoritative duration
        try { e.response.header().set("Cache-Control", "private, no-store"); } catch (_) {}
        try { e.response.header().set("Pragma", "no-cache"); } catch (_) {}
        return e.json(200, {
          lessonId: lessonId,
          positionSeconds: 0,
          furthestSeconds: 0,
          durationSeconds: authoritativeDuration,
          percent: 0,
          completed: false,
          completedAt: null,
          revision: 0,
          lastPlayedAt: null,
          audioDurationSeconds: authoritativeDuration,
        });
      }

      // Use stored duration if valid, otherwise authoritative
      var dur = Number(progress.get("duration_seconds") || 0);
      if (!(dur > 0)) dur = authoritativeDuration;

      var pos = Number(progress.get("position_seconds") || 0);
      var furthest = Number(progress.get("furthest_seconds") || 0);
      var completed = Boolean(progress.get("completed"));
      var completedAt = progress.get("completed_at") || null;
      var revision = Number(progress.get("revision") || 0);
      var lastPlayedAt = progress.get("last_played_at") || null;
      var percent = dur > 0 ? Math.round((furthest / dur) * 100) : 0;

      try { e.response.header().set("Cache-Control", "private, no-store"); } catch (_) {}
      try { e.response.header().set("Pragma", "no-cache"); } catch (_) {}

      return e.json(200, {
        lessonId: lessonId,
        positionSeconds: pos,
        furthestSeconds: furthest,
        durationSeconds: dur,
        percent: percent,
        completed: completed,
        completedAt: completedAt,
        revision: revision,
        lastPlayedAt: lastPlayedAt,
        audioDurationSeconds: authoritativeDuration,
      });
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("progress_routes: GET error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("fep_users")
);

// =====================================================================
// PUT /api/fast-english/lessons/{lessonId}/progress
// Save the authenticated student's progress for a specific lesson.
//
// P3-S2 Closure contract:
//   Accepts ONLY: { positionSeconds, expectedRevision }
//   Duration is ALWAYS server-authoritative from Lesson.audio_duration_seconds.
//   Strict numeric validation (rejects null, strings, booleans, arrays, objects).
//   All mutations run inside $app.runInTransaction for atomicity.
//   Completion = monotonic: completed || (furthest >= authoritativeDuration * 0.9).
//   Concurrent updates with same revision return 409 (stale).
// =====================================================================

routerAdd(
  "PUT",
  "/api/fast-english/lessons/{lessonId}/progress",
  function (e) {
    var USERS_C = "fep_users";
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";
    var SUBS_C = "subscriptions";
    var PROGRESS_C = "lesson_progress";
    var COMPLETION_THRESHOLD = 0.9; // 90%
    var POSITION_TOLERANCE = 2; // seconds — clamp minor floating-point overshoot
    var rl = require(__hooks + '/rate_limit.pb.js');

    try {
      // Parse lessonId
      var lessonId = "";
      try { lessonId = String(e.request.pathValue("lessonId") || ""); } catch (_) {}
      if (!lessonId) return e.json(400, { code: "invalid_request", message: "Missing lessonId." });

      // Parse request body
      var bodyStr = "";
      try { bodyStr = readerToString(e.request.body); } catch (_) {}
      var body = null;
      try { body = JSON.parse(bodyStr); } catch (_) {}
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return e.json(400, { code: "invalid_request", message: "Invalid request body." });
      }

      // Validate allowed fields ONLY (positionSeconds, expectedRevision)
      var allowedKeys = { positionSeconds: true, expectedRevision: true };
      for (var bk in body) {
        if (Object.prototype.hasOwnProperty.call(body, bk) && !allowedKeys[bk]) {
          return e.json(400, { code: "invalid_request", message: "Unexpected field: " + bk });
        }
      }

      // ---- STRICT numeric validation ----
      // Reject if positionSeconds is not present
      if (!Object.prototype.hasOwnProperty.call(body, "positionSeconds")) {
        return e.json(400, { code: "invalid_request", message: "Missing required field: positionSeconds." });
      }
      if (!Object.prototype.hasOwnProperty.call(body, "expectedRevision")) {
        return e.json(400, { code: "invalid_request", message: "Missing required field: expectedRevision." });
      }

      // Strict type check: must be a JSON number
      var rawPos = body.positionSeconds;
      var rawRev = body.expectedRevision;

      if (typeof rawPos !== "number") {
        return e.json(400, { code: "invalid_position", message: "positionSeconds must be a finite JSON number." });
      }
      if (typeof rawRev !== "number") {
        return e.json(400, { code: "invalid_revision", message: "expectedRevision must be a finite JSON number." });
      }

      // Reject NaN, Infinity, -Infinity
      if (isNaN(rawPos) || !isFinite(rawPos)) {
        return e.json(400, { code: "invalid_position", message: "positionSeconds must be a finite number." });
      }
      if (isNaN(rawRev) || !isFinite(rawRev)) {
        return e.json(400, { code: "invalid_revision", message: "expectedRevision must be a finite non-negative integer." });
      }

      // Reject negative
      if (rawPos < 0) {
        return e.json(400, { code: "invalid_position", message: "positionSeconds must be non-negative." });
      }
      if (rawRev < 0) {
        return e.json(400, { code: "invalid_revision", message: "expectedRevision must be non-negative." });
      }

      // expectedRevision must be an integer (not fractional)
      if (Math.floor(rawRev) !== rawRev) {
        return e.json(400, { code: "invalid_revision", message: "expectedRevision must be an integer." });
      }

      var positionSeconds = rawPos;
      var expectedRevision = Math.floor(rawRev);

      // We need to load the lesson first to get the authoritative duration
      // Then validate position against it.

      // ===================================================================
      // ATOMIC TRANSACTION: reload student, verify entitlement, load lesson,
      // get authoritative duration, load/create progress, compare revision,
      // calculate fields, save, commit.
      // ===================================================================
      var txResult = null;
      var txError = null;

      try {
        $app.runInTransaction(function (txApp) {
          var uid = "";
          if (!e.auth || !e.auth.id) {
            throw { httpStatus: 401, code: "auth_required", message: "Authentication required." };
          }
          uid = String(e.auth.id || "");

          // 1. Reload live Student inside transaction
          var student = null;
          try { student = txApp.findRecordById(USERS_C, uid); } catch (_) {}
          if (!student) {
            throw { httpStatus: 401, code: "user_not_found", message: "User not found." };
          }

          // 2. Verify entitlement — central Student guard
          // (guards.pb.js): Auth Collection must be `fep_users` with
          // role === 'student'. Legacy Staff records are rejected.
          var g = null;
          try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
          // Fail closed: an unavailable guard must not let the request through.
          var guardErr = (g && g.requireStudent) ? g.requireStudent(e) : { status: 500, code: "unexpected_error", message: "Internal error." };
          if (guardErr) {
            throw { httpStatus: guardErr.status, code: guardErr.code, message: guardErr.message };
          }
          var acct = String(student.get("account_status") || "");
          if (acct === "suspended") {
            throw { httpStatus: 403, code: "account_suspended", message: "Account is suspended." };
          }
          if (acct !== "active") {
            throw { httpStatus: 403, code: "subscription_required", message: "Active subscription required." };
          }
          var pc = Boolean(student.get("placement_completed"));
          var selLvl = String(student.get("selected_level") || "");
          if (!pc || !selLvl) {
            throw { httpStatus: 403, code: "placement_incomplete", message: "Placement must be completed first." };
          }

          var nowMs = Date.now();
          var hasSub = false;
          try {
            var subs = txApp.findRecordsByFilter(SUBS_C, "user = {:uid} && status = 'active'", "", 0, 0, { uid: uid });
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
            throw { httpStatus: 403, code: "subscription_required", message: "Active subscription required." };
          }

          // Rate limit
          var rateErr = rl.checkRate(rl.window("__fepProgWrite"), uid, 60, 300000);
          if (rateErr) {
            throw { httpStatus: rateErr.status, code: rateErr.body.code, message: rateErr.body.message };
          }

          // 3. Reload published Lesson (cross-level: no level equality
          // check — an entitled Student may update progress on any
          // Published Variant, A1–C2).
          var lesson = null;
          try { lesson = txApp.findRecordById(LESSONS_C, lessonId); } catch (_) {}
          if (!lesson) {
            throw { httpStatus: 404, code: "not_found", message: "Lesson not found." };
          }
          var lessonStatus = String(lesson.get("status") || "");
          if (lessonStatus !== "published") {
            throw { httpStatus: 404, code: "not_found", message: "Lesson not found." };
          }

          // Verify topic is published AND its parent Category is published
          var topicId = "";
          try { topicId = String(lesson.get("topic") || ""); } catch (_) {}
          var topicPublished = false;
          if (topicId) {
            try {
              var tRec = txApp.findRecordById(TOPICS_C, topicId);
              if (tRec && tRec.get("status") === "published") {
                var pdP = null;
                try { pdP = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pdP = null; }
                if (pdP) {
                  var catP = pdP.requirePublishedCategory(txApp, tRec.get("category"));
                  if (catP.ok) topicPublished = true;
                }
              }
            } catch (_) {}
          }
          if (!topicPublished) {
            throw { httpStatus: 404, code: "not_found", message: "Lesson not found." };
          }

          // 4. Obtain authoritative duration
          // Published lessons always carry audio_duration_seconds (enforced by
          // the publish hook); no fallback is allowed so the completion
          // threshold can never be computed from an estimated value.
          var authoritativeDuration = Number(lesson.get("audio_duration_seconds") || 0);
          if (!(authoritativeDuration > 0)) {
            throw { httpStatus: 500, code: "unexpected_error", message: "Lesson duration not configured." };
          }

          // 5. Validate position against authoritative duration + tolerance
          // Reject values far beyond the duration; clamp minor floating-point
          // overshoot (within POSITION_TOLERANCE) down to the duration.
          if (positionSeconds > authoritativeDuration + POSITION_TOLERANCE) {
            throw { httpStatus: 400, code: "invalid_position", message: "positionSeconds exceeds lesson duration (" + authoritativeDuration + "s)." };
          }
          if (positionSeconds > authoritativeDuration) {
            positionSeconds = authoritativeDuration;
          }

          // 6. Load or create Progress using txApp
          var existing = null;
          try {
            var hits = txApp.findRecordsByFilter(PROGRESS_C, "user = {:uid} && lesson = {:lid}", "", 1, 0, { uid: uid, lid: lessonId });
            if (hits && hits.length > 0) existing = hits[0];
          } catch (_) {}

          var nowStr = new Date(Date.now()).toISOString();

          if (!existing) {
            // ---- CREATE new progress record ----
            // PB 0.39 required NumberFields reject 0 ("blank") on save — a
            // progress record can never store position 0. Answer with the
            // contract code instead of an opaque 500; the client treats
            // position 0 as "not started" and never needs to store it.
            if (positionSeconds === 0) {
              throw { httpStatus: 400, code: "invalid_position", message: "positionSeconds must be greater than 0." };
            }
            // Use the transaction-owned collection
            var progCol = $app.findCollectionByNameOrId(PROGRESS_C);
            var newRec = new Record(progCol);
            newRec.set("user", uid);
            newRec.set("lesson", lessonId);
            newRec.set("position_seconds", positionSeconds);
            newRec.set("furthest_seconds", positionSeconds);
            newRec.set("duration_seconds", authoritativeDuration);
            newRec.set("last_played_at", nowStr);
            newRec.set("revision", 1);

            // Calculate completion
            var isCompleted = (authoritativeDuration > 0 && positionSeconds >= authoritativeDuration * COMPLETION_THRESHOLD);
            newRec.set("completed", isCompleted);
            if (isCompleted) {
              newRec.set("completed_at", nowStr);
            } else {
              newRec.set("completed_at", null);
            }

            try {
              txApp.save(newRec);
            } catch (createErr) {
              var ceMsg = String(createErr && createErr.message ? createErr.message : String(createErr));
              if (ceMsg.indexOf("UNIQUE") >= 0 || ceMsg.indexOf("unique") >= 0) {
                // First-save race — another request created the record first.
                // Re-load and retry as an update with the fresh revision.
                var retryHits = txApp.findRecordsByFilter(PROGRESS_C, "user = {:uid} && lesson = {:lid}", "", 1, 0, { uid: uid, lid: lessonId });
                if (retryHits && retryHits.length > 0) {
                  existing = retryHits[0];
                  // Fall through to update path below
                } else {
                  throw { httpStatus: 409, code: "concurrent_create", message: "Progress record was created concurrently. Retry." };
                }
              } else {
                try { $app.logger().error("progress_routes: PUT transaction create error: " + ceMsg); } catch (_) {}
                throw { httpStatus: 500, code: "unexpected_error", message: "Internal error." };
              }
            }
          }

          // ---- CREATE success path (no existing before create) ----
          if (!existing) {
            // newRec was saved successfully
            var createdPercent = authoritativeDuration > 0 ? Math.round((positionSeconds / authoritativeDuration) * 100) : 0;
            txResult = {
              lessonId: lessonId,
              positionSeconds: positionSeconds,
              furthestSeconds: positionSeconds,
              durationSeconds: authoritativeDuration,
              percent: createdPercent,
              completed: (authoritativeDuration > 0 && positionSeconds >= authoritativeDuration * COMPLETION_THRESHOLD),
              completedAt: (authoritativeDuration > 0 && positionSeconds >= authoritativeDuration * COMPLETION_THRESHOLD) ? nowStr : null,
              revision: 1,
              lastPlayedAt: nowStr,
              audioDurationSeconds: authoritativeDuration,
            };
            return;
          }

          // ---- UPDATE existing progress ----
          // 7. Compare Revision inside transaction
          var currentRevision = Number(existing.get("revision") || 0);
          if (expectedRevision !== currentRevision) {
            throw { httpStatus: 409, code: "stale_revision", message: "Progress was updated by another session. Reload and retry.",
                    expectedRevision: expectedRevision, currentRevision: currentRevision };
          }

          // PB 0.39 required NumberFields reject 0 ("blank") on save — an
          // existing record cannot be reset to 0 either. The stale check
          // above wins so a stale 0:00 save surfaces as a recoverable 409,
          // not a 400.
          if (positionSeconds === 0) {
            throw { httpStatus: 400, code: "invalid_position", message: "positionSeconds must be greater than 0." };
          }

          // 8. Calculate position, furthest, completion, timestamps
          // Use stored duration if valid, otherwise authoritative
          var storedDuration = Number(existing.get("duration_seconds") || 0);
          if (!(storedDuration > 0)) {
            storedDuration = authoritativeDuration;
          }

          existing.set("position_seconds", positionSeconds);
          existing.set("duration_seconds", storedDuration);

          // Furthest position is monotonic (never decreases)
          var currentFurthest = Number(existing.get("furthest_seconds") || 0);
          var newFurthest = Math.max(currentFurthest, positionSeconds);
          existing.set("furthest_seconds", newFurthest);

          // Completion is monotonic (once true, stays true)
          var wasCompleted = Boolean(existing.get("completed"));
          var isCompletedNow = wasCompleted || (storedDuration > 0 && newFurthest >= storedDuration * COMPLETION_THRESHOLD);
          existing.set("completed", isCompletedNow);

          if (isCompletedNow && !wasCompleted) {
            existing.set("completed_at", nowStr);
          }

          existing.set("last_played_at", nowStr);

          // 9. Increment Revision exactly once
          var nextRevision = currentRevision + 1;
          existing.set("revision", nextRevision);

          // 10. Save through txApp
          try {
            txApp.save(existing);
          } catch (saveErr) {
            var seMsg = String(saveErr && saveErr.message ? saveErr.message : String(saveErr));
            try { $app.logger().error("progress_routes: PUT transaction save error: " + seMsg); } catch (_) {}
            throw { httpStatus: 500, code: "unexpected_error", message: "Internal error." };
          }

          // Build result
          var updatedPercent = storedDuration > 0 ? Math.round((newFurthest / storedDuration) * 100) : 0;
          txResult = {
            lessonId: lessonId,
            positionSeconds: positionSeconds,
            furthestSeconds: newFurthest,
            durationSeconds: storedDuration,
            percent: updatedPercent,
            completed: isCompletedNow,
            completedAt: isCompletedNow ? (existing.get("completed_at") || nowStr) : null,
            revision: nextRevision,
            lastPlayedAt: nowStr,
            audioDurationSeconds: authoritativeDuration,
          };
        });
      } catch (txErr) {
        // Transaction threw — extract error info
        if (txErr && typeof txErr === "object" && txErr.httpStatus) {
          var errBody = { code: txErr.code || "unexpected_error", message: txErr.message || "Internal error." };
          if (txErr.expectedRevision !== undefined) errBody.expectedRevision = txErr.expectedRevision;
          if (txErr.currentRevision !== undefined) errBody.currentRevision = txErr.currentRevision;
          return e.json(txErr.httpStatus, errBody);
        }
        // Generic rollback — PB may throw native errors
        var rawMsg = String(txErr && txErr.message ? txErr.message : String(txErr));
        try { $app.logger().error("progress_routes: PUT transaction error: " + rawMsg); } catch (_) {}

        // Detect unique constraint from first-save race at the outer level
        if (rawMsg.indexOf("UNIQUE") >= 0 || rawMsg.indexOf("unique") >= 0) {
          return e.json(409, { code: "concurrent_create", message: "Progress record was created concurrently. Retry." });
        }

        return e.json(500, { code: "unexpected_error", message: "Internal error." });
      }

      if (!txResult) return e.json(500, { code: "unexpected_error", message: "Internal error." });

      try { e.response.header().set("Cache-Control", "private, no-store"); } catch (_) {}
      try { e.response.header().set("Pragma", "no-cache"); } catch (_) {}
      return e.json(200, txResult);
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("progress_routes: PUT error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("fep_users")
);

// =====================================================================
// GET /api/fast-english/progress/summary
// Return real progress summary for the student's selected level.
// =====================================================================

routerAdd(
  "GET",
  "/api/fast-english/progress/summary",
  function (e) {
    var USERS_C = "fep_users";
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";
    var SUBS_C = "subscriptions";
    var PROGRESS_C = "lesson_progress";

    var rl = require(__hooks + '/rate_limit.pb.js');

    try {
      // Full entitlement check
      var entitlementErr = null;
      var uid = "";
      var selLvl = "";
      if (!e.auth || !e.auth.id) {
        entitlementErr = { status: 401, body: { code: "auth_required", message: "Authentication required." } };
      } else {
        uid = String(e.auth.id || "");
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
              selLvl = String(student.get("selected_level") || "");
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

      // Rate limit
      var rateErr = rl.checkRate(rl.window("__fepProgSummary"), uid, 30, 300000);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      // Count published lessons for this level with published topics AND
      // published parent Categories (Category archival hides child content
      // from dashboard counts; Progress records themselves are retained).
      var allLessons = [];
      try {
        allLessons = $app.findRecordsByFilter(LESSONS_C, "level = {:lvl} && status = 'published'", "-published_at", 0, 0, { lvl: selLvl });
      } catch (_) {}
      // Batch topic/category lookups (library_routes pattern): two bulk
      // queries instead of per-lesson findRecordById calls.
      var sumTopics = [];
      try { sumTopics = $app.findRecordsByFilter(TOPICS_C, "status = 'published'", "", 0, 0); } catch (_) {}
      var sumTopicById = {};
      if (sumTopics && sumTopics.length > 0) {
        for (var sti2 = 0; sti2 < sumTopics.length; sti2++) {
          var st2 = sumTopics[sti2];
          if (!st2) continue;
          sumTopicById[String(st2.id || "")] = st2;
        }
      }
      var sumCats = [];
      try { sumCats = $app.findRecordsByFilter("categories", "publication_status = 'published'", "", 0, 0); } catch (_) {}
      var sumCatById = {};
      if (sumCats && sumCats.length > 0) {
        for (var sci2 = 0; sci2 < sumCats.length; sci2++) {
          var sc2 = sumCats[sci2];
          if (!sc2) continue;
          sumCatById[String(sc2.id || "")] = sc2;
        }
      }
      var publishedCount = 0;
      var totalDurationSeconds = 0;
      if (allLessons && allLessons.length > 0) {
        for (var li = 0; li < allLessons.length; li++) {
          var ls = allLessons[li];
          if (!ls) continue;
          var tId = "";
          try { tId = String(ls.get("topic") || ""); } catch (_) {}
          var tPub = false;
          if (tId) {
            try {
              var tRec = sumTopicById[tId];
              if (tRec && tRec.get("status") === "published") {
                var catIdS = String(tRec.get("category") || "");
                if (catIdS && sumCatById[catIdS]) tPub = true;
              }
            } catch (_) {}
          }
          if (tPub) {
            publishedCount++;
            // Use audio_duration_seconds if available, otherwise estimated_minutes * 60
            var lsDur = Number(ls.get("audio_duration_seconds") || 0);
            if (!(lsDur > 0)) lsDur = Number(ls.get("estimated_minutes") || 0) * 60;
            totalDurationSeconds += lsDur;
          }
        }
      }

      // Count progress records for this user across ALL lessons
      var allProgress = [];
      try {
        allProgress = $app.findRecordsByFilter(PROGRESS_C, "user = {:uid}", "", 0, 0, { uid: uid });
      } catch (_) {}

      var startedCount = 0;
      var completedCount = 0;
      var totalListeningSeconds = 0;

      // Only count progress for lessons in the current level
      var lessonLevelMap = {};
      if (allLessons && allLessons.length > 0) {
        for (var lsi = 0; lsi < allLessons.length; lsi++) {
          var ls2 = allLessons[lsi];
          if (ls2) lessonLevelMap[String(ls2.id || "")] = String(ls2.get("level") || "");
        }
      }

      if (allProgress && allProgress.length > 0) {
        for (var pi = 0; pi < allProgress.length; pi++) {
          var pRec = allProgress[pi];
          if (!pRec) continue;
          var pLessonId = String(pRec.get("lesson") || "");
          // Only count progress for current level lessons
          if (lessonLevelMap[pLessonId] !== selLvl) continue;

          var pFurthest = Number(pRec.get("furthest_seconds") || 0);
          if (pFurthest > 0) {
            startedCount++;
            totalListeningSeconds += pFurthest;
          }
          if (Boolean(pRec.get("completed"))) {
            completedCount++;
          }
        }
      }

      var completionPercent = publishedCount > 0 ? Math.round((completedCount / publishedCount) * 100) : 0;

      try { e.response.header().set("Cache-Control", "private, no-store"); } catch (_) {}

      return e.json(200, {
        publishedLessonCount: publishedCount,
        startedLessonCount: startedCount,
        completedLessonCount: completedCount,
        completionPercent: completionPercent,
        totalListeningSeconds: totalListeningSeconds,
        totalDurationSeconds: totalDurationSeconds,
        selectedLevel: selLvl,
      });
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("progress_routes: SUMMARY error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("fep_users")
);

// =====================================================================
// GET /api/fast-english/progress/continue
// Return the best Continue Learning lesson for the authenticated student.
//
// Priority:
//   1. Most recently played incomplete lesson (furthest < 90% or not completed)
//   2. First published uncompleted lesson in deterministic Topic/lesson order
//   3. Completed-state response when all done
// =====================================================================

routerAdd(
  "GET",
  "/api/fast-english/progress/continue",
  function (e) {
    var USERS_C = "fep_users";
    var LESSONS_C = "lessons";
    var TOPICS_C = "topics";
    var SUBS_C = "subscriptions";
    var PROGRESS_C = "lesson_progress";
    var COMPLETION_THRESHOLD = 0.9;

    var rl = require(__hooks + '/rate_limit.pb.js');

    try {
      // Full entitlement check (inlined)
      var entitlementErr = null;
      var uid = "";
      var selLvl = "";
      if (!e.auth || !e.auth.id) {
        entitlementErr = { status: 401, body: { code: "auth_required", message: "Authentication required." } };
      } else {
        uid = String(e.auth.id || "");
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
              selLvl = String(student.get("selected_level") || "");
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

      // Rate limit
      var rateErr = rl.checkRate(rl.window("__fepProgCont"), uid, 30, 300000);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      // Get all published lessons for this level (with published topics
      // AND published parent Categories).
      var allLessons = [];
      try {
        allLessons = $app.findRecordsByFilter(LESSONS_C, "level = {:lvl} && status = 'published'", "-published_at", 0, 0, { lvl: selLvl });
      } catch (_) {}

      // Batch topic/category lookups (library_routes pattern): two bulk
      // queries instead of per-lesson findRecordById calls.
      var contTopics = [];
      try { contTopics = $app.findRecordsByFilter(TOPICS_C, "status = 'published'", "", 0, 0); } catch (_) {}
      var contTopicById = {};
      if (contTopics && contTopics.length > 0) {
        for (var cti = 0; cti < contTopics.length; cti++) {
          var ct = contTopics[cti];
          if (!ct) continue;
          contTopicById[String(ct.id || "")] = ct;
        }
      }
      var contCats = [];
      try { contCats = $app.findRecordsByFilter("categories", "publication_status = 'published'", "", 0, 0); } catch (_) {}
      var contCatById = {};
      if (contCats && contCats.length > 0) {
        for (var cci = 0; cci < contCats.length; cci++) {
          var cc = contCats[cci];
          if (!cc) continue;
          contCatById[String(cc.id || "")] = cc;
        }
      }
      var validLessons = [];
      if (allLessons && allLessons.length > 0) {
        for (var li = 0; li < allLessons.length; li++) {
          var ls = allLessons[li];
          if (!ls) continue;
          var tId = "";
          try { tId = String(ls.get("topic") || ""); } catch (_) {}
          var tPub = false;
          if (tId) {
            try {
              var tRec = contTopicById[tId];
              if (tRec && tRec.get("status") === "published") {
                var catIdC = String(tRec.get("category") || "");
                if (catIdC && contCatById[catIdC]) tPub = true;
              }
            } catch (_) {}
          }
          if (tPub) {
            validLessons.push(ls);
          }
        }
      }

      if (validLessons.length === 0) {
        return e.json(200, {
          kind: "no_lessons",
          message: "No published lessons available for your level.",
        });
      }

      // Get all progress records for this user
      var allProgress = [];
      try {
        allProgress = $app.findRecordsByFilter(PROGRESS_C, "user = {:uid}", "-last_played_at", 0, 0, { uid: uid });
      } catch (_) {}

      // Build progress lookup by lesson ID
      var progressByLesson = {};
      if (allProgress && allProgress.length > 0) {
        for (var pi = 0; pi < allProgress.length; pi++) {
          var pRec = allProgress[pi];
          if (!pRec) continue;
          var pLessonId = String(pRec.get("lesson") || "");
          progressByLesson[pLessonId] = pRec;
        }
      }

      // Priority 1: Most recently played incomplete lesson
      var bestLesson = null;
      var bestProgress = null;

      if (allProgress && allProgress.length > 0) {
        for (var pj = 0; pj < allProgress.length; pj++) {
          var prog = allProgress[pj];
          if (!prog) continue;
          var progLessonId = String(prog.get("lesson") || "");
          var progCompleted = Boolean(prog.get("completed"));

          // Check if this lesson is in the valid set
          var lessonInSet = false;
          for (var vi = 0; vi < validLessons.length; vi++) {
            if (String(validLessons[vi].id || "") === progLessonId) {
              lessonInSet = true;
              break;
            }
          }
          if (!lessonInSet) continue;

          if (!progCompleted) {
            bestLesson = null;
            for (var vi2 = 0; vi2 < validLessons.length; vi2++) {
              if (String(validLessons[vi2].id || "") === progLessonId) {
                bestLesson = validLessons[vi2];
                break;
              }
            }
            bestProgress = prog;
            break;
          }
        }
      }

      // Priority 2: First published uncompleted lesson in deterministic order
      if (!bestLesson) {
        for (var vi3 = 0; vi3 < validLessons.length; vi3++) {
          var vLesson = validLessons[vi3];
          var vId = String(vLesson.id || "");
          var vProg = progressByLesson[vId];
          if (!vProg || !Boolean(vProg.get("completed"))) {
            bestLesson = vLesson;
            bestProgress = vProg || null;
            break;
          }
        }
      }

      if (bestLesson) {
        var lessonId = String(bestLesson.id || "");
        var topicId2 = "";
        try { topicId2 = String(bestLesson.get("topic") || ""); } catch (_) {}
        var topicTitle = "";
        var topicSlug = "";
        if (topicId2) {
          try {
            // The topic is guaranteed published (bestLesson came from the
            // published-filtered validLessons built above), so read it from
            // the bulk map instead of a per-item query.
            var tRec2 = contTopicById[topicId2];
            if (tRec2) {
              topicTitle = String(tRec2.get("title") || "");
              topicSlug = String(tRec2.get("slug") || "");
            }
          } catch (_) {}
        }

        var lessonTitle = String(bestLesson.get("title") || "");
        var lessonLevel = String(bestLesson.get("level") || "");
        var estimatedMin = Number(bestLesson.get("estimated_minutes") || 0);

        // Server-authoritative duration
        var authoritativeDur = Number(bestLesson.get("audio_duration_seconds") || 0);
        if (!(authoritativeDur > 0)) authoritativeDur = estimatedMin * 60;

        var positionSeconds = 0;
        var furthestSeconds = 0;
        var progressPercent = 0;
        var durationSeconds = authoritativeDur;

        if (bestProgress) {
          positionSeconds = Number(bestProgress.get("position_seconds") || 0);
          furthestSeconds = Number(bestProgress.get("furthest_seconds") || 0);
          var storedDur = Number(bestProgress.get("duration_seconds") || 0);
          if (storedDur > 0) durationSeconds = storedDur;
          progressPercent = durationSeconds > 0 ? Math.round((furthestSeconds / durationSeconds) * 100) : 0;
        }

        var isCompleted = Boolean(bestProgress && bestProgress.get("completed"));

        return e.json(200, {
          kind: "lesson",
          lesson: {
            id: lessonId,
            topicId: topicId2,
            topicTitle: topicTitle,
            topicSlug: topicSlug,
            title: lessonTitle,
            level: lessonLevel,
            estimatedMinutes: estimatedMin,
          },
          progress: {
            positionSeconds: positionSeconds,
            furthestSeconds: furthestSeconds,
            durationSeconds: durationSeconds,
            percent: progressPercent,
            completed: isCompleted,
          },
        });
      }

      // Priority 3: All completed
      return e.json(200, {
        kind: "all_completed",
        message: "All lessons for your level have been completed.",
      });
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("progress_routes: CONTINUE error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("fep_users")
);
