// server/pb_hooks/staff_routes.pb.js
// Podcast Slice 1 — Staff payment-review workflow (migrated from the
// legacy operator routes). Business transactions are unchanged; only the
// authorization moved from the legacy `fep_users` role check to the
// independent `staff_admins` Auth Collection (central requireStaffAdmin
// guard in guards.pb.js). API paths are preserved for contract
// compatibility; a future slice may rename the internal prefix.
//
// Routes:
//   GET    /api/fast-english/operator/payment-requests
//   GET    /api/fast-english/operator/payment-requests/{requestId}
//   GET    /api/fast-english/operator/payment-requests/{requestId}/receipt
//   POST   /api/fast-english/operator/payment-requests/{requestId}/approve
//   POST   /api/fast-english/operator/payment-requests/{requestId}/reject
//
// CRITICAL: PocketBase 0.39 JSVM recompiles the routerAdd handler in
// the executor's scope, so it CANNOT see top-level var declarations
// or function declarations. Every helper, constant, and shared state
// used inside the closures must be inlined into the closure body or
// stored via `var` in the closure frame.

try {
  $app.logger().info("staff_routes: hook file loaded");
} catch (_) {}

// ---------------------------------------------------------------------
// GET /api/fast-english/operator/payment-requests
// Paginated, searchable, filterable operator queue.
// ---------------------------------------------------------------------

