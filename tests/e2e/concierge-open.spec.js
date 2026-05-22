import { test, expect } from '@playwright/test';

// concierge-modal.js is loaded as a deferred script.
// We navigate once per test with domcontentloaded and then
// explicitly wait for the script tag to appear before interacting.

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  // Wait for deferred concierge-modal script to be present in DOM
  await page.waitForSelector('script[src*="concierge-modal"]', { timeout: 10000 });
  // Small buffer for the IIFE to register click listeners
  await page.waitForTimeout(500);
});

test('clicking concierge trigger opens the modal backdrop', async ({ page }) => {
  // #concierge is a static <a> element in the HTML
  const trigger = page.locator('#concierge');
  await expect(trigger).toBeAttached();
  await trigger.click();

  // concierge-modal.js mounts a backdrop with id="kalkan-concierge-modal"
  const modal = page.locator('#kalkan-concierge-modal');
  await expect(modal).toBeVisible({ timeout: 8000 });
});

test('concierge modal contains at least one interactive element', async ({ page }) => {
  const trigger = page.locator('#concierge');
  await trigger.click();

  const modal = page.locator('#kalkan-concierge-modal');
  await expect(modal).toBeVisible({ timeout: 8000 });

  // Modal must contain at least one button or anchor
  const buttons = modal.locator('button, a');
  await expect(buttons.first()).toBeVisible({ timeout: 5000 });
});

test('pressing Escape closes the concierge modal', async ({ page }) => {
  const trigger = page.locator('#concierge');
  await trigger.click();

  const modal = page.locator('#kalkan-concierge-modal');
  await expect(modal).toBeVisible({ timeout: 8000 });

  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible({ timeout: 5000 });
});
