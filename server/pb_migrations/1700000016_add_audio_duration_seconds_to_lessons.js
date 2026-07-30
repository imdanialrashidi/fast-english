// server/pb_migrations/1700000016_add_audio_duration_seconds_to_lessons.js
// P3-S2 Closure — Add server-authoritative audio_duration_seconds to lessons.
//
// This field is the authoritative duration denominator used by Progress
// routes. The Client must not supply duration — the server loads it from
// the published Lesson. Draft lessons may omit it; published lessons
// require a positive, bounded value.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('lessons');

    collection.fields.add(
      new NumberField({
        name: 'audio_duration_seconds',
        required: false,
        min: 0,
        max: 86400, // 24 hours max
      }),
    );

    app.save(collection);
  },
  (app) => {
    // Down: remove the field (PB handles field removal via save)
    const collection = app.findCollectionByNameOrId('lessons');
    const fields = collection.fields;
    const toRemove = [];
    for (const field of fields) {
      if (field.name === 'audio_duration_seconds') {
        toRemove.push(field);
      }
    }
    for (const f of toRemove) {
      collection.fields.remove(f);
    }
    app.save(collection);
  },
);
