import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://127.0.0.1:8000';

async function seedInvitation(request: any, role: 'DOCTOR' | 'RECEPTIONIST' | 'CLINIC_ADMIN') {
  const res = await request.post(`${BACKEND_URL}/api/test-seed-invitation/`, {
    data: { role },
  });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.success).toBe(true);
  return data as { token: string; email: string; url_path: string; role: string };
}

test.describe('Invite Acceptance E2E Flows', () => {
  test('Doctor invite acceptance flow & token reuse prevention', async ({ page, request }) => {
    const seed = await seedInvitation(request, 'DOCTOR');

    // 1. Navigate to valid invite URL
    await page.goto(seed.url_path);
    await expect(page.getByText(seed.email)).toBeVisible();

    // 2. Fill the accept form
    await page.locator('input[placeholder*="Ravi"]').fill('DocFirst');
    await page.locator('input[placeholder*="Sharma"]').fill('DocLast');
    await page.locator('input[placeholder*="At least 8 characters"]').fill('Password123!');
    await page.locator('input[placeholder*="Repeat password"]').fill('Password123!');

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Confirm success state & navigation
    await expect(page.getByText('Profile Completed!')).toBeVisible({ timeout: 10000 });

    try {
      await page.waitForURL((url) => !url.pathname.includes('/invite/'), { timeout: 5000 });
    } catch {
      await page.getByText('Click here if not redirected').click();
      await page.waitForURL((url) => !url.pathname.includes('/invite/'), { timeout: 5000 });
    }

    // 3. Assert final URL returns a real page, not Next.js 404
    expect(page.url()).not.toContain('404');
    await expect(page.locator('body')).not.toContainText('This page could not be found');
    await expect(page.locator('body')).not.toContainText('404');

    // 4. Attempt to reuse the same invite URL a second time
    await page.goto(seed.url_path);
    await expect(page.locator('body')).toContainText(/accepted|already|invalid|expired|used/i);
  });

  test('Receptionist invite acceptance flow & token reuse prevention', async ({ page, request }) => {
    const seed = await seedInvitation(request, 'RECEPTIONIST');

    // 1. Navigate to valid invite URL
    await page.goto(seed.url_path);
    await expect(page.getByText(seed.email)).toBeVisible();

    // 2. Fill the accept form
    await page.locator('input[placeholder="Sarah"]').fill('ReceptFirst');
    await page.locator('input[placeholder="Connor"]').fill('ReceptLast');

    // Password fields
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('Password123!');
    await passwordInputs.nth(1).fill('Password123!');

    // Submit form
    await page.locator('button[type="submit"]').click();

    // 3. Confirm successful navigation to a real page (not 404)
    await page.waitForURL((url) => !url.pathname.includes('/receptionist/invite/'), { timeout: 15000 });
    expect(page.url()).not.toContain('404');
    await expect(page.locator('body')).not.toContainText('This page could not be found');
    await expect(page.locator('body')).not.toContainText('404');

    // 4. Attempt to reuse the same invite URL a second time
    await page.goto(seed.url_path);
    await expect(page.locator('body')).toContainText(/accepted|already|invalid|expired|used|no longer valid/i);
  });

  test('Clinic Admin invite acceptance flow & token reuse prevention', async ({ page, request }) => {
    const seed = await seedInvitation(request, 'CLINIC_ADMIN');

    // 1. Navigate to valid invite URL
    await page.goto(seed.url_path);
    await expect(page.getByText(seed.email)).toBeVisible();

    // 2. Fill the accept form
    await page.locator('input[placeholder="John"]').fill('AdminFirst');
    await page.locator('input[placeholder="Doe"]').fill('AdminLast');

    // Password fields
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('Password123!');
    await passwordInputs.nth(1).fill('Password123!');

    // Submit form
    await page.locator('button[type="submit"]').click();

    // 3. Confirm successful navigation to a real page (not 404)
    await page.waitForURL((url) => !url.pathname.includes('/admin/invite/'), { timeout: 15000 });
    expect(page.url()).not.toContain('404');
    await expect(page.locator('body')).not.toContainText('This page could not be found');
    await expect(page.locator('body')).not.toContainText('404');

    // 4. Attempt to reuse the same invite URL a second time
    await page.goto(seed.url_path);
    await expect(page.locator('body')).toContainText(/accepted|already|invalid|expired|used|no longer valid/i);
  });
});
