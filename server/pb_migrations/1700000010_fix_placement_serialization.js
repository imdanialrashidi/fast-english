// server/pb_migrations/1700000010_fix_placement_serialization.js
// P2-S1 — Add TextField alternatives for question_snapshot and answers.
//
// PocketBase 0.39 JSVM's JSONField wrapper types (JSONArray/JSONMap)
// do not reliably behave as plain JS arrays/objects when read via
// record.get(). This migration adds Text-based fields that store
// canonical JSON strings, which round-trip correctly.
//
// Legacy JSON fields (question_snapshot, answers) remain on the
// collection for backward compatibility but are made non-required
// so the new canonical Text fields can be used without setting the
// legacy fields.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('placement_attempts');

    // Make legacy question_snapshot not required (we use question_snapshot_text)
    var f = collection.fields.getByName('question_snapshot');
    if (f && f.required) {
      f.required = false;
    }

    // Make legacy answers not required (we use answers_text)
    f = collection.fields.getByName('answers');
    if (f && f.required) {
      f.required = false;
    }

    // Add question_snapshot_text — stores canonical JSON string of the
    // frozen 20-question snapshot.
    if (!collection.fields.getByName('question_snapshot_text')) {
      collection.fields.add(
        new TextField({
          name: 'question_snapshot_text',
          required: false,
          max: 20000,
        }),
      );
    }

    // Add answers_text — stores canonical JSON string of the answer map.
    if (!collection.fields.getByName('answers_text')) {
      collection.fields.add(
        new TextField({
          name: 'answers_text',
          required: false,
          max: 5000,
        }),
      );
    }

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('placement_attempts');
      const f1 = collection.fields.getByName('question_snapshot_text');
      if (f1) collection.fields.removeById(f1.id);
      const f2 = collection.fields.getByName('answers_text');
      if (f2) collection.fields.removeById(f2.id);
      app.save(collection);
    } catch (_) {}
  },
);
