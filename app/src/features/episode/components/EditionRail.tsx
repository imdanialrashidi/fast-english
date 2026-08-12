// app/src/features/episode/components/EditionRail.tsx
// Slice 7 — the Edition Rail: six CEFR plates beneath the artwork, like
// edition labels on an album.
//
// Semantics (accepted design contract):
//   - radiogroup of the published levels; the current Variant's plate is
//     filled with its level pair and carries aria-checked + aria-current;
//   - «پیشنهادی» / «پیش‌فرض» markers are small captions under the plates —
//     guidance only, never a restriction;
//   - unpublished levels are honest disabled plates (aria-disabled) that
//     reveal the honest line on tap — never invented "coming soon" states;
//   - while a Variant switch is in flight the whole rail is disabled and no
//     plate is marked current (no old/new mixed state, even briefly);
//   - roving tabindex + arrow-key navigation (standard radiogroup).

import { Box, Typography } from '@mui/material';
import { useCallback, useRef } from 'react';
import type { CefrLevel } from '../../../../../shared/ui/tokens/cefr';
import { cefr } from '../../../../../shared/ui/tokens/cefr';
import { productCopy } from '../../../app/copy/productCopy';
import type { EditionRailEntry } from '../logic';

export interface EditionRailProps {
  entries: EditionRailEntry[];
  /** Current Variant level (null while switching — nothing is current). */
  currentLevel: CefrLevel | null;
  /** True while a Variant switch is in flight (no interaction, no current). */
  disabled: boolean;
  onSelect: (variantId: string, level: CefrLevel) => void;
  onUnpublishedAttempt: (level: CefrLevel) => void;
  'data-testid'?: string;
}

const PLATE_SIZE = 44;

export function EditionRail({
  entries,
  currentLevel,
  disabled,
  onSelect,
  onUnpublishedAttempt,
  'data-testid': testId,
}: EditionRailProps) {
  const publishedEntries = entries.filter((e) => e.variantId !== null);
  const plateRefs = useRef(new Map<string, HTMLButtonElement>());

  const focusPlate = useCallback((level: string) => {
    const el = plateRefs.current.get(level);
    el?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, level: CefrLevel) => {
      if (disabled) return;
      const index = publishedEntries.findIndex((e) => e.level === level);
      if (index < 0) return;
      let next = -1;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        next = index - 1;
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        next = index + 1;
      } else if (event.key === 'Home') {
        next = 0;
      } else if (event.key === 'End') {
        next = publishedEntries.length - 1;
      }
      if (next >= 0 && next < publishedEntries.length) {
        event.preventDefault();
        focusPlate(publishedEntries[next].level);
      }
    },
    [disabled, publishedEntries, focusPlate],
  );

  return (
    <Box
      role="radiogroup"
      aria-label={productCopy.episodeSurface.levelRailLabel}
      data-testid={testId ?? 'edition-rail'}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        mt: 1.5,
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {entries.map((entry) => {
        const palette = cefr[entry.level];
        const isCurrent = !disabled && entry.variantId !== null && currentLevel === entry.level;
        // Marker precedence: «پیش‌فرض» (the student's explicit choice) wins
        // over «پیشنهادی» (guidance) when a plate is both — the plate is
        // 44px and a second caption would crowd it; preferred is the
        // stronger signal (chosen, not suggested).
        const marker =
          entry.variantId !== null
            ? entry.isPreferred
              ? productCopy.episodeSurface.preferredMarker
              : entry.isRecommended
                ? productCopy.episodeSurface.recommendedMarker
                : null
            : null;

        if (entry.variantId === null) {
          // Honest disabled plate: muted, tappable to reveal the line.
          return (
            <Box
              key={entry.level}
              sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
            >
              <Box
                component="button"
                type="button"
                aria-disabled="true"
                aria-label={productCopy.episodeSurface.plateUnpublishedLabel(entry.level)}
                data-testid={`edition-plate-${entry.level}`}
                onClick={() => onUnpublishedAttempt(entry.level)}
                sx={{
                  width: PLATE_SIZE,
                  height: PLATE_SIZE,
                  borderRadius: '10px',
                  border: '1px dashed',
                  borderColor: 'outlineVariant',
                  backgroundColor: 'disabledBackground',
                  color: 'disabledForeground',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  lineHeight: 1,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {entry.level}
              </Box>
            </Box>
          );
        }

        const checked = isCurrent;
        return (
          <Box
            key={entry.level}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
          >
            <Box
              component="button"
              type="button"
              role="radio"
              aria-checked={checked}
              aria-current={checked ? 'true' : undefined}
              aria-label={productCopy.episodeSurface.plateLabel(entry.level)}
              ref={(el: HTMLButtonElement | null) => {
                if (el) plateRefs.current.set(entry.level, el);
                else plateRefs.current.delete(entry.level);
              }}
              tabIndex={checked ? 0 : -1}
              data-testid={`edition-plate-${entry.level}`}
              onClick={() => {
                if (!isCurrent) onSelect(entry.variantId as string, entry.level);
              }}
              onKeyDown={(event) => handleKeyDown(event, entry.level)}
              sx={{
                width: PLATE_SIZE,
                height: PLATE_SIZE,
                borderRadius: '10px',
                border: 1,
                borderColor: isCurrent ? 'transparent' : 'outlineVariant',
                backgroundColor: isCurrent ? palette.bg : 'surfaceContainerLow',
                color: isCurrent ? palette.fg : 'onSurfaceVariant',
                fontWeight: 700,
                fontSize: '0.8125rem',
                lineHeight: 1,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': isCurrent
                  ? { filter: 'brightness(0.96)' }
                  : { backgroundColor: 'surfaceContainerHighest' },
              }}
            >
              {entry.level}
            </Box>
            {marker ? (
              <Typography
                variant="caption"
                component="span"
                sx={{
                  fontSize: '0.6875rem',
                  lineHeight: 1.4,
                  color: 'text.secondary',
                  textAlign: 'center',
                }}
              >
                {marker}
              </Typography>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
