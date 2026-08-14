// server/pb_hooks/library_routes.pb.js
// Podcast Slice 6 — Production Library & Discovery.
//
// GET /api/fast-english/library
//   - Requires full premium entitlement (active Student, active
//     subscription, placement completed) — the same contract as the
//     lesson list route.
//   - Returns the Podcast discovery contract: one canonical Episode
//     result per Topic (never one card per Level Variant), published
//     Categories, the Student's resolved Variant with its per-Variant
//     Progress, a bounded Continue Listening rail and deterministic
//     pagination.
//   - All filtering (search, publication, Category, Level, Progress),
//     sorting and pagination happen server-side over the bounded
//     published dataset. Publication filtering runs BEFORE pagination so
//     hidden records never consume page slots or inflate totalItems.
//   - Browsing is read-only: it never modifies recommendedLevel
//     (Placement result), preferredLevel (selected_level), Placement
//     attempts or Progress of other levels.
//   - Responses are sanitized: no lesson body, no audio file names, no
//     storage paths, no internal/Staff import metadata, no Draft or
//     Archived content. Artwork URLs are the controlled proxy paths only.
//
// CRITICAL: PocketBase 0.39 JSVM recompiles the routerAdd handler in
// the executor's scope, so it CANNOT see top-level var declarations
// or function declarations in this file. Every helper and constant
// used inside the closure must be inlined into the closure body, or
// loaded via require(__hooks + '/...').

try {
  $app.logger().info("library_routes: hook file loaded");
} catch (_) {}

// =====================================================================
// GET /api/fast-english/library
// =====================================================================

