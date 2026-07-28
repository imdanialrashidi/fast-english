// server/pb_migrations/1700000000_create_users.js
// Create the "fep_users" Auth collection with phone stored as a unique
// custom field. PB 0.39 forces `email` to be in `passwordAuth.identityFields`
// for any auth collection, so the phone-based login uses a custom API route
// (see server/pb_hooks/main.pb.js) that looks up the email by phone and
// delegates to PB's built-in `auth-with-password` endpoint.
//
// The phone is still the user-facing identity: it is normalized server-side
// to the canonical "+989XXXXXXXXX" form, has a unique index, and is the
// field the client uses in all UI and API calls.
const COLLECTION = 'fep_users';

migrate(
  (app) => {
    // Step 1: create the auth collection (no password settings yet).
    let collection = new Collection({
      type: 'auth',
      name: COLLECTION,
      listRule: 'id = @request.auth.id',
      viewRule: 'id = @request.auth.id',
      createRule: '',
      updateRule: 'id = @request.auth.id',
      deleteRule: '',
    });
    app.save(collection);

    // Step 2: add custom fields.
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
        name: 'phone',
        required: true,
        presentable: true,
        max: 64,
      }),
    );
    collection.fields.add(
      new SelectField({
        name: 'role',
        required: true,
        presentable: true,
        maxSelect: 1,
        values: ['student', 'operator', 'content_manager'],
      }),
    );
    collection.fields.add(
      new SelectField({
        name: 'account_status',
        required: true,
        presentable: true,
        maxSelect: 1,
        values: ['pending_payment', 'payment_rejected', 'active', 'expired', 'suspended'],
      }),
    );
    collection.fields.add(
      new BoolField({
        name: 'placement_completed',
        presentable: true,
      }),
    );
    collection.fields.add(
      new SelectField({
        name: 'suggested_level',
        presentable: true,
        maxSelect: 1,
        values: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      }),
    );
    collection.fields.add(
      new SelectField({
        name: 'selected_level',
        presentable: true,
        maxSelect: 1,
        values: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'suspended_reason',
        presentable: false,
        max: 500,
      }),
    );
    app.save(collection);

    // Step 3: make the built-in email field optional.
    collection = app.findCollectionByNameOrId(COLLECTION);
    const emailField = collection.fields.getByName('email');
    if (emailField) {
      emailField.required = false;
    }
    app.save(collection);

    // Step 4: add the unique index on phone.
    collection = app.findCollectionByNameOrId(COLLECTION);
    collection.addIndex('idx_fep_users_phone', true, 'phone', '');
    app.save(collection);

    // Step 5: enable password auth (PB 0.39 forces email into identityFields;
    // phone-based login is handled by the custom route in main.pb.js).
    collection = app.findCollectionByNameOrId(COLLECTION);
    collection.passwordAuth = { enabled: true, identityFields: ['email', 'phone'] };
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
