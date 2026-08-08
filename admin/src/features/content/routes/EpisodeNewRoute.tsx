// admin/src/features/content/routes/EpisodeNewRoute.tsx
// Create a Draft Episode: minimal form (the rest lives in the editor).

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { createEpisode, fetchCategories } from '../api';
import { resolveContentError } from '../errors';
import { slugify } from '../slug';
import type { CategorySummary } from '../types';

export function EpisodeNewRoute() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategorySummary[] | null>(null);
  const [form, setForm] = useState({
    title_fa: '',
    title: '',
    slug: '',
    category: '',
    description_fa: '',
    episode_number: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slugConfirmOpen, setSlugConfirmOpen] = useState(false);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  useEffect(() => {
    void fetchCategories()
      .then((res) => setCategories(res.items))
      .catch(() => setCategories([]));
  }, []);

  const submit = async () => {
    setError(null);
    if (!form.title_fa.trim()) {
      setError('عنوان فارسی الزامی است.');
      return;
    }
    if (!form.category) {
      setError('دستهبندی را انتخاب کنید.');
      return;
    }
    let slug = form.slug.trim();
    if (!slug) slug = slugify(form.title || form.title_fa);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError('شناسه انگلیسی باید با حروف کوچک لاتین و خط تیره نوشته شود.');
      return;
    }
    if (slug !== form.slug.trim()) {
      setPendingSlug(slug);
      setSlugConfirmOpen(true);
      return;
    }
    await doCreate(slug);
  };

  const doCreate = async (slug: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await createEpisode({
        title_fa: form.title_fa,
        title: form.title,
        slug,
        category: form.category,
        description_fa: form.description_fa,
        episode_number: form.episode_number ? Number(form.episode_number) : undefined,
      });
      navigate(`/content/episodes/${res.episode.id}`);
    } catch (err) {
      setError(resolveContentError(err).message);
      setBusy(false);
    }
  };

  return (
    <PageContainer maxWidth="md">
      <PageHeader title="اپیزود جدید" subtitle="اپیزود بهصورت پیشنویس ساخته میشود" />
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="عنوان فارسی"
              value={form.title_fa}
              onChange={(e) => setForm((f) => ({ ...f, title_fa: e.target.value }))}
              fullWidth
              data-testid="new-episode-title-fa"
            />
            <TextField
              label="عنوان انگلیسی"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              fullWidth
              dir="ltr"
              data-testid="new-episode-title-en"
            />
            <TextField
              label="شناسه انگلیسی (slug)"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              fullWidth
              dir="ltr"
              helperText="خالی بگذارید تا از عنوان انگلیسی پیشنهاد شود."
              data-testid="new-episode-slug"
            />
            <TextField
              select
              label="دستهبندی"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              fullWidth
              slotProps={{ select: { native: true } }}
              data-testid="new-episode-category"
            >
              <option value="" />
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titleFa}
                </option>
              ))}
            </TextField>
            <TextField
              label="توضیح فارسی"
              value={form.description_fa}
              onChange={(e) => setForm((f) => ({ ...f, description_fa: e.target.value }))}
              fullWidth
              multiline
              minRows={3}
              data-testid="new-episode-description"
            />
            <TextField
              label="شماره اپیزود"
              value={form.episode_number}
              onChange={(e) => setForm((f) => ({ ...f, episode_number: e.target.value }))}
              type="number"
              slotProps={{ htmlInput: { min: 1 } }}
              sx={{ maxWidth: 200 }}
              data-testid="new-episode-number"
            />
            {error ? (
              <Alert severity="error" role="alert">
                {error}
              </Alert>
            ) : null}
            <Box>
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => void submit()}
                disabled={busy || categories === null}
                data-testid="new-episode-submit"
                sx={{ minHeight: 44 }}
              >
                ساخت اپیزود
              </Button>
            </Box>
            {categories === null ? (
              <StatePanel variant="loading" title="در حال بارگذاری دستهبندیها…" />
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {slugConfirmOpen ? (
        <SlugConfirmDialog
          slug={pendingSlug ?? ''}
          onCancel={() => setSlugConfirmOpen(false)}
          onConfirm={() => {
            setSlugConfirmOpen(false);
            void doCreate(pendingSlug ?? '');
          }}
        />
      ) : null}
    </PageContainer>
  );
}

import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

function SlugConfirmDialog({
  slug,
  onCancel,
  onConfirm,
}: {
  slug: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open maxWidth="xs" fullWidth data-testid="new-episode-slug-confirm">
      <DialogTitle>تأیید شناسه انگلیسی</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          شناسه انگلیسی از عنوان ساخته شد: <b dir="ltr">{slug}</b>
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} sx={{ minHeight: 44 }}>
          تغییر
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          sx={{ minHeight: 44 }}
          data-testid="new-episode-slug-ok"
        >
          تأیید
        </Button>
      </DialogActions>
    </Dialog>
  );
}