routerAdd(
  "GET",
  "/api/fast-english/library",
  function (e) {
    var USERS_C = "fep_users";
    var SUBS_C = "subscriptions";
    var CATS_C = "categories";
    var TOPICS_C = "topics";
    var LESSONS_C = "lessons";
    var PROGRESS_C = "lesson_progress";

    var CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    var MAX_QUERY_LEN = 60;
    var MAX_PAGE = 50;
    var MAX_PER_PAGE = 50;
    var DEFAULT_PER_PAGE = 20;
    var MAX_CONTINUE = 3;

    // Inline rate limit (per user). The Library is a search surface
    // (debounced queries, filter changes), so the window is larger than
    // the lesson list route but still bounded: 120 requests / 5 min.
    var rl = require(__hooks + '/rate_limit.pb.js');

    function normalizeLevel(lvl) {
      var s = typeof lvl === 'string' ? lvl : String(lvl || '');
      s = s.replace(/^\s+|\s+$/g, '');
      for (var ci = 0; ci < CEFR_ORDER.length; ci++) {
        if (s === CEFR_ORDER[ci]) return s;
      }
      return '';
    }

    // Pure per-Variant progress state derivation (existing Progress
    // semantics — no new state machine): completed wins, then any saved
    // furthest position, otherwise not_started.
    // NOTE: PB records expose fields only via .get() in the JSVM — direct
    // property access is undefined.
    function progressStateOf(p) {
      if (!p) return 'not_started';
      if (Boolean(p.get('completed'))) return 'completed';
      if (Number(p.get('furthest_seconds') || 0) > 0) return 'in_progress';
      return 'not_started';
    }

    function progressPayload(p, durationSeconds) {
      if (!p) {
        return { state: 'not_started', percent: 0, positionSeconds: 0, completed: false };
      }
      var furthest = Number(p.get('furthest_seconds') || 0);
      var dur = Number(durationSeconds || 0);
      var percent = dur > 0 ? Math.round((furthest / dur) * 100) : 0;
      return {
        state: progressStateOf(p),
        percent: percent,
        positionSeconds: furthest,
        completed: Boolean(p.get('completed')),
      };
    }

    // Sanitized Episode metadata (same shape as the lesson list route).
    // categoryInfo may be null; artwork is the controlled proxy path
    // resolved for the Variant (thumbnail override -> Episode artwork ->
    // Product fallback), mirroring pd.resolveEpisodeArtwork.
    function episodePayload(topic, catInfo, artworkUrl) {
      return {
        id: String(topic.id || ""),
        slug: String(topic.get("slug") || ""),
        contentKey: String(topic.get("content_key") || ""),
        title: String(topic.get("title") || ""),
        titleFa: String(topic.get("title_fa") || ""),
        descriptionFa: String(topic.get("description_fa") || ""),
        category: catInfo,
        artwork: artworkUrl || "",
        featured: Boolean(topic.get("is_featured")),
      };
    }

    function categoryInfo(cat) {
      if (!cat) return null;
      return {
        id: String(cat.id || ""),
        key: String(cat.get("key") || ""),
        slug: String(cat.get("slug") || ""),
        titleFa: String(cat.get("title_fa") || ""),
      };
    }

    try {
      // -----------------------------------------------------------------
      // 1. Full entitlement check (inlined, identical to lesson list).
      // -----------------------------------------------------------------
      var entitlementErr = null;
      var uid = "";
      if (!e.auth || !e.auth.id) {
        entitlementErr = { status: 401, body: { code: "auth_required", message: "Authentication required." } };
      } else {
        uid = String(e.auth.id || "");
        var student = null;
        try { student = $app.findRecordById(USERS_C, uid); } catch (_) {}
        if (!student) {
          entitlementErr = { status: 401, body: { code: "user_not_found", message: "User not found." } };
        } else {
          var g = null;
          try { g = require(__hooks + '/guards.pb.js'); } catch (_) { g = null; }
          // Fail closed: an unavailable guard must not let the request through.
          var guardErr = (g && g.requireStudent) ? g.requireStudent(e) : { status: 500, code: "unexpected_error", message: "Internal error." };
          if (guardErr) {
            entitlementErr = { status: guardErr.status, body: { code: guardErr.code, message: guardErr.message } };
          } else {
            var acct = String(student.get("account_status") || "");
            if (acct === "suspended") {
              entitlementErr = { status: 403, body: { code: "account_suspended", message: "Account is suspended." } };
            } else if (acct !== "active") {
              entitlementErr = { status: 403, body: { code: "subscription_required", message: "Active subscription required." } };
            } else {
              var pc = Boolean(student.get("placement_completed"));
              var selLvl = String(student.get("selected_level") || "");
              if (!pc || !selLvl) {
                entitlementErr = { status: 403, body: { code: "placement_incomplete", message: "Placement must be completed first." } };
              } else {
                var nowMs = Date.now();
                var hasSub = false;
                try {
                  var subs = $app.findRecordsByFilter(SUBS_C, "user = {:uid} && status = 'active'", "", 0, 0, { uid: uid });
                  for (var si = 0; si < subs.length; si++) {
                    var s = subs[si];
                    var expStr = String(s.get("expires_at") || "");
                    var startStr = String(s.get("starts_at") || "");
                    if (!expStr || !startStr) continue;
                    var expMs = new Date(expStr).getTime();
                    var startMs = new Date(startStr).getTime();
                    if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) {
                      hasSub = true;
                      break;
                    }
                  }
                } catch (_) {}
                if (!hasSub) {
                  entitlementErr = { status: 403, body: { code: "subscription_required", message: "Active subscription required." } };
                }
              }
            }
          }
        }
      }
      if (entitlementErr) return e.json(entitlementErr.status, entitlementErr.body);

      var pd = null;
      try { pd = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd = null; }
      if (!pd) return e.json(500, { code: "unexpected_error", message: "Internal error." });
      var recommendedLevel = pd.getRecommendedLevel($app, student);
      var preferredLevel = pd.getPreferredLevel(student, recommendedLevel);

      // Rate limit
      var rateErr = rl.checkRate(rl.window("__fepLibraryList"), uid, 120, 300000);
      if (rateErr) return e.json(rateErr.status, rateErr.body);

      // -----------------------------------------------------------------
      // 2. Parse and bound query parameters.
      // -----------------------------------------------------------------
      var q = "";
      try { q = String(e.request.url.query().get("q") || "").replace(/^\s+|\s+$/g, ""); } catch (_) {}
      if (q.length > MAX_QUERY_LEN) {
        return e.json(400, { code: "query_too_long", message: "Query must be at most " + MAX_QUERY_LEN + " characters." });
      }

      var categoryId = "";
      try { categoryId = String(e.request.url.query().get("category") || "").replace(/^\s+|\s+$/g, ""); } catch (_) {}
      if (categoryId.length > 100) categoryId = "";

      var levelParam = "";
      try { levelParam = String(e.request.url.query().get("level") || "").replace(/^\s+|\s+$/g, ""); } catch (_) {}
      var explicitLevel = "";
      if (levelParam && levelParam !== "preferred" && levelParam !== "all") {
        explicitLevel = normalizeLevel(levelParam);
        if (!explicitLevel) {
          return e.json(400, { code: "invalid_level", message: "Invalid level. Must be one of: preferred, all, A1, A2, B1, B2, C1, C2." });
        }
      }

      var progressParam = "all";
      try { progressParam = String(e.request.url.query().get("progress") || "all").replace(/^\s+|\s+$/g, ""); } catch (_) {}
      var VALID_PROGRESS = { all: 1, not_started: 1, in_progress: 1, completed: 1 };
      if (!VALID_PROGRESS[progressParam]) {
        return e.json(400, { code: "invalid_progress", message: "Invalid progress filter." });
      }

      var sortParam = "suggested";
      try { sortParam = String(e.request.url.query().get("sort") || "suggested").replace(/^\s+|\s+$/g, ""); } catch (_) {}
      if (sortParam !== "suggested" && sortParam !== "latest") {
        return e.json(400, { code: "invalid_sort", message: "Invalid sort. Must be one of: suggested, latest." });
      }

      var page = 1;
      var perPage = DEFAULT_PER_PAGE;
      try {
        var qPage = e.request.url.query().get("page");
        if (qPage) { var np = parseInt(String(qPage), 10); if (!isNaN(np)) page = np; }
        var qPer = e.request.url.query().get("perPage");
        if (qPer) { var np2 = parseInt(String(qPer), 10); if (!isNaN(np2)) perPage = np2; }
      } catch (_) {}
      // Bounded inputs: clamp numeric page/page-size into safe ranges.
      if (page < 1) page = 1;
      if (page > MAX_PAGE) page = MAX_PAGE;
      if (perPage < 1) perPage = 1;
      if (perPage > MAX_PER_PAGE) perPage = MAX_PER_PAGE;

      // -----------------------------------------------------------------
      // 3. Load the bounded published dataset (bulk queries, no N+1).
      // -----------------------------------------------------------------
      var categories = [];
      try {
        categories = $app.findRecordsByFilter(CATS_C, "publication_status = 'published'", "", 0, 0);
      } catch (_) {}
      var categoryById = {};
      var categoryRows = [];
      if (categories && categories.length > 0) {
        for (var cai = 0; cai < categories.length; cai++) {
          var cat = categories[cai];
          if (!cat) continue;
          categoryById[String(cat.id || "")] = cat;
          categoryRows.push(cat);
        }
      }

      var topicFilter = "status = 'published'";
      var topicParams = {};
      if (q) {
        topicFilter = topicFilter + " && (title ~ {:q} || title_fa ~ {:q} || description_fa ~ {:q})";
        topicParams = { q: q };
      }
      var topics = [];
      try {
        topics = $app.findRecordsByFilter(TOPICS_C, topicFilter, "", 0, 0, topicParams);
      } catch (_) {}
      var topicById = {};
      if (topics && topics.length > 0) {
        for (var ti = 0; ti < topics.length; ti++) {
          var t = topics[ti];
          if (!t) continue;
          topicById[String(t.id || "")] = t;
        }
      }

      var lessonFilter = "status = 'published'";
      var lessons = [];
      try {
        lessons = $app.findRecordsByFilter(LESSONS_C, lessonFilter, "", 0, 0, {});
      } catch (_) {}
      var lessonsByTopic = {};
      var lessonById = {};
      if (lessons && lessons.length > 0) {
        for (var li = 0; li < lessons.length; li++) {
          var l = lessons[li];
          if (!l) continue;
          var lTid = "";
          try { lTid = String(l.get("topic") || ""); } catch (_) {}
          if (!lTid) continue;
          if (!lessonsByTopic[lTid]) lessonsByTopic[lTid] = [];
          lessonsByTopic[lTid].push(l);
          lessonById[String(l.id || "")] = l;
        }
      }
      // The explicit Level filter applies to Variant RESOLUTION (and thus
      // to which Episodes are discoverable), while availableLevels always
      // reflects every published Variant of the Episode — independent of
      // the filter — so the Level Switcher data stays complete.
      function variantsForFilter(tid) {
        var all = lessonsByTopic[tid];
        if (!all) return all;
        if (!explicitLevel) return all;
        var out = [];
        for (var fi = 0; fi < all.length; fi++) {
          if (String(all[fi].get("level") || "") === explicitLevel) out.push(all[fi]);
        }
        return out;
      }

      var progresses = [];
      try {
        progresses = $app.findRecordsByFilter(PROGRESS_C, "user = {:uid}", "", 0, 0, { uid: uid });
      } catch (_) {}
      var progressByLesson = {};
      if (progresses && progresses.length > 0) {
        for (var pi = 0; pi < progresses.length; pi++) {
          var pr = progresses[pi];
          if (!pr) continue;
          var prLid = "";
          try { prLid = String(pr.get("lesson") || ""); } catch (_) {}
          if (!prLid) continue;
          progressByLesson[prLid] = pr;
        }
      }

      // -----------------------------------------------------------------
      // 4. Canonical Episode grouping + Variant resolution.
      //    One discovery item per published Topic whose parent Category is
      //    published and that has >= 1 published Variant matching the
      //    level filter. Publication filtering happens BEFORE pagination.
      // -----------------------------------------------------------------
      var visible = [];
      var topicIds = Object.keys(topicById);
      for (var vi = 0; vi < topicIds.length; vi++) {
        var tid = topicIds[vi];
        var topic = topicById[tid];
        if (!topic) continue;
        // Published parent Category required (Category archival hides all
        // child content). categoryById only holds published Categories.
        var catId = "";
        try { catId = String(topic.get("category") || ""); } catch (_) {}
        if (!catId || !categoryById[catId]) continue;
        // Explicit Category filter: only Episodes of that published Category.
        if (categoryId && catId !== categoryId) continue;

        var variants = variantsForFilter(tid);
        if (!variants || variants.length === 0) continue;

        // Resolve the Variant:
        //   explicit level filter -> that published Variant
        //   otherwise (preferred / all / no filter) ->
        //     1. preferredLevel when published
        //     2. recommendedLevel when published
        //     3. first published Variant in canonical CEFR order
        var resolved = null;
        if (explicitLevel) {
          for (var e1 = 0; e1 < variants.length; e1++) {
            if (String(variants[e1].get("level") || "") === explicitLevel) { resolved = variants[e1]; break; }
          }
        } else {
          var byLevel = {};
          for (var e2 = 0; e2 < variants.length; e2++) {
            var lvl2 = normalizeLevel(variants[e2].get("level"));
            if (lvl2 && !byLevel[lvl2]) byLevel[lvl2] = variants[e2];
          }
          if (byLevel[preferredLevel]) resolved = byLevel[preferredLevel];
          else if (byLevel[recommendedLevel]) resolved = byLevel[recommendedLevel];
          else {
            for (var e3 = 0; e3 < CEFR_ORDER.length; e3++) {
              if (byLevel[CEFR_ORDER[e3]]) { resolved = byLevel[CEFR_ORDER[e3]]; break; }
            }
          }
        }
        if (!resolved) continue;

        var prog = progressByLesson[String(resolved.id || "")] || null;
        var progState = progressStateOf(prog);
        if (progressParam !== "all" && progState !== progressParam) continue;

        visible.push({ topic: topic, resolved: resolved, prog: prog, catId: catId });
      }

      // -----------------------------------------------------------------
      // 5. Deterministic sorting.
      // -----------------------------------------------------------------
      function topicPublishedAt(rec) {
        var v = "";
        try { v = String(rec.get("published_at") || ""); } catch (_) {}
        return v;
      }
      visible.sort(function (a, b) {
        if (sortParam === "latest") {
          // Authoritative Published date (Episode), newest first.
          var pa = topicPublishedAt(a.topic);
          var pb = topicPublishedAt(b.topic);
          if (pa !== pb) return pa > pb ? -1 : 1;
          var ka = String(a.topic.get("content_key") || "");
          var kb = String(b.topic.get("content_key") || "");
          if (ka !== kb) return ka < kb ? -1 : 1;
          return 0;
        }
        // suggested: featured first, then preferred-level compatibility,
        // then Episode sort order, then published date, then content key.
        var fa = Boolean(a.topic.get("is_featured"));
        var fb = Boolean(b.topic.get("is_featured"));
        if (fa !== fb) return fa ? -1 : 1;
        var ha = String(a.resolved.get("level") || "") === preferredLevel;
        var hb = String(b.resolved.get("level") || "") === preferredLevel;
        if (ha !== hb) return ha ? -1 : 1;
        var oa = Number(a.topic.get("sort_order") || 0);
        var ob = Number(b.topic.get("sort_order") || 0);
        if (oa !== ob) return oa - ob;
        var da = topicPublishedAt(a.topic);
        var db = topicPublishedAt(b.topic);
        if (da !== db) return da > db ? -1 : 1;
        var cka = String(a.topic.get("content_key") || "");
        var ckb = String(b.topic.get("content_key") || "");
        if (cka !== ckb) return cka < ckb ? -1 : 1;
        return 0;
      });

      // -----------------------------------------------------------------
      // 6. Pagination over the filtered, sorted visible set.
      // -----------------------------------------------------------------
      var totalItems = visible.length;
      var skip = (page - 1) * perPage;
      var items = [];
      for (var oi = skip; oi < visible.length && items.length < perPage; oi++) {
        var entry = visible[oi];
        var topicRec = entry.topic;
        var resolvedRec = entry.resolved;
        var catRec = categoryById[entry.catId] || null;

        // availableLevels: every published Variant of the Episode in
        // canonical CEFR order (independent of the level filter).
        var availableLevels = [];
        var allVariants = lessonsByTopic[String(topicRec.id || "")];
        var byLevelAll = {};
        if (allVariants) {
          for (var avi = 0; avi < allVariants.length; avi++) {
            var av = allVariants[avi];
            if (!av) continue;
            var avLevel = normalizeLevel(av.get("level"));
            if (avLevel && !byLevelAll[avLevel]) byLevelAll[avLevel] = av;
          }
        }
        for (var avj = 0; avj < CEFR_ORDER.length; avj++) {
          var al = CEFR_ORDER[avj];
          if (byLevelAll[al]) {
            availableLevels.push({
              level: al,
              variantId: String(byLevelAll[al].id || ""),
              isRecommended: al === recommendedLevel,
              isPreferred: al === preferredLevel,
            });
          }
        }

        var resolvedLevel = String(resolvedRec.get("level") || "");
        var resolvedDuration = Number(resolvedRec.get("audio_duration_seconds") || 0);
        items.push({
          episode: episodePayload(
            topicRec,
            categoryInfo(catRec),
            pd.resolveEpisodeArtwork(String(resolvedRec.id || ""))
          ),
          availableLevels: availableLevels,
          resolvedVariant: {
            id: String(resolvedRec.id || ""),
            level: resolvedLevel,
            durationSeconds: resolvedDuration,
            isRecommended: resolvedLevel === recommendedLevel,
            isPreferred: resolvedLevel === preferredLevel,
            progress: progressPayload(entry.prog, resolvedDuration),
          },
        });
      }

      // -----------------------------------------------------------------
      // 7. Bounded Continue Listening rail: real resumable Progress only
      //    (in-progress, not completed), any published level, newest
      //    activity first, capped at MAX_CONTINUE.
      // -----------------------------------------------------------------
      var continueListening = [];
      var continueRows = [];
      try {
        continueRows = $app.findRecordsByFilter(PROGRESS_C, "user = {:uid}", "-last_played_at", 0, 0, { uid: uid });
      } catch (_) {}
      if (continueRows && continueRows.length > 0) {
        for (var cri = 0; cri < continueRows.length && continueListening.length < MAX_CONTINUE; cri++) {
          var cr = continueRows[cri];
          if (!cr) continue;
          if (Boolean(cr.get("completed"))) continue;
          if (!(Number(cr.get("furthest_seconds") || 0) > 0)) continue;
          var crLid = "";
          try { crLid = String(cr.get("lesson") || ""); } catch (_) {}
          if (!crLid) continue;
          // The Variant must still be published with a published Episode
          // and a published parent Category (archival hides content but
          // keeps Progress; archived items are never resumable).
          var crLesson = lessonById[crLid];
          if (!crLesson) continue;
          var crTid = "";
          try { crTid = String(crLesson.get("topic") || ""); } catch (_) {}
          var crTopic = topicById[crTid];
          if (!crTopic) continue;
          var crCatId = "";
          try { crCatId = String(crTopic.get("category") || ""); } catch (_) {}
          if (!crCatId || !categoryById[crCatId]) continue;
          var crLevel = String(crLesson.get("level") || "");
          var crDuration = Number(crLesson.get("audio_duration_seconds") || 0);
          continueListening.push({
            episode: episodePayload(
              crTopic,
              categoryInfo(categoryById[crCatId]),
              pd.resolveEpisodeArtwork(crLid)
            ),
            variant: {
              id: crLid,
              level: crLevel,
              durationSeconds: crDuration,
            },
            progress: progressPayload(cr, crDuration),
          });
        }
      }

      // -----------------------------------------------------------------
      // 8. Response: published Categories with cheap Episode counts.
      // -----------------------------------------------------------------
      var categoryRowsSorted = categoryRows.slice();
      categoryRowsSorted.sort(function (a, b) {
        var oa2 = Number(a.get("sort_order") || 0);
        var ob2 = Number(b.get("sort_order") || 0);
        if (oa2 !== ob2) return oa2 - ob2;
        var ta2 = String(a.get("title_fa") || "");
        var tb2 = String(b.get("title_fa") || "");
        if (ta2 !== tb2) return ta2 < tb2 ? -1 : 1;
        return String(a.id || "") < String(b.id || "") ? -1 : 1;
      });
      var catOut = [];
      for (var coi = 0; coi < categoryRowsSorted.length; coi++) {
        var co = categoryRowsSorted[coi];
        // Count only published Episodes that are actually discoverable
        // (>= 1 published Variant) so the chip count and the discovery
        // list can never disagree.
        var count = 0;
        var cid2 = String(co.id || "");
        for (var tzi = 0; tzi < topicIds.length; tzi++) {
          var tz = topicById[topicIds[tzi]];
          if (!tz) continue;
          var tzCat = "";
          try { tzCat = String(tz.get("category") || ""); } catch (_) {}
          if (tzCat !== cid2) continue;
          var tzVariants = lessonsByTopic[String(tz.id || "")];
          if (tzVariants && tzVariants.length > 0) count++;
        }
        catOut.push({
          id: cid2,
          key: String(co.get("key") || ""),
          slug: String(co.get("slug") || ""),
          titleFa: String(co.get("title_fa") || ""),
          episodeCount: count,
        });
      }

      try { e.response.header().set("Cache-Control", "private, no-store"); } catch (_) {}
      try { e.response.header().set("Pragma", "no-cache"); } catch (_) {}

      return e.json(200, {
        categories: catOut,
        items: items,
        continueListening: continueListening,
        page: page,
        perPage: perPage,
        totalItems: totalItems,
        recommendedLevel: recommendedLevel,
        preferredLevel: preferredLevel,
      });
    } catch (topErr) {
      var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
      try { $app.logger().error("library_routes: LIST error: " + msg); } catch (_) {}
      return e.json(500, { code: "unexpected_error", message: "Internal error." });
    }
  },
  $apis.requireAuth("fep_users")
);
