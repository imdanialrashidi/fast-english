import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export type StateVariant =
  | 'loading'
  | 'empty'
  | 'error'
  | 'permission'
  | 'offline'
  | 'unavailable'
  | 'success';

interface StateMeta {
  title: string;
  icon: string;
  iconColor: 'text' | 'error' | 'warning' | 'primary' | 'success';
}

const labels: Record<StateVariant, StateMeta> = {
  loading: { title: 'در حال بارگذاری…', icon: '⏳', iconColor: 'text' },
  empty: { title: 'چیزی برای نمایش نیست', icon: '◌', iconColor: 'text' },
  error: { title: 'خطایی رخ داد', icon: '⚠', iconColor: 'error' },
  permission: { title: 'دسترسی ندارید', icon: '🔒', iconColor: 'warning' },
  offline: { title: 'اتصال برقرار نیست', icon: '⌁', iconColor: 'warning' },
  unavailable: { title: 'این بخش هنوز آماده نیست', icon: '◐', iconColor: 'text' },
  success: { title: 'انجام شد', icon: '✓', iconColor: 'success' },
};

// Reusable, accessible state presentation. Always combines an icon and text
// so state is not conveyed by color alone. Every state carries the "what",
// and (when known) the "why" + next action via `description`/`action`.
export function StatePanel({
  variant,
  title,
  description,
  action,
  requestId,
  'data-testid': testId,
}: {
  variant: StateVariant;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /**
   * Optional request identifier for support escalation. This is a
   * placeholder surface for the future Monitoring slice — the Monitoring
   * slice will populate real request IDs; nothing logs or persists it here.
   */
  requestId?: string;
  'data-testid'?: string;
}) {
  const meta = labels[variant];
  const iconSx =
    meta.iconColor === 'text'
      ? { color: 'text.primary' as const }
      : ({ color: `${meta.iconColor}.main` } as const);
  return (
    <Card
      data-testid={testId ?? `state-${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
      sx={{ width: '100%' }}
    >
      <CardContent>
        <Stack spacing={2} sx={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Box
            aria-hidden
            sx={{
              fontSize: 28,
              lineHeight: 1,
              pt: 0.5,
              ...iconSx,
            }}
          >
            {meta.icon}
          </Box>
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h2" variant="h4">
              {title ?? meta.title}
            </Typography>
            {description ? (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            ) : null}
            {action ? <Box sx={{ pt: 1 }}>{action}</Box> : null}
            {requestId ? (
              <Typography variant="caption" color="text.secondary" data-testid="state-request-id">
                شناسهٔ درخواست: {requestId}
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
