// server/pb_migrations/1700000026_create_site_settings.js
// Business Configuration slice — singleton-style "site settings" collection.
//
// Holds the owner-controlled PUBLIC contact/support configuration that the
// static Landing consumes through the public settings endpoint
// (GET /api/fast-english/public/settings). The same value is the canonical
// support AND collaboration contact until the owner separates them.
//
// Field contract:
//   - support_contact  optional bounded text (https/mailto/tel URL when set)
//
// Access rules (locked): no direct record-CRUD access. The value is read
// by the public settings route and edited by the Staff Admin Business
// Settings routes (server/pb_hooks/business_settings_routes.pb.js) or
// superuser tooling. No secrets ever live here.

const COLLECTION = 'site_settings';

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
      new TextField({
        name: 'support_contact',
        max: 300,
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
