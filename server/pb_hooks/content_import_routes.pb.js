// server/pb_hooks/content_import_routes.pb.js
// Podcast Slice 3 — Staff-authenticated content-import routes.
//
// Routes (all require an active `staff_admins` session):
//   POST /api/fast-english/staff/content-import/plan
//       JSON: { manifest, assets: [{path, sizeBytes, sha256}], fingerprint }
//       Read-only: computes the authoritative diff against current DB
//       state and returns a deterministic plan + planStateHash.
//       Never mutates the database, files or audit records.
//   POST /api/fast-english/staff/content-import/execute
//       multipart: `manifest` + one part per declared asset path.
//       Re-validates everything (identity, paths, sizes, signatures,
//       durations, version rules, stale-plan protection), records an
//       audit entry and applies the import as Draft inside one
//       transaction (records + files proven atomic and rollback-safe
//       by the architectural probe — see docs/CONTENT_PIPELINE.md).
//   GET  /api/fast-english/staff/content-imports/{id}
//       Sanitized audit record (no tokens, paths or secrets).
//
// The server is the security boundary: the CLI's local validation is
// never trusted. Files never use client-supplied names for storage
// (randomized storage names), and responses never contain storage
// paths or stack traces.

try {
  $app.logger().info("content_import_routes: hook file loaded");
} catch (_) {}

// ---------------------------------------------------------------------
// POST /api/fast-english/staff/content-import/plan
// ---------------------------------------------------------------------

