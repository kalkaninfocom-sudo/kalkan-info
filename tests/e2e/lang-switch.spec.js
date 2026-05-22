import { test, expect } from '@playwright/test';

test('?lang=en is accepted — URL preserved and title renders', async ({ page }) => {
  await page.goto('/?lang=en', { waitUntil: 'domcontentloaded', timeout: 45000 });
  expect(page.url()).toContain('lang=en');
  await expect(page).toHaveTitle(/Kalkan/i);
});

test('?lang=de — h1 heading renders correctly', async ({ page }) => {
  await page.goto('/?lang=de', { waitUntil: 'domcontentloaded', timeout: 45000 });
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible();
});

test('?lang=ru — page does not crash', async ({ page }) => {
  await page.goto('/?lang=ru', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await expect(page).toHaveTitle(/Kalkan/i);
});
