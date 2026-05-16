import { test, expect } from '@playwright/test';

/**
 * @fileOverview E2E tests for dynamic survey routing and slug decoding.
 */

test.describe('Public Survey Routing', () => {
  test('should correctly decode URL encoded slugs and render survey', async ({ page }) => {
    // We navigate to a URL that includes an encoded space '%20'
    // If the server component fails to decode the URI, it will return a 404
    await page.goto('/surveys/parent%20audit');
    
    // We expect the page to load without a fatal React server crash.
    // Depending on the test database state, it will either load a survey title,
    // or return the "Survey Unavailable" component. It should NOT return a raw Next.js 404.
    
    const surveyTitle = page.locator('h1');
    const unavailableTitle = page.getByRole('heading', { name: /Unavailable|Not Found/i });
    const loader = page.locator('text=Preparing your experience');
    
    await expect(surveyTitle.or(unavailableTitle).or(loader)).toBeVisible({ timeout: 15000 });
    
    // Specifically verify it's not the generic Next.js 404 page
    const nextjs404 = page.getByRole('heading', { name: '404', exact: true });
    await expect(nextjs404).toBeHidden();
  });
});
