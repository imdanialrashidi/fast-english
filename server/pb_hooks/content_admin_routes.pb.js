// server/pb_hooks/content_admin_routes.pb.js
// Podcast Slice 4 — Staff Content Studio routes (bounded, not generic CRUD).
//
// Every route requires an active `staff_admins` session
// (requireStaffAdmin + requireAuth("staff_admins")). The routes:
//   - validate input and re-validate publication invariants;
//   - sanitize every response (no storage names, no raw records, no
//     internal field vocabulary leaks beyond documented shapes);
//   - record publish/archive/media-replacement operations in the
//     `content_operations` audit collection;
//   - never expose Draft content outside Staff routes.
//
// The server stays the security boundary: the browser ZIP import uses
// the same plan/execute transport as the CLI (content_import_routes.pb.js)
// and every byte is re-validated there.

try {
  $app.logger().info("content_admin_routes: hook file loaded");
} catch (_) {}

// =====================================================================
// GET /api/fast-english/staff/content/overview
// Operational dashboard numbers (real data only).
// =====================================================================

routerAdd("GET", "/api/fast-english/staff/content/overview", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "overview", 120, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var episodes = { draft: 0, published: 0, archived: 0, total: 0 };
  var variantsMissing = 0;
  try {
    var all = $app.findRecordsByFilter("topics", "1=1", "", 0, 0);
    if (all) {
      episodes.total = all.length;
      for (var i = 0; i < all.length; i++) {
        var st = String(all[i].get("status") || "");
        if (st === "published") episodes.published++;
        else if (st === "archived") episodes.archived++;
        else episodes.draft++;
      }
    }
    var lessons = $app.findRecordsByFilter("lessons", "status = 'published'", "", 0, 0);
    if (lessons) {
      for (var li = 0; li < lessons.length; li++) {
        var l = lessons[li];
        if (!l) continue;
        if (!String(l.get("audio") || "") || !(Number(l.get("audio_duration_seconds") || 0) > 0) ||
            !String(l.get("body") || "").trim() || !String(l.get("summary_fa") || "").trim()) {
          variantsMissing++;
        }
      }
    }
  } catch (_) {}

  var recentImports = [];
  try {
    var imports = $app.findRecordsByFilter("content_imports", "1=1", "", 0, 0);
    if (imports) {
      var sorted = imports.slice().sort(function (a, b) {
        var at = String(a.get("completed_at") || a.get("started_at") || "");
        var bt = String(b.get("completed_at") || b.get("started_at") || "");
        if (at !== bt) return at < bt ? 1 : -1;
        return String(a.id) < String(b.id) ? 1 : -1;
      });
      for (var ii = 0; ii < sorted.length && ii < 5; ii++) {
        var rec = sorted[ii];
        recentImports.push(core.sanitizeImportRec(rec));
      }
    }
  } catch (_) {}

  return e.json(200, { episodes: episodes, variantsMissingRequired: variantsMissing, recentImports: recentImports });
});


// =====================================================================

routerAdd("GET", "/api/fast-english/staff/categories", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "categories_read", 240, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var search = String(e.request.formValue("search") || "").trim().slice(0, 100);
  var status = String(e.request.formValue("status") || "all").trim();

  var filterParts = ["1=1"];
  var params = {};
  if (status === "draft" || status === "published" || status === "archived") {
    filterParts.push("publication_status = {:st}");
    params.st = status;
  } else if (status !== "all") {
    return e.json(400, { code: "invalid_status", message: "Invalid status filter." });
  }

  var hits = [];
  try {
    hits = $app.findRecordsByFilter("categories", filterParts.join(" && "), "", 0, 0, params);
  } catch (_) { hits = []; }

  var out = [];
  for (var i = 0; i < hits.length; i++) {
    var rec = hits[i];
    var titleFa = String(rec.get("title_fa") || "");
    var titleEn = String(rec.get("title_en") || "");
    var key = String(rec.get("key") || "");
    var slug = String(rec.get("slug") || "");
    if (search) {
      var hay = (titleFa + " " + titleEn + " " + key + " " + slug).toLowerCase();
      if (hay.indexOf(search.toLowerCase()) < 0) continue;
    }
    out.push(core.sanitizeCategory($app, rec));
  }
  out.sort(function (a, b) {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.titleFa < b.titleFa ? -1 : a.titleFa > b.titleFa ? 1 : 0;
  });
  return e.json(200, { items: out, total: out.length });
});

routerAdd("POST", "/api/fast-english/staff/categories", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "categories_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var payload = core.readJsonBody(e, 256 * 1024);
  if (!payload) return e.json(400, { code: "invalid_request", message: "A JSON body is required." });
  var titleFa = core.limitText(payload.title_fa, 200).trim();
  var titleEn = core.limitText(payload.title_en, 200).trim();
  var slug = core.limitText(payload.slug, 80).trim();
  var descriptionFa = core.limitText(payload.description_fa, 2000).trim();
  if (!titleFa) return e.json(400, { code: "TITLE_FA_REQUIRED", message: "عنوان فارسی دستهبندی الزامی است." });
  if (!core.categorySlugPatternOk(slug)) {
    return e.json(400, { code: "SLUG_INVALID", message: "شناسه انگلیسی (slug) فقط حروف کوچک لاتین، عدد، خط تیره و زیرخط میپذیرد." });
  }

  var coll = null;
  try { coll = $app.findCollectionByNameOrId("categories"); } catch (_) {}
  var rec = new Record(coll);
  rec.set("key", slug);
  rec.set("slug", slug);
  rec.set("title_fa", titleFa);
  if (titleEn) rec.set("title_en", titleEn);
  if (descriptionFa) rec.set("description_fa", descriptionFa);
  rec.set("publication_status", "draft");
  rec.set("sort_order", core.nextCategorySortOrder($app));
  rec.set("is_featured", payload.is_featured === true);
  try { $app.save(rec); } catch (saveErr) {
    try { $app.logger().error("content_admin: category create save error: " + String(saveErr && saveErr.message ? saveErr.message : saveErr).slice(0, 500)); } catch (_) {}
    var msg = String(saveErr && saveErr.message ? saveErr.message : saveErr);
    if (msg.indexOf("UNIQUE") >= 0 || msg.indexOf("unique") >= 0) {
      return e.json(409, { code: "CATEGORY_SLUG_TAKEN", message: "این شناسه انگلیسی قبلاً استفاده شده است." });
    }
    return e.json(400, { code: "invalid_category", message: "ذخیره دستهبندی ممکن نشد." });
  }
  core.audit($app, String(e.auth.id || ""), "category", String(rec.id || ""), "create", { slug: slug });
  return e.json(200, { category: core.sanitizeCategory($app, rec) });
});

