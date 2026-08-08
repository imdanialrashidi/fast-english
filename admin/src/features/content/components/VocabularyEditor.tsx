// admin/src/features/content/components/VocabularyEditor.tsx
// Vocabulary workspace: compact editable list (word | معنی فارسی |
// English definition), inline add/edit, delete, reorder, optional
// pronunciation audio per word, and fast batch paste with a parsed-row
// preview. The server remains authoritative (normalization, the 100-word
// maximum, duplicate rejection).

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  TextareaAutosize,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import {
  createVocabularyEntry,
  deleteVocabularyEntry,
  pronunciationUrl,
  removePronunciation,
  reorderVocabulary,
  updateVocabularyEntry,
  uploadPronunciation,
} from '../api';
import { safeErrorMessage } from '../errors';
import type { VocabularyEntry } from '../types';
import { parseVocabularyBatch } from '../vocabularyBatch';

export interface VocabularyEditorProps {
  variantId: string;
  entries: VocabularyEntry[];
  onChanged: () => void;
}

interface DraftEntry {
  term: string;
  phonetic: string;
  partOfSpeech: string;
  meaningFa: string;
  definitionEn: string;
  exampleSentence: string;
}

const EMPTY_DRAFT: DraftEntry = {
  term: '',
  phonetic: '',
  partOfSpeech: '',
  meaningFa: '',
  definitionEn: '',
  exampleSentence: '',
};

