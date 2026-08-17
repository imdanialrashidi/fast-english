// server/pb_hooks/business_settings_routes.pb.js
// Business Configuration slice — owner-controlled public/payment settings.
//
// Two route families:
//
//   1. Public (no auth, rate-limited by client IP):
//      GET /api/fast-english/public/settings
//        -> the single source of truth for the static Landing: active plans
//           (name/slug/duration/price/description/order) plus the canonical
//           support contact. Never returns destinations, staff data, or any
//           secret. The Landing reaches this endpoint same-origin through a
//           scoped Caddy handle on the landing domain (no CORS, no Student
//           infrastructure in the Landing bundle).
//
//   2. Staff Business Settings (requireStaffAdmin, rate-limited):
//      GET    /api/fast-english/staff/business-settings
//      POST   /api/fast-english/staff/business-settings/plans
//      PATCH  /api/fast-english/staff/business-settings/plans/:id
//      PUT    /api/fast-english/staff/business-settings/destination
//      PATCH  /api/fast-english/staff/business-settings/site
//        -> the Admin Console /settings surface (one obvious location where
//           an authorized Staff Admin manages active plans, plan prices, the
//           card-to-card destination, the review ETA text and the public
//           support/collaboration contact).
//
// Security invariants:
//   - every staff route verifies the `staff_admins` session + is_active
//     server-side (requireStaffAdmin); a UI guard is never authorization;
//   - inputs are bounded, trimmed and validated; responses are sanitized
//     (no storage names, no raw records, no credentials);
//   - the public payload contains ONLY active plans + the support contact
//     + the card-transfer availability BOOLEAN (never card details);
//   - at most one ACTIVE payment_destination at any time (activating a
//     destination deactivates the others in the same save);
//   - no secrets: this surface never reads or writes superuser credentials,
//     encryption keys, signing material, SMTP/S3/backup configuration.

try {
  $app.logger().info("business_settings_routes: hook file loaded");
} catch (_) {}

// =====================================================================
// Public settings (no auth)
// =====================================================================

routerAdd("GET", "/api/fast-english/public/settings", function (e) {
  var bs = null;
  try { bs = require(__hooks + '/business_settings_core.pb.js'); } catch (_) { bs = null; }
  if (!bs) return e.json(500, { code: "internal_error", message: "Internal error." });
  var rl = require(__hooks + '/rate_limit.pb.js');
  var pd = null;
  try { pd = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd = null; }
  var key = "unknown";
  try { key = (pd && pd.clientIp) ? pd.clientIp(e) : "unknown"; } catch (_) { key = "unknown"; }
  var rateErr = rl.checkRate(rl.window("__fepPublicSettings"), key, 60, 300000);
  if (rateErr) return e.json(rateErr.status, rateErr.body);

  var plans = [];
  var active = bs.loadActivePlans();
  for (var i = 0; i < active.length; i++) {
    var p = bs.publicPlanShape(active[i]);
    if (p) plans.push(p);
  }

  var site = bs.loadSite();
  var support = bs.siteShape(site);

  // Card-to-card availability is a BOOLEAN only — never the card
  // number/holder/bank/instructions (those are Student-surface values
  // revealed only through the active destination record). Strict
  // active-only lookup: an inactive/stored destination does NOT mean
  // card transfer is enabled.
  var cardTransferEnabled = false;
  try {
    var dests = $app.findRecordsByFilter("payment_destination", "is_active = true", "", 1, 0);
    cardTransferEnabled = !!(dests && dests.length > 0);
  } catch (_) {
    cardTransferEnabled = false;
  }

  return e.json(200, {
    plans: plans,
    support: support,
    payment: { cardTransferEnabled: cardTransferEnabled },
  });
});

// =====================================================================
// Staff Business Settings
// =====================================================================

