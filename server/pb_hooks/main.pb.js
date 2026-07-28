// server/pb_hooks/main.pb.js
// PocketBase JS hooks for the Fast English Podcast auth boundary.
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
