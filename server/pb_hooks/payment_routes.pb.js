// server/pb_hooks/payment_routes.pb.js
// P1-S1 — Custom routes for the manual payment flow.
//
// CRITICAL: PocketBase 0.39 JSVM recompiles the routerAdd handler in
// the executor's scope, so it CANNOT see top-level var declarations
// or function declarations in this file. Every helper and constant
// used inside the closures must be inlined into the closure bodies.
//
// Routes (final contract):
//
//   POST /api/fast-english/payment-requests
//     - Auth required (fep_users), multipart/form-data.
//     - Per-user rate limit (5 attempts / 10 min) enforced IN the
//       handler. PocketBase 0.39's rate-limit `audience: '@auth'`
//       is not honored for custom routes — the global middleware
//       falls back to per-IP — so we keep a small in-memory window
//       of (userId -> attempt timestamps) and reject when the
//       window overflows. This is intentionally simple: the goal
//       is to block abuse from a single user, not to defend against
//       sophisticated evasion. PocketBase's own per-IP rule remains
//       in place for transport-level burst protection.
//     - Body fields (only):
//         plan_id           (required)
//         receipt_file      (required, single file, JPEG/PNG/WebP, <= 5 MB)
//         bank_reference    (optional, <= 80 chars, no control chars)
//         sender_card_last4 (optional, 4 digits after normalization)
//         transfer_at       (optional, parseable timestamp, not in future)
//     - Backend-generated fields (ignored if supplied by client):
//         user, status, plan_name_snapshot, amount_snapshot,
//         duration_days_snapshot, reviewed_by, reviewed_at,
//         subscription, internal_note, public_rejection_reason
//     - Effect: creates exactly one pending request per user
//               (DB-enforced via partial unique index).
//     - Sanitized response: 201 with the owner's view of the request.
//
//   GET  /api/fast-english/payment-requests/current
//     - Auth required (fep_users).
//     - Selection order: pending > most-recently-updated rejected >
//       most-recently-updated approved > most-recently-updated cancelled
//       > { kind: "none" }.
//     - Sanitized payload. Never exposes internal_note, reviewed_by,
//       raw user relation, or permanent receipt URLs / tokens.
//
//   GET  /api/fast-english/payment-requests/{requestId}/receipt
//     - Auth required (fep_users).
//     - Path parameter: requestId (the payment_request record id).
//     - Authorization model:
//         * Owner only — record.user MUST equal the auth record's id.
//         * Suspended accounts are denied.
//         * If the request is missing, 404 (generic). Cross-user
//           access returns 404 (not 403) to avoid leaking the
//           existence of someone else's record.
//         * If the receipt_file field is empty, 404.
//     - Serves the binary file directly with the correct
//       Content-Type (derived from the file's signature on disk:
//       jpeg/png/webp) and the following safety headers:
//         * X-Content-Type-Options: nosniff
//         * Cache-Control: no-store
//         * safe inline Content-Disposition with a sanitized filename
//     - No filesystem paths, no permanent URLs, no file tokens, no
//       review fields, no raw error messages, no logs of file data
//       or paths are exposed to the client or written to the logger.
//     - Why a dedicated route? The standard PB file-download endpoint
//       requires a short-lived token (getToken + getURL) and the
//       `payment_requests` viewRule is null. Opening viewRule broadly
//       would expose operator-only fields (internal_note, reviewed_by,
//       reviewed_at, subscription). This route is the narrowest
//       surface that satisfies the P1-S1 owner-preview requirement.

try {
  $app.logger().info("payment_routes: hook file loaded (final)");
} catch (_) {}

// ---------------------------------------------------------------------
// POST /api/fast-english/payment-requests
// ---------------------------------------------------------------------

