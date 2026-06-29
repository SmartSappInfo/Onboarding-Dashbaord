import { test, expect } from '@playwright/test';

test.describe('Collecting Fees Page Survey Modal', () => {
  test('should open survey modal on CTA click and load iframe', async ({ page }) => {
    // 1. Navigate to the landing page
    await page.goto('/collecting-fees-without-delays-and-parental-confrontations', { waitUntil: 'domcontentloaded' });

    // 2. Click the "Book Free Consultation" button in the header
    const ctaButton = page.getByRole('button', { name: /Book Free Consultation/i }).filter({ visible: true }).first();
    await expect(ctaButton).toBeVisible();
    await ctaButton.click();

    // 3. Verify Dialog/Modal container is visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 4. Verify IFrame is loaded within the dialog and points to correct survey
    const iframe = dialog.locator('iframe');
    await expect(iframe).toBeVisible();

    const src = await iframe.getAttribute('src');
    expect(src).toContain('/surveys/collect-your-fees-within-4-weeks-of-reopening');
    expect(src).toContain('embed=true');
    expect(src).toContain('theme=light');
  });
});
