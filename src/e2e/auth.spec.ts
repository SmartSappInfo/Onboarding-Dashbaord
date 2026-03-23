import { test, expect } from '@playwright/test';

/**
 * @fileOverview E2E tests for the SmartSapp Authentication journey.
 */

test.describe('Authentication Flow', () => {
  test('should load the login page correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Check for core branding - use more specific selector
    await expect(page.getByRole('heading', { name: /SmartSapp Onboarding/i })).toBeVisible();
    
    // Check for login form elements
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  });

  test('should navigate to the signup page', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Create an Account');
    
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();
    await expect(page.getByLabel(/Full Name/i)).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'invalid@user.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    
    // Wait for any error message or toast notification
    // This is more flexible as different apps may show errors differently
    const errorMessage = page.locator('[role="alert"], .error, .toast, [data-testid="error"]');
    await expect(errorMessage.or(page.getByText(/error|failed|invalid/i))).toBeVisible({ timeout: 10000 });
  });
});
