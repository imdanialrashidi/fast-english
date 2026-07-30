#!/usr/bin/env node
// scripts/smoke-placement.mjs - Backend Placement smoke test.
// Usage: bash scripts/smoke-placement.sh node scripts/smoke-placement.mjs

import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.PB_SMOKE_PLACEMENT_PORT ?? 18093);
const URL = `http://127.0.0.1:${PORT}`;
const ANSWER_KEYS = [
  'correctOptionId',
  'correct_option_id',
  'correctAnswer',
  'answerKey',
  'isCorrect',
  'gradingKey',
];

let total = 0,
  passed = 0;
function check(cond, msg) {
  total++;
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
  } else {
    console.log(`  PASS: ${msg}`);
    passed++;
  }
}

let phoneCounter = 0;
function nextPhone() {
  const tail = String(phoneCounter++).padStart(2, '0');
  const rand = randomBytes(4).readUInt32BE(0) % 10_000_000;
  const mid = String(rand).padStart(7, '0');
  return `09${mid}${tail}`.slice(0, 11);
}
function randomId() {
  return randomBytes(6).toString('hex');
}

async function jsonFetch(path, init = {}) {
  const res = await fetch(`${URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text };
  }
  return { status: res.status, body };
}

async function getSuperuserToken() {
  const email = process.env.PB_TEST_SU_EMAIL;
  const password = process.env.PB_TEST_SU_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'PB_TEST_SU_EMAIL/PASSWORD not set; shell wrapper must create superuser before serve',
    );
  }
  const r = await jsonFetch('/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: email, password }),
  });
  return r.body?.token || '';
}

async function getOperatorToken(suToken) {
  const phone = nextPhone();
  const s = await jsonFetch('/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Op',
      phone,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
    }),
  });
  const uid = s.body?.id || '';
  await jsonFetch(`/api/collections/fep_users/records/${uid}`, {
    method: 'PATCH',
    headers: { authorization: suToken },
    body: JSON.stringify({ role: 'operator', account_status: 'active' }),
  });
  const l = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: s.body?.phone || phone, password: 'Test1234!' }),
  });
  return l.body?.token || '';
}

async function createActiveStudent(suToken) {
  const opToken = await getOperatorToken(suToken);
  const phone = nextPhone();
  const password = 'Test1234!';
  const signupRes = await jsonFetch('/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({ name: 'S', phone, password, passwordConfirm: password }),
  });
  if (!signupRes.body?.id) throw new Error(`Signup failed: ${JSON.stringify(signupRes.body)}`);
  const userId = signupRes.body.id;
  const canonicalPhone = signupRes.body.phone;
  const loginRes = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  if (!loginRes.body?.token) throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  const token = loginRes.body.token;

  // Create active payment destination
  await jsonFetch('/api/collections/payment_destination/records', {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      card_number: '0000000000000000',
      card_holder_name: 'TEST',
      bank_name: 'TEST',
      is_active: true,
    }),
  });

  // Create plan
  const planRes = await jsonFetch('/api/collections/plans/records', {
    method: 'POST',
    headers: { authorization: suToken },
    body: JSON.stringify({
      name: 'T',
      slug: `t-${randomId()}`,
      duration_days: 90,
      price_toman: 100000,
      is_active: true,
    }),
  });
  const planId = planRes.body?.id;
  if (!planId) throw new Error(`Plan failed: ${JSON.stringify(planRes.body)}`);

  // Create payment request with multipart PNG
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
  ]);
  const boundary = `----FormBoundary${randomId()}`;
  const headerStr = `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${planId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`;
  const footerStr = `\r\n--${boundary}--\r\n`;
  const fullBody = Buffer.concat([Buffer.from(headerStr), pngBytes, Buffer.from(footerStr)]);
  const prRes = await fetch(`${URL}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: fullBody,
  });
  const prText = await prRes.text();
  let prBody;
  try {
    prBody = JSON.parse(prText);
  } catch {
    prBody = { _raw: prText };
  }
  if (prRes.status !== 201) throw new Error(`PR failed: ${prRes.status} ${JSON.stringify(prBody)}`);
  const prId = prBody?.request?.id;
  if (!prId) throw new Error(`No PR ID: ${JSON.stringify(prBody)}`);

  // Approve via operator
  const approveRes = await jsonFetch(
    `/api/fast-english/operator/payment-requests/${prId}/approve`,
    {
      method: 'POST',
      headers: { authorization: opToken },
      body: JSON.stringify({}),
    },
  );
  if (approveRes.status !== 200)
    throw new Error(`Approve failed: ${approveRes.status} ${JSON.stringify(approveRes.body)}`);

  // Refresh token
  const refreshRes = await jsonFetch('/api/collections/fep_users/auth-refresh', {
    method: 'POST',
    headers: { authorization: token },
  });
  return { token: refreshRes.body?.token || token, userId, phone: canonicalPhone };
}

