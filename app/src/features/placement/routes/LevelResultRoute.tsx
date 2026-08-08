// app/src/features/placement/routes/LevelResultRoute.tsx
// P2-S2 — Level result and selection UI.

import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageContainer } from '../../../../../shared/ui/PageContainer';
import { PageHeader } from '../../../../../shared/ui/PageHeader';
import { StatePanel } from '../../../../../shared/ui/StatePanel';
import { useAuth } from '../../../lib/auth';
import * as api from '../api';
import {
  CEFR_LEVEL_LABELS,
  CEFR_LEVELS,
  LEVEL_ACCEPT_SUGGESTION,
  LEVEL_CHANGE,
  LEVEL_CHOOSE_ANOTHER,
  LEVEL_CONFIRM_DESC,
  LEVEL_CONFIRM_TITLE,
  LEVEL_LOADING,
  LEVEL_SAVE_SUCCESS,
  LEVEL_SAVING,
  LEVEL_SELECTED_LABEL,
  LEVEL_SELECTION_DESC,
  LEVEL_SELECTION_TITLE,
  LEVEL_SUGGESTED_LABEL,
} from '../constants';
import { mapPlacementError } from '../errors';
import type { LevelContextResponse } from '../types';

type Phase =
  | 'loading'
  | 'level_selection_required'
  | 'completed'
  | 'placement_required'
  | 'placement_in_progress'
  | 'saving'
  | 'error';

