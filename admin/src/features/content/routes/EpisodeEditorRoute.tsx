// admin/src/features/content/routes/EpisodeEditorRoute.tsx
// Episode editor: clear sections (اطلاعات اصلی / تصاویر / نسخههای سطح /
// پیشنمایش / انتشار) — never one enormous form. Desktop tabs; the same
// tabs stack cleanly on small screens.

import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Grid,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import {
  archiveEpisode,
  createVariant,
  fetchCategories,
  fetchEpisode,
  publishEpisode,
  updateEpisode,
} from '../api';
import { ArtworkWorkspace } from '../components/ArtworkWorkspace';
import { ArchiveDialog, PublishDialog, UnsavedBlockerDialog } from '../components/ConfirmDialogs';
import { LevelMatrix } from '../components/LevelMatrix';
import { ReadinessPanel } from '../components/ReadinessPanel';
import { SaveStateChip, saveStateOf } from '../components/SaveStateChip';
import { resolveContentError, safeErrorMessage } from '../errors';
import { LEVELS, statusLabel } from '../presentation';
import { slugify } from '../slug';
import type { CategorySummary, EpisodeDetail, VariantListItem } from '../types';
import { useUnsavedState } from '../unsaved';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; episode: EpisodeDetail }
  | { kind: 'error' };

const TABS = [
  { id: 'info', label: 'اطلاعات اصلی', icon: <InfoRoundedIcon /> },
  { id: 'images', label: 'تصاویر', icon: <ImageRoundedIcon /> },
  { id: 'levels', label: 'نسخههای سطح', icon: <LayersRoundedIcon /> },
  { id: 'preview', label: 'پیشنمایش', icon: <VisibilityRoundedIcon /> },
  { id: 'publish', label: 'انتشار', icon: <PublishRoundedIcon /> },
];

