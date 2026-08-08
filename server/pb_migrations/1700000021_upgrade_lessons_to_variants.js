// server/pb_migrations/1700000021_upgrade_lessons_to_variants.js
// Podcast Slice 2 — Upgrade `lessons` into level-specific Episode Variants.
//
// Adds only the missing Variant-level fields. Reuses the existing fields:
// topic (relation), level, title, summary, body (the Variant transcript),
// audio, audio_duration_seconds, estimated_minutes, status (existing
// draft/published/archived enum — the single authoritative publication
// field; no `publication_status` is added), is_public_sample, published_at,
// archived_at.
//
// The canonical Variant identity remains `topic + level` (existing unique
// index idx_lessons_topic_level is preserved).
//
// New fields:
//   - summary_fa          Persian summary (required for published Variants)
//   - thumbnail_override  optional per-Variant artwork override
//   - thumbnail_alt_fa    optional alt text for the override
//   - content_version     positive int; backfilled to 1 for existing content

const COLLECTION = 'lessons';

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId(COLLECTION);

    collection.fields.add(
      new TextField({
        name: 'summary_fa',
        max: 500,
      }),
    );
    collection.fields.add(
      new FileField({
        name: 'thumbnail_override',
        maxSelect: 1,
        maxSize: 5 * 1024 * 1024,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        thumbs: ['640x0'],
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'thumbnail_alt_fa',
        max: 500,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'content_version',
        onlyInt: true,
        min: 1,
        max: 100000,
      }),
    );

    app.save(collection);

    // Practical Library index (publication_state, publish recency).
    const saved = app.findCollectionByNameOrId(COLLECTION);
    saved.addIndex('idx_lessons_status_published_at', false, 'status, published_at', '');
    app.save(saved);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId(COLLECTION);
    const toRemove = [];
    for (const field of collection.fields) {
      if (
        ['summary_fa', 'thumbnail_override', 'thumbnail_alt_fa', 'content_version'].includes(
          field.name,
        )
      ) {
        toRemove.push(field);
      }
    }
    for (const f of toRemove) {
      collection.fields.remove(f);
    }
    app.save(collection);
  },
);
