// admin/src/features/settings/api.ts
// Business Configuration slice — Staff Business Settings API client.
// All routes require an active staff_admins session (server-verified);
// responses are sanitized server-side. No secrets ever cross this API.

import { getPocketBase } from '../../auth/pocketbase';
import type { BusinessDestination, BusinessPlan, BusinessSettings, BusinessSite } from './types';

function pbUrl(path: string): string {
  const pb = getPocketBase();
  const base = pb.baseUrl ?? '';
  return `${base}${path}`;
}

async function request<T>(
  token: string,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(pbUrl(path), {
    ...init,
    headers: {
      authorization: token,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      JSON.stringify({
        status: res.status,
        code: (body as { code?: string }).code ?? 'unexpected_error',
        message: (body as { message?: string }).message ?? 'Request failed',
      }),
    );
  }
  return res.json();
}

export async function fetchBusinessSettings(
  token: string,
  signal?: AbortSignal,
): Promise<BusinessSettings> {
  return request<BusinessSettings>(token, '/api/fast-english/staff/business-settings', {}, signal);
}

export async function createBusinessPlan(
  token: string,
  plan: Omit<BusinessPlan, 'id'>,
  signal?: AbortSignal,
): Promise<{ plan: BusinessPlan }> {
  return request<{ plan: BusinessPlan }>(
    token,
    '/api/fast-english/staff/business-settings/plans',
    {
      method: 'POST',
      body: JSON.stringify({
        name: plan.name,
        slug: plan.slug,
        duration_days: plan.durationDays,
        price_toman: plan.priceToman,
        is_active: plan.isActive,
        display_order: plan.displayOrder,
        description: plan.description,
      }),
    },
    signal,
  );
}

export async function updateBusinessPlan(
  token: string,
  planId: string,
  patch: Partial<Omit<BusinessPlan, 'id'>>,
  signal?: AbortSignal,
): Promise<{ plan: BusinessPlan }> {
  return request<{ plan: BusinessPlan }>(
    token,
    `/api/fast-english/staff/business-settings/plans/${planId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
        ...(patch.durationDays !== undefined ? { duration_days: patch.durationDays } : {}),
        ...(patch.priceToman !== undefined ? { price_toman: patch.priceToman } : {}),
        ...(patch.isActive !== undefined ? { is_active: patch.isActive } : {}),
        ...(patch.displayOrder !== undefined ? { display_order: patch.displayOrder } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
      }),
    },
    signal,
  );
}

export async function saveBusinessDestination(
  token: string,
  destination: Omit<BusinessDestination, 'id'>,
  signal?: AbortSignal,
): Promise<{ destination: BusinessDestination }> {
  return request<{ destination: BusinessDestination }>(
    token,
    '/api/fast-english/staff/business-settings/destination',
    {
      method: 'PUT',
      body: JSON.stringify({
        card_number: destination.cardNumber,
        card_holder_name: destination.cardHolderName,
        bank_name: destination.bankName,
        instructions: destination.instructions,
        review_sla_text: destination.reviewSlaText,
        support_contact: destination.supportContact,
        is_active: destination.isActive,
      }),
    },
    signal,
  );
}

export async function saveBusinessSite(
  token: string,
  site: BusinessSite,
  signal?: AbortSignal,
): Promise<{ site: BusinessSite }> {
  return request<{ site: BusinessSite }>(
    token,
    '/api/fast-english/staff/business-settings/site',
    {
      method: 'PATCH',
      body: JSON.stringify({ support_contact: site.supportContact }),
    },
    signal,
  );
}
