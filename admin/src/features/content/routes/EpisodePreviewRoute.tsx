// admin/src/features/content/routes/EpisodePreviewRoute.tsx
// Secure Staff-only preview of Episode content (including Drafts).
// Renders the sanitized representation served by the Staff preview API;
// Students never see this route or its data.

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { artworkUrl, audioUrl, fetchPreview } from '../api';
import { formatDuration, statusLabel } from '../presentation';
import type { PreviewEpisode } from '../types';

type LoadState = { kind: 'loading' } | { kind: 'ready'; data: PreviewEpisode } | { kind: 'error' };

export function EpisodePreviewRoute() {
  const { episodeId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [level, setLevel] = useState(searchParams.get('level') ?? '');

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const data = await fetchPreview(episodeId);
      setState({ kind: 'ready', data });
    } catch {
      setState({ kind: 'error' });
    }
  }, [episodeId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') {
    return (
      <PageContainer maxWidth="lg">
        <StatePanel variant="loading" title="در حال بارگذاری…" />
      </PageContainer>
    );
  }
  if (state.kind === 'error') {
    return (
      <PageContainer maxWidth="lg">
        <StatePanel variant="error" title="پیشنمایش در دسترس نیست" />
      </PageContainer>
    );
  }

  const { episode, variants } = state.data;
  const activeLevel =
    level && variants.some((v) => v.level === level) ? level : (variants[0]?.level ?? '');
  const active = variants.find((v) => v.level === activeLevel);

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title={`پیشنمایش — ${episode.titleFa}`}
        subtitle={`${episode.contentKey} — وضعیت: ${statusLabel(episode.status)}`}
      />
      <Alert severity="info" sx={{ mb: 3 }}>
        این پیشنمایش فقط برای کارکنان است؛ محتوای پیشنویس برای دانشجویان در دسترس نیست.
      </Alert>
      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              {episode.artworkPresent ? (
                <Box
                  component="img"
                  src={artworkUrl(episode.id)}
                  alt="تصویر اصلی اپیزود"
                  sx={{
                    width: { xs: '100%', sm: 220 },
                    height: { xs: 'auto', sm: 220 },
                    objectFit: 'cover',
                    borderRadius: 2,
                  }}
                  data-testid="preview-artwork"
                />
              ) : (
                <Box
                  sx={{
                    width: { xs: '100%', sm: 220 },
                    height: 160,
                    borderRadius: 2,
                    backgroundColor: 'surfaceContainerHigh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    بدون تصویر
                  </Typography>
                </Box>
              )}
              <Stack spacing={1}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {episode.titleFa}
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  dir="ltr"
                  sx={{ textAlign: 'start' }}
                >
                  {episode.title}
                </Typography>
                {episode.category ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`دستهبندی: ${episode.category.titleFa}`}
                  />
                ) : null}
                {episode.episodeNumber ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`اپیزود ${episode.episodeNumber.toLocaleString('fa-IR')}`}
                  />
                ) : null}
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {episode.descriptionFa}
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {variants.length === 0 ? (
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                هنوز نسخه سطحی ساخته نشده است.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <>
            <Tabs
              value={activeLevel}
              onChange={(_, value) => setLevel(value)}
              variant="scrollable"
              scrollButtons="auto"
              data-testid="preview-level-tabs"
            >
              {variants.map((v) => (
                <Tab key={v.level} value={v.level} label={`سطح ${v.level}`} dir="ltr" />
              ))}
            </Tabs>
            {active ? (
              <Stack spacing={3} data-testid="preview-variant">
                <Card>
                  <CardContent>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`سطح ${active.level}`}
                        dir="ltr"
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`وضعیت: ${statusLabel(active.status)}`}
                      />
                      {active.audioDurationSeconds > 0 ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={formatDuration(active.audioDurationSeconds)}
                          dir="ltr"
                        />
                      ) : null}
                    </Stack>
                    <Typography variant="body1" sx={{ mt: 1.5, fontWeight: 600 }}>
                      خلاصه
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: 'pre-wrap' }}
                      data-testid="preview-summary"
                    >
                      {active.summaryFa || '—'}
                    </Typography>
                    {active.audioPresent ? (
                      <>
                        <Typography variant="body1" sx={{ mt: 2, fontWeight: 600 }}>
                          صوت
                        </Typography>
                        <Box
                          component="audio"
                          controls
                          preload="none"
                          src={audioUrl(active.id)}
                          dir="ltr"
                          sx={{ width: '100%', maxWidth: 480 }}
                          data-testid="preview-audio"
                        />
                      </>
                    ) : null}
                    <Typography variant="body1" sx={{ mt: 2, fontWeight: 600 }}>
                      متن اپیزود
                    </Typography>
                    <Box
                      dir="ltr"
                      sx={{
                        textAlign: 'start',
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.95rem',
                        lineHeight: 1.8,
                      }}
                      data-testid="preview-transcript"
                    >
                      {active.transcript || '—'}
                    </Box>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                      واژگان ({active.vocabulary.length.toLocaleString('fa-IR')})
                    </Typography>
                    {active.vocabulary.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        واژهای ثبت نشده است.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {active.vocabulary.map((v) => (
                          <Stack
                            key={v.id}
                            direction="row"
                            spacing={2}
                            sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
                          >
                            <Typography
                              variant="body2"
                              dir="ltr"
                              sx={{ fontWeight: 700, textAlign: 'start', minWidth: 120 }}
                            >
                              {v.term}
                            </Typography>
                            <Typography variant="body2">{v.meaningFa}</Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              dir="ltr"
                              sx={{ textAlign: 'start' }}
                            >
                              {v.definitionEn}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Stack>
            ) : null}
          </>
        )}
      </Stack>
      <Box sx={{ mt: 3 }}>
        <Button
          variant="outlined"
          component="a"
          href={`/content/episodes/${episode.id}`}
          sx={{ minHeight: 44 }}
        >
          بازگشت به ویرایش
        </Button>
      </Box>
    </PageContainer>
  );
}
