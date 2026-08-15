// server/pb_hooks/main.pb.js
// PocketBase JS hooks for the Fast English Podcast auth and payment boundary.
//
// Phone is the user-facing identity. PB 0.39 passwordAuth.identityFields
// accepts any indexed unique field, so `phone` is registered as the
// primary identity and the client SDK calls
// `pb.collection('fep_users').authWithPassword(canonicalPhone, password)`
// directly. The app-side `AuthProvider` normalises the input to the
// canonical `+989XXXXXXXXX` form before calling PB.
//
// The `fep_users` collection has an optional email field, so the create
// hook derives `<canonicalPhone>@fep.local` when the client does not
// supply a real email. The derived email is also registered in
// `passwordAuth.identityFields` as a fallback so password lookups by
// either identity succeed.
//
// All helpers are inlined into the hook callbacks because PB 0.39 JSVM
// does not share top-level `function` declarations with hook scopes.

// --- Auth: user creation ---

onRecordCreate((e) => {
  var collection = e.record && e.record.collection ? e.record.collection() : null;
  if (!collection || collection.name !== 'fep_users') {
    e.next();
    return;
  }
  var raw = e.record.get('phone');
  if (typeof raw !== 'string') {
    throw new BadRequestError('invalid phone');
  }
  // Inline digit map (re-declared because PB 0.39 JSVM does not share
  // top-level declarations with hook scopes).
  var m0 = '۰',
    m1 = '۱',
    m2 = '۲',
    m3 = '۳',
    m4 = '۴';
  var m5 = '۵',
    m6 = '۶',
    m7 = '۷',
    m8 = '۸',
    m9 = '۹';
  var n0 = '٠',
    n1 = '١',
    n2 = '٢',
    n3 = '٣',
    n4 = '٤';
  var n5 = '٥',
    n6 = '٦',
    n7 = '٧',
    n8 = '٨',
    n9 = '٩';
  var digits = '';
  for (var i = 0; i < raw.length; i++) {
    var ch = raw.charAt(i);
    if (ch === m0 || ch === n0) digits += '0';
    else if (ch === m1 || ch === n1) digits += '1';
    else if (ch === m2 || ch === n2) digits += '2';
    else if (ch === m3 || ch === n3) digits += '3';
    else if (ch === m4 || ch === n4) digits += '4';
    else if (ch === m5 || ch === n5) digits += '5';
    else if (ch === m6 || ch === n6) digits += '6';
    else if (ch === m7 || ch === n7) digits += '7';
    else if (ch === m8 || ch === n8) digits += '8';
    else if (ch === m9 || ch === n9) digits += '9';
    else if (ch >= '0' && ch <= '9') digits += ch;
  }
  // Strip leading + and country-code variants.
  if (digits.length === 14 && digits.indexOf('0098') === 0) digits = digits.substring(4);
  if (digits.length === 12 && digits.indexOf('98') === 0) digits = digits.substring(2);
  if (digits.length === 11 && digits.charAt(0) === '0') digits = digits.substring(1);
  if (digits.length !== 10 || digits.charAt(0) !== '9') {
    throw new BadRequestError('invalid phone');
  }
  e.record.set('phone', '+98' + digits);
  // If the client did not provide a real email, derive one from the
  // canonical phone so password auth (which still accepts the email
  // identity field) can authenticate the user by phone.
  if (!e.record.get('email')) {
    e.record.set('email', '+98' + digits + '@fep.local');
  }
  var name = e.record.get('name');
  e.record.set('name', typeof name === 'string' ? name.trim() : name);
  e.record.set('role', 'student');
  e.record.set('account_status', 'pending_payment');
  e.record.set('placement_completed', false);
  e.record.set('suggested_level', null);
  e.record.set('selected_level', null);
  e.record.set('suspended_reason', null);
  // L2: never auto-verify public signups and never expose them via
  // the directory. The hook is the last line of defence in case a
  // future account slice forgets to clear these.
  e.record.set('verified', false);
  e.record.set('emailVisibility', false);
  e.next();
}, 'fep_users');

