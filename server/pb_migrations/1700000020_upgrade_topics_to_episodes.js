// server/pb_migrations/1700000020_upgrade_topics_to_episodes.js
// Podcast Slice 2 — Upgrade `topics` into canonical Episodes.
//
// Adds only the missing Episode-level fields. Retains the existing
// compatible fields (slug, title, description, cover_image, sort_order,
// status, published_at, archived_at) — they are not duplicated.
//
// The existing `status` select (draft/published/archived) is the single
// authoritative publication field; no `publication_status` field is added
// to `topics` (schema already has a valid status enum — reused).
//
// New fields:
//   - content_key      stable import identity (unique); backfilled with
//                      `legacy.<slug>` for existing Topics (migration 23)
//   - category         relation to categories (required for published
//                      Episodes; backfilled to the default Category)
//   - title_fa         Persian title (required for published Episodes)
//   - description_fa   Persian description (required for published Episodes)
//   - artwork_square   canonical Episode artwork (JPEG/PNG/WebP, thumbs)
//   - hero_image_wide  optional wide presentation image (thumbs)
//   - artwork_alt_fa   optional alt text
//   - episode_number   optional int (presentation ordering)
//   - is_featured      bool
//   - content_version  positive int; backfilled to 1 for existing content
//
// The legacy `cover_image` field is retained unchanged for compatibility;
// `artwork_square` is the canonical artwork field used by Product routes.

const COLLECTION = 'topics';

migrate(
  (app) => {
    const categoriesCollection = app.findCollectionByNameOrId('categories');
    const collection = app.findCollectionByNameOrId(COLLECTION);

    collection.fields.add(
      new TextField({
        name: 'content_key',
        max: 160,
      }),
    );
    collection.fields.add(
      new RelationField({
        name: 'category',
        collectionId: categoriesCollection.id,
        maxSelect: 1,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'title_fa',
        max: 200,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'description_fa',
        max: 2000,
      }),
    );
    collection.fields.add(
      new FileField({
        name: 'artwork_square',
        maxSelect: 1,
        maxSize: 5 * 1024 * 1024,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        thumbs: ['640x0'],
      }),
    );
    collection.fields.add(
      new FileField({
        name: 'hero_image_wide',
        maxSelect: 1,
        maxSize: 5 * 1024 * 1024,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        thumbs: ['1280x0'],
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'artwork_alt_fa',
        max: 500,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'episode_number',
        onlyInt: true,
        min: 0,
        max: 100000,
      }),
    );
    collection.fields.add(
      new BoolField({
        name: 'is_featured',
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

    // Unique content key (import identity); practical Library indexes.
    // `slug` already has a unique index (idx_topics_slug).
    const saved = app.findCollectionByNameOrId(COLLECTION);
    saved.addIndex('idx_topics_content_key', true, 'content_key', '');
    saved.addIndex(
      'idx_topics_category_status_published_at',
      false,
      'category, status, published_at',
      '',
    );
    app.save(saved);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId(COLLECTION);
    const toRemove = [];
    for (const field of collection.fields) {
      if (
        [
          'content_key',
          'category',
          'title_fa',
          'description_fa',
          'artwork_square',
          'hero_image_wide',
          'artwork_alt_fa',
          'episode_number',
          'is_featured',
          'content_version',
        ].includes(field.name)
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
