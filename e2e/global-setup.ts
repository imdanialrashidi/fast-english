// e2e/global-setup.ts
// Playwright global setup: starts a disposable PocketBase on a
// fixed port, waits for the health endpoint, and writes the
// data dir to test-results/pb-data-dir.txt so the test spec can
// use it for fixture creation and operator-only operations.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = Number(process.env.PB_E2E_PORT ?? 18101);
const APP_PORT = Number(process.env.APP_E2E_PORT ?? 18102);
const PB_URL = `http://127.0.0.1:${PORT}`;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;

export default async function globalSetup() {
  mkdirSync(resolve('test-results'), { recursive: true });
  // PB is gitignored. The smoke wrapper picks it up; if missing,
  // the user must run `pnpm setup:pocketbase` first.
  const dataDir = `/tmp/pb-e2e-${Date.now()}`;
  mkdirSync(dataDir, { recursive: true });

  // Create a disposable test superuser so PB does not open the browser installer.
  const suEmail = 'pbtest@fep-smoke.invalid';
  const suPassword = `pbtest-e2e-${Date.now()}`;
  spawnSync('server/pocketbase', ['superuser', 'upsert', suEmail, suPassword, '--dir', dataDir], {
    stdio: 'ignore',
  });
  // Export credentials for test specs to use without calling superuser upsert while PB runs.
  writeFileSync('test-results/pb-su-email.txt', suEmail);
  writeFileSync('test-results/pb-su-password.txt', suPassword);
  const env = {
    ...process.env,
    PB_TELEMETRY: '0',
    PB_FEEDBACK: '0',
    PB_ENCRYPTION: process.env.PB_ENCRYPTION ?? 'dev-encryption-key-not-for-prod',
    PB_SMOKE_PAY_PORT: String(PORT),
    PB_CORS_ORIGINS: `${APP_URL},http://localhost:5173,http://127.0.0.1:5173,http://localhost,https://localhost`,
  };
  const proc = spawn(
    'server/pocketbase',
    [
      'serve',
      '--http',
      `127.0.0.1:${PORT}`,
      '--dir',
      dataDir,
      '--migrationsDir',
      'server/pb_migrations',
      '--hooksDir',
      'server/pb_hooks',
      '--origins',
      env.PB_CORS_ORIGINS,
      '--encryptionEnv',
      env.PB_ENCRYPTION,
    ],
    { env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  // Save the child pid so teardown can kill it.
  writeFileSync('test-results/pb-data-dir.txt', dataDir);
  writeFileSync('test-results/pb-pid.txt', String(proc.pid));

  // Wait for /api/health.
  const start = Date.now();
  while (Date.now() - start < 30_000) {
    try {
      const r = await fetch(`${PB_URL}/api/health`);
      if (r.status === 200) {
        // PB is up. Make the URL visible to the test spec.
        writeFileSync('test-results/pb-url.txt', PB_URL);

        // Visual E2E suites intentionally open many fresh browser sessions.
        // Disable only the disposable instance's IP limiter so auth refresh
        // throttling cannot turn a later viewport into a false visual failure.
        // Backend rate-limit behavior remains covered by the smoke suites.
        const auth = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ identity: suEmail, password: suPassword }),
        });
        if (!auth.ok) throw new Error(`global-setup: superuser auth failed (${auth.status})`);
        const authBody = (await auth.json()) as { token?: string };
        if (!authBody.token) throw new Error('global-setup: superuser token missing');
        const settings = await fetch(`${PB_URL}/api/settings`, {
          method: 'PATCH',
          headers: {
            authorization: authBody.token,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ rateLimits: { enabled: false } }),
        });
        if (!settings.ok)
          throw new Error(`global-setup: rate-limit setup failed (${settings.status})`);
        return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error('global-setup: PocketBase did not become ready in 30s');
}
