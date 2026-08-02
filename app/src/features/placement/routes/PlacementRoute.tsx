// app/src/features/placement/routes/PlacementRoute.tsx
// Full Placement flow: intro, questions, review, submit, result.

import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardActionArea,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageContainer } from '../../../app/shell/PageContainer';
import { PageHeader } from '../../../app/shell/PageHeader';
import { StatePanel } from '../../../app/shell/StatePanel';
import { useAuth } from '../../../lib/auth';
import * as api from '../api';
import {
  PLACEMENT_INTRO_DESC,
  PLACEMENT_INTRO_NOTE,
  PLACEMENT_INTRO_TITLE,
  PLACEMENT_LOADING,
  PLACEMENT_RETRY,
  PLACEMENT_SAVE_FAILED,
  PLACEMENT_SAVED,
  PLACEMENT_SAVING,
  PLACEMENT_SUBMIT_CONFIRM_TEXT,
  PLACEMENT_SUBMIT_CONFIRM_TITLE,
  TOTAL_QUESTIONS,
} from '../constants';
import { mapPlacementError } from '../errors';
import type { PlacementAnswerMap, PlacementQuestion, PlacementResponse } from '../types';

type Phase =
  | 'loading'
  | 'intro'
  | 'question'
  | 'review'
  | 'submitting'
  | 'submitted'
  | 'unavailable'
  | 'error';

