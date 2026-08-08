// admin/src/features/content/routes/CategoriesRoute.tsx
// Category management: list, search, create, edit, reorder,
// feature/unfeature, publish, archive (with impact confirmation).

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import {
  archiveCategory,
  createCategory,
  fetchCategories,
  publishCategory,
  reorderCategories,
  toggleCategoryFeatured,
  updateCategory,
} from '../api';
import { ArchiveDialog, PublishDialog } from '../components/ConfirmDialogs';
import { ContentStatusChip } from '../components/ContentStatusChip';
import { resolveContentError, safeErrorMessage } from '../errors';
import { slugify } from '../slug';
import type { CategorySummary } from '../types';

type ListState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: CategorySummary[] }
  | { kind: 'error' };

export function CategoriesRoute() {
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategorySummary | null>(null);
  const [form, setForm] = useState({ title_fa: '', title_en: '', slug: '', description_fa: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [slugConfirmOpen, setSlugConfirmOpen] = useState(false);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<CategorySummary | null>(null);
  const [publishIssues, setPublishIssues] = useState<string[]>([]);
  const [archiveTarget, setArchiveTarget] = useState<CategorySummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetchCategories({ search });
      setState({ kind: 'ready', items: res.items });
    } catch {
      setState({ kind: 'error' });
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title_fa: '', title_en: '', slug: '', description_fa: '' });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (category: CategorySummary) => {
    setEditing(category);
    setForm({
      title_fa: category.titleFa,
      title_en: category.titleEn,
      slug: category.slug,
      description_fa: category.descriptionFa,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSlugConfirm = async () => {
    setSlugConfirmOpen(false);
    if (pendingSlug !== null) {
      setForm((f) => ({ ...f, slug: pendingSlug }));
    }
    setPendingSlug(null);
  };

  const submitForm = async () => {
    setFormError(null);
    if (!form.title_fa.trim()) {
      setFormError('عنوان فارسی الزامی است.');
      return;
    }
    let slug = form.slug.trim();
    const suggested = slugify(form.title_en || form.title_fa);
    if (!slug) {
      slug = suggested;
    }
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
      setFormError('شناسه انگلیسی فقط حروف کوچک لاتین، عدد، خط تیره و زیرخط میپذیرد.');
      return;
    }
    // Slug suggestion from the English title: require explicit
    // confirmation when normalization changed it.
    if (slug !== form.slug.trim()) {
      setPendingSlug(slug);
      setSlugConfirmOpen(true);
      return;
    }
    await doSubmit(slug);
  };

  const doSubmit = async (slug: string) => {
    setFormBusy(true);
    setFormError(null);
    try {
      if (editing) {
        await updateCategory(editing.id, {
          title_fa: form.title_fa,
          title_en: form.title_en,
          slug,
          description_fa: form.description_fa,
        });
      } else {
        await createCategory({
          title_fa: form.title_fa,
          title_en: form.title_en,
          slug,
          description_fa: form.description_fa,
        });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(resolveContentError(err).message);
    } finally {
      setFormBusy(false);
    }
  };

  const confirmPublish = async () => {
    if (!publishTarget) return;
    try {
      await publishCategory(publishTarget.id);
      setPublishTarget(null);
      await load();
    } catch (err) {
      const resolved = resolveContentError(err);
      setPublishIssues(resolved.issues ?? [resolved.message]);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archiveCategory(archiveTarget.id);
      setArchiveTarget(null);
      await load();
    } catch (err) {
      setActionError(safeErrorMessage(err));
    }
  };

  const toggleFeatured = async (category: CategorySummary) => {
    try {
      await toggleCategoryFeatured(category.id);
      await load();
    } catch (err) {
      setActionError(safeErrorMessage(err));
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    if (!state.kind || state.kind !== 'ready') return;
    const items = state.items;
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((c) => c.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setReorderBusy(true);
    try {
      await reorderCategories(ids);
      await load();
    } catch (err) {
      setActionError(safeErrorMessage(err));
    } finally {
      setReorderBusy(false);
    }
  };

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title="دستهبندیها"
        subtitle="دستهبندیها ساختار کتابخانه پادکست را تعریف میکنند"
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={openCreate}
            data-testid="category-create"
            sx={{ minHeight: 44 }}
          >
            دستهبندی جدید
          </Button>
        }
      />
      {actionError ? (
        <Alert severity="error" role="alert" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}
      <TextField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="جستجو در دستهبندیها…"
        size="small"
        fullWidth
        sx={{ mb: 2, maxWidth: 420 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon />
              </InputAdornment>
            ),
          },
        }}
        data-testid="category-search"
      />
      {state.kind === 'loading' ? (
        <StatePanel variant="loading" title="در حال بارگذاری…" />
      ) : state.kind === 'error' ? (
        <StatePanel variant="error" title="دسترسی به اطلاعات ممکن نشد" />
      ) : state.items.length === 0 ? (
        <StatePanel variant="empty" title="دستهبندیای پیدا نشد" />
      ) : (
        <Stack spacing={1.5}>
          {state.items.map((category, index) => (
            <Card key={category.id} variant="outlined" data-testid={`category-row-${category.key}`}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <Stack spacing={0}>
                    <IconButton
                      size="small"
                      aria-label="بالا بردن"
                      onClick={() => void move(index, -1)}
                      disabled={index === 0 || reorderBusy}
                      data-testid={`category-up-${category.id}`}
                    >
                      <KeyboardArrowUpRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="پایین آوردن"
                      onClick={() => void move(index, 1)}
                      disabled={index === state.items.length - 1 || reorderBusy}
                      data-testid={`category-down-${category.id}`}
                    >
                      <KeyboardArrowDownRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Box sx={{ flex: 1, minWidth: 240 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {category.titleFa}
                      </Typography>
                      {category.isFeatured ? (
                        <Tooltip title="ویژه">
                          <StarRoundedIcon
                            color="warning"
                            fontSize="small"
                            data-testid={`category-featured-${category.key}`}
                          />
                        </Tooltip>
                      ) : null}
                      <ContentStatusChip status={category.publicationStatus} />
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      dir="ltr"
                      sx={{ display: 'block', textAlign: 'start' }}
                    >
                      {category.slug}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {category.descriptionFa}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {category.episodeCounts.total.toLocaleString('fa-IR')} اپیزود
                      {category.episodeCounts.published > 0
                        ? ` — ${category.episodeCounts.published.toLocaleString('fa-IR')} منتشرشده`
                        : ''}
                    </Typography>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditRoundedIcon />}
                      onClick={() => openEdit(category)}
                      data-testid={`category-edit-${category.key}`}
                      sx={{ minHeight: 44 }}
                    >
                      ویرایش
                    </Button>
                    <Tooltip title={category.isFeatured ? 'حذف از ویژه' : 'ویژه کردن'}>
                      <IconButton
                        size="small"
                        aria-label="ویژه"
                        onClick={() => void toggleFeatured(category)}
                        data-testid={`category-feature-${category.key}`}
                      >
                        {category.isFeatured ? <StarBorderRoundedIcon /> : <StarRoundedIcon />}
                      </IconButton>
                    </Tooltip>
                    {category.publicationStatus !== 'published' ? (
                      <Button
                        size="small"
                        variant="text"
                        color="success"
                        startIcon={<CheckCircleRoundedIcon />}
                        onClick={() => {
                          setPublishIssues([]);
                          setPublishTarget(category);
                        }}
                        data-testid={`category-publish-${category.key}`}
                        sx={{ minHeight: 44 }}
                      >
                        انتشار
                      </Button>
                    ) : null}
                    {category.publicationStatus !== 'archived' ? (
                      <Button
                        size="small"
                        variant="text"
                        color="warning"
                        startIcon={<ArchiveRoundedIcon />}
                        onClick={() => setArchiveTarget(category)}
                        data-testid={`category-archive-${category.key}`}
                        sx={{ minHeight: 44 }}
                      >
                        بایگانی
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog
        open={formOpen}
        onClose={formBusy ? undefined : () => setFormOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="category-form"
      >
        <DialogTitle>{editing ? 'ویرایش دستهبندی' : 'دستهبندی جدید'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="عنوان فارسی"
              value={form.title_fa}
              onChange={(e) => setForm((f) => ({ ...f, title_fa: e.target.value }))}
              fullWidth
              data-testid="category-field-title-fa"
            />
            <TextField
              label="عنوان انگلیسی"
              value={form.title_en}
              onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
              fullWidth
              dir="ltr"
              data-testid="category-field-title-en"
            />
            <TextField
              label="شناسه انگلیسی (slug)"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              fullWidth
              dir="ltr"
              helperText="خالی بگذارید تا از عنوان انگلیسی پیشنهاد شود."
              data-testid="category-field-slug"
            />
            <TextField
              label="توضیح فارسی"
              value={form.description_fa}
              onChange={(e) => setForm((f) => ({ ...f, description_fa: e.target.value }))}
              fullWidth
              multiline
              minRows={3}
              data-testid="category-field-description"
            />
            {editing ? (
              <Typography variant="caption" color="text.secondary">
                کلید دستهبندی پس از ایجاد ثابت میماند و با ویرایش تغییر نمیکند.
              </Typography>
            ) : null}
            {formError ? (
              <Alert severity="error" role="alert">
                {formError}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)} disabled={formBusy} sx={{ minHeight: 44 }}>
            انصراف
          </Button>
          <Button
            variant="contained"
            onClick={() => void submitForm()}
            disabled={formBusy}
            data-testid="category-save"
            sx={{ minHeight: 44 }}
          >
            ذخیره
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={slugConfirmOpen} maxWidth="xs" fullWidth data-testid="slug-confirm">
        <DialogTitle>تأیید شناسه انگلیسی</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            شناسه انگلیسی از عنوان ساخته شد: <b dir="ltr">{pendingSlug}</b>
            <br />
            این مقدار بهعنوان شناسه دستهبندی ذخیره میشود و بعداً تغییر نمیکند.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSlugConfirmOpen(false)}
            sx={{ minHeight: 44 }}
            data-testid="slug-confirm-cancel"
          >
            تغییر
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSlugConfirm()}
            sx={{ minHeight: 44 }}
            data-testid="slug-confirm-ok"
          >
            تأیید و ذخیره
          </Button>
        </DialogActions>
      </Dialog>

      {publishTarget ? (
        <PublishDialog
          open
          kind="category"
          title={publishTarget.titleFa}
          issues={publishIssues}
          onConfirm={confirmPublish}
          onClose={() => setPublishTarget(null)}
        />
      ) : null}
      {archiveTarget ? (
        <ArchiveDialog
          open
          kind="category"
          title={archiveTarget.titleFa}
          impact={`${archiveTarget.episodeCounts.total.toLocaleString('fa-IR')} اپیزود این دستهبندی از دسترس دانشجو خارج میشوند.`}
          onConfirm={confirmArchive}
          onClose={() => setArchiveTarget(null)}
        />
      ) : null}
    </PageContainer>
  );
}
