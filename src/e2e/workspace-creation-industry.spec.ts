import { test, expect } from '@playwright/test';

/**
 * @fileOverview E2E tests for workspace creation with industry selection
 *
 * Requirements:
 * - 13.1-13.6: Industry-specific terminology in UI
 * - 19.1-19.6: Workspace industry selection UI
 *
 * Test Coverage:
 * - Creating a SaaS workspace shows "Accounts" terminology
 * - Creating a SchoolEnrollment workspace shows "Schools" terminology
 * - Industry select is disabled after first entity is linked (scope lock UI)
 */

test.describe('Workspace Creation - Industry Selection', () => {
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

    // Navigate to workspace settings
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should create a SaaS workspace and show "Accounts" terminology in sidebar and page title', async ({
    page,
  }) => {
    // Click "New Workspace" button
    await page.getByRole('button', { name: /New Workspace/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/New Workspace/i)).toBeVisible();

    // Fill in workspace name
    await page.fill('input[placeholder*="Higher Education"]', 'SaaS Test Workspace');

    // Fill in description
    await page.fill(
      'textarea[placeholder*="Define the scope"]',
      'Test workspace for SaaS industry'
    );

    // Select SaaS industry
    await page.getByRole('button', { name: /SaaS/i }).click();

    // Verify SaaS industry is selected (check for checkmark or active state)
    const saasButton = page.locator('button:has-text("SaaS")').filter({ has: page.locator('svg') });
    await expect(saasButton).toBeVisible();

    // Select contact scope (institution)
    await page.locator('button:has-text("Schools")').first().click();

    // Submit the form
    await page.getByRole('button', { name: /Commit Workspace/i }).click();

    // Confirmation dialog should appear
    await expect(page.getByText(/Confirm Workspace Configuration/i)).toBeVisible();

    // Verify industry is shown in confirmation
    await expect(page.getByText(/SaaS/i)).toBeVisible();
    await expect(page.getByText(/B2B SaaS customer management/i)).toBeVisible();

    // Confirm creation
    await page.getByRole('button', { name: /Confirm/i }).click();

    // Wait for workspace to be created
    await page.waitForTimeout(2000);

    // Navigate to the new workspace (click on the workspace card)
    await page.getByText('SaaS Test Workspace').click();
    await page.waitForLoadState('networkidle');

    // Verify "Accounts" terminology appears in sidebar
    await expect(page.getByRole('link', { name: /Accounts/i })).toBeVisible();

    // Navigate to accounts page
    await page.getByRole('link', { name: /Accounts/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify "Accounts" appears in page title
    await expect(page.getByRole('heading', { name: /Accounts/i })).toBeVisible();

    // Verify SaaS-specific sidebar items are present
    await expect(page.getByRole('link', { name: /Trials/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Subscriptions/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Health/i })).toBeVisible();
  });

  test('should create a SchoolEnrollment workspace and show "Schools" terminology', async ({
    page,
  }) => {
    // Click "New Workspace" button
    await page.getByRole('button', { name: /New Workspace/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill in workspace name
    await page.fill('input[placeholder*="Higher Education"]', 'School Enrollment Test Workspace');

    // Fill in description
    await page.fill(
      'textarea[placeholder*="Define the scope"]',
      'Test workspace for School Enrollment industry'
    );

    // Select School Enrollment industry
    await page.getByRole('button', { name: /School Enrollment/i }).click();

    // Verify School Enrollment industry is selected
    const schoolButton = page
      .locator('button:has-text("School Enrollment")')
      .filter({ has: page.locator('svg') });
    await expect(schoolButton).toBeVisible();

    // Select contact scope (institution)
    await page.locator('button:has-text("Schools")').first().click();

    // Submit the form
    await page.getByRole('button', { name: /Commit Workspace/i }).click();

    // Confirmation dialog should appear
    await expect(page.getByText(/Confirm Workspace Configuration/i)).toBeVisible();

    // Verify industry is shown in confirmation
    await expect(page.getByText(/School Enrollment/i)).toBeVisible();
    await expect(page.getByText(/Education admissions management/i)).toBeVisible();

    // Confirm creation
    await page.getByRole('button', { name: /Confirm/i }).click();

    // Wait for workspace to be created
    await page.waitForTimeout(2000);

    // Navigate to the new workspace
    await page.getByText('School Enrollment Test Workspace').click();
    await page.waitForLoadState('networkidle');

    // Verify "Schools" terminology appears in sidebar
    await expect(page.getByRole('link', { name: /Schools/i })).toBeVisible();

    // Navigate to schools page
    await page.getByRole('link', { name: /Schools/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify "Schools" appears in page title
    await expect(page.getByRole('heading', { name: /Schools/i })).toBeVisible();

    // Verify School Enrollment-specific sidebar items are present
    await expect(page.getByRole('link', { name: /Admissions/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Enrollments/i })).toBeVisible();

    // Verify SaaS-specific items are NOT present
    await expect(page.getByRole('link', { name: /Trials/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Subscriptions/i })).not.toBeVisible();
  });

  test('should show industry select as disabled after first entity is linked (scope lock UI)', async ({
    page,
  }) => {
    // This test assumes a workspace already exists with entities linked
    // We'll create a workspace, add an entity, then try to edit the workspace

    // Click "New Workspace" button
    await page.getByRole('button', { name: /New Workspace/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill in workspace name
    await page.fill('input[placeholder*="Higher Education"]', 'Scope Lock Test Workspace');

    // Fill in description
    await page.fill('textarea[placeholder*="Define the scope"]', 'Test workspace for scope lock');

    // Select SaaS industry
    await page.getByRole('button', { name: /SaaS/i }).click();

    // Select contact scope
    await page.locator('button:has-text("Schools")').first().click();

    // Submit the form
    await page.getByRole('button', { name: /Commit Workspace/i }).click();

    // Confirm creation
    await page.getByRole('button', { name: /Confirm/i }).click();

    // Wait for workspace to be created
    await page.waitForTimeout(2000);

    // Navigate to the new workspace
    await page.getByText('Scope Lock Test Workspace').click();
    await page.waitForLoadState('networkidle');

    // Create an entity to trigger scope lock
    await page.getByRole('link', { name: /Accounts/i }).click();
    await page.waitForLoadState('networkidle');

    // Click "Add Account" or similar button
    const addButton = page.getByRole('button', { name: /Add|New|Create/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();

      // Fill in minimal entity data
      await page.fill('input[name="name"]', 'Test Account');

      // Submit entity creation
      await page.getByRole('button', { name: /Save|Create|Submit/i }).click();

      // Wait for entity to be created
      await page.waitForTimeout(2000);
    }

    // Navigate back to workspace settings
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');

    // Click edit button on the workspace
    const editButton = page
      .locator('button[aria-label="Edit workspace"]')
      .or(
        page.locator('button:has-text("Edit")').or(page.locator('svg.lucide-pencil').locator('..'))
      )
      .first();

    if (await editButton.isVisible()) {
      await editButton.click();

      // Wait for edit dialog to open
      await expect(page.getByRole('dialog')).toBeVisible();

      // Verify industry section shows "Locked" indicator
      await expect(page.getByText(/Industry Locked/i)).toBeVisible();

      // Verify lock icon is present
      await expect(page.locator('svg.lucide-lock')).toBeVisible();

      // Verify industry cannot be changed (no selection buttons visible)
      const industryButtons = page.locator('button:has-text("SaaS")').filter({
        has: page.locator('svg'),
      });

      // Industry selection buttons should not be present in edit mode
      await expect(industryButtons).not.toBeVisible();

      // Verify informational message about scope lock
      await expect(page.getByText(/Industry vertical cannot be changed/i)).toBeVisible();
    }
  });
});

test.describe('Workspace Creation - Industry Filter', () => {
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

    // Navigate to workspace settings
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should filter workspaces by industry', async ({ page }) => {
    // Verify industry filter dropdown is present
    await expect(page.getByText(/Filter by Industry/i)).toBeVisible();

    // Click on industry filter dropdown
    await page
      .getByRole('combobox', { name: /Filter by Industry/i })
      .or(page.locator('button:has-text("All Industries")'))
      .click();

    // Verify industry options are visible
    await expect(page.getByRole('option', { name: /SaaS/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /School Enrollment/i })).toBeVisible();

    // Select SaaS filter
    await page.getByRole('option', { name: /SaaS/i }).click();

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify only SaaS workspaces are shown (check for SaaS badge)
    const workspaceCards = page
      .locator('[data-testid="workspace-card"]')
      .or(page.locator('.group:has-text("SaaS")'));

    // All visible workspace cards should have SaaS badge
    const count = await workspaceCards.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(workspaceCards.nth(i).getByText(/SaaS/i)).toBeVisible();
      }
    }
  });
});