async function seedQuestions(suToken) {
  const prompts = [
    'She ___ to school.',
    'They ___ football.',
    'I saw ___ elephant.',
    'Cat is ___ the table.',
    'What says woof?',
    'Yesterday I ___ a movie.',
    'She ___ visit tomorrow.',
    'Which is a fruit?',
    '___ is my friend.',
    'How many children?',
    'Sky is?',
    'This is ___ book.',
    'She runs ___.',
    'Smell with?',
    '___ do you live?',
    'I ___ like coffee.',
    'Wear on feet?',
    'This is ___ than that.',
    'Sleep in a ___.',
    'You ___ brush teeth.',
  ];
  const opts = [
    ['go', 'goes', 'going', 'went'],
    ['plays', 'play', 'playing', 'played'],
    ['a', 'an', 'the', '---'],
    ['on', 'in', 'at', 'under'],
    ['Cat', 'Dog', 'Cow', 'Sheep'],
    ['watch', 'watched', 'watching', 'watches'],
    ['will', 'is', 'does', 'has'],
    ['Carrot', 'Apple', 'Bread', 'Cheese'],
    ['He', 'Him', 'His', 'Her'],
    ['child', 'childs', 'children', 'childrens'],
    ['Red', 'Green', 'Blue', 'Yellow'],
    ['interest', 'interested', 'interesting', 'interests'],
    ['quick', 'quickly', 'quicker', 'quickness'],
    ['Eyes', 'Ears', 'Nose', 'Hands'],
    ['Where', 'What', 'Who', 'Why'],
    ['dont', 'doesnt', 'isnt', 'arent'],
    ['Hat', 'Gloves', 'Shoes', 'Scarf'],
    ['good', 'better', 'best', 'well'],
    ['Kitchen', 'Bedroom', 'Bathroom', 'Garage'],
    ['must', 'can', 'might', 'will'],
  ];
  const correct = [
    'b',
    'b',
    'b',
    'd',
    'b',
    'b',
    'a',
    'b',
    'a',
    'c',
    'c',
    'c',
    'b',
    'c',
    'a',
    'a',
    'c',
    'b',
    'b',
    'a',
  ];

  for (let i = 0; i < 20; i++) {
    const optArr = opts[i].map((t, j) => ({ id: String.fromCharCode(97 + j), text: t }));
    await jsonFetch('/api/collections/placement_questions/records', {
      method: 'POST',
      headers: { authorization: suToken },
      body: JSON.stringify({
        question_key: `q${String(i).padStart(2, '0')}`,
        version: 1,
        position: i + 1,
        prompt: prompts[i],
        options: optArr,
        options_text: JSON.stringify(optArr),
        correct_option_id: correct[i],
        is_active: true,
      }),
    });
  }
}

// ---- Main ----

