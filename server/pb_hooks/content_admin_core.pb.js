// server/pb_hooks/content_admin_core.pb.js
// Podcast Slice 4 — shared helpers for the Staff Content Studio routes.
//
// Centralizes: Staff guard wiring, JSON body reading (UTF-8 safe),
// single-file multipart reading, image/audio signature inspection,
// sanitized response shapes (no storage names, no raw records), the
// authoritative Content Readiness evaluator (errors vs warnings vs
// legacy-published), and the content-operations audit writer.
//
// Readiness semantics (docs/PODCAST_DOMAIN.md §grandfathering):
//   - errors   block the publish action (missing required fields);
//   - warnings do not block (editorial/legacy notices);
//   - legacy   = currently published content missing new fields: no
//               errors, but republishing WILL require the listed fields.
//   - preconditions (variant) = parent Category/Episode not published;
//               blocks the variant publish until the parent is published.
//
// The routes stay the security boundary; this module only shapes data.

try {
  $app.logger().info("content_admin_core: hook file loaded");
} catch (_) {}

var __contentAdminCore = (function () {
  var CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

  function importCore() {
    var core = null;
    try { core = require(__hooks + "/content_import_core.pb.js"); } catch (_) { core = null; }
    return core;
  }

  function guards() {
    var g = null;
    try { g = require(__hooks + "/guards.pb.js"); } catch (_) { g = null; }
    return g;
  }

  function requireStaffAdmin(e) {
    var g = guards();
    if (!g || !g.requireStaffAdmin) return { status: 500, code: "internal_error", message: "Internal error." };
    var r = g.requireStaffAdmin(e);
    if (r) return r;
    return null;
  }

  function resolveId(value) {
    if (!value) return "";
    if (typeof value === "object" && value.id) return String(value.id);
    return String(value);
  }

  function limitText(value, max) {
    return String(value || "").slice(0, max);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  // --- JSON body ----------------------------------------------------------

  function readJsonBody(e, maxBytes) {
    var core = importCore();
    var bytes = null;
    try { bytes = toBytes(e.request.body, maxBytes); } catch (_) { bytes = null; }
    if (!bytes || bytes.length === 0) return null;
    var text = core ? core.utf8Decode(bytes) : "";
    try { return JSON.parse(text); } catch (_) { return null; }
  }

  // --- Multipart single-file reading ---------------------------------------

  function readUploadedFile(e, field, maxBytes) {
    var files = [];
    try { files = e.findUploadedFiles(field) || []; } catch (_) { files = []; }
    if (!files || files.length === 0) return { ok: false, code: "ASSET_MISSING" };
    if (files.length > 1) return { ok: false, code: "ASSET_DUPLICATE" };
    var f = files[0];
    var opened = null;
    var bytes = null;
    try {
      opened = f.reader.open();
      bytes = toBytes(opened, maxBytes + 1024 * 1024);
    } catch (_) { bytes = null; } finally {
      if (opened && typeof opened.close === "function") { try { opened.close(); } catch (_) {} }
    }
    if (!bytes || bytes.length === 0) return { ok: false, code: "ASSET_EMPTY" };
    if (bytes.length > maxBytes) return { ok: false, code: "ASSET_SIZE_EXCEEDED" };
    return { ok: true, bytes: bytes, file: f, name: String(f.originalName || f.name || "") };
  }

  function detectImageKind(bytes) {
    if (!bytes || bytes.length < 12) return "";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
        bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "png";
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
    return "";
  }

  function kindToMime(kind) {
    if (kind === "jpeg") return "image/jpeg";
    if (kind === "png") return "image/png";
    if (kind === "webp") return "image/webp";
    return "";
  }

  function kindToExt(kind) {
    if (kind === "jpeg") return "jpg";
    if (kind === "png") return "png";
    if (kind === "webp") return "webp";
    return "bin";
  }

  // Validates an uploaded image; on success the file gets a randomized
  // storage name and the caller assigns it to the record field.
  function validateImage(e, field, maxBytes) {
    var read = readUploadedFile(e, field, maxBytes);
    if (!read.ok) return read;
    var kind = detectImageKind(read.bytes);
    var mime = kindToMime(kind);
    if (!mime) return { ok: false, code: "IMAGE_UNSUPPORTED_TYPE" };
    var lowerName = String(read.name || "").toLowerCase();
    var extOk = false;
    var extList = kind === "jpeg" ? [".jpg", ".jpeg"] : kind === "png" ? [".png"] : [".webp"];
    for (var ei = 0; ei < extList.length; ei++) {
      if (lowerName.indexOf(extList[ei]) >= 0) extOk = true;
    }
    if (!extOk) return { ok: false, code: "IMAGE_EXTENSION_MISMATCH" };
    read.file.name = $security.randomString(16) + "." + kindToExt(kind);
    return { ok: true, bytes: read.bytes, file: read.file, name: read.name, mime: mime };
  }

  // Validates an uploaded MP3/M4A; returns the authoritative duration.
  function validateAudio(e, field, maxBytes) {
    var read = readUploadedFile(e, field, maxBytes);
    if (!read.ok) return read;
    var core = importCore();
    var lower = String(read.name || "").toLowerCase();
    var mime = "";
    var ext = "";
    var duration = 0;
    if (lower.indexOf(".mp3") >= 0) {
      mime = "audio/mpeg"; ext = "mp3";
      if (core) duration = core.mp3DurationSeconds(read.bytes);
    } else if (lower.indexOf(".m4a") >= 0 || lower.indexOf(".mp4") >= 0) {
      mime = "audio/mp4"; ext = "m4a";
      if (core) duration = core.mp4DurationSeconds(read.bytes);
    } else {
      return { ok: false, code: "AUDIO_UNSUPPORTED_TYPE" };
    }
    if (!(duration > 0)) return { ok: false, code: "AUDIO_DURATION_UNREADABLE" };
    read.file.name = $security.randomString(16) + "." + ext;
    return { ok: true, bytes: read.bytes, file: read.file, name: read.name, mime: mime, durationSeconds: duration };
  }

  // Normalizes + validates a transcript string; returns the normalized
  // text or { code }.
  function normalizeTranscript(text, core) {
    var normalized = core.normalizeTranscriptText(text);
    if (normalized.length > core.TRANSCRIPT_MAX_CHARS) {
      return { ok: false, code: "TRANSCRIPT_TOO_LONG" };
    }
    var forbidden = core.TRANSCRIPT_FORBIDDEN;
    for (var i = 0; i < forbidden.length; i++) {
      if (forbidden[i].pattern.test(normalized)) {
        return { ok: false, code: forbidden[i].code };
      }
    }
    return { ok: true, text: normalized };
  }

  // --- Loaders -------------------------------------------------------------

  // Bulk variant loader for LIST endpoints: one lessons scan, indexed by
  // topic id (list shape). Detail endpoints keep loadLessons per topic.
  function loadAllLessonsByTopic(app) {
    var byTopic = {};
    var hits = [];
    try {
      hits = app.findRecordsByFilter("lessons", "1=1", "", 0, 0);
    } catch (_) { hits = []; }
    if (hits && hits.length > 0) {
      for (var i = 0; i < hits.length; i++) {
        var rec = hits[i];
        if (!rec) continue;
        var tid = String(rec.get("topic") || "");
        if (!tid) continue;
        if (!byTopic[tid]) byTopic[tid] = {};
        var level = String(rec.get("level") || "");
        if (!byTopic[tid][level]) byTopic[tid][level] = rec;
      }
    }
    return byTopic;
  }

  function loadLessons(app, topicId) {
    var out = {};
    if (!app || !topicId) return out;
    var hits = [];
    try {
      hits = app.findRecordsByFilter("lessons", "topic = {:tid}", "", 0, 0, { tid: String(topicId) });
    } catch (_) { hits = []; }
    if (hits && hits.length > 0) {
      for (var i = 0; i < hits.length; i++) {
        var rec = hits[i];
        if (!rec) continue;
        var level = String(rec.get("level") || "");
        if (!out[level]) out[level] = rec;
      }
    }
    return out;
  }

  function loadVocabulary(app, lessonId) {
    var out = [];
    if (!app || !lessonId) return out;
    var hits = [];
    try {
      hits = app.findRecordsByFilter(
        "lesson_vocabulary",
        "lesson = {:lid}",
        "sort_order",
        0,
        0,
        { lid: String(lessonId) }
      );
    } catch (_) { hits = []; }
    if (hits && hits.length > 0) {
      for (var i = 0; i < hits.length; i++) out.push(hits[i]);
    }
    return out;
  }

  function findCategoryById(app, id) {
    var rec = null;
    try { rec = app.findRecordById("categories", String(id)); } catch (_) { rec = null; }
    return rec;
  }

  function findCategoryByKey(app, key) {
    var hits = null;
    try {
      hits = app.findRecordsByFilter("categories", "key = {:k}", "", 1, 0, { k: String(key) });
    } catch (_) { hits = null; }
    return hits && hits.length > 0 ? hits[0] : null;
  }

  function findTopicById(app, id) {
    var rec = null;
    try { rec = app.findRecordById("topics", String(id)); } catch (_) { rec = null; }
    return rec;
  }

  function findLessonById(app, id) {
    var rec = null;
    try { rec = app.findRecordById("lessons", String(id)); } catch (_) { rec = null; }
    return rec;
  }

  function findVocabularyById(app, id) {
    var rec = null;
    try { rec = app.findRecordById("lesson_vocabulary", String(id)); } catch (_) { rec = null; }
    return rec;
  }

  // --- Audit ---------------------------------------------------------------

  function audit(app, staffId, contentType, recordId, operation, detailObj) {
    try {
      var coll = app.findCollectionByNameOrId("content_operations");
      var rec = new Record(coll);
      rec.set("content_type", contentType);
      rec.set("record_id", String(recordId).slice(0, 64));
      rec.set("operation", operation);
      if (detailObj) {
        rec.set("detail_json", JSON.stringify(detailObj).slice(0, 2000));
      }
      if (staffId) rec.set("performed_by", String(staffId));
      rec.set("performed_at", nowIso());
      app.save(rec);
    } catch (_) {}
  }

  // --- Sanitizers ------------------------------------------------------------

  function sanitizeCategory(app, rec) {
    var counts = { total: 0, published: 0, draft: 0, archived: 0 };
    try {
      var hits = app.findRecordsByFilter("topics", "category = {:cid}", "", 0, 0, { cid: String(rec.id || "") });
      if (hits) {
        counts.total = hits.length;
        for (var i = 0; i < hits.length; i++) {
          var st = String(hits[i].get("status") || "");
          if (st === "published") counts.published++;
          else if (st === "archived") counts.archived++;
          else counts.draft++;
        }
      }
    } catch (_) {}
    return {
      id: String(rec.id || ""),
      key: String(rec.get("key") || ""),
      slug: String(rec.get("slug") || ""),
      titleFa: String(rec.get("title_fa") || ""),
      titleEn: String(rec.get("title_en") || ""),
      descriptionFa: String(rec.get("description_fa") || ""),
      sortOrder: Number(rec.get("sort_order") || 0),
      isFeatured: rec.get("is_featured") === true,
      publicationStatus: String(rec.get("publication_status") || "draft"),
      publishedAt: rec.get("published_at") || null,
      archivedAt: rec.get("archived_at") || null,
      coverPresent: !!(rec.get("cover_image") || ""),
      episodeCounts: counts,
    };
  }

  function sanitizeVariant(rec) {
    return {
      id: String(rec.id || ""),
      level: String(rec.get("level") || ""),
      status: String(rec.get("status") || "draft"),
      title: String(rec.get("title") || ""),
      summaryFa: String(rec.get("summary_fa") || ""),
      audioPresent: !!(rec.get("audio") || ""),
      audioDurationSeconds: Number(rec.get("audio_duration_seconds") || 0),
      contentVersion: Number(rec.get("content_version") || 0),
      publishedAt: rec.get("published_at") || null,
      archivedAt: rec.get("archived_at") || null,
      thumbnailPresent: !!(rec.get("thumbnail_override") || ""),
    };
  }

  // --- Readiness -------------------------------------------------------------

  // Episode required publication fields (mirrors requirePublishedTopic).
  function episodeMissingFields(app, category, topic) {
    var out = [];
    if (!topic) {
      out.push({ code: "EPISODE_MISSING", message: "اپیزود پیدا نشد." });
      return out;
    }
    if (!String(topic.get("slug") || "")) out.push({ code: "EPISODE_SLUG_MISSING", message: "شناسه انگلیسی اپیزود (slug) تنظیم نشده است." });
    if (!String(topic.get("content_key") || "")) out.push({ code: "EPISODE_CONTENT_KEY_MISSING", message: "کلید محتوایی اپیزود تنظیم نشده است." });
    if (!(Number(topic.get("content_version") || 0) > 0)) out.push({ code: "EPISODE_VERSION_MISSING", message: "شماره نسخه محتوا تنظیم نشده است." });
    if (!String(topic.get("title") || "").trim()) out.push({ code: "EPISODE_TITLE_EN_MISSING", message: "عنوان انگلیسی اپیزود تنظیم نشده است." });
    if (!String(topic.get("title_fa") || "").trim()) out.push({ code: "EPISODE_TITLE_FA_MISSING", message: "عنوان فارسی اپیزود تنظیم نشده است." });
    if (!String(topic.get("description_fa") || "").trim()) out.push({ code: "EPISODE_DESCRIPTION_MISSING", message: "توضیح فارسی اپیزود تنظیم نشده است." });
    if (!String(topic.get("artwork_square") || "")) out.push({ code: "EPISODE_ARTWORK_MISSING", message: "تصویر اصلی اپیزود تنظیم نشده است." });
    if (!category) out.push({ code: "CATEGORY_MISSING", message: "دستهبندی اپیزود مشخص نشده است." });
    else if (String(category.get("publication_status") || "") !== "published") {
      out.push({ code: "CATEGORY_NOT_PUBLISHED", message: "دستهبندی «" + String(category.get("title_fa") || category.get("key") || "") + "» هنوز منتشر نشده است." });
    }
    return out;
  }

  // Transcript placeholders (mirror of shared/content-package/constants.ts
  // PLACEHOLDER_PATTERNS): a required legacy field must hold something,
  // but placeholder text is treated as missing by readiness and the
  // episode-list "incomplete variant" filter.
  function transcriptPlaceholderPattern() {
    return /TODO_REPLACE|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|lorem ipsum|«بهزودی»|\bXXX\b/i;
  }

  function transcriptEffectivelyMissing(text) {
    var t = String(text || "");
    if (!t.trim()) return true;
    return transcriptPlaceholderPattern().test(t);
  }

  // Variant required publication fields (mirrors the lessons hooks).
  function variantMissingFields(lesson) {
    var out = [];
    if (!lesson) return out;
    if (transcriptEffectivelyMissing(lesson.get("body"))) out.push({ code: "VARIANT_TRANSCRIPT_MISSING", message: "متن اپیزود تنظیم نشده است." });
    if (!String(lesson.get("audio") || "")) out.push({ code: "VARIANT_AUDIO_MISSING", message: "فایل صوتی تنظیم نشده است." });
    if (!(Number(lesson.get("audio_duration_seconds") || 0) > 0)) out.push({ code: "VARIANT_DURATION_MISSING", message: "مدت صوت معتبر ثبت نشده است." });
    if (!String(lesson.get("summary_fa") || "").trim()) out.push({ code: "VARIANT_SUMMARY_MISSING", message: "خلاصه فارسی تنظیم نشده است." });
    if (!(Number(lesson.get("content_version") || 0) > 0)) out.push({ code: "VARIANT_VERSION_MISSING", message: "شماره نسخه محتوا تنظیم نشده است." });
    return out;
  }

  /**
   * Authoritative readiness for one Episode and its Variants.
   * Returns { episode: {status, ready, legacy, errors, warnings},
   *            variants: { LEVEL: {present, status, ready, legacy,
   *                                 errors, warnings, preconditions} } }.
   */
  function computeReadiness(app, category, topic, lessonsByLevel) {
    var core = importCore();
    var status = topic ? String(topic.get("status") || "draft") : "";
    var epMissing = episodeMissingFields(app, category, topic);
    var epErrors = [];
    var epWarnings = [];
    var epLegacy = false;
    if (topic) {
      if (status === "published") {
        if (epMissing.length > 0) {
          epLegacy = true;
          epWarnings.push({
            code: "LEGACY_PUBLISHED",
            message: "این اپیزود پیش از تکمیل موارد زیر منتشر شده است؛ انتشار مجدد نیازمند تکمیل آنهاست.",
          });
          for (var i = 0; i < epMissing.length; i++) {
            epWarnings.push({ code: epMissing[i].code, message: epMissing[i].message });
          }
        }
      } else {
        epErrors = epMissing;
      }
    } else {
      epErrors = epMissing;
    }

    var variants = {};
    var levels = core && core.CEFR_LEVELS ? core.CEFR_LEVELS : CEFR_ORDER;
    for (var li = 0; li < levels.length; li++) {
      var level = levels[li];
      var lesson = lessonsByLevel[level] || null;
      if (!lesson) {
        variants[level] = {
          present: false,
          status: "",
          ready: false,
          legacy: false,
          errors: [],
          warnings: [],
          preconditions: [],
        };
        continue;
      }
      var vStatus = String(lesson.get("status") || "draft");
      var missing = variantMissingFields(lesson);
      var vErrors = [];
      var vWarnings = [];
      var vLegacy = false;
      if (vStatus === "published") {
        if (missing.length > 0) {
          vLegacy = true;
          vWarnings.push({
            code: "LEGACY_PUBLISHED",
            message: "این نسخه پیش از تکمیل موارد زیر منتشر شده است؛ انتشار مجدد نیازمند تکمیل آنهاست.",
          });
          for (var m = 0; m < missing.length; m++) {
            vWarnings.push({ code: missing[m].code, message: missing[m].message });
          }
        }
      } else {
        vErrors = missing;
      }
      // Publish preconditions (guidance, not content completeness).
      var preconditions = [];
      if (!category) {
        preconditions.push({ code: "CATEGORY_MISSING", message: "دستهبندی اپیزود مشخص نیست." });
      } else if (String(category.get("publication_status") || "") !== "published") {
        preconditions.push({ code: "CATEGORY_NOT_PUBLISHED", message: "ابتدا دستهبندی را منتشر کنید." });
      }
      if (!topic) {
        preconditions.push({ code: "EPISODE_MISSING", message: "اپیزود پیدا نشد." });
      } else if (String(topic.get("status") || "") !== "published") {
        preconditions.push({ code: "EPISODE_NOT_PUBLISHED", message: "ابتدا اپیزود را منتشر کنید." });
      }
      variants[level] = {
        present: true,
        status: vStatus,
        ready: vErrors.length === 0,
        legacy: vLegacy,
        errors: vErrors,
        warnings: vWarnings,
        preconditions: preconditions,
      };
    }
    return {
      episode: {
        status: status,
        ready: epErrors.length === 0,
        legacy: epLegacy,
        errors: epErrors,
        warnings: epWarnings,
      },
      variants: variants,
    };
  }

  // --- Media byte serving (Staff preview; no public cache) ------------------

  // reads record file field bytes with containment; returns {bytes, contentType}
  function readStoredFile(app, record, fieldName) {
    var stored = String(record.get(fieldName) || "");
    if (!stored) return null;
    var dataDir = "";
    try { dataDir = String(app.dataDir() || ""); } catch (_) {}
    var basePath = "";
    try { basePath = String(record.baseFilesPath() || ""); } catch (_) {}
    if (!dataDir || !basePath) return null;
    var absPath = "";
    try { absPath = $filepath.join(dataDir, "storage", basePath, stored); } catch (_) {}
    if (!absPath) return null;
    var baseNormalized = "";
    try { baseNormalized = $filepath.clean($filepath.join(dataDir, "storage", basePath)); } catch (_) {}
    var absNormalized = "";
    try { absNormalized = $filepath.clean(absPath); } catch (_) {}
    var prefixOk = false;
    try {
      var baseWithSep = baseNormalized;
      var lastCh = baseWithSep.charAt(baseWithSep.length - 1);
      if (lastCh !== "/" && lastCh !== "\\") baseWithSep = baseWithSep + "/";
      prefixOk = absNormalized.indexOf(baseWithSep) === 0;
    } catch (_) { prefixOk = false; }
    if (!prefixOk) return null;
    var raw = null;
    try { raw = $os.readFile(absNormalized); } catch (_) { raw = null; }
    if (!raw) return null;
    var bytes = null;
    if (typeof raw === "string") {
      var arr = [];
      for (var si = 0; si < raw.length; si++) arr.push(raw.charCodeAt(si) & 0xff);
      bytes = arr;
    } else if (Array.isArray(raw)) {
      bytes = raw;
    } else {
      bytes = null;
    }
    if (!bytes || bytes.length === 0) return null;
    return { bytes: bytes, contentType: contentTypeFromName(stored) };
  }

  function contentTypeFromName(storedName) {
    var lower = String(storedName || "").toLowerCase();
    if (lower.indexOf(".png") >= 0) return "image/png";
    if (lower.indexOf(".webp") >= 0) return "image/webp";
    if (lower.indexOf(".jpg") >= 0 || lower.indexOf(".jpeg") >= 0) return "image/jpeg";
    if (lower.indexOf(".mp3") >= 0) return "audio/mpeg";
    if (lower.indexOf(".m4a") >= 0 || lower.indexOf(".mp4") >= 0) return "audio/mp4";
    return "application/octet-stream";
  }

  // Serves the bytes with optional Range support (audio seeking).
  function serveStaffBytes(e, file, maxBytes, cacheControl) {
    if (!file) return e.json(404, { code: "not_found", message: "Not found." });
    var bytes = file.bytes;
    if (bytes.length > maxBytes) {
      return e.json(413, { code: "media_too_large", message: "Media exceeds limit." });
    }
    var header = e.response.header();
    try {
      header.set("Content-Type", file.contentType);
      header.set("X-Content-Type-Options", "nosniff");
      header.set("Cache-Control", cacheControl || "private, no-store");
      header.set("Accept-Ranges", "bytes");
    } catch (_) {}

    var rangeHeader = "";
    try { rangeHeader = String(e.request.header.get("Range") || ""); } catch (_) {}
    rangeHeader = rangeHeader.trim();
    var fileSize = bytes.length;

    if (rangeHeader && rangeHeader.indexOf("bytes=") === 0) {
      var rangeVal = rangeHeader.substring(6);
      var dashIdx = rangeVal.indexOf("-");
      var rangeStart = 0;
      var rangeEnd = fileSize - 1;
      if (dashIdx > 0) {
        rangeStart = parseInt(rangeVal.substring(0, dashIdx), 10);
        if (dashIdx + 1 < rangeVal.length) {
          var re = parseInt(rangeVal.substring(dashIdx + 1), 10);
          if (!isNaN(re)) rangeEnd = re;
        }
      } else if (dashIdx === 0) {
        var suffixLen = parseInt(rangeVal.substring(1), 10);
        if (!isNaN(suffixLen) && suffixLen > 0) rangeStart = Math.max(0, fileSize - suffixLen);
      }
      if (isNaN(rangeStart)) rangeStart = 0;
      if (isNaN(rangeEnd)) rangeEnd = fileSize - 1;
      if (rangeStart > rangeEnd || rangeStart >= fileSize) {
        try { header.set("Content-Range", "bytes */" + fileSize); } catch (_) {}
        return e.json(416, { code: "range_not_satisfiable", message: "Range not satisfiable." });
      }
      if (rangeEnd >= fileSize) rangeEnd = fileSize - 1;
      var chunkSize = rangeEnd - rangeStart + 1;
      var chunk = [];
      for (var bi = rangeStart; bi <= rangeEnd && bi < bytes.length; bi++) chunk.push(bytes[bi]);
      try {
        header.set("Content-Range", "bytes " + rangeStart + "-" + rangeEnd + "/" + fileSize);
        header.set("Content-Length", String(chunkSize));
      } catch (_) {}
      try { e.response.writeHeader(206); } catch (_) {}
      try { e.response.write(chunk); } catch (_) {}
      return e;
    }

    try { header.set("Content-Length", String(fileSize)); } catch (_) {}
    try { e.response.write(bytes); } catch (_) {}
    return e;
  }

  // --- Per-staff rate limiting (in-memory, keyed by staff id) ----------------

  // Buckets live on globalThis so they survive across hook files; each
  // route family uses its own bucket name. Returns an error object to
  // return, or null when the request may proceed. Buckets are keyed by
  // bucketName + staff id and live in a bounded map (shared module).
  function rateLimit(e, bucketName, maxRequests, windowMs) {
    var rl = require(__hooks + '/rate_limit.pb.js');
    var staffId = String(e.auth && e.auth.id ? e.auth.id : "");
    if (!staffId) return null;
    var err = rl.checkRate(rl.window("__fepAdminRate"), bucketName + ":" + staffId, maxRequests, windowMs);
    // Keep the caller-facing shape { status, code, message }.
    if (err) return { status: err.status, code: err.body.code, message: err.body.message };
    return null;
  }

  // --- Misc ------------------------------------------------------------------

  // English-title slug suggestion (lowercase, latin only, hyphens).
  function slugifyEn(title) {
    var s = String(title || "").toLowerCase();
    s = s.replace(/[^a-z0-9]+/g, "-");
    s = s.replace(/^-+|-+$/g, "");
    return s.slice(0, 120);
  }

  function episodeSlugPatternOk(slug) {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 120;
  }

  function categorySlugPatternOk(slug) {
    return /^[a-z0-9][a-z0-9_-]*$/.test(slug) && slug.length >= 1 && slug.length <= 80;
  }

  function readPagination(e, defaultPer, maxPer) {
    var page = parseInt(String(e.request.formValue("page") || "1"), 10);
    if (isNaN(page) || page < 1) page = 1;
    var per = parseInt(String(e.request.formValue("perPage") || String(defaultPer)), 10);
    if (isNaN(per) || per < 1) per = defaultPer;
    if (per > maxPer) per = maxPer;
    return { page: page, perPage: per };
  }

  // --- Route-level shared helpers (must live here: PB 0.39 routerAdd
  // handlers cannot see top-level declarations of the hook file) ------------

  function sanitizeImportRec(rec) {
    var summary = null;
    try { summary = JSON.parse(String(rec.get("summary_json") || "")); } catch (_) { summary = null; }
    var error = null;
    try { error = JSON.parse(String(rec.get("error_json") || "")); } catch (_) { error = null; }
    var s = summary && summary.summary ? summary.summary : null;
    return {
      id: String(rec.id || ""),
      contentKey: String(rec.get("content_key") || ""),
      contentVersion: Number(rec.get("content_version") || 0),
      schemaVersion: String(rec.get("schema_version") || ""),
      status: String(rec.get("status") || ""),
      startedAt: rec.get("started_at") || null,
      completedAt: rec.get("completed_at") || null,
      summary: s,
      error: error,
    };
  }

  function sanitizeVocabulary(rec) {
    return {
      id: String(rec.id || ""),
      term: String(rec.get("term") || ""),
      phonetic: String(rec.get("phonetic") || ""),
      partOfSpeech: String(rec.get("part_of_speech") || ""),
      meaningFa: String(rec.get("meaning_fa") || ""),
      definitionEn: String(rec.get("definition_en") || ""),
      exampleSentence: String(rec.get("example_sentence") || ""),
      pronunciationPresent: !!(rec.get("pronunciation_audio") || ""),
      sortOrder: Number(rec.get("sort_order") || 0),
    };
  }

  function nextCategorySortOrder(app) {
    var max = 0;
    try {
      var all = app.findRecordsByFilter("categories", "1=1", "", 0, 0);
      if (all) {
        for (var i = 0; i < all.length; i++) {
          var so = Number(all[i].get("sort_order") || 0);
          if (so > max) max = so;
        }
      }
    } catch (_) {}
    return max + 1;
  }

  // Episode list row with per-level statuses + missing-content flags.
  function episodeListItem(app, rec, lessonsByTopic) {
    // LIST routes pass a prebuilt per-topic map (one bulk lessons scan);
    // detail routes omit it and load this topic's lessons individually.
    var lessons = lessonsByTopic
      ? (lessonsByTopic[String(rec.id || "")] || {})
      : loadLessons(app, String(rec.id || ""));
    var counts = { published: 0, draft: 0, archived: 0, total: 0 };
    var levels = {};
    var hasIncomplete = false;
    for (var key in lessons) {
      var lesson = lessons[key];
      counts.total++;
      var st = String(lesson.get("status") || "draft");
      if (st === "published") counts.published++;
      else if (st === "archived") counts.archived++;
      else counts.draft++;
      levels[key] = st;
      if (!hasIncomplete) {
        if (st === "published") {
          if (!String(lesson.get("audio") || "") || !(Number(lesson.get("audio_duration_seconds") || 0) > 0) ||
              !String(lesson.get("body") || "").trim() || !String(lesson.get("summary_fa") || "").trim()) {
            hasIncomplete = true;
          }
        } else if (st === "draft") {
          if (!String(lesson.get("audio") || "") || transcriptEffectivelyMissing(lesson.get("body")) || !String(lesson.get("summary_fa") || "").trim()) {
            hasIncomplete = true;
          }
        }
      }
    }
    var category = null;
    var catId = resolveId(rec.get("category"));
    if (catId) {
      var catRec = findCategoryById(app, catId);
      if (catRec) {
        category = {
          id: String(catRec.id || ""),
          key: String(catRec.get("key") || ""),
          slug: String(catRec.get("slug") || ""),
          titleFa: String(catRec.get("title_fa") || ""),
          publicationStatus: String(catRec.get("publication_status") || "draft"),
        };
      }
    }
    return {
      id: String(rec.id || ""),
      slug: String(rec.get("slug") || ""),
      contentKey: String(rec.get("content_key") || ""),
      contentVersion: Number(rec.get("content_version") || 0),
      title: String(rec.get("title") || ""),
      titleFa: String(rec.get("title_fa") || ""),
      titleEn: String(rec.get("title") || ""),
      descriptionFa: String(rec.get("description_fa") || ""),
      status: String(rec.get("status") || "draft"),
      episodeNumber: rec.get("episode_number") === null || rec.get("episode_number") === undefined ? null : Number(rec.get("episode_number")),
      isFeatured: rec.get("is_featured") === true,
      artworkPresent: !!(rec.get("artwork_square") || ""),
      heroPresent: !!(rec.get("hero_image_wide") || ""),
      category: category,
      variantCounts: counts,
      levels: levels,
      hasIncompleteVariant: hasIncomplete,
      publishedAt: rec.get("published_at") || null,
      archivedAt: rec.get("archived_at") || null,
      updatedAt: rec.get("updated") || null,
    };
  }

  // Episode square-artwork / wide-hero upload handler body (shared).
  function episodeMediaUpload(e, app, fieldName, mediaLabel, maxBytes) {
    var id = String(e.request.pathValue("id") || "");
    var rec = findTopicById(app, id);
    if (!rec) return { status: 404, body: { code: "not_found", message: "اپیزود پیدا نشد." } };
    try { e.request.parseMultipartForm(32 * 1024 * 1024); } catch (_) { try { e.findUploadedFiles("__none__"); } catch (_) {} }
    var img = validateImage(e, "media", maxBytes);
    if (!img.ok) {
      var code = img.code === "ASSET_SIZE_EXCEEDED" ? "IMAGE_TOO_LARGE" : img.code === "ASSET_MISSING" ? "IMAGE_REQUIRED" : img.code;
      return { status: 400, body: { code: code, message: "تصویر معتبر نیست (JPEG، PNG یا WebP تا ۵ مگابایت)." } };
    }
    rec.set(fieldName, img.file);
    try { app.save(rec); } catch (saveErr) {
      return { status: 400, body: { code: "invalid_episode", message: "ذخیره تصویر ممکن نشد." } };
    }
    audit(app, String(e.auth.id || ""), "episode", String(rec.id || ""), "media_replace", { media: mediaLabel });
    return { status: 200, body: { episode: episodeListItem(app, rec) } };
  }

  return {
    CEFR_ORDER: CEFR_ORDER,
    requireStaffAdmin: requireStaffAdmin,
    resolveId: resolveId,
    limitText: limitText,
    nowIso: nowIso,
    readJsonBody: readJsonBody,
    readUploadedFile: readUploadedFile,
    validateImage: validateImage,
    validateAudio: validateAudio,
    normalizeTranscript: normalizeTranscript,
    loadAllLessonsByTopic: loadAllLessonsByTopic,
    loadLessons: loadLessons,
    loadVocabulary: loadVocabulary,
    findCategoryById: findCategoryById,
    findCategoryByKey: findCategoryByKey,
    findTopicById: findTopicById,
    findLessonById: findLessonById,
    findVocabularyById: findVocabularyById,
    audit: audit,
    sanitizeCategory: sanitizeCategory,
    sanitizeVariant: sanitizeVariant,
    computeReadiness: computeReadiness,
    readStoredFile: readStoredFile,
    serveStaffBytes: serveStaffBytes,
    slugifyEn: slugifyEn,
    episodeSlugPatternOk: episodeSlugPatternOk,
    categorySlugPatternOk: categorySlugPatternOk,
    readPagination: readPagination,
    rateLimit: rateLimit,
    sanitizeImportRec: sanitizeImportRec,
    sanitizeVocabulary: sanitizeVocabulary,
    nextCategorySortOrder: nextCategorySortOrder,
    episodeListItem: episodeListItem,
    episodeMediaUpload: episodeMediaUpload,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = __contentAdminCore;
}
globalThis.__fepContentAdminCore = __contentAdminCore;
