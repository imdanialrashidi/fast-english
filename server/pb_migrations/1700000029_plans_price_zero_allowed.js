// server/pb_migrations/1700000029_plans_price_zero_allowed.js
// Business Configuration slice — allow `price_toman = 0` (FREE plan).
//
// PocketBase 0.39's NumberField validation treats `0` as the zero value
// and rejects it when the field is `required` ("validation_required:
// Cannot be blank."). That makes the canonical free-plan signal —
// `price_toman === 0` — impossible to store, which would block the
// entire free-plan product decision.
//
// The field is therefore marked non-required, mirroring the existing
// `is_active` pattern (documented in migration 1700000002). Semantics
// are unchanged for the product surfaces:
//   - the Staff Business Settings routes REQUIRE an explicit integer
//     price (0..1,000,000,000) and never create a plan without one;
//   - seeds/fixtures always set the price explicitly;
//   - every server read normalizes with `Number(price || 0)`, so an
//     unset value behaves as 0 — free — and 0 is exactly what the
//     free-activation route checks against the canonical record.
//
// No existing row changes; this only lifts the validation boundary.

migrate(
  (app) => {
    const plans = app.findCollectionByNameOrId('plans');
    const priceField = plans.fields.getByName('price_toman');
    if (priceField) {
      priceField.required = false;
    }
    app.save(plans);
  },
  (app) => {
    try {
      const plans = app.findCollectionByNameOrId('plans');
      const priceField = plans.fields.getByName('price_toman');
      if (priceField) {
        priceField.required = true;
      }
      app.save(plans);
    } catch (_) {
      // may not exist; ignore
    }
  },
);