async function main() {
  console.log('\n=== Placement Smoke Tests ===\n');

  const suToken = await getSuperuserToken();
  check(!!suToken, 'S0: superuser auth works');

  // S1: Unauthenticated
  const r1 = await jsonFetch('/api/fast-english/placement/attempts/start', { method: 'POST' });
  check(r1.status === 401, 'S1: unauthenticated denied (401)');

  // S2: Pending payment
  const p2 = nextPhone();
  const s2 = await jsonFetch('/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({
      name: 'S',
      phone: p2,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
    }),
  });
  const l2 = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: s2.body?.phone || p2, password: 'Test1234!' }),
  });
  const r2 = await jsonFetch('/api/fast-english/placement/attempts/start', {
    method: 'POST',
    headers: { authorization: l2.body?.token || '' },
  });
  check(r2.status === 403, `S2: pending-payment denied (${r2.status})`);

  // S3: Suspended
  const p3 = nextPhone();
  const s3 = await jsonFetch('/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({
      name: 'S',
      phone: p3,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
    }),
  });
  const l3 = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: s3.body?.phone || p3, password: 'Test1234!' }),
  });
  const uid3 = l3.body?.record?.id || s3.body?.id || '';
  await jsonFetch(`/api/collections/fep_users/records/${uid3}`, {
    method: 'PATCH',
    headers: { authorization: suToken },
    body: JSON.stringify({ account_status: 'suspended' }),
  });
  const r3 = await jsonFetch('/api/fast-english/placement/attempts/start', {
    method: 'POST',
    headers: { authorization: l3.body?.token || '' },
  });
  check(
    r3.status === 403 && r3.body?.code === 'placement_suspended',
    `S3: suspended (${r3.status} ${r3.body?.code})`,
  );

  // S4: Operator
  const p4 = nextPhone();
  const s4 = await jsonFetch('/api/collections/fep_users/records', {
    method: 'POST',
    body: JSON.stringify({
      name: 'S',
      phone: p4,
      password: 'Test1234!',
      passwordConfirm: 'Test1234!',
    }),
  });
  const l4 = await jsonFetch('/api/collections/fep_users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: s4.body?.phone || p4, password: 'Test1234!' }),
  });
  const uid4 = l4.body?.record?.id || s4.body?.id || '';
  await jsonFetch(`/api/collections/fep_users/records/${uid4}`, {
    method: 'PATCH',
    headers: { authorization: suToken },
    body: JSON.stringify({ role: 'operator', account_status: 'active' }),
  });
  const r4 = await jsonFetch('/api/fast-english/placement/attempts/start', {
    method: 'POST',
    headers: { authorization: l4.body?.token || '' },
  });
  check(
    r4.status === 403 && r4.body?.code === 'placement_access_denied',
    `S4: operator (${r4.status} ${r4.body?.code})`,
  );

  // Create active student
  const { token: activeToken } = await createActiveStudent(suToken);
  check(!!activeToken, 'S9: active student created');

  // Seed questions
  await seedQuestions(suToken);
  const qCheck = await jsonFetch('/api/collections/placement_questions/records', {
    headers: { authorization: suToken },
  });
  check(qCheck.body?.totalItems === 20, `S10: ${qCheck.body?.totalItems} questions`);

  // Start attempt
  const r13 = await jsonFetch('/api/fast-english/placement/attempts/start', {
    method: 'POST',
    headers: { authorization: activeToken },
  });
  check(r13.status === 201 || r13.status === 200, `S13a: start (${r13.status})`);

  const attemptId = r13.body?.attempt?.id;
  const allQ = r13.body?.questions || [];

  if (r13.body?.questions) {
    const positions = r13.body.questions.map((q) => q.position);
    const sorted = [...positions].sort((a, b) => a - b);
    check(JSON.stringify(positions) === JSON.stringify(sorted), 'S13b: ordered');
    check(positions[0] === 1 && positions[19] === 20, 'S13c: 1-20');
  }

  // S14: No answer keys
  const respStr = JSON.stringify(r13.body);
  let leak = false;
  for (const k of ANSWER_KEYS) {
    if (respStr.includes(k)) {
      console.error(`  LEAK: "${k}"`);
      leak = true;
    }
  }
  check(!leak, 'S14: no answer keys');

  // S15: Direct question list denied
  const r15 = await jsonFetch('/api/collections/placement_questions/records', {
    headers: { authorization: activeToken },
  });
  check(r15.status === 403, `S15: question list (${r15.status})`);

  // S20: 20 questions
  check(allQ.length === 20, `S20: ${allQ.length} questions`);

  // Answer first question (revision starts at 1)
  if (attemptId && allQ[0]) {
    const q1 = allQ[0];
    const r25 = await jsonFetch(`/api/fast-english/placement/attempts/${attemptId}/answer`, {
      method: 'PUT',
      headers: { authorization: activeToken, 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: q1.id, optionId: q1.options[0].id, expectedRevision: 1 }),
    });
    check(r25.status === 200, `S25: answer saves (${r25.status})`);
    check(r25.body?.attempt?.revision === 2, `S26: revision=2 (${r25.body?.attempt?.revision})`);

    // S27: Invalid question
    const r27 = await jsonFetch(`/api/fast-english/placement/attempts/${attemptId}/answer`, {
      method: 'PUT',
      headers: { authorization: activeToken, 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 'nonexistent', optionId: 'a', expectedRevision: 2 }),
    });
    check(r27.status >= 400, `S27: invalid question (${r27.status})`);

    // S28: Invalid option
    const r28 = await jsonFetch(`/api/fast-english/placement/attempts/${attemptId}/answer`, {
      method: 'PUT',
      headers: { authorization: activeToken, 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: q1.id, optionId: 'nonexistent', expectedRevision: 2 }),
    });
    check(r28.status >= 400, `S28: invalid option (${r28.status})`);

    // S30: Stale revision
    const r30 = await jsonFetch(`/api/fast-english/placement/attempts/${attemptId}/answer`, {
      method: 'PUT',
      headers: { authorization: activeToken, 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: q1.id, optionId: q1.options[0].id, expectedRevision: 1 }),
    });
    check(
      r30.status === 409 && r30.body?.code === 'placement_attempt_stale',
      `S30: stale (${r30.status})`,
    );

    // S22: Resume
    const r22 = await jsonFetch('/api/fast-english/placement/attempts/start', {
      method: 'POST',
      headers: { authorization: activeToken },
    });
    check(r22.body?.answers?.[q1.id] === q1.options[0].id, 'S22: resume persisted');
    check(r22.body?.attempt?.id === attemptId, 'S17: same attempt ID');

    // S33: No answer keys in save
    const saveStr = JSON.stringify(r25.body);
    let saveLeak = false;
    for (const k of ANSWER_KEYS) {
      if (saveStr.includes(k)) saveLeak = true;
    }
    check(!saveLeak, 'S33: no answer keys');
  }

  // Answer remaining (revision 2 after 1st, answer 19 more -> revision = 2+19 = 21)
  let rev = 2;
  for (let i = 1; i < allQ.length; i++) {
    if (!allQ[i]) continue;
    const r = await jsonFetch(`/api/fast-english/placement/attempts/${attemptId}/answer`, {
      method: 'PUT',
      headers: { authorization: activeToken, 'content-type': 'application/json' },
      body: JSON.stringify({
        questionId: allQ[i].id,
        optionId: allQ[i].options[0].id,
        expectedRevision: rev,
      }),
    });
    if (r.status === 200) rev = r.body?.attempt?.revision || rev + 1;
  }
  check(rev === 21, `S35: all answered (rev ${rev})`);

  // Submit - expected revision = current revision = 21
  const r37 = await jsonFetch(`/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: activeToken, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedRevision: rev }),
  });
  check(r37.status === 200, `S37: submit (${r37.status})`);
  check(r37.body?.kind === 'submitted', 'S37: submitted');
  check(typeof r37.body?.attempt?.score === 'number', `S38: score (${r37.body?.attempt?.score})`);
  check(r37.body?.attempt?.maxScore === 20, 'S39: maxScore 20');
  check(!!r37.body?.attempt?.submittedAt, 'S40: submittedAt');

  const subStr = JSON.stringify(r37.body);
  let subLeak = false;
  for (const k of ANSWER_KEYS) {
    if (subStr.includes(k)) subLeak = true;
  }
  check(!subLeak, 'S41: no keys in submit');

  // S42: Repeated submit
  const r42 = await jsonFetch(`/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: activeToken, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedRevision: rev }),
  });
  check(r42.status === 200, 'S42: repeated 200');
  check(r42.body?.attempt?.score === r37.body?.attempt?.score, 'S42: same score');
  check(r42.body?.attempt?.submittedAt === r37.body?.attempt?.submittedAt, 'S43: same ts');

  // S46: Cannot edit after submit
  const r46 = await jsonFetch(`/api/fast-english/placement/attempts/${attemptId}/answer`, {
    method: 'PUT',
    headers: { authorization: activeToken, 'content-type': 'application/json' },
    body: JSON.stringify({ questionId: allQ[0]?.id || '', optionId: 'a', expectedRevision: 21 }),
  });
  check(r46.status >= 400, `S46: no edit (${r46.status})`);

  // S24: Direct attempt CRUD
  const r24 = await jsonFetch('/api/collections/placement_attempts/records', {
    headers: { authorization: activeToken },
  });
  check(r24.status === 403, `S24: attempt list (${r24.status})`);

  const fail = total - passed;
  console.log(`\n=== Results: ${passed}/${total} passed, ${fail} failed ===\n`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
