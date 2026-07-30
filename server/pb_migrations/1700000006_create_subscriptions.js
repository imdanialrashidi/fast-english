// server/pb_migrations/1700000006_create_subscriptions.js
// P1-S2 — Create the "subscriptions" collection.
//
// Each Subscription is an immutable grant created from exactly one
// approved Payment Request. The unique payment_request relation is
// the primary idempotency defence: at most one Subscription may exist
// per approved Request.
//
// A "renewal" is represented as a later Subscription whose starts_at
// begins at the max of approval time and the latest unexpired
// Subscription's expires_at.
//
// Access rules:
//   - listRule/viewRule = null (no direct reads; only through the
//     custom operator routes and a future student-summary route)
//   - createRule/updateRule/deleteRule = null (all writes go through
//     the atomic approval transaction)
//
// NOTE: The `subscription` field on payment_requests remains a text
// field (created in 1700000004). PB 0.39 doesn't support changing a
// field type in-place. The operator approve route writes the
// Subscription ID as a text reference into payment_requests.subscription.
// The canonical relational integrity is maintained by the unique
// `payment_request` relation on the subscriptions collection.

const COLLECTION = 'subscriptions';

migrate(
  (app) => {
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
        presentable: true,
        collectionId: app.findCollectionByNameOrId('fep_users').id,
        maxSelect: 1,
      }),
    );
    collection.fields.add(
      new RelationField({
        name: 'payment_request',
        required: true,
        unique: true,
        presentable: true,
        collectionId: app.findCollectionByNameOrId('payment_requests').id,
        maxSelect: 1,
      }),
    );
    collection.fields.add(
      new RelationField({
        name: 'plan',
        presentable: true,
        collectionId: app.findCollectionByNameOrId('plans').id,
        maxSelect: 1,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'plan_name_snapshot',
        required: true,
        presentable: true,
        max: 120,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'amount_snapshot',
        required: true,
        min: 0,
        onlyInt: true,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'duration_days_snapshot',
        required: true,
        min: 1,
        onlyInt: true,
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'starts_at',
        required: true,
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'expires_at',
        required: true,
      }),
    );
    collection.fields.add(
      new SelectField({
        name: 'status',
        required: true,
        presentable: true,
        maxSelect: 1,
        values: ['active', 'expired', 'cancelled'],
      }),
    );
    collection.fields.add(
      new RelationField({
        name: 'approved_by',
        required: true,
        presentable: true,
        collectionId: app.findCollectionByNameOrId('fep_users').id,
        maxSelect: 1,
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'approved_at',
        required: true,
      }),
    );

    app.save(collection);

    // Partial unique index on payment_request (already covered by the
    // unique field attribute, but an explicit index name aids debugging).
    const saved = app.findCollectionByNameOrId(COLLECTION);
    saved.addIndex(
      'idx_subscriptions_unique_payment_request',
      true,
      'payment_request',
      '',
    );
    app.save(saved);
  },
  (app) => {
    try {
      const coll = app.findCollectionByNameOrId(COLLECTION);
      app.delete(coll);
    } catch (_) {
      // may not exist
    }
  },
);
