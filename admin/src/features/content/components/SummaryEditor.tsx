// admin/src/features/content/components/SummaryEditor.tsx
// Bounded Persian summary editor with character count, required-state
// indication and explicit save.

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextareaAutosize,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { updateVariant } from '../api';
import { safeErrorMessage } from '../errors';
import type { UnsavedState } from '../unsaved';
import { SaveStateChip, saveStateOf } from './SaveStateChip';

const SUMMARY_MAX = 500;

export interface SummaryEditorProps {
  variantId: string;
  initial: string;
  unsaved: UnsavedState;
  onSaved: () => void;
}

export function SummaryEditor({ variantId, initial, unsaved, onSaved }: SummaryEditorProps) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unsaved.isDirty && !unsaved.isSaving) {
      setText(initial);
      setError(null);
    }
  }, [initial, unsaved.isDirty, unsaved.isSaving]);

  const save = async () => {
    setError(null);
    unsaved.beginSave();
    try {
      await updateVariant(variantId, { summary_fa: text.trim() });
      unsaved.finishSave(true);
      onSaved();
    } catch (err) {
      setError(safeErrorMessage(err));
      unsaved.finishSave(false);
    }
  };

  const state = saveStateOf(unsaved.isDirty, unsaved.isSaving, unsaved.saveState);
  const empty = text.trim().length === 0;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography variant="titleMedium">خلاصه فارسی</Typography>
            <SaveStateChip state={state} testId="summary-save-state" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            این خلاصه پیش از شروع اپیزود به دانشجو کمک میکند موضوع را سریع درک کند.
          </Typography>
          <TextareaAutosize
            minRows={4}
            maxRows={10}
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, SUMMARY_MAX));
              unsaved.markDirty();
            }}
            aria-label="خلاصه فارسی نسخه"
            data-testid="summary-input"
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border: '1px solid',
              borderColor: empty
                ? 'var(--mui-palette-error-main)'
                : 'var(--mui-palette-outlineVariant)',
              backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
              color: 'var(--mui-palette-onSurface)',
              fontFamily: 'inherit',
              fontSize: '0.95rem',
              lineHeight: 1.7,
              resize: 'vertical',
            }}
          />
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" data-testid="summary-count">
              {text.length.toLocaleString('fa-IR')} نویسه از ۵۰۰
            </Typography>
            {empty ? (
              <Typography variant="caption" color="error" role="alert">
                انتشار این نسخه نیازمند خلاصه فارسی است.
              </Typography>
            ) : null}
          </Stack>
          {error ? (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          ) : null}
          <Box>
            <Button
              variant="contained"
              onClick={() => void save()}
              disabled={unsaved.isSaving || !unsaved.isDirty}
              data-testid="summary-save"
              sx={{ minHeight: 44 }}
            >
              ذخیره خلاصه
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