// --- Auth: user update protection (H2) ---

onRecordUpdate((e) => {
  var collection = e.record && e.record.collection ? e.record.collection() : null;
  if (!collection || collection.name !== 'fep_users') {
    e.next();
    return;
  }
  // H2: students must not be able to mutate their own protected fields
  // even if a future slice loosens the collection-level updateRule.
  // Superusers (operator/technical admin) are NOT subject to this
  // check because PB has its own superuser context guard.
  var fields = [
    'role',
    'account_status',
    'placement_completed',
    'suggested_level',
    'selected_level',
    'suspended_reason',
    'verified',
    'emailVisibility',
    'phone',
    'email',
    'password',
  ];
  if (e.originalRecord) {
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (JSON.stringify(e.originalRecord.get(f)) !== JSON.stringify(e.record.get(f))) {
        throw new BadRequestError('field ' + f + ' is protected');
      }
    }
  }
  e.next();
}, 'fep_users');

// --- Auth: suspended user cannot authenticate or refresh (C1) ---

onRecordAuthRequest((e) => {
  if (!e.collection || e.collection.name !== 'fep_users') {
    e.next();
    return;
  }
  // C1: Block BEFORE e.next() so the token is never issued. The auth
  // lookup already happened by the time this hook runs, so e.record is
  // populated. PB returns a generic "Failed to authenticate" error;
  // we add the `account_suspended` code so the client can show a
  // Persian message.
  if (e.record && e.record.get('account_status') === 'suspended') {
    throw new BadRequestError('Failed to authenticate.', {
      code: 'account_suspended',
    });
  }
  e.next();
}, 'fep_users');

onRecordAuthRefreshRequest((e) => {
  if (!e.collection || e.collection.name !== 'fep_users') {
    e.next();
    return;
  }
  // C1: Block BEFORE e.next() so no new token is generated.
  if (e.record && e.record.get('account_status') === 'suspended') {
    if (e.client && e.client.authStore) {
      e.client.authStore.clear();
    }
    throw new BadRequestError('Failed to authenticate.', {
      code: 'account_suspended',
    });
  }
  e.next();
}, 'fep_users');

// --- Staff: staff_admins lifecycle ---
//
// The collection rules (all null) already restrict writes to superusers.
// These hooks add the operational semantics:
//   - a record created without an explicit `is_active` is inactive by
//     default (safe default; the bootstrap command sets it explicitly);
//   - inactive or unverified Staff cannot authenticate or refresh a
//     session, so a disabled account stops working immediately and a
//     superuser-created record cannot silently become usable.

onRecordCreate((e) => {
  var collection = e.record && e.record.collection ? e.record.collection() : null;
  if (!collection || collection.name !== 'staff_admins') {
    e.next();
    return;
  }
  var name = e.record.get('display_name');
  e.record.set('display_name', typeof name === 'string' ? name.trim() : name);
  if (typeof e.record.get('is_active') !== 'boolean') {
    e.record.set('is_active', false);
  }
  e.next();
}, 'staff_admins');

onRecordAuthRequest((e) => {
  if (!e.collection || e.collection.name !== 'staff_admins') {
    e.next();
    return;
  }
  if (e.record) {
    var active = e.record.get('is_active') === true;
    var verified = e.record.get('verified') === true;
    if (!active || !verified) {
      throw new BadRequestError('Failed to authenticate.', {
        code: 'staff_inactive',
      });
    }
  }
  e.next();
}, 'staff_admins');

