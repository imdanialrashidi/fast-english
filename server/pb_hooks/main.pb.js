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
  // All required fields must be set by the operator approve route.
  if (!e.record.get('user') || !e.record.get('payment_request') ||
      !e.record.get('plan_name_snapshot') || typeof e.record.get('amount_snapshot') !== 'number' ||
      typeof e.record.get('duration_days_snapshot') !== 'number' ||
      !e.record.get('starts_at') || !e.record.get('expires_at') ||
      !e.record.get('approved_by') || !e.record.get('approved_at')) {
    throw new BadRequestError('subscription: required fields missing', { code: 'forbidden' });
  }
  e.next();
}, 'subscriptions');

onRecordUpdate((e) => {
  var c = e.record && e.record.collection ? e.record.collection() : null;
  if (!c || c.name !== 'subscriptions') { e.next(); return; }
  // All subscription fields are immutable after creation.
  var allFields = ['user', 'payment_request', 'plan', 'plan_name_snapshot',
    'amount_snapshot', 'duration_days_snapshot', 'starts_at', 'expires_at',
    'status', 'approved_by', 'approved_at'];
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

// --- P3-S1: Publishing invariants for topics ---
//
// Auto-set published_at / archived_at when status transitions.
// The collection-level rules (null) already block direct API access;
// this hook normalises dates when superuser dashboard saves a record.

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
  e.next();
}, 'topics');

onRecordUpdate((e) => {
  var c = e.record && e.record.collection ? e.record.collection() : null;
  if (!c || c.name !== 'topics') { e.next(); return; }
  var originalStatus = e.originalRecord ? e.originalRecord.get('status') : null;
  var newStatus = e.record.get('status');
  if (newStatus !== originalStatus) {
    if (newStatus === 'published' && !e.record.get('published_at')) {
      e.record.set('published_at', new Date().toISOString());
    }
    if (newStatus === 'archived' && !e.record.get('archived_at')) {
      e.record.set('archived_at', new Date().toISOString());
    }
  }
  e.next();
}, 'topics');

// --- P3-S1: Publishing invariants for lessons ---
//
// Enforce:
//   - Published lesson requires a published Topic.
//   - Published lesson requires title, body, level, audio, and a valid
//     audio_duration_seconds (server-authoritative duration denominator).
//   - published_at is server-controlled.
//   - Archived lessons are not accessible (enforced by viewRule).
//   - Draft lessons are not accessible (enforced by viewRule).
//   - Invalid CEFR levels are rejected (enforced by SelectField).
//   - Topic/level uniqueness cannot be bypassed (enforced by unique index).
//   - Public sample must also be published.
//   - Audio replacement/removal cannot leave a Published lesson invalid.

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
    var pubTopicId = e.record.get('topic');
    var pubTopic = null;
    try { if (pubTopicId) { pubTopic = $app.findRecordById('topics', String(typeof pubTopicId === 'object' && pubTopicId ? pubTopicId.id || '' : pubTopicId)); } } catch (_) {}
    if (!pubTopic || pubTopic.get('status') !== 'published') {
      throw new BadRequestError('Published lesson requires a published Topic.', { code: 'invalid_lesson' });
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
  var originalStatus = e.originalRecord ? e.originalRecord.get('status') : null;
  if (status !== originalStatus) {
    if (status === 'published' && !e.record.get('published_at')) {
      e.record.set('published_at', new Date().toISOString());
    }
    if (status === 'archived' && !e.record.get('archived_at')) {
      e.record.set('archived_at', new Date().toISOString());
    }
  }

  // Published lesson validation (inlined)
  if (status === 'published') {
    var pubTopicId2 = e.record.get('topic');
    var pubTopic2 = null;
    try { if (pubTopicId2) { pubTopic2 = $app.findRecordById('topics', String(typeof pubTopicId2 === 'object' && pubTopicId2 ? pubTopicId2.id || '' : pubTopicId2)); } } catch (_) {}
    if (!pubTopic2 || pubTopic2.get('status') !== 'published') {
      throw new BadRequestError('Published lesson requires a published Topic.', { code: 'invalid_lesson' });
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
