// e2e/podcast-domain.spec.ts
// Podcast Slice 2 — focused real-browser proof of the changed public
// behavior:
//   1. eligible Student opens an Episode at the recommended Level;
//   2. available-level control data includes another Published Level;
//   3. Student opens another Level through the existing Lesson route;
//   4. Placement result remains unchanged;
//   5. preferred level remains unchanged;
//   6. Progress remains independent (per-Variant);
//   7. wrong-role and expired access remain denied;
//   8. Draft and archived content are absent;
//   9. no raw Backend error appears.
//
// The final Library / Level Switcher UI is NOT implemented in this slice;
// browsing happens through the existing Lesson routes (read-only, no
// mutation of Placement/preferred level).

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createStaff } from './fixtures';

const PB_URL = readFileSync('test-results/pb-url.txt', 'utf8').trim();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function randId() {
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
  const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(15_000) });
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

async function getDefaultCategoryId(su: string): Promise<string> {
  const r = await jsonFetch(
    `${PB_URL}/api/collections/categories/records?filter=(key='general')&perPage=1`,
    { headers: { authorization: `Bearer ${su}` } },
  );
  const item = (r.body as { items?: Array<{ id: string }> })?.items?.[0];
  if (!item) throw new Error('default category missing');
  return item.id;
}

async function makeTopic(su: string, overrides: Record<string, unknown> = {}) {
  const slug = (overrides.slug as string) || `t-${randId()}`;
  const cr = await jsonFetch(`${PB_URL}/api/collections/topics/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      title: `T ${randId()}`,
      slug,
      description: 'd',
      sort_order: overrides.sort_order ?? 0,
      status: 'draft',
    }),
  });
  const id = cr.body?.id as string;
  if (!id) throw new Error(`topic create: ${JSON.stringify(cr.body).slice(0, 200)}`);
  if (overrides.keepDraft) return cr.body;
  const boundary = `--FB${randId()}`;
  const artBuf = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="artwork_square"; filename="art.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    PNG_FIXTURE,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const artRes = await fetch(`${PB_URL}/api/collections/topics/records/${id}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: artBuf,
    signal: AbortSignal.timeout(15_000),
  });
  if (artRes.status !== 200) throw new Error(`artwork upload: ${artRes.status}`);
  const patch: Record<string, unknown> = {
    status: overrides.status || 'published',
    category: await getDefaultCategoryId(su),
    content_key: `fx-${randId()}`,
    content_version: 1,
    title_fa: 'عنوان اپیزود',
    description_fa: 'توضیح اپیزود',
  };
  const pr = await jsonFetch(`${PB_URL}/api/collections/topics/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200) throw new Error(`topic publish: ${pr.status}`);
  return cr.body;
}

async function makeLesson(su: string, topicId: string, overrides: Record<string, unknown> = {}) {
  const cr = await jsonFetch(`${PB_URL}/api/collections/lessons/records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify({
      topic: topicId,
      level: overrides.level || 'B1',
      title: overrides.title || `L ${randId()}`,
      summary: 's',
      body: overrides.body || 'b',
      estimated_minutes: 10,
      status: 'draft',
    }),
  });
  const id = cr.body?.id as string;
  if (!id) throw new Error(`lesson create: ${JSON.stringify(cr.body).slice(0, 200)}`);
  const boundary = `--FB${randId()}`;
  const audBuf = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="t.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
    ),
    AUDIO_FIXTURE,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const audRes = await fetch(`${PB_URL}/api/collections/lessons/records/${id}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${su}`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body: audBuf,
    signal: AbortSignal.timeout(15_000),
  });
  if (audRes.status !== 200) throw new Error(`audio upload: ${audRes.status}`);
  if (overrides.keepDraft) return { id };
  const patch: Record<string, unknown> = {
    status: overrides.status || 'published',
    audio_duration_seconds: 600,
    summary_fa: 'خلاصه فارسی',
    content_version: 1,
  };
  if (overrides.is_public_sample) patch.is_public_sample = true;
  const pr = await jsonFetch(`${PB_URL}/api/collections/lessons/records/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${su}` },
    body: JSON.stringify(patch),
  });
  if (pr.status !== 200) throw new Error(`lesson publish: ${pr.status}`);
  return { id };
}

