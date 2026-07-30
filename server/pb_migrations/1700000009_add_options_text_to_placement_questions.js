// server/pb_migrations/1700000009_add_options_text_to_placement_questions.js
// P2-S1 — Add a TextField alternative for options (JSONField is unreliable
// in PB 0.39 JSVM). This field stores a JSON string directly.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('placement_questions');
    collection.fields.add(
      new TextField({
        name: 'options_text',
        required: true,
        max: 2000,
      }),
    );
    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('placement_questions');
      const field = collection.fields.getByName('options_text');
      if (field) collection.fields.removeById(field.id);
      app.save(collection);
    } catch (_) {}
  },
);
