// e2e/player-lifecycle.spec.ts
// Slice 8 — Player lifecycle reliability end-to-end contract.
//
// Proves against a real PocketBase + the real app, with ONE shared
// <audio preload="metadata"> element owned by PlayerProvider:
//
//   T1 A1 — the SPA journey (Home → Library → Progress → Account → back)
//           keeps exactly one element; playback survives every leg and
//           never restarts from zero on return;
//   T2 A2 — background/foreground honesty: a platform pause + element-pref
//           reset reconcile to the real element state — paused UI, rate
//           re-applied, exactly ONE progress save, furthest monotonic;
//   T3 A3/A4 — Media Session mirrors the session (metadata /
//           playbackState / clamped positionState / per-action
//           registration) and the captured REAL handler closures drive
//           the same player with the existing Progress semantics
//           (seekto honored, ±10 fallback, stop clears everything);
//   T4 A5 — Variant switch: rate/volume survive the remount, B1's
//           practical position is saved, B2 starts fresh, one element;
//   T5 A5 — pronunciation exclusivity: Episode pauses, no second
//           session, metadata unchanged, no progress writes during the
//           clip, at most one playing audio element;
//   T6 A5 — mid-playback failure (blocked route + seek beyond the live
//           buffer): honest error UI, the element's REAL position is
//           saved, retry rebuilds a fresh tokenized URL and playback
//           resumes from the practical target;
//   T7 A6 — unsupported Media Session degrades: the provider probes the
//           surface, no-ops, and play/pause/seek fully work;
//   T8 A5 — logout teardown: audio element removed, Mini Player gone,
//           Media Session metadata null + playbackState 'none'.
//
// Media Session observation harness (addInitScript): a recording proxy
// over `Navigator.prototype.mediaSession` logs every metadata /
// playbackState / setPositionState / setActionHandler call AND captures
// the real handler closures the provider registered. Headless Chromium
// cannot deliver OS media keys and does not expose positionState, so this
// harness is the smallest faithful layer to exercise external controls.
//
// Fixtures: a 600s silent MP3 (ffmpeg, 64kbps ≈ 4.8MB — under the 10MB
// lesson audio cap) is required for nearly every test; beforeAll FAILS
// LOUDLY when ffmpeg is unavailable. A 2s clip covers pronunciation.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { createStaff } from './fixtures';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();
const PB_DATA_DIR = readFileSync('test-results/pb-data-dir.txt', 'utf8').trim();

const CLIP_600S = 'test-results/player-lifecycle-clip-600s.mp3';
const CLIP_PRON_2S = 'test-results/player-lifecycle-clip-pron.mp3';

function randId(): string {
  return randomBytes(6).toString('hex');
}
let phoneCounter = 0;
function nextPhone(): string {
  return `0912${String(3456789 + phoneCounter++).slice(-7)}`;
}

async function jsonFetch(url: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);
  const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body: body as Record<string, unknown>, ok: res.ok };
}

const PNG_FIXTURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------
const state: {
  token: string;
  userId: string;
  su: string;
  aB1: string;
  aB2: string;
  aB1Vocab: string;
} = {
  token: '',
  userId: '',
  su: '',
  aB1: '',
  aB2: '',
  aB1Vocab: '',
};

interface ProgressBody {
  lessonId?: string;
  positionSeconds?: number;
  furthestSeconds?: number;
  durationSeconds?: number;
  completed?: boolean;
  revision?: number;
}