routerAdd("GET", "/api/fast-english/staff/business-settings", function (e) {
  var bs = null;
  try { bs = require(__hooks + '/business_settings_core.pb.js'); } catch (_) { bs = null; }
  if (!bs) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = bs.guard(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = bs.rateLimit(e, "business_settings_read", 120, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var plans = [];
  var all = bs.loadPlans();
  for (var i = 0; i < all.length; i++) {
    var p = bs.planShape(all[i]);
    if (p) plans.push(p);
  }
  var destination = bs.destinationShape(bs.loadActiveDestination());
  var site = bs.siteShape(bs.loadSite());
  return e.json(200, { plans: plans, destination: destination, site: site });
});

routerAdd("POST", "/api/fast-english/staff/business-settings/plans", function (e) {
  var bs = null;
  try { bs = require(__hooks + '/business_settings_core.pb.js'); } catch (_) { bs = null; }
  if (!bs) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = bs.guard(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = bs.rateLimit(e, "business_settings_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var payload = bs.readBody(e);
  if (!payload) return e.json(400, { code: "invalid_request", message: "A JSON body is required." });

  var name = bs.textOr(payload.name, 80);
  var slug = bs.textOr(payload.slug, 64);
  var description = bs.textOr(payload.description, 500);
  // Strict numeric contract: the owner-approved launch set has exactly two
  // plans (monthly 299,000/30d, quarterly 807,300/90d) and NO yearly plan.
  // 365-day/yearly plans are rejected SERVER-side (a UI guard is never
  // authorization).
  var durationDays = payload.duration_days;
  var priceToman = payload.price_toman;
  var isActive = payload.is_active !== false;
  var displayOrder = payload.display_order;

  if (!name) return e.json(400, { code: "NAME_REQUIRED", message: "نام طرح الزامی است." });
  if (!bs.slugPatternOk(slug)) return e.json(400, { code: "SLUG_INVALID", message: "شناسه انگلیسی (slug) فقط حروف کوچک لاتین، عدد و خط تیره میپذیرد." });
  if (typeof durationDays !== "number" || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
    return e.json(400, { code: "DURATION_INVALID", message: "مدت طرح باید عدد صحیح بین ۱ تا ۳۶۵۰ روز باشد." });
  }
  if (durationDays === 365 || slug === "yearly") {
    return e.json(400, { code: "YEARLY_NOT_OFFERED", message: "طرح سالانه (۳۶۵ روز) ارائه نمیشود." });
  }
  if (typeof priceToman !== "number" || !Number.isInteger(priceToman) || priceToman < 0 || priceToman > 1000000000) {
    return e.json(400, { code: "PRICE_INVALID", message: "قیمت طرح باید عدد صحیح غیرمنفی (تومان) باشد." });
  }
  if (typeof displayOrder !== "number" || !Number.isInteger(displayOrder) || displayOrder < 0) {
    return e.json(400, { code: "ORDER_INVALID", message: "ترتیب نمایش باید عدد صحیح غیرمنفی باشد." });
  }

  var coll = null;
  try { coll = $app.findCollectionByNameOrId("plans"); } catch (_) { coll = null; }
  if (!coll) return e.json(500, { code: "internal_error", message: "Internal error." });

  // Slug uniqueness is enforced by the collection index; surface it clearly.
  var dup = null;
  try {
    dup = $app.findFirstRecordByFilter("plans", "slug = {:slug}", { slug: slug });
  } catch (_) { dup = null; }
  if (dup) return e.json(400, { code: "SLUG_DUPLICATE", message: "این slug قبلاً استفاده شده است." });

  var rec = new Record(coll);
  rec.set("name", name);
  rec.set("slug", slug);
  rec.set("duration_days", durationDays);
  rec.set("price_toman", priceToman);
  rec.set("is_active", isActive);
  rec.set("display_order", displayOrder);
  if (description) rec.set("description", description);
  try {
    $app.save(rec);
  } catch (saveErr) {
    return e.json(400, { code: "PLAN_SAVE_FAILED", message: "ذخیره طرح ممکن نشد." });
  }
  try {
    var core = bs.coreModule();
    if (core && core.audit) {
      core.audit($app, String(e.auth.id || ""), "plan", String(rec.id || ""), "create", {
        slug: slug, priceToman: priceToman, durationDays: durationDays,
      });
    }
  } catch (_) {}
  return e.json(200, { plan: bs.planShape(rec) });
});

routerAdd("PATCH", "/api/fast-english/staff/business-settings/plans/{id}", function (e) {
  var bs = null;
  try { bs = require(__hooks + '/business_settings_core.pb.js'); } catch (_) { bs = null; }
  if (!bs) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = bs.guard(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = bs.rateLimit(e, "business_settings_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var payload = bs.readBody(e);
  if (!payload) return e.json(400, { code: "invalid_request", message: "A JSON body is required." });

  var rec = null;
  try { rec = $app.findRecordById("plans", e.request.pathValue("id")); } catch (_) { rec = null; }
  if (!rec) return e.json(404, { code: "PLAN_NOT_FOUND", message: "طرح پیدا نشد." });

  if (payload.name !== undefined) {
    var name = bs.textOr(payload.name, 80);
    if (!name) return e.json(400, { code: "NAME_REQUIRED", message: "نام طرح الزامی است." });
    rec.set("name", name);
  }
  if (payload.slug !== undefined) {
    var slug = bs.textOr(payload.slug, 64);
    if (slug === 'yearly') {
      return e.json(400, { code: 'YEARLY_NOT_OFFERED', message: 'طرح سالانه ارائه نمیشود.' });
    }
    if (!bs.slugPatternOk(slug)) return e.json(400, { code: "SLUG_INVALID", message: "شناسه انگلیسی (slug) فقط حروف کوچک لاتین، عدد و خط تیره میپذیرد." });
    var dup = null;
    try {
      dup = $app.findFirstRecordByFilter("plans", "slug = {:slug} && id != {:id}", { slug: slug, id: String(rec.id || "") });
    } catch (_) { dup = null; }
    if (dup) return e.json(400, { code: "SLUG_DUPLICATE", message: "این slug قبلاً استفاده شده است." });
    rec.set("slug", slug);
  }
  if (payload.duration_days !== undefined) {
    var durationDays = payload.duration_days;
    if (typeof durationDays !== "number" || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
      return e.json(400, { code: "DURATION_INVALID", message: "مدت طرح باید عدد صحیح بین ۱ تا ۳۶۵۰ روز باشد." });
    }
    if (durationDays === 365) {
      return e.json(400, { code: "YEARLY_NOT_OFFERED", message: "طرح سالانه (۳۶۵ روز) ارائه نمیشود." });
    }
    rec.set("duration_days", durationDays);
  }
  if (payload.price_toman !== undefined) {
    var priceToman = payload.price_toman;
    if (typeof priceToman !== "number" || !Number.isInteger(priceToman) || priceToman < 0 || priceToman > 1000000000) {
      return e.json(400, { code: "PRICE_INVALID", message: "قیمت طرح باید عدد صحیح غیرمنفی (تومان) باشد." });
    }
    rec.set("price_toman", priceToman);
  }
  if (payload.is_active !== undefined) {
    rec.set("is_active", payload.is_active === true);
  }
  if (payload.display_order !== undefined) {
    var displayOrder = payload.display_order;
    if (typeof displayOrder !== "number" || !Number.isInteger(displayOrder) || displayOrder < 0) {
      return e.json(400, { code: "ORDER_INVALID", message: "ترتیب نمایش باید عدد صحیح غیرمنفی باشد." });
    }
    rec.set("display_order", displayOrder);
  }
  if (payload.description !== undefined) {
    rec.set("description", bs.textOr(payload.description, 500));
  }

  try {
    $app.save(rec);
  } catch (saveErr) {
    return e.json(400, { code: "PLAN_SAVE_FAILED", message: "ذخیره طرح ممکن نشد." });
  }
  try {
    var core = bs.coreModule();
    if (core && core.audit) {
      core.audit($app, String(e.auth.id || ""), "plan", String(rec.id || ""), "update", {
        name: String(rec.get("name") || ""), priceToman: Number(rec.get("price_toman") || 0),
        isActive: rec.get("is_active") === true,
      });
    }
  } catch (_) {}
  return e.json(200, { plan: bs.planShape(rec) });
});

// PUT = full upsert of the destination singleton (at most one active).
routerAdd("PUT", "/api/fast-english/staff/business-settings/destination", function (e) {
  var bs = null;
  try { bs = require(__hooks + '/business_settings_core.pb.js'); } catch (_) { bs = null; }
  if (!bs) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = bs.guard(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = bs.rateLimit(e, "business_settings_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var payload = bs.readBody(e);
  if (!payload) return e.json(400, { code: "invalid_request", message: "A JSON body is required." });

  if (typeof payload.card_number !== "string") {
    return e.json(400, { code: "CARD_INVALID", message: "شماره کارت باید ۱۲ تا ۳۲ رقم باشد." });
  }
  var cardNumber = bs.digitsOnly(payload.card_number);
  var cardHolderName = bs.textOr(payload.card_holder_name, 120);
  var bankName = bs.textOr(payload.bank_name, 120);
  var instructions = bs.textOr(payload.instructions, 1000);
  var reviewSlaText = bs.textOr(payload.review_sla_text, 200);
  var supportContact = bs.textOr(payload.support_contact, 200);
  var isActive = payload.is_active !== false;

  // Digits only after normalization: a pay-to card containing letters would
  // be shown to students as the transfer destination.
  if (!/^[0-9]{12,32}$/.test(cardNumber)) {
    return e.json(400, { code: "CARD_INVALID", message: "شماره کارت باید فقط ۱۲ تا ۳۲ رقم باشد." });
  }
  if (!cardHolderName) return e.json(400, { code: "HOLDER_REQUIRED", message: "نام دارنده کارت الزامی است." });
  if (!bankName) return e.json(400, { code: "BANK_REQUIRED", message: "نام بانک الزامی است." });

  var coll = null;
  try { coll = $app.findCollectionByNameOrId("payment_destination"); } catch (_) { coll = null; }
  if (!coll) return e.json(500, { code: "internal_error", message: "Internal error." });

  // The current destination record (the row the editor is updating, if any).
  var current = bs.loadDestination();

  // Single-active invariant, enforced ATOMICALLY: deactivate other active
  // rows and save the target in ONE transaction; any failure rolls back and
  // returns 5xx (never a silently broken destination set). SQLite serializes
  // write transactions, so the post-check below observes committed rows and
  // the product boundary holds without a partial unique index (a partial
  // index was deliberately NOT added — migration 1700000027 documents why:
  // the e2e/superuser fixture contract creates parallel destinations
  // freely). The in-transaction check + post-check is the defense.
  var saved = null;
  var txFailed = null;
  try {
    $app.runInTransaction(function (txApp) {
      if (isActive) {
        var others = txApp.findRecordsByFilter("payment_destination", "is_active = true", "", 0, 0);
        for (var i = 0; i < (others || []).length; i++) {
          var o = others[i];
          if (current && String(o.id) === String(current.id)) continue;
          o.set("is_active", false);
          txApp.save(o);
        }
      }
      var target = null;
      if (current) {
        try { target = txApp.findRecordById("payment_destination", String(current.id)); } catch (_) { target = null; }
      }
      if (!target) {
        target = new Record(txApp.findCollectionByNameOrId("payment_destination"));
      }
      target.set("card_number", cardNumber);
      target.set("card_holder_name", cardHolderName);
      target.set("bank_name", bankName);
      target.set("is_active", isActive);
      target.set("instructions", instructions);
      target.set("review_sla_text", reviewSlaText);
      target.set("support_contact", supportContact);
      txApp.save(target);

      // Post-condition: exactly one active row when activating.
      if (isActive) {
        var activeAfter = txApp.findRecordsByFilter("payment_destination", "is_active = true", "", 0, 0);
        if (!activeAfter || activeAfter.length !== 1) {
          throw new Error("single-active invariant violated");
        }
      }
      saved = target;
    });
  } catch (err) {
    txFailed = err;
  }
  if (txFailed || !saved) {
    return e.json(500, { code: "DESTINATION_SAVE_FAILED", message: "ذخیره مقصد پرداخت ممکن نشد؛ هیچ تغییری اعمال نشد." });
  }

  // Audit trail (content_operations) so destination changes are attributable.
  // The card number is MASKED — the full PAN must never be persisted in the
  // audit log (data minimization); the destination row itself is the only
  // store of the full value.
  try {
    var core = bs.coreModule();
    if (core && core.audit) {
      var masked = cardNumber.length > 8
        ? cardNumber.substring(0, 6) + "****" + cardNumber.substring(cardNumber.length - 4)
        : "****";
      core.audit($app, String(e.auth.id || ""), "payment_destination", String(saved.id || ""), "update", {
        cardNumberMasked: masked,
        isActive: isActive,
      });
    }
  } catch (_) {}

  return e.json(200, { destination: bs.destinationShape(saved) });
});

routerAdd("PATCH", "/api/fast-english/staff/business-settings/site", function (e) {
  var bs = null;
  try { bs = require(__hooks + '/business_settings_core.pb.js'); } catch (_) { bs = null; }
  if (!bs) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = bs.guard(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = bs.rateLimit(e, "business_settings_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var payload = bs.readBody(e);
  if (!payload) return e.json(400, { code: "invalid_request", message: "A JSON body is required." });

  var supportContact = bs.textOr(payload.support_contact, 300);
  if (!bs.contactUrlOk(supportContact)) {
    return e.json(400, { code: "SUPPORT_CONTACT_INVALID", message: "کانال پشتیبانی باید یک آدرس معتبر (https/mailto/tel) باشد یا خالی بماند." });
  }

  var rec = bs.loadSite();
  var coll = null;
  try { coll = $app.findCollectionByNameOrId("site_settings"); } catch (_) { coll = null; }
  if (!coll) return e.json(500, { code: "internal_error", message: "Internal error." });
  if (!rec) rec = new Record(coll);
  rec.set("support_contact", supportContact);
  try {
    $app.save(rec);
  } catch (saveErr) {
    return e.json(400, { code: "SITE_SAVE_FAILED", message: "ذخیره تنظیمات ممکن نشد." });
  }
  try {
    var core = bs.coreModule();
    if (core && core.audit) {
      core.audit($app, String(e.auth.id || ""), "site_settings", String(rec.id || ""), "update", {
        supportContact: supportContact,
      });
    }
  } catch (_) {}
  return e.json(200, { site: bs.siteShape(rec) });
});
