// server/pb_hooks/placement_routes.pb.js
// P2-S1 — Placement attempt custom routes.
//
// Routes:
//   POST /api/fast-english/placement/attempts/start
//   PUT  /api/fast-english/placement/attempts/{attemptId}/answer
//   POST /api/fast-english/placement/attempts/{attemptId}/submit
//
// CRITICAL: PocketBase 0.39 JSVM recompiles the routerAdd handler in
// the executor's scope, so it CANNOT see top-level var declarations
// or function declarations. Every helper and constant must be inlined
// into each closure body.
//
// All structured data (options, snapshot, answers) uses Text fields
// storing canonical JSON strings. PB 0.39's JSONField wrapper types
// (JSONArray/JSONMap) are unreliable for round-trip through JSVM.

try {
  $app.logger().info("placement_routes: hook file loaded");
} catch (_) {}

// ---------------------------------------------------------------------
// POST /api/fast-english/placement/attempts/start
// Start a new attempt or resume an existing one.
// ---------------------------------------------------------------------

routerAdd(
  "POST",
  "/api/fast-english/placement/attempts/start",
  function (e) {
    var QUESTIONS_C = "placement_questions";
    var ATTEMPTS_C = "placement_attempts";
    var SUBS_C = "subscriptions";
    var USERS_C = "fep_users";
    var TOTAL_Q = 20;

    // Rate-limit state
    if (typeof globalThis.__fepPlStart === "undefined") { globalThis.__fepPlStart = {}; }
    var RATE_WIN = globalThis.__fepPlStart;
    var RATE_MAX = 10;
    var RATE_MS = 300000;

    // --- Inline helpers ---

    function checkEligibility(ev) {
      if (!ev || !ev.auth) { return { status: 401, body: { code: "placement_auth_required", message: "Authentication required." } }; }
      var role = ""; var acct = "";
      try { role = String(ev.auth.get("role") || ""); acct = String(ev.auth.get("account_status") || ""); } catch (_) {}
      if (role !== "student") { return { status: 403, body: { code: "placement_access_denied", message: "Access denied." } }; }
      if (acct === "suspended") { return { status: 403, body: { code: "placement_suspended", message: "Account is suspended." } }; }
      if (acct !== "active") { return { status: 403, body: { code: "placement_subscription_required", message: "Active subscription required." } }; }
      var nowMs = Date.now();
      var hasValid = false;
      try {
        var userIdStr = String(ev.auth.id || "");
        var subs = $app.findRecordsByFilter(SUBS_C, "user = {:uid} && status = 'active'", "", 0, 0, { uid: userIdStr });
        for (var si = 0; si < subs.length; si++) {
          var s = subs[si];
          var expStr = String(s.get("expires_at") || "");
          var startStr = String(s.get("starts_at") || "");
          if (!expStr || !startStr) continue;
          var expMs = new Date(expStr).getTime();
          var startMs = new Date(startStr).getTime();
          if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) { hasValid = true; break; }
        }
      } catch (_) {}
      if (!hasValid) { return { status: 403, body: { code: "placement_subscription_required", message: "Active subscription required." } }; }
      return null;
    }

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

    // Safely parse a JSON string. Returns null on failure.
    function safeParse(str) {
      if (typeof str !== "string" || str === "" || str === "null" || str === "undefined") return null;
      try { return JSON.parse(str); } catch (_) { return null; }
    }

    // Validate that value is a plain array with exactly 2-6 option objects.
    // Each option must have non-empty id and text, no HTML.
    function validateOptions(arr) {
      if (!Array.isArray(arr)) return false;
      if (arr.length < 2 || arr.length > 6) return false;
      var seen = {};
      for (var oi = 0; oi < arr.length; oi++) {
        var opt = arr[oi];
        if (!opt || typeof opt !== "object") return false;
        var oid = String(opt.id || "");
        var txt = String(opt.text || "");
        if (!oid || !txt) return false;
        if (seen[oid]) return false;
        seen[oid] = true;
        // Reject raw HTML
        if (txt.indexOf("<") >= 0 && txt.indexOf(">") >= 0) return false;
        if (txt.length > 500) return false;
      }
      return true;
    }

    // Build a sanitized question for the student response.
    function sanitizeForStudent(q) {
      if (!q) return null;
      return {
        id: String(q.questionId || q.id || ""),
        position: Number(q.position || 0),
        prompt: String(q.prompt || ""),
        options: q.options || [],
      };
    }

    function buildResponse(rec, qs, ans) {
      var ans2 = ans || {};
      var count = 0; for (var k in ans2) { if (ans2.hasOwnProperty(k)) count++; }
      return {
        kind: rec.get("status") === "submitted" ? "submitted" : "in_progress",
        attempt: {
          id: String(rec.id || ""), status: String(rec.get("status") || ""),
          revision: Number(rec.get("revision") || 0), answeredCount: count, totalQuestions: TOTAL_Q,
          startedAt: rec.get("started_at") || null, lastSavedAt: rec.get("last_saved_at") || null,
          submittedAt: rec.get("submitted_at") || null,
          score: rec.get("score") !== null && rec.get("score") !== undefined ? Number(rec.get("score")) : null,
          maxScore: rec.get("max_score") !== null && rec.get("max_score") !== undefined ? Number(rec.get("max_score")) : null,
        },
        questions: qs || [], answers: ans2,
      };
    }

    try {
      var authErr = checkEligibility(e);
      if (authErr) return e.json(authErr.status, authErr.body);

      var rateErr = checkRate(String(e.auth.id || ""));
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      var uid = String(e.auth.id || "");

      // Check existing attempt
      var existing = null;
      try { var hits = $app.findRecordsByFilter(ATTEMPTS_C, "user = {:uid}", "", 1, 0, { uid: uid }); if (hits && hits.length > 0) existing = hits[0]; } catch (_) {}

      if (existing) {
        var st = String(existing.get("status") || "");
        if (st === "submitted") { return e.json(200, buildResponse(existing, [], {})); }

        // Read from text fields (not deprecated JSON fields)
        var snapText = "";
        try { snapText = String(existing.get("question_snapshot_text") || ""); } catch (_) { snapText = ""; }
        var ansText = "";
        try { ansText = String(existing.get("answers_text") || ""); } catch (_) { ansText = ""; }

        var snapshot = safeParse(snapText);
        if (!Array.isArray(snapshot) || snapshot.length !== TOTAL_Q) {
          return e.json(503, { code: "placement_unavailable", message: "Placement data is corrupted. Please contact support." });
        }

        var answers = safeParse(ansText);
        if (!answers || typeof answers !== "object" || Array.isArray(answers)) { answers = {}; }

        var qs = [];
        for (var sji = 0; sji < snapshot.length; sji++) { qs.push(sanitizeForStudent(snapshot[sji])); }
        return e.json(200, buildResponse(existing, qs, answers));
      }

      // --- Create new attempt ---

      // Load active questions (outside transaction for simplicity)
      var questions = null;
      try {
        questions = $app.findRecordsByFilter("placement_questions", "is_active = true", "position", 0, 0);
      } catch (qe) {
        var qeMsg = String(qe && qe.message ? qe.message : String(qe));
        return e.json(500, { code: "qe", message: qeMsg });
      }
      if (!questions) { return e.json(500, { code: "null_questions" }); }
      var qActual = questions.length;
      if (qActual < 20) {
        return e.json(503, { code: "placement_unavailable", message: "Not enough questions: " + qActual });
      }
      // Sort by position
      questions.sort(function(a, b) { return Number(a.get("position") || 0) - Number(b.get("position") || 0); });

      // Build snapshot reading options from options_text
      var snapshot = [];
      var seenPos = {};
      for (var qi2 = 0; qi2 < questions.length; qi2++) {
        var q = questions[qi2];
        var pos = Number(q.get("position") || 0);
        if (pos < 1 || pos > TOTAL_Q || seenPos[pos]) { return e.json(503, { code: "placement_unavailable", message: "Invalid position" }); }
        seenPos[pos] = true;

        // Read options from Text field (not deprecated JSON field)
        var optsRaw = "";
        try { optsRaw = String(q.get("options_text") || ""); } catch (_) { optsRaw = ""; }
        var optsArr = safeParse(optsRaw);
        if (!validateOptions(optsArr)) {
          return e.json(503, { code: "placement_unavailable", message: "Invalid options for question " + pos });
        }

        var correctId = String(q.get("correct_option_id") || "");
        // Validate that correctOptionId references an existing option
        var correctFound = false;
        for (var oci = 0; oci < optsArr.length; oci++) {
          if (String(optsArr[oci].id) === correctId) { correctFound = true; break; }
        }
        if (!correctFound) {
          return e.json(503, { code: "placement_unavailable", message: "Invalid correct option for question " + pos });
        }

        snapshot.push({
          questionId: String(q.id || ""),
          questionKey: String(q.get("question_key") || ""),
          version: Number(q.get("version") || 1),
          position: pos,
          prompt: String(q.get("prompt") || ""),
          options: optsArr,
          correctOptionId: correctId,
        });
      }
      for (var pi = 1; pi <= TOTAL_Q; pi++) { if (!seenPos[pi]) return e.json(503, { code: "placement_unavailable", message: "Incomplete" }); }

      // Create attempt via transaction
      var txResult = null;
      $app.runInTransaction(function (txApp) {
        // Re-check for concurrent creates inside transaction
        var dh = null; try { dh = txApp.findRecordsByFilter(ATTEMPTS_C, "user = {:uid}", "", 1, 0, { uid: uid }); } catch (_) {}
        if (dh && dh.length > 0) {
          var d = dh[0]; var ds = String(d.get("status") || "");
          if (ds === "submitted") { txResult = { kind: "resumed", data: buildResponse(d, [], {}) }; return; }
          var dSnapText = "";
          try { dSnapText = String(d.get("question_snapshot_text") || ""); } catch (_) { dSnapText = ""; }
          var dSnap = safeParse(dSnapText);
          var dAnsText = "";
          try { dAnsText = String(d.get("answers_text") || ""); } catch (_) { dAnsText = ""; }
          var dAns = safeParse(dAnsText);
          if (!dAns || typeof dAns !== "object" || Array.isArray(dAns)) dAns = {};
          var dqs = [];
          if (Array.isArray(dSnap)) { for (var dqi = 0; dqi < dSnap.length; dqi++) { dqs.push(sanitizeForStudent(dSnap[dqi])); } }
          txResult = { kind: "resumed", data: buildResponse(d, dqs, dAns) }; return;
        }

        var nowStr = new Date().toISOString();
        var coll = $app.findCollectionByNameOrId(ATTEMPTS_C);
        var rec = new Record(coll);
        rec.set("user", uid);
        rec.set("status", "in_progress");
        // Store snapshot and answers as JSON strings in Text fields
        rec.set("question_snapshot_text", JSON.stringify(snapshot));
        rec.set("answers_text", "{}");
        rec.set("revision", 1);
        rec.set("started_at", nowStr);
        txApp.save(rec);

        var sanitized = [];
        for (var ssi = 0; ssi < snapshot.length; ssi++) { sanitized.push(sanitizeForStudent(snapshot[ssi])); }
        txResult = { kind: "created", data: buildResponse(rec, sanitized, {}) };
      });

      if (!txResult) return e.json(500, { code: "unexpected_error", message: "Internal error." });
      return e.json(txResult.kind === "created" ? 201 : 200, txResult.data);

    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      var rawD = String(topErr && topErr.rawData ? topErr.rawData : "");
      var full = (msg + " " + rawD).toLowerCase();
      if (full.indexOf("placement_unavailable") >= 0) { return e.json(503, { code: "placement_unavailable", message: "Placement is not available at this time." }); }
      if (full.indexOf("unique") >= 0) { return e.json(409, { code: "attempt_exists", message: "An attempt already exists." }); }
      return e.json(500, { code: "unexpected_error", message: msg });
    }
  },
  $apis.requireAuth("fep_users")
);

