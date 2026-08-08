// server/pb_migrations/1700000019_create_categories.js
// Podcast Slice 2 — Create the "categories" collection (Podcast Library
// grouping).
//
// All public CRUD rules are locked (null): Students must never create or
// edit Categories, and Staff direct CRUD stays locked. Management happens
// through superuser tooling only (the future Admin Content Studio); this
// slice does not expose any direct Admin CRUD surface.
//
// Field contract:
//   - key               required, unique, max 80  (stable import identity)
//   - slug              required, unique, max 120
//   - title_fa          required, max 200
//   - title_en          optional, max 200
//   - description_fa    optional at DB level; required by the hook when the
//                       Category is published (non-empty Persian description)
//   - cover_image       optional single image (JPEG/PNG/WebP), thumbs enabled
//   - cover_alt_fa      optional, max 500
//   - sort_order        required int, 0..10000 (display order)
//   - is_featured       bool
//   - publication_status required select: draft / published / archived
//   - published_at      optional date (server-managed)
//   - archived_at       optional date (server-managed)
//
// Publication invariants (enforced in server/pb_hooks/main.pb.js):
//   Published Category requires a valid title, a valid slug, and a non-empty
//   Persian description. Draft and archived Categories are inaccessible to
//   Product routes.

const COLLECTION = 'categories';

migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: COLLECTION,
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    collection.fields.add(
      new TextField({
        name: 'key',
        required: true,
        max: 80,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'slug',
        required: true,
        presentable: true,
        max: 120,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'title_fa',
        required: true,
        presentable: true,
        max: 200,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'title_en',
        max: 200,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'description_fa',
        required: true,
        max: 1000,
      }),
    );
    collection.fields.add(
      new FileField({
        name: 'cover_image',
        maxSelect: 1,
        maxSize: 5 * 1024 * 1024,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        thumbs: ['640x0'],
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'cover_alt_fa',
        max: 500,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'sort_order',
        // NOT required: PB 0.39.9 rejects 0 on required NumberFields
        // ("cannot be blank"); the categories hook defaults it to 0.
        onlyInt: true,
        min: 0,
        max: 10000,
      }),
    );
    collection.fields.add(
      new BoolField({
        name: 'is_featured',
      }),
    );
    collection.fields.add(
      new SelectField({
        name: 'publication_status',
        required: true,
        maxSelect: 1,
        values: ['draft', 'published', 'archived'],
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'published_at',
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'archived_at',
      }),
    );

    app.save(collection);

    // Unique indexes on key and slug; practical Library ordering index.
    const saved = app.findCollectionByNameOrId(COLLECTION);
    saved.addIndex('idx_categories_key', true, 'key', '');
    saved.addIndex('idx_categories_slug', true, 'slug', '');
    saved.addIndex('idx_categories_pub_sort', false, 'publication_status, sort_order', '');
    app.save(saved);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId(COLLECTION);
      app.delete(collection);
    } catch (_) {
      // collection may not exist; ignore
    }
  },
);
