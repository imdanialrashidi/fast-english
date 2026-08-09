// e2e/podcast-library.spec.ts
// Podcast Slice 6 — deterministic browser gates for the production
// Student Podcast Library (/library).
//
// Real backend + real app (no API mocking). Covers the accepted Library
// journey: open Library -> browse Categories -> search -> filter Level /
// Progress -> sort -> load next page -> open the correct Episode Variant
// -> Back/refresh preserves discovery state -> distinct empty states ->
// Light/Dark + phone layout. No screenshots are used as assertions; every
// check reads DOM geometry, computed styles or the accessibility tree.

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { createStaff } from './fixtures';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();

// ---------------------------------------------------------------------------
// Fixture helpers (same real-backend pattern as podcast-home.spec.ts)
// ---------------------------------------------------------------------------
function randId(): string {
  return randomBytes(6).toString('hex');
}

let phoneCounter = 0;
function nextPhone(): string {
  const tail = String(phoneCounter++).padStart(2, '0');
  const r = randomBytes(4).readUInt32BE(0) % 10_000_000;
  return `09${String(r).padStart(7, '0')}${tail}`.slice(0, 11);
}

async function jsonFetch(url: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);
  const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body: body as Record<string, unknown>, ok: res.ok };
}

async function getSuperuserToken(): Promise<string> {
  const email = readFileSync('test-results/pb-su-email.txt', 'utf8').trim();
  const password = readFileSync('test-results/pb-su-password.txt', 'utf8').trim();
  const r = await jsonFetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: email, password }),
  });
  return (r.body as { token?: string })?.token || '';
}

const AUDIO_FIXTURE = Buffer.from(
  (() => {
    const size = 8192;
    const b = new Uint8Array(size);
    b[0] = 0xff;
    b[1] = 0xfb;
    b[2] = 0x90;
    b[3] = 0x00;
    for (let i = 4; i < size; i++) b[i] = 0x55;
    return b.buffer;
  })(),
);

const PNG_FIXTURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);

