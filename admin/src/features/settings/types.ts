// admin/src/features/settings/types.ts
// Business Configuration slice — Staff Business Settings types (mirrors
// the sanitized shapes of server/pb_hooks/business_settings_routes.pb.js).

export interface BusinessPlan {
  id: string;
  name: string;
  slug: string;
  durationDays: number;
  priceToman: number;
  isActive: boolean;
  displayOrder: number;
  description: string;
}

export interface BusinessDestination {
  id: string | null;
  cardNumber: string;
  cardHolderName: string;
  bankName: string;
  instructions: string;
  reviewSlaText: string;
  supportContact: string;
  isActive: boolean;
}

export interface BusinessSite {
  supportContact: string;
}

export interface BusinessSettings {
  plans: BusinessPlan[];
  destination: BusinessDestination | null;
  site: BusinessSite;
}
