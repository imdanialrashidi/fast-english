// admin/src/features/content/presentation.ts
// Podcast Slice 4 — pure presentation helpers for the Content Studio:
// publication status copy, variant completeness indicators, readiness
// summaries, import-plan rows and CEFR order reuse (never duplicated).
//
// These are pure functions over the server-provided shapes; the server
// remains the authoritative readiness source.

import type { ContentDiagnostic } from '../../../../shared/content-package/types';
import {
  formatDateTime as sharedFormatDateTime,
  formatDuration as sharedFormatDuration,
} from '../../../../shared/lib/date';
import { CEFR_ORDER } from '../../../../shared/podcast/domain';
import type { EpisodeDetail, ImportPlanResponse, ReadinessIssue, VariantReadiness } from './types';

export const LEVELS: readonly string[] = CEFR_ORDER;

/** Publication-state copy (never color alone in the UI). */
export const STATUS_COPY: Record<string, string> = {
  draft: 'پیشنویس',
  published: 'منتشر شده',
  archived: 'آرشیو شده',
};

export function statusLabel(status: string): string {
  return STATUS_COPY[status] ?? status;
}

export function levelLabel(level: string): string {
  return LEVELS.includes(level) ? level : level;
}

export interface Completeness {
  audio: boolean;
  transcript: boolean;
  summary: boolean;
  duration: boolean;
  vocabularyCount: number;
  durationSeconds: number;
}

/** Completeness indicators from the variant payload (server truth). */
export function variantCompleteness(v: {
  audioPresent: boolean;
  audioDurationSeconds: number;
  summaryFa: string;
  vocabularyCount?: number;
  readiness?: VariantReadiness | null;
  body?: string;
}): Completeness {
  const readiness = v.readiness;
  const transcriptOk = readiness
    ? !readiness.errors.some((e) => e.code === 'VARIANT_TRANSCRIPT_MISSING')
    : v.body !== undefined && v.body.trim().length > 0;
  return {
    audio: v.audioPresent,
    transcript: transcriptOk,
    summary: v.summaryFa.trim().length > 0,
    duration: v.audioPresent && v.audioDurationSeconds > 0,
    vocabularyCount: v.vocabularyCount ?? 0,
    durationSeconds: v.audioDurationSeconds,
  };
}

/** "B1 — آماده انتشار" style one-line readiness summary. */
export function readinessSummary(r: VariantReadiness | null | undefined): string {
  if (!r?.present) return 'ایجاد نشده';
  if (r.status === 'published') return 'منتشر شده';
  if (r.status === 'archived') return 'آرشیو شده';
  if (r.errors.length === 0) {
    return r.preconditions.length > 0
      ? 'آماده انتشار — ابتدا اپیزود را منتشر کنید'
      : 'آماده انتشار';
  }
  return 'پیشنویس';
}

/** Blocking issues of an episode (publish gate). */
export function episodeBlockers(detail: EpisodeDetail): ReadinessIssue[] {
  return detail.readiness?.episode?.errors ?? [];
}

export function formatDuration(totalSeconds: number): string {
  return sharedFormatDuration(totalSeconds, { fallback: '—' });
}

export function formatDateTime(value: string | null | undefined): string {
  return sharedFormatDateTime(value, { style: 'short', fallback: '—' });
}

// --- Import plan presentation ---------------------------------------------

export type PlanActionLabel = 'create' | 'update' | 'none';

export const PLAN_ACTION_COPY: Record<string, string> = {
  create: 'ایجاد',
  update: 'بهروزرسانی',
  none: 'بدون تغییر',
};

export const IMPORT_RESULT_COPY: Record<string, string> = {
  new: 'ورود محتوا انجام شد',
  no_change: 'محتوا تغییری نکرده است.',
  update: 'ورود محتوا انجام شد',
  conflict: 'تعارض نسخه',
  stale: 'نسخه قدیمی',
  rejected: 'پذیرفته نشد',
};

export interface PlanRow {
  level: string;
  action: PlanActionLabel;
  actionCopy: string;
  vocabularyCount?: number;
  reason?: string;
}

/** Plan rows for the dry-run UI in canonical CEFR order. */
export function planRows(plan: ImportPlanResponse): PlanRow[] {
  const variants = [...plan.variants].sort(
    (a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level),
  );
  return variants.map((v) => {
    const vocab = plan.vocabulary.find((x) => x.level === v.level);
    return {
      level: v.level,
      action: (v.action === 'create' || v.action === 'update'
        ? v.action
        : 'none') as PlanActionLabel,
      actionCopy: PLAN_ACTION_COPY[v.action] ?? 'بدون تغییر',
      vocabularyCount: vocab?.count,
      reason: v.reason,
    };
  });
}

/** Summary line counts for the import result. */
export interface ImportCounts {
  created: number;
  updated: number;
  noChange: number;
  importedLevels: string[];
}

export function importCounts(plan: ImportPlanResponse): ImportCounts {
  const created = plan.summary.episodesCreate + plan.summary.variantsCreate;
  const updated = plan.summary.episodesUpdate + plan.summary.variantsUpdate;
  const noChange = plan.variants.filter((v) => v.action === 'none').length;
  const importedLevels = plan.variants
    .filter((v) => v.action !== 'none')
    .map((v) => v.level)
    .sort((a, b) => LEVELS.indexOf(a) - LEVELS.indexOf(b));
  return { created, updated, noChange, importedLevels };
}

/** Persist diagnostics (server or shared-module) as report rows. */
export interface DiagnosticRow {
  code: string;
  severity: 'error' | 'warning' | 'info';
  path: string;
  message: string;
}

export function diagnosticRows(diags: Array<ContentDiagnostic | DiagnosticRow>): DiagnosticRow[] {
  return diags.map((d) => ({
    code: d.code,
    severity: d.severity,
    path: d.path,
    message: d.message,
  }));
}

/** Report status for the validation screen. */
export function validationStatus(
  errors: unknown[],
  warnings: unknown[],
): { label: string; tone: 'error' | 'warning' | 'success' } {
  if (errors.length > 0) return { label: 'نامعتبر', tone: 'error' };
  if (warnings.length > 0) return { label: 'دارای هشدار', tone: 'warning' };
  return { label: 'معتبر', tone: 'success' };
}

/** Stale-plan copy per section 27. */
export const STALE_PLAN_COPY =
  'وضعیت محتوا از زمان بررسی تغییر کرده است. برنامه ورود دوباره محاسبه شد.';

/** No-change copy per section 28. */
export const NO_CHANGE_COPY = 'محتوا تغییری نکرده است.';
