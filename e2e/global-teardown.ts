// e2e/global-teardown.ts
// Playwright global teardown: kills the disposable PB started
// by global-setup. We intentionally leave the data dir in place
// so the developer can inspect it on failure; the OS will clean
// /tmp on reboot.

import { existsSync, readFileSync } from 'node:fs';
import { kill } from 'node:process';

export default async function globalTeardown() {
  const pidFile = 'test-results/pb-pid.txt';
  if (!existsSync(pidFile)) return;
  const pid = Number(readFileSync(pidFile, 'utf8').trim());
  if (!pid) return;
  try {
    kill(pid, 'SIGTERM');
  } catch {
    // already dead
  }
}
