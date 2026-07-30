// app/src/features/placement/api.ts
// Typed API wrappers for placement custom routes.
// Uses pb.send() for custom routes to leverage auth headers.

import { getPocketBase } from '../../lib/pocketbase';
import { PLACEMENT_API_BASE } from './constants';
import {
  dashboardResponseSchema,
  levelContextResponseSchema,
  placementResponseSchema,
  selectLevelRequestSchema,
  selectLevelResponseSchema,
} from './schemas';
import type {
  DashboardResponse,
  LevelContextResponse,
  PlacementResponse,
  SaveAnswerInput,
  SelectLevelRequest,
  SelectLevelResponse,
  SubmitInput,
} from './types';

function pb() {
  return getPocketBase();
}

export async function startOrResumeAttempt(): Promise<PlacementResponse> {
  const raw = await pb().send<Record<string, unknown>>(`${PLACEMENT_API_BASE}/attempts/start`, {
    method: 'POST',
  });
  return placementResponseSchema.parse(raw);
}

export async function saveAnswer(
  attemptId: string,
  input: SaveAnswerInput,
): Promise<PlacementResponse> {
  const raw = await pb().send<Record<string, unknown>>(
    `${PLACEMENT_API_BASE}/attempts/${attemptId}/answer`,
    {
      method: 'PUT',
      body: input,
    },
  );
  return placementResponseSchema.parse(raw);
}

export async function submitAttempt(
  attemptId: string,
  input: SubmitInput,
): Promise<PlacementResponse> {
  const raw = await pb().send<Record<string, unknown>>(
    `${PLACEMENT_API_BASE}/attempts/${attemptId}/submit`,
    {
      method: 'POST',
      body: input,
    },
  );
  return placementResponseSchema.parse(raw);
}

// P2-S2 API wrappers

export async function getLevelContext(): Promise<LevelContextResponse> {
  const raw = await pb().send<Record<string, unknown>>(`${PLACEMENT_API_BASE}/level-context`, {
    method: 'GET',
  });
  return levelContextResponseSchema.parse(raw);
}

export async function selectLevel(input: SelectLevelRequest): Promise<SelectLevelResponse> {
  // Validate client-side that no forbidden fields are sent
  const parsed = selectLevelRequestSchema.parse(input);
  const raw = await pb().send<Record<string, unknown>>(`${PLACEMENT_API_BASE}/selected-level`, {
    method: 'POST',
    body: parsed,
  });
  return selectLevelResponseSchema.parse(raw);
}

export async function getDashboard(): Promise<DashboardResponse> {
  const raw = await pb().send<Record<string, unknown>>('/api/fast-english/dashboard', {
    method: 'GET',
  });
  return dashboardResponseSchema.parse(raw);
}