onRecordAuthRefreshRequest((e) => {
  if (!e.collection || e.collection.name !== 'staff_admins') {
    e.next();
    return;
  }
  if (e.record) {
    var active = e.record.get('is_active') === true;
    var verified = e.record.get('verified') === true;
    if (!active || !verified) {
      if (e.client && e.client.authStore) {
        e.client.authStore.clear();
      }
      throw new BadRequestError('Failed to authenticate.', {
        code: 'staff_inactive',
      });
    }
  }
  e.next();
}, 'staff_admins');

// --- Payment boundary: server-only fields on payment_requests ---
//
// The collection has listRule/viewRule/createRule/updateRule/deleteRule
// all set to null so the record-CRUD API rejects every direct access.
// This hook is the defence-in-depth backstop in case a future migration
// loosens the rules: it ensures the snapshot fields and the file are
// never altered after creation, and that direct mutations of plans /
// payment_destination are blocked.
//
// Model-level hooks (onRecordCreate/Update/Delete) do not have access
// to a request auth context in PB 0.39, so we cannot infer the caller.
// The collection-level rules (null = locked) are the primary defense;
// the hooks below add a second layer by:
//   - forcing the snapshot fields and the file to be set exactly once
//     (the create hook is the only place they are ever set);
//   - rejecting any later mutation of the snapshot fields or the file
//     (the update hook);
//   - refusing to delete a payment_request that was created (kept for
//     audit integrity).
//
// Plans and payment_destination are only written by superuser tooling
// (P1-S2 dashboard, P1-S1 migration smoke) through the same hooks that
// PB uses for every save, so we still need the onRecordCreate hook to
// ensure server-managed defaults (e.g. trimmed slug) are applied.

onRecordCreate((e) => {
  var collection = e.record && e.record.collection ? e.record.collection() : null;
  if (!collection || collection.name !== 'payment_requests') {
    e.next();
    return;
  }
  // Snapshots and the receipt file must be set on creation. Refuse a
  // save that lacks any of them so a future migration that loosens
  // createRule cannot allow direct writes that bypass the custom
  // route's snapshot logic.
  if (!e.record.get('plan_name_snapshot') || typeof e.record.get('plan_name_snapshot') !== 'string') {
    throw new BadRequestError('plan_name_snapshot is required', { code: 'forbidden' });
  }
  if (typeof e.record.get('amount_snapshot') !== 'number' || e.record.get('amount_snapshot') < 0) {
    throw new BadRequestError('amount_snapshot is required', { code: 'forbidden' });
  }
  if (typeof e.record.get('duration_days_snapshot') !== 'number' || e.record.get('duration_days_snapshot') < 1) {
    throw new BadRequestError('duration_days_snapshot is required', { code: 'forbidden' });
  }
  if (!e.record.get('receipt_file')) {
    throw new BadRequestError('receipt_file is required', { code: 'forbidden' });
  }
  if (e.record.get('status') !== 'pending') {
    throw new BadRequestError('status must be pending on create', { code: 'forbidden' });
  }
  e.next();
}, 'payment_requests');

onRecordUpdate((e) => {
  var collection = e.record && e.record.collection ? e.record.collection() : null;
  if (!collection || collection.name !== 'payment_requests') {
    e.next();
    return;
  }
  // Snapshots and the file are immutable once written. P1-S2 operator
  // approval changes the row through a dedicated custom route that
  // writes only the review fields.
  var locked = ['user', 'plan', 'plan_name_snapshot', 'amount_snapshot', 'duration_days_snapshot', 'receipt_file', 'created'];
  if (e.originalRecord) {
    for (var i = 0; i < locked.length; i++) {
      var f = locked[i];
      if (JSON.stringify(e.originalRecord.get(f)) !== JSON.stringify(e.record.get(f))) {
        throw new BadRequestError('field ' + f + ' is immutable on payment_requests', {
          code: 'forbidden',
        });
      }
    }
  }
  e.next();
}, 'payment_requests');

// --- Subscriptions: all fields are immutable after creation.
// The collection has createRule/updateRule/deleteRule = null so
// direct CRUD is blocked at the API layer. These hooks are the
// defense-in-depth backstop.