routerAdd("PATCH", "/api/fast-english/staff/categories/{id}", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "categories_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findCategoryById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "دستهبندی پیدا نشد." });
  var payload = core.readJsonBody(e, 256 * 1024);
  if (!payload) return e.json(400, { code: "invalid_request", message: "A JSON body is required." });

  if (typeof payload.title_fa === "string") {
    var titleFa = payload.title_fa.trim().slice(0, 200);
    if (!titleFa) return e.json(400, { code: "TITLE_FA_REQUIRED", message: "عنوان فارسی دستهبندی الزامی است." });
    rec.set("title_fa", titleFa);
  }
  if (typeof payload.title_en === "string") rec.set("title_en", payload.title_en.trim().slice(0, 200));
  if (typeof payload.description_fa === "string") rec.set("description_fa", payload.description_fa.trim().slice(0, 2000));
  if (typeof payload.slug === "string") {
    var slug = payload.slug.trim().slice(0, 80);
    if (!core.categorySlugPatternOk(slug)) {
      return e.json(400, { code: "SLUG_INVALID", message: "شناسه انگلیسی (slug) فقط حروف کوچک لاتین، عدد، خط تیره و زیرخط میپذیرد." });
    }
    rec.set("slug", slug);
  }
  if (typeof payload.sort_order === "number") {
    rec.set("sort_order", Math.max(0, Math.min(10000, Math.floor(payload.sort_order))));
  }
  if (typeof payload.is_featured === "boolean") rec.set("is_featured", payload.is_featured);
  if (typeof payload.cover_alt_fa === "string") rec.set("cover_alt_fa", payload.cover_alt_fa.trim().slice(0, 500));
  try { $app.save(rec); } catch (saveErr) {
    var msg2 = String(saveErr && saveErr.message ? saveErr.message : saveErr);
    if (msg2.indexOf("UNIQUE") >= 0 || msg2.indexOf("unique") >= 0) {
      return e.json(409, { code: "CATEGORY_SLUG_TAKEN", message: "این شناسه انگلیسی قبلاً استفاده شده است." });
    }
    return e.json(400, { code: "invalid_category", message: "ذخیره دستهبندی ممکن نشد." });
  }
  return e.json(200, { category: core.sanitizeCategory($app, rec) });
});

routerAdd("POST", "/api/fast-english/staff/categories/{id}/publish", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "categories_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findCategoryById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "دستهبندی پیدا نشد." });
  var issues = [];
  if (!String(rec.get("title_fa") || "").trim()) issues.push("عنوان فارسی دستهبندی تنظیم نشده است.");
  if (!String(rec.get("slug") || "").trim()) issues.push("شناسه انگلیسی (slug) تنظیم نشده است.");
  if (!String(rec.get("description_fa") || "").trim()) issues.push("توضیح فارسی دستهبندی تنظیم نشده است.");
  if (issues.length > 0) {
    return e.json(400, { code: "not_ready", message: "این دستهبندی هنوز آماده انتشار نیست.", issues: issues });
  }
  rec.set("publication_status", "published");
  if (!rec.get("published_at")) rec.set("published_at", core.nowIso());
  try { $app.save(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_category", message: "انتشار دستهبندی ممکن نشد." });
  }
  core.audit($app, String(e.auth.id || ""), "category", String(rec.id || ""), "publish", {});
  return e.json(200, { category: core.sanitizeCategory($app, rec) });
});

routerAdd("POST", "/api/fast-english/staff/categories/{id}/archive", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "categories_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findCategoryById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "دستهبندی پیدا نشد." });
  rec.set("publication_status", "archived");
  if (!rec.get("archived_at")) rec.set("archived_at", core.nowIso());
  try { $app.save(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_category", message: "بایگانی دستهبندی ممکن نشد." });
  }
  core.audit($app, String(e.auth.id || ""), "category", String(rec.id || ""), "archive", {});
  return e.json(200, { category: core.sanitizeCategory($app, rec) });
});

routerAdd("POST", "/api/fast-english/staff/categories/{id}/feature", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "categories_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findCategoryById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "دستهبندی پیدا نشد." });
  rec.set("is_featured", !(rec.get("is_featured") === true));
  try { $app.save(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_category", message: "ذخیره دستهبندی ممکن نشد." });
  }
  return e.json(200, { category: core.sanitizeCategory($app, rec) });
});

routerAdd("POST", "/api/fast-english/staff/categories/reorder", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "categories_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var payload = core.readJsonBody(e, 256 * 1024);
  if (!payload || !Array.isArray(payload.ids) || payload.ids.length > 200) {
    return e.json(400, { code: "invalid_request", message: "ids (array) is required." });
  }
  var seen = {};
  for (var i = 0; i < payload.ids.length; i++) {
    var id = String(payload.ids[i] || "");
    if (!id || seen[id]) return e.json(400, { code: "invalid_request", message: "Duplicate or empty id in the order list." });
    seen[id] = true;
    var rec = core.findCategoryById($app, id);
    if (!rec) return e.json(404, { code: "not_found", message: "دستهبندی پیدا نشد." });
    rec.set("sort_order", i + 1);
    try { $app.save(rec); } catch (_) {
      return e.json(400, { code: "invalid_category", message: "ذخیره ترتیب ممکن نشد." });
    }
  }
  return e.json(200, { ok: true });
});

routerAdd("POST", "/api/fast-english/staff/categories/{id}/cover", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "categories_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findCategoryById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "دستهبندی پیدا نشد." });
  try { e.request.parseMultipartForm(32 * 1024 * 1024); } catch (_) { try { e.findUploadedFiles("__none__"); } catch (_) {} }
  var img = core.validateImage(e, "cover", 5 * 1024 * 1024);
  if (!img.ok) {
    var imgCode = img.code === "ASSET_SIZE_EXCEEDED" ? "IMAGE_TOO_LARGE" : img.code === "ASSET_MISSING" ? "IMAGE_REQUIRED" : img.code;
    return e.json(400, { code: imgCode, message: "تصویر جلد معتبر نیست (JPEG، PNG یا WebP تا ۵ مگابایت)." });
  }
  rec.set("cover_image", img.file);
  try { $app.save(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_category", message: "ذخیره تصویر ممکن نشد." });
  }
  core.audit($app, String(e.auth.id || ""), "category", String(rec.id || ""), "media_replace", { media: "cover" });
  return e.json(200, { category: core.sanitizeCategory($app, rec) });
});

routerAdd("DELETE", "/api/fast-english/staff/categories/{id}/cover", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "categories_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findCategoryById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "دستهبندی پیدا نشد." });
  if (!rec.get("cover_image")) return e.json(200, { category: core.sanitizeCategory($app, rec) });
  rec.set("cover_image", null);
  try { $app.save(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_category", message: "حذف تصویر ممکن نشد." });
  }
  return e.json(200, { category: core.sanitizeCategory($app, rec) });
});


