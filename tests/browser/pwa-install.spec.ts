import { expect } from '@playwright/test';
import { test } from './helpers';

// The install affordance is event-driven: nothing renders by default, the
// Chromium `beforeinstallprompt` event reveals the card, and the learner's
// choice closes it. This simulates the browser event because headless
// Chromium never fires the real one.
test('install card appears for an installable browser and closes after the choice', async ({ sub: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/today');
  await page.waitForTimeout(300);

  // The event is captured at app boot, before the Account card mounts.
  await page.evaluate(() => {
    type InstallEvent = Event & {
      prompt?: () => Promise<void>;
      userChoice?: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    };
    const event = new Event('beforeinstallprompt') as InstallEvent;
    event.prompt = async () => {
      (window as Window & { __installPromptCalled?: number }).__installPromptCalled = 1;
    };
    event.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
    window.dispatchEvent(event);
  });

  await page.locator('.fe-bottomnav').getByRole('link', { name: 'حساب' }).click();
  await expect(page).toHaveURL(/\/app\/account/);
  const install = page.getByRole('button', { name: 'نصب اپ' });
  await expect(install).toBeVisible();
  await expect(page.getByText('Fast English را روی صفحه اصلی نصب کن')).toBeVisible();

  await install.click();
  await expect(install).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { __installPromptCalled?: number }).__installPromptCalled)).toBe(1);
});