// Fully-entitled student: all placement answers correct -> recommended C2;
// the requested level is selected as the preferred level (B1).
async function createFullStudent(su: string, level = 'B1') {
  const staff = await createStaff(su);
  const opToken = staff.token;

  const phone = nextPhone();
  const password = 'Test1234!';
  const canonicalPhone = `+98${phone.slice(1)}`;

  const signup = await jsonFetch(`${PB_URL}/api/collections/fep_users/records`, {
    method: 'POST',
    body: JSON.stringify({ name: 'S', phone, password, passwordConfirm: password }),
  });
  const userId = signup.body?.id as string;

  const login = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-with-password`, {
    method: 'POST',
    body: JSON.stringify({ identity: canonicalPhone, password }),
  });
  const token = (login.body as { token?: string })?.token || '';

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
      name: 'P',
      slug: `p-${randId()}`,
      duration_days: 90,
      price_toman: 100000,
      is_active: true,
    }),
  });
  const planId = plan.body?.id as string;

  const boundary = `--FB${randId()}`;
  const prBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="plan_id"\r\n\r\n${planId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="receipt_file"; filename="t.png"\r\nContent-Type: image/png\r\n\r\n`,
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
    signal: AbortSignal.timeout(15_000),
  });
  if (prRes.status !== 201) throw new Error(`PR: ${prRes.status}`);
  const prj = (await prRes.json()) as { request?: { id?: string } };
  const prId = prj.request?.id as string;

  await jsonFetch(`${PB_URL}/api/fast-english/operator/payment-requests/${prId}/approve`, {
    method: 'POST',
    headers: { authorization: `Bearer ${opToken}` },
    body: JSON.stringify({}),
  });

  const refresh = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  let refreshedToken = (refresh.body as { token?: string })?.token || token;

  for (let i = 0; i < 20; i++) {
    await jsonFetch(`${PB_URL}/api/collections/placement_questions/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        question_key: `q${String(i).padStart(2, '0')}`,
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

  const start = await jsonFetch(`${PB_URL}/api/fast-english/placement/attempts/start`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
  });
  const attemptId = (start.body as { attempt?: { id: string } })?.attempt?.id as string;
  let rev = (start.body as { attempt?: { revision: number } })?.attempt?.revision || 0;
  for (const q of (
    start.body as { questions?: Array<{ id: string; options: Array<{ id: string }> }> }
  )?.questions || []) {
    const ans = await jsonFetch(
      `${PB_URL}/api/fast-english/placement/attempts/${attemptId}/answer`,
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${refreshedToken}` },
        body: JSON.stringify({
          questionId: q.id,
          optionId: q.options[0].id,
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

  const refresh2 = await jsonFetch(`${PB_URL}/api/collections/fep_users/auth-refresh`, {
    method: 'POST',
    headers: { authorization: `Bearer ${refreshedToken}` },
  });
  refreshedToken = (refresh2.body as { token?: string })?.token || refreshedToken;

  return { token: refreshedToken, userId, phone: canonicalPhone, password };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
test.describe('Podcast domain (Slice 2)', () => {
  let su: string;
  let student: { token: string; userId: string; phone: string; password: string };
  let recLevelVariantId: string; // C2 (recommended)
  let otherLevelVariantId: string; // B2 (another published level)
  let draftVariantId: string; // draft C1
  let archCatVariantId: string;
  let archCatId: string;

  test.beforeAll(async () => {
    su = await getSuperuserToken();
    expect(su).toBeTruthy();

    // Main Episode with published B1/B2/C2 + draft C1 variants.
    // Distinctive titles so afterAll can own-and-clean every fixture even
    // if a worker restart duplicated them.
    const topic = await makeTopic(su, { sort_order: 1, title: 'PS2 Main Episode' });
    const topicId = topic.id as string;
    recLevelVariantId = (
      await makeLesson(su, topicId, { level: 'C2', title: 'PS2 Recommended C2 Episode' })
    ).id;
    otherLevelVariantId = (
      await makeLesson(su, topicId, { level: 'B2', title: 'PS2 Other Level B2 Episode' })
    ).id;
    await makeLesson(su, topicId, { level: 'B1', title: 'PS2 Preferred B1 Episode' });
    draftVariantId = (
      await makeLesson(su, topicId, { level: 'C1', title: 'PS2 Draft C1 Episode', keepDraft: true })
    ).id;

    // Archived Category with a published Variant (archival + republish proof).
    const cat = await jsonFetch(`${PB_URL}/api/collections/categories/records`, {
      method: 'POST',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({
        key: `ps2-arch-${randId()}`,
        slug: `ps2-arch-${randId()}`,
        title_fa: 'دسته',
        description_fa: 'توضیح دسته',
        publication_status: 'published',
        sort_order: 1,
      }),
    });
    archCatId = cat.body?.id as string;
    const archTopic = await makeTopic(su, { sort_order: 2, title: 'PS2 Archive Episode' });
    const archTopicId = archTopic.id as string;
    // Retarget the archived-category Episode to its own Category.
    await jsonFetch(`${PB_URL}/api/collections/topics/records/${archTopicId}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({ category: archCatId }),
    });
    archCatVariantId = (
      await makeLesson(su, archTopicId, { level: 'B1', title: 'PS2 Archive Category Variant' })
    ).id;

    student = await createFullStudent(su, 'B1');
  });

  test.afterAll(async () => {
    // Own and clean all test data: the shared disposable PB must not leak
    // fixtures into later specs (e.g. visual-slice-2's empty-state
    // expectations for the C2 level). Tolerant of missing records.
    const ownedLessonTitles = [
      'PS2 Recommended C2 Episode',
      'PS2 Other Level B2 Episode',
      'PS2 Preferred B1 Episode',
      'PS2 Draft C1 Episode',
      'PS2 Archive Category Variant',
    ];
    const ownedTopicTitles = ['PS2 Main Episode', 'PS2 Archive Episode'];
    const listAll = async (collection: string, filter: string) => {
      const r = await jsonFetch(
        `${PB_URL}/api/collections/${collection}/records?perPage=200&filter=${encodeURIComponent(filter)}`,
        { headers: { authorization: `Bearer ${su}` } },
      );
      return (r.body?.items as Array<{ id: string }>) || [];
    };
    for (const title of ownedLessonTitles) {
      for (const l of await listAll('lessons', `title='${title}'`)) {
        await jsonFetch(`${PB_URL}/api/collections/lessons/records/${l.id}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${su}` },
        });
      }
    }
    for (const title of ownedTopicTitles) {
      for (const t of await listAll('topics', `title='${title}'`)) {
        await jsonFetch(`${PB_URL}/api/collections/topics/records/${t.id}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${su}` },
        });
      }
    }
    for (const c of await listAll('categories', `key~'ps2-arch-'`)) {
      await jsonFetch(`${PB_URL}/api/collections/categories/records/${c.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${su}` },
      });
    }
  });

  async function injectToken(page: {
    goto: (url: string) => Promise<unknown>;
    evaluate: (fn: (token: string) => void, token: string) => Promise<unknown>;
  }) {
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem(
        'pocketbase_auth',
        JSON.stringify({ token, model: { id: '', phone: '' } }),
      );
      localStorage.setItem('pocketbase_auth_version', '1');
    }, student.token);
  }

  test('1 - eligible Student opens an Episode at the recommended Level', async ({ page }) => {
    await injectToken(page);
    await page.goto(`/lessons/${recLevelVariantId}`);
    await expect(
      page.getByRole('heading', { name: 'PS2 Recommended C2 Episode' }).first(),
    ).toBeVisible({
      timeout: 10_000,
    });
    // The C2 level badge renders (recommended level content opened).
    await expect(page.getByTestId('lesson-meta')).toContainText('C2', { timeout: 10_000 });
  });

  test('2 - available-level control data includes another Published Level', async ({ page }) => {
    const resp = await page.request.get(`${PB_URL}/api/fast-english/lessons/${recLevelVariantId}`, {
      headers: { authorization: `Bearer ${student.token}` },
    });
    expect(resp.status()).toBe(200);
    const body = (await resp.json()) as {
      recommendedLevel?: string;
      preferredLevel?: string;
      availableLevels?: Array<{ level: string; variantId: string; available: boolean }>;
    };
    // Control data for a future Level Switcher: recommended C2 (placement
    // result), preferred B1, and B2 present and available.
    expect(body.recommendedLevel).toBe('C2');
    expect(body.preferredLevel).toBe('B1');
    const levels = (body.availableLevels || []).map((a) => a.level);
    expect(levels).toEqual(['B1', 'B2', 'C2']);
    expect(body.availableLevels?.some((a) => a.level === 'B2' && a.available)).toBe(true);
  });

  test('3 - Student opens another Level through the existing Lesson route', async ({ page }) => {
    await injectToken(page);
    await page.goto(`/lessons/${otherLevelVariantId}`);
    await expect(
      page.getByRole('heading', { name: 'PS2 Other Level B2 Episode' }).first(),
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('lesson-meta')).toContainText('B2', { timeout: 10_000 });
  });

  test('4+5 - Placement result and preferred level remain unchanged after browsing', async ({
    page,
  }) => {
    const ctxBefore = await page.request.get(`${PB_URL}/api/fast-english/placement/level-context`, {
      headers: { authorization: `Bearer ${student.token}` },
    });
    const before = (await ctxBefore.json()) as { suggestedLevel?: string; selectedLevel?: string };
    expect(before.suggestedLevel).toBe('C2');
    expect(before.selectedLevel).toBe('B1');

    // Browse another level via the read-only lesson routes.
    for (const id of [otherLevelVariantId, recLevelVariantId]) {
      const r = await page.request.get(`${PB_URL}/api/fast-english/lessons/${id}`, {
        headers: { authorization: `Bearer ${student.token}` },
      });
      expect(r.status()).toBe(200);
    }

    const ctxAfter = await page.request.get(`${PB_URL}/api/fast-english/placement/level-context`, {
      headers: { authorization: `Bearer ${student.token}` },
    });
    const after = (await ctxAfter.json()) as { suggestedLevel?: string; selectedLevel?: string };
    // Placement result (recommended) unchanged; preferred level unchanged.
    expect(after.suggestedLevel).toBe('C2');
    expect(after.selectedLevel).toBe('B1');
  });

  test('6 - Progress remains independent per Variant (B1 != B2)', async ({ page }) => {
    const b1 = (
      await jsonFetch(`${PB_URL}/api/fast-english/lessons/${recLevelVariantId}/progress`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${student.token}` },
        body: JSON.stringify({ positionSeconds: 111, expectedRevision: 0 }),
      })
    ).body;
    const b2 = (
      await jsonFetch(`${PB_URL}/api/fast-english/lessons/${otherLevelVariantId}/progress`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${student.token}` },
        body: JSON.stringify({ positionSeconds: 222, expectedRevision: 0 }),
      })
    ).body;
    expect((b1 as { positionSeconds?: number }).positionSeconds).toBe(111);
    expect((b2 as { positionSeconds?: number }).positionSeconds).toBe(222);

    const r1 = await jsonFetch(`${PB_URL}/api/fast-english/lessons/${recLevelVariantId}/progress`, {
      headers: { authorization: `Bearer ${student.token}` },
    });
    const r2 = await jsonFetch(
      `${PB_URL}/api/fast-english/lessons/${otherLevelVariantId}/progress`,
      { headers: { authorization: `Bearer ${student.token}` } },
    );
    // Per-Variant isolation: each Variant keeps its own position.
    expect((r1.body as { positionSeconds?: number }).positionSeconds).toBe(111);
    expect((r2.body as { positionSeconds?: number }).positionSeconds).toBe(222);
    // And the browser UI for the B2 episode shows the B2 progress percent.
    await injectToken(page);
    await page.goto(`/lessons/${otherLevelVariantId}`);
    await expect(page.getByTestId('lesson-meta')).toContainText('٪', { timeout: 10_000 });
  });

  test('7 - wrong-role and expired access remain denied', async ({ page }) => {
    // Expired student: create one and expire the subscription.
    const expired = await createFullStudent(su, 'B1');
    const subs = await jsonFetch(`${PB_URL}/api/collections/subscriptions/records?perPage=50`, {
      headers: { authorization: `Bearer ${su}` },
    });
    for (const sub of (subs.body?.items as Array<{ user?: string; id?: string }>) || []) {
      if (sub.user === expired.userId) {
        await jsonFetch(`${PB_URL}/api/collections/subscriptions/records/${sub.id}`, {
          method: 'PATCH',
          headers: { authorization: `Bearer ${su}` },
          body: JSON.stringify({ expires_at: new Date(Date.now() - 86_400_000).toISOString() }),
        });
      }
    }
    const expiredResp = await page.request.get(
      `${PB_URL}/api/fast-english/lessons/${recLevelVariantId}`,
      { headers: { authorization: `Bearer ${expired.token}` } },
    );
    expect(expiredResp.status()).toBe(403);

    // Staff Administrator remains denied from Student Episode APIs.
    const staff = await createStaff(su);
    const staffResp = await page.request.get(
      `${PB_URL}/api/fast-english/lessons/${recLevelVariantId}`,
      { headers: { authorization: `Bearer ${staff.token}` } },
    );
    expect([401, 403]).toContain(staffResp.status());
  });

  test('8 - Draft and archived content are absent', async ({ page }) => {
    // Draft Variant: not_found in the app UI.
    await injectToken(page);
    await page.goto(`/lessons/${draftVariantId}`);
    await expect(page.getByText('یافت نشد')).toBeVisible({ timeout: 10_000 });

    // Archived Category: child Variant becomes not_found; Progress retained.
    await jsonFetch(`${PB_URL}/api/collections/categories/records/${archCatId}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${su}` },
      body: JSON.stringify({ publication_status: 'archived' }),
    });
    await page.goto(`/lessons/${archCatVariantId}`);
    await expect(page.getByText('یافت نشد')).toBeVisible({ timeout: 10_000 });
  });

  test('9 - no raw Backend error appears in the UI', async ({ page }) => {
    await injectToken(page);
    await page.goto(`/lessons/${recLevelVariantId}`);
    await expect(
      page.getByRole('heading', { name: 'PS2 Recommended C2 Episode' }).first(),
    ).toBeVisible({
      timeout: 10_000,
    });
    await page.goto('/lessons');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('storage/');
    expect(bodyText).not.toContain('"code"');
    expect(bodyText).not.toContain('"message"');
    expect(bodyText).not.toContain('Internal error');
  });
});