// ---------------------------------------------------------------------
// PUT /api/fast-english/placement/attempts/{attemptId}/answer
// Save one answer with optimistic concurrency.
// ---------------------------------------------------------------------

routerAdd(
  "PUT",
  "/api/fast-english/placement/attempts/{attemptId}/answer",
  function (e) {
    var ATTEMPTS_C = "placement_attempts";
    var SUBS_C = "subscriptions";
    var TOTAL_Q = 20;

    if (typeof globalThis.__fepPlAnswer === "undefined") { globalThis.__fepPlAnswer = {}; }
    var RATE_WIN = globalThis.__fepPlAnswer;
    var RATE_MAX = 60;
    var RATE_MS = 300000;

    // --- Inline helpers ---

    function checkEligibility(ev) {
      if (!ev || !ev.auth) { return { status: 401, body: { code: "placement_auth_required", message: "Authentication required." } }; }
      var role = ""; var acct = "";
      try { role = String(ev.auth.get("role") || ""); acct = String(ev.auth.get("account_status") || ""); } catch (_) {}
      if (role !== "student") { return { status: 403, body: { code: "placement_access_denied", message: "Access denied." } }; }
      if (acct === "suspended") { return { status: 403, body: { code: "placement_suspended", message: "Account is suspended." } }; }
      if (acct !== "active") { return { status: 403, body: { code: "placement_subscription_required", message: "Active subscription required." } }; }
      var nowMs = Date.now();
      var hasValid = false;
      try { var subs = $app.findRecordsByFilter(SUBS_C, "user = {:uid} && status = 'active'", "", 0, 0, { uid: String(ev.auth.id || "") }); for (var si = 0; si < subs.length; si++) { var s = subs[si]; var expStr = String(s.get("expires_at") || ""); var startStr = String(s.get("starts_at") || ""); if (!expStr || !startStr) continue; var expMs = new Date(expStr).getTime(); var startMs = new Date(startStr).getTime(); if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) { hasValid = true; break; } } } catch (_) {}
      if (!hasValid) { return { status: 403, body: { code: "placement_subscription_required", message: "Active subscription required." } }; }
      return null;
    }

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

    function safeParse(str) {
      if (typeof str !== "string" || str === "" || str === "null" || str === "undefined") return null;
      try { return JSON.parse(str); } catch (_) { return null; }
    }

    function readBody(ev) {
      try {
        var s = readerToString(ev.request.body);
        if (!s) return null;
        return JSON.parse(s);
      } catch (_) { return null; }
    }

    function sanitizeForStudent(q) {
      if (!q) return null;
      return {
        id: String(q.questionId || q.id || ""),
        position: Number(q.position || 0),
        prompt: String(q.prompt || ""),
        options: q.options || [],
      };
    }

    function buildResponse(rec, qs, ans) {
      var ans2 = ans || {};
      var count = 0; for (var k in ans2) { if (ans2.hasOwnProperty(k)) count++; }
      return {
        kind: rec.get("status") === "submitted" ? "submitted" : "in_progress",
        attempt: {
          id: String(rec.id || ""), status: String(rec.get("status") || ""),
          revision: Number(rec.get("revision") || 0), answeredCount: count, totalQuestions: TOTAL_Q,
          startedAt: rec.get("started_at") || null, lastSavedAt: rec.get("last_saved_at") || null,
          submittedAt: rec.get("submitted_at") || null,
          score: rec.get("score") !== null && rec.get("score") !== undefined ? Number(rec.get("score")) : null,
          maxScore: rec.get("max_score") !== null && rec.get("max_score") !== undefined ? Number(rec.get("max_score")) : null,
        },
        questions: qs || [], answers: ans2,
      };
    }

    try {
      var authErr = checkEligibility(e);
      if (authErr) return e.json(authErr.status, authErr.body);

      var rateErr = checkRate(String(e.auth.id || ""));
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      var uid = String(e.auth.id || "");
      var attemptId = String(e.request.pathValue("attemptId") || "");
      if (!attemptId) return e.json(400, { code: "invalid_request", message: "Missing attemptId." });

      var body = readBody(e);
      if (!body) return e.json(400, { code: "invalid_request", message: "Invalid request body." });
      var questionId = String(body.questionId || "");
      var optionId = String(body.optionId || "");
      var expectedRevision = parseInt(String(body.expectedRevision), 10);
      if (!questionId || !optionId || isNaN(expectedRevision)) { return e.json(400, { code: "invalid_request", message: "questionId, optionId and expectedRevision are required." }); }

      // ---- Atomic compare-and-swap inside transaction ----
      var txResult = null;

      $app.runInTransaction(function (txApp) {
        var txRec = null;
        try { txRec = txApp.findRecordById(ATTEMPTS_C, attemptId); } catch (_) { txRec = null; }
        if (!txRec) throw new BadRequestError("not_found", { code: "not_found" });

        var txOwner = String(txRec.get("user") || "");
        if (txOwner !== uid) throw new BadRequestError("not_found", { code: "not_found" });

        var txStatus = String(txRec.get("status") || "");
        if (txStatus !== "in_progress") throw new BadRequestError("attempt_not_in_progress", { code: "attempt_not_in_progress" });

        // Compare revision INSIDE the transaction — two concurrent requests
        // with the same expectedRevision will see the same current revision
        // and only one will match.
        var txCurrentRev = Number(txRec.get("revision") || 0);
        if (expectedRevision !== txCurrentRev) {
          // Stale: return current state
          var snapS = "";
          try { snapS = String(txRec.get("question_snapshot_text") || ""); } catch (_) { snapS = ""; }
          var ansS = "";
          try { ansS = String(txRec.get("answers_text") || ""); } catch (_) { ansS = ""; }
          var snap = safeParse(snapS);
          var ans = safeParse(ansS);
          if (!ans || typeof ans !== "object" || Array.isArray(ans)) ans = {};
          var qs = [];
          if (Array.isArray(snap)) { for (var qi = 0; qi < snap.length; qi++) { qs.push(sanitizeForStudent(snap[qi])); } }
          txResult = { stale: true, data: buildResponse(txRec, qs, ans) };
          return;
        }

        // Parse snapshot
        var snapT2 = "";
        try { snapT2 = String(txRec.get("question_snapshot_text") || ""); } catch (_) { snapT2 = ""; }
        var snapshot = safeParse(snapT2);
        if (!Array.isArray(snapshot) || snapshot.length === 0) {
          throw new BadRequestError("invalid_request", { code: "invalid_request", message: "Corrupted attempt data." });
        }

        // Validate questionId against the snapshot
        var foundQ = null;
        for (var sqi = 0; sqi < snapshot.length; sqi++) {
          if (String(snapshot[sqi].questionId || snapshot[sqi].id) === questionId) { foundQ = snapshot[sqi]; break; }
        }
        if (!foundQ) throw new BadRequestError("invalid_question", { code: "invalid_question" });

        // Validate optionId
        var foundOpt = false;
        var opts = foundQ.options || [];
        for (var foi = 0; foi < opts.length; foi++) {
          if (String(opts[foi].id) === optionId) { foundOpt = true; break; }
        }
        if (!foundOpt) throw new BadRequestError("invalid_option", { code: "invalid_option" });

        // Parse current answers
        var ansT2 = "";
        try { ansT2 = String(txRec.get("answers_text") || ""); } catch (_) { ansT2 = ""; }
        var currentAnswers = safeParse(ansT2);
        if (!currentAnswers || typeof currentAnswers !== "object" || Array.isArray(currentAnswers)) { currentAnswers = {}; }

        // Clone and apply answer
        var newAnswers = {};
        for (var aKey in currentAnswers) { if (currentAnswers.hasOwnProperty(aKey)) { newAnswers[aKey] = currentAnswers[aKey]; } }
        newAnswers[questionId] = optionId;

        txRec.set("answers_text", JSON.stringify(newAnswers));
        txRec.set("revision", txCurrentRev + 1);
        txRec.set("last_saved_at", new Date().toISOString());
        txApp.save(txRec);

        // Build response
        var qs2 = [];
        for (var si2 = 0; si2 < snapshot.length; si2++) { qs2.push(sanitizeForStudent(snapshot[si2])); }
        txResult = { stale: false, data: buildResponse(txRec, qs2, newAnswers) };
      });

      if (!txResult) return e.json(500, { code: "unexpected_error", message: "Internal error." });
      if (txResult.stale) return e.json(409, { code: "placement_attempt_stale", message: "Attempt has been modified.", data: txResult.data });
      return e.json(200, txResult.data);

    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      var rawD = String(topErr && topErr.rawData ? topErr.rawData : "");
      var full = (msg + " " + rawD).toLowerCase();
      var codeMap2 = { not_found: 404, attempt_not_in_progress: 409, invalid_question: 400, invalid_option: 400, invalid_request: 400 };
      for (var ec2 in codeMap2) { if (full.indexOf(ec2) >= 0) { return e.json(codeMap2[ec2], { code: ec2, message: msg }); } }
      return e.json(500, { code: "unexpected_error", message: msg });
    }
  },
  $apis.requireAuth("fep_users")
);

