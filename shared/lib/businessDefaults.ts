// shared/lib/businessDefaults.ts
// Business Configuration slice — owner-approved default business values
// shared by the Student App and the Admin Business Settings surface.
//
// DEFAULT_REVIEW_SLA_TEXT: shown to the Student as the review ETA whenever
// the `payment_destination.review_sla_text` field is empty, and pre-filled
// in the Admin destination editor. The value stays configurable through
// Business Settings (the field is the canonical source when set).

export const DEFAULT_REVIEW_SLA_TEXT = 'حداکثر تا ۲۴ ساعت';
