// server/pb_migrations/1700000025_create_content_operations.js
// Podcast Slice 4 — Create the "content_operations" audit collection.
//
// Records important backstage content operations (publish, archive,
// media replacement, variant creation, category/episode creation) with
// a bounded sanitized detail and the acting Staff Administrator.
// Ordinary draft text edits are NOT recorded here (no per-keystroke
// event-sourcing); imports keep their dedicated content_imports audit.
//
// Field contract:
//   - content_type    select: category / episode / variant / vocabulary
//   - record_id       the affected record id
//   - operation       select: create / publish / archive / media_replace
//   - detail_json     bounded sanitized detail (JSON text, <= 2000)
//   - performed_by    relation to staff_admins
//   - performed_at    optional date
//
// All CRUD rules are locked (null): only the Staff content routes write.
// The collection has no `created`/`updated` system fields reliance —
// ordering uses performed_at then id (PB 0.39 quirk: system created/
// updated are not sortable).

const COLLECTION = 'content_operations';

migrate(
  (app) => {
    const staffAdmins = app.findCollectionByNameOrId('staff_admins');
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
      new SelectField({
        name: 'content_type',
        required: true,
        values: ['category', 'episode', 'variant', 'vocabulary'],
        maxSelect: 1,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'record_id',
        required: true,
        max: 64,
      }),
    );
    collection.fields.add(
      new SelectField({
        name: 'operation',
        required: true,
        values: ['create', 'publish', 'archive', 'media_replace'],
        maxSelect: 1,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'detail_json',
        required: false,
        max: 4000,
      }),
    );
    collection.fields.add(
      new RelationField({
        name: 'performed_by',
        required: false,
        collectionId: staffAdmins.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'performed_at',
        required: false,
      }),
    );

    app.save(collection);

    // Recent-audit lookup: newest first by performed_at, then id (the
    // system created/updated fields are not usable for sorting in this
    // PB build).
    const saved = app.findCollectionByNameOrId(COLLECTION);
    saved.addIndex(
      'idx_content_operations_performed_at',
      false,
      'performed_at, id',
      '',
    );
    app.save(saved);
  },
  (app) => {
    app.deleteCollection(COLLECTION);
  },
);