// =====================================================================

routerAdd("GET", "/api/fast-english/staff/episodes", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_read", 240, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var search = String(e.request.formValue("search") || "").trim().slice(0, 100);
  var categoryId = String(e.request.formValue("category") || "").trim();
  var status = String(e.request.formValue("status") || "all").trim();
  var missing = String(e.request.formValue("missing") || "").trim();
  var sort = String(e.request.formValue("sort") || "updated").trim();

  var filterParts = ["1=1"];
  var params = {};
  if (categoryId) {
    filterParts.push("category = {:cid}");
    params.cid = categoryId;
  }
  if (status === "draft" || status === "published" || status === "archived") {
    filterParts.push("status = {:st}");
    params.st = status;
  } else if (status !== "all") {
    return e.json(400, { code: "invalid_status", message: "Invalid status filter." });
  }

  var hits = [];
  try {
    hits = $app.findRecordsByFilter("topics", filterParts.join(" && "), "", 0, 0, params);
  } catch (_) { hits = []; }

  var out = [];
  for (var i = 0; i < hits.length; i++) {
    var rec = hits[i];
    var item = core.episodeListItem($app, rec);
    if (search) {
      var hay = (item.titleFa + " " + item.titleEn + " " + item.slug + " " + item.contentKey + " " + (item.category ? item.category.titleFa + " " + item.category.key : "")).toLowerCase();
      if (hay.indexOf(search.toLowerCase()) < 0) continue;
    }
    if (missing === "no_artwork" && item.artworkPresent) continue;
    if (missing === "no_published" && item.variantCounts.published > 0) continue;
    if (missing === "no_b1" && item.levels.B1) continue;
    if (missing === "incomplete_variant" && !item.hasIncompleteVariant) continue;
    if (missing !== "" && missing !== "no_artwork" && missing !== "no_published" && missing !== "no_b1" && missing !== "incomplete_variant") {
      return e.json(400, { code: "invalid_missing_filter", message: "Invalid missing filter." });
    }
    out.push(item);
  }

  out.sort(function (a, b) {
    if (sort === "title") return (a.titleFa || "").localeCompare(b.titleFa || "");
    if (sort === "status") return a.status < b.status ? -1 : a.status > b.status ? 1 : 0;
    if (sort === "episode_number") return (a.episodeNumber || 0) - (b.episodeNumber || 0);
    // default: last update first
    var at = a.updatedAt || "";
    var bt = b.updatedAt || "";
    if (at !== bt) return at < bt ? 1 : -1;
    return String(a.id) < String(b.id) ? 1 : -1;
  });

  return e.json(200, { items: out, total: out.length });
});

routerAdd("POST", "/api/fast-english/staff/episodes", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var payload = core.readJsonBody(e, 256 * 1024);
  if (!payload) return e.json(400, { code: "invalid_request", message: "A JSON body is required." });
  var titleFa = core.limitText(payload.title_fa, 200).trim();
  var titleEn = core.limitText(payload.title, 120).trim();
  var slug = core.limitText(payload.slug, 120).trim();
  var descriptionFa = core.limitText(payload.description_fa, 2000).trim();
  var categoryId = core.resolveId(payload.category);
  if (!titleFa) return e.json(400, { code: "TITLE_FA_REQUIRED", message: "عنوان فارسی اپیزود الزامی است." });
  if (!core.episodeSlugPatternOk(slug)) {
    return e.json(400, { code: "SLUG_INVALID", message: "شناسه انگلیسی (slug) باید با حروف کوچک لاتین و خط تیره نوشته شود." });
  }
  var category = null;
  if (categoryId) category = core.findCategoryById($app, categoryId);
  if (!category) return e.json(400, { code: "CATEGORY_REQUIRED", message: "دستهبندی اپیزود را انتخاب کنید." });
  var contentKey = String(category.get("key") || "") + "." + slug;

  var coll = null;
  try { coll = $app.findCollectionByNameOrId("topics"); } catch (_) {}
  var rec = new Record(coll);
  rec.set("title", titleEn || titleFa.slice(0, 120));
  rec.set("slug", slug);
  rec.set("description", core.limitText(descriptionFa, 500));
  rec.set("sort_order", Math.max(1, Number(payload.episode_number) || 1));
  rec.set("status", "draft");
  rec.set("category", String(category.id || ""));
  rec.set("content_key", contentKey);
  rec.set("content_version", 1);
  rec.set("title_fa", titleFa);
  rec.set("description_fa", descriptionFa);
  if (typeof payload.episode_number === "number" && Number.isInteger(payload.episode_number) && payload.episode_number >= 1) {
    rec.set("episode_number", payload.episode_number);
  }
  if (typeof payload.is_featured === "boolean") rec.set("is_featured", payload.is_featured);
  try { $app.save(rec); } catch (saveErr) {
    var msg = String(saveErr && saveErr.message ? saveErr.message : saveErr);
    if (msg.indexOf("UNIQUE") >= 0 || msg.indexOf("unique") >= 0) {
      return e.json(409, { code: "EPISODE_KEY_TAKEN", message: "این شناسه انگلیسی قبلاً برای اپیزود دیگری استفاده شده است." });
    }
    return e.json(400, { code: "invalid_episode", message: "ذخیره اپیزود ممکن نشد." });
  }
  core.audit($app, String(e.auth.id || ""), "episode", String(rec.id || ""), "create", { slug: slug, contentKey: contentKey });
  return e.json(200, { episode: core.episodeListItem($app, rec) });
});

routerAdd("GET", "/api/fast-english/staff/episodes/{id}", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_read", 240, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findTopicById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "اپیزود پیدا نشد." });

  var lessons = core.loadLessons($app, id);
  var category = null;
  var catId = core.resolveId(rec.get("category"));
  if (catId) category = core.findCategoryById($app, catId);
  var readiness = core.computeReadiness($app, category, rec, lessons);

  var variants = [];
  var levelOrder = core.CEFR_ORDER;
  for (var i = 0; i < levelOrder.length; i++) {
    var level = levelOrder[i];
    var lesson = lessons[level];
    if (!lesson) continue;
    var vocab = core.loadVocabulary($app, String(lesson.id || ""));
    var v = core.sanitizeVariant(lesson);
    v.vocabularyCount = vocab.length;
    v.readiness = readiness.variants[level];
    variants.push(v);
  }

  var item = core.episodeListItem($app, rec);
  item.variants = variants;
  item.readiness = readiness;
  return e.json(200, { episode: item });
});