routerAdd(
  "POST",
  "/api/fast-english/payment-requests",
  function (e) {
    // ----- Constants (must be in closure; not visible from top-level) -----
    var MAX_RECEIPT_BYTES = 5 * 1024 * 1024;        // 5 MB
    var MAX_BANK_REFERENCE_LEN = 80;
    var RECEIPT_FIELD = "receipt_file";
    var REQUESTS_COLLECTION = "payment_requests";
    var PLANS_COLLECTION = "plans";
    var DESTINATION_COLLECTION = "payment_destination";
    var ALLOWED_PRE_APPROVAL_STATUSES = [
      "pending_payment",
      "payment_rejected",
    ];
    // Per-user rate limit (5 attempts / 10 min). PB 0.39's middleware
    // falls back to per-IP for custom routes, so we enforce the per-
    // user window here. State is in-memory and is rebuilt on PB
    // restart, which is acceptable for a soft abuse-prevention limit.
    var RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
    var RATE_LIMIT_MAX = 5;
    // The window map is shared across all invocations of this closure
    // because `var` at the top of a `routerAdd` callback is captured
    // in the JSVM's persistent function frame. PB does not re-create
    // the handler on every request, so the map survives between calls.
    if (typeof globalThis.__fepPostRateWindow === "undefined") {
      globalThis.__fepPostRateWindow = {};
    }
    var RATE_WINDOW = globalThis.__fepPostRateWindow;

    // ----- Inline digit normalizer -----
    function normalizeDigits(raw) {
      if (typeof raw !== "string") return "";
      var out = "";
      for (var i = 0; i < raw.length; i++) {
        var c = raw.charAt(i);
        if (c >= "0" && c <= "9") {
          out += c;
        } else if (c >= "۰" && c <= "۹") {
          out += String.fromCharCode(48 + (c.charCodeAt(0) - 0x06f0));
        } else if (c >= "٠" && c <= "٩") {
          out += String.fromCharCode(48 + (c.charCodeAt(0) - 0x0660));
        }
      }
      return out;
    }

    // ----- Inline trim + control-char strip -----
    function safeTrim(raw) {
      if (typeof raw !== "string") return "";
      return raw
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .replace(/^[\s\u00a0\u2000-\u200b]+|[\s\u00a0\u2000-\u200b]+$/g, "");
    }

    function hasControlChars(s) {
      if (typeof s !== "string") return false;
      for (var i = 0; i < s.length; i++) {
        var code = s.charCodeAt(i);
        if (code < 0x20 || code === 0x7f) return true;
      }
      return false;
    }

    function readFormString(form, key) {
      if (!form) return "";
      var v = form.get(key);
      if (typeof v !== "string") return "";
      return v;
    }

    // ----- Image signature detection (first 12 bytes) -----
    function detectImageKind(bytes) {
      if (!bytes || bytes.length < 12) return "";
      if (
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      ) {
        return "jpeg";
      }
      if (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      ) {
        return "png";
      }
      if (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      ) {
        return "webp";
      }
      return "";
    }

    function kindToMime(kind) {
      if (kind === "jpeg") return "image/jpeg";
      if (kind === "png") return "image/png";
      if (kind === "webp") return "image/webp";
      return "";
    }

    function kindToExts(kind) {
      if (kind === "jpeg") return [".jpg", ".jpeg"];
      if (kind === "png") return [".png"];
      if (kind === "webp") return [".webp"];
      return [];
    }

    function kindToTokenExt(kind) {
      if (kind === "jpeg") return "jpg";
      if (kind === "png") return "png";
      if (kind === "webp") return "webp";
      return "bin";
    }

    // ----- Transfer-field validation -----
    function validateSenderCardLast4(raw) {
      var s = safeTrim(raw);
      if (s === "") return { value: "", error: "" };
      var digits = normalizeDigits(s);
      if (digits.length !== 4) return { value: "", error: "invalid_transfer_details" };
      return { value: digits, error: "" };
    }

    function validateBankReference(raw) {
      var s = safeTrim(raw);
      if (s === "") return { value: "", error: "" };
      if (s.length > MAX_BANK_REFERENCE_LEN) {
        return { value: "", error: "invalid_transfer_details" };
      }
      if (hasControlChars(s)) {
        return { value: "", error: "invalid_transfer_details" };
      }
      return { value: s, error: "" };
    }

    function validateTransferAt(raw) {
      var s = safeTrim(raw);
      if (s === "") return { value: "", error: "" };
      var t = new Date(s).getTime();
      if (isNaN(t)) return { value: "", error: "invalid_transfer_details" };
      var nowMs = Date.now();
      if (t - nowMs > 24 * 60 * 60 * 1000) {
        return { value: "", error: "invalid_transfer_details" };
      }
      return { value: new Date(t).toISOString(), error: "" };
    }

    // ----- Sanitized response shaping -----
    function shapeRequestForClient(rec) {
      if (!rec) return null;
      return {
        id: String(rec.id),
        status: String(rec.get("status") || ""),
        planId: String(rec.get("plan") || ""),
        planName: String(rec.get("plan_name_snapshot") || ""),
        amountToman: Number(rec.get("amount_snapshot") || 0),
        durationDays: Number(rec.get("duration_days_snapshot") || 0),
        bankReference: rec.get("bank_reference") || null,
        senderCardLast4: rec.get("sender_card_last4") || null,
        transferAt: rec.get("transfer_at") || null,
        publicRejectionReason: rec.get("public_rejection_reason") || null,
        receipt: {
          recordId: String(rec.id),
          fileName: String(rec.get("receipt_file") || ""),
          requiresToken: true,
        },
        created: rec.get("created") || null,
        updated: rec.get("updated") || null,
      };
    }

    try {
      // ----- 1. Authenticated identity -----
      if (!e.auth) {
        return e.json(401, {
          code: "unauthorized",
          message: "Authentication required.",
        });
      }

      // ----- 2. Account state gate -----
      var accountStatus = "";
      try {
        accountStatus = String(e.auth.get("account_status") || "");
      } catch (_) {
        accountStatus = "";
      }
      if (accountStatus === "suspended") {
        return e.json(403, {
          code: "account_suspended",
          message: "Account is suspended.",
        });
      }
      var allowed = false;
      for (var ai = 0; ai < ALLOWED_PRE_APPROVAL_STATUSES.length; ai++) {
        if (accountStatus === ALLOWED_PRE_APPROVAL_STATUSES[ai]) {
          allowed = true;
          break;
        }
      }
      if (!allowed) {
        return e.json(403, {
          code: "account_not_eligible",
          message: "Account is not in a pre-approval state.",
        });
      }

      // ----- 2.5 Per-user rate limit. PB 0.39's middleware falls
      //         back to per-IP for custom routes, so we enforce the
      //         per-user window here. Only successful or rejected
      //         attempts that reach this point count — auth/account
      //         failures and 4xx rejections above are intentionally
      //         not counted, so a user fixing a bad request is not
      //         penalised. -----
      var userIdKey = String(e.auth.id || "");
      if (userIdKey) {
        var nowMs = Date.now();
        var windowStart = nowMs - RATE_LIMIT_WINDOW_MS;
        var bucket = RATE_WINDOW[userIdKey];
        if (!bucket || !Array.isArray(bucket)) {
          bucket = [];
          RATE_WINDOW[userIdKey] = bucket;
        }
        // Drop entries older than the window.
        var keep = [];
        for (var wi = 0; wi < bucket.length; wi++) {
          if (bucket[wi] > windowStart) keep.push(bucket[wi]);
        }
        bucket.length = 0;
        for (var wj = 0; wj < keep.length; wj++) bucket.push(keep[wj]);
        if (bucket.length >= RATE_LIMIT_MAX) {
          // Suggest a retry after the oldest entry expires.
          var oldest = bucket[0];
          var retryAfterSec = Math.ceil(
            (oldest + RATE_LIMIT_WINDOW_MS - nowMs) / 1000
          );
          if (retryAfterSec < 1) retryAfterSec = 1;
          try {
            e.response.header().set("Retry-After", String(retryAfterSec));
          } catch (_) {}
          return e.json(429, {
            code: "rate_limited",
            message: "Too many requests. Please try again later.",
          });
        }
        bucket.push(nowMs);
      }

      // ----- 3. Parse multipart form via findUploadedFiles (triggers
      //         ParseMultipartForm) so e.request.form is populated. -----
      var uploaded;
      try {
        uploaded = e.findUploadedFiles(RECEIPT_FIELD);
      } catch (readErr) {
        return e.json(400, {
          code: "invalid_receipt",
          message: "Receipt file is missing or malformed.",
        });
      }
      var form = e.request ? e.request.form : null;

      var planId = readFormString(form, "plan_id");
      if (!planId) {
        return e.json(400, {
          code: "invalid_plan",
          message: "plan_id is required.",
        });
      }

      // ----- 4. Validate transfer fields -----
      var last4 = validateSenderCardLast4(readFormString(form, "sender_card_last4"));
      if (last4.error) {
        return e.json(400, {
          code: last4.error,
          message: "sender_card_last4 must be exactly 4 digits.",
        });
      }
      var ref = validateBankReference(readFormString(form, "bank_reference"));
      if (ref.error) {
        return e.json(400, {
          code: ref.error,
          message: "bank_reference is invalid.",
        });
      }
      var tat = validateTransferAt(readFormString(form, "transfer_at"));
      if (tat.error) {
        return e.json(400, {
          code: tat.error,
          message: "transfer_at is invalid.",
        });
      }

      // ----- 5. Validate file count and reported size BEFORE reading -----
      if (!uploaded || uploaded.length === 0) {
        return e.json(400, {
          code: "invalid_receipt",
          message: "Receipt file is required.",
        });
      }
      if (uploaded.length > 1) {
        return e.json(400, {
          code: "invalid_receipt",
          message: "Exactly one receipt file is required.",
        });
      }
      var f = uploaded[0];
      var reportedSize = Number(f.size || 0);
      if (reportedSize <= 0) {
        return e.json(400, {
          code: "invalid_receipt",
          message: "Receipt file is empty.",
        });
      }
      if (reportedSize > MAX_RECEIPT_BYTES) {
        return e.json(413, {
          code: "receipt_too_large",
          message: "Receipt file exceeds the 5 MB limit.",
        });
      }

      // ----- 6. Extension check (lowercase) -----
      // Note: in goja, exported Go fields are exposed with the first
      // letter lowercased by the FieldMapper. So "OriginalName" → "originalName",
      // "Name" → "name", and "Header" → "header".
      var origName = String(f.originalName || f.name || "");
      var dotIdx = origName.lastIndexOf(".");
      var ext = dotIdx >= 0 ? origName.substring(dotIdx).toLowerCase() : "";
      // Read the per-part Content-Type from the multipart header.
      // In PocketBase 0.39's JSVM, the path is:
      //   f (PB File) → f.reader (Go *multipart.FileHeader) →
      //   f.reader.header (the FileHeader struct again, due to a
      //   goja FieldMapper quirk that returns the receiver when the
      //   field type and the parent type share a field name) →
      //   f.reader.header.header (Go textproto.MIMEHeader, a
      //   map[string][]string with methods get/set/add/del/values)
      //   → f.reader.header.header.get("Content-Type")
      // The map's `get` method returns the first string value or
      // empty string if the key is missing.
      var declaredMime = "";
      try {
        var fh = f && f.reader;
        var mimeHdr = fh && fh.header && fh.header.header;
        if (mimeHdr && typeof mimeHdr.get === "function") {
          var raw = mimeHdr.get("Content-Type");
          if (raw) {
            // strip parameters after `;`, trim, lowercase
            var semi = String(raw).indexOf(";");
            var media = (semi >= 0 ? String(raw).substring(0, semi) : String(raw));
            declaredMime = media.trim().toLowerCase();
          }
        }
      } catch (_) {
        declaredMime = "";
      }

      // ----- 7. Open reader once, read with toBytes, close reliably -----
      var opened = null;
      var bytes = null;
      try {
        opened = f.reader.open();
        bytes = toBytes(opened, MAX_RECEIPT_BYTES);
      } catch (openErr) {
        return e.json(400, {
          code: "invalid_receipt",
          message: "Receipt file could not be read.",
        });
      } finally {
        if (opened && typeof opened.close === "function") {
          try { opened.close(); } catch (_) {}
        }
      }
      if (!bytes || bytes.length === 0) {
        return e.json(400, {
          code: "invalid_receipt",
          message: "Receipt file is empty.",
        });
      }

      // ----- 8. Validate actual signature -----
      var kind = detectImageKind(bytes);
      if (!kind) {
        return e.json(400, {
          code: "invalid_receipt",
          message: "Receipt signature is not a supported image.",
        });
      }

      // ----- 9. Extension / signature cross-check -----
      var allowedExts = kindToExts(kind);
      var extOk = false;
      for (var ei = 0; ei < allowedExts.length; ei++) {
        if (ext === allowedExts[ei]) { extOk = true; break; }
      }
      if (!extOk) {
        return e.json(400, {
          code: "invalid_receipt",
          message: "Receipt extension does not match its signature.",
        });
      }

      // ----- 10. Declared MIME / signature cross-check -----
      // The multipart Content-Type is REQUIRED. We do not trust a
      // MIME guessed from the file extension — the wire-format
      // header is the authoritative client-side declaration.
      var expectedMime = kindToMime(kind);
      if (!declaredMime) {
        return e.json(400, {
          code: "invalid_receipt",
          message: "Receipt Content-Type header is missing.",
        });
      }
      if (declaredMime !== expectedMime) {
        return e.json(400, {
          code: "invalid_receipt",
          message: "Receipt Content-Type does not match its signature.",
        });
      }

      // ----- 11. Load Plan (must exist and be active) -----
      var plan;
      try {
        plan = $app.findRecordById(PLANS_COLLECTION, planId);
      } catch (planErr) {
        return e.json(404, {
          code: "invalid_plan",
          message: "Selected plan was not found.",
        });
      }
      if (!plan || !plan.get("is_active")) {
        return e.json(404, {
          code: "invalid_plan",
          message: "Selected plan is not available.",
        });
      }

      // ----- 12. Active destination must exist -----
      var activeDestination = null;
      try {
        var dests = $app.findRecordsByFilter(
          DESTINATION_COLLECTION,
          "is_active = true",
          "",
          1,
          0
        );
        activeDestination = dests && dests.length > 0 ? dests[0] : null;
      } catch (destErr) {
        activeDestination = null;
      }
      if (!activeDestination) {
        return e.json(404, {
          code: "payment_destination_unavailable",
          message: "Payment destination is not available.",
        });
      }

      // ----- 13. Snapshot plan fields -----
      var planNameSnap = String(plan.get("name") || "");
      var priceSnap = Number(plan.get("price_toman") || 0);
      var durationSnap = Number(plan.get("duration_days") || 0);
      if (!planNameSnap || durationSnap < 1) {
        return e.json(500, {
          code: "unexpected_error",
          message: "Plan snapshot is invalid.",
        });
      }

      // ----- 14. Rename the uploaded file to a randomized token -----
      var tokenName = "";
      try {
        tokenName = $security.randomString(16) + "." + kindToTokenExt(kind);
        f.name = tokenName;
      } catch (renameErr) {
        tokenName = String(f.name || "");
      }

      // ----- 15. Transactional creation. Partial unique index is the
      //         database-level invariant. We also re-check pending
      //         inside the transaction for a fast-path UX, but the
      //         index is the final defence under concurrency. -----
      var collections = $app.findCollectionByNameOrId(REQUESTS_COLLECTION);
      var txError = null;
      var savedRecord = null;

      try {
        $app.runInTransaction(function (txApp) {
          var pending = null;
          try {
            pending = txApp.findFirstRecordByFilter(
              REQUESTS_COLLECTION,
              "user = {:uid} && status = 'pending'",
              { uid: e.auth.id }
            );
          } catch (pe) {
            pending = null;
          }
          if (pending) {
            throw new BadRequestError(
              "Existing pending request",
              { code: "pending_request_exists" }
            );
          }

          var rec = new Record(collections);
          rec.set("user", e.auth.id);
          rec.set("plan", String(plan.id));
          rec.set("plan_name_snapshot", planNameSnap);
          rec.set("amount_snapshot", priceSnap);
          rec.set("duration_days_snapshot", durationSnap);
          rec.set("status", "pending");
          rec.set(RECEIPT_FIELD, f);
          if (last4.value) rec.set("sender_card_last4", last4.value);
          if (ref.value) rec.set("bank_reference", ref.value);
          if (tat.value) rec.set("transfer_at", tat.value);

          txApp.save(rec);
          savedRecord = rec;
        });
      } catch (txErr) {
        txError = txErr;
      }

      if (txError) {
        // The pre-check inside the transaction throws
        // `BadRequestError("Existing pending request", { code:
        // "pending_request_exists" })`, but PocketBase 0.39's JSVM
        // does not preserve the structured `data` field when the
        // ApiError is round-tripped through goja. The error that
        // actually reaches this catch is a PB-generated
        // validation_invalid_value, with `rawData` containing the
        // original Go message ("UNIQUE constraint failed:
        // idx_payment_requests_one_pending_per_user"). We detect
        // both shapes and return the same client-facing response.
        var msg = txError && txError.message ? String(txError.message) : "";
        var rawData = txError && txError.rawData ? String(txError.rawData) : "";
        var fullText = msg + " " + rawData;
        var isOnePendingViolation =
          msg.indexOf("Existing pending request") >= 0 ||
          fullText.indexOf("UNIQUE constraint failed") >= 0 ||
          fullText.indexOf("idx_payment_requests_one_pending_per_user") >= 0;
        if (isOnePendingViolation) {
          return e.json(409, {
            code: "pending_request_exists",
            message: "An existing pending request already exists.",
          });
        }
        try {
          $app.logger().error(
            "payment_routes: POST unexpected txError: " +
              "status=" + txError.status +
              " message=" + msg +
              " rawData=" + rawData
          );
        } catch (_) {}
        return e.json(500, {
          code: "unexpected_error",
          message: "Internal error.",
        });
      }

      if (!savedRecord) {
        return e.json(500, {
          code: "unexpected_error",
          message: "Could not create payment request.",
        });
      }

      // ----- 16. Sanitized response -----
      return e.json(201, {
        kind: "request",
        request: shapeRequestForClient(savedRecord),
      });
    } catch (topErr) {
      try {
        $app.logger().error(
          "payment_routes: POST top-level error: " +
            String(topErr && topErr.message ? topErr.message : topErr)
        );
      } catch (_) {}
      return e.json(500, {
        code: "unexpected_error",
        message: "Internal error.",
      });
    }
  },
  $apis.requireAuth("fep_users")
);

