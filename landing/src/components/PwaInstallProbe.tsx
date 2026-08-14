// landing/src/components/PwaInstallProbe.tsx
// Browser-native PWA install-intent detection for the landing.
//
// The landing itself is a plain static site (no web manifest — only the
// Student web app is installable), so `beforeinstallprompt` fires here
// only when a browser would consider the current page installable; the
// install page explains that the flow differs by browser and that the
// prompt may not appear at all. When it does fire, the `install_intent`
// telemetry event (shared with the Student App contract) is emitted.
// Renders nothing.
import { useEffect } from 'react';
import { trackInstallIntent } from '../lib/telemetry';

export function PwaInstallProbe() {
  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Prevent the browser-default prompt (we never show a custom one)
      // and record the intent for the operator's telemetry contract.
      event.preventDefault();
      trackInstallIntent();
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);
  return null;
}
