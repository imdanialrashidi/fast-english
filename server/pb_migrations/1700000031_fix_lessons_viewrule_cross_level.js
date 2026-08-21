// server/pb_migrations/1700000031_fix_lessons_viewrule_cross_level.js
// Fix lessons viewRule drift: level is not an authz boundary (S6).
// Removes `level = @request.auth.selected_level` from the protected-file viewRule
// so direct PB file-token downloads align with the proxy entitlement (which
// permits any Published Variant A1–C2 for an entitled Student).
// Category archival is enforced only at the proxy layer (PB rules cannot join categories).

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('lessons');
    collection.viewRule =
      "@request.context = 'protectedFile' && " +
      "@request.auth.id != null && " +
      "@request.auth.role = 'student' && " +
      "@request.auth.account_status = 'active' && " +
      "@request.auth.placement_completed = true && " +
      "status = 'published' && " +
      "topic.status = 'published'";
    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('lessons');
      collection.viewRule =
        "@request.context = 'protectedFile' && " +
        "@request.auth.id != null && " +
        "@request.auth.role = 'student' && " +
        "@request.auth.account_status = 'active' && " +
        "@request.auth.placement_completed = true && " +
        "level = @request.auth.selected_level && " +
        "status = 'published' && " +
        "topic.status = 'published'";
      app.save(collection);
    } catch (_) {}
  },
);