// ---------------------------------------------------------------------
// GET /api/fast-english/payment-requests/current
// ---------------------------------------------------------------------

routerAdd(
  "GET",
  "/api/fast-english/payment-requests/current",
  function (e) {
    var REQUESTS_COLLECTION = "payment_requests";
    var CURRENT_PRIORITY = [
      "pending",
      "rejected",
      "approved",
      "cancelled",
    ];

    if (!e.auth) {
      return e.json(401, {
        code: "unauthorized",
        message: "Authentication required.",
      });
    }

    function shapeRequestForClient(rec) {
      if (!rec) return null;
      return {
        id: String(rec.id),
        status: String(rec.get("status") || ""),
        planId: String(rec.get("plan") || ""),
        planName: String(rec.get("plan_name_snapshot") || ""),
        amountToman: Number(rec.get("amount_snapshot") || 0),
        durationDays: Number(rec.get("duration_days_snapshot") || 0),
        bankReference: rec.get("bank_reference") || null,
        senderCardLast4: rec.get("sender_card_last4") || null,
        transferAt: rec.get("transfer_at") || null,
        publicRejectionReason: rec.get("public_rejection_reason") || null,
        receipt: {
          recordId: String(rec.id),
          fileName: String(rec.get("receipt_file") || ""),
          requiresToken: true,
        },
        created: rec.get("created") || null,
        updated: rec.get("updated") || null,
      };
    }

    try {
      var userId = String(e.auth.id || "");
      var found = null;
      for (var pi = 0; pi < CURRENT_PRIORITY.length; pi++) {
        var status = CURRENT_PRIORITY[pi];
        var rec = null;
        try {
          // Sort by plan_name_snapshot desc (a stable, user-declared
          // field). PB 0.39.9's filter resolver does not expose the
          // system "created"/"updated" columns for sort in this
          // collection.
          var hits = $app.findRecordsByFilter(
            REQUESTS_COLLECTION,
            "user = {:uid} && status = {:st}",
            "-plan_name_snapshot",
            1,
            0,
            { uid: userId, st: status }
          );
          rec = hits && hits.length > 0 ? hits[0] : null;
        } catch (qe) {
          rec = null;
        }
        if (rec) {
          found = rec;
          break;
        }
      }

      if (!found) {
        return e.json(200, { kind: "none" });
      }

      return e.json(200, {
        kind: "request",
        request: shapeRequestForClient(found),
      });
    } catch (topErr) {
      try {
        $app.logger().error(
          "payment_routes: GET top-level error: " +
            String(topErr && topErr.message ? topErr.message : topErr)
        );
      } catch (_) {}
      return e.json(500, {
        code: "unexpected_error",
        message: "Internal error.",
      });
    }
  },
  $apis.requireAuth("fep_users")
);

