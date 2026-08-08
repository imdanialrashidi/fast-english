// app/src/features/payment/components/PlanSelector.tsx
// Display the list of active plans and let the user select exactly
// one. Selection is communicated by more than color: a check icon,
// aria-checked, and a border accent.

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import { duration, easing } from '../../../../../shared/ui/tokens';
import { formatDurationDays, formatToman } from '../formatters';
import type { Plan } from '../types';

export function PlanSelector({
  plans,
  selectedId,
  onSelect,
}: {
  plans: Plan[];
  selectedId: string | null;
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
        return (
          <Card
            key={plan.id}
            data-testid={`plan-${plan.id}`}
            sx={{
              borderColor: isSelected ? 'primary.main' : 'divider',
              borderWidth: isSelected ? 2 : 1,
              transition: `border-color ${duration.durationFast}ms ${easing.easingStandard}`,
            }}
          >
            <CardActionArea
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(plan.id)}
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
                        label={`مبلغ: ${formatToman(plan.priceToman)} تومان`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`مدت: ${formatDurationDays(plan.durationDays)}`}
                        variant="outlined"
                      />
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
