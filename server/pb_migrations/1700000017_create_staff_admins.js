// server/pb_migrations/1700000017_create_staff_admins.js
// Podcast Slice 1 — independent Staff Auth Collection.
//
// `staff_admins` is the single backstage identity: the one administrator
// type for the unified Admin Console. There is deliberately no `role`
// field, no permission list and no manage rule — every Staff account is
// the same kind of user. Content, imports, publishing, analytics and
// student management are future slices; this migration only establishes
// the locked auth collection and the smallest practical fields.
//
// Security posture (all enforced at the collection level):
//   - Auth collection with built-in email/password auth; email is the
//     required, unique identity field (PB enforces uniqueness).
//   - listRule/viewRule/createRule/updateRule/deleteRule are all `null`
//     (no rule = no access for non-superusers; `""` would mean public).
//     Public registration, public record creation and public CRUD are
//     therefore disabled.
//   - Password reset is a PocketBase global feature that requires
//     approved SMTP support; it stays disabled until the project's SMTP
//     settings are approved (documented operational state — the Admin
//     login UI must not advertise a reset flow, and docs/DEPLOYMENT.md
//     records the gate).
//   - `is_active` gates authentication (see the auth hooks in
//     server/pb_hooks/main.pb.js): inactive Staff cannot authenticate,
//     refresh a session, or use Staff routes (requireStaffAdmin).
//   - `verified` is set to true ONLY through the controlled bootstrap
//     path (pnpm staff:bootstrap); the auth hooks also refuse unverified
//     records so a superuser-created record cannot silently authenticate.
//
// Only superuser tooling (the bootstrap command, tests) can write here.

const COLLECTION = 'staff_admins';

migrate(
  (app) => {
    let collection = new Collection({
      type: 'auth',
      name: COLLECTION,
      // No rule means no access for non-superusers (PB distinguishes
      // `null` = locked from `""` = public). Auth via the password
      // identity fields is unaffected by these rules.
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });
    app.save(collection);

    // Smallest practical fields: display_name + is_active only.
    collection.fields.add(
      new TextField({
        name: 'display_name',
        required: true,
        presentable: true,
        min: 1,
        max: 120,
      }),
    );
    // Non-required because PB 0.39 BoolField.ValidateValue rejects
    // `false` as "empty" when required. The create hook defaults it to
    // false when omitted; the bootstrap command sets it true explicitly.
    collection.fields.add(
      new BoolField({
        name: 'is_active',
        presentable: true,
      }),
    );
    app.save(collection);

    // The built-in email field must be required and unique (PB auth
    // collections enforce a unique index on email by default).
    collection = app.findCollectionByNameOrId(COLLECTION);
    const emailField = collection.fields.getByName('email');
    if (emailField) {
      emailField.required = true;
    }
    app.save(collection);

    // Enable email/password authentication with the email identity.
    // PB 0.39 default identityFields for auth collections is ['email'];
    // we set it explicitly so the contract is documented.
    collection = app.findCollectionByNameOrId(COLLECTION);
    collection.passwordAuth = { enabled: true, identityFields: ['email'] };
    app.save(collection);

    // Re-affirm the locked rules after every save (a round-trip default
    // could otherwise flip `null` to public access).
    collection = app.findCollectionByNameOrId(COLLECTION);
    collection.listRule = null;
    collection.viewRule = null;
    collection.createRule = null;
    collection.updateRule = null;
    collection.deleteRule = null;
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