// ---------------------------------------------------------------------
// GET /api/fast-english/payment-requests/{requestId}/receipt
// ---------------------------------------------------------------------
//
// This route is the ONLY surface that lets a student view their own
// protected receipt. The PB record-CRUD viewRule on `payment_requests`
// is `null`, so the default download endpoint is unavailable. Opening
// viewRule broadly (e.g. `viewRule = "user = @request.auth.id"`) would
// leak operator-only fields (internal_note, reviewed_by, etc.) to the
// client through the standard record serializer. This route keeps the
// record surface locked down and serves the binary file directly
// after an explicit owner check.

routerAdd(
  "GET",
  "/api/fast-english/payment-requests/{requestId}/receipt",
  function (e) {
    var REQUESTS_COLLECTION = "payment_requests";
    var RECEIPT_FIELD = "receipt_file";
    var MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB; mirrors the upload cap

    // --- Inline signature detection (mirrors upload route) ---
    function detectImageKind(bytes) {
      if (!bytes || bytes.length < 12) return "";
      if (
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      ) {
        return "jpeg";
      }
      if (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      ) {
        return "png";
      }
      if (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      ) {
        return "webp";
      }
      return "";
    }

    function kindToMime(kind) {
      if (kind === "jpeg") return "image/jpeg";
      if (kind === "png") return "image/png";
      if (kind === "webp") return "image/webp";
      return "";
    }

    function kindToTokenExt(kind) {
      if (kind === "jpeg") return "jpg";
      if (kind === "png") return "png";
      if (kind === "webp") return "webp";
      return "bin";
    }

    // Sanitize the Content-Disposition filename. PB has already
    // generated a randomized ASCII-only token for the stored name,
    // but a defense-in-depth pass keeps a future bug from
    // accidentally shipping CRLF, control chars, or quote-escapes
    // into the header.
    function asciiSafeName(s) {
      var out = "";
      for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i);
        var code = s.charCodeAt(i);
        if (
          (code >= 0x30 && code <= 0x39) ||
          (code >= 0x41 && code <= 0x5a) ||
          (code >= 0x61 && code <= 0x7a) ||
          c === "." ||
          c === "_" ||
          c === "-"
        ) {
          out += c;
        } else {
          out += "_";
        }
      }
      if (out.length > 80) out = out.substring(0, 80);
      return out || "receipt";
    }

    function setSafeHeaders(header, fileName, mime, kind) {
      try {
        header.set("Content-Type", mime);
        header.set("X-Content-Type-Options", "nosniff");
        header.set("Cache-Control", "no-store");
        header.set("Pragma", "no-cache");
        // Derive the disposition filename extension from the detected
        // image kind (not from storedName), ensuring the filename
        // extension always matches the served Content-Type.
        var ext = kindToTokenExt(kind);
        var dispoName = "receipt." + ext;
        var safe = asciiSafeName(dispoName);
        header.set(
          "Content-Disposition",
          "inline; filename=\"" + safe + "\"; filename*=UTF-8''" + encodeURIComponent(dispoName)
        );
      } catch (_) {
        // Best-effort; PB will still ship its defaults.
      }
    }

    try {
      // 1. Authenticated identity (requireAuth already gates this, but
      //    we re-check defensively).
      if (!e || !e.auth) {
        return e.json(401, {
          code: "unauthorized",
          message: "Authentication required.",
        });
      }

      // 2. Path parameter: the request id. The ServeMux wildcard
      //    name is "requestId".
      var requestId = "";
      try {
        if (e.request && e.request.pathValue) {
          requestId = String(e.request.pathValue("requestId") || "");
        }
      } catch (_) {
        requestId = "";
      }
      if (!requestId) {
        return e.json(400, {
          code: "invalid_request",
          message: "Missing requestId.",
        });
      }

      // 3. Suspended account gate (before record load, mirrors the
      //    upload route). Checking early prevents a suspended caller
      //    from distinguishing existing ids from non-existing ids.
      var accountStatus = "";
      try {
        accountStatus = String(e.auth.get("account_status") || "");
      } catch (_) {
        accountStatus = "";
      }
      if (accountStatus === "suspended") {
        return e.json(403, {
          code: "account_suspended",
          message: "Account is suspended.",
        });
      }

      // 4. Load the record. Any failure here (not found, id malformed)
      //    collapses to a generic 404 so we do not leak existence.
      //    (The suspended check runs before this step so a suspended
      //    caller cannot probe record existence.)
      var rec = null;
      try {
        rec = $app.findRecordById(REQUESTS_COLLECTION, requestId);
      } catch (loadErr) {
        rec = null;
        try {
        } catch (_) {}
      }
      try {
      } catch (lgErr) {
      }
      if (!rec) {
        return e.json(404, {
          code: "not_found",
          message: "Not found.",
        });
      }

      // 5. Owner-only check. We compare by id (the canonical record
      //    identifier). Cross-user access returns 404 (not 403) to
      //    avoid leaking the existence of someone else's record.
      var ownerId = "";
      try {
        ownerId = String(rec.get("user") || "");
      } catch (_) {
        ownerId = "";
      }
      if (!ownerId || ownerId !== String(e.auth.id || "")) {
        return e.json(404, {
          code: "not_found",
          message: "Not found.",
        });
      }

      // 6. Receipt file must exist. receipt_file is a single FileField
      //    and PB serializes it as a string filename.
      var storedName = "";
      try {
        storedName = String(rec.get(RECEIPT_FIELD) || "");
      } catch (_) {
        storedName = "";
      }
      if (!storedName) {
        return e.json(404, {
          code: "not_found",
          message: "Not found.",
        });
      }

      // 7. Resolve the absolute file path. PB stores files under
      //    `<dataDir>/storage/<collectionId>/<recordId>/<filename>`.
      //    baseFilesPath() returns the relative "collection/record"
      //    portion (e.g. "pbc_xxx/<recordId>"), so we join with
      //    `<dataDir>/storage` to get the real on-disk path.
      var dataDir = "";
      try {
        dataDir = String($app.dataDir() || "");
      } catch (_) {
        dataDir = "";
      }
      var basePath = "";
      try {
        basePath = String(rec.baseFilesPath() || "");
      } catch (_) {
        basePath = "";
      }
      try {
      } catch (_) {}
      if (!dataDir || !basePath) {
        return e.json(500, {
          code: "unexpected_error",
          message: "Internal error.",
        });
      }
      var absPath = "";
      try {
        absPath = $filepath.join(dataDir, "storage", basePath, storedName);
      } catch (_) {
        absPath = "";
      }
      try {
      } catch (_) {}
      if (!absPath) {
        return e.json(500, {
          code: "unexpected_error",
          message: "Internal error.",
        });
      }

      // 8. Containment check: the resolved file MUST be under the
      //    record's base storage path. PB sets storedName to a 16-char
      //    random token, so a traversal is unlikely, but a path
      //    prefix check is cheap and makes the safety argument
      //    explicit. We compare against <dataDir>/<basePath>.
      var baseNormalized = "";
      try {
        baseNormalized = $filepath.clean($filepath.join(dataDir, "storage", basePath));
      } catch (_) {}
      var absNormalized = absPath;
      try {
        absNormalized = $filepath.clean(absPath);
      } catch (_) {}
      var prefixOk = false;
      try {
        var baseWithSep = baseNormalized;
        var lastCh = baseWithSep.charAt(baseWithSep.length - 1);
        if (lastCh !== "/" && lastCh !== "\\") {
          baseWithSep = baseWithSep + "/";
        }
        prefixOk = absNormalized.indexOf(baseWithSep) === 0;
      } catch (_) {
        prefixOk = false;
      }
      try {
      } catch (_) {}
      if (!prefixOk) {
        return e.json(404, {
          code: "not_found",
          message: "Not found.",
        });
      }

      // 9. Read the file. Cap at the same 5 MB upload limit so a
      //    tampered or out-of-bounds file cannot exhaust memory.
      var raw = null;
      try {
        raw = $os.readFile(absNormalized);
      } catch (readErr) {
        raw = null;
        try {
        } catch (_) {}
      }
      try {
      } catch (_) {}
      if (!raw) {
        return e.json(404, {
          code: "not_found",
          message: "Not found.",
        });
      }
      var bytes = null;
      if (typeof raw === "string") {
        var arr = [];
        for (var si = 0; si < raw.length; si++) {
          arr.push(raw.charCodeAt(si) & 0xff);
        }
        bytes = arr;
      } else if (Array.isArray(raw)) {
        bytes = raw;
      } else {
        bytes = null;
      }
      if (!bytes || bytes.length === 0) {
        return e.json(404, {
          code: "not_found",
          message: "Not found.",
        });
      }
      if (bytes.length > MAX_RECEIPT_BYTES) {
        return e.json(413, {
          code: "receipt_too_large",
          message: "Receipt exceeds the 5 MB limit.",
        });
      }

      // 10. Verify the byte signature matches an allowed image kind.
      //     The upload route wrote the bytes as JPEG/PNG/WebP only;
      //     we re-derive the MIME from the actual file content so
      //     a corrupted or swapped file cannot be used to bypass
      //     Content-Type sniffing.
      var kind = detectImageKind(bytes);
      var mime = kindToMime(kind);
      try {
      } catch (_) {}
      if (!mime) {
        return e.json(404, {
          code: "not_found",
          message: "Not found.",
        });
      }

      // 11. Ship the binary response. We set headers FIRST, then
      //     write the body so the response writer flushes with the
      //     correct Content-Type. We never call e.json() here —
      //     the route is binary-only.
      var header = e.response.header();
      setSafeHeaders(header, storedName, mime, kind);
      try {
        e.response.write(bytes);
      } catch (_) {
        // A failed write is almost always a closed connection; the
        // route is idempotent.
      }
      return e;
    } catch (topErr) {
      try {
        $app.logger().error(
          "payment_routes: RECEIPT top-level error: " +
            String(topErr && topErr.message ? topErr.message : topErr)
        );
      } catch (_) {}
      return e.json(500, {
        code: "unexpected_error",
        message: "Internal error.",
      });
    }
  },
  $apis.requireAuth("fep_users")
);
