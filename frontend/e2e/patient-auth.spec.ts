import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://127.0.0.1:8000';

async function seedPatient(request: any, email?: string) {
  const res = await request.post(`${BACKEND_URL}/api/test-seed-patient/`, {
    data: email ? { email } : {},
  });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.success).toBe(true);
  return data.email as string;
}

async function fetchGeneratedOTP(request: any, email: string) {
  const res = await request.get(`${BACKEND_URL}/api/test-get-otp/?email=${encodeURIComponent(email)}`);
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data.success).toBe(true);
  return data.code as string;
}

test.describe('Patient Auth E2E Flows', () => {
  test.setTimeout(60000);

  test('Request OTP, verify cooldown timer & wrong code error state', async ({ page, request }) => {
    const uniqueEmail = `patient_err_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
    await seedPatient(request, uniqueEmail);

    // 1. Navigate to login page
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // 2. Enter email and request OTP
    await page.locator('input[type="email"]').fill(uniqueEmail);
    await page.locator('button[type="submit"]').click();

    // 3. Confirm Step 2 (Verification code entry screen) & Cooldown Timer UI
    await expect(page.locator('input[placeholder="123456"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Resend code in \d+s/i)).toBeVisible();

    // 4. Test wrong code error state
    await page.locator('input[placeholder="123456"]').fill('000000');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('.bg-red-50')).toContainText(/incorrect|attempt/i);
  });

  test('Successful OTP request & verify flow', async ({ page, request }) => {
    const uniqueEmail = `patient_success_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
    await seedPatient(request, uniqueEmail);

    // 1. Navigate to login page
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // 2. Enter email and request OTP
    await page.locator('input[type="email"]').fill(uniqueEmail);
    await page.locator('button[type="submit"]').click();

    // 3. Confirm Step 2 (Verification code screen)
    await expect(page.locator('input[placeholder="123456"]')).toBeVisible({ timeout: 15000 });

    // 4. Retrieve generated OTP via test-get-otp endpoint
    const otpCode = await fetchGeneratedOTP(request, uniqueEmail);
    expect(otpCode).toHaveLength(6);

    // 5. Enter correct OTP code & verify
    await page.locator('input[placeholder="123456"]').fill(otpCode);
    await page.locator('button[type="submit"]').click();

    // 6. Confirm successful authentication and navigation
    await page.waitForURL((url) => url.pathname === '/' || url.pathname.includes('/dashboard'), { timeout: 15000 });
    expect(page.url()).not.toContain('/login');
  });
});
