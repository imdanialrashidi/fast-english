// scripts/smoke-placement-race.mjs
// Phase 2 Closure — Multi-tab answer-race test.
//
// Proves that:
//   1. Two simultaneous answer saves with the same expectedRevision
//      produce exactly one winner (HTTP 200) and one loser (HTTP 409).
//   2. Revision becomes N+1, not N+2.
//   3. Only the winner's answer is stored.
//   4. No existing answers are lost.
//   5. Resume returns the authoritative winner state.
//   6. Retrying the loser with the new revision succeeds.
//   7. Both answers exist after the correct retry.
//
// Run: bash scripts/smoke-placement.sh node scripts/smoke-placement-race.mjs

import { randomBytes } from 'node:crypto';
import { ok } from 'node:assert';

const PB_URL = process.env.PB_SMOKE_URL || '';
if (!PB_URL) {
  console.error(
    'PB_SMOKE_URL not set. Run via: bash scripts/smoke-placement.sh node scripts/smoke-placement-race.mjs',
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

async function jf(url, init = {}) {
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
  return { s: res.status, b: body };
}

// 1. Superuser auth
const suAuth = await jf(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
  method: 'POST',
  body: JSON.stringify({ identity: SU_EMAIL, password: SU_PASS }),
});
ok(suAuth.s === 200 && suAuth.b.token, 'superuser token');
const suToken = suAuth.b.token;

// Seed 20 questions
console.log('Seeding 20 questions...');
for (let i = 0; i < 20; i++) {
  const r = await jf(`${PB_URL}/api/collections/placement_questions/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${suToken}` },
    body: JSON.stringify({
      question_key: `race${String(i).padStart(2, '0')}`,
      version: 1,
      position: i + 1,
      prompt: i < 18 ? `Filler Q${i + 1}` : i === 18 ? 'Race target Q1' : 'Race target Q2',
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      options_text: JSON.stringify([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ]),
      correct_option_id: 'a',
      is_active: true,
    }),
  });
  ok(r.s === 200, `seed Q${i}: ${r.s} ${JSON.stringify(r.b).slice(0, 100)}`);
}

// Deactivate any pre-existing questions that might interfere
const existing = await jf(`${PB_URL}/api/collections/placement_questions/records`, {
  headers: { authorization: `Bearer ${suToken}` },
});
if (Array.isArray(existing.b?.items)) {
  for (const q of existing.b.items) {
    if (q.is_active && !q.question_key?.startsWith('race')) {
      await jf(`${PB_URL}/api/collections/placement_questions/records/${q.id}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${suToken}` },
        body: JSON.stringify({ is_active: false }),
      });
    }
  }
}
console.log('Questions ready');

// Create operator + student + subscription
const opPhone = nextPhone();
const opR = await jf(`${PB_URL}/api/collections/fep_users/records`, {
  method: 'POST',
  body: JSON.stringify({
    name: 'Op',
    phone: opPhone,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  }),
});
ok(opR.s === 200, `op signup: ${opR.s}`);
const opCanPhone = opR.b.phone || opPhone;
await jf(`${PB_URL}/api/collections/fep_users/records/${opR.b.id}`, {
  method: 'PATCH',
  headers: { authorization: `Bearer ${suToken}` },
  body: JSON.stringify({ role: 'operator', account_status: 'active' }),
});
const opLog = await jf(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
  method: 'POST',
  body: JSON.stringify({ identity: opCanPhone, password: 'Test1234!' }),
});
ok(opLog.s === 200, 'op login');
const opToken = opLog.b.token;

