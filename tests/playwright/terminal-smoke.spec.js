const { test, expect } = require('@playwright/test');

test('page loads and shows welcome content (smoke)', async ({ page }) => {
  // Playwright config sets baseURL to http://localhost:3000?force_simulated=true
  await page.goto('/');
  // Check the welcome heading is visible
  await expect(page.locator('text=Welcome to Bash Mastery')).toBeVisible();
  // Also verify the token endpoint is reachable from the page context
  const token = await page.evaluate(async () => {
    try {
      const r = await fetch('/token');
      if (!r.ok) return null;
      const j = await r.json();
      return j.token || null;
    } catch (e) {
      return null;
    }
  });
  expect(token).not.toBeNull();
});
