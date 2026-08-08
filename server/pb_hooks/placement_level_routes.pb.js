// server/pb_hooks/placement_level_routes.pb.js
// P2-S2 — Suggested level, selected level, and dashboard custom routes.
//
// Routes:
//   GET  /api/fast-english/placement/level-context
//   POST /api/fast-english/placement/selected-level
//   GET  /api/fast-english/dashboard
//
// CRITICAL: PocketBase 0.39 JSVM recompiles the routerAdd handler in
// the executor's scope, so it CANNOT see top-level var declarations
// or function declarations. Every helper and constant must be inlined
// into each closure body.

try {
  $app.logger().info("placement_level_routes: hook file loaded");
} catch (_) {}

// =====================================================================
// Server-owned CEFR level threshold mapping (MVP assumption)
//
// This mapping is the single authoritative source for determining a
// suggested CEFR level from a raw placement score. It is documented
// as an MVP decision and must not be duplicated or overridden by the
// Client.
//
//   Score 0–3   → A1
//   Score 4–6   → A2
//   Score 7–10  → B1
//   Score 11–13 → B2
//   Score 14–16 → C1
//   Score 17–20 → C2
//
// This mapping is inlined into each closure because PB 0.39 JSVM
// does not share top-level declarations with hook scopes.
// =====================================================================

// ---------------------------------------------------------------------
// GET /api/fast-english/placement/level-context
// Return the authenticated Student's placement and level state.
// ---------------------------------------------------------------------

