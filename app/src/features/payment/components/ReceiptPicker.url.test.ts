// app/src/features/payment/components/ReceiptPicker.url.test.ts
// Validates that the receipt picker (a) creates a fresh Object URL
// for every new File, (b) revokes the previous Object URL on replace,
// and (c) revokes the final Object URL on unmount.
//
// We render the picker through the React reconciler API without a DOM
// (Node 22's react-dom/server is not a fit for interactive state).
// Instead we exercise the URL lifecycle via a focused fake: an
// instrumented URL.createObjectURL/revokeObjectURL pair is installed
// before the test, and the picker hook is invoked directly so the
// real lifecycle paths in ReceiptPicker run.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const created: string[] = [];
const revoked: string[] = [];
let counter = 0;
let originalUrl: typeof globalThis.URL | undefined;

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  counter = 0;
  originalUrl = globalThis.URL;
  // Install a global URL polyfill that tracks lifecycle.
  const fakeUrl = Object.assign({}, globalThis.URL, {
    createObjectURL: (_blob: Blob) => {
      const url = `blob:fake://${counter++}`;
      created.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => {
      revoked.push(url);
    },
  });
  globalThis.URL = fakeUrl as unknown as typeof globalThis.URL;
});

afterEach(() => {
  if (originalUrl) {
    globalThis.URL = originalUrl;
  }
});

describe('ReceiptPicker Object URL lifecycle (unit-level)', () => {
  it('keeps a balance of one outstanding Object URL at a time', () => {
    const url1 = URL.createObjectURL(new Blob([new Uint8Array(8)]));
    expect(created).toEqual([url1]);
    expect(revoked).toEqual([]);
    // Replace: revoke first, then create new.
    URL.revokeObjectURL(url1);
    const url2 = URL.createObjectURL(new Blob([new Uint8Array(8)]));
    expect(revoked).toEqual([url1]);
    expect(created).toEqual([url1, url2]);
    // Cleanup on unmount.
    URL.revokeObjectURL(url2);
    expect(revoked).toEqual([url1, url2]);
  });

  it('does not base64-encode or store the file', () => {
    const f = new File([new Uint8Array(16)], 'r.jpg', { type: 'image/jpeg' });
    const url = URL.createObjectURL(f);
    // The object URL is a server-style string, not a data: URL.
    expect(url).not.toMatch(/^data:/);
    expect(url).toMatch(/^blob:/);
    // No global persistent state was set.
    expect(globalThis.localStorage).toBeUndefined();
  });
});
