// server/pb_migrations/1700000024_create_content_imports.js
// Podcast Slice 3 — Create the "content_imports" audit collection.
//
// Records every content-import attempt (planned/running/completed/
// failed/no_change) with the import identity (content_key,
// content_version, package_fingerprint), safe bounded diagnostics and
// the acting Staff Administrator. Direct public CRUD is locked (null):
// Staff-only Product routes expose sanitized history later; no Admin
// Import UI is built in this slice.
//
// Field contract:
//   - content_key          stable import identity (<= 160, mirrors topics)
//   - content_version      positive int (mirrors topics)
//   - package_fingerprint  deterministic package fingerprint (<= 64)
//   - schema_version       manifest specification version
//   - status               select: planned / running / completed /
//                          failed / no_change
//   - summary_json         bounded sanitized import summary (JSON text)
//   - error_json           bounded sanitized diagnostics (JSON text)
//   - imported_by          relation to staff_admins
//   - started_at           optional date
//   - completed_at         optional date
//
// Invariants (enforced by the import route, not by rules):
//   - one completed record per (content_key, content_version,
//     package_fingerprint) — the partial unique index below;
//   - failed attempts never block corrected imports (no unique index
//     on failed records);
//   - never stores tokens, passwords, transcripts, audio or storage
//     paths.
//
// Indexes:
//   idx_content_imports_identity   (U, partial WHERE status='completed')
//   idx_content_imports_key_status (content_key, status)

const COLLECTION = 'content_imports';

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
      new TextField({
        name: 'content_key',
        required: true,
        max: 160,
      }),
    );
    collection.fields.add(
      new NumberField({
        name: 'content_version',
        required: true,
        onlyInt: true,
        min: 1,
        max: 100000,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'package_fingerprint',
        required: true,
        max: 64,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'schema_version',
        required: true,
        max: 20,
      }),
    );
    collection.fields.add(
      new SelectField({
        name: 'status',
        required: true,
        maxSelect: 1,
        values: ['planned', 'running', 'completed', 'failed', 'no_change'],
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'summary_json',
        max: 4000,
      }),
    );
    collection.fields.add(
      new TextField({
        name: 'error_json',
        max: 4000,
      }),
    );
    collection.fields.add(
      new RelationField({
        name: 'imported_by',
        collectionId: staffAdmins.id,
        maxSelect: 1,
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'started_at',
      }),
    );
    collection.fields.add(
      new DateField({
        name: 'completed_at',
      }),
    );

    app.save(collection);

    const saved = app.findCollectionByNameOrId(COLLECTION);
    // One successful import per exact package identity. Partial index:
    // failed/planned/running records never block a corrected retry.
    saved.addIndex(
      'idx_content_imports_identity',
      true,
      'content_key, content_version, package_fingerprint',
      "status = 'completed'",
    );
    saved.addIndex(
      'idx_content_imports_key_status',
      false,
      'content_key, status',
      '',
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