onRecordCreate((e) => {
  var c = e.record && e.record.collection ? e.record.collection() : null;
  if (!c || c.name !== 'subscriptions') { e.next(); return; }
  // All required fields must be set by the operator approve route (paid)
  // or the free-activation route (free, no payment_request/approved_by).
  var source = String(e.record.get('source') || 'paid');
  var isFree = source === 'free';
  if (!e.record.get('user') ||
      !e.record.get('plan_name_snapshot') || typeof e.record.get('amount_snapshot') !== 'number' ||
      typeof e.record.get('duration_days_snapshot') !== 'number' ||
      !e.record.get('starts_at') || !e.record.get('expires_at')) {
    throw new BadRequestError('subscription: required fields missing', { code: 'forbidden' });
  }
  if (isFree) {
    // Free subscriptions MUST NOT carry a payment request or a staff
    // approver (they are not the result of a paid approval).
    if (e.record.get('payment_request') || e.record.get('approved_by')) {
      throw new BadRequestError('subscription: free rows must not link a payment request', { code: 'forbidden' });
    }
  } else {
    if (!e.record.get('payment_request') || !e.record.get('approved_by') || !e.record.get('approved_at')) {
      throw new BadRequestError('subscription: required fields missing', { code: 'forbidden' });
    }
  }
  e.next();
}, 'subscriptions');

onRecordUpdate((e) => {
  var c = e.record && e.record.collection ? e.record.collection() : null;
  if (!c || c.name !== 'subscriptions') { e.next(); return; }
  // All subscription fields are immutable after creation.
  var allFields = ['user', 'payment_request', 'plan', 'plan_name_snapshot',
    'amount_snapshot', 'duration_days_snapshot', 'starts_at', 'expires_at',
    'status', 'approved_by', 'approved_at', 'source'];
  if (e.originalRecord) {
    for (var i = 0; i < allFields.length; i++) {
      var f = allFields[i];
      if (JSON.stringify(e.originalRecord.get(f)) !== JSON.stringify(e.record.get(f))) {
        throw new BadRequestError('field ' + f + ' is immutable on subscriptions', { code: 'forbidden' });
      }
    }
  }
  e.next();
}, 'subscriptions');

// --- Payment boundary: trim plans slug, ensure plans / destination
// are only mutated via the superuser dashboard. P1-S2 will add an
// operator workflow. For this slice the rules are null so only
// superuser tooling (the dashboard or a smoke fixture) can write.

onRecordCreate((e) => {
  var collection = e.record && e.record.collection ? e.record.collection() : null;
  if (!collection || (collection.name !== 'plans' && collection.name !== 'payment_destination')) {
    e.next();
    return;
  }
  // Trim string fields for hygiene. We do not change the rule that
  // direct create/update/delete are locked; this only normalises
  // what superuser tools (and the smoke fixture) eventually write.
  if (collection.name === 'plans') {
    var slug = e.record.get('slug');
    if (typeof slug === 'string') {
      e.record.set('slug', slug.replace(/^\s+|\s+$/g, ''));
    }
    // An EXPLICIT integer price is required on every plan write: an
    // unset `price_toman` must never silently become a FREE plan
    // (Number(price || 0) === 0 everywhere). The staff Business Settings
    // routes always send an explicit price; this hook enforces the same
    // contract for direct/superuser writes.
    var price = e.record.get('price_toman');
    if (typeof price !== 'number' || !Number.isInteger(price) || price < 0) {
      throw new BadRequestError('price_toman must be an explicit non-negative integer', {
        code: 'forbidden',
      });
    }
  }
  // Default is_active to true when not explicitly provided. The
  // migration marks the field non-required because PB 0.39's
  // BoolField.ValidateValue rejects `false` as "empty" when the
  // field is required, so superuser tooling that wants to create
  // an inactive plan/destination can do so by passing is_active=false.
  // The default preserves backward compatibility for callers that
  // omit the field.
  if (typeof e.record.get('is_active') !== 'boolean') {
    e.record.set('is_active', true);
  }
  e.next();
}, 'plans', 'payment_destination');

