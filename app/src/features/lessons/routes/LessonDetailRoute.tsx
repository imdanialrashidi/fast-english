// app/src/features/lessons/routes/LessonDetailRoute.tsx
// Slice 7 — the Episode surface (Record Jacket), evolved from the Visual
// Slice 2 lesson-detail route (accepted design: docs/DESIGN.md).
//
// Composition (three real tiers):
//   phone:    artwork → Edition Rail → identity → Deck → learning sections
//   tablet:   jacket-front (artwork beside identity), sticky Deck while reading
//   desktop:  two-column jacket + liner-notes (pinned jacket column; bounded
//             reading column)
//
// Atomic Variant semantics:
//   - the Edition Rail navigates between Variants of the SAME Episode via
//     the URL (/lessons/:variantId); browsing never mutates recommended or
//     preferred Level and there is no set-default affordance here;
//   - a Variant switch immediately stops the previous session (shared
//     player), keeps the Episode-level jacket rendered, disables the rail
//     with the accepted loading line, and skeletons ONLY the
//     variant-dependent regions (Deck, summary, vocabulary, transcript);
//     old and new Variant content are never visible at the same time;
//   - previous/next navigation targets a different Episode → full load;
//   - every load uses a sequence guard: stale responses are discarded.
//
// States: loading / switching / ready / error / no_entitlement / not_found.

import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { extractApiError } from '../../../../../shared/lib/apiError';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { layout, radius } from '../../../../../shared/ui/tokens';
import type { CefrLevel } from '../../../../../shared/ui/tokens/cefr';
import { productCopy } from '../../../app/copy/productCopy';
import { LessonDetailSkeleton } from '../../../app/shell/PageSkeletons';
import { useAuth } from '../../../lib/auth';
import { buildEditionRail, type EditionRailEntry, railEntryForVariant } from '../../episode';
import { EpisodeJacket } from '../../episode/components/EpisodeJacket';
import { PrevNextFooter } from '../../episode/components/PrevNextFooter';
import { VariantDeck } from '../../episode/components/VariantDeck';
import { VocabularyList } from '../../episode/components/VocabularyList';
import { jacketForVariant, rememberJacket } from '../../episode/jacketCache';
import { usePlayer } from '../../player';
import * as progressApi from '../../progress/api';
import type { LessonProgressResponse } from '../../progress/types';
import { useProgressSave } from '../../progress/useProgressSave';
import * as api from '../api';
import type { LessonDetailResponse, VocabularyItem } from '../types';

type Phase = 'loading' | 'switching' | 'ready' | 'error' | 'no_entitlement' | 'not_found';

