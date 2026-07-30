// scripts/smoke-placement-capacity.mjs
// Phase 2 Closure — Snapshot capacity proof.
//
// Proves that the question_snapshot_text field (max 70000 after migration)
// can store the worst-case accepted question model:
//   20 questions × (500-char prompt + 2000-char options + metadata)
//
// Run: node scripts/smoke-placement-capacity.mjs

import { randomBytes } from 'node:crypto';
import { ok } from 'node:assert';

const PB_URL = process.env.PB_SMOKE_URL || '';
if (!PB_URL) {
  console.error(
    'PB_SMOKE_URL not set. Run via: bash scripts/smoke-placement.sh node scripts/smoke-placement-capacity.mjs',
  );
  process.exit(1);
}
const SU_EMAIL = process.env.PB_TEST_SU_EMAIL || '';
const SU_PASS = process.env.PB_TEST_SU_PASSWORD || '';
if (!SU_EMAIL || !SU_PASS) {
  console.error('PB_TEST_SU_EMAIL/PASSWORD not set.');
  process.exit(1);
}

let phoneCounter = 0;
function nextPhone() {
  const tail = String(phoneCounter++).padStart(2, '0');
  const rand = randomBytes(4).readUInt32BE(0) % 10_000_000;
  const mid = String(rand).padStart(7, '0');
  return `09${mid}${tail}`.slice(0, 11);
}

async function jsonFetch(url, init = {}) {
  const headers = { 'content-type': 'application/json' };
  if (init.headers) Object.assign(headers, init.headers);
  const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

// Generate the maximum-permitted question content
const MAX_PROMPT_CHARS = 500;
const MAX_OPTIONS_TEXT_CHARS = 2000;

function makeMaxQuestions(count) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const prompt = 'X'.repeat(MAX_PROMPT_CHARS);
    // Build options that fill ~2000 chars when serialized
    const optId = ['a', 'b', 'c', 'd', 'e', 'f'];
    // 6 options: each needs id (2-3 chars) + text
    // JSON: [{"id":"a","text":"..."},...]
    // Target: total must fit within 2000 chars
    const perOptText = Math.floor((MAX_OPTIONS_TEXT_CHARS - 50) / 6);
    const options = optId.map((id) => ({
      id,
      text: 'Y'.repeat(perOptText),
    }));
    // Verify options_text fits within limit
    const serialized = JSON.stringify(options);
    if (serialized.length > MAX_OPTIONS_TEXT_CHARS) {
      // Trim the last option's text to fit
      const excess = serialized.length - MAX_OPTIONS_TEXT_CHARS;
      options[5].text = options[5].text.slice(0, options[5].text.length - excess - 5);
    }
    result.push({
      key: `cap${String(i).padStart(2, '0')}`,
      version: 1,
      position: i + 1,
      prompt,
      options,
      correct: 'a',
    });
  }
  return result;
}

const MAX_QUESTIONS = makeMaxQuestions(20);

// 1. Setup
const suEmail = SU_EMAIL;
const suPass = SU_PASS;
const suAuth = await jsonFetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
  method: 'POST',
  body: JSON.stringify({ identity: suEmail, password: suPass }),
});
ok(suAuth.body.token, 'superuser token');
const suToken = suAuth.body.token;

// Remove existing active questions
const existing = await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
  headers: { authorization: `Bearer ${suToken}` },
});
if (Array.isArray(existing.body?.items)) {
  for (const q of existing.body.items) {
    await jsonFetch(`${PB_URL}/api/collections/placement_questions/records/${q.id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${suToken}` },
      body: JSON.stringify({ is_active: false }),
    });
  }
}

// Seed max-content questions
for (const q of MAX_QUESTIONS) {
  const optsText = JSON.stringify(q.options);
  ok(
    optsText.length <= MAX_OPTIONS_TEXT_CHARS,
    `options_text for Q${q.position} exceeds max: ${optsText.length} > ${MAX_OPTIONS_TEXT_CHARS}`,
  );

  const r = await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${suToken}` },
    body: JSON.stringify({
      question_key: q.key,
      version: q.version,
      position: q.position,
      prompt: q.prompt,
      options: q.options,
      options_text: optsText,
      correct_option_id: q.correct,
      is_active: true,
    }),
  });
  ok(r.status === 200, `seed Q${q.position} failed: ${r.status}`);
  console.log(
    `  Q${q.position}: prompt=${q.prompt.length} chars, options_text=${optsText.length} chars`,
  );
}

// Create student + subscription
const opPhone = nextPhone();
const opR = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
  method: 'POST',
  body: JSON.stringify({
    name: 'Op',
    phone: opPhone,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  }),
});
ok(opR.status === 200, 'op signup');
const opBody = opR.body;
const opCanonicalPhone = opBody.phone || opPhone;
await jsonFetch(`${PB_URL}/api/collections/fep_users/records/${opBody.id}`, {
  method: 'PATCH',
  headers: { authorization: `Bearer ${suToken}` },
  body: JSON.stringify({ role: 'operator', account_status: 'active' }),
});
const opLogin = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
  method: 'POST',
  body: JSON.stringify({ identity: opCanonicalPhone, password: 'Test1234!' }),
});
ok(opLogin.status === 200, 'op login');
const opToken = opLogin.body.token;

const phone = nextPhone();
const signup = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
  method: 'POST',
  body: JSON.stringify({ name: 'Cap', phone, password: 'Test1234!', passwordConfirm: 'Test1234!' }),
});
ok(signup.status === 200, 'signup');
const signupBody = signup.body;
const canonicalPhone = signupBody.phone || phone;
const loginR = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
  method: 'POST',
  body: JSON.stringify({ identity: canonicalPhone, password: 'Test1234!' }),
});
ok(loginR.status === 200, 'login');
const userToken = loginR.body.token;

await jsonFetch(`${PB_URL}/api/collections/payment_destination/records`, {
  method: 'POST',
  headers: { authorization: `Bearer ${suToken}` },
  body: JSON.stringify({
    card_number: '0000000000000000',
    card_holder_name: 'TEST',
    bank_name: 'TEST',
    is_active: true,
  }),
});
const planR = await jsonFetch(`${PB_URL}/api/collections/plans/records`, {
  method: 'POST',
  headers: { authorization: `Bearer ${suToken}` },
  body: JSON.stringify({
    name: 'T',
    slug: `cap-${randomBytes(3).toString('hex')}`,
    duration_days: 90,
    price_toman: 100000,
    is_active: true,
  }),
});
const planId = planR.body.id;
const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);
const boundary = `----FormBoundary${randomBytes(6).toString('hex')}`;
const reqBody = Buffer.concat([
  Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="receipt.png"\r\nContent-Type: image/png\r\n\r\n`,
  ),
  pngBytes,
  Buffer.from(
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${planId}\r\n--${boundary}--\r\n`,
  ),
]);
const prR = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${userToken}`,
    'content-type': `multipart/form-data; boundary=${boundary}`,
  },
  body: reqBody,
});
const prText = await prR.text();
let prBody;
try {
  prBody = JSON.parse(prText);
} catch {
  prBody = { _raw: prText };
}
ok(prR.status === 201, `PR: ${prR.status}`);
const prId = prBody.request?.id;
await jsonFetch(`${PB_URL}/api/fast-english/operator/payment-requests/${prId}/approve`, {
  method: 'POST',
  headers: { authorization: `Bearer ${opToken}` },
});
const refreshR = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
  method: 'POST',
  headers: { authorization: `Bearer ${userToken}` },
});
ok(refreshR.status === 200, 'refresh');
const freshToken = refreshR.body.token;

