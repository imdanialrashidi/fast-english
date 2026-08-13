// app/src/features/episode/components/VocabularyList.tsx
// Slice 7 — key vocabulary as an editorial typographic list (never a table,
// never a card wall, never flash-card mode).
//
// Row anatomy: term (LTR, bold) + phonetic (LTR, muted) + part of speech
// (plain text label) on line one; Persian meaning on line two. Expansion
// (one open at a time) reveals the English definition, the example
// sentence and the pronunciation control.
//
// Pronunciation contract (accepted design):
//   - prefers the uploaded protected pronunciation audio;
//   - falls back to English device/browser speech synthesis when no file;
//   - otherwise shows the honest unavailable line;
//   - exclusivity: before ANY pronunciation playback the Episode audio is
//     paused via onRequirePause(); the clip never seeks the Episode and
//     never writes Episode progress; the control is disabled while a
//     Variant switch is in flight (stale audio impossible).

import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { productCopy } from '../../../app/copy/productCopy';
import { buildProtectedAudioUrl } from '../../lessons/api';
import type { VocabularyItem } from '../../lessons/types';
import { nextOpenId, waitForEnglishVoice } from '../logic';
import { createPronunciationPlayback } from '../pronunciationPlayback';
export type PronunciationStatus = 'idle' | 'loading' | 'playing' | 'unavailable';

export interface VocabularyListProps {
  /** null while loading; empty array = legitimate empty Variant. */
  items: VocabularyItem[] | null;
  failed: boolean;
  onRetry: () => void;
  /** True while a Variant switch is in flight (controls disabled). */
  disabled: boolean;
  /** Pause the Episode audio before any pronunciation playback. */
  onRequirePause: () => void;
}

