import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://127.0.0.1:8000';

async function seedStaffUser(request: any, email: string, role = 'DOCTOR', password = 'TestPassword123!') {
  const res = await request.post(`${BACKEND_URL}/api/test-seed-staff/`, {
    data: { email, role, password },
  });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.success).toBe(true);
  return data;
}

async function generateTOTP(request: any, options: { secret?: string; email?: string }) {
  const res = await request.post(`${BACKEND_URL}/api/test-generate-totp/`, {
    data: options,
  });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.success).toBe(true);
  return data.code as string;
}

test.describe('Staff MFA Enrollment & Login E2E Flows', () => {
  test.setTimeout(60000);

  test('Staff MFA setup, unskippable navigation guard, backup codes gate, and MFA verify login flow', async ({ page, request }) => {
    const staffEmail = `staff_mfa_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
    const password = 'TestPassword123!';
    await seedStaffUser(request, staffEmail, 'DOCTOR', password);

    // 1. Log in as staff user with no MFA enrolled
    await page.goto('/login');
    await page.getByRole('button', { name: /log in with password instead/i }).click();
    await page.locator('input[type="email"]').fill(staffEmail);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /sign in with password/i }).click();

    // Confirm redirected to unskippable setup screen
    await page.waitForURL((url) => url.pathname === '/mfa/setup', { timeout: 15000 });
    await expect(page.getByText('Set Up Two-Factor Authentication')).toBeVisible();

    // 2. Confirm unskippable setup screen (navigating away does not bypass it)
    await page.goto('/dashboard');
    await page.waitForURL((url) => url.pathname.includes('/login') || url.pathname.includes('/mfa/setup'), { timeout: 10000 });
    expect(page.url()).not.toContain('/dashboard');

    // Re-authenticate to resume clean MFA setup session
    await page.goto('/login');
    await page.getByRole('button', { name: /log in with password instead/i }).click();
    await page.locator('input[type="email"]').fill(staffEmail);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /sign in with password/i }).click();
    await page.waitForURL((url) => url.pathname === '/mfa/setup', { timeout: 15000 });

    // 3. Complete setup with real TOTP code
    await expect(page.locator('.font-mono.tracking-wider')).toBeVisible({ timeout: 15000 });
    const secretText = (await page.locator('.font-mono.tracking-wider').innerText()).replace(/\s+/g, '').trim();
    expect(secretText).toBeTruthy();

    const totpCode = await generateTOTP(request, { secret: secretText });
    expect(totpCode).toHaveLength(6);

    await page.locator('input[placeholder="123456"]').fill(totpCode);
    await page.getByRole('button', { name: /confirm & enable mfa/i }).click();

    // 4. Confirm backup codes are displayed and acknowledgment gate blocks proceeding
    await expect(page.getByText('Save Your Backup Codes')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Shown Only This Once')).toBeVisible();

    // Confirm proceed button is initially disabled
    const completeBtn = page.getByRole('button', { name: /complete setup & proceed to dashboard/i });
    await expect(completeBtn).toBeDisabled();

    // Check the "I have saved these backup codes" checkbox
    await page.locator('input[type="checkbox"]').check();
    await expect(completeBtn).toBeEnabled();

    // Complete setup and proceed
    await completeBtn.click();
    await page.waitForURL((url) => url.pathname.includes('/dashboard'), { timeout: 15000 });
    expect(page.url()).toContain('/dashboard');

    // 5. Log out, log back in, confirm MFA verify step appears (not setup again)
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 5000 }).catch(async () => {
      await page.goto('/login');
    });

    await page.getByRole('button', { name: /log in with password instead/i }).click();
    await page.locator('input[type="email"]').fill(staffEmail);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /sign in with password/i }).click();

    // Confirm redirected to /mfa/verify (not /mfa/setup!)
    await page.waitForURL((url) => url.pathname === '/mfa/verify', { timeout: 15000 });
    await expect(page.getByText('Enter Authenticator Code')).toBeVisible();

    // Generate valid TOTP code for secret
    const verifyTotpCode = await generateTOTP(request, { secret: secretText });
    expect(verifyTotpCode).toHaveLength(6);

    // Complete MFA verify
    await page.locator('input[placeholder="123456"]').fill(verifyTotpCode);
    await page.locator('button[type="submit"]').click();

    // Confirm successful dashboard access
    await page.waitForURL((url) => url.pathname.includes('/dashboard'), { timeout: 15000 });
    expect(page.url()).toContain('/dashboard');
  });
});
