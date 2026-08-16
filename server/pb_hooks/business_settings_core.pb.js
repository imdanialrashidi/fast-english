// server/pb_hooks/business_settings_core.pb.js
// Business Configuration slice — shared helpers for the Business Settings
// routes (public settings + Staff Business Settings). Loaded as a hook AND
// required from the route handlers (PB 0.39 JSVM: routerAdd handlers cannot
// see top-level declarations, but `require` is available and cached).

try {
  $app.logger().info("business_settings_core: hook file loaded");
} catch (_) {}

var __businessSettings = (function () {

  function coreModule() {
    var core = null;
    try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
    return core;
  }

  function guard(e) {
    var core = coreModule();
    if (!core || !core.requireStaffAdmin) return { status: 500, code: "internal_error", message: "Internal error." };
    return core.requireStaffAdmin(e);
  }

  function readBody(e) {
    var core = coreModule();
    if (!core || !core.readJsonBody) return null;
    return core.readJsonBody(e, 256 * 1024);
  }

  function rateLimit(e, bucket, maxRequests, windowMs) {
    var core = coreModule();
    if (!core || !core.rateLimit) return null;
    return core.rateLimit(e, bucket, maxRequests, windowMs);
  }

  function textOr(value, max) {
    if (value === null || value === undefined) return "";
    return String(value).slice(0, max).trim();
  }

  function slugPatternOk(slug) {
    return /^[a-z0-9][a-z0-9-]{0,63}$/.test(String(slug || ""));
  }

  function digitsOnly(value) {
    var s = String(value || "").replace(/[\s-]/g, "");
    if (!s) return "";
    var map = { "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9", "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      out += map[ch] !== undefined ? map[ch] : ch;
    }
    return out;
  }

  // goja (PB 0.39 JSVM) has no WHATWG URL constructor; validate with a
  // strict scheme + address shape instead.
  function contactUrlOk(value) {
    var v = String(value || "").trim();
    if (!v) return true; // empty = honest "not announced yet" state
    if (v.length > 300) return false;
    var m = /^(https?:\/\/|mailto:|tel:)(.+)$/i.exec(v);
    if (!m) return false;
    var rest = String(m[2] || "").trim();
    if (!rest || rest.indexOf(" ") >= 0 || rest.indexOf("\n") >= 0) return false;
    return true;
  }

  function planShape(rec) {
    if (!rec) return null;
    return {
      id: String(rec.id || ""),
      name: String(rec.get("name") || ""),
      slug: String(rec.get("slug") || ""),
      durationDays: Number(rec.get("duration_days") || 0),
      priceToman: Number(rec.get("price_toman") || 0),
      isActive: rec.get("is_active") === true,
      displayOrder: Number(rec.get("display_order") || 0),
      description: String(rec.get("description") || ""),
    };
  }

  function publicPlanShape(rec) {
    var p = planShape(rec);
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      durationDays: p.durationDays,
      priceToman: p.priceToman,
      displayOrder: p.displayOrder,
      description: p.description,
    };
  }

  function destinationShape(rec) {
    if (!rec) return null;
    return {
      id: String(rec.id || ""),
      cardNumber: String(rec.get("card_number") || ""),
      cardHolderName: String(rec.get("card_holder_name") || ""),
      bankName: String(rec.get("bank_name") || ""),
      instructions: String(rec.get("instructions") || ""),
      reviewSlaText: String(rec.get("review_sla_text") || ""),
      supportContact: String(rec.get("support_contact") || ""),
      isActive: rec.get("is_active") === true,
    };
  }

  function siteShape(rec) {
    return {
      supportContact: rec ? String(rec.get("support_contact") || "") : "",
    };
  }

  function loadPlans() {
    var out = [];
    try {
      out = $app.findRecordsByFilter("plans", "1=1", "display_order,price_toman", 0, 0);
    } catch (_) { out = []; }
    return out || [];
  }

  function loadActivePlans() {
    var out = [];
    try {
      out = $app.findRecordsByFilter("plans", "is_active = true", "display_order,price_toman", 0, 0);
    } catch (_) { out = []; }
    return out || [];
  }

  function loadSite() {
    var rec = null;
    try {
      var hits = $app.findRecordsByFilter("site_settings", "1=1", "", 1, 0);
      if (hits && hits.length > 0) rec = hits[0];
    } catch (_) { rec = null; }
    return rec;
  }

  function loadDestination() {
    var rec = null;
    try {
      var hits = $app.findRecordsByFilter("payment_destination", "1=1", "", 1, 0);
      if (hits && hits.length > 0) rec = hits[0];
    } catch (_) { rec = null; }
    return rec;
  }

  function loadActiveDestination() {
    var rec = null;
    try {
      var hits = $app.findRecordsByFilter("payment_destination", "is_active = true", "", 1, 0);
      if (hits && hits.length > 0) rec = hits[0];
    } catch (_) { rec = null; }
    if (!rec) rec = loadDestination();
    return rec;
  }

  return {
    coreModule: coreModule,
    guard: guard,
    readBody: readBody,
    rateLimit: rateLimit,
    textOr: textOr,
    digitsOnly: digitsOnly,
    slugPatternOk: slugPatternOk,
    contactUrlOk: contactUrlOk,
    planShape: planShape,
    publicPlanShape: publicPlanShape,
    destinationShape: destinationShape,
    siteShape: siteShape,
    loadPlans: loadPlans,
    loadActivePlans: loadActivePlans,
    loadSite: loadSite,
    loadDestination: loadDestination,
    loadActiveDestination: loadActiveDestination,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = __businessSettings;
}
globalThis.__fepBusinessSettings = __businessSettings;
