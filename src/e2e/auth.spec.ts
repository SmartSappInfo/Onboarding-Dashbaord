import { test, expect } from '@playwright/test';

/**
 * @fileOverview E2E tests for the SmartSapp Authentication journey.
 */

test.describe('Authentication Flow', () => {
  test('should load the login page correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Check for core branding
    await expect(page.getByText(/SmartSapp/i)).toBeVisible();
    
    // Check for login form elements
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('should navigate to the signup page', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Create an Account');
    
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByText(/Create Account/i)).toBeVisible();
    await expect(page.getByLabel(/Full Name/i)).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'invalid@user.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("Sign In")');
    
    // Expect error message
    await expect(page.getByText(/Login Failed/i)).toBeVisible();
  });
});