async function multipartPatch(
  su: string,
  path: string,
  field: string,
  filename: string,
  mime: string,
  bytes: Buffer,
) {
  const boundary = `--FB${randId()}`;
  const buf = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await fetch(`${PB_URL}${path}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: buf,
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status !== 200) throw new Error(`multipart ${field}: ${res.status}`);
}

async function makeCategory(
  su: string,
  overrides: { titleFa?: string; publicationStatus?: string; sortOrder?: number } = {},
) {
  const r = await jsonFetch(`${PB_URL}/api/collections/categories/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      key: `lib-cat-${randId()}`,
      slug: `lib-cat-${randId()}`,
      title_fa: overrides.titleFa ?? 'دسته',
      description_fa: 'توضیح دسته',
      sort_order: overrides.sortOrder ?? 0,
      publication_status: overrides.publicationStatus ?? 'published',
    }),
  });
  if (r.status >= 400)
    throw new Error(`category: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body as { id: string };
}

async function makeTopic(
  su: string,
  categoryId: string,
  overrides: {
    title?: string;
    titleFa?: string;
    sortOrder?: number;
    publishedAt?: string;
    featured?: boolean;
    keepDraft?: boolean;
  } = {},
) {
  const cr = await jsonFetch(`${PB_URL}/api/collections/topics/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      title: overrides.title ?? `T ${randId()}`,
      slug: `lib-t-${randId()}`,
      description: 'd',
      sort_order: overrides.sortOrder ?? 99,
      status: 'draft',
      content_key: `lib-fx-${randId()}`,
    }),
  });
  if (cr.status >= 400)
    throw new Error(`topic: ${cr.status} ${JSON.stringify(cr.body).slice(0, 200)}`);
  const id = cr.body?.id as string;
  if (overrides.keepDraft) return { id };
  await multipartPatch(
    su,
    `/api/collections/topics/records/${id}`,
    'artwork_square',
    'a.png',
    'image/png',
    PNG_FIXTURE,
  );
  const patch: Record<string, unknown> = {
    status: 'published',
    category: categoryId,
    content_key: `lib-fx-${randId()}`,
    content_version: 1,
    title_fa: overrides.titleFa ?? 'عنوان اپیزود',
    description_fa: 'توضیح اپیزود',
  };
  if (overrides.publishedAt) patch.published_at = overrides.publishedAt;
  if (overrides.featured) patch.is_featured = true;
  const pr = await jsonFetch(`${PB_URL}/api/collections/topics/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200) throw new Error(`topic publish: ${pr.status}`);
  return { id };
}

async function makeLesson(
  su: string,
  topicId: string,
  overrides: { title?: string; level?: string; keepDraft?: boolean } = {},
) {
  const cr = await jsonFetch(`${PB_URL}/api/collections/lessons/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      topic: topicId,
      level: overrides.level ?? 'A1',
      title: overrides.title ?? `L ${randId()}`,
      summary: 's',
      body: 'b',
      estimated_minutes: 10,
      status: 'draft',
    }),
  });
  if (cr.status >= 400)
    throw new Error(`lesson: ${cr.status} ${JSON.stringify(cr.body).slice(0, 200)}`);
  const id = cr.body?.id as string;
  await multipartPatch(
    su,
    `/api/collections/lessons/records/${id}`,
    'audio',
    't.mp3',
    'audio/mpeg',
    AUDIO_FIXTURE,
  );
  if (overrides.keepDraft) return { id };
  const pr = await jsonFetch(`${PB_URL}/api/collections/lessons/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      status: 'published',
      audio_duration_seconds: 600,
      summary_fa: 'خلاصه فارسی',
      content_version: 1,
    }),
  });
  if (pr.status !== 200) throw new Error(`lesson publish: ${pr.status}`);
  return { id };
}

async function seedPlacementQuestions(su: string) {
  const existing = await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
    headers: { authorization: `Bearer ${su}` },
  });
  const items = (existing.body?.items as Array<Record<string, unknown>>) || [];
  if (items.length > 0) return;
  for (let i = 0; i < 20; i++) {
    await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        question_key: `plq${String(i).padStart(2, '0')}`,
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

// Active Student with recommended=C2 (all-correct placement) and
// selected (preferred) level A1 — the two levels stay distinct.
async function createActiveStudent(su: string, level = 'A1') {
  const staff = await createStaff(su);
  const phone = nextPhone();
  const password = 'Test1234!';
  const canonicalPhone = `+98${phone.slice(1)}`;
  const signup = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({ name: 'دانشجوی کتابخانه', phone, password, passwordConfirm: password }),
  });
  const userId = signup.body?.id as string;
  const login = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  const token = (login.body as { token?: string })?.token || '';
  if (!token) throw new Error('student login failed');

  const boundary = `--FB${randId()}`;
  const prBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${PLAN_ID}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`,
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
  if (prRes.status !== 201) throw new Error(`PR: ${prRes.status}`);
  const prj = (await prRes.json()) as { request?: { id?: string } };
  const approve = await jsonFetch(
    `${PB_URL}/api/fast-english/operator/payment-requests/${prj.request?.id}/approve`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${staff.token}` },
      body: JSON.stringify({}),
    },
  );
  if (approve.status !== 200) throw new Error(`approve: ${approve.status}`);

  const refresh = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const refreshedToken = (refresh.body as { token?: string })?.token || token;

  await seedPlacementQuestions(su);
  const start = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
  });
  const attempt = start.body as {
    attempt?: { id: string; revision: number };
    questions?: Array<{ id: string; options?: Array<{ id: string }> }>;
  };
  const attemptId = attempt.attempt?.id;
  let rev = attempt.attempt?.revision || 0;
  for (const q of attempt.questions ?? []) {
    const ans = await jsonFetch(
      `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${refreshedToken}` },
        body: JSON.stringify({
          questionId: q.id,
          optionId: q.options?.[0]?.id,
          expectedRevision: rev,
        }),
      },
    );
    rev = (ans.body as { attempt?: { revision: number } })?.attempt?.revision || rev + 1;
  }
  await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
    body: JSON.stringify({ expectedRevision: rev }),
  });
  const lr = await jsonFetch(`${PB_URL}/api/fast-english/placement/selected-level`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
    body: JSON.stringify({ selectedLevel: level }),
  });
  if (lr.status !== 200) throw new Error(`level select: ${lr.status}`);
  return { token: refreshedToken, userId };
}

async function saveProgress(token: string, lessonId: string, positionSeconds: number) {
  const r = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${lessonId}/progress`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ positionSeconds, expectedRevision: 0 }),
  });
  if (r.status !== 200) throw new Error(`progress save: ${r.status}`);
}