export function VocabularyEditor({ variantId, entries, onChanged }: VocabularyEditorProps) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<DraftEntry>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchPreview, setBatchPreview] = useState<ParsedPreview | null>(null);
  const pronInputRef = useRef<HTMLInputElement>(null);

  const startEdit = (id: string, entry: VocabularyEntry) => {
    setEditingId(id);
    setDraft({
      term: entry.term,
      phonetic: entry.phonetic,
      partOfSpeech: entry.partOfSpeech,
      meaningFa: entry.meaningFa,
      definitionEn: entry.definitionEn,
      exampleSentence: entry.exampleSentence,
    });
    setError(null);
  };

  const startNew = () => {
    setEditingId('new');
    setDraft(EMPTY_DRAFT);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError(null);
  };

  const saveDraft = async () => {
    setError(null);
    if (!draft.term.trim() || !draft.meaningFa.trim() || !draft.definitionEn.trim()) {
      setError('واژه، معنی فارسی و توضیح انگلیسی الزامی هستند.');
      return;
    }
    setBusy(true);
    try {
      if (editingId === 'new') {
        await createVocabularyEntry(variantId, {
          term: draft.term,
          meaning_fa: draft.meaningFa,
          definition_en: draft.definitionEn,
          phonetic: draft.phonetic,
          part_of_speech: draft.partOfSpeech,
          example_sentence: draft.exampleSentence,
        });
      } else if (editingId) {
        await updateVocabularyEntry(editingId, {
          term: draft.term,
          meaning_fa: draft.meaningFa,
          definition_en: draft.definitionEn,
          phonetic: draft.phonetic,
          part_of_speech: draft.partOfSpeech,
          example_sentence: draft.exampleSentence,
        });
      }
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(safeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      await deleteVocabularyEntry(id);
      onChanged();
    } catch (err) {
      setError(safeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    const ids = entries.map((e) => e.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true);
    try {
      await reorderVocabulary(ids);
      onChanged();
    } catch (err) {
      setError(safeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleBatchParse = () => {
    const parsed = parseVocabularyBatch(batchText);
    setBatchPreview({
      rows: parsed.rows,
      skipped: parsed.skipped,
      truncated: parsed.truncated,
    });
  };

  const handleBatchApply = async () => {
    if (!batchPreview) return;
    setError(null);
    setBusy(true);
    let ok = 0;
    let failed = 0;
    for (const row of batchPreview.rows) {
      try {
        await createVocabularyEntry(variantId, {
          term: row.term,
          meaning_fa: row.meaningFa,
          definition_en: row.definitionEn,
        });
        ok++;
      } catch {
        failed++;
      }
    }
    setBusy(false);
    setBatchText('');
    setBatchPreview(null);
    setBatchOpen(false);
    if (failed > 0) {
      setError(
        `${ok.toLocaleString('fa-IR')} واژه افزوده شد؛ ${failed.toLocaleString('fa-IR')} واژه تکراری یا نامعتبر نادیده گرفته شد.`,
      );
    }
    onChanged();
  };

  const pickPronunciation = async (id: string, file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await uploadPronunciation(id, file);
      onChanged();
    } catch (err) {
      setError(safeErrorMessage(err));
    } finally {
      setBusy(false);
      if (pronInputRef.current) pronInputRef.current.value = '';
    }
  };

  const removePron = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      await removePronunciation(id);
      onChanged();
    } catch (err) {
      setError(safeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
          >
            <Typography variant="titleMedium">
              واژگان ({entries.length.toLocaleString('fa-IR')})
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setBatchOpen((o) => !o)}
                data-testid="vocab-batch-toggle"
                sx={{ minHeight: 44 }}
              >
                ورود گروهی
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={startNew}
                data-testid="vocab-add"
                sx={{ minHeight: 44 }}
              >
                افزودن واژه
              </Button>
            </Stack>
          </Stack>

          {batchOpen ? (
            <Card variant="outlined" sx={{ backgroundColor: 'surfaceContainerLow' }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="body2">
                    هر خط یک واژه: <b dir="ltr">word [TAB] معنی فارسی [TAB] English definition</b>
                  </Typography>
                  <TextareaAutosize
                    minRows={4}
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    aria-label="متن ورود گروهی واژگان"
                    dir="ltr"
                    data-testid="vocab-batch-input"
                    style={{
                      width: '100%',
                      padding: 10,
                      borderRadius: 10,
                      border: '1px solid var(--mui-palette-outlineVariant)',
                      fontFamily: 'inherit',
                      fontSize: '0.9rem',
                      lineHeight: 1.6,
                      textAlign: 'start',
                    }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleBatchParse}
                      disabled={!batchText.trim()}
                      data-testid="vocab-batch-preview"
                      sx={{ minHeight: 44 }}
                    >
                      پیشنمایش ردیفها
                    </Button>
                    {batchPreview ? (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => void handleBatchApply()}
                        disabled={busy || batchPreview.rows.length === 0}
                        data-testid="vocab-batch-apply"
                        sx={{ minHeight: 44 }}
                      >
                        افزودن {batchPreview.rows.length.toLocaleString('fa-IR')} واژه
                      </Button>
                    ) : null}
                  </Stack>
                  {batchPreview ? (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {batchPreview.rows.length.toLocaleString('fa-IR')} ردیف آماده است
                        {batchPreview.skipped > 0
                          ? `؛ ${batchPreview.skipped.toLocaleString('fa-IR')} خط ناقص نادیده گرفته شد`
                          : ''}
                        {batchPreview.truncated ? '؛ برخی مقادیر تا حد مجاز کوتاه شدند' : ''}
                      </Typography>
                      <Box data-testid="vocab-batch-rows" sx={{ mt: 1 }}>
                        {batchPreview.rows.map((r, i) => (
                          <Typography key={i} variant="body2" dir="ltr" sx={{ textAlign: 'start' }}>
                            {r.term} — {r.meaningFa} — {r.definitionEn}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          {editingId !== null ? (
            <Card variant="outlined" sx={{ backgroundColor: 'surfaceContainerLow' }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {editingId === 'new' ? 'واژه جدید' : 'ویرایش واژه'}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      label="واژه (انگلیسی)"
                      value={draft.term}
                      onChange={(e) => setDraft((d) => ({ ...d, term: e.target.value }))}
                      dir="ltr"
                      size="small"
                      sx={{ flex: 1 }}
                      data-testid="vocab-field-term"
                    />
                    <TextField
                      label="معنی فارسی"
                      value={draft.meaningFa}
                      onChange={(e) => setDraft((d) => ({ ...d, meaningFa: e.target.value }))}
                      size="small"
                      sx={{ flex: 1 }}
                      data-testid="vocab-field-meaning"
                    />
                    <TextField
                      label="English definition"
                      value={draft.definitionEn}
                      onChange={(e) => setDraft((d) => ({ ...d, definitionEn: e.target.value }))}
                      dir="ltr"
                      size="small"
                      sx={{ flex: 1 }}
                      data-testid="vocab-field-definition"
                    />
                  </Stack>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                      <Typography variant="body2">فیلدهای تکمیلی</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1.5}>
                        <TextField
                          label="تلفظ (phonetic)"
                          value={draft.phonetic}
                          onChange={(e) => setDraft((d) => ({ ...d, phonetic: e.target.value }))}
                          dir="ltr"
                          size="small"
                          data-testid="vocab-field-phonetic"
                        />
                        <TextField
                          label="نقش دستوری (part of speech)"
                          value={draft.partOfSpeech}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, partOfSpeech: e.target.value }))
                          }
                          dir="ltr"
                          size="small"
                          data-testid="vocab-field-pos"
                        />
                        <TextField
                          label="جمله مثال"
                          value={draft.exampleSentence}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, exampleSentence: e.target.value }))
                          }
                          dir="ltr"
                          size="small"
                          multiline
                          minRows={2}
                          data-testid="vocab-field-example"
                        />
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => void saveDraft()}
                      disabled={busy}
                      data-testid="vocab-save"
                      sx={{ minHeight: 44 }}
                    >
                      ذخیره واژه
                    </Button>
                    <Button variant="text" size="small" onClick={cancelEdit} sx={{ minHeight: 44 }}>
                      انصراف
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ) : null}

          {error ? (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          ) : null}

          {entries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              هنوز واژهای ثبت نشده است.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {entries.map((entry, index) => (
                <Card key={entry.id} variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Stack spacing={0}>
                        <IconButton
                          size="small"
                          aria-label="بالا بردن"
                          onClick={() => void move(index, -1)}
                          disabled={index === 0}
                          data-testid={`vocab-up-${entry.id}`}
                        >
                          <KeyboardArrowUpRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="پایین آوردن"
                          onClick={() => void move(index, 1)}
                          disabled={index === entries.length - 1}
                          data-testid={`vocab-down-${entry.id}`}
                        >
                          <KeyboardArrowDownRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
                        >
                          <Typography
                            variant="body1"
                            dir="ltr"
                            sx={{ fontWeight: 700, textAlign: 'start' }}
                          >
                            {entry.term}
                          </Typography>
                          {entry.phonetic ? (
                            <Typography variant="caption" color="text.secondary" dir="ltr">
                              {entry.phonetic}
                            </Typography>
                          ) : null}
                          {entry.partOfSpeech ? (
                            <Typography variant="caption" color="text.secondary" dir="ltr">
                              {entry.partOfSpeech}
                            </Typography>
                          ) : null}
                        </Stack>
                        <Typography variant="body2">{entry.meaningFa}</Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          dir="ltr"
                          sx={{ textAlign: 'start' }}
                        >
                          {entry.definitionEn}
                        </Typography>
                        {entry.exampleSentence ? (
                          <Typography
                            variant="caption"
                            dir="ltr"
                            sx={{
                              display: 'block',
                              textAlign: 'start',
                              color: 'text.secondary',
                              mt: 0.5,
                            }}
                          >
                            «{entry.exampleSentence}»
                          </Typography>
                        ) : null}
                      </Box>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        {entry.pronunciationPresent ? (
                          <>
                            <Tooltip title="پیشنمایش تلفظ">
                              <Box
                                component="audio"
                                src={pronunciationUrl(entry.id)}
                                controls
                                preload="none"
                                sx={{ width: 140, height: 36 }}
                                data-testid={`pron-audio-${entry.id}`}
                              />
                            </Tooltip>
                            <IconButton
                              size="small"
                              aria-label="حذف تلفظ"
                              onClick={() => void removePron(entry.id)}
                              data-testid={`pron-remove-${entry.id}`}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </>
                        ) : (
                          <Tooltip title="بارگذاری فایل تلفظ">
                            <IconButton
                              size="small"
                              component="label"
                              aria-label="بارگذاری تلفظ"
                              data-testid={`pron-upload-${entry.id}`}
                            >
                              <PlayCircleOutlineRoundedIcon fontSize="small" />
                              <input
                                ref={pronInputRef}
                                type="file"
                                accept="audio/mpeg,audio/mp4,.mp3,.m4a"
                                hidden
                                onChange={(e) =>
                                  void pickPronunciation(entry.id, e.target.files?.[0])
                                }
                              />
                            </IconButton>
                          </Tooltip>
                        )}
                        <IconButton
                          size="small"
                          aria-label="ویرایش واژه"
                          onClick={() => startEdit(entry.id, entry)}
                          data-testid={`vocab-edit-${entry.id}`}
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="حذف واژه"
                          color="error"
                          onClick={() => void remove(entry.id)}
                          data-testid={`vocab-delete-${entry.id}`}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

interface ParsedPreview {
  rows: Array<{ term: string; meaningFa: string; definitionEn: string }>;
  skipped: number;
  truncated: boolean;
}
