// server/pb_migrations/1700000013_create_topics.js
// P3-S1 — Create the "topics" collection. Topic grouping for lessons.
//
// Each topic groups a set of lessons. Only published topics are visible
// in the lesson list. Direct CRUD access is blocked; management happens
// through the PocketBase Dashboard (superuser only).
//
// Field contract:
//   - title          required, presentable, max 120
//   - slug           required, unique indexed, max 120
//   - description    required, max 500
//   - cover_image    optional single image file
//   - source_note    optional text, max 500
//   - source_date    optional date
//   - sort_order     required integer, default 0 (controls display order)
//   - status         required select: draft / published / archived
//   - published_at   optional date (server-managed)
//   - archived_at    optional date (server-managed)

const COLLECTION = 'topics';

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
        name: 'title',
        required: true,
        presentable: true,
        max: 120,
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
        name: 'description',
        required: true,
        max: 500,
      }),
    );
    collection.fields.add(
      new FileField({
        name: 'cover_image',
        maxSelect: 1,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'source_note',
        max: 500,
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'source_date',
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'sort_order',
        required: true,
        onlyInt: true,
      }),
    );
    collection.fields.add(
      new SelectField({
        name: 'status',
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

    // Unique index on slug.
    const saved = app.findCollectionByNameOrId(COLLECTION);
    saved.addIndex('idx_topics_slug', true, 'slug', '');
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
