// server/pb_migrations/1700000002_create_plans.js
// P1-S1 — Create the "plans" collection. Student-visible subscription plans.
//
// The collection is a normal (non-auth) PocketBase collection. The student
// client may only read active plans. Create/update/delete are locked.
//
// Field contract:
//   - name           required, presentable, trimmed (max 80)
//   - slug           required, presentable, unique indexed (max 64)
//   - duration_days  required positive integer
//   - price_toman    required non-negative integer
//   - is_active      required boolean (filters inactive plans from the
//                    student API and prevents them from being submitted)
//   - display_order  integer, controls the visible order
//   - description    optional bounded text
//
// Production prices are not committed; the smoke test creates clearly
// test-only disposable rows directly in the DB and deletes them with the
// disposable data dir on exit.

const COLLECTION = 'plans';

migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: COLLECTION,
      // Public read for active plans keeps the marketing copy simple and
      // matches the explicit rule we use in the API. Direct create/update/
      // delete are blocked (null rules). The custom route filters by
      // is_active=true so inactive plans are not exposed to students.
      listRule: 'is_active = true',
      viewRule: 'is_active = true',
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    collection.fields.add(
      new TextField({
        name: 'name',
        required: true,
        presentable: true,
        min: 1,
        max: 80,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'slug',
        required: true,
        presentable: true,
        max: 64,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'duration_days',
        required: true,
        min: 1,
        onlyInt: true,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'price_toman',
        required: true,
        min: 0,
        onlyInt: true,
      }),
    );
    collection.fields.add(
      new BoolField({
        name: 'is_active',
        // NOT required: PocketBase 0.39's BoolField validation treats
        // `false` as the zero value and rejects it for required fields,
        // which makes the operator unable to deactivate a plan via the
        // dashboard PATCH endpoint. We default the field to true in the
        // onRecordCreate hook in server/pb_hooks/main.pb.js, so omitting
        // the field still produces a usable active plan.
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'display_order',
        onlyInt: true,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'description',
        max: 500,
      }),
    );

    app.save(collection);

    // Unique index on slug so plan identities cannot collide.
    const saved = app.findCollectionByNameOrId(COLLECTION);
    saved.addIndex('idx_plans_slug', true, 'slug', '');
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
