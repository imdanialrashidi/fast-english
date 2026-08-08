// admin/src/features/content/routes/VariantEditorRoute.tsx
// Level Variant editor: five focused areas — خلاصه / صوت / متن اپیزود /
// واژگان / انتشار — with authoritative readiness and publish/archive.

import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import { Alert, Button, Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { archiveVariant, fetchEpisode, fetchVariant, publishVariant } from '../api';
import { AudioWorkspace } from '../components/AudioWorkspace';
import { ArchiveDialog, PublishDialog, UnsavedBlockerDialog } from '../components/ConfirmDialogs';
import { ReadinessPanel } from '../components/ReadinessPanel';
import { SummaryEditor } from '../components/SummaryEditor';
import { TranscriptEditor } from '../components/TranscriptEditor';
import { VocabularyEditor } from '../components/VocabularyEditor';
import { resolveContentError, safeErrorMessage } from '../errors';
import { statusLabel } from '../presentation';
import type { VariantDetail } from '../types';
import { useUnsavedState } from '../unsaved';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; variant: VariantDetail }
  | { kind: 'error' };

export function VariantEditorRoute() {
  const { episodeId = '', level = '' } = useParams();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [variantId, setVariantId] = useState<string | null>(null);
  const [publishIssues, setPublishIssues] = useState<string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const unsaved = useUnsavedState();

  // The route URL uses the level; resolve the variant id from the episode.
  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    void fetchEpisode(episodeId)
      .then((res) => {
        const v = res.episode.variants.find((x) => x.level === level);
        if (!v) {
          if (!cancelled) setState({ kind: 'error' });
          return;
        }
        if (!cancelled) setVariantId(v.id);
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [episodeId, level]);

  const load = useCallback(async () => {
    if (!variantId) return;
    setState({ kind: 'loading' });
    try {
      const res = await fetchVariant(variantId);
      setState({ kind: 'ready', variant: res.variant });
    } catch {
      setState({ kind: 'error' });
    }
  }, [variantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmPublish = async () => {
    if (state.kind !== 'ready') return;
    try {
      await publishVariant(state.variant.id);
      setPublishOpen(false);
      await load();
    } catch (err) {
      const resolved = resolveContentError(err);
      setPublishIssues(resolved.issues ?? [resolved.message]);
    }
  };

  const confirmArchive = async () => {
    if (state.kind !== 'ready') return;
    try {
      await archiveVariant(state.variant.id);
      setArchiveOpen(false);
      await load();
    } catch (err) {
      setActionError(safeErrorMessage(err));
    }
  };

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
        <StatePanel variant="error" title="نسخه سطح پیدا نشد" />
      </PageContainer>
    );
  }

  const { variant } = state;

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title={`ویرایش نسخه ${variant.level}`}
        subtitle={`${variant.episodeTitleFa} — ${statusLabel(variant.status)}`}
        action={
          <Button
            component={RouterLink}
            to={`/content/episodes/${episodeId}`}
            size="small"
            variant="outlined"
            sx={{ minHeight: 44 }}
          >
            بازگشت به اپیزود
          </Button>
        }
      />
      {actionError ? (
        <Alert severity="error" role="alert" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={3}>
            <SummaryEditor
              variantId={variant.id}
              initial={variant.summaryFa}
              unsaved={unsaved}
              onSaved={() => void load()}
            />
            <AudioWorkspace
              variantId={variant.id}
              audioPresent={variant.audioPresent}
              audioDurationSeconds={variant.audioDurationSeconds}
              status={variant.status}
              onChanged={() => void load()}
            />
            <TranscriptEditor
              variantId={variant.id}
              initial={variant.body}
              unsaved={unsaved}
              onSaved={() => void load()}
            />
            <VocabularyEditor
              variantId={variant.id}
              entries={variant.vocabulary}
              onChanged={() => void load()}
            />
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <ReadinessPanel episode={null} variant={variant.readiness} />
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="titleMedium">انتشار نسخه</Typography>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<PublishRoundedIcon />}
                    disabled={!variant.readiness?.ready}
                    onClick={() => {
                      setPublishIssues(variant.readiness?.errors.map((e) => e.message) ?? []);
                      setPublishOpen(true);
                    }}
                    data-testid="variant-publish-button"
                    sx={{ minHeight: 44 }}
                  >
                    انتشار نسخه
                  </Button>
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<ArchiveRoundedIcon />}
                    onClick={() => setArchiveOpen(true)}
                    data-testid="variant-archive-button"
                    sx={{ minHeight: 44 }}
                  >
                    بایگانی نسخه
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    {variant.status === 'published'
                      ? 'نسخه منتشرشده برای دانشجویان در دسترس است.'
                      : variant.status === 'archived'
                        ? 'این نسخه بایگانیشده است و از کتابخانه دانشجو پنهان است.'
                        : 'این نسخه هنوز پیشنویس است.'}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {unsaved.blocker.state === 'blocked' ? (
        <UnsavedBlockerDialog
          open
          onProceed={() => unsaved.blocker.proceed?.()}
          onStay={() => unsaved.blocker.reset?.()}
        />
      ) : null}

      {publishOpen ? (
        <PublishDialog
          open
          kind="variant"
          title={`سطح ${variant.level}`}
          issues={publishIssues}
          onConfirm={confirmPublish}
          onClose={() => setPublishOpen(false)}
        />
      ) : null}
      {archiveOpen ? (
        <ArchiveDialog
          open
          kind="variant"
          title={`سطح ${variant.level}`}
          impact="این نسخه از کتابخانه دانشجو پنهان میشود، اما پیشرفت کاربران حذف نخواهد شد."
          onConfirm={confirmArchive}
          onClose={() => setArchiveOpen(false)}
        />
      ) : null}
    </PageContainer>
  );
}
