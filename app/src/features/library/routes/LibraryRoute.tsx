// app/src/features/library/routes/LibraryRoute.tsx
// Podcast Slice 6 — production Student Podcast Library.
//
// Discovery journey: browse Topics -> search -> filter -> find one
// canonical Episode -> resolve the right CEFR Variant -> start/continue
// listening.
//
// Architecture:
//   - All discovery state lives in the URL (/library?q&category&level&
//     progress&sort&page) so Refresh and Back preserve meaningful state.
//   - The server returns one canonical Episode result per Topic with the
//     resolved Variant + its per-Variant Progress; the UI never groups or
//     filters Episodes client-side.
//   - Browsing/filtering is read-only: recommended and preferred levels
//     are never modified.
//   - Routine filter changes keep the current list visible (a quiet
//     progress line, no full-page spinner); the media-aware skeleton is
//     reserved for first load.

import { Box, Button, Stack, Typography } from '@mui/material';
import LinearProgress from '@mui/material/LinearProgress';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { productCopy } from '../../../app/copy/productCopy';
import { ContentSection } from '../../podcast/components/ContentSection';
import { EpisodeCard } from '../../podcast/components/EpisodeCard';
import { getLibrary } from '../api';
import { ContinueStrip } from '../components/ContinueStrip';
import { EmptyPanel } from '../components/EmptyPanel';
import { LibrarySkeleton } from '../components/LibrarySkeleton';
import { type OptionChip, OptionChips } from '../components/OptionChips';
import { SearchField } from '../components/SearchField';
import { availableLevelsCaption, deriveEmptyKind, toCardLesson, toCardProgress } from '../logic';
import {
  CEFR_LEVEL_FILTERS,
  DEFAULT_LIBRARY_PER_PAGE,
  DEFAULT_LIBRARY_QUERY,
  type LibraryQuery,
  libraryQueryToSearch,
  parseLibraryQuery,
  sameLibraryBase,
  withLibraryPatch,
} from '../queryState';
import type {
  ContinueListeningItem,
  LibraryCategory,
  LibraryEpisodeItem,
  LibraryLevelFilter,
  LibraryProgressFilter,
  LibrarySort,
} from '../types';

type Phase = 'loading' | 'ready' | 'refreshing' | 'error';

interface LibraryMeta {
  categories: LibraryCategory[];
  continueListening: ContinueListeningItem[];
  totalItems: number;
  recommendedLevel: string;
  preferredLevel: string;
}

const SEARCH_DEBOUNCE_MS = 400;

const LEVEL_OPTIONS: OptionChip[] = [
  { value: 'preferred', label: productCopy.library.suggestedForMe },
  { value: 'all', label: productCopy.library.allLevels },
  ...CEFR_LEVEL_FILTERS.map((level) => ({ value: level, label: level })),
];

const PROGRESS_OPTIONS: OptionChip[] = [
  { value: 'all', label: productCopy.library.progressAll },
  { value: 'not_started', label: productCopy.library.progressFilters.not_started },
  { value: 'in_progress', label: productCopy.library.progressFilters.in_progress },
  { value: 'completed', label: productCopy.library.progressFilters.completed },
];

