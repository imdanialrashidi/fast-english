// server/pb_hooks/subscription_routes.pb.js
// Business Configuration slice — server-authoritative FREE plan
// activation.
//
// `price_toman = 0` on the canonical `plans` record is THE signal that a
// plan is free. This route is the ONLY path that grants a free
// entitlement:
//
//   POST /api/fast-english/subscriptions/free-activate
//     - Auth required (fep_users, role student).
//     - Body: { "plan_id": "..." } only. No price, no flag, no receipt.
//     - Server loads the CANONICAL plan record and verifies:
//         1. plan exists;
//         2. plan is active;
//         3. canonical price_toman === 0.
//       A client-submitted price/flag is never trusted.
//     - Creates ONE subscription (source='free', amount_snapshot=0,
//       starts_at=now, expires_at=now+duration) and sets
//       account_status='active' in ONE transaction.
//     - Idempotency:
//         * repeated requests → the existing free subscription is
//           returned (already_entitled), nothing new is created;
//         * concurrent requests → the partial unique index
//           idx_subscriptions_one_free_per_user is the DB backstop
//           (one free subscription per user, ever);
//         * an existing VALID entitlement (paid or free, unexpired)
//           stays authoritative — no second entitlement is minted.
//     - A user with a PENDING paid payment request cannot switch paths:
//       409 pending_request_exists (one commercial path at a time).
//     - Paid plans (price_toman > 0) are rejected with 409 not_free_plan
//       — the free path never fakes a paid purchase.
//     - The activation is audited through content_operations
//       (content_type='subscription', safe detail only, no secrets).
//
// Card-to-card enable/disable does NOT affect this route: free plans are
// free regardless of the payment-method toggle.

try {
  $app.logger().info("subscription_routes: hook file loaded");
} catch (_) {}