routerAdd(
  "POST",
  "/api/fast-english/staff/content-import/plan",
  function (e) {
    var core = null;
    try { core = require(__hooks + '/content_import_core.pb.js'); } catch (_) { core = null; }
    if (!core || !core.validateManifestStruct) {
      return e.json(500, { code: "internal_error", message: "Import helpers unavailable." });
    }
    var g = null;
    try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
    if (!g || !g.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Import helpers unavailable." });
    var guardErr = g.requireStaffAdmin(e);
    if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });

    // Per-staff rate limit (plan is read-only; 30/min is generous).
    if (typeof globalThis.__fepImportPlanRate === "undefined") { globalThis.__fepImportPlanRate = {}; }
    var rateWindow = globalThis.__fepImportPlanRate;
    var staffId = String(e.auth.id || "");
    var nowMs = Date.now();
    var bucket = rateWindow[staffId];
    if (!bucket || !Array.isArray(bucket)) { bucket = []; rateWindow[staffId] = bucket; }
    var keep = [];
    for (var wi = 0; wi < bucket.length; wi++) { if (bucket[wi] > nowMs - 300000) keep.push(bucket[wi]); }
    bucket.length = 0;
    for (var wj = 0; wj < keep.length; wj++) bucket.push(keep[wj]);
    if (bucket.length >= 30) return e.json(429, { code: "rate_limited", message: "Too many requests." });
    bucket.push(nowMs);

    function loadContentState(app, contentKey, categoryKey) {
      var episode = null;
      var variants = {};
      var categoryExists = false;
      try {
        var catHits = app.findRecordsByFilter('categories', "key = {:k}", '', 1, 0, { k: categoryKey });
        categoryExists = !!(catHits && catHits.length > 0);
      } catch (_) {}
      try {
        var topicHits = app.findRecordsByFilter('topics', "content_key = {:k}", '', 1, 0, { k: contentKey });
        if (topicHits && topicHits.length > 0) {
          var t = topicHits[0];
          episode = {
            id: String(t.id || ''),
            status: String(t.get('status') || ''),
            contentVersion: Number(t.get('content_version') || 0),
            previousFingerprint: '',
          };
          try {
            // Latest completed audit for THIS content version. Filtering by
            // version makes the lookup deterministic (the partial unique
            // index on (content_key, content_version, package_fingerprint)
            // WHERE status='completed' guarantees at most one row; the
            // collection has no `created` column, so no sort is applied).
            var lastImports = app.findRecordsByFilter(
              'content_imports',
              "content_key = {:k} && status = 'completed' && content_version = {:v}",
              '',
              1,
              0,
              { k: contentKey, v: episode.contentVersion }
            );
            if (lastImports && lastImports.length > 0) {
              episode.previousFingerprint = String(lastImports[0].get('package_fingerprint') || '');
            }
          } catch (_) {}
          try {
            var lessonHits = app.findRecordsByFilter('lessons', "topic = {:tid}", '', 0, 0, { tid: String(t.id || '') });
            if (lessonHits) {
              for (var li = 0; li < lessonHits.length; li++) {
                var lesson = lessonHits[li];
                variants[String(lesson.get('level') || '')] = {
                  id: String(lesson.id || ''),
                  status: String(lesson.get('status') || ''),
                  contentVersion: Number(lesson.get('content_version') || 0),
                };
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
      return { contentKey: contentKey, episode: episode, variants: variants, categoryExists: categoryExists };
    }

    function buildPlan(core, manifest, fingerprint, state) {
      var decision = 'rejected';
      if (!state.categoryExists) {
        decision = 'rejected';
      } else if (!state.episode) {
        decision = 'new';
      } else if (manifest.contentVersion < state.episode.contentVersion) {
        decision = 'stale';
      } else if (manifest.contentVersion > state.episode.contentVersion) {
        decision = 'update';
      } else if (state.episode.previousFingerprint && state.episode.previousFingerprint === fingerprint) {
        decision = 'no_change';
      } else {
        decision = 'conflict';
      }
      var variants = [];
      var vocabulary = [];
      var mediaUploads = [];
      var episodesCreate = 0;
      var episodesUpdate = 0;
      var variantsCreate = 0;
      var variantsUpdate = 0;
      var vocabularyCreate = 0;
      var episodeAction = 'none';
      var episodeReason = '';
      if (decision === 'new') { episodeAction = 'create'; episodesCreate = 1; }
      else if (decision === 'update') { episodeAction = 'update'; episodesUpdate = 1; }
      else if (decision === 'conflict') { episodeReason = 'conflict: same content version with a different fingerprint'; }
      else if (decision === 'stale') { episodeReason = 'stale: imported version is lower than the existing one'; }
      else if (decision === 'rejected') { episodeReason = 'rejected: category does not exist'; }
      else { episodeReason = 'no_change: identical package already imported'; }

      if (decision === 'new' || decision === 'update') {
        mediaUploads.push(manifest.episode.artworkSquare);
        if (manifest.episode.heroImageWide) mediaUploads.push(manifest.episode.heroImageWide);
        var levels = core.CEFR_LEVELS;
        for (var i = 0; i < levels.length; i++) {
          var level = levels[i];
          var variant = null;
          for (var vi = 0; vi < manifest.variants.length; vi++) {
            if (manifest.variants[vi].level === level) { variant = manifest.variants[vi]; break; }
          }
          if (!variant) continue;
          var existing = state.variants[level];
          if (existing) {
            variants.push({ level: level, action: 'update' });
            variantsUpdate += 1;
          } else {
            variants.push({ level: level, action: 'create' });
            variantsCreate += 1;
          }
          vocabulary.push({ level: level, count: variant.vocabulary.length });
          vocabularyCreate += variant.vocabulary.length;
          mediaUploads.push(variant.audio);
          for (var vj = 0; vj < variant.vocabulary.length; vj++) {
            if (variant.vocabulary[vj].pronunciationAudio) mediaUploads.push(variant.vocabulary[vj].pronunciationAudio);
          }
        }
      } else {
        for (var k = 0; k < manifest.variants.length; k++) {
          variants.push({ level: manifest.variants[k].level, action: 'none', reason: episodeReason });
          vocabulary.push({ level: manifest.variants[k].level, count: manifest.variants[k].vocabulary.length });
        }
      }

      return {
        decision: decision,
        contentKey: manifest.contentKey,
        contentVersion: manifest.contentVersion,
        fingerprint: fingerprint,
        category: { key: manifest.categoryKey, action: state.categoryExists ? 'reuse' : 'missing' },
        episode: { action: episodeAction, reason: episodeReason || undefined },
        variants: variants,
        vocabulary: vocabulary,
        media: { uploads: mediaUploads },
        publication: { targetState: 'draft' },
        summary: {
          episodesCreate: episodesCreate,
          episodesUpdate: episodesUpdate,
          variantsCreate: variantsCreate,
          variantsUpdate: variantsUpdate,
          vocabularyCreate: vocabularyCreate,
          mediaUpload: mediaUploads.length,
        },
      };
    }

    try {
      var payload = null;
      try {
        var bodyBytes = toBytes(e.request.body, 4 * 1024 * 1024);
        if (bodyBytes && bodyBytes.length > 0) {
          // UTF-8 decode (String.fromCharCode would mojibake Persian text).
          payload = JSON.parse(core.utf8Decode(bodyBytes));
        }
      } catch (_) { payload = null; }
      if (!payload || typeof payload !== 'object') {
        return e.json(400, { code: "invalid_request", message: "A JSON body is required." });
      }
      var manifestRaw = payload.manifest;
      if (typeof manifestRaw !== 'string') {
        return e.json(400, { code: "invalid_request", message: "manifest (string) is required." });
      }
      var manifest = null;
      try { manifest = JSON.parse(manifestRaw); } catch (_) { manifest = null; }
      if (!manifest) {
        return e.json(400, { code: "MANIFEST_INVALID_JSON", message: "manifest is not valid JSON.", errorJson: JSON.stringify(core.sanitizeDiagnostics([{ code: 'MANIFEST_INVALID_JSON', severity: 'error', path: '$', message: 'Manifest is not valid JSON.' }])) });
      }
      var struct = core.validateManifestStruct(manifest);
      if (!struct.ok) {
        return e.json(400, { code: "manifest_invalid", message: "Manifest validation failed.", errorJson: JSON.stringify(core.sanitizeDiagnostics(struct.errors)) });
      }

      // Asset inventory from the CLI (checksums are re-verified from the
      // actual bytes during execute; this route only builds the diff).
      var declared = core.declaredAssets(manifest);
      var submitted = payload.assets;
      if (!Array.isArray(submitted)) {
        return e.json(400, { code: "invalid_request", message: "assets array is required." });
      }
      var seenPaths = {};
      var assetList = [];
      for (var si = 0; si < submitted.length; si++) {
        var a = submitted[si];
        if (!a || typeof a.path !== 'string' || !declared[a.path]) {
          return e.json(400, { code: "ASSET_NOT_DECLARED", message: "An uploaded asset is not declared in the manifest." });
        }
        if (seenPaths[a.path]) {
          return e.json(400, { code: "ASSET_DUPLICATE", message: "Duplicate asset path in the inventory." });
        }
        seenPaths[a.path] = true;
        if (typeof a.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(a.sha256)) {
          return e.json(400, { code: "ASSET_CHECKSUM_INVALID", message: "Asset checksum must be 64 hex characters." });
        }
        var size = Number(a.sizeBytes || 0);
        var kind = declared[a.path];
        var limit = kind === 'pronunciationAudio' ? core.PRONUNCIATION_MAX : kind === 'audio' ? core.AUDIO_MAX : kind === 'transcript' ? 256 * 1024 : core.ARTWORK_MAX;
        if (!Number.isInteger(size) || size < 0 || size > limit) {
          return e.json(400, { code: "ASSET_SIZE_EXCEEDED", message: "Asset size exceeds the limit for " + a.path + "." });
        }
        assetList.push({ path: a.path, sizeBytes: size, sha256: a.sha256 });
      }
      for (var declaredPath in declared) {
        if (!seenPaths[declaredPath]) {
          return e.json(400, { code: "ASSET_MISSING", message: "Declared asset is missing from the inventory: " + declaredPath + "." });
        }
      }

      var fingerprint = core.packageFingerprint(core.canonicalJson(manifest), assetList);
      var state = loadContentState($app, manifest.contentKey, manifest.categoryKey);
      var plan = buildPlan(core, manifest, fingerprint, state);
      var stateHash = core.planStateHash({
        contentKey: state.contentKey,
        episode: state.episode,
        variants: state.variants,
        categoryExists: state.categoryExists,
      });

      return e.json(200, {
        result: plan.decision,
        planStateHash: stateHash,
        package: {
          contentKey: manifest.contentKey,
          contentVersion: manifest.contentVersion,
          fingerprint: fingerprint,
          schemaVersion: manifest.schemaVersion,
        },
        contentKey: manifest.contentKey,
        contentVersion: manifest.contentVersion,
        fingerprint: fingerprint,
        category: plan.category,
        episode: plan.episode,
        variants: plan.variants,
        vocabulary: plan.vocabulary,
        media: plan.media,
        publication: plan.publication,
        summary: plan.summary,
      });
    } catch (topErr) {
      try { $app.logger().error("content_import: PLAN error: " + String(topErr && topErr.message ? topErr.message : topErr)); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("staff_admins")
);

// ---------------------------------------------------------------------
// POST /api/fast-english/staff/content-import/execute
// ---------------------------------------------------------------------

routerAdd(
  "POST",
  "/api/fast-english/staff/content-import/execute",
  function (e) {
    var core = null;
    try { core = require(__hooks + '/content_import_core.pb.js'); } catch (_) { core = null; }
    if (!core || !core.validateManifestStruct) {
      return e.json(500, { code: "internal_error", message: "Import helpers unavailable." });
    }
    var g = null;
    try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
    if (!g || !g.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Import helpers unavailable." });
    var guardErr = g.requireStaffAdmin(e);
    if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });

    // Per-staff rate limit (execute is a heavy write; 30/min is still a
    // tight bound for a staff-only administrative operation).
    if (typeof globalThis.__fepImportExecRate === "undefined") { globalThis.__fepImportExecRate = {}; }
    var rateWindow = globalThis.__fepImportExecRate;
    var staffId = String(e.auth.id || "");
    var nowMs0 = Date.now();
    var bucket = rateWindow[staffId];
    if (!bucket || !Array.isArray(bucket)) { bucket = []; rateWindow[staffId] = bucket; }
    var keep = [];
    for (var wi = 0; wi < bucket.length; wi++) { if (bucket[wi] > nowMs0 - 300000) keep.push(bucket[wi]); }
    bucket.length = 0;
    for (var wj = 0; wj < keep.length; wj++) bucket.push(keep[wj]);
    if (bucket.length >= 30) return e.json(429, { code: "rate_limited", message: "Too many requests." });
    bucket.push(nowMs0);

    // --- Helpers (inlined: PB 0.39 JSVM handlers cannot see top-level) ---
    function failAudit(app, auditRecord, errorDiags) {
      try {
        auditRecord.set('status', 'failed');
        auditRecord.set('error_json', JSON.stringify(core.sanitizeDiagnostics(errorDiags)));
        auditRecord.set('completed_at', new Date().toISOString());
        app.save(auditRecord);
      } catch (_) {}
    }

    function readUploadedBytes(field) {
      var files = [];
      try { files = e.findUploadedFiles(field) || []; } catch (_) { files = []; }
      if (!files || files.length === 0) return null;
      if (files.length > 1) return { error: 'ASSET_DUPLICATE' };
      var f = files[0];
      var opened = null;
      var bytes = null;
      try {
        opened = f.reader.open();
        bytes = toBytes(opened, core.AUDIO_MAX + 1024 * 1024);
      } catch (_) { bytes = null; } finally {
        if (opened && typeof opened.close === 'function') { try { opened.close(); } catch (_) {} }
      }
      if (!bytes || bytes.length === 0) return { error: 'ASSET_EMPTY' };
      return { bytes: bytes, file: f, name: String(f.originalName || f.name || '') };
    }

    function detectImageKind(bytes) {
      if (!bytes || bytes.length < 12) return '';
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
          bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'png';
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
          bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
      return '';
    }

    function kindToMime(kind) {
      if (kind === 'jpeg') return 'image/jpeg';
      if (kind === 'png') return 'image/png';
      if (kind === 'webp') return 'image/webp';
      return '';
    }

    function kindToExt(kind) {
      if (kind === 'jpeg') return 'jpg';
      if (kind === 'png') return 'png';
      if (kind === 'webp') return 'webp';
      return 'bin';
    }

    function declaredMimeOf(f) {
      var mime = '';
      try {
        var fh = f && f.reader;
        var mimeHdr = fh && fh.header && fh.header.header;
        if (mimeHdr && typeof mimeHdr.get === 'function') {
          var raw = mimeHdr.get('Content-Type');
          if (raw) {
            var semi = String(raw).indexOf(';');
            mime = (semi >= 0 ? String(raw).substring(0, semi) : String(raw)).trim().toLowerCase();
          }
        }
      } catch (_) {}
      return mime;
    }

    function loadContentState(app, contentKey, categoryKey) {
      var episode = null;
      var variants = {};
      var categoryExists = false;
      try {
        var catHits = app.findRecordsByFilter('categories', "key = {:k}", '', 1, 0, { k: categoryKey });
        categoryExists = !!(catHits && catHits.length > 0);
      } catch (_) {}
      try {
        var topicHits = app.findRecordsByFilter('topics', "content_key = {:k}", '', 1, 0, { k: contentKey });
        if (topicHits && topicHits.length > 0) {
          var t = topicHits[0];
          episode = {
            id: String(t.id || ''),
            status: String(t.get('status') || ''),
            contentVersion: Number(t.get('content_version') || 0),
            previousFingerprint: '',
          };
          try {
            // Latest completed audit for THIS content version. Filtering by
            // version makes the lookup deterministic (the partial unique
            // index on (content_key, content_version, package_fingerprint)
            // WHERE status='completed' guarantees at most one row; the
            // collection has no `created` column, so no sort is applied).
            var lastImports = app.findRecordsByFilter(
              'content_imports',
              "content_key = {:k} && status = 'completed' && content_version = {:v}",
              '',
              1,
              0,
              { k: contentKey, v: episode.contentVersion }
            );
            if (lastImports && lastImports.length > 0) {
              episode.previousFingerprint = String(lastImports[0].get('package_fingerprint') || '');
            }
          } catch (_) {}
          try {
            var lessonHits = app.findRecordsByFilter('lessons', "topic = {:tid}", '', 0, 0, { tid: String(t.id || '') });
            if (lessonHits) {
              for (var li = 0; li < lessonHits.length; li++) {
                var lesson = lessonHits[li];
                variants[String(lesson.get('level') || '')] = {
                  id: String(lesson.id || ''),
                  status: String(lesson.get('status') || ''),
                  contentVersion: Number(lesson.get('content_version') || 0),
                };
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
      return { contentKey: contentKey, episode: episode, variants: variants, categoryExists: categoryExists };
    }

    function decide(core, manifest, fingerprint, state) {
      if (!state.categoryExists) return 'rejected';
      if (!state.episode) return 'new';
      if (manifest.contentVersion < state.episode.contentVersion) return 'stale';
      if (manifest.contentVersion > state.episode.contentVersion) return 'update';
      if (state.episode.previousFingerprint && state.episode.previousFingerprint === fingerprint) return 'no_change';
      return 'conflict';
    }

    // Validates every uploaded part against the manifest and returns
    // { ok, errors, assets } where assets maps path -> { bytes, file,
    // kind, mime, durationSeconds?, transcript? }.
    function validateUploadedParts(manifest) {
      var errors = [];
      var declared = core.declaredAssets(manifest);
      var assets = {};
      var uploadedFieldNames = [];
      try {
        var mpf = e.request.multipartForm;
        if (mpf && mpf.file) {
          uploadedFieldNames = Object.keys(mpf.file);
        }
      } catch (_) { uploadedFieldNames = []; }

      for (var fi = 0; fi < uploadedFieldNames.length; fi++) {
        var fname = uploadedFieldNames[fi];
        if (fname === 'manifest') continue;
        if (!declared[fname]) {
          errors.push({ code: 'ASSET_NOT_DECLARED', severity: 'error', path: fname, message: 'Unexpected uploaded file is not declared in the manifest.' });
        }
      }

      for (var path in declared) {
        var kind = declared[path];
        var read = readUploadedBytes(path);
        if (!read) {
          errors.push({ code: 'ASSET_MISSING', severity: 'error', path: path, message: 'Declared asset is missing from the upload.' });
          continue;
        }
        if (read.error) {
          errors.push({ code: read.error, severity: 'error', path: path, message: 'Duplicate or empty asset part.' });
          continue;
        }
        var bytes = read.bytes;
        var declaredMime = declaredMimeOf(read.file);

        if (kind === 'artworkSquare' || kind === 'heroImageWide') {
          if (bytes.length > core.ARTWORK_MAX) {
            errors.push({ code: 'ASSET_SIZE_EXCEEDED', severity: 'error', path: path, message: 'Image exceeds the 5 MB limit.' });
            continue;
          }
          var imgKind = detectImageKind(bytes);
          var imgMime = kindToMime(imgKind);
          if (!imgMime) {
            errors.push({ code: 'IMAGE_UNSUPPORTED_TYPE', severity: 'error', path: path, message: 'Image signature is not JPEG/PNG/WebP.' });
            continue;
          }
          if (declaredMime && declaredMime !== imgMime) {
            errors.push({ code: 'ASSET_MIME_MISMATCH', severity: 'error', path: path, message: 'Declared Content-Type does not match the image signature.' });
            continue;
          }
          var lowerName = read.name.toLowerCase();
          var extOk = false;
          var extList = imgKind === 'jpeg' ? ['.jpg', '.jpeg'] : imgKind === 'png' ? ['.png'] : ['.webp'];
          for (var ei = 0; ei < extList.length; ei++) { if (lowerName.indexOf(extList[ei]) >= 0) extOk = true; }
          if (!extOk) {
            errors.push({ code: 'IMAGE_EXTENSION_MISMATCH', severity: 'error', path: path, message: 'Image extension does not match its signature (got "' + lowerName + '").' });
            continue;
          }
          read.file.name = $security.randomString(16) + '.' + kindToExt(imgKind);
          assets[path] = { bytes: bytes, file: read.file, kind: kind, mime: imgMime };
        } else if (kind === 'audio' || kind === 'pronunciationAudio') {
          var maxBytes = kind === 'pronunciationAudio' ? core.PRONUNCIATION_MAX : core.AUDIO_MAX;
          if (bytes.length > maxBytes) {
            errors.push({ code: 'ASSET_SIZE_EXCEEDED', severity: 'error', path: path, message: 'Audio exceeds the size limit (' + maxBytes + ' bytes).' });
            continue;
          }
          var lower = path.toLowerCase();
          var mime = '';
          var ext = '';
          var duration = 0;
          if (lower.indexOf('.mp3') >= 0) {
            mime = 'audio/mpeg';
            ext = 'mp3';
            duration = core.mp3DurationSeconds(bytes);
          } else if (lower.indexOf('.m4a') >= 0 || lower.indexOf('.mp4') >= 0) {
            mime = 'audio/mp4';
            ext = 'm4a';
            duration = core.mp4DurationSeconds(bytes);
          } else {
            errors.push({ code: 'AUDIO_UNSUPPORTED_TYPE', severity: 'error', path: path, message: 'Audio must be MP3 or M4A.' });
            continue;
          }
          if (declaredMime && declaredMime !== mime) {
            errors.push({ code: 'ASSET_MIME_MISMATCH', severity: 'error', path: path, message: 'Declared Content-Type does not match the audio format.' });
            continue;
          }
          if (duration <= 0) {
            errors.push({ code: 'AUDIO_DURATION_UNREADABLE', severity: 'error', path: path, message: 'Could not determine a positive audio duration.' });
            continue;
          }
          read.file.name = $security.randomString(16) + '.' + ext;
          assets[path] = { bytes: bytes, file: read.file, kind: kind, mime: mime, durationSeconds: duration };
        } else {
          // transcript
          if (bytes.length > 256 * 1024) {
            errors.push({ code: 'ASSET_SIZE_EXCEEDED', severity: 'error', path: path, message: 'Transcript exceeds the 256 KB limit.' });
            continue;
          }
          var text = core.utf8Decode(bytes);
          var normalized = core.normalizeTranscriptText(text);
          if (normalized.length > core.TRANSCRIPT_MAX_CHARS) {
            errors.push({ code: 'TRANSCRIPT_TOO_LONG', severity: 'error', path: path, message: 'Transcript exceeds 50000 characters.' });
            continue;
          }
          var forbidden = core.TRANSCRIPT_FORBIDDEN;
          var bad = null;
          for (var pi2 = 0; pi2 < forbidden.length; pi2++) {
            if (forbidden[pi2].pattern.test(normalized)) { bad = forbidden[pi2]; break; }
          }
          if (bad) {
            errors.push({ code: bad.code, severity: 'error', path: path, message: 'Transcript contains a forbidden construct.' });
            continue;
          }
          if (core.transcriptIsEffectivelyEmpty(normalized)) {
            errors.push({ code: 'TRANSCRIPT_EMPTY', severity: 'error', path: path, message: 'Transcript is empty or contains only headings.' });
            continue;
          }
          assets[path] = { kind: kind, transcript: normalized, bytes: bytes };
        }
      }
      return { ok: errors.length === 0, errors: errors, assets: assets };
    }

    function applyImport(txApp, manifest, assets, state, staffId, core) {
      var category = null;
      try {
        var catHits = txApp.findRecordsByFilter('categories', "key = {:k}", '', 1, 0, { k: manifest.categoryKey });
        category = catHits && catHits.length > 0 ? catHits[0] : null;
      } catch (_) {}
      if (!category) throw new Error('category_not_found');

      var topicColl = txApp.findCollectionByNameOrId('topics');
      var lessonColl = txApp.findCollectionByNameOrId('lessons');
      var vocabColl = txApp.findCollectionByNameOrId('lesson_vocabulary');

      // Episode (topics): create or update, always as Draft.
      var topic = null;
      var topicCreated = false;
      if (state.episode) {
        try { topic = txApp.findRecordById('topics', state.episode.id); } catch (_) { topic = null; }
      }
      if (!topic) {
        topic = new Record(topicColl);
        topicCreated = true;
      }
      topic.set('title', String(manifest.episode.titleEn).slice(0, 120));
      topic.set('slug', manifest.episode.slug);
      topic.set('description', String(manifest.episode.descriptionFa).slice(0, 500));
      topic.set('sort_order', Math.max(1, Number(manifest.episode.episodeNumber) || 1));
      topic.set('status', 'draft');
      topic.set('category', String(category.id || ''));
      topic.set('content_key', manifest.contentKey);
      topic.set('content_version', Number(manifest.contentVersion));
      topic.set('title_fa', String(manifest.episode.titleFa).slice(0, 200));
      topic.set('description_fa', String(manifest.episode.descriptionFa).slice(0, 2000));
      topic.set('artwork_alt_fa', String(manifest.episode.artworkAltFa).slice(0, 500));
      if (typeof manifest.episode.episodeNumber === 'number') {
        topic.set('episode_number', Number(manifest.episode.episodeNumber));
      }
      if (typeof manifest.episode.featured === 'boolean') {
        topic.set('is_featured', manifest.episode.featured);
      }
      var artAsset = assets[manifest.episode.artworkSquare];
      if (artAsset) topic.set('artwork_square', artAsset.file);
      if (manifest.episode.heroImageWide && assets[manifest.episode.heroImageWide]) {
        topic.set('hero_image_wide', assets[manifest.episode.heroImageWide].file);
      }
      txApp.save(topic);
      var topicId = String(topic.id || '');

      var createdVariants = {};
      var summary = { episodesCreate: 0, episodesUpdate: 0, variantsCreate: 0, variantsUpdate: 0, vocabularyCreate: 0, mediaUpload: 0, episodeId: topicId };

      if (state.episode) {
        // Higher-version update: the whole Episode moves to Draft so the
        // live published experience is never silently overwritten; all
        // Variants go to Draft so stale variants cannot resurface on a
        // later Publish. (Existing Progress records are untouched.)
        summary.episodesUpdate = 1;
        try {
          var allLessons = txApp.findRecordsByFilter('lessons', "topic = {:tid}", '', 0, 0, { tid: topicId });
          if (allLessons) {
            for (var al = 0; al < allLessons.length; al++) {
              if (String(allLessons[al].get('status') || '') === 'published') {
                allLessons[al].set('status', 'draft');
                txApp.save(allLessons[al]);
              }
            }
          }
        } catch (_) {}
      } else {
        summary.episodesCreate = 1;
      }

      for (var vi = 0; vi < manifest.variants.length; vi++) {
        var variant = manifest.variants[vi];
        var level = variant.level;
        var audioAsset = assets[variant.audio];
        if (!audioAsset) throw new Error('audio_asset_missing:' + level);
        var transcriptAsset = assets[variant.transcript];
        if (!transcriptAsset) throw new Error('transcript_asset_missing:' + level);

        var lesson = null;
        var lessonCreated = false;
        if (state.variants[level]) {
          try { lesson = txApp.findRecordById('lessons', state.variants[level].id); } catch (_) { lesson = null; }
        }
        if (!lesson) {
          lesson = new Record(lessonColl);
          lessonCreated = true;
        }
        lesson.set('topic', topicId);
        lesson.set('level', level);
        lesson.set('title', String(manifest.episode.titleEn).slice(0, 200));
        lesson.set('summary', String(variant.summaryFa).slice(0, 500));
        lesson.set('summary_fa', String(variant.summaryFa).slice(0, 500));
        lesson.set('body', transcriptAsset.transcript);
        lesson.set('audio', audioAsset.file);
        lesson.set('status', 'draft');
        lesson.set('content_version', Number(manifest.contentVersion));
        lesson.set('audio_duration_seconds', Number(audioAsset.durationSeconds));
        var estMinutes = Math.max(1, Math.min(120, Math.ceil(Number(audioAsset.durationSeconds) / 60)));
        lesson.set('estimated_minutes', estMinutes);
        txApp.save(lesson);
        var lessonId = String(lesson.id || '');
        createdVariants[level] = { id: lessonId, action: lessonCreated ? 'create' : 'update' };
        if (lessonCreated) summary.variantsCreate += 1; else summary.variantsUpdate += 1;

        // Vocabulary: replace this Variant's list (old entries are
        // removed only for imported Variants; sort order is the declared
        // index — deterministic).
        try {
          var oldVocab = txApp.findRecordsByFilter('lesson_vocabulary', "lesson = {:lid}", '', 0, 0, { lid: lessonId });
          if (oldVocab) {
            for (var ov = 0; ov < oldVocab.length; ov++) {
              try { txApp.delete(oldVocab[ov]); } catch (_) {}
            }
          }
        } catch (_) {}
        for (var vj = 0; vj < variant.vocabulary.length; vj++) {
          var entry = variant.vocabulary[vj];
          var rec = new Record(vocabColl);
          rec.set('lesson', lessonId);
          rec.set('term', String(entry.term).slice(0, 200));
          rec.set('normalized_term', core.normalizeVocabularyTerm(entry.term).slice(0, 200));
          if (entry.phonetic) rec.set('phonetic', String(entry.phonetic).slice(0, 200));
          if (entry.partOfSpeech) rec.set('part_of_speech', String(entry.partOfSpeech).slice(0, 50));
          rec.set('meaning_fa', String(entry.meaningFa).slice(0, 500));
          rec.set('definition_en', String(entry.definitionEn).slice(0, 500));
          if (entry.exampleSentence) rec.set('example_sentence', String(entry.exampleSentence).slice(0, 1000));
          if (entry.pronunciationAudio && assets[entry.pronunciationAudio]) {
            rec.set('pronunciation_audio', assets[entry.pronunciationAudio].file);
          }
          rec.set('sort_order', vj);
          txApp.save(rec);
          summary.vocabularyCreate += 1;
        }
      }

      summary.mediaUpload = 0;
      for (var ap in assets) { if (assets[ap].file) summary.mediaUpload += 1; }
      return { topicId: topicId, createdVariants: createdVariants, summary: summary };
    }

    try {
      // Parse multipart (order-independent: form values are available
      // only after ParseMultipartForm runs).
      try { e.request.parseMultipartForm(64 * 1024 * 1024); } catch (pmfErr) { try { e.findUploadedFiles('__none__'); } catch (_) {} }

      var manifestRaw = '';
      try { manifestRaw = String(e.request.form.get('manifest') || ''); } catch (_) { manifestRaw = ''; }
      if (!manifestRaw) {
        return e.json(400, { code: "invalid_request", message: "manifest part is required." });
      }
      var manifest = null;
      try { manifest = JSON.parse(manifestRaw); } catch (_) { manifest = null; }
      if (!manifest) {
        return e.json(400, { code: "MANIFEST_INVALID_JSON", message: "manifest is not valid JSON." });
      }
      var struct = core.validateManifestStruct(manifest);
      if (!struct.ok) {
        return e.json(400, { code: "manifest_invalid", message: "Manifest validation failed.", errorJson: JSON.stringify(core.sanitizeDiagnostics(struct.errors)) });
      }

      // The plan the CLI claims to be based on (stale-plan protection).
      // Required: execute without a plan hash bypasses the documented
      // stale-state check, so a missing or malformed hash is rejected.
      var claimedHash = '';
      try { claimedHash = String(e.request.url.query().get('planStateHash') || ''); } catch (_) { claimedHash = ''; }
      if (!/^[0-9a-f]{64}$/.test(claimedHash)) {
        return e.json(400, { code: "plan_state_required", message: "planStateHash is required. Run content:plan first and pass the returned planStateHash." });
      }

      var uploaded = validateUploadedParts(manifest);
      if (!uploaded.ok) {
        return e.json(400, { code: "upload_invalid", message: "Uploaded assets failed validation.", errorJson: JSON.stringify(core.sanitizeDiagnostics(uploaded.errors)) });
      }

      // Authoritative server-side fingerprint from the actual bytes.
      var assetList = [];
      for (var ap2 in uploaded.assets) {
        assetList.push({ path: ap2, sizeBytes: uploaded.assets[ap2].bytes.length, sha256: core.sha256Hex(uploaded.assets[ap2].bytes) });
      }
      var fingerprint = core.packageFingerprint(core.canonicalJson(manifest), assetList);

      var state = loadContentState($app, manifest.contentKey, manifest.categoryKey);
      var stateHash = core.planStateHash({ contentKey: state.contentKey, episode: state.episode, variants: state.variants, categoryExists: state.categoryExists });
      if (claimedHash !== stateHash) {
        return e.json(409, { code: "plan_stale", message: "The database state changed since the plan was created. Re-run content:plan." });
      }

      var decision = decide(core, manifest, fingerprint, state);

      // no_change: identical package already imported — nothing to write.
      // An audit record is still created so repeated imports are traceable
      // (status 'no_change'; never conflicts with the completed-unique index).
      if (decision === 'no_change') {
        var existingId = '';
        try {
          var done = $app.findRecordsByFilter('content_imports', "content_key = {:k} && status = 'completed'", '', 1, 0, { k: manifest.contentKey });
          if (done && done.length > 0) existingId = String(done[0].id || '');
        } catch (_) {}
        try {
          var ncColl = $app.findCollectionByNameOrId('content_imports');
          var ncRec = new Record(ncColl);
          ncRec.set('content_key', manifest.contentKey);
          ncRec.set('content_version', Number(manifest.contentVersion));
          ncRec.set('package_fingerprint', fingerprint);
          ncRec.set('schema_version', String(manifest.schemaVersion || ''));
          ncRec.set('status', 'no_change');
          ncRec.set('imported_by', String(e.auth.id || ''));
          var nowIso = new Date().toISOString();
          ncRec.set('started_at', nowIso);
          ncRec.set('completed_at', nowIso);
          $app.save(ncRec);
        } catch (auditErr) {}
        return e.json(200, { result: 'no_change', existingImportId: existingId, message: 'Package is unchanged; no records were written.' });
      }

      // Audit record (outside the content transaction so a failure is
      // still recorded; a crash between commit and audit-complete leaves
      // a 'running' record that the next execute supersedes as failed).
      var auditColl = $app.findCollectionByNameOrId('content_imports');
      var auditRecord = null;
      try {
        var staleRunning = $app.findRecordsByFilter('content_imports', "content_key = {:k} && status = 'running'", '', 0, 0, { k: manifest.contentKey });
        if (staleRunning) {
          for (var sr = 0; sr < staleRunning.length; sr++) {
            try {
              staleRunning[sr].set('status', 'failed');
              staleRunning[sr].set('error_json', JSON.stringify(core.sanitizeDiagnostics([{ code: 'IMPORT_SUPERSEDED', severity: 'error', path: '$', message: 'Superseded by a newer import attempt.' }])));
              staleRunning[sr].set('completed_at', new Date().toISOString());
              $app.save(staleRunning[sr]);
            } catch (_) {}
          }
        }
        auditRecord = new Record(auditColl);
        auditRecord.set('content_key', manifest.contentKey);
        auditRecord.set('content_version', Number(manifest.contentVersion));
        auditRecord.set('package_fingerprint', fingerprint);
        auditRecord.set('schema_version', String(manifest.schemaVersion || ''));
        auditRecord.set('status', 'running');
        auditRecord.set('imported_by', String(e.auth.id || ''));
        auditRecord.set('started_at', new Date().toISOString());
        $app.save(auditRecord);
      } catch (auditErr) {
        return e.json(500, { code: "unexpected_error", message: "Could not create the import audit record." });
      }

      if (decision === 'conflict' || decision === 'stale' || decision === 'rejected') {
        var conflictCode = decision === 'conflict' ? 'import_conflict' : decision === 'stale' ? 'import_stale' : 'category_not_found';
        var conflictMessage = decision === 'conflict'
          ? 'Same content version with a different fingerprint. Increment contentVersion or use an explicit replace.'
          : decision === 'stale'
            ? 'Imported content version is lower than the existing one.'
            : 'Category does not exist. The pipeline never creates Categories.';
        failAudit($app, auditRecord, [{ code: conflictCode.toUpperCase(), severity: 'error', path: '$', message: conflictMessage }]);
        return e.json(409, { code: conflictCode, message: conflictMessage, auditId: String(auditRecord.id || ''), errorJson: JSON.stringify(core.sanitizeDiagnostics([{ code: conflictCode.toUpperCase(), severity: 'error', path: '$', message: conflictMessage }])) });
      }

      // Apply the import in one transaction (records + files atomic).
      var applyError = null;
      var applyResult = null;
      try {
        $app.runInTransaction(function (txApp) {
          applyResult = applyImport(txApp, manifest, uploaded.assets, state, String(e.auth.id || ''), core);
        });
      } catch (txErr) {
        applyError = txErr;
      }

      if (applyError) {
        var msg = String(applyError && applyError.message ? applyError.message : applyError);
        var diag = [{ code: 'IMPORT_APPLY_FAILED', severity: 'error', path: '$', message: msg.slice(0, 300) }];
        failAudit($app, auditRecord, diag);
        try { $app.logger().error("content_import: EXECUTE apply error: " + msg.slice(0, 500)); } catch (_) {}
        return e.json(400, { code: "import_failed", message: "The import failed and was rolled back; no partial content is visible.", auditId: String(auditRecord.id || ''), errorJson: JSON.stringify(core.sanitizeDiagnostics(diag)) });
      }

      // Audit: completed.
      try {
        auditRecord.set('status', 'completed');
        auditRecord.set('summary_json', JSON.stringify({
          episodeId: applyResult.topicId,
          variants: applyResult.createdVariants,
          summary: applyResult.summary,
        }).slice(0, 4000));
        auditRecord.set('completed_at', new Date().toISOString());
        $app.save(auditRecord);
      } catch (_) {}

      return e.json(200, {
        result: 'completed',
        status: 'completed',
        auditId: String(auditRecord.id || ''),
        createdIds: { episodeId: applyResult.topicId, variants: applyResult.createdVariants },
        summary: applyResult.summary,
        message: 'Imported as Draft. Nothing was published.',
      });
    } catch (topErr) {
      try { $app.logger().error("content_import: EXECUTE top-level error: " + String(topErr && topErr.message ? topErr.message : topErr)); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("staff_admins")
);

// ---------------------------------------------------------------------
// GET /api/fast-english/staff/content-imports/{id}
// Sanitized audit record.
// ---------------------------------------------------------------------

routerAdd(
  "GET",
  "/api/fast-english/staff/content-imports/{id}",
  function (e) {
    var g = null;
    try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
    if (!g || !g.requireStaffAdmin) return e.json(500, { code: "internal_error", message: "Import helpers unavailable." });
    var guardErr = g.requireStaffAdmin(e);
    if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });

    var id = '';
    try { id = String(e.request.pathValue('id') || ''); } catch (_) {}
    if (!id) return e.json(400, { code: "invalid_request", message: "Missing import id." });

    var record = null;
    try { record = $app.findRecordById('content_imports', id); } catch (_) { record = null; }
    if (!record) return e.json(404, { code: "not_found", message: "Import record not found." });

    var summaryJson = null;
    var errorJson = null;
    try { summaryJson = JSON.parse(String(record.get('summary_json') || '')); } catch (_) { summaryJson = null; }
    try { errorJson = JSON.parse(String(record.get('error_json') || '')); } catch (_) { errorJson = null; }

    return e.json(200, {
      id: String(record.id || ''),
      contentKey: String(record.get('content_key') || ''),
      contentVersion: Number(record.get('content_version') || 0),
      packageFingerprint: String(record.get('package_fingerprint') || ''),
      schemaVersion: String(record.get('schema_version') || ''),
      status: String(record.get('status') || ''),
      summary: summaryJson,
      error: errorJson,
      importedBy: String(record.get('imported_by') || ''),
      startedAt: record.get('started_at') || null,
      completedAt: record.get('completed_at') || null,
      created: record.get('created') || null,
      updated: record.get('updated') || null,
    });
  },
  $apis.requireAuth("staff_admins")
);