routerAdd("PATCH", "/api/fast-english/staff/episodes/{id}", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findTopicById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "اپیزود پیدا نشد." });
  var payload = core.readJsonBody(e, 256 * 1024);
  if (!payload) return e.json(400, { code: "invalid_request", message: "A JSON body is required." });

  if (typeof payload.title_fa === "string") {
    var titleFa = payload.title_fa.trim().slice(0, 200);
    if (!titleFa) return e.json(400, { code: "TITLE_FA_REQUIRED", message: "عنوان فارسی اپیزود الزامی است." });
    rec.set("title_fa", titleFa);
  }
  if (typeof payload.title === "string") rec.set("title", payload.title.trim().slice(0, 120));
  if (typeof payload.description_fa === "string") {
    rec.set("description_fa", payload.description_fa.trim().slice(0, 2000));
    rec.set("description", payload.description_fa.trim().slice(0, 500));
  }
  if (typeof payload.slug === "string") {
    var slug = payload.slug.trim().slice(0, 120);
    if (!core.episodeSlugPatternOk(slug)) {
      return e.json(400, { code: "SLUG_INVALID", message: "شناسه انگلیسی (slug) باید با حروف کوچک لاتین و خط تیره نوشته شود." });
    }
    // Slug changes do not silently rewrite content_key (stable identity);
    // the operator explicitly renames via the advanced flow only.
    rec.set("slug", slug);
  }
  if (typeof payload.category === "string" || (payload.category && typeof payload.category === "object")) {
    var catId = core.resolveId(payload.category);
    var category = catId ? core.findCategoryById($app, catId) : null;
    if (!category) return e.json(400, { code: "CATEGORY_REQUIRED", message: "دستهبندی انتخابشده پیدا نشد." });
    rec.set("category", String(category.id || ""));
  }
  if (payload.episode_number === null || payload.episode_number === undefined || payload.episode_number === "") {
    rec.set("episode_number", null);
  } else if (typeof payload.episode_number === "number" && Number.isInteger(payload.episode_number) && payload.episode_number >= 1) {
    rec.set("episode_number", payload.episode_number);
    rec.set("sort_order", payload.episode_number);
  }
  if (typeof payload.is_featured === "boolean") rec.set("is_featured", payload.is_featured);
  if (typeof payload.artwork_alt_fa === "string") rec.set("artwork_alt_fa", payload.artwork_alt_fa.trim().slice(0, 500));

  try { $app.save(rec); } catch (saveErr) {
    var msg2 = String(saveErr && saveErr.message ? saveErr.message : saveErr);
    if (msg2.indexOf("UNIQUE") >= 0 || msg2.indexOf("unique") >= 0) {
      return e.json(409, { code: "EPISODE_SLUG_TAKEN", message: "این شناسه انگلیسی قبلاً برای اپیزود دیگری استفاده شده است." });
    }
    return e.json(400, { code: "invalid_episode", message: "ذخیره اپیزود ممکن نشد." });
  }
  return e.json(200, { episode: core.episodeListItem($app, rec) });
});

routerAdd("POST", "/api/fast-english/staff/episodes/{id}/publish", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findTopicById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "اپیزود پیدا نشد." });
  var lessons = core.loadLessons($app, id);
  var category = null;
  var catId = core.resolveId(rec.get("category"));
  if (catId) category = core.findCategoryById($app, catId);
  var readiness = core.computeReadiness($app, category, rec, lessons);
  if (!readiness.episode.ready) {
    return e.json(400, {
      code: "not_ready",
      message: "این اپیزود هنوز آماده انتشار نیست. موارد زیر را تکمیل کنید:",
      issues: readiness.episode.errors.map(function (x) { return x.message; }),
    });
  }
  rec.set("status", "published");
  if (!rec.get("published_at")) rec.set("published_at", core.nowIso());
  try { $app.save(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_episode", message: "انتشار اپیزود ممکن نشد. موارد زیر را بررسی کنید: " + String(saveErr && saveErr.message ? saveErr.message : saveErr).slice(0, 200) });
  }
  core.audit($app, String(e.auth.id || ""), "episode", String(rec.id || ""), "publish", { slug: String(rec.get("slug") || "") });
  return e.json(200, { episode: core.episodeListItem($app, rec) });
});

routerAdd("POST", "/api/fast-english/staff/episodes/{id}/archive", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findTopicById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "اپیزود پیدا نشد." });
  rec.set("status", "archived");
  if (!rec.get("archived_at")) rec.set("archived_at", core.nowIso());
  try { $app.save(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_episode", message: "بایگانی اپیزود ممکن نشد." });
  }
  core.audit($app, String(e.auth.id || ""), "episode", String(rec.id || ""), "archive", {});
  return e.json(200, { episode: core.episodeListItem($app, rec) });
});

routerAdd("POST", "/api/fast-english/staff/episodes/{id}/feature", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findTopicById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "اپیزود پیدا نشد." });
  rec.set("is_featured", !(rec.get("is_featured") === true));
  try { $app.save(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_episode", message: "ذخیره اپیزود ممکن نشد." });
  }
  return e.json(200, { episode: core.episodeListItem($app, rec) });
});

// --- Episode media (square artwork / wide hero) ----------------------------

routerAdd("POST", "/api/fast-english/staff/episodes/{id}/artwork", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });
  var upRes = core.episodeMediaUpload(e, $app, "artwork_square", "artwork_square", 5 * 1024 * 1024);
  return e.json(upRes.status, upRes.body);
});

routerAdd("POST", "/api/fast-english/staff/episodes/{id}/hero", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });
  var upRes = core.episodeMediaUpload(e, $app, "hero_image_wide", "hero_image_wide", 5 * 1024 * 1024);
  return e.json(upRes.status, upRes.body);
});

// Removing media from published content is blocked: it would leave the
// published record violating the publication invariants.
routerAdd("DELETE", "/api/fast-english/staff/episodes/{id}/artwork", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findTopicById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "اپیزود پیدا نشد." });
  if (String(rec.get("status") || "") === "published") {
    return e.json(400, { code: "published_media_locked", message: "حذف تصویر اپیزود منتشرشده ممکن نیست." });
  }
  if (!rec.get("artwork_square")) return e.json(200, { episode: core.episodeListItem($app, rec) });
  rec.set("artwork_square", null);
  try { $app.save(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_episode", message: "حذف تصویر ممکن نشد." });
  }
  return e.json(200, { episode: core.episodeListItem($app, rec) });
});

routerAdd("DELETE", "/api/fast-english/staff/episodes/{id}/hero", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findTopicById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "اپیزود پیدا نشد." });
  if (!rec.get("hero_image_wide")) return e.json(200, { episode: core.episodeListItem($app, rec) });
  rec.set("hero_image_wide", null);
  try { $app.save(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_episode", message: "حذف تصویر ممکن نشد." });
  }
  return e.json(200, { episode: core.episodeListItem($app, rec) });
});

