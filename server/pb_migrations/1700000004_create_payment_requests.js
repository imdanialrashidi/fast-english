// server/pb_migrations/1700000004_create_payment_requests.js
// P1-S1 — Create the "payment_requests" collection.
//
// Each record represents a student's single attempt to pay for a plan.
// The slice enforces:
//   - At most one PENDING record per user (partial unique index on user
//     WHERE status='pending' — the final concurrency defense).
//   - Plan snapshots (name/price/duration) are written by Backend and are
//     never trusted from the Client. The viewRule exposes only the
//     sanitized owner view to the request owner. P1-S2 may extend view
//     for authorized operators.
//   - receipt_file is a single protected file field. Direct public access
//     is impossible: protected files require a short-lived token issued
//     to the record owner (or, later, to authorized operators).
//   - Direct create/update/delete are blocked at the collection level so
//     the only safe path is the custom route. The route's pending
//     pre-check is a UX defense; the unique index is the database
//     invariant.

const COLLECTION = 'payment_requests';

migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: COLLECTION,
      // Direct list is locked. The custom /current route is the only
      // surface a normal student uses.
      listRule: null,
      // Direct view is locked to superusers only. The custom /current
      // route reads the owner record and returns a sanitized payload.
      // For protected file downloads, the owner (and P1-S2 operators)
      // get a short-lived token via the standard PB files API after
      // the route authorizes the record.
      viewRule: null,
      // Direct create is locked: must go through POST
      // /api/fast-english/payment-requests.
      createRule: null,
      // No direct update/delete by students. P1-S2 will relax this for
      // operator review via a dedicated custom route, never via the
      // record CRUD endpoint.
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
        name: 'plan',
        required: true,
        presentable: true,
        collectionId: app.findCollectionByNameOrId('plans').id,
        maxSelect: 1,
      }),
    );
    // Plan snapshots. Always written by Backend on creation and never
    // accepted from Client input.
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
    // Single protected file. Max 5 MB. Allowed MIME types enforced
    // at the field level. Real signature validation lives in the
    // custom route (PB only checks declared Content-Type here).
    collection.fields.add(
      new FileField({
        name: 'receipt_file',
        required: true,
        presentable: true,
        protected: true,
        maxSelect: 1,
        maxSize: 5 * 1024 * 1024,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'bank_reference',
        presentable: true,
        max: 80,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'sender_card_last4',
        presentable: true,
        max: 4,
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'transfer_at',
        presentable: true,
      }),
    );
    collection.fields.add(
      new SelectField({
        name: 'status',
        required: true,
        presentable: true,
        maxSelect: 1,
        values: ['pending', 'approved', 'rejected', 'cancelled'],
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'public_rejection_reason',
        presentable: true,
        max: 500,
      }),
    );
    // Internal-only. Never returned in /current.
    collection.fields.add(
      new TextField({
        name: 'internal_note',
        max: 1000,
      }),
    );
    collection.fields.add(
      new RelationField({
        name: 'reviewed_by',
        collectionId: app.findCollectionByNameOrId('fep_users').id,
        maxSelect: 1,
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'reviewed_at',
      }),
    );
    // Reserved for P1-S2 — operator approval links the subscription.
    // Stored as a plain text id to keep this slice independent of the
    // subscriptions collection, which P1-S2 will add. The field is
    // hidden from the student view and never read by P1-S1 routes.
    collection.fields.add(
      new TextField({
        name: 'subscription',
        max: 32,
      }),
    );

    app.save(collection);

    // The partial unique index that enforces "at most one pending
    // request per user" at the database level. It only applies while
    // the row is PENDING: approved/rejected/cancelled rows do not
    // collide, so resubmission after rejection creates a new record.
    //
    // SQLite supports partial indexes via the WHERE clause on
    // CREATE UNIQUE INDEX. PocketBase's Collection.addIndex uses
    // the WHERE expression as-is in the generated SQL, so this
    // is the canonical partial-unique-index pattern.
    const saved = app.findCollectionByNameOrId(COLLECTION);
    saved.addIndex(
      'idx_payment_requests_one_pending_per_user',
      true,
      'user',
      "status = 'pending'",
    );
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
