// server/pb_migrations/1700000023_backfill_podcast_domain.js
// Podcast Slice 2 — deterministic backfill of existing content into the
// Podcast domain.
//
// This migration is the documented existing-data migration plan:
//
//   Categories
//     - Creates one controlled default Category: key=general, slug=general,
//       title_fa=عمومی, title_en=General, publication_status=published.
//       Every existing Topic is assigned to it, so no Topic is ever left
//       without a Category and existing published content remains visible.
//
//   Topics -> canonical Episodes
//     - content_key  = "legacy." + slug (deterministic, unique because
//                      slug is unique; never random).
//     - content_version = 1.
//     - category     = default Category.
//     - Persian title/description are NOT invented: they stay empty and
//       are only required when the Episode is (re)published after this
//       slice (grandfathered content keeps working).
//
//   Lessons -> Episode Variants
//     - content_version = 1.
//     - summary_fa is NOT generated automatically: it stays empty and is
//       only required when the Variant is (re)published after this slice.
//
//   Progress
//     - lesson_progress is NOT touched: records, relations and counts
//       remain byte-identical (proven by the podcast-domain smoke suite).
//
// The migration intentionally never changes `status`, so no record is
// silently unpublished or republished.

migrate(
  (app) => {
    // --- 1. Default Category -------------------------------------------------
    let defaultCategoryId = '';
    try {
      const existing = app.findRecordsByFilter('categories', "key = 'general'", '', 1, 0);
      if (existing && existing.length > 0) {
        defaultCategoryId = String(existing[0].id || '');
      }
    } catch (_) {}
    if (!defaultCategoryId) {
      const categories = app.findCollectionByNameOrId('categories');
      const category = new Record(categories);
      category.set('key', 'general');
      category.set('slug', 'general');
      category.set('title_fa', 'عمومی');
      category.set('title_en', 'General');
      category.set('description_fa', 'دستهبندی عمومی');
      category.set('sort_order', 0);
      category.set('is_featured', false);
      category.set('publication_status', 'published');
      category.set('published_at', new Date().toISOString());
      app.save(category);
      defaultCategoryId = String(category.id || '');
    }

    // --- 2. Topics -> Episodes ------------------------------------------------
    let topics = [];
    try {
      topics = app.findRecordsByFilter('topics', '', '', 0, 0);
    } catch (_) {}
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      if (!topic) continue;
      let changed = false;
      if (!topic.get('content_key')) {
        topic.set('content_key', 'legacy.' + String(topic.get('slug') || ''));
        changed = true;
      }
      const cv = Number(topic.get('content_version') || 0);
      if (!(cv > 0)) {
        topic.set('content_version', 1);
        changed = true;
      }
      if (!topic.get('category')) {
        topic.set('category', defaultCategoryId);
        changed = true;
      }
      if (changed) {
        try {
          app.save(topic);
        } catch (err) {
          // Abort: a record left without category/content identity/version
          // can be hidden by publication filters permanently, so a failed
          // save must surface as a failed migration, not be swallowed.
          throw new Error(
            'backfill topics: save failed for ' + String(topic.id || '') + ': ' + String(err && err.message ? err.message : err)
          );
        }
      }
    }

    // --- 3. Lessons -> Episode Variants ---------------------------------------
    let lessons = [];
    try {
      lessons = app.findRecordsByFilter('lessons', '', '', 0, 0);
    } catch (_) {}
    for (let j = 0; j < lessons.length; j++) {
      const lesson = lessons[j];
      if (!lesson) continue;
      const lv = Number(lesson.get('content_version') || 0);
      if (!(lv > 0)) {
        lesson.set('content_version', 1);
        try {
          app.save(lesson);
        } catch (err) {
          throw new Error(
            'backfill lessons: save failed for ' + String(lesson.id || '') + ': ' + String(err && err.message ? err.message : err)
          );
        }
      }
    }
  },
  (app) => {
    // Down: no destructive reversal — the backfill is intentionally
    // one-directional (documented rollback limitation of this slice).
  },
);
