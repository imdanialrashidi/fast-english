/**
 * S2 PWA registration + update notice (scope §18.1).
 *
 * A new service worker NEVER reloads the page on its own: the waiting
 * worker stays idle until the user taps the «تازه‌سازی» button in the
 * brief notice, so playback and form submissions are never interrupted.
 * Plain script, no framework dependency.
 */
(function () {
  function showUpdateNotice(registration) {
    if (document.getElementById('pwa-update')) {
      return;
    }

    const bar = document.createElement('div');
    bar.id = 'pwa-update';
    bar.setAttribute('role', 'status');

    const message = document.createElement('span');
    message.textContent = 'نسخه تازه‌ای آماده است.';

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'pwa-refresh';
    button.textContent = 'تازه‌سازی';
    button.addEventListener('click', () => {
      if (registration.waiting) {
        registration.waiting.postMessage('FE_SKIP_WAITING');
      }
    });

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.id = 'pwa-dismiss';
    dismiss.setAttribute('aria-label', 'بستن اعلان به‌روزرسانی');
    dismiss.textContent = '×';
    dismiss.addEventListener('click', () => bar.remove());

    const actions = document.createElement('span');
    actions.className = 'fe-pwa-actions';
    actions.appendChild(button);
    actions.appendChild(dismiss);

    bar.appendChild(message);
    bar.appendChild(actions);
    document.body.appendChild(bar);
  }

  function trackRegistration(registration) {
    if (registration.waiting && navigator.serviceWorker.controller) {
      showUpdateNotice(registration);
    }

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) {
        return;
      }
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateNotice(registration);
        }
      });
    });
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(trackRegistration).catch(() => {
    // Registration failure (e.g. unsupported context) is non-fatal: the
    // site remains a normal web page.
  });

  // Reload ONLY for a user-approved update (a previous worker already
  // controlled this page). The first install's claim must never reload:
  // that would wipe a form the user is filling or stop playback.
  let hadController = Boolean(navigator.serviceWorker.controller);
  if (navigator.serviceWorker.addEventListener) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) {
        window.location.reload();
      }
      hadController = true;
    });
  }
})();