routerAdd(
  "GET",
  "/api/fast-english/placement/level-context",
  function (e) {
    var USERS_C = "fep_users";
    var ATTEMPTS_C = "placement_attempts";
    var SUBS_C = "subscriptions";
    var TOTAL_Q = 20;

    // --- Rate-limit state ---
    if (typeof globalThis.__fepLevelCtx === "undefined") { globalThis.__fepLevelCtx = {}; }
    var RATE_WIN = globalThis.__fepLevelCtx;
    var RATE_MAX = 30;
    var RATE_MS = 300000;

    // --- Inline helpers ---

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

    function scoreToLevel(sc) {
      var s = Number(sc);
      if (isNaN(s) || s < 0 || s > TOTAL_Q) return null;
      if (s <= 3) return "A1";
      if (s <= 6) return "A2";
      if (s <= 10) return "B1";
      if (s <= 13) return "B2";
      if (s <= 16) return "C1";
      return "C2";
    }

    function safeParse(str) {
      if (typeof str !== "string" || str === "" || str === "null" || str === "undefined") return null;
      try { return JSON.parse(str); } catch (_) { return null; }
    }

    try {
      // Auth check
      if (!e.auth || !e.auth.id) { return e.json(401, { code: "auth_required", message: "Authentication required." }); }

      var uid = String(e.auth.id || "");

      // Central Student guard (guards.pb.js): Auth Collection must be
      // `fep_users` with role === 'student'. Legacy Staff records are rejected.
      var g = null;
      try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
      if (!g || !g.requireActiveStudent) return e.json(500, { code: "unexpected_error", message: "Internal error." });
      var guardErr = g.requireActiveStudent(e);
      if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });

      // Suspended check
      var acct = ""; try { acct = String(e.auth.get("account_status") || ""); } catch (_) {}
      if (acct === "suspended") { return e.json(403, { code: "account_suspended", message: "Account is suspended." }); }

      // Active subscription check
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
          if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) { hasSub = true; break; }
        }
      } catch (_) {}
      if (!hasSub) { return e.json(403, { code: "subscription_required", message: "Active subscription required." }); }

      // Rate limit
      var rateErr = checkRate(uid);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      // Find attempt
      var attempt = null;
      try {
        var hits = $app.findRecordsByFilter(ATTEMPTS_C, "user = {:uid}", "", 1, 0, { uid: uid });
        if (hits && hits.length > 0) attempt = hits[0];
      } catch (_) {}

      if (!attempt) {
        return e.json(200, { kind: "placement_required" });
      }

      var status = String(attempt.get("status") || "");

      if (status === "in_progress") {
        var ansText = "";
        try { ansText = String(attempt.get("answers_text") || ""); } catch (_) { ansText = ""; }
        var answers = safeParse(ansText);
        var count = 0;
        if (answers && typeof answers === "object" && !Array.isArray(answers)) {
          for (var ak in answers) { if (answers.hasOwnProperty(ak)) count++; }
        }
        return e.json(200, {
          kind: "placement_in_progress",
          attemptId: String(attempt.id || ""),
          answeredCount: count,
          totalQuestions: TOTAL_Q,
        });
      }

      // Submitted
      var score = attempt.get("score");
      var maxScore = attempt.get("max_score");
      var scoreNum = score !== null && score !== undefined ? Number(score) : -1;
      var maxScoreNum = maxScore !== null && maxScore !== undefined ? Number(maxScore) : TOTAL_Q;

      // Calculate or retrieve suggested level
      var existingSuggested = String(attempt.get("suggested_level") || "");

      // If existing suggested level is empty and the attempt is submitted,
      // reconcile: calculate from stored score and persist. This supports
      // pre-existing attempts created before P2-S2.
      var suggestedLevel = existingSuggested || "";

      if (!suggestedLevel && scoreNum >= 0 && maxScoreNum > 0) {
        suggestedLevel = scoreToLevel(scoreNum);
        if (suggestedLevel) {
          // Persist both Attempt and User suggested_level in one transaction
          try {
            $app.runInTransaction(function (txApp) {
              var txRec = txApp.findRecordById(ATTEMPTS_C, String(attempt.id || ""));
              if (txRec) {
                txRec.set("suggested_level", suggestedLevel);
                txApp.save(txRec);
              }
              var txUser = txApp.findRecordById(USERS_C, uid);
              if (txUser) {
                var userSuggested = String(txUser.get("suggested_level") || "");
                if (!userSuggested) {
                  txUser.set("suggested_level", suggestedLevel);
                  txApp.save(txUser);
                }
              }
            });
          } catch (_) {}
        }
      }

      // Validate integrity: if stored suggestion does not match deterministic score,
      // return a safe integrity error rather than silently rewriting historical data.
      if (suggestedLevel && scoreNum >= 0) {
        var expectedLevel = scoreToLevel(scoreNum);
        if (expectedLevel && suggestedLevel !== expectedLevel) {
          return e.json(500, { code: "level_mapping_integrity_error", message: "Stored suggested level does not match score mapping." });
        }
      }

      var selectedLevel = String(attempt.get("selected_level") || "");
      var userRec2 = null;
      try { userRec2 = $app.findRecordById(USERS_C, uid); } catch (_) {}

      var placementCompleted = false;
      var userSelectedLevel = "";
      var userSuggestedLevel = "";

      if (userRec2) {
        placementCompleted = Boolean(userRec2.get("placement_completed"));
        userSelectedLevel = String(userRec2.get("selected_level") || "");
        userSuggestedLevel = String(userRec2.get("suggested_level") || "");
      }

      // If user has placement_completed and selected_level but attempt doesn't, sync from user
      if (placementCompleted && userSelectedLevel && !selectedLevel) {
        try {
          $app.runInTransaction(function (txApp) {
            var txRec2 = txApp.findRecordById(ATTEMPTS_C, String(attempt.id || ""));
            if (txRec2) {
              txRec2.set("selected_level", userSelectedLevel);
              txApp.save(txRec2);
            }
          });
        } catch (_) {}
        selectedLevel = userSelectedLevel;
      }

      if (placementCompleted && userSuggestedLevel && !suggestedLevel) {
        suggestedLevel = userSuggestedLevel;
      }

      if (placementCompleted && selectedLevel) {
        return e.json(200, {
          kind: "completed",
          attemptId: String(attempt.id || ""),
          score: scoreNum,
          maxScore: maxScoreNum,
          suggestedLevel: suggestedLevel || null,
          selectedLevel: selectedLevel || null,
          placementCompleted: true,
        });
      }

      return e.json(200, {
        kind: "level_selection_required",
        attemptId: String(attempt.id || ""),
        score: scoreNum,
        maxScore: maxScoreNum,
        suggestedLevel: suggestedLevel || null,
        selectedLevel: null,
        placementCompleted: false,
      });

    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      return e.json(500, { code: "unexpected_error", message: msg });
    }
  },
  $apis.requireAuth("fep_users")
);