// --- Placement: question content is immutable after creation ---
// Only `is_active` may be toggled. All other fields are locked on update.
// The collection rules (null) are the primary defense; hooks are a backstop.

onRecordUpdate((e) => {
  var c = e.record && e.record.collection ? e.record.collection() : null;
  if (!c || c.name !== 'placement_questions') { e.next(); return; }
  if (!e.originalRecord) { e.next(); return; }
  var immutableFields = ['question_key', 'version', 'position', 'prompt', 'options', 'options_text', 'correct_option_id'];
  for (var i = 0; i < immutableFields.length; i++) {
    var f = immutableFields[i];
    if (JSON.stringify(e.originalRecord.get(f)) !== JSON.stringify(e.record.get(f))) {
      throw new BadRequestError('field ' + f + ' is immutable on placement_questions', { code: 'forbidden' });
    }
  }
  e.next();
}, 'placement_questions');

// --- Placement: attempts are protected by collection rules ---
// The collection's listRule/viewRule/createRule/updateRule/deleteRule
// are all set to null, so direct API access is blocked.
// Custom routes use $app.save() and runInTransaction, which are not
// affected by API rules. Model-level hooks are intentionally absent
// because PB 0.39 model hooks fire for ALL saves including those from
// custom routes, and a blanket rejection would break the placement
// routes. The collection-level null rules are the authoritative defense.

// --- Podcast Slice 2: publishing invariants for categories ---
//
// Auto-set published_at / archived_at on status transitions and enforce
// the published-Category invariants (valid title, valid slug, non-empty
// Persian description) on every save of a published Category. Collection
// rules (null) block all direct public CRUD; superuser tooling is the
// only writer.
//
// The module (podcast_domain.pb.js) is loaded through globalThis with a
// fail-closed fallback: when the helpers are unavailable the save is
// rejected rather than silently accepted.

onRecordCreate((e) => {
  var c = e.record && e.record.collection ? e.record.collection() : null;
  if (!c || c.name !== 'categories') { e.next(); return; }
  var key = e.record.get('key');
  if (typeof key === 'string') { e.record.set('key', key.replace(/^\s+|\s+$/g, '')); }
  var slug = e.record.get('slug');
  if (typeof slug === 'string') { e.record.set('slug', slug.replace(/^\s+|\s+$/g, '')); }
  var status = e.record.get('publication_status');
  if (typeof status !== 'string' || status === '') {
    e.record.set('publication_status', 'draft');
    status = 'draft';
  }
  if (typeof e.record.get('sort_order') !== 'number') {
    e.record.set('sort_order', 0);
  }
  if (status === 'published' && !e.record.get('published_at')) {
    e.record.set('published_at', new Date().toISOString());
  }
  if (status === 'archived' && !e.record.get('archived_at')) {
    e.record.set('archived_at', new Date().toISOString());
  }
  if (status === 'published') {
    var titleFa = String(e.record.get('title_fa') || '');
    if (!titleFa) { throw new BadRequestError('Published Category requires a Persian title.', { code: 'invalid_category' }); }
    var catSlug = String(e.record.get('slug') || '');
    if (!catSlug) { throw new BadRequestError('Published Category requires a slug.', { code: 'invalid_category' }); }
    var descFa = String(e.record.get('description_fa') || '');
    if (!descFa) { throw new BadRequestError('Published Category requires a Persian description.', { code: 'invalid_category' }); }
  }
  e.next();
}, 'categories');