export function EpisodeEditorRoute() {
  const { episodeId = '' } = useParams();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [tab, setTab] = useState('info');
  const unsaved = useUnsavedState();

  // Basic info form state.
  const [form, setForm] = useState({
    title_fa: '',
    title: '',
    slug: '',
    category: '',
    description_fa: '',
    episode_number: '',
    is_featured: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [variantBusy, setVariantBusy] = useState<string | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [publishIssues, setPublishIssues] = useState<string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetchEpisode(episodeId);
      const ep = res.episode;
      setForm({
        title_fa: ep.titleFa,
        title: ep.titleEn,
        slug: ep.slug,
        category: ep.category?.id ?? '',
        description_fa: ep.descriptionFa,
        episode_number: ep.episodeNumber !== null ? String(ep.episodeNumber) : '',
        is_featured: ep.isFeatured,
      });
      setState({ kind: 'ready', episode: ep });
    } catch {
      setState({ kind: 'error' });
    }
  }, [episodeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetchCategories()
      .then((res) => setCategories(res.items))
      .catch(() => {});
  }, []);

  const saveBasic = async () => {
    setFormError(null);
    if (!form.title_fa.trim()) {
      setFormError('عنوان فارسی الزامی است.');
      return;
    }
    let slug = form.slug.trim();
    if (!slug) slug = slugify(form.title || form.title_fa);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setFormError('شناسه انگلیسی باید با حروف کوچک لاتین و خط تیره نوشته شود.');
      return;
    }
    if (!form.category) {
      setFormError('دستهبندی را انتخاب کنید.');
      return;
    }
    unsaved.beginSave();
    try {
      await updateEpisode(episodeId, {
        title_fa: form.title_fa,
        title: form.title,
        slug,
        category: form.category,
        description_fa: form.description_fa,
        episode_number: form.episode_number ? Number(form.episode_number) : null,
        is_featured: form.is_featured,
      });
      unsaved.finishSave(true);
      await load();
    } catch (err) {
      setFormError(safeErrorMessage(err));
      unsaved.finishSave(false);
    }
  };

  const handleCreateVariant = async (level: string) => {
    setVariantError(null);
    setVariantBusy(level);
    try {
      await createVariant(episodeId, level);
      await load();
    } catch (err) {
      setVariantError(resolveContentError(err).message);
    } finally {
      setVariantBusy(null);
    }
  };

  const confirmPublish = async () => {
    try {
      await publishEpisode(episodeId);
      setPublishOpen(false);
      await load();
    } catch (err) {
      const resolved = resolveContentError(err);
      setPublishIssues(resolved.issues ?? [resolved.message]);
    }
  };

  const confirmArchive = async () => {
    try {
      await archiveEpisode(episodeId);
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
        <StatePanel variant="error" title="اپیزود پیدا نشد" />
      </PageContainer>
    );
  }

  const { episode } = state;
  const variantsByLevel: Record<string, VariantListItem> = {};
  for (const v of episode.variants) variantsByLevel[v.level] = v;
  const missingLevels = LEVELS.filter((l) => !variantsByLevel[l]);
  const saveState = saveStateOf(unsaved.isDirty, unsaved.isSaving, unsaved.saveState);

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title={episode.titleFa || episode.titleEn || 'اپیزود'}
        subtitle={`${episode.contentKey} — نسخه ${episode.contentVersion.toLocaleString('fa-IR')}`}
        action={<SaveStateChip state={saveState} testId="episode-save-state" />}
      />

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
        data-testid="episode-tabs"
      >
        {TABS.map((t) => (
          <Tab
            key={t.id}
            value={t.id}
            label={t.label}
            icon={t.icon}
            iconPosition="start"
            data-testid={`episode-tab-${t.id}`}
          />
        ))}
      </Tabs>

      {actionError ? (
        <Alert severity="error" role="alert" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      {tab === 'info' ? (
        <Card>
          <CardContent>
            <Stack spacing={2} data-testid="episode-basic-info">
              <TextField
                label="عنوان فارسی"
                value={form.title_fa}
                onChange={(e) => {
                  setForm((f) => ({ ...f, title_fa: e.target.value }));
                  unsaved.markDirty();
                }}
                fullWidth
                data-testid="episode-field-title-fa"
              />
              <TextField
                label="عنوان انگلیسی"
                value={form.title}
                onChange={(e) => {
                  setForm((f) => ({ ...f, title: e.target.value }));
                  unsaved.markDirty();
                }}
                fullWidth
                dir="ltr"
                data-testid="episode-field-title-en"
              />
              <TextField
                label="شناسه انگلیسی (slug)"
                value={form.slug}
                onChange={(e) => {
                  setForm((f) => ({ ...f, slug: e.target.value }));
                  unsaved.markDirty();
                }}
                fullWidth
                dir="ltr"
                helperText="کلید محتوایی اپیزود با تغییر این شناسه تغییر نمیکند."
                data-testid="episode-field-slug"
              />
              <TextField
                select
                label="دستهبندی"
                value={form.category}
                onChange={(e) => {
                  setForm((f) => ({ ...f, category: e.target.value }));
                  unsaved.markDirty();
                }}
                fullWidth
                slotProps={{ select: { native: true } }}
                data-testid="episode-field-category"
              >
                <option value="" />
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titleFa}
                  </option>
                ))}
              </TextField>
              <TextField
                label="توضیح فارسی"
                value={form.description_fa}
                onChange={(e) => {
                  setForm((f) => ({ ...f, description_fa: e.target.value }));
                  unsaved.markDirty();
                }}
                fullWidth
                multiline
                minRows={4}
                data-testid="episode-field-description"
              />
              <TextField
                label="شماره اپیزود"
                value={form.episode_number}
                onChange={(e) => {
                  setForm((f) => ({ ...f, episode_number: e.target.value }));
                  unsaved.markDirty();
                }}
                type="number"
                slotProps={{ htmlInput: { min: 1 } }}
                sx={{ maxWidth: 200 }}
                data-testid="episode-field-number"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.is_featured}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, is_featured: e.target.checked }));
                      unsaved.markDirty();
                    }}
                    data-testid="episode-field-featured"
                  />
                }
                label="اپیزود ویژه"
              />
              {formError ? (
                <Alert severity="error" role="alert">
                  {formError}
                </Alert>
              ) : null}
              <Box>
                <Button
                  variant="contained"
                  onClick={() => void saveBasic()}
                  disabled={unsaved.isSaving || !unsaved.isDirty}
                  data-testid="episode-save-basic"
                  sx={{ minHeight: 44 }}
                >
                  ذخیره اطلاعات
                </Button>
              </Box>
              <Grid container spacing={2} sx={{ pt: 1 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <OperationalMeta label="کلید محتوا" value={episode.contentKey} ltr />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <OperationalMeta label="نسخه محتوا" value={String(episode.contentVersion)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <OperationalMeta label="وضعیت" value={statusLabel(episode.status)} />
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'images' ? (
        <ArtworkWorkspace episodeId={episodeId} episode={episode} onChanged={() => void load()} />
      ) : null}

      {tab === 'levels' ? (
        <LevelMatrix
          episodeId={episodeId}
          variants={variantsByLevel}
          missingLevels={missingLevels}
          onCreate={handleCreateVariant}
          onCreateError={variantError}
          busyLevel={variantBusy}
        />
      ) : null}

      {tab === 'preview' ? (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                پیشنمایش فقط برای کارکنان است؛ محتوای پیشنویس برای دانشجویان در دسترس نیست.
              </Typography>
              <Button
                variant="contained"
                startIcon={<VisibilityRoundedIcon />}
                component="a"
                href={`/content/preview/${episodeId}`}
                data-testid="open-preview"
                sx={{ minHeight: 44, maxWidth: 260 }}
              >
                باز کردن پیشنمایش
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'publish' ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <ReadinessPanel episode={episode.readiness.episode} />
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="titleMedium">انتشار اپیزود</Typography>
                    <Typography variant="body2" color="text.secondary">
                      انتشار اپیزود، خود اپیزود و نسخههای منتشرشده آن را برای دانشجویان فعال میکند.
                    </Typography>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<PublishRoundedIcon />}
                      disabled={!episode.readiness.episode.ready}
                      onClick={() => {
                        setPublishIssues(episode.readiness.episode.errors.map((e) => e.message));
                        setPublishOpen(true);
                      }}
                      data-testid="episode-publish-button"
                      sx={{ minHeight: 44 }}
                    >
                      انتشار اپیزود
                    </Button>
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<ArchiveRoundedIcon />}
                      onClick={() => setArchiveOpen(true)}
                      data-testid="episode-archive-button"
                      sx={{ minHeight: 44 }}
                    >
                      بایگانی اپیزود
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="titleMedium" sx={{ mb: 1 }}>
                    وضعیت نسخههای سطح
                  </Typography>
                  <Stack spacing={0.5}>
                    {LEVELS.map((level) => {
                      const v = variantsByLevel[level];
                      return (
                        <Typography
                          key={level}
                          variant="body2"
                          data-testid={`publish-level-${level}`}
                        >
                          <b dir="ltr">{level}</b> — {v ? statusLabel(v.status) : 'ایجاد نشده'}
                        </Typography>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      ) : null}

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
          kind="episode"
          title={episode.titleFa}
          issues={publishIssues}
          onConfirm={confirmPublish}
          onClose={() => setPublishOpen(false)}
        />
      ) : null}
      {archiveOpen ? (
        <ArchiveDialog
          open
          kind="episode"
          title={episode.titleFa}
          impact="تمام نسخههای این اپیزود از دسترس دانشجو خارج میشوند."
          onConfirm={confirmArchive}
          onClose={() => setArchiveOpen(false)}
        />
      ) : null}
    </PageContainer>
  );
}

function OperationalMeta({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <Box sx={{ padding: 1.5, borderRadius: 2, backgroundColor: 'surfaceContainerLow' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        dir={ltr ? 'ltr' : 'rtl'}
        sx={{ textAlign: ltr ? 'start' : 'start', fontWeight: 600, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}