// =====================================================================
// Variants (lessons)
// =====================================================================

routerAdd("POST", "/api/fast-english/staff/episodes/{id}/variants", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var episodeId = String(e.request.pathValue("id") || "");
  var topic = core.findTopicById($app, episodeId);
  if (!topic) return e.json(404, { code: "not_found", message: "اپیزود پیدا نشد." });
  var payload = core.readJsonBody(e, 64 * 1024);
  if (!payload) return e.json(400, { code: "invalid_request", message: "A JSON body is required." });
  var level = String(payload.level || "").trim();
  var levelOk = false;
  for (var i = 0; i < core.CEFR_ORDER.length; i++) {
    if (core.CEFR_ORDER[i] === level) { levelOk = true; break; }
  }
  if (!levelOk) {
    return e.json(400, { code: "LEVEL_INVALID", message: "سطح باید یکی از A1 تا C2 باشد." });
  }
  var existing = core.loadLessons($app, episodeId)[level];
  if (existing) {
    return e.json(409, { code: "VARIANT_EXISTS", message: "نسخه سطح " + level + " قبلاً ساخته شده است." });
  }
  var coll = null;
  try { coll = $app.findCollectionByNameOrId("lessons"); } catch (_) {}
  var rec = new Record(coll);
  rec.set("topic", String(topic.id || ""));
  rec.set("level", level);
  rec.set("title", String(topic.get("title") || "").slice(0, 200));
  // Required legacy fields need safe placeholders for an empty Draft:
  // the Persian summary is mirrored on every summary save, and the
  // transcript placeholder is treated as "missing" by readiness.
  rec.set("summary", String(topic.get("title_fa") || "").slice(0, 500));
  rec.set("body", "TODO_REPLACE");
  rec.set("estimated_minutes", 1);
  rec.set("status", "draft");
  rec.set("content_version", Math.max(1, Number(topic.get("content_version") || 1)));
  try { $app.save(rec); } catch (saveErr) {
    try { $app.logger().error("content_admin: variant create save error: " + String(saveErr && saveErr.message ? saveErr.message : saveErr).slice(0, 500)); } catch (_) {}
    return e.json(400, { code: "invalid_variant", message: "ساخت نسخه سطح ممکن نشد." });
  }
  core.audit($app, String(e.auth.id || ""), "variant", String(rec.id || ""), "create", { level: level, episodeId: episodeId });
  var variant = core.sanitizeVariant(rec);
  variant.vocabularyCount = 0;
  variant.readiness = {
    present: true,
    status: "draft",
    ready: false,
    legacy: false,
    errors: [
      { code: "VARIANT_TRANSCRIPT_MISSING", message: "متن اپیزود تنظیم نشده است." },
      { code: "VARIANT_AUDIO_MISSING", message: "فایل صوتی تنظیم نشده است." },
      { code: "VARIANT_SUMMARY_MISSING", message: "خلاصه فارسی تنظیم نشده است." },
    ],
    warnings: [],
    preconditions: [],
  };
  return e.json(200, { variant: variant });
});

routerAdd("GET", "/api/fast-english/staff/variants/{id}", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_read", 240, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var lesson = core.findLessonById($app, id);
  if (!lesson) return e.json(404, { code: "not_found", message: "نسخه سطح پیدا نشد." });
  var topicId = core.resolveId(lesson.get("topic"));
  var topic = topicId ? core.findTopicById($app, topicId) : null;
  var category = null;
  if (topic) {
    var catId = core.resolveId(topic.get("category"));
    if (catId) category = core.findCategoryById($app, catId);
  }
  var lessonsMap = core.loadLessons($app, topicId);
  var readiness = core.computeReadiness($app, category, topic, lessonsMap);
  var level = String(lesson.get("level") || "");
  var vocabulary = core.loadVocabulary($app, id).map(function (v) { return core.sanitizeVocabulary(v); });

  var variant = core.sanitizeVariant(lesson);
  variant.body = String(lesson.get("body") || "");
  variant.vocabulary = vocabulary;
  variant.vocabularyCount = vocabulary.length;
  variant.episodeId = topicId;
  variant.episodeTitleFa = topic ? String(topic.get("title_fa") || "") : "";
  variant.readiness = readiness.variants[level] || null;
  return e.json(200, { variant: variant });
});

routerAdd("PATCH", "/api/fast-english/staff/variants/{id}", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var lesson = core.findLessonById($app, id);
  if (!lesson) return e.json(404, { code: "not_found", message: "نسخه سطح پیدا نشد." });
  var payload = core.readJsonBody(e, 256 * 1024);
  if (!payload) return e.json(400, { code: "invalid_request", message: "A JSON body is required." });

  if (typeof payload.summary_fa === "string") {
    var summaryFa = payload.summary_fa.trim().slice(0, 500);
    lesson.set("summary_fa", summaryFa);
    lesson.set("summary", summaryFa.slice(0, 500));
  }
  try { $app.save(lesson); } catch (saveErr) {
    return e.json(400, { code: "invalid_variant", message: "ذخیره نسخه سطح ممکن نشد." });
  }
  return e.json(200, { variant: core.sanitizeVariant(lesson) });
});

routerAdd("POST", "/api/fast-english/staff/variants/{id}/audio", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var lesson = core.findLessonById($app, id);
  if (!lesson) return e.json(404, { code: "not_found", message: "نسخه سطح پیدا نشد." });
  try { e.request.parseMultipartForm(32 * 1024 * 1024); } catch (_) { try { e.findUploadedFiles("__none__"); } catch (_) {} }
  var audio = core.validateAudio(e, "audio", 10 * 1024 * 1024);
  if (!audio.ok) {
    var code = audio.code === "ASSET_SIZE_EXCEEDED" ? "AUDIO_TOO_LARGE" : audio.code;
    var msg = audio.code === "AUDIO_DURATION_UNREADABLE"
      ? "مدت فایل صوتی قابل تشخیص نیست؛ از MP3 یا M4A معتبر استفاده کنید."
      : "فایل صوتی معتبر نیست (MP3 یا M4A تا ۱۰ مگابایت).";
    return e.json(400, { code: code, message: msg });
  }
  lesson.set("audio", audio.file);
  lesson.set("audio_duration_seconds", Number(audio.durationSeconds));
  lesson.set("estimated_minutes", Math.max(1, Math.min(120, Math.ceil(Number(audio.durationSeconds) / 60))));
  try { $app.save(lesson); } catch (saveErr) {
    return e.json(400, { code: "invalid_variant", message: "ذخیره صوت ممکن نشد." });
  }
  core.audit($app, String(e.auth.id || ""), "variant", String(lesson.id || ""), "media_replace", {
    media: "audio",
    level: String(lesson.get("level") || ""),
    durationSeconds: Number(audio.durationSeconds),
  });
  return e.json(200, { variant: core.sanitizeVariant(lesson) });
});