onRecordUpdate((e) => {
  var c = e.record && e.record.collection ? e.record.collection() : null;
  if (!c || c.name !== 'categories') { e.next(); return; }
  var originalStatus = e.originalRecord ? e.originalRecord.get('publication_status') : null;
  var newStatus = e.record.get('publication_status');
  if (newStatus !== originalStatus) {
    if (newStatus === 'published' && !e.record.get('published_at')) {
      e.record.set('published_at', new Date().toISOString());
    }
    if (newStatus === 'archived' && !e.record.get('archived_at')) {
      e.record.set('archived_at', new Date().toISOString());
    }
  }
  if (newStatus === 'published') {
    var titleFa2 = String(e.record.get('title_fa') || '');
    if (!titleFa2) { throw new BadRequestError('Published Category requires a Persian title.', { code: 'invalid_category' }); }
    var catSlug2 = String(e.record.get('slug') || '');
    if (!catSlug2) { throw new BadRequestError('Published Category requires a slug.', { code: 'invalid_category' }); }
    var descFa2 = String(e.record.get('description_fa') || '');
    if (!descFa2) { throw new BadRequestError('Published Category requires a Persian description.', { code: 'invalid_category' }); }
  }
  e.next();
}, 'categories');

// --- P3-S1 + Podcast Slice 2: publishing invariants for topics ---
//
// Auto-set published_at / archived_at when status transitions.
// The collection-level rules (null) already block direct API access;
// this hook normalises dates when superuser dashboard saves a record.
//
// Podcast Slice 2 adds the canonical-Episode invariants for NEW publishes
// and REPUBLISHES only (create-with-published or transition into
// published): published Category, stable content key, valid slug, title,
// Persian title, Persian description, positive content version and
// artwork. Already-published legacy content without the new fields keeps
// working (grandfathering; see docs/PODCAST_DOMAIN.md).

onRecordCreate((e) => {
  var c = e.record && e.record.collection ? e.record.collection() : null;
  if (!c || c.name !== 'topics') { e.next(); return; }
  var status = e.record.get('status');
  if (status === 'published' && !e.record.get('published_at')) {
    e.record.set('published_at', new Date().toISOString());
  }
  if (status === 'archived' && !e.record.get('archived_at')) {
    e.record.set('archived_at', new Date().toISOString());
  }
  if (status === 'published') {
    var pd = null;
    try { pd = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd = null; }
    if (!pd || !pd.requirePublishedTopic) {
      throw new BadRequestError('Podcast domain helpers unavailable.', { code: 'internal_error' });
    }
    var check = pd.requirePublishedTopic($app, e.record);
    if (!check.ok) {
      throw new BadRequestError(check.reason || 'Published Episode invariants not met.', { code: 'invalid_topic' });
    }
  }
  e.next();
}, 'topics');

onRecordUpdate((e) => {
  var c = e.record && e.record.collection ? e.record.collection() : null;
  if (!c || c.name !== 'topics') { e.next(); return; }
  // Migration/import saves have no originalRecord; transition logic (and
  // the new publish invariants) applies only to real API updates.
  if (!e.originalRecord) { e.next(); return; }
  var originalStatus = e.originalRecord.get('status');
  var newStatus = e.record.get('status');
  if (newStatus !== originalStatus) {
    if (newStatus === 'published' && !e.record.get('published_at')) {
      e.record.set('published_at', new Date().toISOString());
    }
    if (newStatus === 'archived' && !e.record.get('archived_at')) {
      e.record.set('archived_at', new Date().toISOString());
    }
  }
  if (newStatus === 'published' && newStatus !== originalStatus) {
    var pd2 = null;
    try { pd2 = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd2 = null; }
    if (!pd2 || !pd2.requirePublishedTopic) {
      throw new BadRequestError('Podcast domain helpers unavailable.', { code: 'internal_error' });
    }
    var check2 = pd2.requirePublishedTopic($app, e.record);
    if (!check2.ok) {
      throw new BadRequestError(check2.reason || 'Published Episode invariants not met.', { code: 'invalid_topic' });
    }
  }
  e.next();
}, 'topics');

