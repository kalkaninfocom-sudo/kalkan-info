import { test, expect } from '@playwright/test';

test('Patara page renders the audio guide widget container', async ({ page }) => {
  await page.goto('/antik-kentler/patara.html');
  await page.waitForLoadState('domcontentloaded');

  // audio-guide.js mounts into <div data-audio-guide data-slug="patara">
  const widget = page.locator('[data-audio-guide]');
  await expect(widget).toBeAttached();
});

test('Patara page loads without JS errors crashing the layout', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/antik-kentler/patara.html');
  await page.waitForLoadState('networkidle');

  // Filter out known non-critical external resource errors
  const criticalErrors = errors.filter(
    (e) => !e.includes('net::ERR_') && !e.includes('Failed to fetch'),
  );
  expect(criticalErrors.length).toBe(0);
});

test('Patara page h1 heading is visible', async ({ page }) => {
  await page.goto('/antik-kentler/patara.html');
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible();
  await expect(h1).toContainText('Patara');
});

test('audio guide widget is populated by audio-guide.js after load', async ({ page }) => {
  await page.goto('/antik-kentler/patara.html');
  // Give audio-guide.js time to mount content into the widget div
  await page.waitForTimeout(2000);

  const widget = page.locator('[data-audio-guide]');
  // After JS runs, the widget should contain at least one child element (play button or audio el)
  const childCount = await widget.evaluate((el) => el.children.length);
  expect(childCount).toBeGreaterThan(0);
});