test.beforeAll(async () => {
  // The 600s clip is required by nearly every test in this suite — fail
  // loudly (never silently fall back to a shorter fixture) when ffmpeg
  // is missing or the generation fails.
  const ffmpegProbe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (ffmpegProbe.status !== 0) {
    throw new Error(
      'player-lifecycle: ffmpeg is required to generate the 600s audio fixture ' +
        '(apt install ffmpeg / brew install ffmpeg).',
    );
  }
  for (const [out, seconds] of [
    [CLIP_600S, '600'],
    [CLIP_PRON_2S, '2'],
  ] as const) {
    const gen = spawnSync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'anullsrc=r=44100:cl=mono',
        '-t',
        seconds,
        '-c:a',
        'libmp3lame',
        '-b:a',
        '64k',
        out,
      ],
      { stdio: 'ignore' },
    );
    if (gen.status !== 0 || !existsSync(out)) {
      throw new Error(`player-lifecycle: ffmpeg failed to generate ${out} (${gen.status})`);
    }
  }

  const suEmail = `fx-${randId()}@fep-smoke.invalid`;
  const suPassword = `FX-${randId()}`;
  spawnSync(
    'server/pocketbase',
    ['superuser', 'upsert', suEmail, suPassword, '--dir', PB_DATA_DIR],
    { stdio: 'ignore' },
  );
  const suAuth = await jsonFetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: suEmail, password: suPassword }),
  });
  const su = suAuth.body.token as string;
  state.su = su;
  const staff = await createStaff(su);

  // Student journey: signup → payment → approve → placement → level B1.
  const phone = nextPhone();
  const password = 'Test1234!';
  await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({ name: 'دانشجوی نمایشی', phone, password, passwordConfirm: password }),
  });
  const login = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: `+98${phone.slice(1)}`, password }),
  });
  const token = login.body.token as string;

  const plan = await jsonFetch(`${PB_URL}/api/collections/plans/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      name: 'E2E Lifecycle',
      slug: `lc-${randId()}`,
      duration_days: 30,
      price_toman: 100000,
      is_active: true,
      display_order: 0,
      description: 'disposable',
    }),
  });
  await jsonFetch(`${PB_URL}/api/collections/payment_destination/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      card_number: '1111222233334444',
      card_holder_name: 'E2E HOLDER',
      bank_name: 'E2E BANK',
      instructions: 'انتقال کارت به کارت',
      is_active: true,
    }),
  });
  const boundary = `--FB${randId()}`;
  const prBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${plan.body?.id}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    PNG_FIXTURE,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const prRes = await fetch(`${PB_URL}/api/fast-english/payment-requests`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: prBody,
  });
  const prj = (await prRes.json()) as { request?: { id?: string } };
  await jsonFetch(
    `${PB_URL}/api/fast-english/operator/payment-requests/${prj.request?.id}/approve`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${staff.token}` },
      body: JSON.stringify({}),
    },
  );
  const refresh = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  state.token = (refresh.body?.token as string) ?? token;
  state.userId = (refresh.body?.record?.id as string) ?? '';

  // Placement.
  const existingQ = await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
    headers: { authorization: `Bearer ${su}` },
  });
  if (!(existingQ.body?.items as unknown[])?.length) {
    for (let i = 0; i < 20; i++) {
      await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
        method: 'POST',
        headers: { authorization: `Bearer ${su}` },
        body: JSON.stringify({
          question_key: `lcq${String(i).padStart(2, '0')}`,
          version: 1,
          position: i + 1,
          prompt: `Q${i + 1}`,
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
            { id: 'c', text: 'C' },
            { id: 'd', text: 'D' },
          ],
          options_text: JSON.stringify([
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
            { id: 'c', text: 'C' },
            { id: 'd', text: 'D' },
          ]),
          correct_option_id: 'a',
          is_active: true,
        }),
      });
    }
  }
  const start = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
    method: 'POST',
    headers: { authorization: `Bearer ${state.token}` },
  });
  const attemptId = (start.body as { attempt?: { id: string } })?.attempt?.id;
  let rev = (start.body as { attempt?: { revision: number } })?.attempt?.revision || 0;
  for (const q of (start.body as { questions?: Array<{ id: string }> })?.questions || []) {
    const ans = await jsonFetch(
      `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${state.token}` },
        body: JSON.stringify({ questionId: q.id, optionId: 'a', expectedRevision: rev }),
      },
    );
    rev = (ans.body as { attempt?: { revision: number } })?.attempt?.revision || rev + 1;
  }
  await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${state.token}` },
    body: JSON.stringify({ expectedRevision: rev }),
  });
  await jsonFetch(`${PB_URL}/api/fast-english/placement/selected-level`, {
    method: 'POST',
    headers: { authorization: `Bearer ${state.token}` },
    body: JSON.stringify({ selectedLevel: 'B1' }),
  });
  // Marker semantics need recommended ≠ preferred: the superuser (the
  // server-side authority) sets the Placement result to B2 while the
  // student's preferred level stays B1.
  await jsonFetch(`${PB_URL}/api/collections/fep_users/records/${state.userId}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ suggested_level: 'B2' }),
  });

  // Content: an OWNED published category (the disposable PB is fresh per
  // run — the suite must never depend on another spec's fixtures), Topic A
  // with B1 + B2 variants on the 600s clip, and one B1 word with a real
  // 2s pronunciation clip.
  const catRes = await jsonFetch(`${PB_URL}/api/collections/categories/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      key: `lc-${randId()}`,
      slug: `lc-${randId()}`,
      title_fa: 'دستهٔ آزمون پخش',
      description_fa: 'توضیح دسته',
      sort_order: 0,
      publication_status: 'published',
    }),
  });
  const catId = catRes.body?.id as string;

  async function makeTopic() {
    const cr = await jsonFetch(`${PB_URL}/api/collections/topics/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        title: 'Lifecycle Alpha',
        slug: `lc-${randId()}`,
        description: 'd',
        sort_order: 1,
        status: 'draft',
        content_key: `fx-${randId()}`,
      }),
    });
    const id = cr.body?.id as string;
    const boundaryA = `--FB${randId()}`;
    const artBuf = Buffer.concat([
      Buffer.from(
        `--${boundaryA}\r\nContent-Disposition: form-data; name="artwork_square"; filename="art.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      PNG_FIXTURE,
      Buffer.from(`\r\n--${boundaryA}--\r\n`),
    ]);
    await fetch(`${PB_URL}/api/collections/topics/records/${id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${su}`,
        'content-type': `multipart/form-data; boundary=${boundaryA}`,
      },
      body: artBuf,
    });
    await jsonFetch(`${PB_URL}/api/collections/topics/records/${id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        status: 'published',
        category: catId,
        content_key: `fx-${randId()}`,
        content_version: 1,
        title_fa: 'اپیزود الف',
        description_fa: 'توضیح اپیزود',
        episode_number: 11,
      }),
    });
    return id;
  }

  async function makeLesson(topicId: string, level: string, title: string, summaryFa: string) {
    const cr = await jsonFetch(`${PB_URL}/api/collections/lessons/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        topic: topicId,
        level,
        title,
        summary: 's',
        body: 'b',
        estimated_minutes: 10,
        status: 'draft',
      }),
    });
    const id = cr.body?.id as string;
    const boundaryL = `--FB${randId()}`;
    const audioBuf = Buffer.concat([
      Buffer.from(
        `--${boundaryL}\r\nContent-Disposition: form-data; name="audio"; filename="t.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
      ),
      readFileSync(CLIP_600S),
      Buffer.from(`\r\n--${boundaryL}--\r\n`),
    ]);
    const up = await fetch(`${PB_URL}/api/collections/lessons/records/${id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${su}`,
        'content-type': `multipart/form-data; boundary=${boundaryL}`,
      },
      body: audioBuf,
    });
    if (up.status !== 200) throw new Error(`lesson audio upload ${up.status}`);
    await jsonFetch(`${PB_URL}/api/collections/lessons/records/${id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        status: 'published',
        audio_duration_seconds: 600,
        summary_fa: summaryFa,
        body: `Transcript of ${title}.`,
        content_version: 1,
      }),
    });
    return id;
  }

  async function makeVocab(lessonId: string, term: string) {
    const cr = await jsonFetch(`${PB_URL}/api/collections/lesson_vocabulary/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        lesson: lessonId,
        term,
        normalized_term: term.toLowerCase(),
        phonetic: '/wɜːrd/',
        part_of_speech: 'noun',
        meaning_fa: `معنی ${term}`,
        definition_en: `English definition of ${term}.`,
        example_sentence: `An example sentence with ${term}.`,
        sort_order: 1,
      }),
    });
    const id = cr.body?.id as string;
    const boundaryP = `--FB${randId()}`;
    const pronBuf = Buffer.concat([
      Buffer.from(
        `--${boundaryP}\r\nContent-Disposition: form-data; name="pronunciation_audio"; filename="p.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
      ),
      readFileSync(CLIP_PRON_2S),
      Buffer.from(`\r\n--${boundaryP}--\r\n`),
    ]);
    const res = await fetch(`${PB_URL}/api/collections/lesson_vocabulary/records/${id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${su}`,
        'content-type': `multipart/form-data; boundary=${boundaryP}`,
      },
      body: pronBuf,
    });
    if (res.status !== 200) throw new Error(`pron upload ${res.status}`);
    return id;
  }

  const topicA = await makeTopic();
  state.aB1 = await makeLesson(topicA, 'B1', 'Alpha B1', 'خلاصه بی‌وان');
  state.aB2 = await makeLesson(topicA, 'B2', 'Alpha B2', 'خلاصه بی‌تو');
  state.aB1Vocab = await makeVocab(state.aB1, 'listen');

  // Progress: A@B1 in progress at 150s (resume at 2:30).
  await jsonFetch(`${PB_URL}/api/fast-english/lessons/${state.aB1}/progress`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${state.token}` },
    body: JSON.stringify({ positionSeconds: 150, expectedRevision: 0 }),
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function setAuthAndGo(page: Page, path: string) {
  await page.goto('/');
  await page.evaluate(
    ({ t }) => {
      localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({ token: t, model: { id: '', phone: '' } }),
      );
    },
    { t: state.token },
  );
  await page.goto(path);
}

async function fetchProgress(lessonId: string): Promise<ProgressBody> {
  const res = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
    headers: { authorization: `Bearer ${state.token}` },
  });
  return res.body as unknown as ProgressBody;
}

/** Reset a Variant's saved position (server-authoritative) so every test
 *  is self-contained regardless of what earlier tests moved. */
async function resetProgress(lessonId: string, positionSeconds: number): Promise<void> {
  const current = await fetchProgress(lessonId);
  const res = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${state.token}` },
    body: JSON.stringify({
      positionSeconds,
      expectedRevision: Number(current.revision ?? 0),
    }),
  });
  if (res.status !== 200) throw new Error(`resetProgress ${lessonId}: ${res.status}`);
}

