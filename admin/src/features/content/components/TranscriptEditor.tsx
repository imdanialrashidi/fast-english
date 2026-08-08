// admin/src/features/content/components/TranscriptEditor.tsx
// Long-form transcript editor: LTR surface, English semantics, explicit
// save with robust status feedback, character count and an optional
// preview that renders the same safe plain-text presentation the
// Student App uses (no HTML execution).

import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
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
import { useEffect, useMemo, useState } from 'react';
import { saveTranscript } from '../api';
import { safeErrorMessage } from '../errors';
import type { UnsavedState } from '../unsaved';
import { SaveStateChip, saveStateOf } from './SaveStateChip';

const MAX_TRANSCRIPT = 50_000;

export interface TranscriptEditorProps {
  variantId: string;
  initial: string;
  unsaved: UnsavedState;
  onSaved: () => void;
}

export function TranscriptEditor({ variantId, initial, unsaved, onSaved }: TranscriptEditorProps) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  // The server normalizes line endings/whitespace; after a server ack the
  // editor resyncs so the saved state is truthful.
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
      await saveTranscript(variantId, text);
      unsaved.finishSave(true);
      onSaved();
    } catch (err) {
      setError(safeErrorMessage(err));
      unsaved.finishSave(false);
    }
  };

  const count = useMemo(() => text.length, [text]);
  const state = saveStateOf(unsaved.isDirty, unsaved.isSaving, unsaved.saveState);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography variant="titleMedium">متن اپیزود (نسخه انگلیسی)</Typography>
            <SaveStateChip state={state} testId="transcript-save-state" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            متن کامل اپیزود به انگلیسی، خط به خط. برای حفظ پاراگرافها از خط خالی استفاده کنید.
          </Typography>
          <Box dir="ltr" sx={{ textAlign: 'start' }}>
            <TextareaAutosize
              minRows={12}
              maxRows={28}
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, MAX_TRANSCRIPT));
                unsaved.markDirty();
              }}
              aria-label="متن اپیزود"
              dir="ltr"
              data-testid="transcript-input"
              style={{
                width: '100%',
                minHeight: 240,
                padding: 12,
                borderRadius: 10,
                border: '1px solid',
                borderColor: 'var(--mui-palette-outlineVariant)',
                backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
                color: 'var(--mui-palette-onSurface)',
                fontFamily: 'inherit',
                fontSize: '0.95rem',
                lineHeight: 1.7,
                resize: 'vertical',
              }}
            />
          </Box>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" data-testid="transcript-count">
              {count.toLocaleString('fa-IR')} نویسه از ۵۰٬۰۰۰
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={() => setPreview((p) => !p)}
              data-testid="transcript-preview-toggle"
            >
              {preview ? 'بستن پیشنمایش' : 'پیشنمایش متن'}
            </Button>
          </Stack>
          {preview ? (
            <Box
              dir="ltr"
              data-testid="transcript-preview"
              sx={{
                textAlign: 'start',
                whiteSpace: 'pre-wrap',
                maxHeight: 300,
                overflow: 'auto',
                padding: 2,
                borderRadius: 2,
                backgroundColor: 'surfaceContainerLow',
                fontSize: '0.95rem',
                lineHeight: 1.8,
              }}
            >
              {text || '—'}
            </Box>
          ) : null}
          {error ? (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          ) : null}
          <Box>
            <Button
              variant="contained"
              startIcon={<ArticleRoundedIcon />}
              onClick={() => void save()}
              disabled={unsaved.isSaving || !unsaved.isDirty}
              data-testid="transcript-save"
              sx={{ minHeight: 44 }}
            >
              ذخیره متن
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