routerAdd(
  "GET",
  "/api/fast-english/operator/payment-requests",
  function (e) {
    try { $app.logger().info("staff_routes: QUEUE handler entered auth=" + (!!e.auth) + " coll=" + (e.auth ? String(e.auth.collection ? (typeof e.auth.collection === 'function' ? '' : '') : '') : '')); } catch (_) {}
    var COLLECTION = "payment_requests";
    var USERS_COLLECTION = "fep_users";
    var ALLOWED_STATUS_FILTERS = { all: true, pending: true, approved: true, rejected: true, cancelled: true };

    // --- Inline operator authorizer ---
    function opCheck(ev) {
      // Central Staff guard (guards.pb.js): Auth Collection must be
      // `staff_admins` with is_active=true. Legacy fep_users role-based
      // operator tokens are rejected here. `require` is available inside
      // routerAdd closures (hook-file globals are not).
      var g = null;
      try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
      if (!g || !g.requireStaffAdmin) return { status: 500, body: { code: "unexpected_error", message: "Internal error." } };
      var r = g.requireStaffAdmin(ev);
      if (r) return { status: r.status, body: { code: r.code, message: r.message } };
      return null;
    }

    try {
      // 1. Staff auth
      var authErr = opCheck(e);
      if (authErr) return e.json(authErr.status, authErr.body);

      // 2. Parse query params with safe defaults
      var rawPage = String(e.request.formValue("page") || "1");
      var rawPerPage = String(e.request.formValue("perPage") || "20");
      var rawStatus = String(e.request.formValue("status") || "all");
      var rawSearch = String(e.request.formValue("search") || "");

      var page = parseInt(rawPage, 10);
      if (isNaN(page) || page < 1) page = 1;

      var perPage = parseInt(rawPerPage, 10);
      if (isNaN(perPage) || perPage < 1) perPage = 20;
      if (perPage > 50) perPage = 50;

      // 3. Validate status filter
      if (!ALLOWED_STATUS_FILTERS[rawStatus]) {
        return e.json(400, { code: "invalid_status", message: "Invalid status filter." });
      }

      // 4. Build filter
      var filterParts = [];
      var filterParams = {};

      if (rawStatus !== "all") {
        filterParts.push("status = {:status}");
        filterParams.status = rawStatus;
      }

      if (rawSearch) {
        var searchTerm = rawSearch.replace(/^[\s\u00a0\u2000-\u200b]+|[\s\u00a0\u2000-\u200b]+$/g, "");
        if (searchTerm.length > 100) searchTerm = searchTerm.substring(0, 100);
        if (searchTerm.length > 0) {
          filterParts.push("(bank_reference ~ {:search} || id = {:searchId})");
          filterParams.search = searchTerm;
          filterParams.searchId = searchTerm;
        }
      }

      var filterExpr = filterParts.length > 0 ? filterParts.join(" && ") : "1=1";

      // 5. Load records (acceptably capped for MVP)
      var MAX_QUEUE_LOAD = 5000;
      var allHits = [];
      try {
        allHits = $app.findRecordsByFilter(COLLECTION, filterExpr, "", 0, 0, filterParams);
        if (allHits.length > MAX_QUEUE_LOAD) {
          allHits = allHits.slice(0, MAX_QUEUE_LOAD);
        }
      } catch (qe) {
        allHits = [];
      }

      // 6. In-memory sort
      allHits.sort(function (a, b) {
        var aStatus = String(a.get("status") || "");
        var bStatus = String(b.get("status") || "");
        var aIsPending = aStatus === "pending" ? 0 : 1;
        var bIsPending = bStatus === "pending" ? 0 : 1;
        if (aIsPending !== bIsPending) return aIsPending - bIsPending;
        if (aIsPending === 0) {
          var aCreated = new Date(String(a.get("created") || "")).getTime();
          var bCreated = new Date(String(b.get("created") || "")).getTime();
          if (!isNaN(aCreated) && !isNaN(bCreated) && aCreated !== bCreated) return aCreated - bCreated;
        } else {
          var aUpd = new Date(String(a.get("updated") || "")).getTime();
          var bUpd = new Date(String(b.get("updated") || "")).getTime();
          if (!isNaN(aUpd) && !isNaN(bUpd) && aUpd !== bUpd) return bUpd - aUpd;
        }
        var aId = String(a.id || ""); var bId = String(b.id || "");
        if (aId < bId) return -1; if (aId > bId) return 1; return 0;
      });

      // 7. Paginate
      var totalItems = allHits.length;
      var totalPages = Math.max(1, Math.ceil(totalItems / perPage));
      if (page > totalPages) page = totalPages;
      var startIdx = (page - 1) * perPage;
      var pageItems = allHits.slice(startIdx, startIdx + perPage);

      // 8. Shape items
      var items = [];
      for (var ii = 0; ii < pageItems.length; ii++) {
        var rec = pageItems[ii];
        if (!rec) continue;
        var userId = String(rec.get("user") || "");
        var studentName = "";
        var maskedPhone = "";
        if (userId) {
          try {
            var userRec = $app.findRecordById(USERS_COLLECTION, userId);
            if (userRec) {
              studentName = String(userRec.get("name") || "");
              var rawPhone = String(userRec.get("phone") || "");
              if (rawPhone.length > 6) {
                maskedPhone = rawPhone.substring(0, 5) + "****" + rawPhone.substring(rawPhone.length - 1);
              } else { maskedPhone = rawPhone; }
            }
          } catch (_) {}
        }
        var createdStr = String(rec.get("created") || "");
        var nowMs = Date.now();
        var createdMs = new Date(createdStr).getTime();
        var requestAgeSeconds = !isNaN(createdMs) ? Math.floor((nowMs - createdMs) / 1000) : 0;
        var reviewedAt = null;
        var publicReason = null;
        try { var rawReviewed = rec.get("reviewed_at"); if (rawReviewed) reviewedAt = String(rawReviewed); } catch (_) {}
        try { var rawReason = rec.get("public_rejection_reason"); if (rawReason) publicReason = String(rawReason); } catch (_) {}

        items.push({
          id: String(rec.id || ""),
          status: String(rec.get("status") || ""),
          created: createdStr,
          updated: String(rec.get("updated") || ""),
          requestAgeSeconds: requestAgeSeconds,
          planName: String(rec.get("plan_name_snapshot") || ""),
          amountToman: Number(rec.get("amount_snapshot") || 0),
          durationDays: Number(rec.get("duration_days_snapshot") || 0),
          bankReference: rec.get("bank_reference") || null,
          senderCardLast4: rec.get("sender_card_last4") || null,
          transferAt: rec.get("transfer_at") || null,
          student: { id: userId, name: studentName, maskedPhone: maskedPhone },
          review: reviewedAt ? { reviewedAt: reviewedAt, publicRejectionReason: publicReason } : null,
        });
      }

      return e.json(200, {
        page: page, perPage: perPage, totalItems: totalItems, totalPages: totalPages, items: items,
      });
    } catch (topErr) {
      try { $app.logger().error("staff_routes: QUEUE error: " + String(topErr && topErr.message ? topErr.message : topErr)); } catch (_) {}
      try { var _stack = String(topErr && topErr.stack ? topErr.stack : ''); $app.logger().error("staff_routes: QUEUE stack: " + _stack.slice(0, 800)); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("staff_admins")
);

// ---------------------------------------------------------------------
// GET /api/fast-english/operator/payment-requests/{requestId}
// Full sanitized detail for one payment request.
// ---------------------------------------------------------------------

routerAdd(
  "GET",
  "/api/fast-english/operator/payment-requests/{requestId}",
  function (e) {
    var COLLECTION = "payment_requests";
    var USERS_COLLECTION = "fep_users";
    var STAFF_COLLECTION = "staff_admins";
    var SUBS_COLLECTION = "subscriptions";

    function opCheck(ev) {
      // Central Staff guard (guards.pb.js): Auth Collection must be
      // `staff_admins` with is_active=true. Legacy fep_users role-based
      // operator tokens are rejected here. `require` is available inside
      // routerAdd closures (hook-file globals are not).
      var g = null;
      try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
      if (!g || !g.requireStaffAdmin) return { status: 500, body: { code: "unexpected_error", message: "Internal error." } };
      var r = g.requireStaffAdmin(ev);
      if (r) return { status: r.status, body: { code: r.code, message: r.message } };
      return null;
    }

    try {
      var authErr = opCheck(e);
      if (authErr) return e.json(authErr.status, authErr.body);

      var requestId = String(e.request.pathValue("requestId") || "");
      if (!requestId) return e.json(400, { code: "invalid_request", message: "Missing request ID." });

      var rec = null;
      try { rec = $app.findRecordById(COLLECTION, requestId); } catch (_) { rec = null; }
      if (!rec) return e.json(404, { code: "request_not_found", message: "Not found." });

      var userId = String(rec.get("user") || "");
      var student = null;
      if (userId) {
        try {
          var userRec = $app.findRecordById(USERS_COLLECTION, userId);
          if (userRec) {
            var rawPhone = String(userRec.get("phone") || "");
            var maskedPhone = rawPhone.length > 6 ? rawPhone.substring(0, 5) + "****" + rawPhone.substring(rawPhone.length - 1) : rawPhone;
            student = {
              id: String(userRec.id || ""), name: String(userRec.get("name") || ""), phone: maskedPhone,
              accountStatus: String(userRec.get("account_status") || ""),
              placementCompleted: userRec.get("placement_completed") === true,
              selectedLevel: userRec.get("selected_level") || null,
              suspended: userRec.get("account_status") === "suspended",
            };
          }
        } catch (_) {}
      }

      var reviewerId = String(rec.get("reviewed_by") || "");
      var reviewerName = "";
      if (reviewerId) { try { var revRec = $app.findRecordById(STAFF_COLLECTION, reviewerId); if (revRec) reviewerName = String(revRec.get("display_name") || ""); } catch (_) {} }

      var createdStr = String(rec.get("created") || "");
      var nowMs = Date.now();
      var createdMs = new Date(createdStr).getTime();
      var requestAgeSeconds = !isNaN(createdMs) ? Math.floor((nowMs - createdMs) / 1000) : 0;

      // Subscription context — currentActiveSubscription is the valid row
      // with the greatest expires_at (deterministic, not the first match).
      var currentActiveSub = null;
      var latestSub = null;
      try {
        var subs = $app.findRecordsByFilter(SUBS_COLLECTION, "user = {:uid}", "", 0, 0, { uid: userId });
        if (subs && subs.length > 0) {
          latestSub = subs[0];
          var bestExpMs = -1;
          for (var si = 0; si < subs.length; si++) {
            var s = subs[si];
            var sStatus = String(s.get("status") || "");
            if (sStatus === "active") {
              var expStr = String(s.get("expires_at") || "");
              var expMs = new Date(expStr).getTime();
              var startStr = String(s.get("starts_at") || "");
              var startMs = new Date(startStr).getTime();
              if (!isNaN(expMs) && expMs > nowMs && !isNaN(startMs) && startMs <= nowMs && expMs > bestExpMs) {
                bestExpMs = expMs;
                currentActiveSub = {
                  id: String(s.id || ""), startsAt: startStr,
                  expiresAt: expStr, status: sStatus,
                  planName: String(s.get("plan_name_snapshot") || ""),
                  durationDays: Number(s.get("duration_days_snapshot") || 0),
                };
              }
            }
          }
        }
      } catch (_) {}

      return e.json(200, {
        id: String(rec.id || ""), status: String(rec.get("status") || ""),
        created: createdStr, updated: String(rec.get("updated") || ""),
        requestAgeSeconds: requestAgeSeconds,
        planId: String(rec.get("plan") || ""),
        planName: String(rec.get("plan_name_snapshot") || ""),
        amountToman: Number(rec.get("amount_snapshot") || 0),
        durationDays: Number(rec.get("duration_days_snapshot") || 0),
        bankReference: rec.get("bank_reference") || null,
        senderCardLast4: rec.get("sender_card_last4") || null,
        transferAt: rec.get("transfer_at") || null,
        publicRejectionReason: rec.get("public_rejection_reason") || null,
        internalNote: rec.get("internal_note") || null,
        reviewedAt: rec.get("reviewed_at") || null,
        reviewer: reviewerName ? { id: reviewerId, name: reviewerName } : null,
        subscriptionId: rec.get("subscription") || null,
        student: student,
        currentActiveSubscription: currentActiveSub,
        latestSubscription: latestSub ? {
          id: String(latestSub.id || ""), startsAt: String(latestSub.get("starts_at") || ""),
          expiresAt: String(latestSub.get("expires_at") || ""), status: String(latestSub.get("status") || ""),
          planName: String(latestSub.get("plan_name_snapshot") || ""),
          durationDays: Number(latestSub.get("duration_days_snapshot") || 0),
        } : null,
      });
    } catch (topErr) {
      try { $app.logger().error("staff_routes: DETAIL error: " + String(topErr && topErr.message ? topErr.message : topErr)); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("staff_admins")
);

// ---------------------------------------------------------------------
// GET /api/fast-english/operator/payment-requests/{requestId}/receipt
// Operator-specific protected receipt endpoint.
// ---------------------------------------------------------------------

routerAdd(
  "GET",
  "/api/fast-english/operator/payment-requests/{requestId}/receipt",
  function (e) {
    var COLLECTION = "payment_requests";
    var RECEIPT_FIELD = "receipt_file";
    var MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

    // --- Inline image detection (same logic as student route) ---
    function detectImageKind(bytes) {
      if (!bytes || bytes.length < 12) return "";
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
          bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "png";
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
          bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
      return "";
    }
    function kindToMime(k) { if (k === "jpeg") return "image/jpeg"; if (k === "png") return "image/png"; if (k === "webp") return "image/webp"; return ""; }
    function kindToExt(k) { if (k === "jpeg") return "jpg"; if (k === "png") return "png"; if (k === "webp") return "webp"; return "bin"; }
    function asciiSafe(s) { var o = ""; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if ((c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || s.charAt(i) === "." || s.charAt(i) === "_" || s.charAt(i) === "-") o += s.charAt(i); else o += "_"; } return (o.length > 80 ? o.substring(0, 80) : o) || "receipt"; }

    function setSafeHeaders(header, mime, kind) {
      try {
        header.set("Content-Type", mime);
        header.set("X-Content-Type-Options", "nosniff");
        header.set("Cache-Control", "no-store");
        header.set("Pragma", "no-cache");
        var dispoName = "receipt." + kindToExt(kind);
        var safe = asciiSafe(dispoName);
        header.set("Content-Disposition", "inline; filename=\"" + safe + "\"; filename*=UTF-8''" + encodeURIComponent(dispoName));
      } catch (_) {}
    }

    function opCheck(ev) {
      // Central Staff guard (guards.pb.js): Auth Collection must be
      // `staff_admins` with is_active=true. Legacy fep_users role-based
      // operator tokens are rejected here. `require` is available inside
      // routerAdd closures (hook-file globals are not).
      var g = null;
      try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
      if (!g || !g.requireStaffAdmin) return { status: 500, body: { code: "unexpected_error", message: "Internal error." } };
      var r = g.requireStaffAdmin(ev);
      if (r) return { status: r.status, body: { code: r.code, message: r.message } };
      return null;
    }

    try {
      var authErr = opCheck(e);
      if (authErr) return e.json(authErr.status, authErr.body);

      var requestId = String(e.request.pathValue("requestId") || "");
      if (!requestId) return e.json(400, { code: "invalid_request", message: "Missing request ID." });

      var rec = null;
      try { rec = $app.findRecordById(COLLECTION, requestId); } catch (_) { rec = null; }
      if (!rec) return e.json(404, { code: "not_found", message: "Not found." });

      var storedName = "";
      try { storedName = String(rec.get(RECEIPT_FIELD) || ""); } catch (_) { storedName = ""; }
      if (!storedName) return e.json(404, { code: "not_found", message: "Not found." });

      var dataDir = ""; try { dataDir = String($app.dataDir() || ""); } catch (_) {}
      var basePath = ""; try { basePath = String(rec.baseFilesPath() || ""); } catch (_) {}
      if (!dataDir || !basePath) return e.json(500, { code: "unexpected_error", message: "Internal error." });

      var absPath = ""; try { absPath = $filepath.join(dataDir, "storage", basePath, storedName); } catch (_) {}
      if (!absPath) return e.json(500, { code: "unexpected_error", message: "Internal error." });

      var baseNorm = ""; try { baseNorm = $filepath.clean($filepath.join(dataDir, "storage", basePath)); } catch (_) {}
      var absNorm = absPath; try { absNorm = $filepath.clean(absPath); } catch (_) {}
      var prefixOk = false;
      try { var sep = baseNorm; var lc = sep.charAt(sep.length - 1); if (lc !== "/" && lc !== "\\") sep += "/"; prefixOk = absNorm.indexOf(sep) === 0; } catch (_) { prefixOk = false; }
      if (!prefixOk) return e.json(404, { code: "not_found", message: "Not found." });

      var raw = null; try { raw = $os.readFile(absNorm); } catch (_) { raw = null; }
      if (!raw) return e.json(404, { code: "not_found", message: "Not found." });
      var bytes = null;
      if (typeof raw === "string") { var arr = []; for (var si = 0; si < raw.length; si++) arr.push(raw.charCodeAt(si) & 0xff); bytes = arr; }
      else if (Array.isArray(raw)) { bytes = raw; } else { bytes = null; }
      if (!bytes || bytes.length === 0) return e.json(404, { code: "not_found", message: "Not found." });
      if (bytes.length > MAX_RECEIPT_BYTES) return e.json(413, { code: "receipt_too_large", message: "Receipt exceeds the 5 MB limit." });

      var kind = detectImageKind(bytes);
      var mime = kindToMime(kind);
      if (!mime) return e.json(404, { code: "not_found", message: "Not found." });

      var header = e.response.header();
      setSafeHeaders(header, mime, kind);
      try { e.response.write(bytes); } catch (_) {}
      return e;
    } catch (topErr) {
      try { $app.logger().error("staff_routes: RECEIPT error: " + String(topErr && topErr.message ? topErr.message : topErr)); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("staff_admins")
);

// ---------------------------------------------------------------------
// POST /api/fast-english/operator/payment-requests/{requestId}/approve
// Atomic approval + subscription creation.
// ---------------------------------------------------------------------

routerAdd(
  "POST",
  "/api/fast-english/operator/payment-requests/{requestId}/approve",
  function (e) {
    var COLLECTION = "payment_requests";
    var USERS_COLLECTION = "fep_users";
    var STAFF_COLLECTION = "staff_admins";
    var SUBS_COLLECTION = "subscriptions";

    // Rate limit state. We check/create on globalThis inside the closure
    // so the state persists across invocations (per PB 0.39 JSVM pattern).
    if (typeof globalThis.__fepApproveLimit === "undefined") { globalThis.__fepApproveLimit = {}; }
    var RATE_WIN = globalThis.__fepApproveLimit;
    var RATE_MAX = 10;
    var RATE_MS = 10 * 60 * 1000;

    function opCheck(ev) {
      // Central Staff guard (guards.pb.js): Auth Collection must be
      // `staff_admins` with is_active=true. Legacy fep_users role-based
      // operator tokens are rejected here. `require` is available inside
      // routerAdd closures (hook-file globals are not).
      var g = null;
      try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
      if (!g || !g.requireStaffAdmin) return { status: 500, body: { code: "unexpected_error", message: "Internal error." } };
      var r = g.requireStaffAdmin(ev);
      if (r) return { status: r.status, body: { code: r.code, message: r.message } };
      return null;
    }

    function checkRate(uid) {
      if (!uid) return null;
      var now = Date.now(); var ws = now - RATE_MS;
      var b = RATE_WIN[uid]; if (!b || !Array.isArray(b)) { b = []; RATE_WIN[uid] = b; }
      var k = []; for (var wi = 0; wi < b.length; wi++) { if (b[wi] > ws) k.push(b[wi]); }
      b.length = 0; for (var wj = 0; wj < k.length; wj++) b.push(k[wj]);
      if (b.length >= RATE_MAX) {
        var retry = Math.ceil((b[0] + RATE_MS - now) / 1000); if (retry < 1) retry = 1;
        try { e.response.header().set("Retry-After", String(retry)); } catch (_) {}
        return { status: 429, body: { code: "rate_limited", message: "Too many requests. Please try again later." } };
      }
      b.push(now);
      return null;
    }

    try {
      var authErr = opCheck(e);
      if (authErr) return e.json(authErr.status, authErr.body);
      var rateErr = checkRate(String(e.auth.id || ""));
      if (rateErr) return e.json(rateErr.status, rateErr.body);
      var requestId = String(e.request.pathValue("requestId") || "");
      if (!requestId) return e.json(400, { code: "invalid_request", message: "Missing request ID." });

      var internalNote = "";
      try {
        var rawBytes = toBytes(e.request.body, 2048);
        if (rawBytes && rawBytes.length > 0) {
          var bodyStr = "";
          for (var bi = 0; bi < rawBytes.length; bi++) bodyStr += String.fromCharCode(rawBytes[bi]);
          var rb = JSON.parse(bodyStr);
          if (rb && rb.internal_note) {
            internalNote = String(rb.internal_note).replace(/^[\s\u00a0\u2000-\u200b]+|[\s\u00a0\u2000-\u200b]+$/g, "");
            if (internalNote.length > 1000) internalNote = internalNote.substring(0, 1000);
          }
        }
      } catch (_) {
        // Body is optional; ignore parse errors
      }

      var txError = null;
      var result = null;

      try {
          $app.runInTransaction(function (txApp) {
          var operatorId = String(e.auth.id || "");
          var operator = null; try { operator = txApp.findRecordById(STAFF_COLLECTION, operatorId); } catch (_) {}
          if (!operator) throw new BadRequestError("staff_access_denied", { code: "staff_access_denied" });
          var opActive = operator.get("is_active") === true;
          if (!opActive) throw new BadRequestError("staff_access_denied", { code: "staff_access_denied" });

          var rec = null; try { rec = txApp.findRecordById(COLLECTION, requestId); } catch (_) {}
          if (!rec) throw new BadRequestError("request_not_found", { code: "request_not_found" });

          var recStatus = String(rec.get("status") || "");

          // Idempotent: already approved
          if (recStatus === "approved") {
            var existingSubId = rec.get("subscription");
            if (existingSubId) {
              try {
                var existingSub = txApp.findRecordById(SUBS_COLLECTION, String(existingSubId));
                if (existingSub) {
                  result = { kind: "already_approved", id: String(existingSub.id || ""), status: String(existingSub.get("status") || ""), startsAt: String(existingSub.get("starts_at") || ""), expiresAt: String(existingSub.get("expires_at") || ""), paymentRequestId: requestId };
                  return;
                }
              } catch (_) {}
            }
            result = { kind: "already_approved", id: null, status: "approved", paymentRequestId: requestId };
            return;
          }

          if (recStatus !== "pending") throw new BadRequestError("request_not_pending", { code: "request_not_pending" });

          var studentId = String(rec.get("user") || "");
          if (!studentId) throw new BadRequestError("unexpected_error", { code: "unexpected_error" });
          var student = null; try { student = txApp.findRecordById(USERS_COLLECTION, studentId); } catch (_) {}
          if (!student) throw new BadRequestError("unexpected_error", { code: "unexpected_error" });
          if (String(student.get("account_status") || "") === "suspended") throw new BadRequestError("student_suspended", { code: "student_suspended" });

          // Check existing subscription for this request (idempotency)
          try {
            var hits = txApp.findRecordsByFilter(SUBS_COLLECTION, "payment_request = {:rid}", "", 1, 0, { rid: requestId });
            if (hits && hits.length > 0) {
              var es = hits[0];
              result = { kind: "already_approved", id: String(es.id || ""), status: String(es.get("status") || ""), startsAt: String(es.get("starts_at") || ""), expiresAt: String(es.get("expires_at") || ""), paymentRequestId: requestId };
              return;
            }
          } catch (_) {}

          var approvalTime = new Date();
          var durationDays = Number(rec.get("duration_days_snapshot") || 0);
          if (durationDays < 1) throw new BadRequestError("unexpected_error", { code: "unexpected_error" });

          // Find latest unexpired subscription
          var currentExpiry = null;
          try {
            var activeSubs = txApp.findRecordsByFilter(SUBS_COLLECTION, "user = {:uid} && status = 'active'", "-created", 0, 0, { uid: studentId });
            if (activeSubs && activeSubs.length > 0) {
              for (var si = 0; si < activeSubs.length; si++) {
                var expStr = String(activeSubs[si].get("expires_at") || "");
                if (expStr) { var expMs = new Date(expStr).getTime(); if (!isNaN(expMs) && (!currentExpiry || expMs > currentExpiry)) { currentExpiry = expMs; } }
              }
            }
          } catch (_) {}

          var startsAt = approvalTime;
          if (currentExpiry && currentExpiry > approvalTime.getTime()) startsAt = new Date(currentExpiry);
  var expiresAt = new Date(startsAt.getTime());
  expiresAt.setUTCDate(expiresAt.getUTCDate() + durationDays);

          var subsColl = $app.findCollectionByNameOrId(SUBS_COLLECTION);
          var sub = new Record(subsColl);
          sub.set("user", studentId);
          sub.set("payment_request", requestId);
          sub.set("plan", rec.get("plan"));
          sub.set("plan_name_snapshot", rec.get("plan_name_snapshot"));
          sub.set("amount_snapshot", rec.get("amount_snapshot"));
          sub.set("duration_days_snapshot", rec.get("duration_days_snapshot"));
          sub.set("starts_at", startsAt.toISOString());
          sub.set("expires_at", expiresAt.toISOString());
          sub.set("status", "active");
          sub.set("approved_by", operatorId);
          sub.set("approved_at", approvalTime.toISOString());
          txApp.save(sub);

          var subId = String(sub.id || "");

          rec.set("status", "approved");
          rec.set("reviewed_by", operatorId);
          rec.set("reviewed_at", approvalTime.toISOString());
          rec.set("subscription", subId);
          if (internalNote) rec.set("internal_note", internalNote);
          rec.set("public_rejection_reason", null);
          txApp.save(rec);

          student.set("account_status", "active");
          txApp.save(student);

          result = { kind: "approved", id: subId, status: "active", startsAt: startsAt.toISOString(), expiresAt: expiresAt.toISOString(), paymentRequestId: requestId };
        });
      } catch (txErr) {
        txError = txErr;
      }

      if (txError) {
        var msg = String(txError.message || "");
        var rawD = String(txError.rawData || "");
        var full = msg.toLowerCase() + " " + String(rawD).toLowerCase();
        var codeMap = { staff_access_denied: 403, request_not_found: 404, request_not_pending: 409, student_suspended: 409 };
        for (var ec in codeMap) { if (full.indexOf(ec) >= 0) { return e.json(codeMap[ec], { code: ec, message: msg }); } }
        if (full.indexOf("unique") >= 0) return e.json(409, { code: "subscription_conflict", message: "Subscription already exists." });
        try { $app.logger().error("staff_routes: APPROVE tx error: " + msg + " raw=" + rawD); } catch (_) {}
        return e.json(500, { code: "unexpected_error", message: "Internal error." });
      }

      if (!result) return e.json(500, { code: "unexpected_error", message: "Internal error." });
      return e.json(200, result);

    } catch (topErr) {
      try { $app.logger().error("staff_routes: APPROVE top error: " + String(topErr && topErr.message ? topErr.message : topErr)); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("staff_admins")
);

// ---------------------------------------------------------------------
// POST /api/fast-english/operator/payment-requests/{requestId}/reject
// Atomic rejection with required public reason.
// ---------------------------------------------------------------------

routerAdd(
  "POST",
  "/api/fast-english/operator/payment-requests/{requestId}/reject",
  function (e) {
    var COLLECTION = "payment_requests";
    var USERS_COLLECTION = "fep_users";
    var STAFF_COLLECTION = "staff_admins";
    var SUBS_COLLECTION = "subscriptions";

    if (typeof globalThis.__fepRejectLimit === "undefined") { globalThis.__fepRejectLimit = {}; }
    var RATE_WIN = globalThis.__fepRejectLimit;
    var RATE_MAX = 10;
    var RATE_MS = 10 * 60 * 1000;

    function opCheck(ev) {
      // Central Staff guard (guards.pb.js): Auth Collection must be
      // `staff_admins` with is_active=true. Legacy fep_users role-based
      // operator tokens are rejected here. `require` is available inside
      // routerAdd closures (hook-file globals are not).
      var g = null;
      try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
      if (!g || !g.requireStaffAdmin) return { status: 500, body: { code: "unexpected_error", message: "Internal error." } };
      var r = g.requireStaffAdmin(ev);
      if (r) return { status: r.status, body: { code: r.code, message: r.message } };
      return null;
    }

    function checkRate(uid) {
      if (!uid) return null;
      var now = Date.now(); var ws = now - RATE_MS;
      var b = RATE_WIN[uid]; if (!b || !Array.isArray(b)) { b = []; RATE_WIN[uid] = b; }
      var k = []; for (var wi = 0; wi < b.length; wi++) { if (b[wi] > ws) k.push(b[wi]); }
      b.length = 0; for (var wj = 0; wj < k.length; wj++) b.push(k[wj]);
      if (b.length >= RATE_MAX) {
        var retry = Math.ceil((b[0] + RATE_MS - now) / 1000); if (retry < 1) retry = 1;
        try { e.response.header().set("Retry-After", String(retry)); } catch (_) {}
        return { status: 429, body: { code: "rate_limited", message: "Too many requests." } };
      }
      b.push(now);
      return null;
    }

    try {
      var authErr = opCheck(e);
      if (authErr) return e.json(authErr.status, authErr.body);

      var rateErr = checkRate(String(e.auth.id || ""));
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      var requestId = String(e.request.pathValue("requestId") || "");
      if (!requestId) return e.json(400, { code: "invalid_request", message: "Missing request ID." });

      var publicRejectionReason = "";
      var internalNote = "";
      try {
        var rawBytes = toBytes(e.request.body, 2048);
        if (rawBytes && rawBytes.length > 0) {
          var bodyStr = "";
          for (var bi = 0; bi < rawBytes.length; bi++) bodyStr += String.fromCharCode(rawBytes[bi]);
          var rb = JSON.parse(bodyStr);
          if (rb && rb.public_rejection_reason) { publicRejectionReason = String(rb.public_rejection_reason).replace(/^[\s\u00a0\u2000-\u200b]+|[\s\u00a0\u2000-\u200b]+$/g, ""); }
          if (rb && rb.internal_note) { internalNote = String(rb.internal_note).replace(/^[\s\u00a0\u2000-\u200b]+|[\s\u00a0\u2000-\u200b]+$/g, ""); if (internalNote.length > 1000) internalNote = internalNote.substring(0, 1000); }
        }
      } catch (_) {}  // Parse error = treat as empty body
      if (!publicRejectionReason || publicRejectionReason.length < 3) return e.json(400, { code: "rejection_reason_required", message: "Public rejection reason is required (minimum 3 characters)." });
      if (publicRejectionReason.length > 500) publicRejectionReason = publicRejectionReason.substring(0, 500);

      var txError = null;
      var result = null;

      try {
          $app.runInTransaction(function (txApp) {
          var operatorId = String(e.auth.id || "");
          var operator = null; try { operator = txApp.findRecordById(STAFF_COLLECTION, operatorId); } catch (_) {}
          if (!operator) throw new BadRequestError("staff_access_denied", { code: "staff_access_denied" });
          var opActive = operator.get("is_active") === true;
          if (!opActive) throw new BadRequestError("staff_access_denied", { code: "staff_access_denied" });

          var rec = null; try { rec = txApp.findRecordById(COLLECTION, requestId); } catch (_) {}
          if (!rec) throw new BadRequestError("request_not_found", { code: "request_not_found" });

          var recStatus = String(rec.get("status") || "");

          // Idempotent: already rejected
          if (recStatus === "rejected") { result = { kind: "already_rejected", paymentRequestId: requestId }; return; }
          if (recStatus !== "pending") throw new BadRequestError("request_not_pending", { code: "request_not_pending" });

          var studentId = String(rec.get("user") || "");
          if (!studentId) throw new BadRequestError("unexpected_error", { code: "unexpected_error" });
          var student = null; try { student = txApp.findRecordById(USERS_COLLECTION, studentId); } catch (_) {}
          if (!student) throw new BadRequestError("unexpected_error", { code: "unexpected_error" });

          // Check no subscription exists for this request
          try {
            var existingSubs = txApp.findRecordsByFilter(SUBS_COLLECTION, "payment_request = {:rid}", "", 1, 0, { rid: requestId });
            if (existingSubs && existingSubs.length > 0) throw new BadRequestError("approval_conflict", { code: "approval_conflict" });
          } catch (subErr) {
            if (subErr instanceof BadRequestError) throw subErr;
          }

          var now = new Date();
          rec.set("status", "rejected");
          rec.set("public_rejection_reason", publicRejectionReason);
          if (internalNote) rec.set("internal_note", internalNote);
          rec.set("reviewed_by", operatorId);
          rec.set("reviewed_at", now.toISOString());
          rec.set("subscription", null);
          txApp.save(rec);

          // Determine student account status — scan ALL active rows; only
          // downgrade to payment_rejected when no row currently covers now.
          var hasActiveSub = false;
          try {
            var activeSubs = txApp.findRecordsByFilter(SUBS_COLLECTION, "user = {:uid} && status = 'active'", "", 0, 0, { uid: studentId });
            for (var si = 0; si < activeSubs.length; si++) {
              var expStr = String(activeSubs[si].get("expires_at") || "");
              var startStr = String(activeSubs[si].get("starts_at") || "");
              if (!expStr || !startStr) continue;
              var expMs = new Date(expStr).getTime();
              var startMs = new Date(startStr).getTime();
              if (!isNaN(expMs) && expMs > Date.now() && !isNaN(startMs) && startMs <= Date.now()) { hasActiveSub = true; break; }
            }
          } catch (_) {}

          if (!hasActiveSub) {
            student.set("account_status", "payment_rejected");
            txApp.save(student);
          }

          result = { kind: "rejected", paymentRequestId: requestId };
        });
      } catch (txErr) {
        txError = txErr;
      }

      if (txError) {
        var msg = String(txError.message || "");
        var rawD = String(txError.rawData || "");
        var full = msg.toLowerCase() + " " + String(rawD).toLowerCase();
        var codeMap = { staff_access_denied: 403, request_not_found: 404, request_not_pending: 409, approval_conflict: 409 };
        for (var ec in codeMap) { if (full.indexOf(ec) >= 0) { return e.json(codeMap[ec], { code: ec, message: msg }); } }
        try { $app.logger().error("staff_routes: REJECT tx error: " + msg + " raw=" + rawD); } catch (_) {}
        return e.json(500, { code: "unexpected_error", message: "Internal error." });
      }

      if (!result) return e.json(500, { code: "unexpected_error", message: "Internal error." });
      return e.json(200, result);

    } catch (topErr) {
      try { $app.logger().error("staff_routes: REJECT top error: " + String(topErr && topErr.message ? topErr.message : topErr)); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("staff_admins")
);