/** Restore a Variant to its PRISTINE state (no progress record at all).
 *  The server cannot accept a positionSeconds of 0: `position_seconds` /
 *  `furthest_seconds` are required NumberFields and PB rejects 0 on
 *  required numbers ("cannot be blank") — a 0-write would 500. The app
 *  never writes 0 (every save is a real position > 0), so "fresh" for
 *  tests means deleting the record via the rule-free disposable
 *  superuser, after which GET returns the default empty state. */
async function deleteProgress(lessonId: string): Promise<void> {
  // Hardening: the superuser is only safe against the disposable loopback
  // PocketBase — refuse anything else outright.
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(PB_URL)) {
    throw new Error(`deleteProgress refuses non-loopback PB_URL: ${PB_URL}`);
  }
  const esc = (v: string) => v.replace(/'/g, "\\'");
  const filter = encodeURIComponent(`lesson='${esc(lessonId)}' && user='${esc(state.userId)}'`);
  const res = await jsonFetch(
    `${PB_URL}/api/collections/lesson_progress/records?filter=${filter}&perPage=10`,
    { headers: { authorization: `Bearer ${state.su}` } },
  );
  for (const item of (res.body?.items as Array<{ id: string }>) ?? []) {
    const del = await jsonFetch(`${PB_URL}/api/collections/lesson_progress/records/${item.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${state.su}` },
    });
    if (del.status !== 204 && del.status !== 200) {
      throw new Error(`deleteProgress ${lessonId}: ${del.status}`);
    }
  }
}

interface AudioInfo {
  count: number;
  allAudioCount: number;
  currentTime: number;
  duration: number;
  paused: boolean;
  playbackRate: number;
  volume: number;
  muted: boolean;
  src: string | null;
  playing: boolean;
  playingCount: number;
}

function audioInfo(page: Page): Promise<AudioInfo> {
  return page.evaluate(() => {
    const audio = document.querySelector<HTMLAudioElement>('audio[preload="metadata"]');
    return {
      count: document.querySelectorAll('audio[preload="metadata"]').length,
      allAudioCount: document.querySelectorAll('audio').length,
      currentTime: audio ? audio.currentTime : 0,
      duration: audio ? audio.duration || 0 : 0,
      paused: audio ? audio.paused : true,
      playbackRate: audio ? audio.playbackRate : 1,
      volume: audio ? audio.volume : 1,
      muted: audio ? audio.muted : false,
      src: audio ? audio.src : null,
      playing: audio ? !audio.paused && !audio.ended : false,
      playingCount: Array.from(document.querySelectorAll('audio')).filter(
        (a) => !a.paused && !a.ended,
      ).length,
    };
  });
}

function deckSlider(page: Page) {
  return page
    .getByRole('group', { name: 'پخش‌کنندهٔ صوت' })
    .getByRole('slider', { name: 'موقعیت پخش' });
}

async function sliderSeconds(page: Page): Promise<number> {
  return Number((await deckSlider(page).getAttribute('aria-valuenow')) ?? -1);
}

/** The deck's primary control: the CTA (paused) or the play/pause toggle. */
function deckCta(page: Page) {
  return page.getByTestId('deck-primary-cta');
}

/** Start playback from whatever the deck CTA offers (resume/start/review). */
async function startPlayback(page: Page) {
  await deckCta(page).click();
  await expect(page.getByTestId('player-play-toggle')).toBeVisible({ timeout: 15_000 });
}

