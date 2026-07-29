// server/pb_migrations/1700000003_create_payment_destination.js
// P1-S1 — Create the "payment_destination" singleton collection.
//
// This collection holds the active card-to-card payment destination that
// the App displays to a student. It is singleton-style: at most one active
// record at a time. The student API returns only the active row, and only
// the safe public fields.
//
// No CVV2, expiry, PIN, password, or private bank credential is stored.
// No real card data is committed in this migration; smoke fixtures live
// in the disposable data dir and are deleted with it on exit.

const COLLECTION = 'payment_destination';

migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: COLLECTION,
      // Read returns the active row only. The custom route further trims
      // the response to the safe fields, but this rule is the canonical
      // contract: an inactive record is never visible to a student.
      listRule: 'is_active = true',
      viewRule: 'is_active = true',
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    collection.fields.add(
      new TextField({
        name: 'card_number',
        required: true,
        presentable: true,
        min: 12,
        max: 32,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'card_holder_name',
        required: true,
        presentable: true,
        min: 1,
        max: 120,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'bank_name',
        required: true,
        presentable: true,
        min: 1,
        max: 120,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'instructions',
        presentable: true,
        max: 1000,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'support_contact',
        presentable: true,
        max: 200,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'review_sla_text',
        presentable: true,
        max: 200,
      }),
    );
    collection.fields.add(
      new BoolField({
        name: 'is_active',
        // NOT required: PocketBase 0.39's BoolField validation treats
        // `false` as the zero value and rejects it for required fields,
        // which makes the operator unable to deactivate a destination
        // via the dashboard PATCH endpoint. We default the field to
        // true in the onRecordCreate hook in server/pb_hooks/main.pb.js.
      }),
    );

    app.save(collection);
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