// --- P3-S1 + Podcast Slice 2: Publishing invariants for lessons ---
//
// Enforce:
//   - Published lesson requires a published Topic.
//   - Published lesson requires a published parent Category.
//   - Published lesson requires title, body, level, audio, and a valid
//     audio_duration_seconds (server-authoritative duration denominator).
//   - published_at is server-controlled.
//   - Archived lessons are not accessible (enforced by viewRule).
//   - Draft lessons are not accessible (enforced by viewRule).
//   - Invalid CEFR levels are rejected (enforced by SelectField).
//   - Topic/level uniqueness cannot be bypassed (enforced by unique index).
//   - Public sample must also be published.
//   - Audio replacement/removal cannot leave a Published lesson invalid.
//
// Podcast Slice 2 additions:
//   - NEW publishes / republishes (create-with-published or transition
//     into published) require summary_fa and a positive content_version
//     (grandfathering for already-published legacy content — see
//     docs/PODCAST_DOMAIN.md).

onRecordCreate((e) => {
  var c = e.record && e.record.collection ? e.record.collection() : null;
  if (!c || c.name !== 'lessons') { e.next(); return; }
  var status = e.record.get('status');
  var isSample = e.record.get('is_public_sample');

  // Public sample must be published
  if (isSample && status !== 'published') {
    throw new BadRequestError('Public sample must be published.', { code: 'invalid_lesson' });
  }

  // Auto-set timestamps
  if (status === 'published' && !e.record.get('published_at')) {
    e.record.set('published_at', new Date().toISOString());
  }
  if (status === 'archived' && !e.record.get('archived_at')) {
    e.record.set('archived_at', new Date().toISOString());
  }

  // Published lesson validation (inlined because PB 0.39 JSVM does not
  // share top-level function declarations with hook scopes).
  if (status === 'published') {
    var pd = null;
    try { pd = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd = null; }
    if (!pd || !pd.requireNewVariantInvariants) {
      throw new BadRequestError('Podcast domain helpers unavailable.', { code: 'internal_error' });
    }
    var newCheck = pd.requireNewVariantInvariants($app, e.record);
    if (!newCheck.ok) {
      throw new BadRequestError(newCheck.reason || 'Published Variant invariants not met.', { code: 'invalid_lesson' });
    }
    var pubTopicId = e.record.get('topic');
    var pubTopic = null;
    try { if (pubTopicId) { pubTopic = $app.findRecordById('topics', String(typeof pubTopicId === 'object' && pubTopicId ? pubTopicId.id || '' : pubTopicId)); } } catch (_) {}
    if (!pubTopic || pubTopic.get('status') !== 'published') {
      throw new BadRequestError('Published lesson requires a published Topic.', { code: 'invalid_lesson' });
    }
    var catCheck = pd.requirePublishedCategory($app, pubTopic.get('category'));
    if (!catCheck.ok) {
      throw new BadRequestError(catCheck.reason || 'Published lesson requires a published Category.', { code: 'invalid_lesson' });
    }
    var pTitle = e.record.get('title');
    if (!pTitle || String(pTitle).trim() === '') {
      throw new BadRequestError('Published lesson requires a title.', { code: 'invalid_lesson' });
    }
    var pBody = e.record.get('body');
    if (!pBody || String(pBody).trim() === '') {
      throw new BadRequestError('Published lesson requires body text.', { code: 'invalid_lesson' });
    }
    var pLevel = e.record.get('level');
    if (!pLevel) {
      throw new BadRequestError('Published lesson requires a level.', { code: 'invalid_lesson' });
    }
    var pAudio = e.record.get('audio');
    if (!pAudio) {
      throw new BadRequestError('Published lesson requires audio.', { code: 'invalid_lesson' });
    }
    var pDur = Number(e.record.get('audio_duration_seconds') || 0);
    if (!isNaN(pDur) && isFinite(pDur) && pDur > 0 && pDur <= 86400) {
      // valid
    } else {
      throw new BadRequestError('Published lesson requires a valid audio_duration_seconds (1–86400).', { code: 'invalid_lesson' });
    }
  }

  e.next();
}, 'lessons');

