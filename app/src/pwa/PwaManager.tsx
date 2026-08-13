// app/src/pwa/PwaManager.tsx
// PWA lifecycle UI (P4-S2).
//
// - Explicit update prompt: the user is notified when a new version is
//   ready and can postpone; reload happens only after explicit
//   confirmation. There is never an automatic forced reload.
// - The offline-ready message is honest: only the cached App shell is
//   available offline; account data, payment, Placement, lessons, audio
//   and progress require the network.
// - While audio is playing, an incoming update prompt is deferred until
//   the player is idle so playback is never interrupted.

import { useRegisterSW } from 'virtual:pwa-register/react';
import { Alert, Button, Snackbar, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { FUNNEL_EVENTS, trackFunnel } from '../lib/telemetry';
import { isAudioBusy } from './activity';

export const OFFLINE_READY_MESSAGE =
  'پوستهٔ برنامه برای استفادهٔ آفلاین آماده است؛ برای حساب، پرداخت، تعیین سطح، درس‌ها، صوت و پیشرفت به اینترنت نیاز است.';
export const UPDATE_READY_MESSAGE = 'نسخهٔ جدیدی از برنامه آماده است.';
export const UPDATE_NOW_LABEL = 'هم‌اکنون به‌روزرسانی کن';
export const UPDATE_LATER_LABEL = 'بعداً';
export const CLOSE_LABEL = 'بستن';

export function PwaManager() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError() {
      // Registration is best-effort (private browsing, permission denied).
      // The app works without a Service Worker.
    },
  });

  // Install intent (the browser-native install surface): one low-noise
  // funnel event per installability prompt — no per-render telemetry.
  useEffect(() => {
    const onBeforeInstallPrompt = () => {
      trackFunnel(FUNNEL_EVENTS.installIntent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const [deferred, setDeferred] = useState(false);

  // Defer the update prompt while audio is playing.
  useEffect(() => {
    if (needRefresh && isAudioBusy()) {
      setDeferred(true);
      setNeedRefresh(false);
    }
  }, [needRefresh, setNeedRefresh]);

  useEffect(() => {
    if (deferred && !isAudioBusy()) {
      setDeferred(false);
      setNeedRefresh(true);
    }
  }, [deferred, setNeedRefresh]);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
    setDeferred(false);
  };

  return (
    <>
      <Snackbar
        open={offlineReady}
        autoHideDuration={8000}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          variant="filled"
          onClose={close}
          sx={{ maxWidth: 'min(92vw, 34rem)', alignItems: 'center' }}
        >
          <Typography variant="body2">{OFFLINE_READY_MESSAGE}</Typography>
        </Alert>
      </Snackbar>
      <Snackbar open={needRefresh} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert
          severity="info"
          variant="filled"
          action={
            <>
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  void updateServiceWorker(true);
                }}
              >
                {UPDATE_NOW_LABEL}
              </Button>
              <Button color="inherit" size="small" onClick={close}>
                {UPDATE_LATER_LABEL}
              </Button>
            </>
          }
          sx={{ maxWidth: 'min(92vw, 34rem)', alignItems: 'center' }}
        >
          <Typography variant="body2">{UPDATE_READY_MESSAGE}</Typography>
        </Alert>
      </Snackbar>
    </>
  );
}
