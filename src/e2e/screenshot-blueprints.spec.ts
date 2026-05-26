import { test, expect } from '@playwright/test';
import path from 'path';

test('take screenshot of blueprints page', async ({ page }) => {
  // Step 1: Login
  await page.goto('/login');
  await page.fill('input[type="email"]', process.env.TEST_SUPER_ADMIN_EMAIL || 'superadmin@test.smartsapp.com');
  await page.fill('input[type="password"]', process.env.TEST_SUPER_ADMIN_PASSWORD || 'testpassword123');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  
  // Wait for login redirect
  await expect(page).toHaveURL(/\/dashboard|\/backoffice/, { timeout: 15000 });
  console.log('Login successful! Redirected to:', page.url());
  
  // Step 2: Navigate to blueprints page
  await page.goto('/backoffice/messaging/blueprints');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // Give Firestore subscriptions time to resolve
  
  // Take screenshot
  const screenshotPath = path.resolve(process.cwd(), 'blueprints_page_screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot saved to:', screenshotPath);
  
  // Assert button visibility
  const syncButton = page.getByRole('button', { name: 'Sync Blueprints', exact: true });
  const isVisible = await syncButton.isVisible();
  console.log('Sync Blueprints button visible:', isVisible);
  
  // Let's print the page text or HTML structure around the header to see what is going on
  const headerHtml = await page.evaluate(() => {
    const el = document.querySelector('.bg-card');
    return el ? el.outerHTML : 'Header bg-card not found';
  });
  console.log('Header HTML:', headerHtml);

  // If the button is not found, print the entire page body text
  if (!isVisible) {
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Page Body Text:\n', bodyText);
  }
});
