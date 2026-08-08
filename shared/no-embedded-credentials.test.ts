// shared/no-embedded-credentials.test.ts
// Podcast Slice 1 — Staff bootstrap and diagnostics must never embed,
// print or default real credentials. Static scan: the scripts read every
// secret from the environment and contain no literal password/email
// values for the FEP_* variables.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const bootstrap = readFileSync(resolve(ROOT, 'scripts/staff-bootstrap.mjs'), 'utf8');
const diag = readFileSync(resolve(ROOT, 'scripts/staff-legacy-diag.mjs'), 'utf8');
const guards = readFileSync(resolve(ROOT, 'server/pb_hooks/guards.pb.js'), 'utf8');

describe('no embedded credentials', () => {
  it('bootstrap reads every credential from process.env only', () => {
    for (const name of [
      'FEP_PB_SUPERUSER_EMAIL',
      'FEP_PB_SUPERUSER_PASSWORD',
      'FEP_STAFF_EMAIL',
      'FEP_STAFF_PASSWORD',
      'FEP_STAFF_DISPLAY_NAME',
    ]) {
      expect(bootstrap).toContain(`process.env.${name}`);
      // No literal assignment of a value to the variable.
      expect(bootstrap).not.toMatch(new RegExp(`${name}\\s*=\\s*['"][^'"]+['"]`));
    }
  });

  it('bootstrap never prints passwords or tokens', () => {
    expect(bootstrap).not.toMatch(
      /console\.(log|error)\([^)]*(password|token|STAFF_PASSWORD|SUPERUSER_PASSWORD)/i,
    );
  });

  it('legacy diagnostic never selects or prints phone/email fields', () => {
    expect(diag).toContain('fields=id,role');
    expect(diag).not.toMatch(/phone/);
    expect(diag).not.toMatch(/console\.(log|error)\([^)]*email/i);
  });

  it('no hook file embeds a password literal', () => {
    expect(guards).not.toMatch(/password\s*[:=]\s*['"][^'"]+['"]/);
  });
});
