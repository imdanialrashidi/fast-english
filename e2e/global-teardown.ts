// e2e/global-teardown.ts
// Playwright global teardown: kills the disposable PB started
// by global-setup. We intentionally leave the data dir in place
// so the developer can inspect it on failure; the OS will clean
// /tmp on reboot.

import { existsSync, readFileSync } from 'node:fs';
import { kill } from 'node:process';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

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
  // Give PB a short grace period, then force-kill: a surviving
  // process would hold the fixed port and silently corrupt the next
  // run via the global-setup port check.
  for (let i = 0; i < 10; i++) {
    await sleep(300);
    try {
      // Signal 0 only probes existence; it throws when the process
      // is gone or not ours to signal.
      kill(pid, 0);
    } catch {
      return;
    }
  }
  try {
    kill(pid, 'SIGKILL');
  } catch {
    // already gone
  }
}