routerAdd(
  "POST",
  "/api/fast-english/subscriptions/free-activate",
  function (e) {
    var USERS_COLLECTION = "fep_users";
    var PLANS_COLLECTION = "plans";
    var SUBS_COLLECTION = "subscriptions";
    var REQUESTS_COLLECTION = "payment_requests";

    var rl = require(__hooks + '/rate_limit.pb.js');

    function studentCheck(ev) {
      var g = null;
      try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
      if (!g || !g.requireStudent) return { status: 500, code: "unexpected_error", message: "Internal error." };
      var r = g.requireStudent(ev);
      if (r) return { status: r.status, code: r.code, message: r.message };
      return null;
    }

    function shapeSub(rec) {
      return {
        id: String(rec.id || ""),
        planId: String(rec.get("plan") || ""),
        planName: String(rec.get("plan_name_snapshot") || ""),
        durationDays: Number(rec.get("duration_days_snapshot") || 0),
        amountToman: Number(rec.get("amount_snapshot") || 0),
        startsAt: String(rec.get("starts_at") || ""),
        expiresAt: String(rec.get("expires_at") || ""),
        status: String(rec.get("status") || ""),
        source: String(rec.get("source") || "paid"),
      };
    }

    try {
      var guardErr = studentCheck(e);
      if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });

      var rateErr = rl.checkRate(rl.window("__fepFreeActivate"), String(e.auth.id || ""), 10, 600000);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      var accountStatus = "";
      try { accountStatus = String(e.auth.get("account_status") || ""); } catch (_) {}
      if (accountStatus === "suspended") {
        return e.json(403, { code: "account_suspended", message: "Account is suspended." });
      }

      // ----- Body: plan_id only -----
      var planId = "";
      try {
        var rawBytes = toBytes(e.request.body, 4096);
        if (rawBytes && rawBytes.length > 0) {
          var bodyStr = "";
          for (var bi = 0; bi < rawBytes.length; bi++) bodyStr += String.fromCharCode(rawBytes[bi]);
          var parsed = JSON.parse(bodyStr);
          if (parsed && typeof parsed.plan_id === "string") planId = parsed.plan_id.trim();
        }
      } catch (_) {}
      if (!planId) {
        return e.json(400, { code: "invalid_plan", message: "plan_id is required." });
      }

      // ----- Canonical plan record: exists + active + price === 0 -----
      var plan = null;
      try { plan = $app.findRecordById(PLANS_COLLECTION, planId); } catch (_) { plan = null; }
      if (!plan) {
        return e.json(404, { code: "invalid_plan", message: "Selected plan was not found." });
      }
      if (!plan.get("is_active")) {
        return e.json(404, { code: "invalid_plan", message: "Selected plan is not available." });
      }
      var priceToman = Number(plan.get("price_toman") || 0);
      if (priceToman !== 0) {
        // A paid plan must never be granted through the free path.
        return e.json(409, { code: "not_free_plan", message: "این طرح رایگان نیست." });
      }
      var planName = String(plan.get("name") || "");
      var durationDays = Number(plan.get("duration_days") || 0);
      if (!planName || durationDays < 1) {
        return e.json(500, { code: "unexpected_error", message: "Internal error." });
      }

      var userId = String(e.auth.id || "");
      var now = new Date();

      var txError = null;
      var result = null;

      try {
        $app.runInTransaction(function (txApp) {
          // 0. Suspended re-check inside the transaction (TOCTOU guard
          //    against a concurrent suspension between the request gate
          //    and the write).
          var userRec = null;
          try { userRec = txApp.findRecordById(USERS_COLLECTION, userId); } catch (_) { userRec = null; }
          if (!userRec) throw new BadRequestError("unexpected_error", { code: "unexpected_error" });
          if (String(userRec.get("account_status") || "") === "suspended") {
            throw new BadRequestError("account_suspended", { code: "account_suspended" });
          }

          // 0.5 Canonical plan RE-CHECK inside the transaction: the plan
          //      record (existence, is_active, price_toman === 0) is
          //      re-loaded here so a concurrent operator price edit
          //      between the request-time read and the write cannot mint
          //      a free entitlement for a plan that is no longer free.
          //      The SNAPSHOT fields are also derived from this in-transaction
          //      read (txPlan), never from the request-time read: a concurrent
          //      name/duration edit between the two reads cannot be recorded
          //      into the minted entitlement with stale values.
          var txPlan = null;
          try { txPlan = txApp.findRecordById(PLANS_COLLECTION, planId); } catch (_) { txPlan = null; }
          if (!txPlan || !txPlan.get("is_active") || Number(txPlan.get("price_toman") || 0) !== 0) {
            throw new BadRequestError("invalid_plan", { code: "invalid_plan" });
          }
          var txPlanName = String(txPlan.get("name") || "");
          var txDurationDays = Number(txPlan.get("duration_days") || 0);
          if (!txPlanName || txDurationDays < 1) {
            throw new BadRequestError("invalid_plan", { code: "invalid_plan" });
          }
          // Expiry is derived from the in-transaction duration read so the
          // stored entitlement window always matches its snapshot.
          var txExpiresAt = new Date(now.getTime());
          txExpiresAt.setUTCDate(txExpiresAt.getUTCDate() + txDurationDays);

          // 1. Idempotency pre-check: an existing VALID entitlement is
          //    authoritative — never manufacture a second one.
          var best = null;
          var bestExpMs = -1;
          try {
            var userSubs = txApp.findRecordsByFilter(SUBS_COLLECTION, "user = {:uid}", "", 0, 0, { uid: userId });
            if (userSubs) {
              for (var si = 0; si < userSubs.length; si++) {
                var s = userSubs[si];
                if (String(s.get("status") || "") === "active") {
                  var expStr = String(s.get("expires_at") || "");
                  var expMs = new Date(expStr).getTime();
                  var startStr = String(s.get("starts_at") || "");
                  var startMs = new Date(startStr).getTime();
                  if (!isNaN(expMs) && !isNaN(startMs) && startMs <= now.getTime() && expMs > now.getTime() && expMs > bestExpMs) {
                    bestExpMs = expMs;
                    best = s;
                  }
                }
              }
            }
          } catch (_) {}
          if (best) {
            result = { kind: "already_entitled", subscription: shapeSub(best) };
            return;
          }

          // 2. One free subscription per user (index backstop + fast path).
          //    An existing free row that is NOT currently valid (expired)
          //    is a terminal honest state — `free_period_ended` — NOT a
          //    silent success. The account is transitioned to `expired`
          //    (the existing status the guards already route to /payment,
          //    where the honest renewal/unavailable panel lives), so the
          //    user is never silently trapped in `active` without an
          //    entitlement.
          var existingFree = null;
          try {
            var freeHits = txApp.findRecordsByFilter(SUBS_COLLECTION, "user = {:uid} && source = 'free'", "", 1, 0, { uid: userId });
            if (freeHits && freeHits.length > 0) existingFree = freeHits[0];
          } catch (_) {}
          if (existingFree) {
            userRec.set("account_status", "expired");
            txApp.save(userRec);
            result = { kind: "free_period_ended", subscription: shapeSub(existingFree) };
            return;
          }

          // 3. A pending PAID request means the student is already on the
          //    paid path — switching to free while it is under review
          //    would create two competing entitlements.
          var pending = null;
          try {
            pending = txApp.findFirstRecordByFilter(REQUESTS_COLLECTION, "user = {:uid} && status = 'pending'", { uid: userId });
          } catch (pe) { pending = null; }
          if (pending) {
            throw new BadRequestError("pending_request_exists", { code: "pending_request_exists" });
          }

          var subsColl = txApp.findCollectionByNameOrId(SUBS_COLLECTION);
          var sub = new Record(subsColl);
          sub.set("user", userId);
          sub.set("plan", String(txPlan.id));
          sub.set("plan_name_snapshot", txPlanName);
          sub.set("amount_snapshot", 0);
          sub.set("duration_days_snapshot", txDurationDays);
          sub.set("starts_at", now.toISOString());
          sub.set("expires_at", txExpiresAt.toISOString());
          sub.set("status", "active");
          sub.set("source", "free");
          txApp.save(sub);

          userRec.set("account_status", "active");
          txApp.save(userRec);

          result = { kind: "activated", subscription: shapeSub(sub) };
        });
      } catch (txErr) {
        txError = txErr;
      }

      if (txError) {
        var msg = String(txError.message || "");
        var rawData = String(txError.rawData || "");
        var fullText = (msg + " " + rawData).toLowerCase();
        if (fullText.indexOf("pending_request_exists") >= 0) {
          return e.json(409, { code: "pending_request_exists", message: "یک درخواست پرداخت در حال بررسی دارید." });
        }
        if (fullText.indexOf("invalid_plan") >= 0) {
          return e.json(404, { code: "invalid_plan", message: "Selected plan is not available." });
        }
        if (fullText.indexOf("account_suspended") >= 0) {
          return e.json(403, { code: "account_suspended", message: "Account is suspended." });
        }
        if (fullText.indexOf("idx_subscriptions_one_free_per_user") >= 0 || fullText.indexOf("unique constraint") >= 0 || fullText.indexOf("database is locked") >= 0 || fullText.indexOf("sqlite_busy") >= 0) {
          // Concurrent duplicate activation (or a busy-SQLite upgrade under
          // WAL): the other request won the transaction. Return the existing
          // free subscription instead of an error — idempotent from the
          // caller's perspective. A just-created row is valid by
          // construction; the same validity distinction as the
          // in-transaction pre-check is applied for consistency.
          var existing = null;
          try {
            var hits = $app.findRecordsByFilter(SUBS_COLLECTION, "user = {:uid} && source = 'free'", "", 1, 0, { uid: userId });
            if (hits && hits.length > 0) existing = hits[0];
          } catch (_) {}
          if (existing) {
            var expStr = String(existing.get("expires_at") || "");
            var expMs = new Date(expStr).getTime();
            if (isNaN(expMs) || expMs <= now.getTime()) {
              return e.json(200, { kind: "free_period_ended", subscription: shapeSub(existing) });
            }
            return e.json(200, { kind: "already_entitled", subscription: shapeSub(existing) });
          }
          try { $app.logger().error("subscription_routes: free unique violation without a row: " + fullText); } catch (_) {}
          return e.json(500, { code: "unexpected_error", message: "Internal error." });
        }
        try {
          $app.logger().error("subscription_routes: FREE tx error: " + msg + " raw=" + rawData);
        } catch (_) {}
        return e.json(500, { code: "unexpected_error", message: "Internal error." });
      }

      if (!result || !result.subscription) {
        return e.json(500, { code: "unexpected_error", message: "Internal error." });
      }

      // ----- Audit (best-effort): content_operations trail -----
      try {
        var opsColl = $app.findCollectionByNameOrId("content_operations");
        var opRec = new Record(opsColl);
        opRec.set("content_type", "subscription");
        opRec.set("record_id", String(result.subscription.id).slice(0, 64));
        opRec.set("operation", "create");
        opRec.set("detail_json", JSON.stringify({
          kind: "free_activate",
          planId: String(plan.id),
          planSlug: String(plan.get("slug") || ""),
          planName: planName,
          priceToman: 0,
          durationDays: durationDays,
          actorUserId: userId,
        }).slice(0, 2000));
        opRec.set("performed_at", new Date().toISOString());
        $app.save(opRec);
      } catch (_) {}

      return e.json(200, result);
    } catch (topErr) {
      try {
        $app.logger().error("subscription_routes: FREE top-level error: " + String(topErr && topErr.message ? topErr.message : topErr));
      } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("fep_users")
);
