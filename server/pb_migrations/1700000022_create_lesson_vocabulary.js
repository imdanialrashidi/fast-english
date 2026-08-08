// server/pb_migrations/1700000022_create_lesson_vocabulary.js
// Podcast Slice 2 — Create the "lesson_vocabulary" collection.
//
// Key vocabulary for each Episode Variant (lesson). All CRUD access is
// blocked at the collection level; vocabulary is read/written only through
// server-owned tooling (the future JSON Content Pipeline) and Product
// routes. No public read/write surface is opened in this slice.
//
// Field contract:
//   - lesson              required relation to lessons (cascade delete)
//   - term                required, bounded (display term, original case)
//   - normalized_term     required, deterministic normalization of term
//   - phonetic            optional, bounded
//   - part_of_speech      optional, bounded text
//   - meaning_fa          required, bounded
//   - definition_en       required, bounded
//   - example_sentence    optional, bounded
//   - pronunciation_audio optional protected file (MP3 / M4A, bounded)
//   - sort_order          required int, 0..10000
//
// Unique index: (lesson, normalized_term) — one entry per term per Variant.
// Practical index: (lesson, sort_order) for the future Vocabulary UI.

const COLLECTION = 'lesson_vocabulary';

migrate(
  (app) => {
    const lessonsCollection = app.findCollectionByNameOrId('lessons');
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
      new RelationField({
        name: 'lesson',
        required: true,
        collectionId: lessonsCollection.id,
        maxSelect: 1,
        cascadeDelete: true,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'term',
        required: true,
        max: 200,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'normalized_term',
        required: true,
        max: 200,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'phonetic',
        max: 200,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'part_of_speech',
        max: 50,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'meaning_fa',
        required: true,
        max: 500,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'definition_en',
        required: true,
        max: 500,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'example_sentence',
        max: 1000,
      }),
    );
    collection.fields.add(
      new FileField({
        name: 'pronunciation_audio',
        protected: true,
        maxSelect: 1,
        maxSize: 2 * 1024 * 1024,
        mimeTypes: ['audio/mpeg', 'audio/mp4'],
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'sort_order',
        // NOT required: PB 0.39.9 rejects 0 on required NumberFields
        // ("cannot be blank"); writers must set it explicitly (the JSON
        // Content Pipeline will).
        onlyInt: true,
        min: 0,
        max: 10000,
      }),
    );

    app.save(collection);

    const saved = app.findCollectionByNameOrId(COLLECTION);
    saved.addIndex('idx_lesson_vocabulary_lesson_term', true, 'lesson, normalized_term', '');
    saved.addIndex('idx_lesson_vocabulary_lesson_sort', false, 'lesson, sort_order', '');
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
