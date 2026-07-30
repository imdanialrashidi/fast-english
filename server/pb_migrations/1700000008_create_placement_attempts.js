// server/pb_migrations/1700000008_create_placement_attempts.js
// P2-S1 — Placement attempt tracking.
//
// Each eligible student gets exactly one attempt (one-per-user invariant
// enforced at the DB level via a unique index on the `user` relation).
//
// Access rules (locked):
//   - listRule/viewRule = null (no direct reads)
//   - createRule/updateRule/deleteRule = null
// Students interact only through the custom placement routes, which
// sanitize responses and never expose correct answers or grading data.

migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'placement_attempts',
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
        unique: true,
        collectionId: app.findCollectionByNameOrId('fep_users').id,
        maxSelect: 1,
      }),
    );
    collection.fields.add(
      new SelectField({
        name: 'status',
        required: true,
        maxSelect: 1,
        values: ['in_progress', 'submitted'],
      }),
    );
    collection.fields.add(
      new JSONField({
        name: 'question_snapshot',
        required: true,
      }),
    );
    collection.fields.add(
      new JSONField({
        name: 'answers',
        required: false,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'revision',
        required: true,
        min: 0,
        onlyInt: true,
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'started_at',
        required: true,
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'last_saved_at',
        required: false,
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'submitted_at',
        required: false,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'score',
        required: false,
        min: 0,
        max: 20,
        onlyInt: true,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'max_score',
        required: false,
        min: 0,
        max: 20,
        onlyInt: true,
      }),
    );

    app.save(collection);

    // The unique user index enforces one-attempt-per-student.
    const saved = app.findCollectionByNameOrId('placement_attempts');
    saved.addIndex('idx_placement_attempts_unique_user', true, 'user', '');
    app.save(saved);
  },
  (app) => {
    try {
      const coll = app.findCollectionByNameOrId('placement_attempts');
      app.delete(coll);
    } catch (_) {
      // may not exist
    }
  },
);