export function VocabularyList({
  items,
  failed,
  onRetry,
  disabled,
  onRequirePause,
}: VocabularyListProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<PronunciationStatus>('idle');
  const [unavailableIds, setUnavailableIds] = useState<ReadonlySet<string>>(new Set());
  const [errorIds, setErrorIds] = useState<ReadonlySet<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  // Monotonic playback request token: an older in-flight pronunciation
  // URL resolution (or TTS voice wait) can never take over playback after
  // the student selected another word or stopped.
  const playbackRef = useRef<ReturnType<typeof createPronunciationPlayback> | null>(null);

  const stopCurrent = useCallback(() => {
    playbackRef.current?.stop();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setActiveId(null);
    setStatus('idle');
  }, []);

  const markUnavailable = useCallback((id: string) => {
    setUnavailableIds((prev) => new Set(prev).add(id));
    setErrorIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setActiveId(null);
    setStatus('unavailable');
  }, []);

  // Transient pronunciation failure (network blip, rate limit): the word
  // is NOT unavailable — the control offers a retry. Only the definitive
  // chain end (no file + no English TTS voice) marks a word unavailable.
  const markRetryable = useCallback((id: string) => {
    setErrorIds((prev) => new Set(prev).add(id));
    setActiveId(null);
    setStatus('idle');
  }, []);

  // Attach the word-scoped playback session to the shared hidden audio
  // host; stop everything on unmount / Variant switch: no orphaned audio,
  // no dangling TTS utterance, no state leaking into the next Variant.
  useEffect(() => {
    mountedRef.current = true;
    playbackRef.current = audioRef.current
      ? createPronunciationPlayback(audioRef.current, {
          onPlaying: (id) => {
            if (!mountedRef.current) return;
            setActiveId(id);
            setStatus('playing');
          },
          // Natural clip completion returns the surface to idle.
          onIdle: () => {
            if (!mountedRef.current) return;
            setActiveId(null);
            setStatus('idle');
          },
          // Media failure — retryable, never a permanent unavailable.
          onRetryable: (id) => {
            if (!mountedRef.current) return;
            markRetryable(id);
          },
        })
      : null;
    return () => {
      mountedRef.current = false;
      playbackRef.current?.stop();
      playbackRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [markRetryable]);

  const speakViaTts = useCallback(
    (item: VocabularyItem, voice: SpeechSynthesisVoice) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        markUnavailable(item.id);
        return;
      }
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(item.term);
      // The token this utterance belongs to: if the student moved to
      // another word (or stopped) while the utterance was in flight, its
      // queued onend/onerror('canceled') tasks must NOT clobber the newer
      // word's state.
      const tokenAtSpeak = playbackRef.current?.requestToken ?? 0;
      const stillCurrent = () => {
        const session = playbackRef.current;
        return !session || session.isCurrent(tokenAtSpeak);
      };
      utterance.lang = voice.lang;
      utterance.voice = voice;
      utterance.onend = () => {
        if (mountedRef.current && stillCurrent()) {
          setActiveId(null);
          setStatus('idle');
        }
      };
      utterance.onerror = (event) => {
        if (!mountedRef.current) return;
        // A newer control action (stop, next pronunciation, unmount) can
        // interrupt an in-flight utterance — the word itself is fine, and
        // the newer action owns the surface state.
        if (event.error === 'interrupted' || event.error === 'canceled') {
          if (stillCurrent()) {
            setActiveId(null);
            setStatus('idle');
          }
          return;
        }
        markUnavailable(item.id);
      };
      setActiveId(item.id);
      setStatus('playing');
      synth.speak(utterance);
    },
    [markUnavailable],
  );

  const play = useCallback(
    (item: VocabularyItem) => {
      if (disabledRef.current) return;
      stopCurrent();
      // Pronunciation exclusivity: the Episode pauses FIRST; the clip
      // never seeks it, never saves progress, never plays alongside it.
      onRequirePause();
      if (item.pronunciation) {
        const session = playbackRef.current;
        if (!session) return;
        const requestToken = session.start(item.id);
        setActiveId(item.id);
        setStatus('loading');
        void (async () => {
          try {
            const url = await buildProtectedAudioUrl(item.pronunciation?.url ?? '');
            // A newer start/stop (or unmount) invalidates this request —
            // the stale URL can never switch playback to the wrong word.
            await session.applyUrl(requestToken, item.id, url);
          } catch {
            // Network/rate-limit failure — retryable, not unavailable.
            session.handleBuildFailure(requestToken, item.id);
          }
        })();
        return;
      }
      const synth =
        typeof window !== 'undefined' && 'speechSynthesis' in window
          ? window.speechSynthesis
          : null;
      if (!synth) {
        markUnavailable(item.id);
        return;
      }
      const session = playbackRef.current;
      const requestToken = session ? session.requestToken : 0;
      setActiveId(item.id);
      setStatus('loading');
      // Voices may still be loading (getVoices() empty until
      // `voiceschanged`) — wait for the English voice before deciding.
      void (async () => {
        const voice = await waitForEnglishVoice(synth);
        // The student may have selected another word (or stopped) while
        // the voice was arriving — the wait result belongs to this
        // request only.
        if (!mountedRef.current || disabledRef.current) return;
        if (session && !session.isCurrent(requestToken)) return;
        if (voice) {
          speakViaTts(item, voice);
        } else {
          markUnavailable(item.id);
        }
      })();
    },
    [stopCurrent, speakViaTts, markUnavailable, markRetryable, onRequirePause],
  );

  const heading = items ? productCopy.episodeSurface.vocabularySection(items.length) : '';

  return (
    <Box component="section" aria-labelledby="vocabulary-heading" data-testid="vocabulary-section">
      <Typography component="h2" id="vocabulary-heading" variant="headlineSmall" sx={{ mb: 1.5 }}>
        {heading || productCopy.episodeSurface.vocabularySection(0)}
      </Typography>

      {/* Hidden pronunciation audio host — one element, mounted only with
          the list; only the Episode's shared element (PlayerProvider) may
          ever play Episode audio, and the two never play simultaneously. */}
      <audio ref={audioRef} data-testid="pronunciation-audio" hidden preload="none">
        <track kind="captions" src="data:text/vtt,WEBVTT%0A%0A" srcLang="en" label="English" />
      </audio>

      {items === null && !failed ? (
        <Stack spacing={1.5} data-testid="vocabulary-loading">
          {[0, 1, 2].map((i) => (
            <Box key={i}>
              <Box
                sx={{
                  height: 18,
                  width: '40%',
                  bgcolor: 'surfaceContainerHighest',
                }}
              />
              <Box
                sx={{
                  height: 14,
                  width: '70%',
                  bgcolor: 'surfaceContainerHighest',
                  mt: 1,
                }}
              />
            </Box>
          ))}
        </Stack>
      ) : failed ? (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}
        >
          <Typography variant="body2" color="text.secondary" role="alert">
            {productCopy.episodeSurface.vocabularyFailed}
          </Typography>
          <Button size="small" variant="outlined" onClick={onRetry} sx={{ minHeight: 44 }}>
            {productCopy.actions.retry}
          </Button>
        </Stack>
      ) : items && items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {productCopy.episodeSurface.vocabularyEmpty}
        </Typography>
      ) : items ? (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {items.map((item) => {
            const open = openId === item.id;
            const unavailable = unavailableIds.has(item.id);
            const active = activeId === item.id;
            return (
              <Box component="li" key={item.id} data-testid={`vocab-row-${item.id}`}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId((current) => nextOpenId(current, item.id))}
                  disabled={disabled}
                  data-testid={`vocab-expander-${item.id}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '12px 0',
                    cursor: 'pointer',
                    font: 'inherit',
                    color: 'inherit',
                    textAlign: 'start',
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'baseline', flexWrap: 'wrap', gap: 1 }}
                  >
                    <Typography
                      lang="en"
                      dir="ltr"
                      variant="titleMedium"
                      component="span"
                      sx={{ fontWeight: 700, textAlign: 'start' }}
                    >
                      {item.term}
                    </Typography>
                    {item.phonetic ? (
                      <Typography
                        lang="en"
                        dir="ltr"
                        variant="englishMetadata"
                        color="text.secondary"
                        component="span"
                        sx={{ textAlign: 'start' }}
                      >
                        {item.phonetic}
                      </Typography>
                    ) : null}
                    {item.partOfSpeech ? (
                      <Typography variant="caption" color="text.secondary" component="span">
                        {item.partOfSpeech}
                      </Typography>
                    ) : null}
                  </Stack>
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
                  >
                    {item.meaningFa}
                  </Typography>
                </button>

                {open ? (
                  <Box data-testid={`vocab-detail-${item.id}`} sx={{ pb: 2, pl: 0.5 }}>
                    {item.definitionEn ? (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="span"
                          sx={{ display: 'block' }}
                        >
                          {productCopy.episodeSurface.definitionLabel}
                        </Typography>
                        <Typography
                          lang="en"
                          dir="ltr"
                          variant="englishReading"
                          component="p"
                          sx={{ fontSize: '1rem', lineHeight: 1.7, mt: 0.25 }}
                        >
                          {item.definitionEn}
                        </Typography>
                      </Box>
                    ) : null}
                    {item.exampleSentence ? (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="span"
                          sx={{ display: 'block' }}
                        >
                          {productCopy.episodeSurface.exampleLabel}
                        </Typography>
                        <Typography
                          lang="en"
                          dir="ltr"
                          variant="englishReading"
                          component="p"
                          sx={{ fontSize: '1rem', lineHeight: 1.7, mt: 0.25 }}
                        >
                          {item.exampleSentence}
                        </Typography>
                      </Box>
                    ) : null}

                    {unavailable ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        data-testid={`pron-unavailable-${item.id}`}
                      >
                        {productCopy.episodeSurface.pronunciationUnavailable}
                      </Typography>
                    ) : (
                      <Box>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={disabled}
                          onClick={() =>
                            active && status === 'playing' ? stopCurrent() : play(item)
                          }
                          data-testid={`pron-control-${item.id}`}
                          startIcon={
                            active && status === 'playing' ? (
                              <GraphicEqRoundedIcon />
                            ) : active && status === 'loading' ? (
                              <GraphicEqRoundedIcon fontSize="small" />
                            ) : (
                              <VolumeUpRoundedIcon />
                            )
                          }
                          sx={{ minHeight: 44 }}
                        >
                          {active && status === 'playing'
                            ? productCopy.episodeSurface.stopPronunciation
                            : active && status === 'loading'
                              ? '…'
                              : errorIds.has(item.id)
                                ? productCopy.episodeSurface.pronunciationRetry
                                : productCopy.episodeSurface.playPronunciation}
                        </Button>
                      </Box>
                    )}
                  </Box>
                ) : null}
                <Divider />
              </Box>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
}