/** Wait until the shared element is actually moving forward (>= min). */
async function waitPlaybackReaches(page: Page, minSeconds: number, timeout = 15_000) {
  await expect
    .poll(async () => sliderSeconds(page), { timeout })
    .toBeGreaterThanOrEqual(minSeconds);
}

// --- Media Session observation harness -------------------------------------
// A recording proxy over `Navigator.prototype.mediaSession`. Every
// assignment/registration is appended to `window.__msLog.log`; the
// `setActionHandler` closures the real provider registers are captured in
// `window.__msLog.handlers` and can be invoked with Media Session
// `details`-shaped objects.
function installMediaSessionHarness(page: Page): Promise<void> {
  return page.addInitScript(() => {
    const log: Array<Record<string, unknown>> = [];
    const handlers: Record<string, (details?: Record<string, unknown>) => void> = {};
    const store: Record<string, unknown> = { metadata: null, playbackState: 'none' };
    const proxy = new Proxy(store, {
      get(t, prop) {
        if (prop === 'setActionHandler') {
          return (action: string, handler: unknown) => {
            handlers[action] = handler as (details?: Record<string, unknown>) => void;
            log.push({ type: 'setActionHandler', action, hasHandler: Boolean(handler) });
          };
        }
        if (prop === 'setPositionState') {
          return (state?: unknown) => {
            log.push({
              type: 'setPositionState',
              state:
                state && typeof state === 'object'
                  ? {
                      position: (state as { position?: number }).position,
                      duration: (state as { duration?: number }).duration,
                      playbackRate: (state as { playbackRate?: number }).playbackRate,
                    }
                  : null,
            });
          };
        }
        return t[prop as string];
      },
      set(t, prop, value) {
        if (prop === 'metadata') {
          let payload: unknown = null;
          if (value && typeof value === 'object') {
            const m = value as { title?: string; artist?: string; artwork?: unknown };
            payload = {
              title: m.title ?? null,
              artist: m.artist ?? null,
              artwork: m.artwork ?? null,
            };
          }
          log.push({ type: 'metadata', value: payload });
        } else if (prop === 'playbackState') {
          log.push({ type: 'playbackState', value });
        }
        t[prop as string] = value;
        return true;
      },
    });
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'mediaSession');
    Object.defineProperty(Navigator.prototype, 'mediaSession', {
      configurable: true,
      get() {
        log.push({ type: 'accessed' });
        return proxy;
      },
    });
    (window as unknown as Record<string, unknown>).__msLog = { log, handlers };
    (window as unknown as Record<string, unknown>).__msRestore = () => {
      if (original) Object.defineProperty(Navigator.prototype, 'mediaSession', original);
      else delete (Navigator.prototype as unknown as Record<string, unknown>).mediaSession;
    };
  });
}

/** T7: make the platform look like it has NO Media Session (the getter
 *  returns undefined — the provider's `!host` guard must no-op) while
 *  recording how often the surface was probed. */
function installUnsupportedMediaSession(page: Page): Promise<void> {
  return page.addInitScript(() => {
    const accesses: number[] = [];
    Object.defineProperty(Navigator.prototype, 'mediaSession', {
      configurable: true,
      get() {
        accesses.push(Date.now());
        return undefined;
      },
    });
    (window as unknown as Record<string, unknown>).__msUnsupported = { accesses };
  });
}

function msLog(page: Page) {
  return page.evaluate(() => {
    const ms = (window as unknown as { __msLog?: { log: Array<Record<string, unknown>> } }).__msLog;
    return ms ? ms.log : [];
  });
}

