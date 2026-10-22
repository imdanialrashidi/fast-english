import { expect, test } from '@playwright/test';

// Owner follow-up 2026-10-22: the public sample publishes Media Session
// metadata and standard transport handlers. Chromium is the only lab
// browser here; real lock-screen behavior remains device-unproven.

interface MediaState {
  metadata: { init: Record<string, unknown> } | null;
  handlers: Array<[string, boolean]>;
  playbackState: string;
  positions: unknown[];
  setActionHandler(action: string, handler: unknown): void;
  setPositionState(position: unknown): void;
}

declare global {
  interface Window {
    __media: MediaState;
  }
}

test('sample publishes Media Session metadata and handlers', async ({ page }) => {
  await page.addInitScript(() => {
    const state: MediaState = {
      metadata: null,
      handlers: [],
      playbackState: 'none',
      positions: [],
      setActionHandler(action, handler) {
        state.handlers.push([action, handler !== null]);
      },
      setPositionState(position) {
        state.positions.push(position);
      },
    };
    window.__media = state;

    class FakeMetadata {
      init: Record<string, unknown>;

      constructor(init: Record<string, unknown>) {
        this.init = init;
        state.metadata = this;
      }
    }

    Object.defineProperty(window, 'MediaMetadata', { configurable: true, value: FakeMetadata });
    Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: state });
  });

  await page.goto('/sample?topic=city-park&level=A2');
  await expect(page.locator('#lesson-audio')).toBeAttached();

  await expect.poll(() => page.evaluate(() => window.__media.metadata?.init.title)).toBe('The City Park');

  const handlers = await page.evaluate(() => window.__media.handlers);
  for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto']) {
    expect(handlers).toContainEqual([action, true]);
  }

  await page.waitForFunction(() => Number.isFinite(document.querySelector<HTMLAudioElement>('#lesson-audio')?.duration ?? NaN));
  await page.locator('#player-play').click();
  await expect.poll(() => page.evaluate(() => window.__media.playbackState)).toBe('playing');
  await expect.poll(() => page.evaluate(() => window.__media.positions.length)).toBeGreaterThan(0);
});