const stuPhone = nextPhone();
const signupR = await jf(`${PB_URL}/api/collections/fep_users/records`, {
  method: 'POST',
  body: JSON.stringify({
    name: 'Race Stu',
    phone: stuPhone,
    password: 'Test1234!',
    passwordConfirm: 'Test1234!',
  }),
});
ok(signupR.s === 200, `stu signup: ${signupR.s}`);
const canonicalPhone = signupR.b.phone || stuPhone;
const loginR = await jf(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
  method: 'POST',
  body: JSON.stringify({ identity: canonicalPhone, password: 'Test1234!' }),
});
ok(loginR.s === 200, 'student login');
const userToken = loginR.b.token;

await jf(`${PB_URL}/api/collections/payment_destination/records`, {
  method: 'POST',
  headers: { authorization: `Bearer ${suToken}` },
  body: JSON.stringify({
    card_number: '0000000000000000',
    card_holder_name: 'T',
    bank_name: 'T',
    is_active: true,
  }),
});
const planR = await jf(`${PB_URL}/api/collections/plans/records`, {
  method: 'POST',
  headers: { authorization: `Bearer ${suToken}` },
  body: JSON.stringify({
    name: 'T',
    slug: `race-${randomBytes(3).toString('hex')}`,
    duration_days: 90,
    price_toman: 100000,
    is_active: true,
  }),
});
ok(planR.s === 200, `plan: ${planR.s}`);
const planId = planR.b.id;

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);
const boundary = `----FR${randomBytes(4).toString('hex')}`;
const prBodyReq = Buffer.concat([
  Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="r.png"\r\nContent-Type: image/png\r\n\r\n`,
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
  body: prBodyReq,
});
const prText = await prR.text();
let prBody;
try {
  prBody = JSON.parse(prText);
} catch {
  prBody = { _raw: prText };
}
ok(prR.status === 201, `PR: ${prR.status} ${prText.slice(0, 100)}`);
const prId = prBody.request?.id || prBody.id;
ok(prId, 'PR id');

const approveR = await jf(`${PB_URL}/api/fast-english/operator/payment-requests/${prId}/approve`, {
  method: 'POST',
  headers: { authorization: `Bearer ${opToken}` },
});
ok(approveR.s === 200, `approve: ${approveR.s}`);

const refreshR = await jf(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
  method: 'POST',
  headers: { authorization: `Bearer ${userToken}` },
});
ok(refreshR.s === 200, 'refresh');
const freshToken = refreshR.b.token;

// 2. Start attempt
const startR = await jf(`${PB_URL}/api/fast-english/placement/attempts/start`, {
  method: 'POST',
  headers: { authorization: `Bearer ${freshToken}` },
});
ok(startR.s === 201, `start: ${startR.s} ${JSON.stringify(startR.b).slice(0, 100)}`);
const attemptId = startR.b.attempt?.id;
ok(attemptId, 'attempt id');
const questions = startR.b.questions || [];
ok(questions.length === 20, `questions: ${questions.length}`);
let rev = startR.b.attempt?.revision;
ok(rev >= 1, `initial revision: ${rev}`);
console.log(`Initial revision: ${rev}`);

// 3. Answer first 18 questions
for (let i = 0; i < 18; i++) {
  const q = questions[i];
  const ans = await jf(`${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${freshToken}` },
    body: JSON.stringify({ questionId: q.id, optionId: q.options[0].id, expectedRevision: rev }),
  });
  ok(ans.s === 200, `filler answer ${i}: ${ans.s}`);
  rev = ans.b.attempt?.revision;
  ok(rev > 0, `rev after ${i}: ${rev}`);
}
console.log(`Revision after 18 answers: ${rev} (started at ${startR.b.attempt.revision})`);

// 4. The race: send two simultaneous answers for Q19 both with current revision
const qRace = questions[19];
const raceAtRev = rev; // capture current revision for both race requests
console.log(`Race: two simultaneous requests for Q19 with expectedRevision=${raceAtRev}`);

const raceReqs = [
  jf(`${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${freshToken}` },
    body: JSON.stringify({
      questionId: qRace.id,
      optionId: qRace.options[0].id,
      expectedRevision: raceAtRev,
    }),
  }),
  jf(`${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${freshToken}` },
    body: JSON.stringify({
      questionId: qRace.id,
      optionId: qRace.options[1].id,
      expectedRevision: raceAtRev,
    }),
  }),
];
const raceResults = await Promise.all(raceReqs);

// 5. Verify: exactly one 200, one 409
const statuses = raceResults.map((r) => r.s);
const count200 = statuses.filter((s) => s === 200).length;
const count409 = statuses.filter((s) => s === 409).length;
ok(count200 === 1, `expected 1×200, got ${JSON.stringify(statuses)}`);
ok(count409 === 1, `expected 1×409, got ${JSON.stringify(statuses)}`);
console.log(`Race result: ${JSON.stringify(statuses)}`);

const winnerIdx = raceResults.findIndex((r) => r.s === 200);
const loserIdx = raceResults.findIndex((r) => r.s === 409);
ok(winnerIdx >= 0 && loserIdx >= 0, 'winner and loser identified');

// 6. Revision becomes N+1, not N+2
const newRev = raceResults[winnerIdx].b.attempt?.revision;
ok(newRev === raceAtRev + 1, `expected revision ${raceAtRev + 1}, got ${newRev}`);
console.log(`Winner revision: ${newRev} = ${raceAtRev} + 1`);

// 7. Only winner's answer stored
const resumeR = await jf(`${PB_URL}/api/fast-english/placement/attempts/start`, {
  method: 'POST',
  headers: { authorization: `Bearer ${freshToken}` },
});
ok(resumeR.s === 200, `resume: ${resumeR.s}`);
const resumeAns = resumeR.b.answers || {};
const winnerOpt = [qRace.options[0].id, qRace.options[1].id][winnerIdx];
const loserOpt = [qRace.options[0].id, qRace.options[1].id][loserIdx];
ok(
  resumeAns[qRace.id] === winnerOpt,
  `winner answer saved: expected ${winnerOpt}, got ${resumeAns[qRace.id]}`,
);
ok(resumeAns[qRace.id] !== loserOpt, 'loser answer NOT saved');
console.log(`Winner answer (${winnerOpt}) stored, loser (${loserOpt}) rejected`);

// 8. Retry loser with new revision
const retryR = await jf(`${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`, {
  method: 'PUT',
  headers: { authorization: `Bearer ${freshToken}` },
  body: JSON.stringify({ questionId: qRace.id, optionId: loserOpt, expectedRevision: newRev }),
});
ok(retryR.s === 200, `retry: ${retryR.s}`);
const finalRev = retryR.b.attempt?.revision;
ok(finalRev === newRev + 1, `final revision ${newRev + 1}, got ${finalRev}`);
console.log(`Loser retry succeeded, revision ${finalRev}`);

// 9. Both answers exist (Q18 had first answer from filler, Q19 has loser retry)
const finalResume = await jf(`${PB_URL}/api/fast-english/placement/attempts/start`, {
  method: 'POST',
  headers: { authorization: `Bearer ${freshToken}` },
});
ok(finalResume.s === 200, `final resume: ${finalResume.s}`);
const finalAns = finalResume.b.answers || {};
// Verify the race-relevant answers (18 fillers + race target = 19 unique)
ok(
  finalAns[qRace.id] === loserOpt,
  `loser retry persisted: expected ${loserOpt}, got ${finalAns[qRace.id]}`,
);
let answeredCount = 0;
for (const k in finalAns) {
  if (finalAns.hasOwnProperty(k)) answeredCount++;
}
ok(answeredCount >= 19, `expected at least 19 unique answered, got ${answeredCount}`);
console.log(`${answeredCount} unique questions answered`);

console.log('\n=== multi-tab race PASS ===');
console.log(
  `Exactly one winner (200), one loser (409), revision ${raceAtRev}→${raceAtRev + 1} (not ${raceAtRev + 2}), no silent loss.`,
);