export function PlacementRoute() {
  useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorInfo, setErrorInfo] = useState<{
    title: string;
    description: string;
    retry?: boolean;
  } | null>(null);

  // Attempt state
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PlacementQuestion[]>([]);
  const [answers, setAnswers] = useState<PlacementAnswerMap>({});
  const [revision, setRevision] = useState(0);

  // Question navigation
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Submit confirmation dialog
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  // Warn before unload with unsaved changes
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsaved]);

  const loadAttempt = useCallback(async () => {
    setPhase('loading');
    setErrorInfo(null);
    try {
      const resp = await api.startOrResumeAttempt();
      applyResponse(resp);
    } catch (err) {
      const mapped = mapPlacementError(err);
      if (
        mapped.code === 'placement_unavailable' ||
        mapped.code === 'placement_subscription_required'
      ) {
        setPhase('unavailable');
        setErrorInfo({
          title: 'آزمون در دسترس نیست',
          description: mapped.message,
          retry: mapped.retry,
        });
      } else {
        setPhase('error');
        setErrorInfo({ title: 'خطا', description: mapped.message, retry: mapped.retry });
      }
    }
  }, []);

  const applyResponse = useCallback((resp: PlacementResponse) => {
    setAttemptId(resp.attempt.id);
    setRevision(resp.attempt.revision);
    setAnswers(resp.answers || {});
    setQuestions(resp.questions || []);
    setSaveStatus('idle');
    setHasUnsaved(false);

    if (resp.kind === 'submitted') {
      setPhase('submitted');
      return;
    }

    if (resp.questions.length > 0) {
      const currentIdx = findFirstUnanswered(resp.questions, resp.answers);
      setCurrentIndex(currentIdx);
      const firstQ = resp.questions[currentIdx];
      if (firstQ) {
        setSelectedOption(resp.answers[firstQ.id] || null);
      }
      setPhase('question');
    } else {
      setPhase('intro');
    }
  }, []);

  function findFirstUnanswered(qs: PlacementQuestion[], ans: PlacementAnswerMap): number {
    for (let i = 0; i < qs.length; i++) {
      if (!ans[qs[i].id]) return i;
    }
    return 0;
  }

  // Initial load
  useEffect(() => {
    void loadAttempt();
  }, [loadAttempt]);

  // When navigating to a new question, show saved answer
  useEffect(() => {
    if (!questions[currentIndex]) return;
    const q = questions[currentIndex];
    setSelectedOption(answers[q.id] || null);
    setSaveStatus('idle');
  }, [currentIndex, questions, answers]);

  function answeredCount(): number {
    let count = 0;
    for (const key in answers) {
      if (Object.hasOwn(answers, key)) count++;
    }
    return count;
  }

  async function handleSelect(optionId: string) {
    if (!attemptId || phase !== 'question') return;
    const q = questions[currentIndex];
    if (!q) return;

    setSelectedOption(optionId);
    setHasUnsaved(true);
    setSaveStatus('saving');
    setSubmitting(true);

    try {
      const resp = await api.saveAnswer(attemptId, {
        questionId: q.id,
        optionId,
        expectedRevision: revision,
      });
      setRevision(resp.attempt.revision);
      setAnswers(resp.answers || {});
      setSaveStatus('saved');
      setHasUnsaved(false);
    } catch (err) {
      const mapped = mapPlacementError(err);
      // If stale, reload
      if (mapped.code === 'placement_attempt_stale') {
        await loadAttempt();
        return;
      }
      setSaveStatus('failed');
      // Revert the visual selection on failure
      setSelectedOption(answers[q.id] || null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetrySave() {
    if (!selectedOption) return;
    await handleSelect(selectedOption);
  }

  function goToQuestion(index: number) {
    if (index < 0 || index >= questions.length) return;
    setCurrentIndex(index);
  }

  function handleReview() {
    setPhase('review');
  }

  function handleOpenSubmitConfirm() {
    setShowSubmitConfirm(true);
  }

  async function handleConfirmSubmit() {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setShowSubmitConfirm(false);
    setPhase('submitting');

    try {
      const resp = await api.submitAttempt(attemptId!, { expectedRevision: revision });
      applyResponse(resp);
    } catch (err) {
      const mapped = mapPlacementError(err);
      if (mapped.code === 'placement_attempt_stale') {
        await loadAttempt();
        return;
      }
      setPhase('error');
      setErrorInfo({ title: 'خطا در ثبت نهایی', description: mapped.message, retry: mapped.retry });
      submitLockRef.current = false;
    }
  }

  // --- Loading ---
  if (phase === 'loading') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel variant="loading" title={PLACEMENT_LOADING} />
      </PageContainer>
    );
  }

  // --- Unavailable ---
  if (phase === 'unavailable') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel
          variant="unavailable"
          title={errorInfo?.title || 'آزمون در دسترس نیست'}
          description={errorInfo?.description}
          action={
            errorInfo?.retry ? (
              <Button variant="outlined" onClick={loadAttempt}>
                تلاش مجدد
              </Button>
            ) : undefined
          }
        />
      </PageContainer>
    );
  }

  // --- Error ---
  if (phase === 'error') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel
          variant="error"
          title={errorInfo?.title || 'خطا'}
          description={errorInfo?.description}
          action={
            errorInfo?.retry ? (
              <Button variant="outlined" onClick={loadAttempt}>
                تلاش مجدد
              </Button>
            ) : undefined
          }
        />
      </PageContainer>
    );
  }

  // --- Intro ---
  if (phase === 'intro') {
    return (
      <PageContainer maxWidth="md">
        <PageHeader title={PLACEMENT_INTRO_TITLE} />
        <Stack spacing={3}>
          <Typography variant="body1">{PLACEMENT_INTRO_DESC}</Typography>
          <Typography variant="body2" color="text.secondary">
            {PLACEMENT_INTRO_NOTE}
          </Typography>
          <Box>
            <Button variant="contained" size="large" onClick={loadAttempt}>
              شروع آزمون
            </Button>
          </Box>
        </Stack>
      </PageContainer>
    );
  }

  // --- Submitted → redirect to level result ---
  if (phase === 'submitted') {
    // Navigate to level result page (replace so back button doesn't return here)
    navigate('/placement/result', { replace: true });
    return (
      <PageContainer maxWidth="md">
        <StatePanel variant="loading" title="در حال انتقال به مرحلهٔ انتخاب سطح…" />
      </PageContainer>
    );
  }

  // --- Question Flow ---
  const currentQuestion = questions[currentIndex];
  const answered = answeredCount();

  return (
    <PageContainer maxWidth="md">
      {/* Progress bar */}
      <Box sx={{ mb: 2 }}>
        <LinearProgress
          variant="determinate"
          value={phase === 'review' ? 100 : (answered / TOTAL_QUESTIONS) * 100}
          sx={{ height: 8, borderRadius: '999px' }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {phase === 'review'
            ? `مرور پاسخ‌ها (${answered} از ${TOTAL_QUESTIONS})`
            : `سؤال ${currentIndex + 1} از ${TOTAL_QUESTIONS}`}
        </Typography>
      </Box>

      {/* Save status */}
      {saveStatus === 'saving' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            {PLACEMENT_SAVING}
          </Typography>
        </Box>
      )}
      {saveStatus === 'saved' && (
        <Typography variant="caption" color="success.main" sx={{ mb: 1, display: 'block' }}>
          {PLACEMENT_SAVED}
        </Typography>
      )}
      {saveStatus === 'failed' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="caption" color="error.main">
            {PLACEMENT_SAVE_FAILED}
          </Typography>
          <Button size="small" variant="outlined" color="error" onClick={handleRetrySave}>
            {PLACEMENT_RETRY}
          </Button>
        </Box>
      )}

      {phase === 'review' ? (
        /* --- Review screen --- */
        <Stack spacing={2}>
          <Typography variant="h6">مرور پاسخ‌ها</Typography>
          {questions.map((q, idx) => {
            const isAnswered = !!answers[q.id];
            return (
              <Card key={q.id} variant="outlined" sx={{ opacity: isAnswered ? 1 : 0.6 }}>
                <CardActionArea
                  component="button"
                  type="button"
                  onClick={() => {
                    setCurrentIndex(idx);
                    setPhase('question');
                  }}
                  aria-label={`رفتن به سؤال ${q.position}`}
                  sx={{ display: 'block', width: '100%', p: 2, textAlign: 'start' }}
                >
                  <Typography variant="body2" color="text.secondary">
                    سؤال {q.position}
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.5 }}>
                    {isAnswered ? 'پاسخ داده شد' : 'پاسخ داده نشده'}
                  </Typography>
                </CardActionArea>
              </Card>
            );
          })}
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 2 }}>
            {answered < TOTAL_QUESTIONS ? (
              <Button
                variant="contained"
                onClick={() => {
                  const firstUnanswered = findFirstUnanswered(questions, answers);
                  setCurrentIndex(firstUnanswered);
                  setPhase('question');
                }}
              >
                بازگشت به سؤالات بی‌پاسخ
              </Button>
            ) : (
              <Button variant="contained" color="primary" onClick={handleOpenSubmitConfirm}>
                ثبت نهایی
              </Button>
            )}
          </Box>
        </Stack>
      ) : (
        /* --- Question view --- */
        currentQuestion && (
          <Stack spacing={2}>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {currentQuestion.prompt}
            </Typography>
            <Stack spacing={1}>
              {currentQuestion.options.map((opt) => (
                <Card
                  key={opt.id}
                  variant={selectedOption === opt.id ? 'elevation' : 'outlined'}
                  sx={{
                    p: 0,
                    cursor: submitting ? 'default' : 'pointer',
                    borderColor: selectedOption === opt.id ? 'primary.main' : undefined,
                    bgcolor: selectedOption === opt.id ? 'action.selected' : undefined,
                    opacity: submitting ? 0.7 : 1,
                    '&:hover': submitting ? {} : { borderColor: 'primary.light' },
                  }}
                  onClick={() => {
                    if (submitting) return;
                    void handleSelect(opt.id);
                  }}
                >
                  <FormControlLabel
                    value={opt.id}
                    control={
                      <Checkbox
                        checked={selectedOption === opt.id}
                        sx={{ '& .MuiSvgIcon-root': { fontSize: 28 } }}
                      />
                    }
                    label={opt.text}
                    sx={{
                      mx: 0,
                      px: 2,
                      py: 1.5,
                      width: '100%',
                      '& .MuiFormControlLabel-label': {
                        minHeight: 44,
                        display: 'flex',
                        alignItems: 'center',
                      },
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => {
                      if (submitting) return;
                      void handleSelect(opt.id);
                    }}
                  />
                </Card>
              ))}
            </Stack>

            {/* Navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button
                variant="outlined"
                disabled={currentIndex === 0}
                onClick={() => goToQuestion(currentIndex - 1)}
              >
                قبلی
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  if (currentIndex < questions.length - 1) {
                    goToQuestion(currentIndex + 1);
                  } else if (answered >= TOTAL_QUESTIONS) {
                    handleReview();
                  }
                }}
              >
                {currentIndex < questions.length - 1 ? 'بعدی' : 'مرور'}
              </Button>
            </Box>

            {/* Question navigator dots */}
            {questions.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.5,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  mt: 1,
                }}
              >
                {questions.map((q, idx) => (
                  <ButtonBase
                    key={q.id}
                    component="button"
                    type="button"
                    aria-label={`رفتن به سؤال ${q.position}`}
                    aria-current={currentIndex === idx ? 'step' : undefined}
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      bgcolor: answers[q.id] ? 'primary.main' : 'grey.300',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      color: answers[q.id] ? 'white' : 'text.secondary',
                      border: currentIndex === idx ? '2px solid' : 'none',
                      borderColor: 'primary.dark',
                    }}
                    onClick={() => setCurrentIndex(idx)}
                  >
                    {q.position}
                  </ButtonBase>
                ))}
              </Box>
            )}
          </Stack>
        )
      )}

      {/* Submit confirmation dialog */}
      <Dialog open={showSubmitConfirm} onClose={() => setShowSubmitConfirm(false)}>
        <DialogTitle>{PLACEMENT_SUBMIT_CONFIRM_TITLE}</DialogTitle>
        <DialogContent>
          <Typography>{PLACEMENT_SUBMIT_CONFIRM_TEXT}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSubmitConfirm(false)}>انصراف</Button>
          <Button variant="contained" onClick={handleConfirmSubmit} disabled={submitting}>
            تأیید و ثبت
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
