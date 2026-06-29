import { test, expect } from '@playwright/test';

test.describe('Iframe Sizing Protocol Handshake', () => {
  test('should resize iframe dynamically on receiving postMessage', async ({ page }) => {
    // 1. Navigate to landing page
    await page.goto('/collecting-fees-without-delays-and-parental-confrontations', { waitUntil: 'domcontentloaded' });
    
    // Wait for hydration to complete and page to become fully interactive
    await page.waitForTimeout(2000);

    // 2. Click the consultation CTA button
    const ctaButton = page.getByRole('button', { name: /Book Free Consultation/i }).filter({ visible: true }).first();
    await expect(ctaButton).toBeVisible();
    await ctaButton.click();

    // 3. Verify that the Dialog opens and ResizableIFrame is mounted
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const iframe = dialog.locator('iframe');
    await expect(iframe).toBeVisible();

    // Wait for the iframe container mounting and event binding to stabilize
    await page.waitForTimeout(1000);

    // 5. Send mock postMessage resize payload from client script context to trigger resize event
    await page.evaluate(() => {
      window.postMessage({
        type: 'iframe_resize',
        slug: 'collect-your-fees-within-4-weeks-of-reopening',
        height: 850
      }, '*');
    });

    // 6. Assert that style height updates dynamically with a smooth animation transition
    await expect(async () => {
      const style = await iframe.getAttribute('style') || '';
      expect(style).toContain('height: 850px');
    }).toPass({ timeout: 5000 });
  });
});
