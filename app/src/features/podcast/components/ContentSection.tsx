// app/src/features/podcast/components/ContentSection.tsx
// Podcast Slice 5 — reusable Student content-section pattern.
//
// One shared heading row (title + optional orientation description +
// optional action) so Home and the future Library never duplicate
// section-heading markup. The heading row wraps instead of colliding:
// long titles and actions never overlap (§33 responsive gate).

import { Box, Stack, Typography } from '@mui/material';
import { useId } from 'react';

export interface ContentSectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  'data-testid'?: string;
}

export function ContentSection({
  title,
  description,
  action,
  children,
  'data-testid': testId,
}: ContentSectionProps) {
  const titleId = useId();
  return (
    <Box component="section" data-testid={testId} aria-labelledby={titleId}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          mb: 1.5,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline', minWidth: 0 }}>
          <Typography
            component="h2"
            id={titleId}
            variant="headlineSmall"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          ) : null}
        </Stack>
        {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
      </Stack>
      {children}
    </Box>
  );
}
