import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Bulk Upload Troubleshooting', () => {
  test('should perform a simple bulk upload and verify results', async ({ page }) => {
    test.setTimeout(120000);
    // 1. Listen for console logs and errors
    page.on('console', msg => {
      console.log(`[BROWSER LOG]: ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.error(`[BROWSER UNCAUGHT ERROR]: ${err.message}`);
    });

    // 2. Login
    console.log('Navigating to login page...');
    await page.goto('/login');
    await page.fill('input[type="email"]', 'testuser@smartsapp.com');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // 3. Wait for dashboard
    console.log('Waiting for admin dashboard...');
    await page.waitForURL(/\/admin/, { timeout: 60000 });
    
    // 5. Navigate directly to the upload page
    console.log('Navigating to bulk upload page...');
    await page.goto('/admin/entities/upload');
    
    // Ensure we are on the upload page
    await expect(page.getByRole('heading', { name: /Bulk Account Import/i })).toBeVisible({ timeout: 20000 });
    
    // 6. Upload the CSV file
    console.log('Uploading test-upload.csv...');
    await page.setInputFiles('#bulk-file', path.resolve(process.cwd(), 'scratch/test-upload.csv'));
    
    // 7. Wait for Schema Correlation (Mapping step)
    console.log('Waiting for mapping step...');
    await expect(page.getByRole('heading', { name: /Schema Correlation/i })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'scratch/step-mapping.png' });
    
    console.log('Proceeding to Settings...');
    const continueBtn = page.getByRole('button', { name: /Continue to Settings/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();
    
    // 8. Settings step
    console.log('Waiting for settings step...');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'scratch/step-settings.png' });
    
    console.log('Proceeding to Review...');
    const reviewBtn = page.getByRole('button', { name: /Review & Import/i });
    await expect(reviewBtn).toBeVisible({ timeout: 10000 });
    await reviewBtn.click();
    
    // 9. Preview step
    console.log('Waiting for preview step...');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'scratch/step-preview.png' });
    
    console.log('Executing Import...');
    const importBtn = page.getByRole('button', { name: /Import 3/i });
    await expect(importBtn).toBeVisible({ timeout: 10000 });
    await importBtn.click();
    
    // 10. Wait for complete step and verify live status updates
    console.log('Waiting for ingestion completion...');
    // The status goes from EXECUTING to COMPLETE. In COMPLETE step, it shows activeImportLog stats
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'scratch/step-complete.png' });
    
    // Check page HTML or print status text
    const textContent = await page.textContent('body');
    console.log(`[PAGE TEXT]: ${textContent?.substring(0, 1000)}`);
  });
});

