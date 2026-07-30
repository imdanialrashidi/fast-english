// server/pb_migrations/1700000015_create_lesson_progress.js
// P3-S2 — Create the "lesson_progress" collection.
//
// One record per unique (user, lesson) pair. All CRUD access is blocked
// at the collection level; all mutations occur through custom routes at
// /api/fast-english/lessons/{lessonId}/progress.
//
// Field contract:
//   - user              required relation to fep_users
//   - lesson            required relation to lessons
//   - position_seconds  required number, current playhead position
//   - furthest_seconds  required number, maximum position reached
//   - duration_seconds  required number, lesson audio duration
//   - completed         required bool, monotonic, server-calculated
//   - completed_at      optional date, server-set when completed flips
//   - last_played_at    required date, server-updated on every save
//   - revision          required number, incremented on every save (optimistic concurrency)

const COLLECTION = 'lesson_progress';

migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('fep_users');
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
        name: 'user',
        required: true,
        collectionId: usersCollection.id,
        maxSelect: 1,
        // cascade delete so removing a user cleans up progress
        cascadeDelete: true,
      }),
    );
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
      new NumberField({
        name: 'position_seconds',
        required: true,
        min: 0,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'furthest_seconds',
        required: true,
        min: 0,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'duration_seconds',
        required: true,
        min: 1,
      }),
    );
    collection.fields.add(
      new BoolField({
        name: 'completed',
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'completed_at',
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'last_played_at',
        required: true,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'revision',
        required: true,
        onlyInt: true,
        min: 0,
      }),
    );

    app.save(collection);

    // Unique index on (user, lesson) — one progress record per student per lesson.
    const saved = app.findCollectionByNameOrId(COLLECTION);
    saved.addIndex('idx_lesson_progress_user_lesson', true, 'user, lesson', '');
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
