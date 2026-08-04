// app/src/features/payment/components/CopyValue.tsx
// Small copy control with short, accessible feedback. Used for the
// amount and the card number. Never shows a full-page Snackbar; the
// confirmation is a compact inline status (aria-live=polite).
//
// Security: the copy value is never logged; the component only ever
// writes to the clipboard. In insecure contexts (no navigator.clipboard)
// it falls back to a hidden textarea + execCommand, and if even that
// fails it reports "کپی ممکن نشد" — never a false success.

import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { duration, easing } from '../../../app/theme/tokens';

interface Props {
  /** Raw value written to the clipboard (Latin digits, e.g. card number). */
  value: string;
  /** Accessible name of the copy action. */
  label: string;
  /** Extra contextual label shown next to the control when provided. */
  hint?: string;
  /** Disable the control (e.g. while the form is submitting). */
  disabled?: boolean;
  'data-testid'?: string;
}

const FEEDBACK_MS = 1600;

/**
 * Copy the given value to the clipboard. Returns true on success.
 * `navigator.clipboard` requires a secure context; the execCommand
 * fallback works in http contexts and Android WebViews.
 */
export async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function CopyValue({ value, label, hint, disabled, 'data-testid': testId }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (disabled) return;
    const ok = await copyTextToClipboard(value);
    setState(ok ? 'copied' : 'failed');
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setState('idle'), FEEDBACK_MS);
  };

  const statusLabel = state === 'copied' ? 'کپی شد' : state === 'failed' ? 'کپی ممکن نشد' : null;

  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        minWidth: 0,
        // The status line appears/disappears without pushing layout.
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
      }}
    >
      {hint ? (
        <Typography variant="caption" color="text.secondary" component="span">
          {hint}
        </Typography>
      ) : null}
      <Tooltip title={state === 'copied' ? 'کپی شد' : label} arrow>
        <span>
          <IconButton
            onClick={handleCopy}
            disabled={disabled}
            aria-label={label}
            size="small"
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            {state === 'copied' ? (
              <CheckRoundedIcon fontSize="small" />
            ) : (
              <ContentCopyRoundedIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>
      <Typography
        variant="caption"
        color={state === 'failed' ? 'error.main' : 'success.main'}
        role="status"
        aria-live="polite"
        sx={{
          fontWeight: 600,
          opacity: statusLabel ? 1 : 0,
          transition: `opacity ${duration.durationFast}ms ${easing.easingStandard}`,
          whiteSpace: 'nowrap',
        }}
      >
        {statusLabel ?? '‌'}
      </Typography>
    </Box>
  );
}
