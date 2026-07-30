// server/pb_migrations/1700000014_create_lessons.js
// P3-S1 — Create the "lessons" collection.
//
// One lesson per Topic + CEFR level. Audio is a protected file field.
// Direct CRUD access is blocked; management through Dashboard only.
// Custom routes /api/fast-english/lessons, /api/fast-english/lessons/:id,
// /api/fast-english/lessons/:id/audio, and /api/fast-english/public/sample
// provide the student-facing API.
//
// Premium audio is served through the custom proxy route
// /api/fast-english/lessons/:id/audio (not the built-in protected file
// mechanism) because PB 0.39 filter rules cannot express cross-collection
// back-reference queries needed to verify live subscription entitlement
// at file-request time. The viewRule on this collection still provides
// defense-in-depth for the protected FileField.
//
// Field contract:
//   - topic             required relation to topics collection
//   - level             required select: A1/A2/B1/B2/C1/C2
//   - title             required, max 200
//   - summary           required, max 500
//   - body              required (English lesson text)
//   - audio             required single protected file, allowed MIME types:
//                       audio/mpeg, audio/mp4, audio/ogg, audio/webm
//   - estimated_minutes required integer 1-120
//   - status            required select: draft / published / archived
//   - is_public_sample  bool, default false
//   - published_at      optional date (server-managed)
//   - archived_at       optional date (server-managed)

const COLLECTION = 'lessons';

migrate(
  (app) => {
    const topicsCollection = app.findCollectionByNameOrId('topics');
    const collection = new Collection({
      type: 'base',
      name: COLLECTION,
      listRule: null,
      // viewRule provides defense-in-depth for the protected FileField.
      // Premium audio is actually served through the custom proxy route
      // /api/fast-english/lessons/:id/audio which performs full entitlement
      // checking including live subscription status. PB 0.39 filter rules
      // cannot express cross-collection back-reference queries needed to
      // check subscriptions here, so the viewRule handles what it can:
      // authenticated active student with matching level, published lesson
      // under a published topic.
      // Public sample access is handled by a custom proxy route (not
      // through this viewRule) because protected files require a token
      // and the public sample must work without authentication.
      // viewRule uses a boolean filter expression (not ternary — PB 0.39
      // filter rules do not support `? :` operators).
      // When @request.context is NOT 'protectedFile', the first conjunct
      // is false and access is denied (superuser-only).
      // When @request.context IS 'protectedFile', the entitlement checks
      // run: authenticated active student with matching level, published
      // lesson under a published topic.
      viewRule:
        "@request.context = 'protectedFile' && " +
        "@request.auth.id != null && " +
        "@request.auth.role = 'student' && " +
        "@request.auth.account_status = 'active' && " +
        "@request.auth.placement_completed = true && " +
        "level = @request.auth.selected_level && " +
        "status = 'published' && " +
        "topic.status = 'published'",
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    collection.fields.add(
      new RelationField({
        name: 'topic',
        required: true,
        presentable: true,
        collectionId: topicsCollection.id,
        maxSelect: 1,
      }),
    );
    collection.fields.add(
      new SelectField({
        name: 'level',
        required: true,
        maxSelect: 1,
        values: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'title',
        required: true,
        presentable: true,
        max: 200,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'summary',
        required: true,
        max: 500,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'body',
        required: true,
        // English lesson body can be long
        max: 50000,
      }),
    );
    collection.fields.add(
      new FileField({
        name: 'audio',
        // Not required at the DB level — draft lessons may lack audio.
        // The hook enforces audio presence for published lessons.
        protected: true,
        maxSelect: 1,
        maxSize: 10 * 1024 * 1024, // 10 MB (~10 min MP3 at 128kbps)
        mimeTypes: [
          'audio/mpeg',
          'audio/mp4',
          'audio/ogg',
          'audio/webm',
        ],
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'estimated_minutes',
        required: true,
        min: 1,
        max: 120,
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
      new BoolField({
        name: 'is_public_sample',
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

    // Unique composite index on (topic, level).
    const saved = app.findCollectionByNameOrId(COLLECTION);
    saved.addIndex('idx_lessons_topic_level', true, 'topic, level', '');
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
