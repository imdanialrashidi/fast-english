// admin/src/features/content/routes/EpisodesRoute.tsx
// Professional content workspace: searchable, filterable episode list
// (artwork thumbnail, titles, category, counts, status, last update,
// primary next action). Desktop table, mobile cards.

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { artworkUrl, fetchCategories, fetchEpisodes } from '../api';
import { ContentStatusChip } from '../components/ContentStatusChip';
import { formatDateTime, statusLabel } from '../presentation';
import type { CategorySummary, EpisodeListItem } from '../types';

type ListState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: EpisodeListItem[] }
  | { kind: 'error' };

const MISSING_FILTERS = [
  { value: '', label: 'همه اپیزودها' },
  { value: 'no_artwork', label: 'بدون تصویر' },
  { value: 'no_published', label: 'بدون نسخه منتشرشده' },
  { value: 'incomplete_variant', label: 'نسخه ناقص' },
  { value: 'no_b1', label: 'بدون B1' },
];

export function EpisodesRoute() {
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('all');
  const [missing, setMissing] = useState('');
  const [sort, setSort] = useState('updated');
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetchEpisodes({ search, category, status, missing, sort });
      setState({ kind: 'ready', items: res.items });
    } catch {
      setState({ kind: 'error' });
    }
  }, [search, category, status, missing, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetchCategories()
      .then((res) => setCategories(res.items))
      .catch(() => {});
  }, []);

  const primaryAction = (episode: EpisodeListItem) => {
    if (episode.status === 'draft') {
      return (
        <Button
          component={RouterLink}
          to={`/content/episodes/${episode.id}`}
          size="small"
          variant="contained"
          startIcon={<EditRoundedIcon />}
          sx={{ minHeight: 44 }}
        >
          ادامه ویرایش
        </Button>
      );
    }
    return (
      <Button
        component={RouterLink}
        to={`/content/episodes/${episode.id}`}
        size="small"
        variant="outlined"
        sx={{ minHeight: 44 }}
      >
        باز کردن
      </Button>
    );
  };

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        title="اپیزودها"
        subtitle="فضای کاری محتوای پادکست"
        action={
          <Button
            component={RouterLink}
            to="/content/episodes/new"
            variant="contained"
            startIcon={<AddRoundedIcon />}
            data-testid="episodes-new"
            sx={{ minHeight: 44 }}
          >
            اپیزود جدید
          </Button>
        }
      />
      {error ? (
        <Alert severity="error" role="alert" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو در اپیزودها…"
          size="small"
          sx={{ flex: '1 1 240px', minWidth: 240 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon />
                </InputAdornment>
              ),
            },
          }}
          data-testid="episode-search"
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="episode-category-label">دستهبندی</InputLabel>
          <Select
            labelId="episode-category-label"
            value={category}
            label="دستهبندی"
            onChange={(e) => setCategory(e.target.value)}
            data-testid="episode-filter-category"
          >
            <MenuItem value="">همه</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.titleFa}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="episode-status-label">وضعیت</InputLabel>
          <Select
            labelId="episode-status-label"
            value={status}
            label="وضعیت"
            onChange={(e) => setStatus(e.target.value)}
            data-testid="episode-filter-status"
          >
            <MenuItem value="all">همه</MenuItem>
            <MenuItem value="draft">پیشنویس</MenuItem>
            <MenuItem value="published">منتشر شده</MenuItem>
            <MenuItem value="archived">آرشیو شده</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="episode-missing-label">محتوای ناقص</InputLabel>
          <Select
            labelId="episode-missing-label"
            value={missing}
            label="محتوای ناقص"
            onChange={(e) => setMissing(e.target.value)}
            data-testid="episode-filter-missing"
          >
            {MISSING_FILTERS.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="episode-sort-label">مرتبسازی</InputLabel>
          <Select
            labelId="episode-sort-label"
            value={sort}
            label="مرتبسازی"
            onChange={(e) => setSort(e.target.value)}
            data-testid="episode-sort"
          >
            <MenuItem value="updated">آخرین تغییر</MenuItem>
            <MenuItem value="title">عنوان</MenuItem>
            <MenuItem value="status">وضعیت</MenuItem>
            <MenuItem value="episode_number">شماره اپیزود</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {state.kind === 'loading' ? (
        <StatePanel variant="loading" title="در حال بارگذاری…" />
      ) : state.kind === 'error' ? (
        <StatePanel variant="error" title="دسترسی به اطلاعات ممکن نشد" />
      ) : state.items.length === 0 ? (
        <StatePanel variant="empty" title="اپیزودی پیدا نشد" />
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {state.items.map((episode) => (
            <Card key={episode.id} variant="outlined" data-testid={`episode-card-${episode.slug}`}>
              <CardContent>
                <Stack direction="row" spacing={1.5}>
                  <Thumb episode={episode} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {episode.titleFa || episode.titleEn}
                      </Typography>
                      <ContentStatusChip status={episode.status} />
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      dir="ltr"
                      sx={{ display: 'block', textAlign: 'start' }}
                    >
                      {episode.titleEn}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {episode.category?.titleFa ?? 'بدون دستهبندی'}
                      {episode.episodeNumber
                        ? ` — اپیزود ${episode.episodeNumber.toLocaleString('fa-IR')}`
                        : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {episode.variantCounts.published.toLocaleString('fa-IR')} منتشرشده ·{' '}
                      {episode.variantCounts.draft.toLocaleString('fa-IR')} پیشنویس ·{' '}
                      {formatDateTime(episode.updatedAt)}
                    </Typography>
                    <Box sx={{ mt: 1 }}>{primaryAction(episode)}</Box>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Card} variant="outlined">
          <Table size="small" aria-label="فهرست اپیزودها">
            <TableHead>
              <TableRow>
                <TableCell>اپیزود</TableCell>
                <TableCell>دستهبندی</TableCell>
                <TableCell>شماره</TableCell>
                <TableCell>نسخههای سطح</TableCell>
                <TableCell>وضعیت</TableCell>
                <TableCell>آخرین تغییر</TableCell>
                <TableCell align="left">اقدام</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.items.map((episode) => (
                <TableRow key={episode.id} hover data-testid={`episode-row-${episode.slug}`}>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Thumb episode={episode} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {episode.titleFa || episode.titleEn}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          dir="ltr"
                          sx={{ display: 'block', textAlign: 'start' }}
                        >
                          {episode.titleEn}
                        </Typography>
                        {episode.artworkPresent ? null : (
                          <Chip
                            label="بدون تصویر"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>{episode.category?.titleFa ?? '—'}</TableCell>
                  <TableCell>
                    {episode.episodeNumber ? episode.episodeNumber.toLocaleString('fa-IR') : '—'}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        label={`${episode.variantCounts.published.toLocaleString('fa-IR')} منتشرشده`}
                        color="success"
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`${episode.variantCounts.draft.toLocaleString('fa-IR')} پیشنویس`}
                        variant="outlined"
                      />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <ContentStatusChip status={episode.status} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(episode.updatedAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="left">{primaryAction(episode)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </PageContainer>
  );
}

function Thumb({ episode }: { episode: EpisodeListItem }) {
  return episode.artworkPresent ? (
    <Box
      component="img"
      src={artworkUrl(episode.id)}
      alt=""
      sx={{ width: 56, height: 56, borderRadius: 1.5, objectFit: 'cover', flexShrink: 0 }}
    />
  ) : (
    <Box
      sx={{
        width: 56,
        height: 56,
        borderRadius: 1.5,
        backgroundColor: 'surfaceContainerHigh',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'onSurfaceVariant',
      }}
    >
      <Typography variant="caption">{statusLabel(episode.status)}</Typography>
    </Box>
  );
}