async function setAuthAndGo(page: Page, token: string, path: string) {
  await page.goto('/');
  await page.evaluate(
    ({ t }) => {
      localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({ token: t, model: { id: '', phone: '' } }),
      );
    },
    { t: token },
  );
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(450);
}

async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
      document.body.scrollWidth <= document.documentElement.clientWidth,
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
let su: string;
let PLAN_ID = '';
let student: { token: string; userId: string };
let catA: string;
let catB: string;
// topic id -> published variants by level
const topics: Record<string, Record<string, string>> = {};
const VARIANT_IDS: string[] = [];

const EPISODE_TITLES: Record<string, string> = {
  multi: 'اپیزود چندسطحی',
  beta: 'اپیزود بتا',
  gamma: 'اپیزود گاما',
  featured: 'اپیزود ویژه',
  search: 'اپیزود جستجوی ویژه',
};

test.beforeAll(async () => {
  su = await getSuperuserToken();
  expect(su).toBeTruthy();

  await jsonFetch(`${PB_URL}/api/collections/payment_destination/records`, {
    method: 'POST',
    headers: { authorization: su },
    body: JSON.stringify({
      card_number: '0000000000000000',
      card_holder_name: 'T',
      bank_name: 'T',
      is_active: true,
    }),
  });
  const plan = await jsonFetch(`${PB_URL}/api/collections/plans/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      name: 'اشتراک کتابخانه',
      slug: `p-lib-${randId()}`,
      duration_days: 90,
      price_toman: 100000,
      is_active: true,
    }),
  });
  PLAN_ID = (plan.body?.id as string) || '';

  catA = (await makeCategory(su, { titleFa: 'دسته آلفا', sortOrder: 1 })).id;
  catB = (await makeCategory(su, { titleFa: 'دسته بتا', sortOrder: 2 })).id;
  await makeCategory(su, { titleFa: 'دسته پیشنویس', publicationStatus: 'draft' });

  const pub = (iso: string) => `${iso}T00:00:00.000Z`;

  // 13 published Episodes (12 per page -> exactly one load-more page).
  const specs: Array<{
    key: string;
    cat: string;
    levels: string[];
    sort: number;
    date: string;
    featured?: boolean;
    keepDraft?: boolean;
    titleFa?: string;
  }> = [
    {
      key: 'multi',
      cat: catA,
      levels: ['A1', 'B1', 'C1'],
      sort: 1,
      date: '2026-01-13',
      titleFa: EPISODE_TITLES.multi,
    },
    {
      key: 'beta',
      cat: catA,
      levels: ['A1'],
      sort: 2,
      date: '2026-01-12',
      titleFa: EPISODE_TITLES.beta,
    },
    {
      key: 'gamma',
      cat: catB,
      levels: ['A1', 'B1'],
      sort: 3,
      date: '2026-01-11',
      titleFa: EPISODE_TITLES.gamma,
    },
    {
      key: 'featured',
      cat: catA,
      levels: ['A1'],
      sort: 4,
      date: '2026-01-10',
      featured: true,
      titleFa: EPISODE_TITLES.featured,
    },
    {
      key: 'search',
      cat: catB,
      levels: ['A2'],
      sort: 5,
      date: '2026-01-09',
      titleFa: EPISODE_TITLES.search,
    },
  ];
  for (let i = 0; i < 8; i++) {
    specs.push({
      key: `plain${i}`,
      cat: i % 2 === 0 ? catA : catB,
      levels: ['A1'],
      sort: 6 + i,
      date: `2026-01-0${8 - i}`,
      titleFa: `اپیزود ساده ${i + 1}`,
    });
  }

  for (const spec of specs) {
    const topic = await makeTopic(su, spec.cat, {
      titleFa: spec.titleFa,
      sortOrder: spec.sort,
      publishedAt: pub(spec.date),
      featured: spec.featured,
    });
    topics[spec.key] = {};
    for (const level of spec.levels) {
      const lesson = await makeLesson(su, topic.id, { level });
      topics[spec.key][level] = lesson.id;
      VARIANT_IDS.push(lesson.id);
    }
  }

  // Draft + archived Episodes: never visible anywhere.
  const draftTopic = await makeTopic(su, catA, { titleFa: 'اپیزود پیشنویس', keepDraft: true });
  await makeLesson(su, draftTopic.id, { level: 'A1', keepDraft: true });
  const archTopic = await makeTopic(su, catA, { titleFa: 'اپیزود بایگانیشده' });
  await makeLesson(su, archTopic.id, { level: 'A1' });
  await jsonFetch(`${PB_URL}/api/collections/topics/records/${archTopic.id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({ status: 'archived' }),
  });

  student = await createActiveStudent(su, 'A1');
  // Progress fixtures (per Variant, independent):
  //   beta A1 -> completed; gamma B1 -> in progress (150s);
  //   plain0 A1 -> in progress (30s, visible at the default level).
  await saveProgress(student.token, topics.beta.A1, 600);
  await saveProgress(student.token, topics.gamma.B1, 150);
  await saveProgress(student.token, topics.plain0.A1, 30);
});

