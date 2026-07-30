// server/pb_migrations/1700000011_add_level_fields_to_placement_attempts.js
// P2-S2 — Add suggested_level and selected_level Select fields to
// placement_attempts so the Placement-specific decision is stored
// separately from the mutable User preference.
//
// The User collection already has these fields (from P0-S3 migration
// 1700000000_create_users.js). We now add matching fields to the
// Attempt record so the original server calculation and the latest
// Student choice are preserved at the Attempt level.
//
// Allowed values: A1, A2, B1, B2, C1, C2 (the same as fep_users).

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('placement_attempts');

    if (!collection.fields.getByName('suggested_level')) {
      collection.fields.add(
        new SelectField({
          name: 'suggested_level',
          required: false,
          maxSelect: 1,
          values: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
        }),
      );
    }

    if (!collection.fields.getByName('selected_level')) {
      collection.fields.add(
        new SelectField({
          name: 'selected_level',
          required: false,
          maxSelect: 1,
          values: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
        }),
      );
    }

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('placement_attempts');
      const f1 = collection.fields.getByName('suggested_level');
      if (f1) collection.fields.removeById(f1.id);
      const f2 = collection.fields.getByName('selected_level');
      if (f2) collection.fields.removeById(f2.id);
      app.save(collection);
    } catch (_) {}
  },
);
