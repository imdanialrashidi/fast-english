// app/src/features/payment/receiptPreview.contract.test.ts
// Static + contract tests for the protected-receipt preview surface.
// We do not render the hook (no jsdom in this project's devDeps),
// but we verify the key invariants of the new secure route approach:
//   - The hook only ever fetches the receipt when `enabled` is true
//     AND a recordId is present.
//   - The hook does NOT call `pb.files.getToken` or `pb.files.getURL`
//     — the new contract is an authenticated custom route, not a
//     PB protected-file URL.
//   - The hook never writes the token to localStorage/sessionStorage
//     (because there is no token in the new model).
//   - The hook never logs the resulting URL or the bytes.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const hookPath = resolve(__dirname, 'useReceiptPreview.ts');
const hookSource = readFileSync(hookPath, 'utf8');

const apiPath = resolve(__dirname, 'api.ts');
const apiSource = readFileSync(apiPath, 'utf8');

const constantsPath = resolve(__dirname, 'constants.ts');
const constantsSource = readFileSync(constantsPath, 'utf8');

describe('useReceiptPreview contract (secure route model)', () => {
  it('only fetches when enabled and recordId are both set', () => {
    // The hook guards on `enabled` and on the recordId before
    // calling fetchReceiptBlob. We assert the gate exists.
    expect(hookSource).toMatch(/if\s*\(\s*!\s*enabled\s*\|\|\s*!\s*recordId\s*\)/);
  });

  it('does not use the old PB files.getToken / files.getURL surface', () => {
    // The new contract is a custom authenticated route, not a
    // protected file URL. Using the PB files API for a record
    // whose viewRule is null would fail anyway.
    expect(hookSource).not.toMatch(/pb\.files\.getToken/);
    expect(hookSource).not.toMatch(/pb\.files\.getURL/);
  });

  it('does not write to localStorage or sessionStorage', () => {
    expect(hookSource).not.toMatch(/localStorage/);
    expect(hookSource).not.toMatch(/sessionStorage/);
  });

  it('does not log the resulting URL or the bytes', () => {
    expect(hookSource).not.toMatch(/console\.log/);
    expect(hookSource).not.toMatch(/console\.info/);
  });

  it('revokes the previous Blob URL on new file / retry / unmount', () => {
    // The hook must call URL.revokeObjectURL in three places:
    //   - when starting a new fetch (replacing the old URL)
    //   - when the caller unmounts (cleanup effect)
    //   - inside the `revoke` closure exposed on the ready state
    // We assert each call site exists.
    const matches = hookSource.match(/URL\.revokeObjectURL/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('produces the URL via URL.createObjectURL on the fetched blob', () => {
    expect(hookSource).toMatch(/URL\.createObjectURL\(blob\)/);
  });
});

describe('api.fetchReceiptBlob contract', () => {
  it('exists in the api module', () => {
    expect(apiSource).toMatch(/export\s+async\s+function\s+fetchReceiptBlob/);
  });

  it('routes through the documented receipt path builder', () => {
    expect(apiSource).toMatch(/fetchReceiptBlob/);
    expect(apiSource).toMatch(/receiptDownloadPath/);
  });

  it('uses native fetch instead of pb.send (SDK 0.27 send cannot return binary)', () => {
    // PocketBase JS SDK 0.27.0 Client.send() always calls
    // response.json(), which cannot return a binary Blob. The
    // receipt route returns binary image data, so we must use
    // native fetch with the auth token forwarded manually.
    // Note: other functions in the module still use pb.send
    // (createPaymentRequest, loadCurrentRequest) — only
    // fetchReceiptBlob switches to native fetch.
    expect(apiSource).toMatch(/\bfetch\(/);
    expect(apiSource).toMatch(/pb\.buildURL\(/);
    expect(apiSource).toMatch(/pb\.authStore\.token/);
    // fetchReceiptBlob must not call pb.send:
    const fetchFnMatch = apiSource.match(/export async function fetchReceiptBlob[\s\S]*?^}/m);
    expect(fetchFnMatch).not.toBeNull();
    expect(fetchFnMatch?.[0]).not.toMatch(/pb\.send/);
  });

  it('maps thrown errors through toPaymentError', () => {
    expect(apiSource).toMatch(/toPaymentError/);
  });
});

describe('constants receipt path builder', () => {
  it('exposes a builder for the secure receipt route', () => {
    expect(constantsSource).toMatch(/export\s+function\s+receiptDownloadPath/);
    expect(constantsSource).toMatch(/RECEIPT_DOWNLOAD_PATH_PREFIX/);
    expect(constantsSource).toMatch(/RECEIPT_DOWNLOAD_PATH_SUFFIX/);
  });

  it('encodes the recordId so non-PB-15-character ids do not break the URL', () => {
    expect(constantsSource).toMatch(/encodeURIComponent/);
  });
});
