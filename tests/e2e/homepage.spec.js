import { test, expect } from '@playwright/test';

test('homepage loads with expected title', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/Kalkan Info/);
});

test('main navigation is visible', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('nav, header').first()).toBeVisible();
});
