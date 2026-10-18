import { test } from '@playwright/test';

test('debug admin login state', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('backup-staff@example.com');
  await page.getByRole('textbox', { name: /Password/ }).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(8000);
  console.log('URL after click: ' + page.url());
  const body = await page.locator('body').innerText();
  console.log('BODY len=' + body.length);
  console.log(body.slice(0, 2000));
  await page.screenshot({ path: 'test-results/browser/debug-login.png' });
});
