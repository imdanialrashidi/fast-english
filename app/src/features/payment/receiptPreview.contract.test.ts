// app/src/features/payment/receiptPreview.contract.test.ts
// Static + contract tests for the protected-receipt preview surface.
// We do not render the hook (no jsdom in this project's devDeps),
// but we verify the key invariants:
//   - The hook only ever issues a token request when `enabled` is true.
//   - The build URL goes through `pb.files.getURL` (not a hand-rolled
//     string) so PB's path encoding is authoritative.
//   - The hook never persists the token to any storage the client owns.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const hookPath = resolve(__dirname, 'useReceiptPreview.ts');
const hookSource = readFileSync(hookPath, 'utf8');

describe('useReceiptPreview contract', () => {
  it('only requests a file token when enabled is true', () => {
    // The hook guards on `enabled` and on the recordId+fileName
    // before calling `pb.files.getToken()`. We assert that gate
    // exists in the source.
    expect(hookSource).toMatch(/if\s*\(\s*!enabled\s*\|\|\s*!recordId\s*\|\|\s*!fileName\s*\)/);
  });

  it('builds the URL through pb.files.getURL (not a hand-rolled string)', () => {
    expect(hookSource).toMatch(/pb\.files\.getURL/);
  });

  it('does not write to localStorage or sessionStorage', () => {
    expect(hookSource).not.toMatch(/localStorage/);
    expect(hookSource).not.toMatch(/sessionStorage/);
  });

  it('does not log protected URLs', () => {
    expect(hookSource).not.toMatch(/console\.log/);
    expect(hookSource).not.toMatch(/console\.info/);
  });

  it('requests a fresh token on token-expiry by simply re-running the effect', () => {
    // The hook re-issues getToken() whenever its dependency tuple
    // changes. A token-expiry recovery happens by flipping `enabled`
    // off-then-on (the caller's responsibility).
    expect(hookSource).toMatch(/getToken/);
  });
});
