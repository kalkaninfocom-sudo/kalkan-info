import { test, expect } from '@playwright/test';

test('b2b-dashboard.html requires authentication', async ({ page }) => {
  await page.goto('/b2b-dashboard.html');

  // Wait for auth-gate.js to run (it polls for SUPABASE_CLIENT up to 3s, then redirects)
  await page.waitForTimeout(4000);

  const url = page.url();

  // Either redirected to /login.html OR the page rendered a forbidden banner.
  // Both outcomes mean the page enforced auth.
  const redirectedToLogin = url.includes('login.html');
  const forbiddenBanner = await page.locator('text=Yetkili Erişim Gerekli').count();

  expect(redirectedToLogin || forbiddenBanner > 0).toBe(true);
});

test('b2b-dashboard.html does not expose partner dashboard content without auth', async ({ page }) => {
  await page.goto('/b2b-dashboard.html');
  await page.waitForTimeout(4000);

  // The protected dashboard heading should NOT be visible without auth
  const dashboardHeading = await page.locator('h1:has-text("Dashboard"), h1:has-text("Partner Panel")').count();
  // This should be 0 because auth-gate redirects or shows forbidden before dashboard renders
  // We allow the page to have redirected (dashboard heading won't be in DOM at all)
  const url = page.url();
  if (url.includes('login.html')) {
    // Successfully redirected — content not exposed
    expect(url).toContain('login.html');
  } else {
    // Forbidden screen shown — dashboard content replaced
    expect(dashboardHeading).toBe(0);
  }
});