// ---------------------------------------------------------------------
// POST /api/fast-english/placement/attempts/{attemptId}/submit
// Final submission and server-side grading.
// ---------------------------------------------------------------------

routerAdd(
  "POST",
  "/api/fast-english/placement/attempts/{attemptId}/submit",
  function (e) {
    var ATTEMPTS_C = "placement_attempts";
    var SUBS_C = "subscriptions";
    var TOTAL_Q = 20;

    if (typeof globalThis.__fepPlSubmit === "undefined") { globalThis.__fepPlSubmit = {}; }
    var RATE_WIN = globalThis.__fepPlSubmit;
    var RATE_MAX = 5;
    var RATE_MS = 300000;

    // --- Inline helpers ---

    function checkEligibility(ev) {
      if (!ev || !ev.auth) { return { status: 401, body: { code: "placement_auth_required", message: "Authentication required." } }; }
      var role = ""; var acct = "";
      try { role = String(ev.auth.get("role") || ""); acct = String(ev.auth.get("account_status") || ""); } catch (_) {}
      if (role !== "student") { return { status: 403, body: { code: "placement_access_denied", message: "Access denied." } }; }
      if (acct === "suspended") { return { status: 403, body: { code: "placement_suspended", message: "Account is suspended." } }; }
      if (acct !== "active") { return { status: 403, body: { code: "placement_subscription_required", message: "Active subscription required." } }; }
      var nowMs = Date.now();
      var hasValid = false;
      try { var subs = $app.findRecordsByFilter(SUBS_C, "user = {:uid} && status = 'active'", "", 0, 0, { uid: String(ev.auth.id || "") }); for (var si = 0; si < subs.length; si++) { var s = subs[si]; var expStr = String(s.get("expires_at") || ""); var startStr = String(s.get("starts_at") || ""); if (!expStr || !startStr) continue; var expMs = new Date(expStr).getTime(); var startMs = new Date(startStr).getTime(); if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) { hasValid = true; break; } } } catch (_) {}
      if (!hasValid) { return { status: 403, body: { code: "placement_subscription_required", message: "Active subscription required." } }; }
      return null;
    }

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

    function safeParse(str) {
      if (typeof str !== "string" || str === "" || str === "null" || str === "undefined") return null;
      try { return JSON.parse(str); } catch (_) { return null; }
    }

    function readBody(ev) {
      try {
        var s = readerToString(ev.request.body);
        if (!s) return null;
        return JSON.parse(s);
      } catch (_) { return null; }
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

    function buildResponse(rec, qs, ans) {
      var ans2 = ans || {};
      var count = 0; for (var k in ans2) { if (ans2.hasOwnProperty(k)) count++; }
      return {
        kind: rec.get("status") === "submitted" ? "submitted" : "in_progress",
        attempt: {
          id: String(rec.id || ""), status: String(rec.get("status") || ""),
          revision: Number(rec.get("revision") || 0), answeredCount: count, totalQuestions: TOTAL_Q,
          startedAt: rec.get("started_at") || null, lastSavedAt: rec.get("last_saved_at") || null,
          submittedAt: rec.get("submitted_at") || null,
          score: rec.get("score") !== null && rec.get("score") !== undefined ? Number(rec.get("score")) : null,
          maxScore: rec.get("max_score") !== null && rec.get("max_score") !== undefined ? Number(rec.get("max_score")) : null,
        },
        questions: qs || [], answers: ans2,
      };
    }

    try {
      var authErr = checkEligibility(e);
      if (authErr) return e.json(authErr.status, authErr.body);

      var rateErr = checkRate(String(e.auth.id || ""));
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      var attemptId = String(e.request.pathValue("attemptId") || "");
      if (!attemptId) return e.json(400, { code: "invalid_request", message: "Missing attemptId." });

      var body = readBody(e);
      var expectedRevision = body && body.expectedRevision !== undefined ? parseInt(String(body.expectedRevision), 10) : -1;
      if (isNaN(expectedRevision)) { return e.json(400, { code: "invalid_request", message: "expectedRevision is required." }); }

      var rec = null; try { rec = $app.findRecordById(ATTEMPTS_C, attemptId); } catch (_) { rec = null; }
      if (!rec) return e.json(404, { code: "not_found", message: "Not found." });

      var ownerId = String(rec.get("user") || "");
      if (ownerId !== String(e.auth.id || "")) return e.json(404, { code: "not_found", message: "Not found." });

      var curStatus = String(rec.get("status") || "");
      if (curStatus === "submitted") { return e.json(200, buildResponse(rec, [], {})); }
      if (curStatus !== "in_progress") { return e.json(409, { code: "attempt_not_in_progress", message: "Attempt is not in progress." }); }

      var currentRev = Number(rec.get("revision") || 0);
      if (expectedRevision !== currentRev) {
        var snapT = "";
        try { snapT = String(rec.get("question_snapshot_text") || ""); } catch (_) { snapT = ""; }
        var ansT = "";
        try { ansT = String(rec.get("answers_text") || ""); } catch (_) { ansT = ""; }
        var sn = safeParse(snapT);
        var an = safeParse(ansT);
        if (!an || typeof an !== "object" || Array.isArray(an)) an = {};
        return e.json(409, { code: "placement_attempt_stale", message: "Attempt has been modified.", data: buildResponse(rec, [], an) });
      }

      // Transactional submission & grading
      var txRes = null;

      $app.runInTransaction(function (txApp) {
        var txRec = null; try { txRec = txApp.findRecordById(ATTEMPTS_C, attemptId); } catch (_) {}
        if (!txRec) throw new BadRequestError("not_found", { code: "not_found" });

        var txSt = String(txRec.get("status") || "");
        if (txSt === "submitted") { txRes = buildResponse(txRec, [], {}); return; }
        if (txSt !== "in_progress") throw new BadRequestError("attempt_not_in_progress", { code: "attempt_not_in_progress" });

        // Read snapshot from text field
        var snapTxt = "";
        try { snapTxt = String(txRec.get("question_snapshot_text") || ""); } catch (_) { snapTxt = ""; }
        var snapshot = safeParse(snapTxt);
        if (!Array.isArray(snapshot) || snapshot.length !== TOTAL_Q) throw new BadRequestError("invalid_snapshot", { code: "invalid_snapshot" });

        // Read answers from text field
        var ansTxt = "";
        try { ansTxt = String(txRec.get("answers_text") || ""); } catch (_) { ansTxt = ""; }
        var answers = safeParse(ansTxt);
        if (!answers || typeof answers !== "object" || Array.isArray(answers)) answers = {};

        var answeredCount = 0; for (var ak in answers) { if (answers.hasOwnProperty(ak)) answeredCount++; }
        if (answeredCount < TOTAL_Q) throw new BadRequestError("incomplete_attempt", { code: "incomplete_attempt" });

        // Grade: each correct answer increments score
        var score = 0;
        for (var gi = 0; gi < snapshot.length; gi++) {
          var q = snapshot[gi];
          var qid = String(q.questionId || q.id || "");
          var correct = q.correctOptionId || "";
          var studentAns = answers[qid];
          if (typeof studentAns === "string" && studentAns === correct) score++;
        }

        // P2-S2: Calculate suggested level from score
        var suggestedLevel = scoreToLevel(score);

        var nowStr = new Date().toISOString();
        txRec.set("status", "submitted");
        txRec.set("score", score);
        txRec.set("max_score", TOTAL_Q);
        txRec.set("submitted_at", nowStr);
        if (suggestedLevel) {
          txRec.set("suggested_level", suggestedLevel);
        }
        txApp.save(txRec);

        txRes = buildResponse(txRec, [], {});
      });

      if (!txRes) return e.json(500, { code: "unexpected_error", message: "Internal error." });
      return e.json(200, txRes);

    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      var rawD = String(topErr && topErr.rawData ? topErr.rawData : "");
      var full = (msg + " " + rawD).toLowerCase();
      var codeMap = { not_found: 404, attempt_not_in_progress: 409, invalid_snapshot: 500, incomplete_attempt: 409 };
      for (var ec in codeMap) { if (full.indexOf(ec) >= 0) { return e.json(codeMap[ec], { code: ec, message: msg }); } }
      return e.json(500, { code: "unexpected_error", message: msg });
    }
  },
  $apis.requireAuth("fep_users")
);
