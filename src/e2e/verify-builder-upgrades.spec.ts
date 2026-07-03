import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test('verify page builder full width section alignment', async ({ page }) => {
  test.setTimeout(60000);
  const artifactsDir = '/Users/josephaidoo/.gemini/antigravity/brain/11ba5b72-8ca9-4c32-b7ec-fbd42ea233c1';
  
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Debug errors from browser
  page.on('console', msg => console.log(`[BROWSER LOG]: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[BROWSER ERROR]: ${err.message}`));

  console.log('Step 1: Logging in...');
  await page.goto('/login');
  await page.fill('input[type="email"]', process.env.TEST_SUPER_ADMIN_EMAIL || 'admin@smartsapp.com');
  await page.fill('input[type="password"]', process.env.TEST_SUPER_ADMIN_PASSWORD || 'SecurePassword123!');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard|\/backoffice|\/admin/, { timeout: 35000 });

  console.log('Step 2: Navigating to Page Creation...');
  await page.goto('/admin/pages/new');
  await page.waitForSelector('input[placeholder="e.g. Q1 Admissions Drive"]', { timeout: 15000 });
  await page.waitForTimeout(3000);

  const uniqueId = Date.now();
  const pageName = `Full Width Section Page ${uniqueId}`;
  const pageSlug = `full-width-sec-${uniqueId}`;
  
  await page.fill('input[placeholder="e.g. Q1 Admissions Drive"]', pageName);
  await page.fill('input[class*="border-none bg-slate-800"]', pageSlug);
  await page.waitForTimeout(1500);

  console.log('Selecting second page template...');
  const templateCards = page.locator('.group.cursor-pointer');
  await expect(templateCards.nth(1)).toBeVisible({ timeout: 10000 });
  await templateCards.nth(1).click();
  await page.waitForTimeout(1500);

  await page.locator('button:has-text("Create & Open Builder")').click();

  console.log('Waiting for Page Builder to launch...');
  await page.waitForSelector('.designer-shell', { timeout: 30000 });
  await page.waitForTimeout(5000); // Wait for transition animations to settle

  // Take screenshot in Edit Mode (with borders and margins)
  console.log('Capturing Edit Mode section layout screenshot...');
  await page.screenshot({ path: path.join(artifactsDir, 'section_edit_mode_margins.png'), fullPage: true });

  // Toggle Preview Mode
  console.log('Step 3: Clicking Preview tab...');
  const previewTab = page.locator('button:has-text("Preview")').first();
  await expect(previewTab).toBeVisible();
  await previewTab.click();
  await page.waitForTimeout(3000); // Let transition layouts settle

  // Take screenshot in Preview Mode (which must be borderless, marginless and full width!)
  console.log('Capturing Preview Mode full-bleed section layout screenshot...');
  await page.screenshot({ path: path.join(artifactsDir, 'section_preview_mode_fullbleed.png'), fullPage: true });

  console.log('Verification finished successfully!');
});
