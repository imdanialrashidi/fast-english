// server/pb_hooks/main.pb.js
// PocketBase JS hooks for the Fast English Podcast auth boundary.
//
// Phone is the user-facing identity. PB 0.39 forces `email` into
// `passwordAuth.identityFields`, so the client SDK calls
// `pb.collection('fep_users').authWithPassword(identity, password)`
// where `identity` is the email, and the app-side `AuthProvider` resolves
// phone→email before calling PB. The phone-login API route is available
// as a server-side convenience for non-SDK callers (see bottom).
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
  // Inline digit map.
  var map0 = '۰',
    map1 = '۱',
    map2 = '۲',
    map3 = '۳',
    map4 = '۴';
  var map5 = '۵',
    map6 = '۶',
    map7 = '۷',
    map8 = '۸',
    map9 = '۹';
  var a0 = '٠',
    a1 = '١',
    a2 = '٢',
    a3 = '٣',
    a4 = '٤';
  var a5 = '٥',
    a6 = '٦',
    a7 = '٧',
    a8 = '٨',
    a9 = '٩';
  var digits = '';
  for (var i = 0; i < raw.length; i++) {
    var ch = raw.charAt(i);
    if (ch === map0 || ch === a0) digits += '0';
    else if (ch === map1 || ch === a1) digits += '1';
    else if (ch === map2 || ch === a2) digits += '2';
    else if (ch === map3 || ch === a3) digits += '3';
    else if (ch === map4 || ch === a4) digits += '4';
    else if (ch === map5 || ch === a5) digits += '5';
    else if (ch === map6 || ch === a6) digits += '6';
    else if (ch === map7 || ch === a7) digits += '7';
    else if (ch === map8 || ch === a8) digits += '8';
    else if (ch === map9 || ch === a9) digits += '9';
    else if (ch >= '0' && ch <= '9') digits += ch;
  }
  // Strip leading + and country-code variants.
  if (digits.length === 13 && digits.indexOf('0098') === 0) digits = digits.substring(2);
  if (digits.length === 12 && digits.indexOf('98') === 0) digits = digits.substring(2);
  if (digits.length === 11 && digits.charAt(0) === '0') digits = digits.substring(1);
  if (digits.length !== 10 || digits.charAt(0) !== '9') {
    throw new BadRequestError('invalid phone');
  }
  e.record.set('phone', '+98' + digits);
  // If the client did not provide a real email, derive one from the
  // canonical phone so PB's password auth (which requires email as the
  // identity in v0.39) can authenticate the user by phone.
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
  e.next();
}, 'fep_users');

onRecordUpdate((e) => {
  var collection = e.record && e.record.collection ? e.record.collection() : null;
  if (!collection || collection.name !== 'fep_users') {
    e.next();
    return;
  }
  var fields = [
    'role',
    'account_status',
    'placement_completed',
    'suggested_level',
    'selected_level',
    'suspended_reason',
    'verified',
    'emailVisibility',
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
  e.next();
  if (e.record && e.record.get('account_status') === 'suspended') {
    throw new BadRequestError('Failed to authenticate.');
  }
}, 'fep_users');

onRecordAuthRefreshRequest((e) => {
  if (!e.collection || e.collection.name !== 'fep_users') {
    e.next();
    return;
  }
  e.next();
  if (e.record && e.record.get('account_status') === 'suspended') {
    if (e.client && e.client.authStore) {
      e.client.authStore.clear();
    }
    throw new BadRequestError('Failed to authenticate.');
  }
}, 'fep_users');
