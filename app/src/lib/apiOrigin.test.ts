// app/src/lib/apiOrigin.test.ts
import { describe, expect, it } from 'vitest';

describe('apiOrigin module', () => {
  it('can be imported without throwing at module load time', async () => {
    const mod = await import('./apiOrigin');
    expect(typeof mod.resolveApiOrigin).toBe('function');
  });
});
