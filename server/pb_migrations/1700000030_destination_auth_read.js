// server/pb_migrations/1700000030_destination_auth_read.js
// Business Configuration slice — lock the payment_destination read surface
// to authenticated identities.
//
// The card-to-card destination row carries the FULL pay-to card number
// (PAN plus holder/bank/instructions). The previous rules exposed the
// active row to ANY anonymous visitor through the standard collection
// API (`listRule = viewRule = "is_active = true"` with no auth guard):
// the Student App is the only legitimate consumer, and it always reads
// through an authenticated `fep_users` session. Anonymous harvesting of
// the PAN is not part of any accepted public contract — the public
// settings endpoint deliberately exposes only the boolean
// `payment.cardTransferEnabled`, never card details.
//
// This migration tightens the rules to require an authenticated identity:
//   - students (authenticated) can still read the single active row,
//     exactly as the App's loadActiveDestination() expects;
//   - anonymous visitors get 403 on the collection API;
//   - the public settings route and the staff routes read through the
//     server-side $app API (rule-free) and are unaffected;
//   - superuser tooling (fixtures, seeds, restore drill) bypasses rules.
//
// Backward compatibility: no stored row changes; only the access rules.

const COLLECTION = 'payment_destination';

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId(COLLECTION);
    const readRule = "is_active = true && @request.auth.id != ''";
    collection.listRule = readRule;
    collection.viewRule = readRule;
    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId(COLLECTION);
      collection.listRule = 'is_active = true';
      collection.viewRule = 'is_active = true';
      app.save(collection);
    } catch (_) {
      // collection may not exist; ignore
    }
  },
);