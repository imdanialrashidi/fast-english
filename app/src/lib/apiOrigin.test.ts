// app/src/lib/apiOrigin.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('apiOrigin module', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('can be imported without throwing at module load time', async () => {
    const mod = await import('./apiOrigin');
    expect(typeof mod.resolveApiOrigin).toBe('function');
  });

  it('native + production build resolves the hard-coded production origin', async () => {
    // P4-S2 regression: Vite injects import.meta.env.PROD as a boolean; a
    // native Release build must still resolve the production API origin
    // instead of demanding a debug VITE_ANDROID_API_ORIGIN.
    vi.stubEnv('PROD', true);
    vi.stubGlobal('window', { __FEP_NATIVE__: true });
    const mod = await import('./apiOrigin');
    expect(mod.resolveApiOrigin()).toEqual({
      origin: 'https://app.fastenglishpodcast.com',
      isNative: true,
      isProduction: true,
    });
  });
});
