// app/src/features/payment/components/PlanSelector.tsx
// Display the list of active plans and let the user select exactly
// one. Selection is communicated by more than color: a check icon,
// aria-checked, and a border accent.
//
// Availability states (driven by the REAL backend state passed in):
//   - FREE plan (priceToman === 0) → «رایگان» chip, always selectable —
//     free plans never depend on the card-to-card toggle;
//   - paid plan with card transfer ENABLED → selectable, normal price;
//   - paid plan with card transfer DISABLED → «موقتاً در دسترس نیست»
//     chip, NOT selectable (aria-disabled) — no dead checkout.

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import { duration, easing } from '../../../../../shared/ui/tokens';
import { formatDurationDays, formatPlanPrice } from '../formatters';
import type { Plan } from '../types';

export interface PlanAvailability {
  /** True when card-to-card is currently enabled (server state). */
  cardTransferEnabled: boolean;
}

export function isPlanPurchasable(plan: Plan, availability: PlanAvailability): boolean {
  if (plan.priceToman === 0) return true; // free plans never need the toggle
  return availability.cardTransferEnabled;
}

export function PlanSelector({
  plans,
  selectedId,
  availability,
  onSelect,
}: {
  plans: Plan[];
  selectedId: string | null;
  availability: PlanAvailability;
  onSelect: (planId: string) => void;
}) {
  return (
    <Box
      role="radiogroup"
      aria-label="انتخاب طرح"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      {plans.map((plan) => {
        const isSelected = selectedId === plan.id;
        const purchasable = isPlanPurchasable(plan, availability);
        const isFree = plan.priceToman === 0;
        return (
          <Card
            key={plan.id}
            data-testid={`plan-${plan.id}`}
            sx={{
              borderColor: isSelected ? 'primary.main' : 'divider',
              borderWidth: isSelected ? 2 : 1,
              opacity: purchasable ? 1 : 0.62,
              transition: `border-color ${duration.durationFast}ms ${easing.easingStandard}`,
            }}
          >
            <CardActionArea
              role="radio"
              aria-checked={isSelected}
              aria-disabled={!purchasable}
              disabled={!purchasable}
              onClick={() => {
                if (purchasable) onSelect(plan.id);
              }}
              sx={{ minHeight: 88, p: 0, alignItems: 'stretch' }}
            >
              <CardContent sx={{ width: '100%' }}>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
                >
                  <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <Typography component="h3" variant="h4">
                        {plan.name}
                      </Typography>
                      {isSelected ? (
                        <CheckCircleRoundedIcon fontSize="small" color="primary" aria-hidden />
                      ) : null}
                    </Stack>
                    {plan.description ? (
                      <Typography variant="body2" color="text.secondary">
                        {plan.description}
                      </Typography>
                    ) : null}
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', pt: 0.5 }}>
                      <Chip
                        size="small"
                        label={`مبلغ: ${formatPlanPrice(plan.priceToman)}${isFree ? '' : ' تومان'}`}
                        variant={isFree ? 'filled' : 'outlined'}
                        color={isFree ? 'success' : 'default'}
                        data-testid={`plan-price-${plan.slug}`}
                      />
                      <Chip
                        size="small"
                        label={`مدت: ${formatDurationDays(plan.durationDays)}`}
                        variant="outlined"
                      />
                      {!purchasable ? (
                        <Chip
                          size="small"
                          label="موقتاً در دسترس نیست"
                          variant="outlined"
                          data-testid={`plan-unavailable-${plan.slug}`}
                        />
                      ) : null}
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}
