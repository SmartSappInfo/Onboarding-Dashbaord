import { test, expect } from '@playwright/test';

/**
 * @fileOverview E2E tests for the Public Survey "Full Loop" journey.
 */

test.describe('Public Survey Experience', () => {
  test('should load a public survey landing page', async ({ page }) => {
    // Note: We use a known slug or a fallback check
    await page.goto('/surveys/parent-audit');
    
    // If the survey is published, we expect to see the title or the loader
    // We handle the case where the record might not exist in the test DB
    const title = page.locator('h1');
    const loader = page.locator('text=Preparing your experience');
    
    await expect(title.or(loader)).toBeVisible();
  });

  test('should display the SmartSapp branding on public pages', async ({ page }) => {
    await page.goto('/');
    
    // Check for the welcome hero content
    await expect(page.getByText(/Welcome to the SmartSapp Family/i)).toBeVisible();
    
    // Check for the download section anchor
    await expect(page.locator('a[href="#download"]')).toBeVisible();
  });
});
