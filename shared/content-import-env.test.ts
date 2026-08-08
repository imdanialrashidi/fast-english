// shared/content-import-env.test.ts
// Podcast Slice 3 — the content-import CLI must never embed, print or
// default real credentials. Static scan: every secret is read from the
// documented environment variables (FEP_PB_URL, FEP_STAFF_EMAIL,
// FEP_STAFF_PASSWORD) and nothing is echoed to the console. The import
// routes never persist or return tokens, passwords or storage paths.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const contentAuth = readFileSync(resolve(ROOT, 'scripts/content/auth.mjs'), 'utf8');
const contentCli = readFileSync(resolve(ROOT, 'scripts/content/cli.mjs'), 'utf8');
const contentRoutes = readFileSync(
  resolve(ROOT, 'server/pb_hooks/content_import_routes.pb.js'),
  'utf8',
);
const contentCore = readFileSync(
  resolve(ROOT, 'server/pb_hooks/content_import_core.pb.js'),
  'utf8',
);

describe('content-import environment and secret hygiene', () => {
  it('reads the documented environment variables only', () => {
    for (const name of ['FEP_PB_URL', 'FEP_STAFF_EMAIL', 'FEP_STAFF_PASSWORD']) {
      expect(contentAuth).toContain(`process.env.${name}`);
    }
    // No literal assignment of a value to the variable.
    expect(contentAuth).not.toMatch(/FEP_STAFF_PASSWORD\s*=\s*['"][^'"]+['"]/);
    // The CLI never accepts superuser credentials.
    expect(contentAuth).not.toMatch(/SUPERUSER_PASSWORD/);
  });

  it('never prints passwords or tokens', () => {
    expect(contentAuth).not.toMatch(/console\.(log|error)\([^)]*(password|token|STAFF_PASSWORD)/i);
    expect(contentCli).not.toMatch(/console\.(log|error)\([^)]*(password|token|STAFF_PASSWORD)/i);
    // The only password/token references in the hooks are the deliberate
    // redaction patterns of sanitizeDiagnostics — never a field read,
    // never a persisted value.
    expect(contentRoutes).not.toMatch(/password/i);
    expect(contentRoutes).not.toMatch(/token\s*[:=]/);
    expect(contentCore).toMatch(/SECRET_PATTERNS/);
    const withoutRedaction = contentCore.replace(/SECRET_PATTERNS[\s\S]*?\];/, '');
    expect(withoutRedaction).not.toMatch(/password|token/i);
  });

  it('import routes never persist or return storage paths', () => {
    expect(contentRoutes).not.toMatch(/storage\//);
    expect(contentRoutes).not.toMatch(/pb_data/);
  });
});