// ---------------------------------------------------------------------------
// Library journey
// ---------------------------------------------------------------------------
test.describe('podcast library scenarios', () => {
  test('1. Library opens with heading, search, categories and one card per Episode', {
    tag: '@critical',
  }, async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByRole('heading', { level: 1, name: 'کتابخانه' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('library-search')).toBeVisible();
    // Published Categories only.
    await expect(page.getByTestId('library-categories-')).toBeVisible(); // همه موضوعها
    await expect(page.getByTestId('library-categories').getByText('دسته آلفا')).toBeVisible();
    await expect(page.getByTestId('library-categories').getByText('دسته بتا')).toBeVisible();
    await expect(page.getByTestId('library-categories').getByText('پیشنویس')).toHaveCount(0);
    // First page: 12 of the 13 visible Episodes.
    await expect(
      page.locator(
        '[data-testid^="episode-card-"]:not([data-testid="episode-card-title"]):not([data-testid="episode-card-cta"]):not([data-testid="episode-card-levels"])',
      ),
    ).toHaveCount(12);
    await expect(page.getByTestId('library-count')).toContainText('13 اپیزود');
    // The multi-level Episode renders ONE card.
    const multiCard = page.locator(`[data-testid="episode-card-${topics.multi.A1}"]`);
    await expect(multiCard).toHaveCount(1);
    await expect(multiCard.getByTestId('episode-card-levels')).toContainText('A1 · B1 · C1');
  });

  test('2. draft and archived content is absent from the Library', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('پیشنویس');
    expect(body).not.toContain('بایگانیشده');
    expect(body).not.toContain('درس');
    expect(body).not.toContain('اپراتور');
  });

  test('3. selecting a Category narrows the discovery and updates the URL', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('library-categories').getByText('دسته آلفا').click();
    await expect(page).toHaveURL(/category=/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('7 اپیزود', { timeout: 10_000 });
    // Every visible card belongs to catA (all catA Episodes: multi, beta,
    // featured, plain0, plain2, plain4, plain6 = 7).
    await expect(page.locator(`[data-testid="episode-card-${topics.multi.A1}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="episode-card-${topics.gamma.A1}"]`)).toHaveCount(0);
    // Back to all Topics.
    await page.getByTestId('library-categories-').click();
    await expect(page).not.toHaveURL(/category=/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('13 اپیزود', { timeout: 10_000 });
  });

  test('4. search narrows to real Episode metadata and can be cleared', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('library-search').locator('input').fill('جستجوی ویژه');
    await expect(page).toHaveURL(/q=/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('1 اپیزود', { timeout: 10_000 });
    await expect(page.locator(`[data-testid="episode-card-${topics.search.A2}"]`)).toBeVisible();
    // Clear action restores the full discovery.
    await page.getByTestId('library-search-clear').click();
    await expect(page).not.toHaveURL(/q=/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('13 اپیزود', { timeout: 10_000 });
  });

  test('5. search empty state names the query and offers clear-search', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('library-search').locator('input').fill('چیزی که وجود ندارد');
    await expect(page).toHaveURL(/q=/, { timeout: 10_000 });
    await expect(page.getByText('برای این جستجو اپیزودی پیدا نشد.')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('چیزی برای نمایش نیست')).toHaveCount(0);
    await page.getByTestId('library-empty-clear').click();
    await expect(page.getByTestId('library-count')).toContainText('13 اپیزود', { timeout: 10_000 });
  });

  test('6. Level filter resolves the explicit Variant and updates the URL', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('library-levels-B1').click();
    await expect(page).toHaveURL(/level=B1/, { timeout: 10_000 });
    // B1-published Episodes: multi + gamma.
    await expect(page.getByTestId('library-count')).toContainText('2 اپیزود', { timeout: 10_000 });
    const multiCard = page.locator(`[data-testid="episode-card-${topics.multi.B1}"]`);
    await expect(multiCard).toBeVisible();
    await expect(multiCard.getByTestId('episode-card-levels')).toContainText('A1 · B1 · C1');
    // The card opens the B1 Variant.
    await multiCard.getByTestId('episode-card-cta').click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${topics.multi.B1}$`), { timeout: 10_000 });
  });

  test('7. Level empty state explains the filter and offers all levels', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('library-levels-C2').click();
    await expect(page).toHaveURL(/level=C2/, { timeout: 10_000 });
    await expect(page.getByText(/برای سطح C2 هنوز اپیزود منتشرشده‌?ای وجود ندارد/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('چیزی برای نمایش نیست')).toHaveCount(0);
    await page.getByTestId('library-empty-levels').click();
    await expect(page).toHaveURL(/level=all/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('13 اپیزود', { timeout: 10_000 });
  });

  test('8. Progress filter reflects the resolved Variant and never leaks across levels', {
    tag: '@critical',
  }, async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    // gamma's Progress lives on B1 only; the default (A1) view is not started.
    const gammaDefault = page.locator(`[data-testid="episode-card-${topics.gamma.A1}"]`);
    await expect(gammaDefault.getByTestId('episode-card-cta')).toContainText(/شروع گوش‌?دادن/);
    // Filter «در حال گوشدادن» at the default level shows plain0 (A1 30s),
    // not gamma (its resolved A1 Variant has no Progress).
    await page.getByTestId('library-progress-in_progress').click();
    await expect(page).toHaveURL(/progress=in_progress/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('1 اپیزود', { timeout: 10_000 });
    await expect(page.locator(`[data-testid="episode-card-${topics.plain0.A1}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="episode-card-${topics.gamma.A1}"]`)).toHaveCount(0);
    // Combine with level=B1: gamma's B1 Progress becomes visible («ادامه از 2:30»).
    // (multi also has a B1 Variant, but no Progress on it -> excluded by
    // the in_progress filter, so exactly gamma remains.)
    await page.getByTestId('library-levels-B1').click();
    await expect(page.getByTestId('library-count')).toContainText('1 اپیزود', { timeout: 10_000 });
    const gammaB1 = page.locator(`[data-testid="episode-card-${topics.gamma.B1}"]`);
    await expect(gammaB1.getByTestId('episode-card-cta')).toContainText('ادامه از 2:30');
    // Completed filter (default level): beta A1 was completed.
    await page.getByTestId('library-levels-preferred').click();
    await page.getByTestId('library-progress-all').click();
    await page.getByTestId('library-progress-completed').click();
    await expect(page).toHaveURL(/progress=completed/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('1 اپیزود', { timeout: 10_000 });
    await expect(page.locator(`[data-testid="episode-card-${topics.beta.A1}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="episode-card-${topics.gamma.A1}"]`)).toHaveCount(0);
  });

  test('9. Continue Listening shows only real resumable Progress', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    const section = page.getByTestId('library-continue');
    await expect(section).toBeVisible({ timeout: 15_000 });
    await expect(section.getByText(/ادامه گوش‌?دادن/)).toBeVisible();
    // beta is completed -> never resumable.
    await expect(
      page.getByTestId('continue-strip-title').filter({ hasText: 'اپیزود بتا' }),
    ).toHaveCount(0);
    // gamma B1 (150s) is resumable from 2:30.
    await expect(
      page.getByTestId('continue-strip-cta').filter({ hasText: 'ادامه از 2:30' }),
    ).toBeVisible();
  });

  test('10. suggested vs latest sort are deterministic', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    // پیشنهادی: featured Episode first.
    const firstCard = page
      .locator(
        '[data-testid^="episode-card-"]:not([data-testid="episode-card-title"]):not([data-testid="episode-card-cta"]):not([data-testid="episode-card-levels"])',
      )
      .first();
    await expect(firstCard).toHaveAttribute('data-testid', `episode-card-${topics.featured.A1}`);
    // تازهترین: newest published_at first (multi = 2026-01-13).
    await page.getByTestId('library-sort').selectOption('latest');
    await expect(page).toHaveURL(/sort=latest/, { timeout: 10_000 });
    const firstLatest = page
      .locator(
        '[data-testid^="episode-card-"]:not([data-testid="episode-card-title"]):not([data-testid="episode-card-cta"]):not([data-testid="episode-card-levels"])',
      )
      .first();
    await expect(firstLatest).toHaveAttribute('data-testid', `episode-card-${topics.multi.A1}`);
  });

  test('11. load more fetches the next page and updates the URL', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator(
        '[data-testid^="episode-card-"]:not([data-testid="episode-card-title"]):not([data-testid="episode-card-cta"]):not([data-testid="episode-card-levels"])',
      ),
    ).toHaveCount(12);
    await page.getByTestId('library-load-more').click();
    await expect(page).toHaveURL(/page=2/, { timeout: 10_000 });
    await expect(
      page.locator(
        '[data-testid^="episode-card-"]:not([data-testid="episode-card-title"]):not([data-testid="episode-card-cta"]):not([data-testid="episode-card-levels"])',
      ),
    ).toHaveCount(13);
    await expect(page.getByTestId('library-load-more')).toHaveCount(0);
  });

  test('12. opening a card opens the correct default Variant', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    // Default resolution for multi (preferred A1) -> the A1 Variant.
    const multiCard = page.locator(`[data-testid="episode-card-${topics.multi.A1}"]`);
    await multiCard.getByTestId('episode-card-cta').click();
    await expect(page).toHaveURL(new RegExp(`/lessons/${topics.multi.A1}$`), { timeout: 10_000 });
  });

  test('13. Back from an Episode returns to the filtered Library state', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('library-categories').getByText('دسته آلفا').click();
    await expect(page).toHaveURL(/category=/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('7 اپیزود', { timeout: 10_000 });
    await page
      .locator(`[data-testid="episode-card-${topics.multi.A1}"]`)
      .getByTestId('episode-card-title')
      .click();
    await expect(page).toHaveURL(/\/lessons\//, { timeout: 10_000 });
    await page.goBack();
    await expect(page).toHaveURL(/category=/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('7 اپیزود', { timeout: 10_000 });
  });

  test('14. refresh preserves the discovery state', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('library-levels-B1').click();
    await expect(page).toHaveURL(/level=B1/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('2 اپیزود', { timeout: 10_000 });
    await page.reload();
    await expect(page).toHaveURL(/level=B1/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('2 اپیزود', { timeout: 10_000 });
    await expect(page.getByTestId('library-levels-B1')).toHaveAttribute('aria-pressed', 'true');
  });

  test('15. browsing and filtering never change the Student level fields', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    for (const level of ['A2', 'B1', 'C1', 'all']) {
      await page.getByTestId(`library-levels-${level}`).click();
      await expect(page).toHaveURL(new RegExp(`level=${level}`), { timeout: 10_000 });
    }
    const me = await jsonFetch(`${PB_URL}/api/collections/fep_users/records/${student.userId}`, {
      headers: { authorization: `Bearer ${student.token}` },
    });
    expect((me.body as { selected_level?: string }).selected_level).toBe('A1');
    expect((me.body as { suggested_level?: string }).suggested_level).toBe('C2');
  });

  test('16. keyboard flow: search + Enter and chips are focusable', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    const search = page.getByTestId('library-search').locator('input');
    await search.focus();
    await search.fill('جستجوی ویژه');
    await search.press('Enter');
    await expect(page).toHaveURL(/q=/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('1 اپیزود', { timeout: 10_000 });
    // Chip keyboard access: focus the B1 chip and activate it with Enter.
    const b1Chip = page.getByTestId('library-levels-B1');
    await b1Chip.focus();
    await b1Chip.press('Enter');
    await expect(page).toHaveURL(/level=B1/, { timeout: 10_000 });
  });

  test('17. no console errors or failed network requests during the journey', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    // The artwork proxy enforces a pre-existing per-IP bound (60/5min,
    // Slice 2). The e2e lane opens a fresh browser context per test, so
    // the 13+ artwork images of every Library page load count again and
    // the bound can be exhausted mid-suite. That is a test-lane artifact
    // (a real session caches artwork with max-age=3600), not a Library
    // defect. Console error text carries no URL, so the 429 console
    // messages are dropped only when the response listener independently
    // proves every 429 response was an artwork URL.
    let sawArtwork429 = false;
    let sawFallback404 = false;
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('requestfailed', (request) => {
      failedRequests.push(`${request.method()} ${request.url()}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) {
        // The artwork fallback probe, favicon and the artwork per-IP 429
        // bound are pre-existing/benign; everything else must succeed.
        const url = response.url();
        if (response.status() === 429 && url.includes('/api/fast-english/artwork/')) {
          sawArtwork429 = true;
          return;
        }
        if (response.status() === 404 && url.endsWith('/artwork/fallback')) {
          sawFallback404 = true;
          return;
        }
        if (!url.includes('/favicon')) {
          failedRequests.push(`${response.status()} ${url}`);
        }
      }
    });

    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('library-categories').getByText('دسته آلفا').click();
    await expect(page.getByTestId('library-count')).toContainText('7 اپیزود', { timeout: 10_000 });
    // Combined search + Category: the search Episode lives in catB, so
    // this combination is honestly empty -> clear-search restores the 7.
    await page.getByTestId('library-search').locator('input').fill('جستجوی ویژه');
    await expect(page).toHaveURL(/q=/, { timeout: 10_000 });
    await expect(page.getByText('برای این جستجو اپیزودی پیدا نشد.')).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId('library-search-clear').click();
    await expect(page.getByTestId('library-count')).toContainText('7 اپیزود', { timeout: 10_000 });
    await page.getByTestId('library-categories-').click();
    await expect(page.getByTestId('library-count')).toContainText('13 اپیزود', { timeout: 10_000 });
    await page.getByTestId('library-levels-B1').click();
    await page.getByTestId('library-levels-preferred').click();
    await page.getByTestId('library-progress-completed').click();
    await expect(page).toHaveURL(/progress=completed/, { timeout: 10_000 });
    await expect(page.getByTestId('library-count')).toContainText('1 اپیزود', { timeout: 10_000 });
    await page.getByTestId('library-progress-all').click();
    await page.getByTestId('library-sort').selectOption('latest');
    await expect(page.getByTestId('library-count')).toContainText('13 اپیزود', { timeout: 10_000 });
    await page.getByTestId('library-load-more').click();
    await expect(page).toHaveURL(/page=2/, { timeout: 10_000 });

    expect(
      consoleErrors.filter(
        (text) =>
          !(sawArtwork429 && text.includes('429')) &&
          !(sawFallback404 && text.includes('404')),
      ),
      `sawArtwork429=${sawArtwork429} sawFallback404=${sawFallback404} | failed=${failedRequests.join(' | ')} | ${consoleErrors.join('\n')}`,
    ).toEqual([]);
    expect(failedRequests, failedRequests.join('\n')).toEqual([]);
  });

  test('18. 200% zoom stays usable without overflow on the Library', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    // No element box may leave the viewport (the documented zoom check
    // pattern from visual-slice-1; scrollWidth is unreliable under zoom
    // with wrapped RTL flex rows). Elements inside the horizontally
    // scrollable chip/strip rows legitimately extend past the viewport —
    // those scroller CONTAINERS must stay inside instead.
    const violations = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const inScroller = (el: Element): boolean => {
        let node = el.parentElement;
        while (node) {
          const s = getComputedStyle(node);
          if (
            (s.overflowX === 'auto' || s.overflowX === 'scroll') &&
            node.scrollWidth > node.clientWidth + 1
          ) {
            return true;
          }
          node = node.parentElement;
        }
        return false;
      };
      const bad: string[] = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0) continue;
        if (el.closest('svg') || el.closest('.MuiLinearProgress-root')) continue;
        if (inScroller(el)) continue;
        if (r.right > vw + 1 || r.left < -1) {
          bad.push(`${el.tagName} ${el.getAttribute('data-testid') ?? ''}`);
        }
      }
      // The scroller containers themselves must fit (their scrollable
      // children are already skipped by inScroller above).
      for (const el of document.querySelectorAll('[data-testid^="library-"]')) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0) continue;
        if (inScroller(el)) continue;
        if (r.right > vw + 1 || r.left < -1) {
          bad.push(`container ${el.getAttribute('data-testid') ?? ''}`);
        }
      }
      return bad.slice(0, 10);
    });
    expect(violations).toEqual([]);
    // Filters remain reachable and the search box stays usable.
    await expect(page.getByTestId('library-search').locator('input')).toBeVisible();
    await expect(page.getByTestId('library-levels-preferred')).toBeVisible();
  });

  test('19. keyboard focus is visible and tab order reaches the filters', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    const search = page.getByTestId('library-search').locator('input');
    // Tab until the search input receives keyboard focus (bounded).
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      if (await search.evaluate((el) => el === document.activeElement)) break;
    }
    expect(
      await search.evaluate((el) => el === document.activeElement),
      'search input reachable by Tab',
    ).toBe(true);
    // Keyboard focus shows a visible indicator (:focus-visible).
    expect(await search.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    // Tab until a level chip receives keyboard focus, then activate it.
    const b1Chip = page.getByTestId('library-levels-B1');
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      if (await b1Chip.evaluate((el) => el === document.activeElement)) break;
    }
    expect(
      await b1Chip.evaluate((el) => el === document.activeElement),
      'level chip reachable by Tab',
    ).toBe(true);
    expect(await b1Chip.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    await b1Chip.press('Enter');
    await expect(page).toHaveURL(/level=B1/, { timeout: 10_000 });
  });

  test('20. error state shows safe copy and Retry recovers', async ({ page }) => {
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    // Force the discovery request to fail, then recover.
    await page.route('**/api/fast-english/library**', (route) => route.abort());
    await page.getByTestId('library-levels-B1').click();
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('اپیزودها بارگیری نشدند.')).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('PocketBase');
    await page.unroute('**/api/fast-english/library**');
    await page.getByTestId('library-retry').click();
    await expect(page.getByTestId('library-count')).toContainText('2 اپیزود', { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Responsive + theme quality (§ A6) — deterministic geometry
// ---------------------------------------------------------------------------
test.describe('library responsive quality', () => {
  const VIEWPORTS = [
    { name: '360x800', width: 360, height: 800 },
    { name: '390x844', width: 390, height: 844 },
    { name: '430x932', width: 430, height: 932 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '1024x768', width: 1024, height: 768 },
    { name: '1440x900', width: 1440, height: 900 },
  ];

  for (const viewport of VIEWPORTS) {
    test(`Library geometry at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setAuthAndGo(page, student.token, '/library');
      await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });

      // 1. No document horizontal overflow.
      expect(await noHorizontalOverflow(page), 'overflow').toBe(true);

      // 2. Artwork stays bounded inside the card.
      const card = page.locator(`[data-testid="episode-card-${topics.multi.A1}"]`);
      const cardBox = (await card.boundingBox())!;
      const art = card.locator('img').first();
      const artBox = (await art.boundingBox())!;
      expect(artBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
      expect(artBox.x + artBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      expect(artBox.width).toBeLessThanOrEqual(viewport.width);

      // 3. The card CTA stays inside the viewport.
      const cta = card.getByTestId('episode-card-cta');
      const ctaBox = (await cta.boundingBox())!;
      expect(ctaBox.x + ctaBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(ctaBox.width).toBeGreaterThan(0);

      // 4. Bottom navigation never covers content (PageContainer pads).
      const main = page.getByRole('main').first();
      const paddingBottom = await main
        .locator('.MuiContainer-root > div')
        .first()
        .evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingBottom));
      if (viewport.width < 768) {
        expect(paddingBottom).toBeGreaterThanOrEqual(64 + 8);
      } else {
        expect(paddingBottom).toBeGreaterThanOrEqual(24);
      }

      // 5. Filters stay on-screen (chips scroll horizontally, no clip).
      const levels = page.getByTestId('library-levels');
      const levelsBox = (await levels.boundingBox())!;
      expect(levelsBox.x).toBeGreaterThanOrEqual(-1);
      expect(levelsBox.x + levelsBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(levelsBox.width).toBeGreaterThan(0);

      // 6. Long titles wrap inside the card.
      const title = card.getByTestId('episode-card-title');
      const titleBox = (await title.boundingBox())!;
      expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
    });
  }

  test('Library works in Light and Dark without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'light' });
    await setAuthAndGo(page, student.token, '/library');
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    expect(await noHorizontalOverflow(page), 'light').toBe(true);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await expect(page.getByTestId('library-count')).toBeVisible({ timeout: 15_000 });
    expect(await noHorizontalOverflow(page), 'dark').toBe(true);
    // Theme is never controlled on the Library surface.
    await expect(page.getByTestId('theme-switch')).toHaveCount(0);
  });
});
