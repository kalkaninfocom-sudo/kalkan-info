import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45000 });
});

test('homepage loads with title containing Kalkan', async ({ page }) => {
  await expect(page).toHaveTitle(/Kalkan/i);
});

test('hero h1 is visible on homepage', async ({ page }) => {
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible();
});

test('page has more than 4 anchor links (nav + footer)', async ({ page }) => {
  const anchors = page.locator('a[href]');
  await expect(anchors.first()).toBeVisible();
  const count = await anchors.count();
  expect(count).toBeGreaterThan(4);
});

test('concierge trigger anchor is present in static HTML', async ({ page }) => {
  // #concierge is a static <a> in the HTML — no JS needed
  const trigger = page.locator('#concierge');
  await expect(trigger).toBeAttached();
});

test('no error-text banners visible on homepage', async ({ page }) => {
  const errorCount = await page.locator('text=Error').count();
  expect(errorCount).toBe(0);
});