// ---------------------------------------------------------------------
// POST /api/fast-english/placement/selected-level
// Accept or change the selected level.
// ---------------------------------------------------------------------

routerAdd(
  "POST",
  "/api/fast-english/placement/selected-level",
  function (e) {
    var USERS_C = "fep_users";
    var ATTEMPTS_C = "placement_attempts";
    var SUBS_C = "subscriptions";
    var ALLOWED_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

    if (typeof globalThis.__fepSelLevel === "undefined") { globalThis.__fepSelLevel = {}; }
    var RATE_WIN = globalThis.__fepSelLevel;
    var RATE_MAX = 5;
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

    function scoreToLevel(sc) {
      var s = Number(sc);
      if (isNaN(s) || s < 0 || s > 20) return null;
      if (s <= 3) return "A1";
      if (s <= 6) return "A2";
      if (s <= 10) return "B1";
      if (s <= 13) return "B2";
      if (s <= 16) return "C1";
      return "C2";
    }

    function readBody(ev) {
      try {
        var s = readerToString(ev.request.body);
        if (!s) return null;
        return JSON.parse(s);
      } catch (_) { return null; }
    }

    try {
      // Auth check
      if (!e.auth || !e.auth.id) { return e.json(401, { code: "auth_required", message: "Authentication required." }); }

      var uid = String(e.auth.id || "");

      // Reload live student record
      var student = null;
      try { student = $app.findRecordById(USERS_C, uid); } catch (_) {}
      if (!student) { return e.json(401, { code: "user_not_found", message: "User not found." }); }

      // Central Student guard (guards.pb.js): Auth Collection must be
      // `fep_users` with role === 'student'. Legacy Staff records are rejected.
      var g = null;
      try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
      if (!g || !g.requireActiveStudent) return e.json(500, { code: "unexpected_error", message: "Internal error." });
      var guardErr = g.requireActiveStudent(e);
      if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });

      // Suspend check (live record)
      var acct = String(student.get("account_status") || "");
      if (acct === "suspended") { return e.json(403, { code: "account_suspended", message: "Account is suspended." }); }

      // Subscription check
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
          if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) { hasSub = true; break; }
        }
      } catch (_) {}
      if (!hasSub) { return e.json(403, { code: "subscription_required", message: "Active subscription required." }); }

      // Rate limit
      var rateErr = checkRate(uid);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      // Parse request body
      var body = readBody(e);
      if (!body) { return e.json(400, { code: "invalid_request", message: "Invalid request body." }); }

      var selectedLevel = String(body.selectedLevel || "");
      // Reject extra fields
      var allowedKeys = { selectedLevel: true };
      for (var bk in body) {
        if (body.hasOwnProperty(bk) && !allowedKeys[bk]) {
          return e.json(400, { code: "invalid_request", message: "Unexpected field: " + bk });
        }
      }

      if (!selectedLevel) {
        return e.json(400, { code: "invalid_request", message: "selectedLevel is required." });
      }

      // Validate level
      var levelValid = false;
      for (var li = 0; li < ALLOWED_LEVELS.length; li++) {
        if (selectedLevel === ALLOWED_LEVELS[li]) { levelValid = true; break; }
      }
      if (!levelValid) {
        return e.json(400, { code: "invalid_level", message: "Invalid level. Must be one of: A1, A2, B1, B2, C1, C2." });
      }

      // Transaction
      var txResult = null;

      $app.runInTransaction(function (txApp) {
        // Reload student within transaction
        var txStudent = null;
        try { txStudent = txApp.findRecordById(USERS_C, uid); } catch (_) {}
        if (!txStudent) throw new BadRequestError("user_not_found", { code: "user_not_found" });

        // Re-check account
        var txAcct = String(txStudent.get("account_status") || "");
        if (txAcct !== "active") throw new BadRequestError("subscription_required", { code: "subscription_required" });

        // Find the only attempt
        var txAttempt = null;
        try {
          var txHits = txApp.findRecordsByFilter(ATTEMPTS_C, "user = {:uid}", "", 1, 0, { uid: uid });
          if (txHits && txHits.length > 0) txAttempt = txHits[0];
        } catch (_) {}
        if (!txAttempt) throw new BadRequestError("no_attempt", { code: "no_attempt" });

        var txStatus = String(txAttempt.get("status") || "");
        if (txStatus !== "submitted") throw new BadRequestError("attempt_not_submitted", { code: "attempt_not_submitted" });

        // Validate score and calculate suggested level
        var txScore = txAttempt.get("score");
        var txScoreNum = txScore !== null && txScore !== undefined ? Number(txScore) : -1;
        if (txScoreNum < 0 || txScoreNum > 20) throw new BadRequestError("invalid_score", { code: "invalid_score" });

        // Calculate or validate existing suggested level
        var txSuggested = scoreToLevel(txScoreNum);
        if (!txSuggested) throw new BadRequestError("invalid_score", { code: "invalid_score" });

        var existingSuggested = String(txAttempt.get("suggested_level") || "");
        // If existing, must match the deterministic mapping
        if (existingSuggested && existingSuggested !== txSuggested) {
          throw new BadRequestError("level_mapping_integrity_error", { code: "level_mapping_integrity_error" });
        }

        // Persist suggested level on attempt if not already set
        if (!existingSuggested) {
          txAttempt.set("suggested_level", txSuggested);
        }

        // Update attempt selected level
        txAttempt.set("selected_level", selectedLevel);
        txApp.save(txAttempt);

        // Update user fields atomically
        txStudent.set("suggested_level", txSuggested);
        txStudent.set("selected_level", selectedLevel);
        txStudent.set("placement_completed", true);
        txApp.save(txStudent);

        txResult = {
          kind: "completed",
          suggestedLevel: txSuggested,
          selectedLevel: selectedLevel,
          placementCompleted: true,
        };
      });

      if (!txResult) return e.json(500, { code: "unexpected_error", message: "Internal error." });
      return e.json(200, txResult);

    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      var rawD = String(topErr && topErr.rawData ? topErr.rawData : "");
      var full = (msg + " " + rawD).toLowerCase();
      var cmap = { user_not_found: 401, subscription_required: 403, no_attempt: 404, attempt_not_submitted: 409, invalid_score: 400, level_mapping_integrity_error: 500 };
      for (var ec in cmap) { if (full.indexOf(ec) >= 0) { return e.json(cmap[ec], { code: ec, message: msg }); } }
      return e.json(500, { code: "unexpected_error", message: msg });
    }
  },
  $apis.requireAuth("fep_users")
);

