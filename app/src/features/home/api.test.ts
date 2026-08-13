// app/src/features/home/api.test.ts
// Home's narrow dashboard-subscription wrapper: preserves the placement
// schema's degradation semantics (malformed payload → null subscription →
// hidden line) without pulling zod into the initial bundle.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface PbMockShape {
  send: ReturnType<typeof vi.fn>;
}

const pbMock: PbMockShape = { send: vi.fn() };

vi.mock('../../lib/pocketbase', () => ({
  getPocketBase: () => pbMock,
}));

import { getHomeSubscription } from './api';

beforeEach(() => {
  pbMock.send.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getHomeSubscription', () => {
  it('returns the subscription when the payload is well-formed', async () => {
    pbMock.send.mockResolvedValue({
      student: { name: 'x' },
      subscription: {
        planName: 'ماهانه',
        startsAt: '2026-01-01',
        expiresAt: '2026-01-31',
        remainingDays: 12,
      },
    });
    await expect(getHomeSubscription()).resolves.toEqual({
      planName: 'ماهانه',
      startsAt: '2026-01-01',
      expiresAt: '2026-01-31',
      remainingDays: 12,
    });
  });

  it('returns null for a missing or malformed subscription (schema-rejection semantics)', async () => {
    pbMock.send.mockResolvedValue({ student: { name: 'x' } });
    await expect(getHomeSubscription()).resolves.toBeNull();

    pbMock.send.mockResolvedValue({ subscription: null });
    await expect(getHomeSubscription()).resolves.toBeNull();

    pbMock.send.mockResolvedValue({
      subscription: { planName: 'ماهانه', remainingDays: 12 }, // missing dates
    });
    await expect(getHomeSubscription()).resolves.toBeNull();

    pbMock.send.mockResolvedValue({
      subscription: { planName: 'ماهانه', startsAt: '', expiresAt: '', remainingDays: -1 },
    });
    await expect(getHomeSubscription()).resolves.toBeNull();

    pbMock.send.mockResolvedValue({
      subscription: { planName: 'ماهانه', startsAt: '', expiresAt: '', remainingDays: 1.5 },
    });
    await expect(getHomeSubscription()).resolves.toBeNull();
  });

  it('propagates transport failures (the caller degrades the surface)', async () => {
    pbMock.send.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getHomeSubscription()).rejects.toBeInstanceOf(TypeError);
  });
});
