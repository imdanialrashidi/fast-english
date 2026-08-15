// server/pb_migrations/1700000027_business_settings_hardening.js
// Business Configuration slice — review remediation:
//   - Extend the content_operations audit vocabulary so Business Settings
//     writes (plans / payment_destination / site_settings) are recorded
//     with the same audit trail as content mutations.
//
// Note on the single-active payment_destination invariant: it is enforced
// ATOMICALLY by the staff route (runInTransaction: deactivate others +
// save target + post-check "exactly one active"). A partial unique index
// backstop was considered and deliberately NOT added: SQLite serializes
// write transactions (the post-check therefore sees committed rows), and
// the superuser/e2e fixture contract creates parallel destinations freely.
// The route-level transaction + post-check is the product boundary.

migrate(
  (app) => {
    const operations = app.findCollectionByNameOrId('content_operations');
    const contentTypeField = operations.fields.getByName('content_type');
    if (contentTypeField) {
      contentTypeField.values = ['category', 'episode', 'variant', 'vocabulary', 'plan', 'payment_destination', 'site_settings'];
    }
    const operationField = operations.fields.getByName('operation');
    if (operationField) {
      operationField.values = ['create', 'update', 'publish', 'archive', 'media_replace'];
    }
    app.save(operations);
  },
  (app) => {
    try {
      const operations = app.findCollectionByNameOrId('content_operations');
      const contentTypeField = operations.fields.getByName('content_type');
      if (contentTypeField) {
        contentTypeField.values = ['category', 'episode', 'variant', 'vocabulary'];
      }
      const operationField = operations.fields.getByName('operation');
      if (operationField) {
        operationField.values = ['create', 'publish', 'archive', 'media_replace'];
      }
      app.save(operations);
    } catch (_) {
      // may not exist; ignore
    }
  },
);