routerAdd("DELETE", "/api/fast-english/staff/variants/{id}/audio", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var lesson = core.findLessonById($app, id);
  if (!lesson) return e.json(404, { code: "not_found", message: "نسخه سطح پیدا نشد." });
  if (String(lesson.get("status") || "") === "published") {
    return e.json(400, { code: "published_media_locked", message: "حذف صوت نسخه منتشرشده ممکن نیست." });
  }
  if (!lesson.get("audio")) return e.json(200, { variant: core.sanitizeVariant(lesson) });
  lesson.set("audio", null);
  lesson.set("audio_duration_seconds", null);
  lesson.set("estimated_minutes", null);
  try { $app.save(lesson); } catch (saveErr) {
    return e.json(400, { code: "invalid_variant", message: "حذف صوت ممکن نشد." });
  }
  return e.json(200, { variant: core.sanitizeVariant(lesson) });
});

routerAdd("PUT", "/api/fast-english/staff/variants/{id}/transcript", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var lesson = core.findLessonById($app, id);
  if (!lesson) return e.json(404, { code: "not_found", message: "نسخه سطح پیدا نشد." });
  var payload = core.readJsonBody(e, 256 * 1024);
  if (!payload || typeof payload.transcript !== "string") {
    return e.json(400, { code: "invalid_request", message: "transcript (string) is required." });
  }
  var core2 = null;
  try { core2 = require(__hooks + '/content_import_core.pb.js'); } catch (_) { core2 = null; }
  if (!core2) return e.json(500, { code: "internal_error", message: "Internal error." });
  var normalized = core.normalizeTranscript(payload.transcript, core2);
  if (!normalized.ok) {
    var tCode = normalized.code === "TRANSCRIPT_TOO_LONG"
      ? { code: "TRANSCRIPT_TOO_LONG", message: "متن اپیزود از ۵۰٬۰۰۰ نویسه بلندتر است." }
      : { code: normalized.code, message: "متن اپیزود شامل ساختار غیرمجاز است." };
    return e.json(400, tCode);
  }
  if (String(lesson.get("status") || "") === "published" && !normalized.text.trim()) {
    return e.json(400, { code: "VARIANT_TRANSCRIPT_REQUIRED", message: "نسخه منتشرشده باید متن اپیزود داشته باشد." });
  }
  lesson.set("body", normalized.text);
  try { $app.save(lesson); } catch (saveErr) {
    return e.json(400, { code: "invalid_variant", message: "ذخیره متن اپیزود ممکن نشد." });
  }
  return e.json(200, { variant: core.sanitizeVariant(lesson) });
});

routerAdd("POST", "/api/fast-english/staff/variants/{id}/publish", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var lesson = core.findLessonById($app, id);
  if (!lesson) return e.json(404, { code: "not_found", message: "نسخه سطح پیدا نشد." });
  var topicId = core.resolveId(lesson.get("topic"));
  var topic = topicId ? core.findTopicById($app, topicId) : null;
  var category = null;
  if (topic) {
    var catId = core.resolveId(topic.get("category"));
    if (catId) category = core.findCategoryById($app, catId);
  }
  var lessonsMap = core.loadLessons($app, topicId);
  var readiness = core.computeReadiness($app, category, topic, lessonsMap);
  var level = String(lesson.get("level") || "");
  var vr = readiness.variants[level];
  if (!vr || !vr.present) return e.json(400, { code: "not_ready", message: "این نسخه هنوز آماده انتشار نیست." });
  if (vr.errors.length > 0) {
    return e.json(400, {
      code: "not_ready",
      message: "این نسخه هنوز آماده انتشار نیست. موارد زیر را تکمیل کنید:",
      issues: vr.errors.map(function (x) { return x.message; }),
    });
  }
  if (vr.preconditions.length > 0) {
    return e.json(400, {
      code: "parent_not_published",
      message: "برای انتشار این نسخه، ابتدا دستهبندی و اپیزود والد را منتشر کنید.",
      issues: vr.preconditions.map(function (x) { return x.message; }),
    });
  }
  lesson.set("status", "published");
  if (!lesson.get("published_at")) lesson.set("published_at", core.nowIso());
  try { $app.save(lesson); } catch (saveErr) {
    return e.json(400, { code: "invalid_variant", message: "انتشار نسخه سطح ممکن نشد. " + String(saveErr && saveErr.message ? saveErr.message : saveErr).slice(0, 200) });
  }
  core.audit($app, String(e.auth.id || ""), "variant", String(lesson.id || ""), "publish", { level: level });
  return e.json(200, { variant: core.sanitizeVariant(lesson) });
});

routerAdd("POST", "/api/fast-english/staff/variants/{id}/archive", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var lesson = core.findLessonById($app, id);
  if (!lesson) return e.json(404, { code: "not_found", message: "نسخه سطح پیدا نشد." });
  lesson.set("status", "archived");
  if (!lesson.get("archived_at")) lesson.set("archived_at", core.nowIso());
  try { $app.save(lesson); } catch (saveErr) {
    return e.json(400, { code: "invalid_variant", message: "بایگانی نسخه سطح ممکن نشد." });
  }
  core.audit($app, String(e.auth.id || ""), "variant", String(lesson.id || ""), "archive", { level: String(lesson.get("level") || "") });
  return e.json(200, { variant: core.sanitizeVariant(lesson) });
});

// =====================================================================
// Vocabulary
// =====================================================================

routerAdd("GET", "/api/fast-english/staff/variants/{id}/vocabulary", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_read", 240, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var lesson = core.findLessonById($app, id);
  if (!lesson) return e.json(404, { code: "not_found", message: "نسخه سطح پیدا نشد." });
  var vocabulary = core.loadVocabulary($app, id).map(function (v) { return core.sanitizeVocabulary(v); });
  return e.json(200, { items: vocabulary, total: vocabulary.length });
});

