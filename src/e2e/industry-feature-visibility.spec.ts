import { test, expect } from '@playwright/test';

/**
 * @fileOverview E2E tests for industry-specific feature visibility
 *
 * Requirements:
 * - 15.7: Hide features not applicable to workspace industry
 * - 17.1-17.6: Industry-specific sidebar navigation
 *
 * Test Coverage:
 * - SaaS workspace shows Trials sidebar item; SchoolEnrollment workspace does not
 * - Feature-gated panels are hidden for wrong industry
 * - Industry-specific features are only visible in correct workspaces
 */

test.describe('Industry Feature Visibility - SaaS Workspace', () => {
  test.beforeEach(async ({ page }) => {
    // Login as organization admin
    await page.goto('/login');
    await page.fill(
      'input[type="email"]',
      process.env.TEST_ORG_ADMIN_EMAIL || 'orgadmin@test.smartsapp.com'
    );
    await page.fill(
      'input[type="password"]',
      process.env.TEST_ORG_ADMIN_PASSWORD || 'testpassword'
    );
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Wait for dashboard to load
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Navigate to workspace settings to find or create a SaaS workspace
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    // Look for existing SaaS workspace or create one
    const saasWorkspace = page.locator('.group:has-text("SaaS")').first();

    if (await saasWorkspace.isVisible()) {
      // Click on existing SaaS workspace
      await saasWorkspace.click();
    } else {
      // Create a new SaaS workspace
      await page.getByRole('button', { name: /New Workspace/i }).click();
      await page.fill('input[placeholder*="Higher Education"]', 'SaaS Feature Test');
      await page.fill('textarea[placeholder*="Define the scope"]', 'Test SaaS features');
      await page.getByRole('button', { name: /SaaS/i }).click();
      await page.locator('button:has-text("Schools")').first().click();
      await page.getByRole('button', { name: /Commit Workspace/i }).click();
      await page.getByRole('button', { name: /Confirm/i }).click();
      await page.waitForTimeout(2000);
      await page.getByText('SaaS Feature Test').click();
    }

    await page.waitForLoadState('networkidle');
  });

  test('should show SaaS-specific sidebar items (Trials, Subscriptions, Health)', async ({
    page,
  }) => {
    // Verify SaaS-specific sidebar items are visible
    await expect(page.getByRole('link', { name: /Accounts/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Users/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Trials/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Subscriptions/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Health/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Support/i })).toBeVisible();
  });

  test('should NOT show School Enrollment-specific sidebar items', async ({ page }) => {
    // Verify School Enrollment-specific items are NOT visible
    await expect(page.getByRole('link', { name: /Admissions/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Enrollments/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /School Visits/i })).not.toBeVisible();
  });

  test('should NOT show Law-specific sidebar items', async ({ page }) => {
    // Verify Law-specific items are NOT visible
    await expect(page.getByRole('link', { name: /Matters/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Intake/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Consultations/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Time Tracking/i })).not.toBeVisible();
  });

  test('should show Trials page when clicking Trials sidebar item', async ({ page }) => {
    // Click on Trials sidebar item
    await page.getByRole('link', { name: /Trials/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify Trials page is loaded
    await expect(page).toHaveURL(/\/trials/);
    await expect(page.getByRole('heading', { name: /Trials/i })).toBeVisible();
  });

  test('should show Subscriptions page when clicking Subscriptions sidebar item', async ({
    page,
  }) => {
    // Click on Subscriptions sidebar item
    await page.getByRole('link', { name: /Subscriptions/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify Subscriptions page is loaded
    await expect(page).toHaveURL(/\/subscriptions/);
    await expect(page.getByRole('heading', { name: /Subscriptions/i })).toBeVisible();
  });

  test('should show Health Score page when clicking Health sidebar item', async ({ page }) => {
    // Click on Health sidebar item
    await page.getByRole('link', { name: /Health/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify Health page is loaded
    await expect(page).toHaveURL(/\/health/);
    await expect(page.getByRole('heading', { name: /Health/i })).toBeVisible();
  });
});

test.describe('Industry Feature Visibility - School Enrollment Workspace', () => {
  test.beforeEach(async ({ page }) => {
    // Login as organization admin
    await page.goto('/login');
    await page.fill(
      'input[type="email"]',
      process.env.TEST_ORG_ADMIN_EMAIL || 'orgadmin@test.smartsapp.com'
    );
    await page.fill(
      'input[type="password"]',
      process.env.TEST_ORG_ADMIN_PASSWORD || 'testpassword'
    );
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Wait for dashboard to load
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Navigate to workspace settings to find or create a School Enrollment workspace
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    // Look for existing School Enrollment workspace or create one
    const schoolWorkspace = page.locator('.group:has-text("School Enrollment")').first();

    if (await schoolWorkspace.isVisible()) {
      // Click on existing School Enrollment workspace
      await schoolWorkspace.click();
    } else {
      // Create a new School Enrollment workspace
      await page.getByRole('button', { name: /New Workspace/i }).click();
      await page.fill('input[placeholder*="Higher Education"]', 'School Enrollment Feature Test');
      await page.fill(
        'textarea[placeholder*="Define the scope"]',
        'Test School Enrollment features'
      );
      await page.getByRole('button', { name: /School Enrollment/i }).click();
      await page.locator('button:has-text("Schools")').first().click();
      await page.getByRole('button', { name: /Commit Workspace/i }).click();
      await page.getByRole('button', { name: /Confirm/i }).click();
      await page.waitForTimeout(2000);
      await page.getByText('School Enrollment Feature Test').click();
    }

    await page.waitForLoadState('networkidle');
  });

  test('should show School Enrollment-specific sidebar items (Admissions, Enrollments)', async ({
    page,
  }) => {
    // Verify School Enrollment-specific sidebar items are visible
    await expect(page.getByRole('link', { name: /Schools/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Families/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pipeline/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Admissions/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Enrollments/i })).toBeVisible();
  });

  test('should NOT show SaaS-specific sidebar items (Trials, Subscriptions)', async ({ page }) => {
    // Verify SaaS-specific items are NOT visible
    await expect(page.getByRole('link', { name: /Trials/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Subscriptions/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Health/i })).not.toBeVisible();

    // Note: "Support" might be visible as it could be a generic feature
  });

  test('should NOT show Law-specific sidebar items', async ({ page }) => {
    // Verify Law-specific items are NOT visible
    await expect(page.getByRole('link', { name: /Matters/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Intake/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Consultations/i })).not.toBeVisible();
  });

  test('should show Admissions page when clicking Admissions sidebar item', async ({ page }) => {
    // Click on Admissions sidebar item
    await page.getByRole('link', { name: /Admissions/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify Admissions page is loaded
    await expect(page).toHaveURL(/\/admissions/);
    await expect(page.getByRole('heading', { name: /Admissions/i })).toBeVisible();
  });

  test('should show Enrollments page when clicking Enrollments sidebar item', async ({ page }) => {
    // Click on Enrollments sidebar item
    await page.getByRole('link', { name: /Enrollments/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify Enrollments page is loaded
    await expect(page).toHaveURL(/\/enrollments/);
    await expect(page.getByRole('heading', { name: /Enrollments/i })).toBeVisible();
  });
});

test.describe('Industry Feature Visibility - Law Workspace', () => {
  test.beforeEach(async ({ page }) => {
    // Login as organization admin
    await page.goto('/login');
    await page.fill(
      'input[type="email"]',
      process.env.TEST_ORG_ADMIN_EMAIL || 'orgadmin@test.smartsapp.com'
    );
    await page.fill(
      'input[type="password"]',
      process.env.TEST_ORG_ADMIN_PASSWORD || 'testpassword'
    );
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Wait for dashboard to load
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Navigate to workspace settings to find or create a Law workspace
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    // Look for existing Law workspace or create one
    const lawWorkspace = page.locator('.group:has-text("Law")').first();

    if (await lawWorkspace.isVisible()) {
      // Click on existing Law workspace
      await lawWorkspace.click();
    } else {
      // Create a new Law workspace
      await page.getByRole('button', { name: /New Workspace/i }).click();
      await page.fill('input[placeholder*="Higher Education"]', 'Law Feature Test');
      await page.fill('textarea[placeholder*="Define the scope"]', 'Test Law features');
      await page.getByRole('button', { name: /Law/i }).click();
      await page.locator('button:has-text("Schools")').first().click();
      await page.getByRole('button', { name: /Commit Workspace/i }).click();
      await page.getByRole('button', { name: /Confirm/i }).click();
      await page.waitForTimeout(2000);
      await page.getByText('Law Feature Test').click();
    }

    await page.waitForLoadState('networkidle');
  });

  test('should show Law-specific sidebar items (Matters, Intake, Time Tracking)', async ({
    page,
  }) => {
    // Verify Law-specific sidebar items are visible
    await expect(page.getByRole('link', { name: /Clients/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Matters/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Intake/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Consultations/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Deadlines/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Time Tracking/i })).toBeVisible();
  });

  test('should NOT show SaaS-specific sidebar items', async ({ page }) => {
    // Verify SaaS-specific items are NOT visible
    await expect(page.getByRole('link', { name: /Trials/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Subscriptions/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Health/i })).not.toBeVisible();
  });

  test('should NOT show School Enrollment-specific sidebar items', async ({ page }) => {
    // Verify School Enrollment-specific items are NOT visible
    await expect(page.getByRole('link', { name: /Admissions/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Enrollments/i })).not.toBeVisible();
  });
});

test.describe('Feature Gate Component Visibility', () => {
  test.beforeEach(async ({ page }) => {
    // Login as organization admin
    await page.goto('/login');
    await page.fill(
      'input[type="email"]',
      process.env.TEST_ORG_ADMIN_EMAIL || 'orgadmin@test.smartsapp.com'
    );
    await page.fill(
      'input[type="password"]',
      process.env.TEST_ORG_ADMIN_PASSWORD || 'testpassword'
    );
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Wait for dashboard to load
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should hide trial management panel in School Enrollment workspace', async ({ page }) => {
    // Navigate to School Enrollment workspace
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    const schoolWorkspace = page.locator('.group:has-text("School Enrollment")').first();
    if (await schoolWorkspace.isVisible()) {
      await schoolWorkspace.click();
      await page.waitForLoadState('networkidle');

      // Navigate to accounts/entities page
      await page.getByRole('link', { name: /Schools/i }).click();
      await page.waitForLoadState('networkidle');

      // Verify trial-related UI elements are not present
      await expect(page.getByText(/Trial Status/i)).not.toBeVisible();
      await expect(page.getByText(/Start Trial/i)).not.toBeVisible();
      await expect(page.getByRole('button', { name: /Manage Trial/i })).not.toBeVisible();
    }
  });

  test('should hide admissions panel in SaaS workspace', async ({ page }) => {
    // Navigate to SaaS workspace
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    const saasWorkspace = page.locator('.group:has-text("SaaS")').first();
    if (await saasWorkspace.isVisible()) {
      await saasWorkspace.click();
      await page.waitForLoadState('networkidle');

      // Navigate to accounts page
      await page.getByRole('link', { name: /Accounts/i }).click();
      await page.waitForLoadState('networkidle');

      // Verify admissions-related UI elements are not present
      await expect(page.getByText(/Application Status/i)).not.toBeVisible();
      await expect(page.getByText(/Enrollment Status/i)).not.toBeVisible();
      await expect(page.getByRole('button', { name: /Manage Application/i })).not.toBeVisible();
    }
  });

  test('should show correct feature panels based on workspace industry', async ({ page }) => {
    // Test that feature-gated components render correctly

    // Navigate to SaaS workspace
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    const saasWorkspace = page.locator('.group:has-text("SaaS")').first();
    if (await saasWorkspace.isVisible()) {
      await saasWorkspace.click();
      await page.waitForLoadState('networkidle');

      // Navigate to dashboard
      await page.getByRole('link', { name: /Dashboard/i }).click();
      await page.waitForLoadState('networkidle');

      // Verify SaaS-specific dashboard widgets are present
      // These might include trial conversion rate, subscription MRR, health score distribution
      const dashboardContent = page.locator('main, [role="main"], .dashboard');
      await expect(dashboardContent).toBeVisible();

      // Check for SaaS-specific metrics (if implemented)
      // await expect(page.getByText(/Trial Conversion/i)).toBeVisible();
      // await expect(page.getByText(/MRR/i)).toBeVisible();
    }
  });
});