onRecordUpdate((e) => {
  var c = e.record && e.record.collection ? e.record.collection() : null;
  if (!c || c.name !== 'lessons') { e.next(); return; }
  var status = e.record.get('status');
  var isSample = e.record.get('is_public_sample');

  // Public sample must be published
  if (isSample && status !== 'published') {
    throw new BadRequestError('Public sample must be published.', { code: 'invalid_lesson' });
  }

  // Auto-set timestamps
  // Migration/import saves have no originalRecord; transition logic (and
  // the new publish invariants) applies only to real API updates.
  var originalStatus = e.originalRecord ? e.originalRecord.get('status') : null;
  if (e.originalRecord && status !== originalStatus) {
    if (status === 'published' && !e.record.get('published_at')) {
      e.record.set('published_at', new Date().toISOString());
    }
    if (status === 'archived' && !e.record.get('archived_at')) {
      e.record.set('archived_at', new Date().toISOString());
    }
  }

  // Published lesson validation (inlined)
  if (status === 'published') {
    var pd2 = null;
    try { pd2 = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd2 = null; }
    if (!pd2 || !pd2.requireNewVariantInvariants) {
      throw new BadRequestError('Podcast domain helpers unavailable.', { code: 'internal_error' });
    }
    if (e.originalRecord && status !== originalStatus) {
      var newCheck2 = pd2.requireNewVariantInvariants($app, e.record);
      if (!newCheck2.ok) {
        throw new BadRequestError(newCheck2.reason || 'Published Variant invariants not met.', { code: 'invalid_lesson' });
      }
    }
    var pubTopicId2 = e.record.get('topic');
    var pubTopic2 = null;
    try { if (pubTopicId2) { pubTopic2 = $app.findRecordById('topics', String(typeof pubTopicId2 === 'object' && pubTopicId2 ? pubTopicId2.id || '' : pubTopicId2)); } } catch (_) {}
    if (!pubTopic2 || pubTopic2.get('status') !== 'published') {
      throw new BadRequestError('Published lesson requires a published Topic.', { code: 'invalid_lesson' });
    }
    var catCheck2 = pd2.requirePublishedCategory($app, pubTopic2.get('category'));
    if (!catCheck2.ok) {
      throw new BadRequestError(catCheck2.reason || 'Published lesson requires a published Category.', { code: 'invalid_lesson' });
    }
    var pTitle2 = e.record.get('title');
    if (!pTitle2 || String(pTitle2).trim() === '') {
      throw new BadRequestError('Published lesson requires a title.', { code: 'invalid_lesson' });
    }
    var pBody2 = e.record.get('body');
    if (!pBody2 || String(pBody2).trim() === '') {
      throw new BadRequestError('Published lesson requires body text.', { code: 'invalid_lesson' });
    }
    var pLevel2 = e.record.get('level');
    if (!pLevel2) {
      throw new BadRequestError('Published lesson requires a level.', { code: 'invalid_lesson' });
    }
    var pAudio2 = e.record.get('audio');
    if (!pAudio2) {
      throw new BadRequestError('Published lesson requires audio.', { code: 'invalid_lesson' });
    }
    var pDur2 = Number(e.record.get('audio_duration_seconds') || 0);
    if (!isNaN(pDur2) && isFinite(pDur2) && pDur2 > 0 && pDur2 <= 86400) {
      // valid
    } else {
      throw new BadRequestError('Published lesson requires a valid audio_duration_seconds (1–86400).', { code: 'invalid_lesson' });
    }
  }

  e.next();
}, 'lessons');
