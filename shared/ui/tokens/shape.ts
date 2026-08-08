// Shape (border-radius) tokens.
//
// A small set of semantic roles. Pill is reserved for Chips, compact
// statuses and intentionally pill-shaped controls only; inputs and buttons
// share a consistent radius family; hero/current-task surfaces may use the
// more expressive radiusHero; dialogs fit small viewports (max 28px).

export const radius = {
  radiusControl: 10,
  radiusInput: 12,
  radiusCard: 16,
  radiusDialog: 20,
  radiusHero: 24,
  radiusPill: 999,
} as const;

export type ShapeRole = keyof typeof radius;

// MUI `shape.borderRadius` fallback for components without an explicit role.
export const defaultBorderRadius = radius.radiusInput;
