// shared/lib/entitlement.ts
// Pure entitlement and masking helpers — fast unit layer for hooks.
// Mirrors the inlined hook entitlement block in progress_routes, lesson_routes, library_routes.

export interface StudentForEntitlement {
  account_status: string;
  placement_completed: boolean;
  selected_level: string;
}

export interface SubscriptionForEntitlement {
  starts_at: string;
  expires_at: string;
  status: string;
}

export function isStudentEntitled(
  student: StudentForEntitlement,
  nowMs: number,
  subs: SubscriptionForEntitlement[],
): { ok: boolean; code: string } {
  if (student.account_status === 'suspended') return { ok: false, code: 'account_suspended' };
  if (student.account_status !== 'active') return { ok: false, code: 'subscription_required' };
  if (!student.placement_completed || !student.selected_level) {
    return { ok: false, code: 'placement_incomplete' };
  }
  const hasSub = subs.some((s) => {
    const exp = new Date(s.expires_at).getTime();
    const start = new Date(s.starts_at).getTime();
    return (
      !Number.isNaN(exp) &&
      !Number.isNaN(start) &&
      start <= nowMs &&
      exp > nowMs &&
      s.status === 'active'
    );
  });
  if (!hasSub) return { ok: false, code: 'subscription_required' };
  return { ok: true, code: 'ok' };
}

export function maskPhone(phone: string): string {
  if (typeof phone !== 'string') return '';
  if (phone.length > 6) {
    return phone.substring(0, 5) + '****' + phone.slice(-1);
  }
  return phone;
}

// Placement helpers (pure) — mirrors server grading

export const TOTAL_Q = 20;

export function scoreToLevel(score: number): string {
  if (!Number.isFinite(score) || score < 0) return 'A1';
  if (score <= 3) return 'A1';
  if (score <= 7) return 'A2';
  if (score <= 11) return 'B1';
  if (score <= 15) return 'B2';
  if (score <= 17) return 'C1';
  return 'C2';
}

export function validateOptions(options: { id: string; label?: string; text?: string }[]): {
  ok: boolean;
  code: string;
} {
  if (!Array.isArray(options)) return { ok: false, code: 'invalid_options' };
  if (options.length < 2 || options.length > 6) return { ok: false, code: 'invalid_options_count' };
  const seen = new Set<string>();
  for (const opt of options) {
    if (!opt || typeof opt.id !== 'string' || !opt.id)
      return { ok: false, code: 'invalid_option_id' };
    if (seen.has(opt.id)) return { ok: false, code: 'duplicate_option_id' };
    seen.add(opt.id);
    const text =
      (opt as unknown as { text?: string }).text ??
      (opt as unknown as { label?: string }).label ??
      '';
    if (typeof text !== 'string' || text.trim().length === 0)
      return { ok: false, code: 'invalid_option_text' };
    if (/<[^>]+>/.test(text)) return { ok: false, code: 'option_html_not_allowed' };
  }
  return { ok: true, code: 'ok' };
}
