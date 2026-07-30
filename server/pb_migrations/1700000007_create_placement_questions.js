// server/pb_migrations/1700000007_create_placement_questions.js
// P2-S1 — Versioned placement question bank.
//
// Each row is one version of one logical question. Question content is
// immutable after creation — only `is_active` may be toggled.
//
// Access rules (locked):
//   - listRule/viewRule = null (no direct reads)
//   - createRule/updateRule/deleteRule = null
// Students interact only through the custom placement routes, which
// never expose correct_answer or grading data.

migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'placement_questions',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    collection.fields.add(
      new TextField({
        name: 'question_key',
        required: true,
        max: 120,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'version',
        required: true,
        min: 1,
        onlyInt: true,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'position',
        required: true,
        min: 1,
        max: 20,
        onlyInt: true,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'prompt',
        required: true,
        max: 500,
      }),
    );
    collection.fields.add(
      new JSONField({
        name: 'options',
        required: true,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'correct_option_id',
        required: true,
        max: 20,
      }),
    );
    collection.fields.add(
      new BoolField({
        name: 'is_active',
        required: false,
      }),
    );

    app.save(collection);

    // Unique composite index on (question_key, version)
    const saved = app.findCollectionByNameOrId('placement_questions');
    saved.addIndex('idx_placement_questions_key_version', true, 'question_key, version', '');
    // Unique index on position for active questions only
    saved.addIndex('idx_placement_questions_active_position', true, 'position', 'is_active = true');
    app.save(saved);
  },
  (app) => {
    try {
      const coll = app.findCollectionByNameOrId('placement_questions');
      app.delete(coll);
    } catch (_) {
      // may not exist
    }
  },
);
