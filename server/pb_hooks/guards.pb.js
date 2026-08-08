// server/pb_hooks/guards.pb.js
// Podcast Slice 1 — central authentication guards for custom routes.
//
// Exactly three concepts:
//   requireStudent(e)       — authenticated record exists, Auth Collection
//                             is `fep_users`, and the record is a
//                             legitimate Student (role === 'student').
//                             Legacy Staff records (role operator /
//                             content_manager) are rejected here.
//   requireActiveStudent(e) — requireStudent + account_status === 'active'.
//                             Per-route entitlement conditions (active
//                             subscription window, placement state, …) are
//                             enforced by the routes themselves and are
//                             unchanged in this slice.
//   requireStaffAdmin(e)    — authenticated record exists, Auth Collection
//                             is `staff_admins`, and is_active is true.
//                             Authorization never relies on client routes,
//                             local storage, email text or a legacy `role`.
//
// Every guard returns `null` when the request may proceed, otherwise an
// object `{ status, code, message }` for the route to return as JSON.
//
// PB 0.39 JSVM quirk: routerAdd handlers are recompiled in the executor's
// scope and CANNOT see top-level declarations from the hook file, so the
// guards are installed on `globalThis` at load time (the same pattern the
// rate-limit state uses). Route files read them inside the handler closure:
//
//   var g = globalThis.__fepGuards;
//   var guardErr = g ? g.requireStaffAdmin(e) : null;
//   if (guardErr) return e.json(guardErr.status, { code: guardErr.code, message: guardErr.message });
//
// All hook files are loaded before any request is served, so the guard
// object always exists at call time; the defensive `g ?` check keeps a
// broken load loud (500) instead of silently open.

try { $app.logger().info("guards: hook file loaded"); } catch (_) {}

var __guardsModule = (function () {
  function requireStudent(e) {
    if (!e || !e.auth) {
      return { status: 401, code: 'unauthorized', message: 'Authentication required.' };
    }
    var coll = '';
    try {
      var c = e.auth.collection();
      if (c && c.name) coll = String(c.name);
    } catch (_) {}
    if (coll !== 'fep_users') {
      return { status: 403, code: 'student_access_denied', message: 'Access denied.' };
    }
    var role = '';
    try { role = String(e.auth.get('role') || ''); } catch (_) {}
    if (role !== 'student') {
      return { status: 403, code: 'student_access_denied', message: 'Access denied.' };
    }
    return null;
  }

  function requireActiveStudent(e) {
    var err = requireStudent(e);
    if (err) return err;
    var acct = '';
    try { acct = String(e.auth.get('account_status') || ''); } catch (_) {}
    if (acct !== 'active') {
      return { status: 403, code: 'student_access_denied', message: 'Access denied.' };
    }
    return null;
  }

  function requireStaffAdmin(e) {
    if (!e || !e.auth) {
      return { status: 401, code: 'unauthorized', message: 'Authentication required.' };
    }
    var coll = '';
    try {
      var c = e.auth.collection();
      if (c && c.name) coll = String(c.name);
    } catch (_) {}
    if (coll !== 'staff_admins') {
      return { status: 403, code: 'staff_access_denied', message: 'Access denied.' };
    }
    var active = false;
    try { active = e.auth.get('is_active') === true; } catch (_) {}
    if (!active) {
      return { status: 403, code: 'staff_access_denied', message: 'Access denied.' };
    }
    return null;
  }

  return {
    requireStudent: requireStudent,
    requireActiveStudent: requireActiveStudent,
    requireStaffAdmin: requireStaffAdmin,
  };
})();

// Export for `require(__hooks + '/guards.pb.js')` from routerAdd handlers
// (the handler scope cannot see file-level globals, but `require` is
// available and returns this module). The module object only exists when
// the file is loaded through `require`, not when PB loads it as a hook.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = __guardsModule;
}
// Also install on globalThis for hook scopes that share the global.
globalThis.__fepGuards = __guardsModule;
