// admin/src/features/content/components/LevelMatrix.tsx
// Episode editor level matrix: one card per CEFR level with an explicit
// state, completeness indicators and allowed actions. Level order and
// copy come from the canonical shared helpers (never duplicated).

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import AudioFileRoundedIcon from '@mui/icons-material/AudioFileRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router';
import { formatDuration, LEVELS, variantCompleteness } from '../presentation';
import type { VariantListItem } from '../types';
import { ContentStatusChip } from './ContentStatusChip';

export interface LevelMatrixProps {
  episodeId: string;
  /** Variants keyed by level (only existing ones present). */
  variants: Record<string, VariantListItem>;
  /** Levels the operator may still create. */
  missingLevels: string[];
  onCreate: (level: string) => void;
  onCreateError?: string | null;
  busyLevel?: string | null;
}

export function LevelMatrix({
  episodeId,
  variants,
  onCreate,
  onCreateError,
  busyLevel,
}: LevelMatrixProps) {
  const navigate = useNavigate();
  return (
    <Box>
      {onCreateError ? (
        <Typography color="error" variant="body2" sx={{ mb: 2 }} role="alert">
          {onCreateError}
        </Typography>
      ) : null}
      <Grid container spacing={2}>
        {LEVELS.map((level) => {
          const variant = variants[level];
          if (!variant) {
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={level}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                      <Typography variant="titleMedium" sx={{ fontWeight: 700 }} dir="ltr">
                        {level}
                      </Typography>
                      <Chip label="ایجاد نشده" size="small" variant="outlined" />
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<AddRoundedIcon />}
                        disabled={busyLevel === level}
                        onClick={() => onCreate(level)}
                        data-testid={`create-variant-${level}`}
                        sx={{ minHeight: 44 }}
                      >
                        ایجاد نسخه
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          }
          const c = variantCompleteness(variant);
          const ready = variant.readiness?.ready ?? false;
          return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={level}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack spacing={1.25}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Typography variant="titleMedium" sx={{ fontWeight: 700 }} dir="ltr">
                        {level}
                      </Typography>
                      <ContentStatusChip status={variant.status} />
                    </Stack>
                    <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                      <CompletenessItem ok={c.audio} label="صوت" icon={<AudioFileRoundedIcon />} />
                      <CompletenessItem
                        ok={c.transcript}
                        label="متن"
                        icon={<ArticleRoundedIcon />}
                      />
                      <CompletenessItem ok={c.summary} label="خلاصه" icon={<CheckRoundedIcon />} />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${c.vocabularyCount} واژه`}
                        sx={{ fontWeight: 600 }}
                      />
                      {c.durationSeconds > 0 ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={formatDuration(c.durationSeconds)}
                          dir="ltr"
                        />
                      ) : null}
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditRoundedIcon />}
                        onClick={() => navigate(`/content/episodes/${episodeId}/variants/${level}`)}
                        data-testid={`edit-variant-${level}`}
                        sx={{ minHeight: 44 }}
                      >
                        ویرایش
                      </Button>
                      {ready ? (
                        <Tooltip title="پیشنمایش نسخه">
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<VisibilityRoundedIcon />}
                            onClick={() => navigate(`/content/preview/${episodeId}?level=${level}`)}
                          >
                            پیشنمایش
                          </Button>
                        </Tooltip>
                      ) : null}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

function CompletenessItem({
  ok,
  label,
  icon,
}: {
  ok: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Tooltip title={ok ? `✓ ${label}` : `${label} ناقص است`}>
      <Chip
        size="small"
        variant="outlined"
        color={ok ? 'success' : 'default'}
        icon={icon as never}
        label={label}
        sx={{ fontWeight: 600 }}
      />
    </Tooltip>
  );
}
