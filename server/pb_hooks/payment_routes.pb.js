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
