import { test, expect } from '@playwright/test';

test('diagnose survey page loading', async ({ page }) => {
  // Capture page console messages
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  // Capture page errors
  page.on('pageerror', err => {
    console.error(`[BROWSER ERROR] ${err.message}`);
  });

  console.log('Navigating to local survey page...');
  const response = await page.goto('http://localhost:9002/surveys/collect-your-fees-within-4-weeks-of-reopening?embed=true');
  
  console.log(`Response status: ${response?.status()}`);
  
  // Wait for 5 seconds to let scripts run
  await page.waitForTimeout(5000);
  
  // Take screenshot for visual inspection
  await page.screenshot({ path: 'test-results/survey-screenshot.png' });
  console.log('Screenshot saved to test-results/survey-screenshot.png');
});
