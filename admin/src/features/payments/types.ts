// admin/src/features/payments/types.ts
// Podcast Slice 1 — Staff payment-review queue, detail, and subscription
// types (migrated from the legacy operator workspace).

// Mirror of the student account statuses surfaced by the Staff detail
// route. Defined locally: the Admin build must not import Student code.
export type StudentAccountStatus =
  | 'pending_payment'
  | 'payment_rejected'
  | 'active'
  | 'expired'
  | 'suspended';

export interface QueueItemStudent {
  id: string;
  name: string;
  maskedPhone: string;
}

export interface QueueItemReview {
  reviewedAt: string;
  publicRejectionReason: string | null;
}

export interface QueueItem {
  id: string;
  status: string;
  created: string;
  updated: string;
  requestAgeSeconds: number;
  planName: string;
  amountToman: number;
  durationDays: number;
  bankReference: string | null;
  senderCardLast4: string | null;
  transferAt: string | null;
  student: QueueItemStudent;
  review: QueueItemReview | null;
}

export interface QueueResponse {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: QueueItem[];
}

export interface SubscriptionSummary {
  id: string;
  startsAt: string;
  expiresAt: string;
  status: string;
  planName: string;
  durationDays: number;
}

export interface DetailStudent {
  id: string;
  name: string;
  phone: string;
  accountStatus: StudentAccountStatus;
  placementCompleted: boolean;
  selectedLevel: string | null;
  suspended: boolean;
}

export interface DetailReviewer {
  id: string;
  name: string;
}

export interface RequestDetail {
  id: string;
  status: string;
  created: string;
  updated: string;
  requestAgeSeconds: number;
  planId: string;
  planName: string;
  amountToman: number;
  durationDays: number;
  bankReference: string | null;
  senderCardLast4: string | null;
  transferAt: string | null;
  publicRejectionReason: string | null;
  internalNote: string | null;
  reviewedAt: string | null;
  reviewer: DetailReviewer | null;
  subscriptionId: string | null;
  student: DetailStudent | null;
  currentActiveSubscription: SubscriptionSummary | null;
  latestSubscription: SubscriptionSummary | null;
}

export interface ApproveResponse {
  kind: 'approved' | 'already_approved';
  id: string | null;
  status: string;
  startsAt: string;
  expiresAt: string;
  paymentRequestId: string;
}

export interface RejectResponse {
  kind: 'rejected' | 'already_rejected';
  paymentRequestId: string;
}

export type QueueStatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled';