export function LevelResultRoute() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const submitLockRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('loading');
  const [context, setContext] = useState<LevelContextResponse | null>(null);
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [pendingLevel, setPendingLevel] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{
    title: string;
    description: string;
    retry?: boolean;
  } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    setPhase('loading');
    setErrorInfo(null);
    try {
      const resp = await api.getLevelContext();
      setContext(resp);
      setPhase(resp.kind as Phase);
      if (resp.kind === 'completed') {
        // If already completed, redirect to dashboard
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const mapped = mapPlacementError(err);
      setPhase('error');
      setErrorInfo({ title: 'خطا', description: mapped.message, retry: mapped.retry });
    }
  }, [navigate]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const handleAcceptSuggested = useCallback(async () => {
    if (context?.kind !== 'level_selection_required') return;
    if (!context.suggestedLevel) return;
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    setPhase('saving');
    setSuccessMsg(null);
    setErrorInfo(null);

    try {
      await api.selectLevel({ selectedLevel: context.suggestedLevel });
      setSuccessMsg(LEVEL_SAVE_SUCCESS);

      // Auth refresh to get updated user state
      try {
        await refresh();
      } catch {
        // Selection is persisted even if refresh fails
        setErrorInfo({
          title: 'هشدار',
          description: 'سطح شما ذخیره شد. برای مشاهدهٔ داشبورد، صفحه را بازنشانی کنید.',
          retry: true,
        });
      }

      // Navigate to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const mapped = mapPlacementError(err);
      setPhase('level_selection_required');
      setErrorInfo({ title: 'خطا', description: mapped.message, retry: mapped.retry });
      submitLockRef.current = false;
    }
  }, [context, refresh, navigate]);

  const handleChooseLevel = useCallback((level: string) => {
    setPendingLevel(level);
    setShowConfirm(true);
  }, []);

  const handleConfirmLevel = useCallback(async () => {
    if (!pendingLevel || submitLockRef.current) return;
    submitLockRef.current = true;
    setShowConfirm(false);
    setPhase('saving');
    setSuccessMsg(null);
    setErrorInfo(null);

    try {
      await api.selectLevel({ selectedLevel: pendingLevel });
      setSuccessMsg(LEVEL_SAVE_SUCCESS);

      // Auth refresh
      try {
        await refresh();
      } catch {
        setErrorInfo({
          title: 'هشدار',
          description: 'سطح شما ذخیره شد. برای مشاهدهٔ داشبورد، صفحه را بازنشانی کنید.',
          retry: true,
        });
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      const mapped = mapPlacementError(err);
      setPhase('level_selection_required');
      setErrorInfo({ title: 'خطا', description: mapped.message, retry: mapped.retry });
      submitLockRef.current = false;
    }
  }, [pendingLevel, refresh, navigate]);

  const handleCancelChoice = useCallback(() => {
    setShowConfirm(false);
    setPendingLevel(null);
  }, []);

  // Loading
  if (phase === 'loading') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel variant="loading" title={LEVEL_LOADING} />
      </PageContainer>
    );
  }

  // Error
  if (phase === 'error') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel
          variant="error"
          title={errorInfo?.title || 'خطا'}
          description={errorInfo?.description}
          action={
            errorInfo?.retry ? (
              <Button variant="outlined" onClick={loadContext}>
                تلاش مجدد
              </Button>
            ) : undefined
          }
        />
      </PageContainer>
    );
  }

  // Placement required — should not arrive here normally
  if (phase === 'placement_required') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel
          variant="unavailable"
          title="آزمون تعیین سطح"
          description="شما هنوز آزمون تعیین سطح را شروع نکرده‌اید."
          action={
            <Button variant="contained" onClick={() => navigate('/placement')}>
              شروع آزمون
            </Button>
          }
        />
      </PageContainer>
    );
  }

  // Placement in progress
  if (phase === 'placement_in_progress') {
    return (
      <PageContainer maxWidth="md">
        <StatePanel
          variant="unavailable"
          title="آزمون در حال انجام"
          description="شما هنوز آزمون تعیین سطح را کامل نکرده‌اید."
          action={
            <Button variant="contained" onClick={() => navigate('/placement')}>
              ادامهٔ آزمون
            </Button>
          }
        />
      </PageContainer>
    );
  }

  // --- Level result and selection ---
  const ctx = context as Extract<
    LevelContextResponse,
    { kind: 'level_selection_required' | 'completed' }
  >;

  if (phase === 'saving') {
    return (
      <PageContainer maxWidth="md">
        <PageHeader title={LEVEL_SELECTION_TITLE} />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
          <CircularProgress />
          <Typography>{LEVEL_SAVING}</Typography>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="sm">
      <PageHeader title={LEVEL_SELECTION_TITLE} />

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      {errorInfo && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {errorInfo.description}
        </Alert>
      )}

      <Typography variant="body1" sx={{ mb: 3 }}>
        {LEVEL_SELECTION_DESC}
      </Typography>

      {/* Score and suggested level display */}
      {'score' in ctx && ctx.score !== undefined && (
        <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Stack spacing={1}>
            <Typography variant="h6" sx={{ textAlign: 'center' }}>
              نمره: {ctx.score} از {ctx.maxScore || 20}
            </Typography>
            {ctx.suggestedLevel && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {LEVEL_SUGGESTED_LABEL}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {ctx.suggestedLevel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {CEFR_LEVEL_LABELS[ctx.suggestedLevel as keyof typeof CEFR_LEVEL_LABELS]}
                </Typography>
              </Box>
            )}
          </Stack>
        </Card>
      )}

      {/* Level selection area */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        {showLevelPicker ? LEVEL_CHOOSE_ANOTHER : LEVEL_ACCEPT_SUGGESTION}
      </Typography>

      {!showLevelPicker && ctx.suggestedLevel && (
        <Box sx={{ mb: 2 }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleAcceptSuggested}
            disabled={submitLockRef.current}
            startIcon={<CheckCircleRoundedIcon />}
            sx={{ mb: 1 }}
          >
            {LEVEL_ACCEPT_SUGGESTION}: {ctx.suggestedLevel}
          </Button>
          <Button variant="outlined" fullWidth onClick={() => setShowLevelPicker(true)}>
            {LEVEL_CHOOSE_ANOTHER}
          </Button>
        </Box>
      )}

      {showLevelPicker && (
        <Stack spacing={1} sx={{ mb: 3 }}>
          {CEFR_LEVELS.map((level) => {
            const isSuggested = level === ctx.suggestedLevel;
            const isSelected =
              level === ('selectedLevel' in ctx ? ctx.selectedLevel : null) ||
              level === pendingLevel;
            return (
              <Card
                key={level}
                variant={isSelected ? 'elevation' : 'outlined'}
                sx={{
                  borderColor: isSelected
                    ? 'success.main'
                    : isSuggested
                      ? 'primary.main'
                      : undefined,
                  borderWidth: isSelected || isSuggested ? 2 : 1,
                  bgcolor: isSelected ? 'action.selected' : undefined,
                }}
              >
                <CardActionArea
                  onClick={() => handleChooseLevel(level)}
                  disabled={submitLockRef.current}
                  sx={{ p: 2 }}
                >
                  <CardContent sx={{ p: '0 !important' }}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {level}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {CEFR_LEVEL_LABELS[level]}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        {isSelected && <CheckCircleRoundedIcon color="success" fontSize="small" />}
                        {isSelected ? (
                          <Typography
                            variant="caption"
                            color="success.main"
                            sx={{ fontWeight: 600 }}
                          >
                            {LEVEL_SELECTED_LABEL}
                          </Typography>
                        ) : null}
                        {isSuggested && !isSelected ? (
                          <Typography variant="caption" color="primary" sx={{ fontWeight: 500 }}>
                            {LEVEL_SUGGESTED_LABEL}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Selected level display (for completed state) */}
      {'selectedLevel' in ctx && ctx.selectedLevel && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            {LEVEL_SELECTED_LABEL}: <strong>{ctx.selectedLevel}</strong>
          </Typography>
          <Button size="small" onClick={() => setShowLevelPicker(true)} sx={{ mt: 1 }}>
            {LEVEL_CHANGE}
          </Button>
        </Alert>
      )}

      {/* Confirmation Dialog for choosing a different level */}
      <Dialog open={showConfirm} onClose={handleCancelChoice}>
        <DialogTitle>{LEVEL_CONFIRM_TITLE}</DialogTitle>
        <DialogContent>
          <Typography>{LEVEL_CONFIRM_DESC.replace('{level}', pendingLevel || '')}</Typography>
          {ctx.suggestedLevel && pendingLevel && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {LEVEL_SUGGESTED_LABEL}: {ctx.suggestedLevel} — {LEVEL_SELECTED_LABEL}: {pendingLevel}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelChoice}>انصراف</Button>
          <Button variant="contained" onClick={handleConfirmLevel} disabled={submitLockRef.current}>
            تأیید
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
