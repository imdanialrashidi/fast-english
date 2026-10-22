import { expect, test } from '@playwright/test';

// Panel backup & restore (OPS-01): staff one-click journey on Chromium.
// Login via the Filament panel, open Backups, create a complete archive
// with one click, and verify the completed row (status/date/size +
// download). Creation timeout is generous: the shared dev checkout holds
// GBs of lesson fixtures, so the verified zip path is exercised for real.

test.setTimeout(600_000);

test('backup admin: staff creates a one-click backup and sees it listed', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const staff = await ctx.newPage();
  try {
    await staff.goto('/admin/login');
    await staff.getByLabel('Email').fill('backup-staff@example.com');
    await staff.getByRole('textbox', { name: /Password/ }).fill('password');
    await staff.getByRole('button', { name: 'Sign in' }).click();
    await staff.waitForURL(/\/admin$/, { timeout: 30_000 });

    await staff.goto('/admin/backups');
    await expect(staff.getByRole('heading', { name: 'Backups' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(staff.getByText('No successful backup yet.')).toBeVisible();

    // One click: the POST blocks until the verified archive completes.
    // Match the completed row, not the status flash (both contain
    // "completed (" after the redirect).
    await staff.getByRole('button', { name: 'Create backup now' }).click();
    await expect(staff.getByText('— completed (manual) —')).toBeVisible({ timeout: 420_000 });

    // Row shows status/type/date/size/checksum + download + confirmed restore.
    await expect(staff.getByText('— completed (manual) —')).toBeVisible();
    await expect(staff.getByRole('link', { name: 'Download' }).first()).toBeVisible();
    await expect(staff.getByRole('button', { name: 'Restore this backup' }).first()).toBeVisible();
    await expect(staff.getByText(/Last successful backup: #\d+ at/)).toBeVisible();

    await staff.screenshot({ path: 'test-results/browser/backup-admin-desktop.png' });

    const mobile = await ctx.newPage();
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto('/admin/backups');
    await expect(mobile.getByRole('heading', { name: 'Backups' }).first()).toBeVisible({ timeout: 30_000 });
    await mobile.screenshot({ path: 'test-results/browser/backup-admin-mobile.png' });
    await mobile.close();
  } finally {
    await ctx.close();
  }
});
