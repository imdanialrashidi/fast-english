// admin/src/features/content/components/ReadinessPanel.tsx
// Authoritative Content Readiness panel: errors (block publish),
// warnings (do not block), preconditions (guide parent publish) and the
// legacy-published notice. Copy comes from the server payload.

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { statusLabel } from '../presentation';
import type { ReadinessIssue } from '../types';

export interface ReadinessPanelProps {
  /** Episode-level readiness. */
  episode: {
    status: string;
    ready: boolean;
    legacy: boolean;
    errors: ReadinessIssue[];
    warnings: ReadinessIssue[];
  } | null;
  /** Selected variant readiness (when viewing a variant). */
  variant?: {
    status: string;
    ready: boolean;
    legacy: boolean;
    errors: ReadinessIssue[];
    warnings: ReadinessIssue[];
    preconditions: ReadinessIssue[];
  } | null;
}

export function ReadinessPanel({ episode, variant }: ReadinessPanelProps) {
  const errors = [...(episode?.errors ?? []), ...(variant?.errors ?? [])];
  const warnings = [...(episode?.warnings ?? []), ...(variant?.warnings ?? [])];
  const preconditions = variant?.preconditions ?? [];
  const legacy = Boolean(episode?.legacy || variant?.legacy);
  const ready = (episode?.ready ?? false) && (variant ? variant.ready : true);

  return (
    <Stack spacing={1.5} data-testid="readiness-panel">
      <Typography variant="titleMedium">آمادگی انتشار</Typography>
      {episode ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip
            size="small"
            color={ready ? 'success' : 'error'}
            variant={ready ? 'filled' : 'outlined'}
            label={ready ? 'آماده انتشار' : 'آماده انتشار نیست'}
            data-testid="readiness-state"
          />
          <Typography variant="caption" color="text.secondary">
            وضعیت: {statusLabel(episode.status)}
          </Typography>
        </Stack>
      ) : null}
      {legacy ? (
        <Alert severity="info" icon={<InfoOutlinedIcon />}>
          این محتوا پیش از تکمیل فیلدهای جدید منتشر شده و فعلاً در دسترس است؛ انتشار مجدد نیازمند
          تکمیل موارد هشدار زیر است.
        </Alert>
      ) : null}
      {errors.length > 0 ? (
        <Alert severity="error" icon={<ErrorOutlineRoundedIcon />} data-testid="readiness-errors">
          <Box component="div">
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              این نسخه هنوز آماده انتشار نیست. موارد زیر را تکمیل کنید:
            </Typography>
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              {errors.map((e) => (
                <li key={`${e.code}-${e.message}`}>
                  <Typography variant="body2">{e.message}</Typography>
                </li>
              ))}
            </ul>
          </Box>
        </Alert>
      ) : null}
      {preconditions.length > 0 ? (
        <Alert
          severity="warning"
          icon={<WarningAmberRoundedIcon />}
          data-testid="readiness-preconditions"
        >
          <Box component="div">
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              پیش از انتشار این نسخه:
            </Typography>
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              {preconditions.map((p) => (
                <li key={p.code}>
                  <Typography variant="body2">{p.message}</Typography>
                </li>
              ))}
            </ul>
          </Box>
        </Alert>
      ) : null}
      {warnings.length > 0 ? (
        <Alert
          severity="warning"
          icon={<WarningAmberRoundedIcon />}
          data-testid="readiness-warnings"
        >
          <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
            نکات (مانع انتشار نیستند):
          </Typography>
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            {warnings.map((w) => (
              <li key={`${w.code}-${w.message}`}>
                <Typography variant="body2">{w.message}</Typography>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {ready &&
      errors.length === 0 &&
      warnings.length === 0 &&
      preconditions.length === 0 &&
      !legacy ? (
        <Typography variant="body2" color="text.secondary">
          همه موارد لازم تکمیل شدهاند.
        </Typography>
      ) : null}
    </Stack>
  );
}