interface ErrorInfo {
  title: string;
  description: string;
  retry?: boolean;
}

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function LessonDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const player = usePlayer();

  const [phase, setPhase] = useState<Phase>('loading');
  const [lesson, setLesson] = useState<LessonDetailResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  // Raw (server) audio URL of the current Variant — needed to rebuild the
  // protected URL when the deck retries after a build failure.
  const rawAudioUrlRef = useRef<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [progress, setProgress] = useState<LessonProgressResponse | null>(null);
  const [vocabItems, setVocabItems] = useState<VocabularyItem[] | null>(null);
  const [vocabFailed, setVocabFailed] = useState(false);
  const [readingActive, setReadingActive] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  // The session-scoped Episode jacket survives the RouteTransition remount
  // (Episode-level identity only; Variant content always loads fresh).
  const { user } = useAuth();
  const seqRef = useRef(0);
  // Seq of the most recent loadLesson run — lets the deck retry rebuild the
  // protected URL only when that load is still the current one.
  const lastLoadSeqRef = useRef(0);
  const wasSwitchingRef = useRef(false);
  const articleRef = useRef<HTMLElement | null>(null);
  // The current Variant id, read through a ref so the (stable) progress
  // callbacks always attribute their result to the CURRENT route state.
  const idRef = useRef(id);
  idRef.current = id;

  // Stable callbacks: the progress hook's queue/effect chain depends on
  // their identity — inline arrows would re-create performSave → drainPending
  // → flush every render and flush the debounce on every re-render.
  const handleProgressSaved = useCallback((p: LessonProgressResponse) => {
    // A save that completes after a Variant switch belongs to the OLD
    // Variant — it must never clobber the new Variant's progress state
    // (a cross-Variant leak would show the old resume point in the new
    // deck and seek the new element to the old position).
    if (p.lessonId === idRef.current) setProgress(p);
  }, []);
  const handleStaleRevision = useCallback((p: LessonProgressResponse) => {
    if (p.lessonId === idRef.current) setProgress(p);
  }, []);

  const { handleTimeUpdate, handlePause, handleSeek, handleEnded } = useProgressSave({
    lessonId: id,
    enabled: !!id && !!audioUrl && !audioError,
    initialProgress: progress ?? undefined,
    onSaved: handleProgressSaved,
    onStaleRevision: handleStaleRevision,
  });

  const loadLesson = useCallback(
    async (targetId: string) => {
      // Same-Episode Variant switch (Edition Rail / Back-forward within the
      // Episode) keeps the jacket; anything else is a full load.
      const sameEpisode = jacketForVariant(targetId, user?.id) !== null;

      // Atomicity: any session whose lesson differs from the target stops
      // immediately — the old Variant's audio never survives a switch, and
      // stale callbacks can never write into the new Variant.
      if (player.session?.lessonId !== targetId) {
        player.stop();
      }

      const seq = ++seqRef.current;
      lastLoadSeqRef.current = seq;
      wasSwitchingRef.current = sameEpisode;
      setPhase(sameEpisode ? 'switching' : 'loading');
      if (!sameEpisode) setLesson(null);
      setAudioUrl(null);
      setAudioError(false);
      rawAudioUrlRef.current = null;
      setErrorInfo(null);
      setProgress(null);
      setVocabItems(null);
      setVocabFailed(false);

      try {
        const data = await api.getLessonDetail(targetId);
        if (seqRef.current !== seq) return;
        rememberJacket(
          {
            episodeId: data.episode?.id ?? '',
            episode: data.episode ?? null,
            availableLevels: data.availableLevels ?? [],
            recommendedLevel: String(data.recommendedLevel ?? ''),
            preferredLevel: String(data.preferredLevel ?? ''),
          },
          user?.id,
        );
        setLesson(data);
        setPhase('ready');
        if (wasSwitchingRef.current) {
          const level = String(data.level || '');
          if (level) setAnnouncement(productCopy.episodeSurface.variantLoaded(level));
        }

        // Progress, vocabulary and audio token in parallel after detail (perf).
        const progressP = progressApi.getLessonProgress(targetId).then(
          (v) => ({ ok: true as const, value: v }),
          () => ({ ok: false as const }),
        );
        const vocabP = api.getLessonVocabulary(targetId).then(
          (v) => ({ ok: true as const, value: v }),
          () => ({ ok: false as const }),
        );
        const rawUrl = data.audio?.url ?? null;
        rawAudioUrlRef.current = rawUrl;
        const audioP = rawUrl
          ? api.buildProtectedAudioUrl(rawUrl).then(
              (v) => ({ ok: true as const, value: v }),
              () => ({ ok: false as const }),
            )
          : Promise.resolve({ ok: true as const, value: null as string | null });
        const [progRes, vocabRes, audioRes] = await Promise.all([progressP, vocabP, audioP]);
        if (seqRef.current !== seq) return;
        if (progRes.ok && progRes.value) setProgress(progRes.value);
        if (vocabRes.ok && vocabRes.value) setVocabItems(vocabRes.value.items);
        else if (!vocabRes.ok) setVocabFailed(true);
        if (rawUrl) {
          if (audioRes.ok && audioRes.value) setAudioUrl(audioRes.value);
          else setAudioError(true);
        }
      } catch (err) {
        if (seqRef.current !== seq) return;
        const envelope = extractApiError(err);
        const code = envelope.code ?? '';
        const status = envelope.status ?? 0;
        if (status === 404) {
          setPhase('not_found');
          setErrorInfo({
            title: 'اپیزود یافت نشد',
            description: 'این اپیزود وجود ندارد یا در دسترس نیست.',
          });
        } else if (
          code === 'subscription_required' ||
          code === 'account_suspended' ||
          code === 'access_denied'
        ) {
          setPhase('no_entitlement');
          setErrorInfo({
            title: 'دسترسی محدود',
            description: 'شما دسترسی به این اپیزود را ندارید.',
          });
        } else {
          setPhase('error');
          setErrorInfo({
            title: productCopy.errors.episodeLoadFailedTitle,
            // Never surface raw Backend/server copy to Students: the
            // generic path shows controlled Persian product copy only.
            description: productCopy.errors.episodeLoadFailedDescription,
            retry: true,
          });
        }
      }
    },
    [player],
  );

  // Layout effect: the atomic transition (stop + switching phase) applies
  // BEFORE the browser paints the new URL, so a Variant switch can never
  // show the old Variant's content under the new URL — not even one frame.
  useLayoutEffect(() => {
    if (id) void loadLesson(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Retry vocabulary for the current Variant (inline, Library-style).
  const handleVocabRetry = useCallback(() => {
    if (!id) return;
    setVocabFailed(false);
    setVocabItems(null);
    void (async () => {
      const seq = seqRef.current;
      try {
        const vocab = await api.getLessonVocabulary(id);
        if (seqRef.current !== seq) return;
        setVocabItems(vocab.items);
      } catch {
        if (seqRef.current !== seq) return;
        setVocabFailed(true);
      }
    })();
  }, [id]);

  // Restrained focus behavior: while the English transcript is being read
  // the identity block quiets (presentation-only; never hides actions).
  useEffect(() => {
    const el = articleRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setReadingActive(entry.isIntersecting);
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lesson?.id, phase]);

  const handleSelectVariant = useCallback(
    (variantId: string, _level: CefrLevel) => {
      if (variantId === id) return;
      // Atomicity at the click: the old Variant's audio stops NOW, before
      // the route remounts (RouteTransition keys by pathname).
      if (player.session?.lessonId !== variantId) player.stop();
      navigate(`/lessons/${variantId}`);
    },
    [id, navigate],
  );

  const handleUnpublishedAttempt = useCallback((level: CefrLevel) => {
    setAnnouncement(productCopy.episodeSurface.levelUnpublished(level));
  }, []);

  const handleRequirePause = useCallback(() => {
    player.pause();
  }, [player]);

  // Memoized pure derivations (plan 013). MUST live above the early
  // returns so hook order stays stable across phase transitions
  // (loading → ready → switching); inputs are stable payload refs, so
  // player-context re-renders (~4x/s during playback) skip the work.
  const cachedJacket = phase === 'switching' ? jacketForVariant(id, user?.id) : null;
  const railLevels =
    phase === 'switching'
      ? (cachedJacket?.availableLevels ?? lesson?.availableLevels)
      : lesson?.availableLevels;
  const entries: EditionRailEntry[] = useMemo(() => buildEditionRail(railLevels), [railLevels]);
  const transcript = phase === 'ready' ? (lesson?.variant?.transcript ?? '') : '';
  const paragraphs = useMemo(() => splitParagraphs(transcript), [transcript]);

  if (phase === 'loading') {
    return (
      <PageContainer maxWidth="lg">
        <LessonDetailSkeleton />
      </PageContainer>
    );
  }

  if (phase === 'error' || phase === 'no_entitlement' || phase === 'not_found') {
    return (
      <PageContainer maxWidth="lg">
        <StatePanel
          variant={phase === 'error' ? 'error' : 'permission'}
          title={errorInfo?.title || 'خطا'}
          description={errorInfo?.description}
          action={
            <Stack direction="row" spacing={1}>
              {errorInfo?.retry && id ? (
                <Button variant="outlined" onClick={() => void loadLesson(id)}>
                  {productCopy.actions.retry}
                </Button>
              ) : null}
              <Button variant="text" onClick={() => navigate('/library')}>
                {productCopy.actions.goToLibrary}
              </Button>
            </Stack>
          }
        />
      </PageContainer>
    );
  }

  // -----------------------------------------------------------------------
  // ready / switching — jacket stays; variant regions swap atomically.
  // -----------------------------------------------------------------------
  const jacketEpisode =
    phase === 'switching'
      ? (cachedJacket?.episode ?? lesson?.episode ?? null)
      : (lesson?.episode ?? null);
  const jacketVariant =
    phase === 'switching'
      ? null // variant-dependent identity lines hide during the switch
      : (lesson?.variant ?? null);
  const targetEntry = phase === 'switching' ? railEntryForVariant(entries, id) : null;
  const switchingNote =
    phase === 'switching' && targetEntry
      ? productCopy.episodeSurface.loadingVariant(targetEntry.level)
      : null;
  const railDisabled = phase === 'switching';
  const currentLevel = phase === 'ready' && lesson ? (lesson.level as CefrLevel) : null;
  const recommendedLevel = String(lesson?.recommendedLevel ?? cachedJacket?.recommendedLevel ?? '');

  const summaryFa = phase === 'ready' ? (lesson?.variant?.summaryFa ?? '') : '';
  const sessionTitle =
    (jacketEpisode?.titleFa?.trim() || jacketEpisode?.title || '').trim() ||
    productCopy.episode.entity;
  // Resolved Episode artwork for Media Session surfaces (lock screen / OS
  // media controls). The artwork proxy is public + cacheable (accepted
  // artwork policy) and must be an absolute URL for OS fetching (native
  // builds have no shared browser origin).
  const sessionArtwork = lesson?.episode?.artwork
    ? api.resolveMediaUrl(lesson.episode.artwork)
    : null;

  return (
    <PageContainer maxWidth="lg">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { lg: 'minmax(0, 320px) minmax(0, 1fr)' },
          gap: { lg: 4 },
          alignItems: 'start',
        }}
      >
        {/* ---- Jacket column (sticky on desktop; deck sticky on tablet) ---- */}
        <Box
          sx={{
            gridColumn: { lg: 1 },
            minWidth: 0,
            position: { lg: 'sticky' },
            top: { lg: `calc(${layout.headerHeight.md}px + 16px)` },
            alignSelf: 'start',
          }}
        >
          <EpisodeJacket
            episode={jacketEpisode}
            variant={jacketVariant}
            entries={entries}
            currentLevel={currentLevel}
            recommendedLevel={recommendedLevel}
            railDisabled={railDisabled}
            switchingNote={switchingNote}
            readingActive={readingActive}
            onSelectVariant={handleSelectVariant}
            onUnpublishedAttempt={handleUnpublishedAttempt}
          />

          <Box
            data-testid="player-surface"
            sx={{
              mt: 3,
              position: { md: 'sticky', lg: 'static' },
              top: { md: `calc(${layout.headerHeight.md}px + 16px)` },
            }}
          >
            {phase === 'switching' || !lesson ? (
              <Box data-testid="deck-switching">
                <Box
                  sx={{
                    backgroundColor: 'surfaceContainerHigh',
                    borderRadius: '16px',
                    p: 2,
                  }}
                >
                  <Box sx={{ height: 4, backgroundColor: 'surfaceContainerHighest', mb: 2 }} />
                  <Box
                    sx={{
                      height: 16,
                      width: '35%',
                      backgroundColor: 'surfaceContainerHighest',
                      mb: 2,
                    }}
                  />
                  <Box
                    sx={{
                      height: 14,
                      backgroundColor: 'surfaceContainerHighest',
                      mb: 2,
                    }}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 2,
                      mt: 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        backgroundColor: 'surfaceContainerHighest',
                      }}
                    />
                    <Box
                      sx={{
                        width: 128,
                        height: 56,
                        borderRadius: `${radius.radiusPill}px`,
                        backgroundColor: 'surfaceContainerHighest',
                      }}
                    />
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        backgroundColor: 'surfaceContainerHighest',
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            ) : (
              <VariantDeck
                src={audioUrl && !audioError ? audioUrl : null}
                session={{ lessonId: lesson.id, title: sessionTitle, artwork: sessionArtwork }}
                progress={progress}
                level={currentLevel}
                retryable={audioError}
                onTimeUpdate={handleTimeUpdate}
                onPause={handlePause}
                onSeek={handleSeek}
                onEnded={handleEnded}
                onRetry={() => {
                  // Recoverable failure (incl. token expiry mid-playback):
                  // ALWAYS rebuild the protected URL with a fresh file
                  // token, sequence-guarded like every load path. Reloading
                  // the same URL would re-use the expired token and dead-end
                  // the retry.
                  const rawUrl = rawAudioUrlRef.current;
                  if (!rawUrl) return;
                  const retrySeq = lastLoadSeqRef.current;
                  void (async () => {
                    try {
                      const url = await api.buildProtectedAudioUrl(rawUrl);
                      if (seqRef.current !== retrySeq) return;
                      setAudioError(false);
                      // A same-second PB file token is byte-identical to the
                      // previous one (verified: /api/files/token returns the
                      // same JWT within the same second — the payload has no
                      // iat/jti). React would then bail out of the re-render
                      // (Object.is on the state) and the rebuilt source would
                      // never reload — the retry would dead-end. The retry
                      // intent requires a REAL reload, so when the rebuilt
                      // URL is unchanged, append a cache-busting nonce (the
                      // audio proxy ignores unknown query params; the token
                      // stays the authoritative credential).
                      setAudioUrl((current) =>
                        current === url
                          ? `${url}${url.includes('?') ? '&' : '?'}_r=${Date.now()}`
                          : url,
                      );
                    } catch {
                      if (seqRef.current !== retrySeq) return;
                      setAudioError(true);
                    }
                  })();
                }}
              />
            )}
          </Box>
        </Box>

        {/* ---- Reading column (liner notes) ---- */}
        <Box
          sx={{
            gridColumn: { lg: 2 },
            gridRow: { lg: 1 },
            minWidth: 0,
            maxWidth: { lg: layout.readingMaxWidth },
          }}
        >
          <Box
            component="section"
            aria-labelledby="episode-summary-heading"
            data-testid="summary-section"
          >
            <Typography
              component="h2"
              id="episode-summary-heading"
              variant="headlineSmall"
              sx={{ mb: 1.5 }}
            >
              {productCopy.episodeSurface.summarySection}
            </Typography>
            {phase === 'switching' || !lesson ? (
              <Box data-testid="summary-switching">
                <Box
                  sx={{
                    height: 16,
                    width: '100%',
                    backgroundColor: 'surfaceContainerHighest',
                    mb: 1,
                  }}
                />
                <Box
                  sx={{
                    height: 16,
                    width: '90%',
                    backgroundColor: 'surfaceContainerHighest',
                    mb: 1,
                  }}
                />
                <Box
                  sx={{
                    height: 16,
                    width: '60%',
                    backgroundColor: 'surfaceContainerHighest',
                  }}
                />
              </Box>
            ) : (
              <Typography variant="bodyLarge" component="p" sx={{ mb: 3 }}>
                {summaryFa}
              </Typography>
            )}
          </Box>

          {phase === 'switching' || !lesson ? (
            <Box data-testid="vocab-switching" sx={{ mb: 3 }}>
              <Box
                sx={{
                  height: 24,
                  width: '30%',
                  backgroundColor: 'surfaceContainerHighest',
                  mb: 1.5,
                }}
              />
              {[0, 1].map((i) => (
                <Box key={i} sx={{ mb: 2 }}>
                  <Box
                    sx={{
                      height: 18,
                      width: '45%',
                      backgroundColor: 'surfaceContainerHighest',
                      mb: 1,
                    }}
                  />
                  <Box
                    sx={{
                      height: 14,
                      width: '65%',
                      backgroundColor: 'surfaceContainerHighest',
                    }}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <VocabularyList
              items={vocabItems}
              failed={vocabFailed}
              onRetry={handleVocabRetry}
              // Only rendered in the ready branch — a Variant switch hides
              // this whole region behind the switching skeleton.
              disabled={false}
              onRequirePause={handleRequirePause}
            />
          )}

          <Divider sx={{ my: 3 }} />

          {/* English transcript — LTR reading surface, bounded measure,
              plain paragraph rendering only (no arbitrary HTML). */}
          <Box component="section" aria-labelledby="episode-transcript-heading">
            <Typography
              component="h2"
              id="episode-transcript-heading"
              variant="headlineSmall"
              sx={{ mb: 2 }}
            >
              {productCopy.episodeSurface.transcriptSection}
            </Typography>
            {phase === 'switching' || !lesson ? (
              <Box data-testid="transcript-switching">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      height: 16,
                      backgroundColor: 'surfaceContainerHighest',
                      mb: 1,
                      width: i === 5 ? '70%' : '100%',
                    }}
                  />
                ))}
              </Box>
            ) : (
              <Box
                component="article"
                ref={articleRef}
                lang="en"
                dir="ltr"
                data-testid="english-reading"
                sx={{ maxWidth: layout.readingMaxWidth, width: '100%' }}
              >
                {paragraphs.map((paragraph, i) => (
                  <Typography
                    key={`${i}-${paragraph.slice(0, 24)}`}
                    variant="englishReading"
                    component="p"
                    sx={{ mb: 3, textAlign: 'start' }}
                  >
                    {paragraph}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>

          {phase === 'ready' && lesson ? (
            <PrevNextFooter
              previous={lesson.previousEpisode ?? null}
              next={lesson.nextEpisode ?? null}
            />
          ) : null}
        </Box>
      </Box>

      {/* Polite announcements: variant loaded / unpublished level note. */}
      <Box role="status" aria-live="polite" data-testid="episode-live-region">
        <Box
          sx={{
            position: 'absolute',
            clip: 'rect(0,0,0,0)',
            width: '1px',
            height: '1px',
            m: -1,
          }}
        >
          {announcement}
        </Box>
      </Box>
    </PageContainer>
  );
}