function collectPageErrors(page: Page): Array<string> {
  const errors: Array<string> = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test.describe('Player lifecycle reliability', () => {
  test.describe.configure({ mode: 'serial' });

  test('T1 A1 — one authoritative element survives the SPA journey and never restarts', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetProgress(state.aB1, 150);
    await setAuthAndGo(page, `/lessons/${state.aB1}`);
    await expect(deckCta(page)).toHaveText('ادامه از 2:30', { timeout: 20_000 });
    await startPlayback(page);
    await waitPlaybackReaches(page, 150);

    const leaving = await sliderSeconds(page);
    expect(leaving).toBeGreaterThanOrEqual(150);

    // The journey: Home → Library → Progress → Account. On every leg the
    // SAME element must exist and keep advancing (Mini Player follows).
    let previous = leaving;
    for (const [label, path] of [
      ['خانه', '/'],
      ['کتابخانه', '/library'],
      ['پیشرفت', '/progress'],
      ['حساب', '/account'],
    ] as const) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : `${path}$`}`), {
        timeout: 10_000,
      });
      await expect(page.getByTestId('mini-player')).toBeVisible();
      await expect(page.getByTestId('mini-player')).toContainText('در حال پخش…');
      // Exactly one shared element — never a second audio element.
      const info = await audioInfo(page);
      expect(info.count).toBe(1);
      expect(info.playing).toBe(true);
      // Playback actually advanced across the leg.
      await expect
        .poll(async () => (await audioInfo(page)).currentTime, { timeout: 15_000 })
        .toBeGreaterThanOrEqual(previous + 0.5);
      previous = (await audioInfo(page)).currentTime;
    }

    // Return through the Mini Player → the detail route rebinds the SAME
    // lesson (soft refresh): the practical position is restored — the
    // student is never thrown back to the start of the Episode.
    await page.getByTestId('mini-player-return').click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${state.aB1}$`), { timeout: 10_000 });
    await expect(deckCta(page)).toBeVisible({ timeout: 20_000 });
    await expect(deckCta(page)).not.toHaveText('شروع گوش‌دادن');
    // The soft-refresh restore seek lands at the practical position.
    await expect
      .poll(async () => sliderSeconds(page), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(leaving - 1);
    const restored = await sliderSeconds(page);
    // One element throughout (the pronunciation host is preload="none").
    expect((await audioInfo(page)).count).toBe(1);

    // Resume: playback continues from the practical position (>= leaving).
    await startPlayback(page);
    await expect
      .poll(async () => sliderSeconds(page), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(Math.max(leaving, restored) + 1);
    expect((await audioInfo(page)).count).toBe(1);
  });

  test('T2 A2 — background/foreground: honest pause, rate re-apply, ONE save, furthest monotonic', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installMediaSessionHarness(page);
    await resetProgress(state.aB1, 150);
    await setAuthAndGo(page, `/lessons/${state.aB1}`);
    await expect(deckCta(page)).toHaveText('ادامه از 2:30', { timeout: 20_000 });
    await startPlayback(page);
    await waitPlaybackReaches(page, 150);

    // Raise the rate through the deck menu (a preference the element holds).
    await page.getByTestId('deck-speed-trigger').click();
    await page.getByRole('menuitem', { name: 'سرعت پخش 1.25 برابر' }).click();
    await expect(page.getByTestId('deck-speed-trigger')).toHaveText('1.25×');
    await expect
      .poll(async () => (await audioInfo(page)).playbackRate, { timeout: 10_000 })
      .toBe(1.25);

    const progressBefore = await fetchProgress(state.aB1);
    const revBefore = Number(progressBefore.revision ?? 0);
    const furthestBefore = Number(progressBefore.furthestSeconds ?? 0);

    // Frozen-return path in ONE evaluate (single task, like the platform
    // resuming a backgrounded tab): the platform paused playback and reset
    // the element's rate while hidden; the resume event reconciles player
    // state from REAL element state.
    await page.evaluate(() => {
      const audio = document.querySelector<HTMLAudioElement>('audio[preload="metadata"]');
      if (!audio) return;
      audio.pause();
      audio.playbackRate = 1;
      // The tab returns to the foreground. Both events are dispatched on
      // `document` (the provider's listeners live there — a window-level
      // dispatch would never reach them).
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('resume'));
    });

    // Paused UI: the CTA slot is back and the element is really paused.
    await expect(deckCta(page)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('player-play-toggle')).toHaveCount(0);
    await expect(page.getByTestId('mini-player')).toContainText('مکث شده');
    expect((await audioInfo(page)).paused).toBe(true);
    // The platform's rate reset was reverted by the reconcile.
    expect((await audioInfo(page)).playbackRate).toBe(1.25);
    // Media Session mirrors the honest paused state.
    const states = (await msLog(page))
      .filter((e) => e.type === 'playbackState')
      .map((e) => e.value);
    expect(states).toContain('playing');
    expect(states[states.length - 1]).toBe('paused');

    // Exactly ONE progress save (the element's own pause event is the
    // single pause-save writer; the reconcile itself never writes).
    await expect
      .poll(async () => Number((await fetchProgress(state.aB1)).revision ?? -1), {
        timeout: 10_000,
        intervals: [500, 1000, 2000],
      })
      .toBe(revBefore + 1);
    const after = await fetchProgress(state.aB1);
    expect(Number(after.positionSeconds ?? -1)).toBeGreaterThanOrEqual(150);
    // Furthest is monotonic — the honest pause never regressed it.
    expect(Number(after.furthestSeconds ?? -1)).toBeGreaterThanOrEqual(furthestBefore);
  });

  test('T3 A3/A4 — Media Session mirrors the session; captured external handlers drive the player', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installMediaSessionHarness(page);
    await resetProgress(state.aB1, 150);
    await setAuthAndGo(page, `/lessons/${state.aB1}`);
    await expect(deckCta(page)).toHaveText('ادامه از 2:30', { timeout: 20_000 });
    await startPlayback(page);
    await waitPlaybackReaches(page, 150);

    // ---- A3: metadata / playbackState / clamped positionState ----
    const snap = await page.evaluate(() => {
      const log = msLogEntries();
      const metadata = log.filter((e) => e.type === 'metadata');
      const states = log.filter((e) => e.type === 'playbackState').map((e) => e.value);
      const positions = log.filter((e) => e.type === 'setPositionState').map((e) => e.state);
      const actions = log.filter((e) => e.type === 'setActionHandler').map((e) => e.action);
      return {
        lastMetadata: metadata.length ? metadata[metadata.length - 1].value : null,
        states,
        positions,
        actions,
      };
      function msLogEntries() {
        const ms = (window as unknown as { __msLog?: { log: Array<Record<string, unknown>> } })
          .__msLog;
        return ms ? ms.log : [];
      }
    });
    const meta = snap.lastMetadata as {
      title?: string | null;
      artist?: string | null;
      artwork?: Array<{ src?: string }> | null;
    } | null;
    expect(meta?.title).toBe('اپیزود الف');
    expect(meta?.artist).toBe('Fast English Podcast');
    expect(meta?.artwork?.length).toBe(1);
    expect(meta?.artwork?.[0]?.src ?? '').toContain('/api/fast-english/artwork/');
    expect(snap.states).toContain('playing');
    // positionState is clamped to the track and follows the real position.
    const pos = snap.positions[snap.positions.length - 1] as {
      position?: number;
      duration?: number;
      playbackRate?: number;
    } | null;
    expect(pos?.duration ?? 0).toBeGreaterThanOrEqual(599);
    expect(pos?.duration ?? 0).toBeLessThanOrEqual(601);
    expect(pos?.position ?? -1).toBeGreaterThanOrEqual(150);
    expect(pos?.position ?? 1e9).toBeLessThanOrEqual(pos?.duration ?? 0);
    expect(pos?.playbackRate).toBe(1);
    // Every action the product supports was registered per-action.
    for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto', 'stop']) {
      expect(snap.actions).toContain(action);
    }

    // ---- A4: the captured REAL handlers drive the same player ----
    // pause → the player pauses (deck CTA returns).
    await page.evaluate(() => {
      (
        window as unknown as {
          __msLog: { handlers: Record<string, (d?: Record<string, unknown>) => void> };
        }
      ).__msLog.handlers.pause?.({});
    });
    await expect(deckCta(page)).toBeVisible({ timeout: 10_000 });

    // seekto(30) → element position ≈ 30 and the existing Progress
    // semantics save it (onSeek → debounced save).
    await page.evaluate(() => {
      (
        window as unknown as {
          __msLog: { handlers: Record<string, (d?: Record<string, unknown>) => void> };
        }
      ).__msLog.handlers.seekto?.({ seekTime: 30 });
    });
    await expect
      .poll(async () => sliderSeconds(page), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(29);
    await expect.poll(async () => sliderSeconds(page), { timeout: 10_000 }).toBeLessThanOrEqual(31);
    await expect
      .poll(async () => Number((await fetchProgress(state.aB1)).positionSeconds ?? -1), {
        timeout: 15_000,
        intervals: [500, 1000, 2000],
      })
      .toBeGreaterThanOrEqual(29);
    await expect
      .poll(async () => Number((await fetchProgress(state.aB1)).positionSeconds ?? -1), {
        timeout: 15_000,
      })
      .toBeLessThanOrEqual(31);

    // seekforward honors the OS offset (+10); seekbackward falls back to
    // the product's ±10 step when no offset is given.
    await page.evaluate(() => {
      (
        window as unknown as {
          __msLog: { handlers: Record<string, (d?: Record<string, unknown>) => void> };
        }
      ).__msLog.handlers.seekforward?.({ seekOffset: 10 });
    });
    await expect
      .poll(async () => sliderSeconds(page), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(39);
    await page.evaluate(() => {
      (
        window as unknown as {
          __msLog: { handlers: Record<string, (d?: Record<string, unknown>) => void> };
        }
      ).__msLog.handlers.seekbackward?.({});
    });
    await expect.poll(async () => sliderSeconds(page), { timeout: 10_000 }).toBeLessThanOrEqual(31);

    // play → the same element resumes.
    await page.evaluate(() => {
      (
        window as unknown as {
          __msLog: { handlers: Record<string, (d?: Record<string, unknown>) => void> };
        }
      ).__msLog.handlers.play?.({});
    });
    await expect(page.getByTestId('player-play-toggle')).toBeVisible({ timeout: 10_000 });

    // stop → the session ends: element removed, Mini Player gone, Media
    // Session cleared (metadata null + playbackState 'none').
    await page.evaluate(() => {
      (
        window as unknown as {
          __msLog: { handlers: Record<string, (d?: Record<string, unknown>) => void> };
        }
      ).__msLog.handlers.stop?.({});
    });
    await expect(page.getByTestId('mini-player')).toHaveCount(0);
    expect((await audioInfo(page)).count).toBe(0);
    const cleared = await page.evaluate(() => {
      const log = msLogEntries();
      const states = log.filter((e) => e.type === 'playbackState').map((e) => e.value);
      const metadata = log.filter((e) => e.type === 'metadata');
      return {
        lastState: states[states.length - 1],
        lastMetadata: metadata.length ? metadata[metadata.length - 1].value : null,
      };
      function msLogEntries() {
        const ms = (window as unknown as { __msLog?: { log: Array<Record<string, unknown>> } })
          .__msLog;
        return ms ? ms.log : [];
      }
    });
    expect(cleared.lastState).toBe('none');
    expect(cleared.lastMetadata).toBe(null);
  });

  test('T4 A5 — Variant switch: prefs survive, B1 practical position saved, B2 fresh, one element', async ({
    page,
  }) => {
    // The volume slider is only rendered at sm+ — use the tablet layout.
    await page.setViewportSize({ width: 768, height: 1024 });
    await installMediaSessionHarness(page);
    await resetProgress(state.aB1, 150);
    await deleteProgress(state.aB2);
    await setAuthAndGo(page, `/lessons/${state.aB1}`);
    await expect(deckCta(page)).toHaveText('ادامه از 2:30', { timeout: 20_000 });
    await startPlayback(page);
    await waitPlaybackReaches(page, 150);

    // Listening preferences: rate 1.25 (deck menu) + volume 0.5 (slider
    // keyboard). The app is RTL, and MUI flips the range-input arrows in
    // RTL (ArrowRight DECREASES) — Home (min=0) then 10×ArrowLeft reaches
    // exactly 0.5 on the 0.05 step.
    await page.getByTestId('deck-speed-trigger').click();
    await page.getByRole('menuitem', { name: 'سرعت پخش 1.25 برابر' }).click();
    await expect(page.getByTestId('deck-speed-trigger')).toHaveText('1.25×');
    const volume = page.getByRole('slider', { name: 'بلندی صدا' });
    await volume.focus();
    await page.keyboard.press('Home');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowLeft');
    }
    await expect
      .poll(async () => (await audioInfo(page)).volume, { timeout: 10_000 })
      .toBeCloseTo(0.5, 2);
    const practical = await sliderSeconds(page);

    const metaCountBefore = (await msLog(page)).filter((e) => e.type === 'metadata').length;

    // Atomic Variant switch to B2.
    await page.getByTestId('edition-plate-B2').click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${state.aB2}$`), { timeout: 10_000 });
    await expect(deckCta(page)).toHaveText('شروع گوش‌دادن', { timeout: 20_000 });
    // B2 has its OWN progress: fresh (the switch never leaks B1's). The
    // read is polled — under full-suite load a single-shot GET can return
    // an anomalous response.
    await expect
      .poll(async () => Number((await fetchProgress(state.aB2)).positionSeconds ?? -1), {
        timeout: 10_000,
      })
      .toBe(0);

    // The switch saved B1's PRACTICAL position (what the student had
    // actually reached), not the stale 150s seed.
    await expect
      .poll(async () => Number((await fetchProgress(state.aB1)).positionSeconds ?? -1), {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(Math.max(150, practical - 1));
    await expect
      .poll(async () => Number((await fetchProgress(state.aB1)).positionSeconds ?? -1), {
        timeout: 10_000,
      })
      .toBeLessThanOrEqual(practical + 2);

    // One element; preferences survive the remount (element re-apply
    // effect — polled, it lands a frame after the new element mounts).
    const info = await audioInfo(page);
    expect(info.count).toBe(1);
    await expect
      .poll(async () => (await audioInfo(page)).playbackRate, { timeout: 10_000 })
      .toBe(1.25);
    await expect
      .poll(async () => (await audioInfo(page)).volume, { timeout: 10_000 })
      .toBeCloseTo(0.5, 2);
    await expect.poll(async () => (await audioInfo(page)).muted, { timeout: 10_000 }).toBe(false);
    await expect(page.getByTestId('deck-speed-trigger')).toHaveText('1.25×');
    // Media Session follows the NEW session (a fresh metadata payload).
    const metaAfter = (await msLog(page)).filter((e) => e.type === 'metadata');
    expect(metaAfter.length).toBeGreaterThan(metaCountBefore);
    expect((metaAfter[metaAfter.length - 1].value as { title?: string | null } | null)?.title).toBe(
      'اپیزود الف',
    );
  });

  test('T5 A5 — pronunciation exclusivity: Episode pauses, no writes during the clip', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installMediaSessionHarness(page);
    await resetProgress(state.aB1, 150);
    await setAuthAndGo(page, `/lessons/${state.aB1}`);
    await expect(deckCta(page)).toHaveText('ادامه از 2:30', { timeout: 20_000 });
    await startPlayback(page);
    await waitPlaybackReaches(page, 150);
    const sliderAtPron = await sliderSeconds(page);

    const revBefore = Number((await fetchProgress(state.aB1)).revision ?? 0);
    const metaCountBefore = (await msLog(page)).filter((e) => e.type === 'metadata').length;

    // Expand the word with the uploaded pronunciation clip and play it.
    const row = page.getByTestId(`vocab-expander-${state.aB1Vocab}`);
    await row.click();
    const control = page.getByTestId(`pron-control-${state.aB1Vocab}`);
    await control.click();
    await expect(control).toHaveText('توقف تلفظ', { timeout: 10_000 });

    // Exclusivity: the Episode paused — CTA slot back, Media Session
    // playbackState honestly 'paused', at most one playing audio element.
    await expect(deckCta(page)).toBeVisible({ timeout: 10_000 });
    const states = (await msLog(page))
      .filter((e) => e.type === 'playbackState')
      .map((e) => e.value);
    expect(states[states.length - 1]).toBe('paused');
    const during = await audioInfo(page);
    expect(during.playingCount).toBeLessThanOrEqual(1);
    // The clip never seeks the Episode (only natural pre-pause drift).
    const sliderDuring = await sliderSeconds(page);
    expect(sliderDuring).toBeGreaterThanOrEqual(sliderAtPron - 0.5);
    expect(sliderDuring).toBeLessThanOrEqual(sliderAtPron + 1);
    // The honest exclusivity pause DID save (one revision bump), and the
    // Media Session metadata never changed (no pronunciation session).
    await expect
      .poll(async () => Number((await fetchProgress(state.aB1)).revision ?? -1), {
        timeout: 10_000,
        intervals: [500, 1000, 2000],
      })
      .toBe(revBefore + 1);
    const revDuring = Number((await fetchProgress(state.aB1)).revision ?? 0);
    expect((await msLog(page)).filter((e) => e.type === 'metadata').length).toBe(metaCountBefore);

    // Wait for the 2s clip to end naturally, then re-assert: no NEW
    // progress writes happened during pronunciation playback and the
    // furthest position is unchanged (monotonic, never regressed).
    await expect(control).toHaveText('پخش تلفظ', { timeout: 10_000 });
    const furthestDuring = Number((await fetchProgress(state.aB1)).furthestSeconds ?? 0);
    const after = await fetchProgress(state.aB1);
    expect(Number(after.revision ?? 0)).toBe(revDuring);
    expect(Number(after.furthestSeconds ?? 0)).toBe(furthestDuring);
    expect((await msLog(page)).filter((e) => e.type === 'metadata').length).toBe(metaCountBefore);
  });

  test('T6 A5 — mid-playback failure: honest error, practical position saved, retry restores the target', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await deleteProgress(state.aB2);
    await setAuthAndGo(page, `/lessons/${state.aB2}`);
    await expect(deckCta(page)).toHaveText('شروع گوش‌دادن', { timeout: 20_000 });
    await startPlayback(page);
    await waitPlaybackReaches(page, 0.5);

    // The practical position the student reaches before the failure:
    // seek to 30s (inside the streamed data — no fetch needed) so the
    // restore target is a meaningful resume point.
    await page.evaluate(() => {
      const audio = document.querySelector<HTMLAudioElement>('audio[preload="metadata"]');
      if (audio) audio.currentTime = 30;
    });
    await expect
      .poll(async () => sliderSeconds(page), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(29);

    // Mid-playback failure, deterministically. Measured through the app:
    // the whole clip rides ONE long-lived response stream through the
    // dev proxy — the element issues NO range requests (buffered grows
    // to the full track with ZERO requests visible to the network
    // layer), so a route block on NEW requests can never interrupt
    // playback. The faithful equivalent of a broken next-range fetch
    // (the real token-expiry path) is `audio.load()`: it aborts the
    // stream and issues a FRESH fetch of the same URL — which hits the
    // block. The pause the load algorithm fires carries the REAL
    // pre-reset position (the same transient pause proven in T1), so
    // the practical position is saved through the normal pause-save
    // writer — never fabricated.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__errorPos = null;
      const audio = document.querySelector<HTMLAudioElement>('audio[preload="metadata"]');
      audio?.addEventListener('error', () => {
        (window as unknown as Record<string, unknown>).__errorPos = audio.currentTime;
      });
    });
    await page.route('**/api/fast-english/lessons/*/audio*', (route) => {
      route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    });
    await page.evaluate(() => {
      const audio = document.querySelector<HTMLAudioElement>('audio[preload="metadata"]');
      if (audio) audio.load();
    });

    // Honest deck error state (no raw media errors), and the element
    // really fired the error event.
    await expect(page.getByRole('alert')).toContainText('خطا در پخش صوت', { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'تلاش مجدد' })).toBeVisible();
    const errorFired = await page.evaluate(
      () => (window as unknown as { __errorPos?: number | null }).__errorPos ?? null,
    );
    expect(errorFired).not.toBeNull();
    // The practical position (30s) survived in the SAVED progress — the
    // deck's resume point derives from saved Progress, never from a
    // fabricated value.
    await expect
      .poll(async () => Number((await fetchProgress(state.aB2)).positionSeconds ?? -1), {
        timeout: 15_000,
        intervals: [500, 1000, 2000],
      })
      .toBeGreaterThanOrEqual(28.5);
    await expect
      .poll(async () => Number((await fetchProgress(state.aB2)).positionSeconds ?? -1), {
        timeout: 15_000,
        intervals: [500, 1000, 2000],
      })
      .toBeLessThanOrEqual(31.5);

    // Recover: unblock, retry via the deck — the retry ALWAYS rebuilds the
    // protected URL with a fresh file token.
    const oldSrc = (await audioInfo(page)).src;
    expect(oldSrc).toContain('token=');
    await page.unroute('**/api/fast-english/lessons/*/audio*');
    await page.getByRole('button', { name: 'تلاش مجدد' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(deckCta(page)).toBeVisible({ timeout: 20_000 });
    // The CTA derives from the SAVED practical position (30s) — the
    // deck offers the honest resume point, never a fresh start.
    await expect(deckCta(page)).toHaveText('ادامه از 0:30');
    const newSrc = (await audioInfo(page)).src;
    expect(newSrc).not.toBeNull();
    expect(newSrc).not.toBe(oldSrc);
    expect(newSrc).toContain('token=');
    expect((await audioInfo(page)).count).toBe(1);

    // The CTA resumes from the practical target — playback never restarts
    // from zero, and the saved Progress keeps the failure position.
    await startPlayback(page);
    await expect
      .poll(async () => sliderSeconds(page), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(30.5);
    await expect
      .poll(async () => Number((await fetchProgress(state.aB2)).positionSeconds ?? -1), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(28.5);
    // The element is genuinely moving forward again from the target.
    const resumed = await sliderSeconds(page);
    await expect
      .poll(async () => sliderSeconds(page), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(resumed + 0.5);
  });

  test('T7 A6 — unsupported Media Session degrades: playback fully works, provider no-ops', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = collectPageErrors(page);
    await installUnsupportedMediaSession(page);
    await deleteProgress(state.aB2);
    await setAuthAndGo(page, `/lessons/${state.aB2}`);
    await expect(deckCta(page)).toHaveText('شروع گوش‌دادن', { timeout: 20_000 });

    // Play.
    await startPlayback(page);
    await waitPlaybackReaches(page, 1);

    // Pause.
    await page.getByTestId('player-play-toggle').click();
    await expect(deckCta(page)).toBeVisible({ timeout: 10_000 });

    // Seek (product skip buttons). The resume seek lands at ~2.05s, so
    // +10 lands at ~12.05 — the bound is deliberately generous.
    await page.getByRole('button', { name: '۱۰ ثانیه به جلو' }).click();
    await expect
      .poll(async () => sliderSeconds(page), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(9);
    await expect
      .poll(async () => sliderSeconds(page), { timeout: 10_000 })
      .toBeLessThanOrEqual(12.5);

    // The provider probed the surface (getMediaSessionHost in the sync
    // effects) and no-oped — no metadata, no playbackState, no handlers,
    // and crucially no crash: in-app playback is unaffected.
    const accesses = await page.evaluate(
      () =>
        (
          window as unknown as {
            __msUnsupported?: { accesses: number[] };
          }
        ).__msUnsupported?.accesses.length ?? 0,
    );
    expect(accesses).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('T8 A5 — logout teardown: element removed, Mini Player gone, Media Session cleared', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = collectPageErrors(page);
    await installMediaSessionHarness(page);
    await resetProgress(state.aB1, 150);
    await setAuthAndGo(page, `/lessons/${state.aB1}`);
    await expect(deckCta(page)).toHaveText('ادامه از 2:30', { timeout: 20_000 });
    await startPlayback(page);
    await waitPlaybackReaches(page, 150);

    // Navigate to the Account page — playback continues (Mini Player).
    await page.getByRole('button', { name: 'حساب', exact: true }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 10_000 });
    await expect(page.getByTestId('mini-player')).toBeVisible();
    expect((await audioInfo(page)).count).toBe(1);

    // Logout → the provider clears the session: no audio elements at all,
    // no Mini Player, and the Media Session is fully cleared. The SPA
    // lands on the guest login route.
    await page.getByTestId('account-logout').click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
    await expect
      .poll(
        async () =>
          page.evaluate(() => document.querySelectorAll('audio[preload="metadata"]').length),
        { timeout: 10_000 },
      )
      .toBe(0);
    await expect(page.getByTestId('mini-player')).toHaveCount(0);
    const cleared = await page.evaluate(() => {
      const ms = (window as unknown as { __msLog?: { log: Array<Record<string, unknown>> } })
        .__msLog;
      const log = ms ? ms.log : [];
      const states = log.filter((e) => e.type === 'playbackState').map((e) => e.value);
      const metadata = log.filter((e) => e.type === 'metadata');
      return {
        lastState: states[states.length - 1],
        lastMetadata: metadata.length ? metadata[metadata.length - 1].value : null,
      };
    });
    expect(cleared.lastState).toBe('none');
    expect(cleared.lastMetadata).toBe(null);
    expect(errors).toEqual([]);
  });
});
