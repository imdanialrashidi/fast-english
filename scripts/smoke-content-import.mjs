#!/usr/bin/env node
// scripts/smoke-content-import.mjs — Podcast Slice 3 importer smoke suite.
//
// Runs against a disposable PocketBase (wired via `pnpm smoke:content-import`
// → scripts/smoke-placement.sh on port 18096). Proves the 25 scenarios
// required by the slice brief (§26). Every scenario works on its own copy
// of the fixture package; every request carries a timeout; all test data
// is owned (randomized slugs/content keys).

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256Hex } from '../shared/content-package/checksums.ts';
import { makeMp3, writeFixturePackage } from './content/fixtures.mjs';
import { validatePackage } from './content/parser.mjs';
import { generateTemplate } from './content/template.mjs';
import {
  createActiveStudent,
  fetchJson,
  getLegacyOperatorToken,
  getSuperuserToken,
  randomId,
} from './smoke-common.mjs';

const URL = process.env.PB_SMOKE_URL;
const DATA_DIR = process.env.PB_DATA_DIR;

let total = 0;
let passed = 0;
let failed = 0;
function scenario(name, fn) {
  total++;
  const label = `  ${String(total).padStart(2, '0')}. ${name}`;
  try {
    fn();
    passed++;
    console.log(`PASS ${label}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${label}`);
    console.log(`       ${err?.message ? err.message : String(err)}`);
  }
}
async function aScenario(name, fnPromise) {
  total++;
  const label = `  ${String(total).padStart(2, '0')}. ${name}`;
  try {
    await fnPromise();
    passed++;
    console.log(`PASS ${label}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${label}`);
    console.log(`       ${err?.message ? err.message : String(err)}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------
const WORK = mkdtempSync(join(tmpdir(), 'fep-content-import-'));
const basePkg = writeFixturePackage(WORK, `base-${randomId()}`);

function freshPackage() {
  const dir = join(WORK, `pkg-${randomId()}`);
  cpSync(basePkg.dir, dir, { recursive: true });
  return { dir, manifest: JSON.parse(readFileSync(join(dir, 'episode.json'), 'utf8')) };
}

function manifestOf(dir) {
  return JSON.parse(readFileSync(join(dir, 'episode.json'), 'utf8'));
}

function writeManifest(dir, manifest) {
  writeFileSync(join(dir, 'episode.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function countStoredFiles() {
  if (!DATA_DIR || !existsSync(join(DATA_DIR, 'storage'))) return 0;
  let n = 0;
  for (const coll of readdirSync(join(DATA_DIR, 'storage'))) {
    const collDir = join(DATA_DIR, 'storage', coll);
    if (!statSync(collDir).isDirectory()) continue;
    for (const rec of readdirSync(collDir)) {
      const recDir = join(collDir, rec);
      if (!statSync(recDir).isDirectory()) continue;
      for (const f of readdirSync(recDir)) {
        if (statSync(join(recDir, f)).isFile() && f !== '.gitkeep') n++;
      }
    }
  }
  return n;
}

// One staff record with known credentials for the whole suite.
async function staffFixture(su) {
  const email = `ci-staff-${randomId()}@fep-smoke.invalid`;
  const password = 'Test1234!';
  const s = await fetchJson(URL, '/api/collections/staff_admins/records', {
    method: 'POST',
    headers: { authorization: su },
    body: JSON.stringify({
      email,
      password,
      passwordConfirm: password,
      display_name: 'CI Staff',
      is_active: true,
      verified: true,
    }),
  });
  if (!s.body?.id) throw new Error(`staff fixture: ${JSON.stringify(s.body).slice(0, 200)}`);
  const login = await fetchJson(URL, '/api/collections/staff_admins/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: email, password }),
  });
  if (login.status !== 200) throw new Error('staff login failed');
  return { email, password, token: login.body.token };
}

function declaredAssetPaths(manifest) {
  const paths = [manifest.episode.artworkSquare];
  if (manifest.episode.heroImageWide) paths.push(manifest.episode.heroImageWide);
  for (const v of manifest.variants) {
    paths.push(v.audio, v.transcript);
    for (const e of v.vocabulary) if (e.pronunciationAudio) paths.push(e.pronunciationAudio);
  }
  return paths;
}

// Full CLI-like plan + execute. When `raw` is set, local validation is
// skipped (server-only rejection tests: the CLI would normally block first).
async function planAndImport(_su, staffToken, dir, { raw = false } = {}) {
  const manifest = manifestOf(dir);
  const paths = declaredAssetPaths(manifest);
  const assets = paths.map((p) => {
    const bytes = readFileSync(join(dir, p));
    return { path: p, sizeBytes: bytes.length, sha256: sha256Hex(bytes) };
  });
  const manifestText = readFileSync(join(dir, 'episode.json'), 'utf8');

  if (!raw) {
    const result = await validatePackage(dir);
    if (!result.valid || !result.package) {
      throw new Error(`local validation failed: ${result.errors.map((e) => e.code).join(',')}`);
    }
  }

  const planRes = await fetchJson(URL, '/api/fast-english/staff/content-import/plan', {
    method: 'POST',
    headers: { authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ manifest: manifestText, assets, fingerprint: 'x' }),
  });
  if (planRes.status !== 200) {
    return { planStatus: planRes.status, plan: planRes.body, execStatus: null, exec: null };
  }

  const boundary = `--FepSmoke${randomId()}`;
  const parts = [
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n${manifestText}\r\n`,
    ),
  ];
  for (const p of [...paths].sort()) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${p}"; filename="${p.split('/').pop()}"\r\nContent-Type: ${p.endsWith('.md') ? 'text/markdown' : p.endsWith('.mp3') ? 'audio/mpeg' : 'image/png'}\r\n\r\n`,
      ),
    );
    parts.push(readFileSync(join(dir, p)));
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const execRes = await fetch(
    `${URL}/api/fast-english/staff/content-import/execute?planStateHash=${encodeURIComponent(planRes.body.planStateHash)}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${staffToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: Buffer.concat(parts),
      signal: AbortSignal.timeout(60_000),
    },
  );
  const text = await execRes.text();
  let execBody;
  try {
    execBody = JSON.parse(text);
  } catch {
    execBody = { _raw: text.slice(0, 200) };
  }
  return {
    planStatus: planRes.status,
    plan: planRes.body,
    execStatus: execRes.status,
    exec: execBody,
  };
}

async function publishEpisode(su, topicId, variantIds) {
  const topicRes = await fetchJson(URL, `/api/collections/topics/records/${topicId}`, {
    method: 'PATCH',
    headers: { authorization: su },
    body: JSON.stringify({ status: 'published' }),
  });
  assert(
    topicRes.status === 200,
    `publish topic: ${topicRes.status} ${JSON.stringify(topicRes.body).slice(0, 200)}`,
  );
  for (const lessonId of Object.values(variantIds)) {
    const lr = await fetchJson(URL, `/api/collections/lessons/records/${lessonId}`, {
      method: 'PATCH',
      headers: { authorization: su },
      body: JSON.stringify({ status: 'published' }),
    });
    assert(
      lr.status === 200,
      `publish lesson: ${lr.status} ${JSON.stringify(lr.body).slice(0, 200)}`,
    );
  }
}

async function entitledStudent(su, level = 'B1') {
  const { token, userId } = await createActiveStudent(URL, su);
  await fetchJson(URL, `/api/collections/fep_users/records/${userId}`, {
    method: 'PATCH',
    headers: { authorization: su },
    body: JSON.stringify({
      placement_completed: true,
      suggested_level: level,
      selected_level: level,
    }),
  });
  const refresh = await fetchJson(URL, '/api/collections/fep_users/auth-refresh', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  return { token: refresh.body?.token || token, userId };
}

async function counts() {
  const [topics, lessons, vocab, audits, files] = await Promise.all([
    fetchJson(URL, '/api/collections/topics/records?perPage=200', {
      headers: { authorization: process.env.__CI_SU },
    }),
    fetchJson(URL, '/api/collections/lessons/records?perPage=200', {
      headers: { authorization: process.env.__CI_SU },
    }),
    fetchJson(URL, '/api/collections/lesson_vocabulary/records?perPage=500', {
      headers: { authorization: process.env.__CI_SU },
    }),
    fetchJson(URL, '/api/collections/content_imports/records?perPage=200', {
      headers: { authorization: process.env.__CI_SU },
    }),
    Promise.resolve(countStoredFiles()),
  ]);
  return {
    topics: topics.body.items.length,
    lessons: lessons.body.items.length,
    vocab: vocab.body.items.length,
    audits: audits.body.items.length,
    files,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
async function main() {
  const su = await getSuperuserToken(URL);
  scenario('superuser token available', () => assert(!!su, 'no token'));
  if (!su) process.exit(1);
  process.env.__CI_SU = su;
  const staff = await staffFixture(su);
  scenario('staff fixture created', () => assert(!!staff.token, 'no staff token'));

  // ---- 1. Valid Package validation (local pipeline) ----
  await aScenario('valid Package validates (PASS, deterministic fingerprint)', async () => {
    const r1 = await validatePackage(basePkg.dir);
    assert(r1.valid === true, `valid=${r1.valid} ${r1.errors.map((e) => e.code).join(',')}`);
    assert(r1.package.assets.length === 6, `assets=${r1.package.assets.length}`);
    assert(
      r1.package.assets.some((a) => a.durationSeconds === 1),
      'B1 duration missing',
    );
    const r2 = await validatePackage(basePkg.dir);
    assert(r1.package.fingerprint === r2.package.fingerprint, 'fingerprint not stable');
  });

  // ---- 2. Template Package fails (placeholders remain) ----
  await aScenario('template Package fails validation (placeholders + missing assets)', async () => {
    const slug = `tpl-${randomId()}`;
    generateTemplate(WORK, slug, {});
    const r = await validatePackage(join(WORK, slug));
    assert(r.valid === false, 'template package must be invalid');
    assert(
      r.errors.some((e) => e.code === 'PACKAGE_PATH_UNRESOLVABLE'),
      'missing assets not reported',
    );
  });

  // ---- 3. Plan produces zero mutation ----
  await aScenario('plan produces zero mutation', async () => {
    const before = await counts();
    const { dir } = freshPackage();
    const manifest = manifestOf(dir);
    const assets = declaredAssetPaths(manifest).map((p) => {
      const bytes = readFileSync(join(dir, p));
      return { path: p, sizeBytes: bytes.length, sha256: sha256Hex(bytes) };
    });
    const planRes = await fetchJson(URL, '/api/fast-english/staff/content-import/plan', {
      method: 'POST',
      headers: { authorization: `Bearer ${staff.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        manifest: readFileSync(join(dir, 'episode.json'), 'utf8'),
        assets,
        fingerprint: 'x',
      }),
    });
    assert(
      planRes.status === 200,
      `plan: ${planRes.status} ${JSON.stringify(planRes.body).slice(0, 200)}`,
    );
    assert(planRes.body.result === 'new', `result=${planRes.body.result}`);
    const after = await counts();
    assert(after.topics === before.topics, `topics ${before.topics} → ${after.topics}`);
    assert(after.lessons === before.lessons, `lessons ${before.lessons} → ${after.lessons}`);
    assert(after.vocab === before.vocab, `vocab ${before.vocab} → ${after.vocab}`);
    assert(after.audits === before.audits, `audits ${before.audits} → ${after.audits}`);
    assert(after.files === before.files, `files ${before.files} → ${after.files}`);
  });

  // ---- 4. New Episode import succeeds as Draft (full CLI path) ----
  let mainPkg = null;
  let topicId = '';
  let variantIds = {};
  await aScenario('new Episode import succeeds as Draft (CLI plan + execute)', async () => {
    mainPkg = freshPackage();
    const cli = spawnSync('node', ['scripts/content/cli.mjs', 'import', mainPkg.dir, '--yes'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FEP_PB_URL: URL,
        FEP_STAFF_EMAIL: staff.email,
        FEP_STAFF_PASSWORD: staff.password,
      },
      encoding: 'utf8',
      timeout: 90_000,
    });
    assert(
      cli.status === 0,
      `CLI exit=${cli.status} out=${cli.stdout.slice(-500)} err=${cli.stderr.slice(-200)}`,
    );
    assert(
      cli.stdout.includes('Import result'),
      `CLI did not print the import result: ${cli.stdout.slice(-300)}`,
    );
    assert(!cli.stdout.includes(staff.password), 'CLI leaked the password');
    // The CLI must not print transcript contents.
    assert(!cli.stdout.includes('fixture transcript'), 'CLI leaked transcript content');
  });

  // ---- 5. Category is reused ----
  await aScenario('Category is reused (no new categories created)', async () => {
    const cats = (
      await fetchJson(URL, '/api/collections/categories/records?perPage=200', {
        headers: { authorization: su },
      })
    ).body.items;
    assert(
      cats.some((c) => c.key === 'general'),
      'general category missing',
    );
    assert(cats.filter((c) => c.key === 'general').length === 1, 'general duplicated');
  });

  // ---- 6. Two Variants are created ----
  await aScenario('two Variants are created under the Episode', async () => {
    const key = mainPkg.manifest.contentKey;
    const topics = (
      await fetchJson(URL, '/api/collections/topics/records?perPage=200', {
        headers: { authorization: su },
      })
    ).body.items;
    const topic = topics.find((t) => t.content_key === key);
    assert(topic, 'imported topic missing');
    assert(topic.status === 'draft', `status=${topic.status}`);
    topicId = topic.id;
    const lessons = (
      await fetchJson(URL, '/api/collections/lessons/records?perPage=200', {
        headers: { authorization: su },
      })
    ).body.items.filter((l) => l.topic === topicId);
    assert(lessons.length === 2, `lessons=${lessons.length}`);
    for (const l of lessons) {
      assert(l.status === 'draft', `lesson status=${l.status}`);
      variantIds[l.level] = l.id;
    }
    assert(
      JSON.stringify(Object.keys(variantIds).sort()) === JSON.stringify(['B1', 'C1']),
      `levels=${Object.keys(variantIds)}`,
    );
  });

  // ---- 7. Vocabulary order preserved ----
  await aScenario('Vocabulary order is preserved (declared sort order)', async () => {
    const vocab = (
      await fetchJson(URL, '/api/collections/lesson_vocabulary/records?perPage=200', {
        headers: { authorization: su },
      })
    ).body.items.filter((v) => v.lesson === variantIds.B1);
    assert(vocab.length === 2, `vocab=${vocab.length}`);
    const ordered = [...vocab].sort((a, b) => a.sort_order - b.sort_order);
    assert(ordered[0].term === 'pyramid', `first=${ordered[0]?.term}`);
    assert(ordered[1].term === 'tomb', `second=${ordered[1]?.term}`);
  });

  // ---- 8. Audio durations extracted ----
  await aScenario('audio durations are extracted (authoritative, not from manifest)', async () => {
    const lesson = (
      await fetchJson(URL, `/api/collections/lessons/records/${variantIds.B1}`, {
        headers: { authorization: su },
      })
    ).body;
    assert(lesson.audio_duration_seconds === 1, `duration=${lesson.audio_duration_seconds}`);
    assert(Number(lesson.estimated_minutes) >= 1, 'estimated_minutes missing');
  });

  // ---- 9. Artwork files attached ----
  await aScenario('artwork files are attached to the Episode', async () => {
    const topic = (
      await fetchJson(URL, `/api/collections/topics/records/${topicId}`, {
        headers: { authorization: su },
      })
    ).body;
    assert(!!topic.artwork_square, 'artwork_square missing');
    assert(!!topic.hero_image_wide, 'hero_image_wide missing');
    assert(!!topic.artwork_alt_fa, 'artwork_alt_fa missing');
  });

  // ---- 10. Public Student APIs hide Draft content ----
  await aScenario('public Student APIs hide Draft content', async () => {
    const student = await entitledStudent(su, 'B1');
    const detail = await fetchJson(URL, `/api/fast-english/lessons/${variantIds.B1}`, {
      headers: { authorization: `Bearer ${student.token}` },
    });
    assert(detail.status === 404, `draft detail status=${detail.status}`);
    const list = await fetchJson(URL, '/api/fast-english/lessons', {
      headers: { authorization: `Bearer ${student.token}` },
    });
    assert(!(list.body?.lessons || []).some((l) => l.id === variantIds.B1), 'draft lesson listed');
  });

  // ---- 11. Same Package re-import returns no-change ----
  await aScenario('same Package re-import returns no-change', async () => {
    const out = await planAndImport(su, staff.token, mainPkg.dir);
    assert(
      out.execStatus === 200,
      `exec=${out.execStatus} ${JSON.stringify(out.exec).slice(0, 200)}`,
    );
    assert(out.exec.result === 'no_change', `result=${out.exec.result}`);
  });

  // ---- 11b. no_change imports are recorded in the audit history ----
  await aScenario('repeated import leaves a no_change audit record', async () => {
    const audits = (
      await fetchJson(URL, '/api/collections/content_imports/records?perPage=200', {
        headers: { authorization: su },
      })
    ).body.items;
    const nc = audits.filter(
      (a) => a.content_key === mainPkg.manifest.contentKey && a.status === 'no_change',
    );
    assert(nc.length >= 1, `no_change audits=${nc.length}`);
  });

  // ---- 11c. Execute without a plan state hash is rejected ----
  await aScenario(
    'execute without planStateHash is rejected (400 plan_state_required)',
    async () => {
      const manifestText = readFileSync(join(mainPkg.dir, 'episode.json'), 'utf8');
      const boundary = `--FepSmoke${randomId()}`;
      const res = await fetch(`${URL}/api/fast-english/staff/content-import/execute`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${staff.token}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        body: Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n${manifestText}\r\n--${boundary}--\r\n`,
        ),
        signal: AbortSignal.timeout(60_000),
      });
      const body = await res.json();
      assert(res.status === 400, `status=${res.status} ${JSON.stringify(body).slice(0, 200)}`);
      assert(body.code === 'plan_state_required', `code=${body.code}`);
    },
  );

  // ---- 11d. v1 → v2 → v2: the completed-fingerprint lookup is per version ----
  await aScenario(
    'v1 → v2 → v2 re-import is no_change (fingerprint lookup filtered by version)',
    async () => {
      const { dir } = freshPackage();
      const m = manifestOf(dir);
      m.episode.slug = `ver-${randomId()}`;
      m.contentKey = `general.${m.episode.slug}`;
      m.contentVersion = 1;
      writeManifest(dir, m);
      const v1 = await planAndImport(su, staff.token, dir);
      assert(
        v1.execStatus === 200 && v1.exec.result === 'completed',
        `v1: ${v1.execStatus} ${JSON.stringify(v1.exec).slice(0, 200)}`,
      );
      m.contentVersion = 2;
      m.episode.titleEn = `${m.episode.titleEn} v2`;
      writeManifest(dir, m);
      const v2 = await planAndImport(su, staff.token, dir);
      assert(
        v2.execStatus === 200 && v2.exec.result === 'completed',
        `v2: ${v2.execStatus} ${JSON.stringify(v2.exec).slice(0, 200)}`,
      );
      const again = await planAndImport(su, staff.token, dir);
      assert(
        again.execStatus === 200,
        `v2 again: ${again.execStatus} ${JSON.stringify(again.exec).slice(0, 200)}`,
      );
      assert(
        again.exec.result === 'no_change',
        `v2 again result=${again.exec.result} (false conflict)`,
      );
    },
  );

  // ---- 12. Same version/different fingerprint conflicts ----
  await aScenario('same version/different fingerprint conflicts', async () => {
    const { dir } = freshPackage();
    writeFileSync(join(dir, 'audio', 'b1.mp3'), makeMp3(41)); // different bytes
    const out = await planAndImport(su, staff.token, dir);
    assert(
      out.execStatus === 409,
      `exec=${out.execStatus} ${JSON.stringify(out.exec).slice(0, 300)}`,
    );
    assert(out.exec.code === 'import_conflict', `code=${out.exec.code}`);
  });

  // ---- 13. Higher version → Draft update behavior ----
  await aScenario('higher version produces Draft update behavior (published → draft)', async () => {
    await publishEpisode(su, topicId, variantIds);
    const m = manifestOf(mainPkg.dir);
    m.contentVersion = 2;
    m.episode.titleEn = 'Pyramids of Egypt — Updated';
    writeManifest(mainPkg.dir, m);
    const out = await planAndImport(su, staff.token, mainPkg.dir);
    assert(
      out.execStatus === 200,
      `exec=${out.execStatus} ${JSON.stringify(out.exec).slice(0, 300)}`,
    );
    assert(out.exec.result === 'completed', `result=${out.exec.result}`);

    const topic = (
      await fetchJson(URL, `/api/collections/topics/records/${topicId}`, {
        headers: { authorization: su },
      })
    ).body;
    assert(topic.status === 'draft', `topic must be draft after update, got ${topic.status}`);
    assert(topic.content_version === 2, `topic version=${topic.content_version}`);
    assert(topic.title === 'Pyramids of Egypt — Updated', 'title not updated');
    const lessons = (
      await fetchJson(
        URL,
        `/api/collections/lessons/records?filter=(topic='${topicId}')&perPage=10`,
        { headers: { authorization: su } },
      )
    ).body.items;
    for (const l of lessons) {
      assert(l.status === 'draft', `lesson ${l.level} must be draft, got ${l.status}`);
      assert(l.content_version === 2, `lesson ${l.level} version=${l.content_version}`);
    }
    variantIds = Object.fromEntries(lessons.map((l) => [l.level, l.id]));
  });

  // ---- 14. Lower version rejected ----
  await aScenario('lower version rejected (stale)', async () => {
    const m = manifestOf(mainPkg.dir);
    m.contentVersion = 1;
    writeManifest(mainPkg.dir, m);
    const out = await planAndImport(su, staff.token, mainPkg.dir);
    assert(
      out.execStatus === 409,
      `exec=${out.execStatus} ${JSON.stringify(out.exec).slice(0, 200)}`,
    );
    assert(out.exec.code === 'import_stale', `code=${out.exec.code}`);
  });

  // ---- 15. Failure during Episode creation rolls back ----
  await aScenario(
    'failure during Episode creation rolls back (audit failed, no orphans)',
    async () => {
      const { dir } = freshPackage();
      const m = manifestOf(dir);
      m.contentVersion = 3;
      m.episode.slug = `collide-${randomId()}`;
      m.contentKey = `general.${m.episode.slug}`;
      writeManifest(dir, m);
      // Occupy the slug with a different content key → unique violation at topic save.
      await fetchJson(URL, '/api/collections/topics/records', {
        method: 'POST',
        headers: { authorization: su },
        body: JSON.stringify({
          title: 'Collider',
          slug: m.episode.slug,
          description: 'd',
          sort_order: 1,
          status: 'draft',
          content_key: `${m.contentKey}-other`,
        }),
      });
      const beforeFiles = countStoredFiles();
      const out = await planAndImport(su, staff.token, dir);
      assert(
        out.execStatus === 400,
        `exec=${out.execStatus} ${JSON.stringify(out.exec).slice(0, 300)}`,
      );
      assert(out.exec.code === 'import_failed', `code=${out.exec.code}`);
      assert(countStoredFiles() === beforeFiles, 'files were left behind after rollback');
      const topics = (
        await fetchJson(URL, '/api/collections/topics/records?perPage=200', {
          headers: { authorization: su },
        })
      ).body.items;
      assert(!topics.some((t) => t.content_key === m.contentKey), 'episode record left behind');
    },
  );

  // ---- 16. Failure during a Variant stage leaves no partial state ----
  await aScenario('failure during a Variant stage leaves no partial state', async () => {
    const { dir } = freshPackage();
    const m = manifestOf(dir);
    m.episode.slug = `stage-${randomId()}`;
    m.contentKey = `general.${m.episode.slug}`;
    writeManifest(dir, m);
    // Corrupt the C1 audio: local validation also fails — this scenario
    // proves the server path rejects it and nothing is written.
    writeFileSync(join(dir, 'audio', 'c1.mp3'), Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]));
    const before = await counts();
    const out = await planAndImport(su, staff.token, dir, { raw: true });
    assert(
      out.execStatus === 400,
      `exec=${out.execStatus} ${JSON.stringify(out.exec).slice(0, 300)}`,
    );
    assert(JSON.stringify(out.exec).includes('AUDIO_DURATION_UNREADABLE'), 'wrong error code');
    const after = await counts();
    assert(after.topics === before.topics, `topics ${before.topics} → ${after.topics}`);
    assert(after.lessons === before.lessons, `lessons ${before.lessons} → ${after.lessons}`);
    assert(after.vocab === before.vocab, `vocab ${before.vocab} → ${after.vocab}`);
    assert(after.files === before.files, `files ${before.files} → ${after.files}`);
  });

  // ---- 17. Retry after failed import succeeds ----
  await aScenario('retry after failed import succeeds', async () => {
    const { dir } = freshPackage();
    const m = manifestOf(dir);
    m.episode.slug = `retry-${randomId()}`;
    m.contentKey = `general.${m.episode.slug}`;
    writeManifest(dir, m);
    // First attempt fails (corrupt C1 audio), then fix and retry.
    writeFileSync(join(dir, 'audio', 'c1.mp3'), Buffer.from([0x00, 0x01]));
    const fail = await planAndImport(su, staff.token, dir, { raw: true });
    assert(fail.execStatus === 400, `first attempt must fail: ${fail.execStatus}`);
    writeFileSync(join(dir, 'audio', 'c1.mp3'), makeMp3(60));
    const ok = await planAndImport(su, staff.token, dir);
    assert(
      ok.execStatus === 200 && ok.exec.result === 'completed',
      `retry: ${ok.execStatus} ${JSON.stringify(ok.exec).slice(0, 200)}`,
    );
    const topics = (
      await fetchJson(URL, '/api/collections/topics/records?perPage=200', {
        headers: { authorization: su },
      })
    ).body.items;
    assert(
      topics.filter((t) => t.content_key === m.contentKey).length === 1,
      'retry created duplicates',
    );
  });

  // ---- 18. Progress on existing Episode remains unchanged ----
  await aScenario('Progress on the existing Episode remains unchanged by an update', async () => {
    // Repoint the main package to v5 and publish for progress access.
    const m = manifestOf(mainPkg.dir);
    m.contentVersion = 5;
    writeManifest(mainPkg.dir, m);
    const v5 = await planAndImport(su, staff.token, mainPkg.dir);
    assert(
      v5.execStatus === 200,
      `v5 import: ${v5.execStatus} ${JSON.stringify(v5.exec).slice(0, 200)}`,
    );
    await publishEpisode(su, topicId, variantIds);

    const student = await entitledStudent(su, 'B1');
    const progressRes = await fetchJson(
      URL,
      `/api/fast-english/lessons/${variantIds.B1}/progress`,
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${student.token}` },
        body: JSON.stringify({ positionSeconds: 1, expectedRevision: 0 }),
      },
    );
    assert(
      progressRes.status === 200,
      `progress: ${progressRes.status} ${JSON.stringify(progressRes.body).slice(0, 200)}`,
    );

    m.contentVersion = 6;
    writeManifest(mainPkg.dir, m);
    const v6 = await planAndImport(su, staff.token, mainPkg.dir);
    assert(
      v6.execStatus === 200,
      `v6 import: ${v6.execStatus} ${JSON.stringify(v6.exec).slice(0, 200)}`,
    );

    const progress = (
      await fetchJson(URL, '/api/collections/lesson_progress/records?perPage=200', {
        headers: { authorization: su },
      })
    ).body.items.filter((p) => p.lesson === variantIds.B1);
    assert(progress.length === 1, 'progress deleted');
    assert(progress[0].position_seconds === 1, `position changed: ${progress[0].position_seconds}`);
    assert(progress[0].revision === 1, `revision changed: ${progress[0].revision}`);
  });

  // ---- 19. Audit completed record exists + GET route ----
  await aScenario('audit completed record exists and is readable via the staff route', async () => {
    const audits = (
      await fetchJson(URL, '/api/collections/content_imports/records?perPage=200', {
        headers: { authorization: su },
      })
    ).body.items;
    const completed = audits.filter(
      (a) => a.content_key === mainPkg.manifest.contentKey && a.status === 'completed',
    );
    assert(completed.length >= 1, `completed audits=${completed.length}`);
    const view = await fetchJson(
      URL,
      `/api/fast-english/staff/content-imports/${completed[0].id}`,
      {
        headers: { authorization: `Bearer ${staff.token}` },
      },
    );
    assert(view.status === 200, `GET audit: ${view.status}`);
    assert(view.body.status === 'completed', `status=${view.body.status}`);
    assert(view.body.summary?.episodeId === topicId, 'summary missing episode id');
    assert(!!view.body.importedBy, 'importedBy missing');
    assert(!!view.body.packageFingerprint, 'fingerprint missing');
  });

  // ---- 20. Failed audit record contains sanitized diagnostics ----
  await aScenario('failed audit record contains sanitized diagnostics', async () => {
    const audits = (
      await fetchJson(URL, '/api/collections/content_imports/records?perPage=200', {
        headers: { authorization: su },
      })
    ).body.items;
    const failed = audits.filter((a) => a.status === 'failed');
    assert(failed.length >= 2, `failed audits=${failed.length}`);
    for (const f of failed) {
      const errorJson = String(f.error_json || '');
      assert(errorJson.length > 0, 'error_json empty');
      assert(errorJson.length <= 4000, 'error_json unbounded');
      assert(
        !/token|password|authorization|storage\/|pb_data|\/tmp\//i.test(errorJson),
        `unsanitized error_json: ${errorJson.slice(0, 200)}`,
      );
    }
    const view = await fetchJson(URL, `/api/fast-english/staff/content-imports/${failed[0].id}`, {
      headers: { authorization: `Bearer ${staff.token}` },
    });
    assert(view.status === 200, `GET failed audit: ${view.status}`);
    assert(Array.isArray(view.body.error), 'error not an array');
  });

  // ---- 21. Student auth rejected ----
  await aScenario(
    'Student cannot plan or execute an import; unauthenticated rejected',
    async () => {
      const student = await entitledStudent(su, 'B1');
      const plan = await fetchJson(URL, '/api/fast-english/staff/content-import/plan', {
        method: 'POST',
        headers: { authorization: `Bearer ${student.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ manifest: '{}', assets: [], fingerprint: 'x' }),
      });
      assert(plan.status === 401 || plan.status === 403, `student plan=${plan.status}`);
      const exec = await fetchJson(URL, '/api/fast-english/staff/content-import/execute', {
        method: 'POST',
        headers: { authorization: `Bearer ${student.token}` },
      });
      assert(exec.status === 401 || exec.status === 403, `student exec=${exec.status}`);
      const unauth = await fetchJson(URL, '/api/fast-english/staff/content-import/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert(unauth.status === 401, `unauth plan=${unauth.status}`);
      const auditView = await fetchJson(
        URL,
        '/api/fast-english/staff/content-imports/does-not-exist',
        {
          headers: { authorization: `Bearer ${student.token}` },
        },
      );
      assert(
        auditView.status === 401 || auditView.status === 403,
        `student audit view=${auditView.status}`,
      );
    },
  );

  // ---- 22. Inactive Staff rejected; legacy Operator rejected ----
  await aScenario('inactive Staff cannot authenticate; legacy Operator rejected', async () => {
    const email = `inactive-${randomId()}@fep-smoke.invalid`;
    const password = 'Test1234!';
    await fetchJson(URL, '/api/collections/staff_admins/records', {
      method: 'POST',
      headers: { authorization: su },
      body: JSON.stringify({
        email,
        password,
        passwordConfirm: password,
        display_name: 'Inactive',
        is_active: false,
        verified: true,
      }),
    });
    const login = await fetchJson(URL, '/api/collections/staff_admins/auth-with-password', {
      method: 'POST',
      body: JSON.stringify({ identity: email, password }),
    });
    assert(login.status === 400, `inactive login=${login.status}`);
    const legacy = await getLegacyOperatorToken(URL, su);
    const plan = await fetchJson(URL, '/api/fast-english/staff/content-import/plan', {
      method: 'POST',
      headers: { authorization: `Bearer ${legacy}`, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(plan.status === 401 || plan.status === 403, `legacy operator plan=${plan.status}`);
  });

  // ---- 23. Unsupported media rejected (server-side) ----
  await aScenario('unsupported media is rejected server-side', async () => {
    const { dir } = freshPackage();
    const m = manifestOf(dir);
    m.episode.slug = `media-${randomId()}`;
    m.contentKey = `general.${m.episode.slug}`;
    writeManifest(dir, m);
    writeFileSync(join(dir, 'audio', 'b1.mp3'), Buffer.from('not really an mp3 file'));
    const out = await planAndImport(su, staff.token, dir, { raw: true });
    assert(
      out.execStatus === 400,
      `exec=${out.execStatus} ${JSON.stringify(out.exec).slice(0, 300)}`,
    );
    assert(
      JSON.stringify(out.exec).includes('AUDIO_DURATION_UNREADABLE') ||
        JSON.stringify(out.exec).includes('AUDIO_UNSUPPORTED_TYPE'),
      'wrong error code',
    );
  });

  // ---- 23b. Oversized vocabulary rejected (server-side, mirrors schema maxItems) ----
  await aScenario('vocabulary above 100 entries is rejected by the server', async () => {
    const { dir } = freshPackage();
    const m = manifestOf(dir);
    m.episode.slug = `vocab-${randomId()}`;
    m.contentKey = `general.${m.episode.slug}`;
    m.variants[0].vocabulary = [];
    for (let vv = 0; vv < 101; vv++) {
      m.variants[0].vocabulary.push({
        term: `term${vv}`,
        meaningFa: `معنی ${vv}`,
        definitionEn: `definition ${vv}`,
      });
    }
    writeManifest(dir, m);
    const plan = await fetchJson(URL, '/api/fast-english/staff/content-import/plan', {
      method: 'POST',
      headers: { authorization: `Bearer ${staff.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ manifest: JSON.stringify(m), assets: [], fingerprint: 'x' }),
    });
    assert(plan.status === 400, `server plan=${plan.status}`);
    assert(plan.body.code === 'manifest_invalid', `server code=${plan.body.code}`);
    assert(
      JSON.stringify(plan.body.errorJson ?? plan.body).includes('VOCAB_COUNT_INVALID'),
      `missing VOCAB_COUNT_INVALID in ${JSON.stringify(plan.body).slice(0, 300)}`,
    );
  });

  // ---- 24. Traversal rejected ----
  await aScenario('traversal asset paths are rejected locally and by the server', async () => {
    const { dir } = freshPackage();
    const m = manifestOf(dir);
    m.episode.slug = `trav-${randomId()}`;
    m.contentKey = `general.${m.episode.slug}`;
    m.episode.artworkSquare = '../outside.png';
    writeManifest(dir, m);
    const local = await validatePackage(dir);
    assert(local.valid === false, 'local validation must fail');
    assert(
      local.errors.some((e) => e.code === 'PACKAGE_PATH_UNSAFE'),
      `codes=${local.errors.map((e) => e.code)}`,
    );
    const plan = await fetchJson(URL, '/api/fast-english/staff/content-import/plan', {
      method: 'POST',
      headers: { authorization: `Bearer ${staff.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ manifest: JSON.stringify(m), assets: [], fingerprint: 'x' }),
    });
    assert(plan.status === 400, `server plan=${plan.status}`);
    assert(plan.body.code === 'manifest_invalid', `server code=${plan.body.code}`);
  });

  // ---- 24b. Symlink escape rejected locally ----
  await aScenario('symlink escape is rejected locally', async () => {
    const { dir } = freshPackage();
    const m = manifestOf(dir);
    m.episode.slug = `link-${randomId()}`;
    m.contentKey = `general.${m.episode.slug}`;
    m.episode.artworkSquare = 'artwork/evil.png';
    writeManifest(dir, m);
    // Symlink inside the package pointing outside the package root.
    const outside = join(WORK, `outside-${randomId()}.png`);
    writeFileSync(outside, makePngBytes());
    try {
      // eslint-disable-next-line no-undef
      const { symlinkSync } = await import('node:fs');
      symlinkSync(outside, join(dir, 'artwork', 'evil.png'));
      const r = await validatePackage(dir);
      assert(r.valid === false, 'symlink package must be invalid');
      assert(
        r.errors.some((e) => e.code === 'PACKAGE_PATH_ESCAPE'),
        `codes=${r.errors.map((e) => e.code)}`,
      );
    } catch (err) {
      // On platforms without symlink support, skip.
      if (err?.code === 'EPERM' || err?.code === 'ENOSYS') return;
      throw err;
    }
  });

  // ---- 25. No orphan records or files remain after failure ----
  await aScenario('no orphan records or files remain after failures', async () => {
    const topics = (
      await fetchJson(URL, '/api/collections/topics/records?perPage=200', {
        headers: { authorization: su },
      })
    ).body.items;
    const lessons = (
      await fetchJson(URL, '/api/collections/lessons/records?perPage=200', {
        headers: { authorization: su },
      })
    ).body.items;
    const orphanLessons = lessons.filter((l) => !topics.some((t) => t.id === l.topic));
    assert(orphanLessons.length === 0, `orphan lessons=${orphanLessons.length}`);
    const vocab = (
      await fetchJson(URL, '/api/collections/lesson_vocabulary/records?perPage=500', {
        headers: { authorization: su },
      })
    ).body.items;
    const orphanVocab = vocab.filter((v) => !lessons.some((l) => l.id === v.lesson));
    assert(orphanVocab.length === 0, `orphan vocabulary=${orphanVocab.length}`);
  });

  console.log(`\ncontent-import smoke: ${passed}/${total} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

function makePngBytes() {
  // Tiny valid PNG (1x1) for the symlink target.
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
  ]);
}

main().catch((err) => {
  console.error('content-import smoke crashed:', err);
  process.exit(1);
});
