// server/pb_migrations/1700000018_relink_staff_reviewers.js
// Podcast Slice 1 — point the review-audit relations at `staff_admins`.
//
// The legacy operator workflow recorded the reviewer identity in
// `payment_requests.reviewed_by` and `subscriptions.approved_by` as
// relations to `fep_users`. With the independent Staff Auth Collection,
// new approvals are performed by `staff_admins` records, so the relation
// targets must move. This is an additive, contract-preserving change:
//   - existing legacy rows keep their historical (now dangling)
//     reviewer ids — they remain readable and are not rewritten;
//   - the staff detail route already degrades gracefully when a
//     reviewer record cannot be resolved;
//   - old operator records are deliberately NOT migrated (the legacy
//     transition rule: manually re-enrolled once into staff_admins).

migrate(
  (app) => {
    const staffCollection = app.findCollectionByNameOrId('staff_admins');

    // PB 0.39 forbids changing a relation field's collectionId in place,
    // so the field is removed and re-added with the same name. Re-adding
    // creates a new field id: legacy rows keep their historical reviewer
    // ids as readable (dangling) values and are never rewritten.
    // PB 0.39 forbids changing a relation field's collectionId in place.
    // The field must be REMOVED and persisted first, then re-added with
    // the new target as a separate save. Re-adding creates a new field
    // id: legacy rows keep their historical reviewer ids as readable
    // (dangling) values and are never rewritten.
    const paymentRequests = app.findCollectionByNameOrId('payment_requests');
    const reviewedBy = paymentRequests.fields.getByName('reviewed_by');
    if (reviewedBy && reviewedBy.collectionId !== staffCollection.id) {
      paymentRequests.fields.removeByName('reviewed_by');
      app.save(paymentRequests);
    }
    const paymentRequests2 = app.findCollectionByNameOrId('payment_requests');
    if (!paymentRequests2.fields.getByName('reviewed_by')) {
      paymentRequests2.fields.add(
        new RelationField({
          name: 'reviewed_by',
          collectionId: staffCollection.id,
          maxSelect: 1,
        }),
      );
      app.save(paymentRequests2);
    }

    const subscriptions = app.findCollectionByNameOrId('subscriptions');
    const approvedBy = subscriptions.fields.getByName('approved_by');
    if (approvedBy && approvedBy.collectionId !== staffCollection.id) {
      subscriptions.fields.removeByName('approved_by');
      app.save(subscriptions);
    }
    const subscriptions2 = app.findCollectionByNameOrId('subscriptions');
    if (!subscriptions2.fields.getByName('approved_by')) {
      subscriptions2.fields.add(
        new RelationField({
          name: 'approved_by',
          required: true,
          presentable: true,
          collectionId: staffCollection.id,
          maxSelect: 1,
        }),
      );
      app.save(subscriptions2);
    }
  },
  (app) => {
    // Down: restore the legacy fep_users targets (safe only before any
    // staff-authored audit rows exist; documented in docs/PLAN.md).
    const usersCollection = app.findCollectionByNameOrId('fep_users');

    const paymentRequests = app.findCollectionByNameOrId('payment_requests');
    const reviewedBy = paymentRequests.fields.getByName('reviewed_by');
    if (reviewedBy && reviewedBy.collectionId !== usersCollection.id) {
      paymentRequests.fields.removeByName('reviewed_by');
      app.save(paymentRequests);
    }
    const paymentRequests2 = app.findCollectionByNameOrId('payment_requests');
    if (!paymentRequests2.fields.getByName('reviewed_by')) {
      paymentRequests2.fields.add(
        new RelationField({
          name: 'reviewed_by',
          collectionId: usersCollection.id,
          maxSelect: 1,
        }),
      );
      app.save(paymentRequests2);
    }

    const subscriptions = app.findCollectionByNameOrId('subscriptions');
    const approvedBy = subscriptions.fields.getByName('approved_by');
    if (approvedBy && approvedBy.collectionId !== usersCollection.id) {
      subscriptions.fields.removeByName('approved_by');
      app.save(subscriptions);
    }
    const subscriptions2 = app.findCollectionByNameOrId('subscriptions');
    if (!subscriptions2.fields.getByName('approved_by')) {
      subscriptions2.fields.add(
        new RelationField({
          name: 'approved_by',
          required: true,
          presentable: true,
          collectionId: usersCollection.id,
          maxSelect: 1,
        }),
      );
      app.save(subscriptions2);
    }
  },
);