// 2. Start attempt
const startR = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
  method: 'POST',
  headers: { authorization: `Bearer ${freshToken}` },
});
ok(startR.status === 201, `start: ${startR.status}`);
const questions = startR.body.questions || [];
ok(questions.length === 20, `expected 20 questions, got ${questions.length}`);

// 3. Verify all prompts and options survived
for (const q of questions) {
  ok(q.prompt, `Q${q.position} prompt missing`);
  ok(q.prompt.length <= MAX_PROMPT_CHARS, `Q${q.position} prompt truncated: ${q.prompt.length}`);
  ok(q.options.length >= 2, `Q${q.position} has < 2 options`);
  for (const opt of q.options) {
    ok(opt.id, `Q${q.position} option missing id`);
    ok(opt.text, `Q${q.position} option missing text`);
  }
}

// 4. Verify snapshot text is under the new limit
const resumeR = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
  method: 'POST',
  headers: { authorization: `Bearer ${freshToken}` },
});
ok(resumeR.status === 200, `resume: ${resumeR.status}`);

// Read the snapshot from the database directly
const attemptRec = await jsonFetch(
  `${PB_URL}/api/collections/placement_attempts/records/${resumeR.body.attempt.id}`,
  {
    headers: { authorization: `Bearer ${suToken}` },
  },
);
const snapshotText = attemptRec.body?.question_snapshot_text || '';
console.log(`\nSnapshot serialized length: ${snapshotText.length} chars`);
console.log(`Field max: 70000 chars`);

// Verify 70000 is sufficient for all content
ok(snapshotText.length > 0, 'snapshot text is empty');
ok(snapshotText.length < 70000, `snapshot exceeds 70000: ${snapshotText.length}`);

// Parse and verify structure
const snapshot = JSON.parse(snapshotText);
ok(Array.isArray(snapshot), 'snapshot is array');
ok(snapshot.length === 20, `snapshot has ${snapshot.length} entries`);

// Verify each question's content is intact
for (const sq of snapshot) {
  ok(
    sq.prompt && sq.prompt.length === MAX_PROMPT_CHARS,
    `snapshot prompt wrong length: ${sq.prompt?.length}`,
  );
  ok(Array.isArray(sq.options), `Q${sq.position} options missing`);
  ok(sq.options.length >= 2, `Q${sq.position} has < 2 options`);
}

// 5. Answer all questions and submit to verify grading still works
let rev = resumeR.body.attempt.revision;
for (const q of questions) {
  const ans = await jsonFetch(
    `${PB_URL}/api/fast-english/placement/attempts/${resumeR.body.attempt.id}/answer`,
    {
      method: 'PUT',
      headers: { authorization: `Bearer ${freshToken}` },
      body: JSON.stringify({ questionId: q.id, optionId: q.options[0].id, expectedRevision: rev }),
    },
  );
  ok(ans.status === 200, `answer Q${q.position}: ${ans.status}`);
  rev = ans.body.attempt.revision;
}
const submit = await jsonFetch(
  `${PB_URL}/api/fast-english/placement/attempts/${resumeR.body.attempt.id}/submit`,
  {
    method: 'POST',
    headers: { authorization: `Bearer ${freshToken}` },
    body: JSON.stringify({ expectedRevision: rev }),
  },
);
ok(submit.status === 200, `submit: ${submit.status}`);
ok(submit.body.kind === 'submitted', `kind: ${submit.body.kind}`);
ok(submit.body.attempt.score === 20, `score: ${submit.body.attempt.score}`);

console.log('\n--- capacity test PASS ---');
console.log('Maximum-content questions created, snapshot stored, answers saved, grading works.');