routerAdd("POST", "/api/fast-english/staff/variants/{id}/vocabulary", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var lessonId = String(e.request.pathValue("id") || "");
  var lesson = core.findLessonById($app, lessonId);
  if (!lesson) return e.json(404, { code: "not_found", message: "نسخه سطح پیدا نشد." });
  var payload = core.readJsonBody(e, 256 * 1024);
  if (!payload) return e.json(400, { code: "invalid_request", message: "A JSON body is required." });

  var existing = core.loadVocabulary($app, lessonId);
  if (existing.length >= 100) {
    return e.json(400, { code: "VOCAB_COUNT_INVALID", message: "حداکثر ۱۰۰ واژه در هر نسخه مجاز است." });
  }
  var term = core.limitText(payload.term, 200).trim();
  var meaningFa = core.limitText(payload.meaning_fa, 500).trim();
  var definitionEn = core.limitText(payload.definition_en, 500).trim();
  if (!term) return e.json(400, { code: "VOCAB_FIELDS_INVALID", message: "واژه الزامی است." });
  if (!meaningFa) return e.json(400, { code: "VOCAB_FIELDS_INVALID", message: "معنی فارسی الزامی است." });
  if (!definitionEn) return e.json(400, { code: "VOCAB_FIELDS_INVALID", message: "توضیح انگلیسی الزامی است." });

  var core2 = null;
  try { core2 = require(__hooks + '/content_import_core.pb.js'); } catch (_) { core2 = null; }
  var normalizedTerm = core2 ? core2.normalizeVocabularyTerm(term) : term.toLowerCase();
  var maxSort = 0;
  for (var i = 0; i < existing.length; i++) {
    var so = Number(existing[i].get("sort_order") || 0);
    if (so > maxSort) maxSort = so;
    var existingNorm = core2 ? core2.normalizeVocabularyTerm(String(existing[i].get("term") || "")) : "";
    if (existingNorm === normalizedTerm) {
      return e.json(409, { code: "VOCAB_TERM_DUPLICATE", message: "این واژه قبلاً در این نسخه ثبت شده است." });
    }
  }

  var coll = null;
  try { coll = $app.findCollectionByNameOrId("lesson_vocabulary"); } catch (_) {}
  var rec = new Record(coll);
  rec.set("lesson", lessonId);
  rec.set("term", term);
  rec.set("normalized_term", normalizedTerm);
  if (payload.phonetic !== undefined && payload.phonetic !== null) rec.set("phonetic", core.limitText(payload.phonetic, 200).trim());
  if (payload.part_of_speech !== undefined && payload.part_of_speech !== null) rec.set("part_of_speech", core.limitText(payload.part_of_speech, 50).trim());
  rec.set("meaning_fa", meaningFa);
  rec.set("definition_en", definitionEn);
  if (payload.example_sentence !== undefined && payload.example_sentence !== null) rec.set("example_sentence", core.limitText(payload.example_sentence, 1000).trim());
  rec.set("sort_order", maxSort + 1);
  try { $app.save(rec); } catch (saveErr) {
    var msg = String(saveErr && saveErr.message ? saveErr.message : saveErr);
    if (msg.indexOf("UNIQUE") >= 0 || msg.indexOf("unique") >= 0) {
      return e.json(409, { code: "VOCAB_TERM_DUPLICATE", message: "این واژه قبلاً در این نسخه ثبت شده است." });
    }
    return e.json(400, { code: "invalid_vocabulary", message: "ذخیره واژه ممکن نشد." });
  }
  return e.json(200, { vocabulary: core.sanitizeVocabulary(rec) });
});

routerAdd("PATCH", "/api/fast-english/staff/vocabulary/{id}", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findVocabularyById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "واژه پیدا نشد." });
  var payload = core.readJsonBody(e, 256 * 1024);
  if (!payload) return e.json(400, { code: "invalid_request", message: "A JSON body is required." });

  if (typeof payload.term === "string") {
    var term = payload.term.trim().slice(0, 200);
    if (!term) return e.json(400, { code: "VOCAB_FIELDS_INVALID", message: "واژه الزامی است." });
    rec.set("term", term);
    var core2 = null;
    try { core2 = require(__hooks + '/content_import_core.pb.js'); } catch (_) { core2 = null; }
    rec.set("normalized_term", core2 ? core2.normalizeVocabularyTerm(term) : term.toLowerCase());
  }
  if (typeof payload.meaning_fa === "string") {
    var meaningFa = payload.meaning_fa.trim().slice(0, 500);
    if (!meaningFa) return e.json(400, { code: "VOCAB_FIELDS_INVALID", message: "معنی فارسی الزامی است." });
    rec.set("meaning_fa", meaningFa);
  }
  if (typeof payload.definition_en === "string") {
    var definitionEn = payload.definition_en.trim().slice(0, 500);
    if (!definitionEn) return e.json(400, { code: "VOCAB_FIELDS_INVALID", message: "توضیح انگلیسی الزامی است." });
    rec.set("definition_en", definitionEn);
  }
  if (typeof payload.phonetic === "string") rec.set("phonetic", payload.phonetic.trim().slice(0, 200));
  if (typeof payload.part_of_speech === "string") rec.set("part_of_speech", payload.part_of_speech.trim().slice(0, 50));
  if (typeof payload.example_sentence === "string") rec.set("example_sentence", payload.example_sentence.trim().slice(0, 1000));
  try { $app.save(rec); } catch (saveErr) {
    var msg2 = String(saveErr && saveErr.message ? saveErr.message : saveErr);
    if (msg2.indexOf("UNIQUE") >= 0 || msg2.indexOf("unique") >= 0) {
      return e.json(409, { code: "VOCAB_TERM_DUPLICATE", message: "این واژه قبلاً در این نسخه ثبت شده است." });
    }
    return e.json(400, { code: "invalid_vocabulary", message: "ذخیره واژه ممکن نشد." });
  }
  return e.json(200, { vocabulary: core.sanitizeVocabulary(rec) });
});

routerAdd("DELETE", "/api/fast-english/staff/vocabulary/{id}", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findVocabularyById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "واژه پیدا نشد." });
  try { $app.delete(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_vocabulary", message: "حذف واژه ممکن نشد." });
  }
  return e.json(200, { ok: true });
});

routerAdd("POST", "/api/fast-english/staff/vocabulary/reorder", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var payload = core.readJsonBody(e, 256 * 1024);
  if (!payload || !Array.isArray(payload.ids) || payload.ids.length > 200) {
    return e.json(400, { code: "invalid_request", message: "ids (array) is required." });
  }
  var seen = {};
  for (var i = 0; i < payload.ids.length; i++) {
    var id = String(payload.ids[i] || "");
    if (!id || seen[id]) return e.json(400, { code: "invalid_request", message: "Duplicate or empty id in the order list." });
    seen[id] = true;
    var rec = core.findVocabularyById($app, id);
    if (!rec) return e.json(404, { code: "not_found", message: "واژه پیدا نشد." });
    rec.set("sort_order", i);
    try { $app.save(rec); } catch (_) {
      return e.json(400, { code: "invalid_vocabulary", message: "ذخیره ترتیب واژهها ممکن نشد." });
    }
  }
  return e.json(200, { ok: true });
});

