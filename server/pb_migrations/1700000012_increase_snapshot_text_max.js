// server/pb_migrations/1700000012_increase_snapshot_text_max.js
// Phase 2 Closure — Increase question_snapshot_text max to accommodate
// the worst-case accepted question model:
//
//   20 questions × (500-char prompt + 2000-char options + 200-char metadata)
//   ≈ 54 000 chars. With 30 % margin → 70 000.
//
// The original limit of 20 000 was too small for the accepted schema
// (prompt max 500, options_text max 2000 per question, 20 questions).

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('placement_attempts');
    const field = collection.fields.getByName('question_snapshot_text');
    if (field) {
      field.max = 70000;
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('placement_attempts');
      const field = collection.fields.getByName('question_snapshot_text');
      if (field) {
        field.max = 20000;
        app.save(collection);
      }
    } catch (_) {}
  },
);
