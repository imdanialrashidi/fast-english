// app/src/features/home/api.ts
// Podcast Slice 5 — Home data loader.
//
// One parallel load from the existing Student endpoints (no new backend
// contract): the preferred-level published Episode list, the Continue
// Listening item, the level-scoped progress summary and the subscription
// summary. Errors degrade per surface: the Episode list is required;
// Continue falls back to the first-use state; progress and subscription
// degrade to hidden/retry without taking the page down.

import * as lessonsApi from '../lessons/api';
import * as placementApi from '../placement/api';
import * as progressApi from '../progress/api';
import type { ContinueResponse } from '../progress/types';
import type { HomeInputs } from './logic';

export interface HomeData extends HomeInputs {
  /** True when the required Episode list request failed. */
  listFailed: boolean;
}

export interface HomeApiResult {
  data: HomeData | null;
  /** True when the Continue request failed (first-use fallback used). */
  continueFailed: boolean;
  summaryFailed: boolean;
  subscriptionFailed: boolean;
}

export async function loadHomeData(recommendedLevel: string): Promise<HomeApiResult> {
  const [listResult, continueResult, summaryResult, dashboardResult] = await Promise.all([
    lessonsApi.getLessonList(1, 50).then(
      (r) => ({ ok: true as const, value: r }),
      () => ({ ok: false as const, value: null }),
    ),
    progressApi.getContinueLearning().then(
      (r) => ({ ok: true as const, value: r }),
      () => ({ ok: false as const, value: null }),
    ),
    progressApi.getProgressSummary().then(
      (r) => ({ ok: true as const, value: r }),
      () => ({ ok: false as const, value: null }),
    ),
    placementApi.getDashboard().then(
      (r) => ({ ok: true as const, value: r }),
      () => ({ ok: false as const, value: null }),
    ),
  ]);

  const episodes = listResult.ok ? listResult.value.lessons : [];
  const summary = summaryResult.ok ? summaryResult.value : null;
  const subscription = dashboardResult.ok ? dashboardResult.value.subscription : null;

  const continueResponse: ContinueResponse = continueResult.ok
    ? continueResult.value
    : { kind: 'no_lessons', message: '' };

  const preferredLevel = summary?.selectedLevel || listResult.value?.preferredLevel || '';

  const data: HomeData = {
    listFailed: !listResult.ok,
    episodes,
    continueResponse,
    summary,
    subscription,
    preferredLevel,
    // Placement result — never changed by browsing (normalized by the route).
    recommendedLevel,
  };

  return {
    data,
    continueFailed: !continueResult.ok,
    summaryFailed: !summaryResult.ok,
    subscriptionFailed: !dashboardResult.ok,
  };
}