routerAdd("POST", "/api/fast-english/staff/vocabulary/{id}/pronunciation", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findVocabularyById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "واژه پیدا نشد." });
  try { e.request.parseMultipartForm(16 * 1024 * 1024); } catch (_) { try { e.findUploadedFiles("__none__"); } catch (_) {} }
  var audio = core.validateAudio(e, "pronunciation", 2 * 1024 * 1024);
  if (!audio.ok) {
    var code = audio.code === "ASSET_SIZE_EXCEEDED" ? "PRONUNCIATION_TOO_LARGE" : audio.code;
    return e.json(400, { code: code, message: "فایل تلفظ معتبر نیست (MP3 یا M4A تا ۲ مگابایت)." });
  }
  rec.set("pronunciation_audio", audio.file);
  try { $app.save(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_vocabulary", message: "ذخیره فایل تلفظ ممکن نشد." });
  }
  core.audit($app, String(e.auth.id || ""), "vocabulary", String(rec.id || ""), "media_replace", { media: "pronunciation_audio" });
  return e.json(200, { vocabulary: core.sanitizeVocabulary(rec) });
});

routerAdd("DELETE", "/api/fast-english/staff/vocabulary/{id}/pronunciation", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "episodes_write", 60, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var rec = core.findVocabularyById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "واژه پیدا نشد." });
  if (!rec.get("pronunciation_audio")) return e.json(200, { vocabulary: core.sanitizeVocabulary(rec) });
  rec.set("pronunciation_audio", null);
  try { $app.save(rec); } catch (saveErr) {
    return e.json(400, { code: "invalid_vocabulary", message: "حذف فایل تلفظ ممکن نشد." });
  }
  return e.json(200, { vocabulary: core.sanitizeVocabulary(rec) });
});

// =====================================================================
// Staff-only Draft preview + media
// =====================================================================

routerAdd("GET", "/api/fast-english/staff/preview/episodes/{id}", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "preview", 240, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("id") || "");
  var topic = core.findTopicById($app, id);
  if (!topic) return e.json(404, { code: "not_found", message: "اپیزود پیدا نشد." });

  var category = null;
  var catId = core.resolveId(topic.get("category"));
  if (catId) category = core.findCategoryById($app, catId);
  var lessons = core.loadLessons($app, id);

  var variants = [];
  var levelOrder = core.CEFR_ORDER;
  for (var i = 0; i < levelOrder.length; i++) {
    var level = levelOrder[i];
    var lesson = lessons[level];
    if (!lesson) continue;
    var vocabulary = core.loadVocabulary($app, String(lesson.id || "")).map(function (v) { return core.sanitizeVocabulary(v); });
    variants.push({
      id: String(lesson.id || ""),
      level: level,
      status: String(lesson.get("status") || "draft"),
      summaryFa: String(lesson.get("summary_fa") || ""),
      transcript: String(lesson.get("body") || ""),
      audioPresent: !!(lesson.get("audio") || ""),
      audioDurationSeconds: Number(lesson.get("audio_duration_seconds") || 0),
      vocabulary: vocabulary,
    });
  }

  return e.json(200, {
    episode: {
      id: String(topic.id || ""),
      slug: String(topic.get("slug") || ""),
      contentKey: String(topic.get("content_key") || ""),
      title: String(topic.get("title") || ""),
      titleFa: String(topic.get("title_fa") || ""),
      descriptionFa: String(topic.get("description_fa") || ""),
      episodeNumber: topic.get("episode_number") === null || topic.get("episode_number") === undefined ? null : Number(topic.get("episode_number")),
      isFeatured: topic.get("is_featured") === true,
      status: String(topic.get("status") || "draft"),
      artworkPresent: !!(topic.get("artwork_square") || ""),
      heroPresent: !!(topic.get("hero_image_wide") || ""),
      category: category ? {
        key: String(category.get("key") || ""),
        slug: String(category.get("slug") || ""),
        titleFa: String(category.get("title_fa") || ""),
        publicationStatus: String(category.get("publication_status") || "draft"),
      } : null,
    },
    variants: variants,
  });
});

routerAdd("GET", "/api/fast-english/staff/media/artwork/{episodeId}", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "media", 480, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("episodeId") || "");
  var topic = core.findTopicById($app, id);
  if (!topic) return e.json(404, { code: "not_found", message: "Not found." });
  var kind = String(e.request.formValue("kind") || "square");
  var fieldName = kind === "hero" ? "hero_image_wide" : "artwork_square";
  var file = core.readStoredFile($app, topic, fieldName);
  return core.serveStaffBytes(e, file, 5 * 1024 * 1024, "private, no-store");
});

routerAdd("GET", "/api/fast-english/staff/media/audio/{variantId}", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "media", 480, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("variantId") || "");
  var lesson = core.findLessonById($app, id);
  if (!lesson) return e.json(404, { code: "not_found", message: "Not found." });
  var file = core.readStoredFile($app, lesson, "audio");
  return core.serveStaffBytes(e, file, 10 * 1024 * 1024, "private, no-store");
});

routerAdd("GET", "/api/fast-english/staff/media/pronunciation/{vocabId}", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "media", 480, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var id = String(e.request.pathValue("vocabId") || "");
  var rec = core.findVocabularyById($app, id);
  if (!rec) return e.json(404, { code: "not_found", message: "Not found." });
  var file = core.readStoredFile($app, rec, "pronunciation_audio");
  return core.serveStaffBytes(e, file, 2 * 1024 * 1024, "private, no-store");
});

// =====================================================================
// Import history (recent, sanitized)
// =====================================================================

routerAdd("GET", "/api/fast-english/staff/imports", function (e) {
  var core = null;
  try { core = require(__hooks + '/content_admin_core.pb.js'); } catch (_) { core = null; }
  if (!core || !core.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Internal error." });
  var guardErr = core.requireStaffAdmin(e);
  if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
  var rateErr = core.rateLimit(e, "imports_read", 120, 300000);
  if (rateErr) return e.json(rateErr.status, { code: rateErr.code, message: rateErr.message });

  var limit = parseInt(String(e.request.formValue("limit") || "20"), 10);
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 50) limit = 50;

  var items = [];
  try {
    var hits = $app.findRecordsByFilter("content_imports", "1=1", "", 0, 0);
    if (hits) {
      var sorted = hits.slice().sort(function (a, b) {
        var at = String(a.get("completed_at") || a.get("started_at") || "");
        var bt = String(b.get("completed_at") || b.get("started_at") || "");
        if (at !== bt) return at < bt ? 1 : -1;
        return String(a.id) < String(b.id) ? 1 : -1;
      });
      for (var i = 0; i < sorted.length && i < limit; i++) {
        items.push(core.sanitizeImportRec(sorted[i]));
      }
    }
  } catch (_) {}
  return e.json(200, { items: items, total: items.length });
});
