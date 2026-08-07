import { test, expect } from '@playwright/test';

test.describe('E2E Homepage Smoke Test', () => {
  test('loads homepage and displays title', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/MediClinic/i);
  });
});