export function LibraryRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  // The URL is the persisted form (Refresh/Back), but the in-session
  // source of truth is component state: applyQuery patches through
  // functional setState, so rapid filter changes (double-taps) can never
  // lose an update to a stale closure (React Router's setSearchParams
  // updater still closes over the last-rendered params).
  const urlQuery = useMemo(() => parseLibraryQuery(searchParams.toString()), [searchParams]);
  const [query, setQuery] = useState<LibraryQuery>(urlQuery);
  // True while we are persisting our own state to the URL (so the sync
  // effect ignores the echo); external changes (Back/forward/refresh)
  // always re-parse the URL into state.
  const applyingRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<LibraryEpisodeItem[]>([]);
  const [meta, setMeta] = useState<LibraryMeta | null>(null);
  const [searchInput, setSearchInput] = useState(query.q);
  // Bumped by Retry to re-run the fetch effect without a URL change.
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Accumulated pagination: pages fetched so far for the current base
  // query (q/category/level/progress/sort). Appending a page reuses the
  // already-fetched pages; any base change restarts at page 1.
  const baseRef = useRef<LibraryQuery>({ ...DEFAULT_LIBRARY_QUERY });
  const loadedPagesRef = useRef(0);
  const itemsRef = useRef<LibraryEpisodeItem[]>([]);
  const seqRef = useRef(0);

  // Keep the typed input in sync with URL changes (Back/refresh).
  useEffect(() => {
    setSearchInput(query.q);
  }, [query.q]);

  // Keep state in sync with external URL changes (Back/forward/refresh).
  useEffect(() => {
    if (applyingRef.current) {
      applyingRef.current = false;
      return;
    }
    setQuery(urlQuery);
  }, [urlQuery]);

  const applyQuery = useCallback((patch: Partial<LibraryQuery>) => {
    setQuery((previous) => withLibraryPatch(previous, patch));
  }, []);

  // Persist state to the URL (only when it actually changed).
  useEffect(() => {
    const serialized = libraryQueryToSearch(query);
    if (serialized === searchParams.toString()) return;
    applyingRef.current = true;
    setSearchParams(serialized, { replace: false });
  }, [query, searchParams, setSearchParams]);

  // Debounced search: no uncontrolled request per keystroke.
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === query.q) return;
    const timer = setTimeout(() => applyQuery({ q: trimmed }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, query.q, applyQuery]);

  // Fetch the discovery pages for the current query.
  useEffect(() => {
    const base: LibraryQuery = {
      q: query.q,
      category: query.category,
      level: query.level,
      progress: query.progress,
      sort: query.sort,
      page: query.page,
    };
    const baseChanged = !sameLibraryBase(base, baseRef.current);
    baseRef.current = base;

    // Going back in pages (or a base change) needs a fresh accumulation.
    if (baseChanged || query.page <= loadedPagesRef.current) {
      loadedPagesRef.current = 0;
      itemsRef.current = [];
    }

    const seq = ++seqRef.current;
    setPhase((previous) => {
      if (previous === 'loading') return 'loading';
      if (previous === 'error') return 'loading';
      return 'refreshing';
    });

    void (async () => {
      try {
        let latestMeta: LibraryMeta | null = null;
        const missing: number[] = [];
        for (let p = loadedPagesRef.current + 1; p <= query.page; p++) missing.push(p);
        if (missing.length > 0) {
          const results = await Promise.all(
            missing.map((page) =>
              getLibrary({
                q: query.q || undefined,
                category: query.category || undefined,
                level: query.level,
                progress: query.progress,
                sort: query.sort,
                page,
                perPage: DEFAULT_LIBRARY_PER_PAGE,
              })
                .then((value) => ({ ok: true as const, value, page }))
                .catch(() => ({ ok: false as const, page })),
            ),
          );
          if (seqRef.current !== seq) return;
          const sorted = results.sort((a, b) => a.page - b.page);
          for (const res of sorted) {
            if (!res.ok) continue;
            const response = res.value;
            itemsRef.current =
              res.page === 1 ? response.items : itemsRef.current.concat(response.items);
            loadedPagesRef.current = res.page;
            latestMeta = {
              categories: response.categories,
              continueListening: response.continueListening,
              totalItems: response.totalItems,
              recommendedLevel: response.recommendedLevel,
              preferredLevel: response.preferredLevel,
            };
          }
        }
        if (seqRef.current !== seq) return;
        setItems(itemsRef.current.slice());
        setMeta(latestMeta);
        setPhase('ready');
      } catch {
        if (seqRef.current !== seq) return;
        setPhase('error');
      }
    })();
  }, [query, refreshNonce]);

  const showSkeleton = phase === 'loading' || (phase === 'refreshing' && items.length === 0);
  const showList = phase === 'ready' || (phase === 'refreshing' && items.length > 0);
  const emptyKind =
    phase === 'ready' && meta && meta.totalItems === 0 ? deriveEmptyKind(query) : null;

  if (showSkeleton) {
    return (
      <PageContainer maxWidth="lg">
        <LibrarySkeleton />
      </PageContainer>
    );
  }

  if (phase === 'error') {
    return (
      <PageContainer maxWidth="lg">
        <StatePanel
          variant="error"
          title={productCopy.errors.episodesFailed}
          description={productCopy.errors.checkConnection}
          action={
            <Button
              variant="outlined"
              data-testid="library-retry"
              onClick={() => setRefreshNonce((n) => n + 1)}
            >
              {productCopy.actions.retry}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const categoryOptions: OptionChip[] = [
    { value: '', label: productCopy.library.allTopics },
    ...(meta?.categories ?? []).map((category) => ({
      value: category.id,
      label: category.titleFa,
    })),
  ];

  return (
    <PageContainer maxWidth="lg">
      <Box component="header" sx={{ mb: { xs: 4, sm: 5 } }}>
        <Typography component="h1" variant="h2" sx={{ overflowWrap: 'anywhere' }}>
          {productCopy.nav.library}
        </Typography>
      </Box>

      <Stack spacing={{ xs: 3, sm: 4 }}>
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={() => applyQuery({ q: searchInput.trim() })}
          label={productCopy.library.searchLabel}
          clearLabel={productCopy.library.searchClear}
          data-testid="library-search"
        />

        <OptionChips
          label={productCopy.library.topicsLabel}
          options={categoryOptions}
          value={query.category}
          onChange={(value) => applyQuery({ category: value })}
          data-testid="library-categories"
        />
        {meta && meta.continueListening.length > 0 ? (
          <ContentSection
            title={productCopy.library.continueSection}
            data-testid="library-continue"
          >
            <ContinueStrip items={meta.continueListening} data-testid="library-continue-strip" />
          </ContentSection>
        ) : null}

        <Box
          component="section"
          aria-label={productCopy.library.levelFilterLabel}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <OptionChips
            label={productCopy.library.levelFilterLabel}
            options={LEVEL_OPTIONS}
            value={query.level}
            onChange={(value) => applyQuery({ level: value as LibraryLevelFilter })}
            data-testid="library-levels"
          />
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 1.5 }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <OptionChips
                label={productCopy.library.progressFilterLabel}
                options={PROGRESS_OPTIONS}
                value={query.progress}
                onChange={(value) => applyQuery({ progress: value as LibraryProgressFilter })}
                data-testid="library-progress"
              />
            </Box>
            <Box
              component="label"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                paddingBottom: 0.5,
                minWidth: 132,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {productCopy.library.sortLabel}
              </Typography>
              <Box
                component="select"
                aria-label={productCopy.library.sortLabel}
                data-testid="library-sort"
                value={query.sort}
                onChange={(event) => applyQuery({ sort: event.target.value as LibrarySort })}
                sx={{
                  minHeight: 40,
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: 'outlineVariant',
                  backgroundColor: 'surfaceContainerLow',
                  color: 'text.primary',
                  font: 'inherit',
                  fontSize: '0.875rem',
                  px: 1.5,
                }}
              >
                <option value="suggested">{productCopy.library.sortSuggested}</option>
                <option value="latest">{productCopy.library.sortLatest}</option>
              </Box>
            </Box>
          </Stack>
        </Box>

        {phase === 'refreshing' ? (
          <Box role="status" aria-live="polite" sx={{ '& .MuiLinearProgress-root': { height: 3 } }}>
            <span
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
              }}
            >
              {productCopy.library.refreshing}
            </span>
            <LinearProgress />
          </Box>
        ) : null}

        {showList && meta ? (
          <>
            <Box aria-live="polite">
              <Typography variant="caption" color="text.secondary" data-testid="library-count">
                {productCopy.library.resultsCount(meta.totalItems)}
              </Typography>
            </Box>

            <Stack spacing={1.5}>
              {items.map((item, index) => (
                <EpisodeCard
                  key={item.resolvedVariant.id}
                  lesson={toCardLesson(item)}
                  progress={toCardProgress(item.resolvedVariant.progress)}
                  layout="row"
                  availableLevelsCaption={availableLevelsCaption(item)}
                  artworkLoading={index < 3 ? 'eager' : 'lazy'}
                />
              ))}
            </Stack>

            {items.length < meta.totalItems ? (
              <Box sx={{ textAlign: 'center' }}>
                <Button
                  variant="outlined"
                  size="large"
                  data-testid="library-load-more"
                  onClick={() => applyQuery({ page: query.page + 1 })}
                >
                  {productCopy.library.loadMore}
                </Button>
              </Box>
            ) : null}
          </>
        ) : null}

        {emptyKind ? (
          <EmptyPanel
            kind={emptyKind}
            level={query.level !== 'preferred' && query.level !== 'all' ? query.level : undefined}
            onClearSearch={() => applyQuery({ q: '', page: 1 })}
            onAllTopics={() => applyQuery({ category: '', page: 1 })}
            onAllLevels={() => applyQuery({ level: 'all', page: 1 })}
            onResetProgress={() => applyQuery({ progress: 'all', page: 1 })}
          />
        ) : null}
      </Stack>
    </PageContainer>
  );
}