// ---------------------------------------------------------------------
// GET /api/fast-english/dashboard
// Return the active student's dashboard data.
// ---------------------------------------------------------------------

routerAdd(
  "GET",
  "/api/fast-english/dashboard",
  function (e) {
    var USERS_C = "fep_users";
    var ATTEMPTS_C = "placement_attempts";
    var SUBS_C = "subscriptions";

    if (typeof globalThis.__fepDash === "undefined") { globalThis.__fepDash = {}; }
    var RATE_WIN = globalThis.__fepDash;
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
      if (!e.auth || !e.auth.id) { return e.json(401, { code: "auth_required", message: "Authentication required." }); }

      var uid = String(e.auth.id || "");

      // Load live user record
      var student = null;
      try { student = $app.findRecordById(USERS_C, uid); } catch (_) {}
      if (!student) { return e.json(401, { code: "user_not_found", message: "User not found." }); }

      // Central Student guard (guards.pb.js): Auth Collection must be
      // `fep_users` with role === 'student'. Legacy Staff records are rejected.
      var g = null;
      try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
      if (!g || !g.requireActiveStudent) return e.json(500, { code: "unexpected_error", message: "Internal error." });
      var guardErr = g.requireActiveStudent(e);
      if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });

      // Suspend check (live record)
      var acct = String(student.get("account_status") || "");
      if (acct === "suspended") { return e.json(403, { code: "account_suspended", message: "Account is suspended." }); }

      // Active subscription — scan all rows; grant when ANY row covers now,
      // and display the valid row with the greatest expires_at.
      var nowMs = Date.now();
      var subRecord = null;
      var hasSub = false;
      try {
        var subs = $app.findRecordsByFilter(SUBS_C, "user = {:uid} && status = 'active'", "", 0, 0, { uid: uid });
        var bestExpMs = -1;
        for (var si = 0; si < subs.length; si++) {
          var s = subs[si];
          var expStr = String(s.get("expires_at") || "");
          var startStr = String(s.get("starts_at") || "");
          if (!expStr || !startStr) continue;
          var expMs = new Date(expStr).getTime();
          var startMs = new Date(startStr).getTime();
          if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs && expMs > bestExpMs) {
            bestExpMs = expMs;
            subRecord = s;
            hasSub = true;
          }
        }
      } catch (_) {}
      if (!hasSub) { return e.json(403, { code: "subscription_required", message: "Active subscription required." }); }

      // Placement checks
      var pc = Boolean(student.get("placement_completed"));
      var selLvl = String(student.get("selected_level") || "");
      if (!pc || !selLvl) {
        return e.json(403, { code: "placement_incomplete", message: "Placement must be completed first." });
      }

      // Rate limit
      var rateErr = checkRate(uid);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      var sugLvl = String(student.get("suggested_level") || "");
      var name = String(student.get("name") || "");
      var phone = String(student.get("phone") || "");

      // Find attempt for placement summary
      var attempt = null;
      try { var hits = $app.findRecordsByFilter(ATTEMPTS_C, "user = {:uid}", "", 1, 0, { uid: uid }); if (hits && hits.length > 0) attempt = hits[0]; } catch (_) {}

      var score = null;
      var maxScore = null;
      var submittedAt = null;
      if (attempt) {
        score = attempt.get("score") !== null && attempt.get("score") !== undefined ? Number(attempt.get("score")) : null;
        maxScore = attempt.get("max_score") !== null && attempt.get("max_score") !== undefined ? Number(attempt.get("max_score")) : null;
        submittedAt = attempt.get("submitted_at") || null;
      }

      // Subscription summary (sanitized)
      var planName = "";
      var startsAt = "";
      var expiresAt = "";
      var remainingDays = 0;
      if (subRecord) {
        planName = String(subRecord.get("plan_name_snapshot") || "");
        startsAt = String(subRecord.get("starts_at") || "");
        expiresAt = String(subRecord.get("expires_at") || "");
        if (expiresAt) {
          var expDate = new Date(expiresAt);
          var diff = expDate.getTime() - nowMs;
          remainingDays = diff > 0 ? Math.ceil(diff / 86400000) : 0;
        }
      }

      // P3-S2: Count real lessons and progress for this level
      var LESSONS_C = "lessons";
      var TOPICS_C = "topics";
      var PROGRESS_C = "lesson_progress";
      var publishedCount = 0;
      var startedCount = 0;
      var completedCount = 0;
      var continueKind = "no_lessons";
      var continueLessonId = "";

      try {
        var lHits = $app.findRecordsByFilter(LESSONS_C, "level = {:lvl} && status = 'published'", "", 0, 0, { lvl: selLvl });

        // Published lesson IDs at the current preferred level (topic AND
        // parent Category must be published — Category archival hides child
        // content from dashboard counts; Progress records are retained).
        var pdDash = null;
        try { pdDash = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pdDash = null; }
        var pubIds = [];
        var pubMap = {};
        if (lHits && lHits.length > 0) {
          for (var li2 = 0; li2 < lHits.length; li2++) {
            var ls2 = lHits[li2];
            if (!ls2) continue;
            var lid2 = String(ls2.id || "");
            var tId3 = "";
            try { tId3 = String(ls2.get("topic") || ""); } catch (_) {}
            if (tId3) {
              try {
                var tR2 = $app.findRecordById(TOPICS_C, tId3);
                if (tR2 && tR2.get("status") === "published" && pdDash) {
                  var catD = pdDash.requirePublishedCategory($app, tR2.get("category"));
                  if (catD.ok) {
                    pubIds.push(lid2);
                    pubMap[lid2] = ls2;
                    publishedCount++;
                  }
                }
              } catch (_) {}
            }
          }
        }

        // Progress counts are restricted to lessons currently published at the
        // selected level, so changing level or archiving content cannot inflate
        // started/completed counts or the completion percentage.
        var pHits = $app.findRecordsByFilter(PROGRESS_C, "user = {:uid}", "", 0, 0, { uid: uid });
        if (pHits && pHits.length > 0) {
          for (var pi = 0; pi < pHits.length; pi++) {
            var pr = pHits[pi];
            if (!pr) continue;
            if (!pubMap[String(pr.get("lesson") || "")]) continue;
            if (Boolean(pr.get("completed"))) completedCount++;
            if (Number(pr.get("furthest_seconds") || 0) > 0) startedCount++;
          }
        }

        // Progress keyed by lesson for Continue Learning
        var progByLsn = {};
        if (pHits && pHits.length > 0) {
          for (var pi2 = 0; pi2 < pHits.length; pi2++) {
            var pr2 = pHits[pi2];
            if (!pr2) continue;
            progByLsn[String(pr2.get("lesson") || "")] = pr2;
          }
        }

        // Most recent incomplete lesson
        if (pHits && pHits.length > 0) {
          var sorted = []; for (var si = 0; si < pHits.length; si++) sorted.push(pHits[si]);
          sorted.sort(function(a,b) { return String(b.get("last_played_at") || "").localeCompare(String(a.get("last_played_at") || "")); });
          for (var si2 = 0; si2 < sorted.length; si2++) {
            var sr = sorted[si2];
            if (!sr) continue;
            var srLid = String(sr.get("lesson") || "");
            if (pubMap[srLid] && !Boolean(sr.get("completed"))) {
              continueKind = "incomplete";
              continueLessonId = srLid;
              break;
            }
          }
        }
        if (!continueLessonId) {
          // First uncompleted lesson
          for (var ui = 0; ui < pubIds.length; ui++) {
            var pid = pubIds[ui];
            var pRec = progByLsn[pid];
            if (!pRec || !Boolean(pRec.get("completed"))) {
              continueKind = pubIds.length > 0 ? "unstarted" : "no_lessons";
              continueLessonId = pid;
              break;
            }
          }
        }
        if (!continueLessonId && pubIds.length > 0) {
          continueKind = "all_completed";
        }
      } catch (_) {}

      return e.json(200, {
        student: {
          name: name,
          selectedLevel: selLvl,
          suggestedLevel: sugLvl || null,
          placementCompleted: true,
        },
        placement: {
          score: score,
          maxScore: maxScore,
          submittedAt: submittedAt,
        },
        subscription: {
          planName: planName,
          startsAt: startsAt,
          expiresAt: expiresAt,
          remainingDays: remainingDays,
        },
        lessons: {
          publishedCount: publishedCount,
        },
        progress: {
          kind: "available",
          startedLessonCount: startedCount,
          completedLessonCount: completedCount,
          publishedLessonCount: publishedCount,
          completionPercent: publishedCount > 0 ? Math.round((completedCount / publishedCount) * 100) : 0,
        },
        continueLearning: {
          kind: continueKind,
          lessonId: continueLessonId,
        },
      });

    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      return e.json(500, { code: "unexpected_error", message: msg });
    }
  },
  $apis.requireAuth("fep_users")
);
