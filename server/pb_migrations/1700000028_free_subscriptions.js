// server/pb_migrations/1700000028_free_subscriptions.js
// Business Configuration slice — free-plan entitlements.
//
// `price_toman = 0` is the canonical signal that a plan is FREE (owner
// sets it from Admin Business Settings). A free plan must produce an
// entitlement WITHOUT a payment request, receipt or staff approval, so
// the `subscriptions` collection gains a free-activation shape:
//
//   1. `payment_request` becomes optional — free subscriptions have no
//      request (paid subscriptions keep the unique relation, the P1-S2
//      idempotency backstop).
//   2. `approved_by` becomes optional — free activation is not an
//      operator decision (paid approvals keep the staff relation).
//   3. `amount_snapshot` becomes non-required — PocketBase 0.39's
//      required NumberField rejects `0` as the zero value
//      ("validation_required: Cannot be blank."), and a free
//      subscription's canonical snapshot IS 0 toman.
//   4. `approved_at` becomes optional — the field is only meaningful
//      for paid approvals (same rationale as `approved_by`).
//   5. `source` (select paid|free, default paid) — the audit/discriminator
//      field; existing paid rows backfill to `paid`.
//   6. Partial unique index `idx_subscriptions_one_free_per_user` on
//      (user) WHERE source='free' — the DB-level idempotency backstop:
//      repeated/concurrent free activations can never produce a second
//      free subscription row for the same user.
//
// The entitlement rule itself is unchanged: the most recent active,
// unexpired subscription (paid OR free) grants access, and the free
// route returns the existing valid entitlement instead of manufacturing
// a duplicate one.
//
// Also extends the `content_operations` audit vocabulary with the
// `subscription` content type so free activations are auditable through
// the same trail as commercial-setting changes.

migrate(
  (app) => {
    const subs = app.findCollectionByNameOrId('subscriptions');

    const paymentRequestField = subs.fields.getByName('payment_request');
    if (paymentRequestField) {
      paymentRequestField.required = false;
      // Field-level `unique` must go too: PB validates unique fields
      // against existing rows and treats the empty relation as a value,
      // so a SECOND free subscription (empty payment_request) would be
      // rejected. Paid uniqueness is preserved by the PARTIAL index
      // below (only rows WITH a payment_request are constrained).
      paymentRequestField.unique = false;
    }
    const approvedByField = subs.fields.getByName('approved_by');
    if (approvedByField) {
      approvedByField.required = false;
    }
    const amountSnapshotField = subs.fields.getByName('amount_snapshot');
    if (amountSnapshotField) {
      amountSnapshotField.required = false;
    }
    const approvedAtField = subs.fields.getByName('approved_at');
    if (approvedAtField) {
      approvedAtField.required = false;
    }
    subs.fields.add(
      new SelectField({
        name: 'source',
        required: true,
        values: ['paid', 'free'],
        maxSelect: 1,
        default: 'paid',
      }),
    );
    app.save(subs);

    const saved = app.findCollectionByNameOrId('subscriptions');
    // Rebuild the paid idempotency index as PARTIAL: only rows that
    // actually carry a payment_request (paid subscriptions) are
    // constrained, so free rows (empty relation) never collide.
    saved.indexes = (saved.indexes || []).filter(
      (i) => i.name !== 'idx_subscriptions_unique_payment_request',
    );
    saved.addIndex(
      'idx_subscriptions_unique_payment_request',
      true,
      'payment_request',
      "payment_request != ''",
    );
    saved.addIndex(
      'idx_subscriptions_one_free_per_user',
      true,
      'user',
      "source = 'free'",
    );
    app.save(saved);

    // Audit vocabulary: subscription events join the operations trail.
    const operations = app.findCollectionByNameOrId('content_operations');
    const contentTypeField = operations.fields.getByName('content_type');
    if (contentTypeField) {
      contentTypeField.values = ['category', 'episode', 'variant', 'vocabulary', 'plan', 'payment_destination', 'site_settings', 'subscription'];
    }
    app.save(operations);
  },
  (app) => {
    try {
      const subs = app.findCollectionByNameOrId('subscriptions');
      const indexField = subs.indexes.find((i) => i.name === 'idx_subscriptions_one_free_per_user');
      if (indexField) {
        subs.indexes = subs.indexes.filter((i) => i.name !== 'idx_subscriptions_one_free_per_user');
        app.save(subs);
      }
    } catch (_) {
      // may not exist; ignore
    }
    try {
      const subs = app.findCollectionByNameOrId('subscriptions');
      const sourceField = subs.fields.getByName('source');
      if (sourceField) subs.fields.remove(sourceField);
      const paymentRequestField = subs.fields.getByName('payment_request');
      if (paymentRequestField) {
        paymentRequestField.required = true;
        paymentRequestField.unique = true;
      }
      const approvedByField = subs.fields.getByName('approved_by');
      if (approvedByField) approvedByField.required = true;
      const amountSnapshotField = subs.fields.getByName('amount_snapshot');
      if (amountSnapshotField) amountSnapshotField.required = true;
      const approvedAtField = subs.fields.getByName('approved_at');
      if (approvedAtField) approvedAtField.required = true;
      app.save(subs);
    } catch (_) {
      // may not exist; ignore
    }
    try {
      const operations = app.findCollectionByNameOrId('content_operations');
      const contentTypeField = operations.fields.getByName('content_type');
      if (contentTypeField) {
        contentTypeField.values = ['category', 'episode', 'variant', 'vocabulary', 'plan', 'payment_destination', 'site_settings'];
      }
      app.save(operations);
    } catch (_) {
      // may not exist; ignore
    }
  },
);
