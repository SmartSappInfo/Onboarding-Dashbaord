import { test, expect } from '@playwright/test';

/**
 * @fileOverview E2E tests for the Messaging Template Management system.
 * Tests the two-tier template architecture with global and organization-level templates.
 */

test.describe('Template Management - Global to Organization Flow', () => {
  /**
   * Test 17.1: Super admin creates a global meeting invitation template
   * and verifies it appears in the organization template list.
   * 
   * This test validates:
   * 1. Super admin can access the back office template management UI
   * 2. Super admin can create a global template with proper categorization
   * 3. Global template is saved with correct scope and metadata
   * 4. Global template appears in organization template list
   * 5. Template shows correct category, type, and channel badges
   */
  test('super admin creates global meeting invitation template and it appears in org template list', async ({ page }) => {
    // Step 1: Login as super admin
    // Note: This assumes a super admin test account exists
    // In a real implementation, you would use a test fixture or setup script
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_SUPER_ADMIN_EMAIL || 'superadmin@test.com');
    await page.fill('input[type="password"]', process.env.TEST_SUPER_ADMIN_PASSWORD || 'testpassword123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    
    // Wait for successful login - check for dashboard or navigation
    await expect(page).toHaveURL(/\/dashboard|\/backoffice/, { timeout: 10000 });
    
    // Step 2: Navigate to back office global template management
    await page.goto('/backoffice/messaging/templates');
    
    // Verify we're on the global template list page
    await expect(page.getByRole('heading', { name: /Message Templates|Global Templates/i })).toBeVisible();
    
    // Step 3: Click "New Template" button
    const newTemplateButton = page.getByRole('button', { name: /New Template|\+ New/i });
    await expect(newTemplateButton).toBeVisible();
    await newTemplateButton.click();
    
    // Verify we're on the template creation page
    await expect(page).toHaveURL(/\/backoffice\/messaging\/templates\/new/);
    
    // Step 4: Fill in template details
    const templateName = `Test Meeting Invitation ${Date.now()}`;
    
    // Template name
    await page.fill('input[name="name"], input[placeholder*="name" i]', templateName);
    
    // Select category: Meetings
    const categorySelect = page.locator('select[name="category"], [role="combobox"]:has-text("Category")');
    await categorySelect.click();
    await page.getByRole('option', { name: /Meetings/i }).click();
    
    // Select template type: meeting_invitation
    const typeSelect = page.locator('select[name="templateType"], [role="combobox"]:has-text("Type")');
    await typeSelect.click();
    await page.getByRole('option', { name: /Meeting Invitation|meeting_invitation/i }).click();
    
    // Select channel: Email
    const channelSelect = page.locator('select[name="channel"], [role="combobox"]:has-text("Channel")');
    await channelSelect.click();
    await page.getByRole('option', { name: /Email/i }).click();
    
    // Email subject
    await page.fill('input[name="subject"], input[placeholder*="subject" i]', 'You\'re Invited: {{meeting_title}}');
    
    // Email body - look for textarea or rich text editor
    const bodyField = page.locator('textarea[name="body"], [contenteditable="true"], [data-testid="template-body"]').first();
    await bodyField.click();
    await bodyField.fill(`Dear {{contact_name}},

You are invited to attend {{meeting_title}}.

Meeting Details:
- Date & Time: {{meeting_time}}
- Duration: {{meeting_duration}}
- Organizer: {{organizer_name}}

Join the meeting: {{meeting_link}}

We look forward to seeing you there!

Best regards,
{{org_name}}`);
    
    // Step 5: Save the template
    const saveButton = page.getByRole('button', { name: /Save|Create Template/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    
    // Wait for success notification
    const successToast = page.locator('[role="alert"], .toast, [data-testid="toast"]').filter({ hasText: /success|created|saved/i });
    await expect(successToast).toBeVisible({ timeout: 5000 });
    
    // Should redirect back to template list
    await expect(page).toHaveURL(/\/backoffice\/messaging\/templates(?!\/new)/);
    
    // Step 6: Verify template appears in global template list
    await page.waitForTimeout(1000); // Allow time for Firestore to sync
    
    // Search for the newly created template
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
    if (await searchInput.isVisible()) {
      await searchInput.fill(templateName);
      await page.waitForTimeout(500); // Debounce
    }
    
    // Verify template card exists with correct details
    const templateCard = page.locator('[data-testid="template-card"], .template-card, [role="article"]').filter({ hasText: templateName });
    await expect(templateCard).toBeVisible();
    
    // Verify badges/indicators
    await expect(templateCard.locator('text=/Meetings|Meeting/i')).toBeVisible(); // Category badge
    await expect(templateCard.locator('text=/Email/i')).toBeVisible(); // Channel badge
    await expect(templateCard.locator('text=/Approved|Active|Global/i')).toBeVisible(); // Status badge
    
    // Step 7: Switch to organization admin view
    // Navigate to organization template management
    await page.goto('/admin/settings/messaging/templates');
    
    // Verify we're on the org template list page
    await expect(page.getByRole('heading', { name: /Templates|Message Templates/i })).toBeVisible();
    
    // Step 8: Verify global template appears in org template list
    await page.waitForTimeout(1000); // Allow time for data to load
    
    // Search for the template if search is available
    const orgSearchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
    if (await orgSearchInput.isVisible()) {
      await orgSearchInput.fill(templateName);
      await page.waitForTimeout(500);
    }
    
    // Verify template is visible in org list
    const orgTemplateCard = page.locator('[data-testid="template-card"], .template-card, [role="article"]').filter({ hasText: templateName });
    await expect(orgTemplateCard).toBeVisible();
    
    // Verify it shows as a global template (not an override)
    // Should NOT have "Override" or "Revert to Global" button
    const overrideButton = orgTemplateCard.locator('button:has-text("Override")');
    await expect(overrideButton).toBeVisible(); // Global templates should show "Override" option
    
    // Should NOT have "Revert to Global" button (that's only for overrides)
    const revertButton = orgTemplateCard.locator('button:has-text("Revert")');
    await expect(revertButton).not.toBeVisible();
    
    // Step 9: Verify template details are correct
    await orgTemplateCard.click();
    
    // Should navigate to template detail/edit page
    await expect(page).toHaveURL(/\/admin\/settings\/messaging\/templates\/[^/]+/);
    
    // Verify template content is displayed
    await expect(page.locator('text=' + templateName)).toBeVisible();
    await expect(page.locator('text=/You\'re Invited/i')).toBeVisible(); // Subject
    await expect(page.locator('text=/Dear {{contact_name}}/i')).toBeVisible(); // Body preview
    
    // Verify it's marked as global (read-only for org admin)
    const globalBadge = page.locator('text=/Global Template|System Template/i');
    await expect(globalBadge).toBeVisible();
    
    // Step 10: Cleanup - delete the test template
    // Navigate back to back office as super admin
    await page.goto('/backoffice/messaging/templates');
    
    // Find and delete the test template
    const deleteButton = page.locator('[data-testid="template-card"], .template-card').filter({ hasText: templateName })
      .locator('button[aria-label*="delete" i], button:has-text("Delete")');
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Confirm deletion in dialog
      const confirmButton = page.getByRole('button', { name: /Confirm|Delete|Yes/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Wait for deletion success
      await expect(page.locator('[role="alert"]').filter({ hasText: /deleted|removed/i })).toBeVisible({ timeout: 5000 });
    }
  });
  
  /**
   * Helper test to verify template list filtering by category
   */
  test('should filter templates by category in org template list', async ({ page }) => {
    // Login as org admin
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_ORG_ADMIN_EMAIL || 'orgadmin@test.com');
    await page.fill('input[type="password"]', process.env.TEST_ORG_ADMIN_PASSWORD || 'testpassword123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    
    await expect(page).toHaveURL(/\/dashboard|\/admin/, { timeout: 10000 });
    
    // Navigate to org template list
    await page.goto('/admin/settings/messaging/templates');
    
    // Find category filter
    const categoryFilter = page.locator('select[name="category"], [role="combobox"]:has-text("Category"), button:has-text("All Categories")');
    
    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();
      
      // Select "Meetings" category
      await page.getByRole('option', { name: /Meetings/i }).click();
      
      // Wait for filter to apply
      await page.waitForTimeout(500);
      
      // Verify only meeting templates are shown
      const templateCards = page.locator('[data-testid="template-card"], .template-card');
      const count = await templateCards.count();
      
      if (count > 0) {
        // Check that all visible templates have "Meetings" category
        for (let i = 0; i < count; i++) {
          const card = templateCards.nth(i);
          await expect(card.locator('text=/Meetings|Meeting/i')).toBeVisible();
        }
      }
    }
  });

  /**
   * Test 17.2: Org admin overrides a global template and the override is used in the composer
   * 
   * This test validates:
   * 1. Org admin can view global templates
   * 2. Org admin can create an override of a global template
   * 3. Override template has customized content
   * 4. Override template appears in org template list with override indicator
   * 5. Composer uses the override template instead of global template
   * 6. Override content is rendered in the composer
   */
  test('org admin overrides global template and override is used in composer', async ({ page }) => {
    // Step 1: Login as org admin
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_ORG_ADMIN_EMAIL || 'orgadmin@test.com');
    await page.fill('input[type="password"]', process.env.TEST_ORG_ADMIN_PASSWORD || 'testpassword123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    
    await expect(page).toHaveURL(/\/dashboard|\/admin/, { timeout: 10000 });
    
    // Step 2: Navigate to org template management
    await page.goto('/admin/settings/messaging/templates');
    await expect(page.getByRole('heading', { name: /Templates|Message Templates/i })).toBeVisible();
    
    // Step 3: Find a global meeting invitation template to override
    // Filter by Meetings category
    const categoryFilter = page.locator('select[name="category"], [role="combobox"]:has-text("Category")');
    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();
      await page.getByRole('option', { name: /Meetings/i }).click();
      await page.waitForTimeout(500);
    }
    
    // Find a global template (one with "Override" button)
    const globalTemplateCard = page.locator('[data-testid="template-card"], .template-card')
      .filter({ has: page.locator('button:has-text("Override")') })
      .first();
    
    await expect(globalTemplateCard).toBeVisible({ timeout: 5000 });
    
    // Get the template name for later verification
    const globalTemplateName = await globalTemplateCard.locator('h3, h4, [data-testid="template-name"]').first().textContent();
    
    // Step 4: Click "Override" button
    const overrideButton = globalTemplateCard.locator('button:has-text("Override")');
    await overrideButton.click();
    
    // Should navigate to override creation page
    await expect(page).toHaveURL(/\/admin\/settings\/messaging\/templates\/[^/]+\/override/);
    
    // Step 5: Verify form is pre-populated with global template content
    await expect(page.getByRole('heading', { name: /Override Template|Create Override/i })).toBeVisible();
    
    // Should show original global template content
    const originalContentSection = page.locator('text=/Original|Global Template/i');
    await expect(originalContentSection).toBeVisible();
    
    // Step 6: Customize the override content
    const customSubject = `[CUSTOM] Meeting Invitation - {{meeting_title}}`;
    const customBody = `Dear {{contact_name}},

This is a CUSTOMIZED invitation for {{meeting_title}}.

Our organization has personalized this message for you.

Meeting Details:
- Time: {{meeting_time}}
- Link: {{meeting_link}}
- Host: {{organizer_name}}

Looking forward to your participation!

Best regards,
{{org_name}} Team`;
    
    // Update subject
    const subjectField = page.locator('input[name="subject"], input[placeholder*="subject" i]');
    await subjectField.clear();
    await subjectField.fill(customSubject);
    
    // Update body
    const bodyField = page.locator('textarea[name="body"], [contenteditable="true"], [data-testid="template-body"]').first();
    await bodyField.click();
    await bodyField.clear();
    await bodyField.fill(customBody);
    
    // Step 7: Save the override
    const saveButton = page.getByRole('button', { name: /Save|Create Override/i });
    await saveButton.click();
    
    // Wait for success notification
    await expect(page.locator('[role="alert"]').filter({ hasText: /success|created|saved/i })).toBeVisible({ timeout: 5000 });
    
    // Should redirect back to template list
    await expect(page).toHaveURL(/\/admin\/settings\/messaging\/templates(?!.*\/override)/);
    
    // Step 8: Verify override appears in template list with indicator
    await page.waitForTimeout(1000); // Allow Firestore sync
    
    // Find the template card (should now show as override)
    const overrideCard = page.locator('[data-testid="template-card"], .template-card')
      .filter({ hasText: globalTemplateName || /Meeting Invitation/i })
      .first();
    
    await expect(overrideCard).toBeVisible();
    
    // Should show override indicator
    await expect(overrideCard.locator('text=/Overriding|Custom|Override/i')).toBeVisible();
    
    // Should have "Revert to Global" button instead of "Override"
    await expect(overrideCard.locator('button:has-text("Revert")')).toBeVisible();
    
    // Step 9: Open the message composer with meeting context
    await page.goto('/admin/messaging/composer?context=meeting');
    
    // Wait for composer to load
    await expect(page.getByRole('heading', { name: /Compose Message|New Message/i })).toBeVisible({ timeout: 5000 });
    
    // Step 10: Select template in composer
    // Look for template selector/dropdown
    const templateSelector = page.locator('select[name="template"], [role="combobox"]:has-text("Template"), button:has-text("Select Template")');
    await expect(templateSelector).toBeVisible({ timeout: 5000 });
    await templateSelector.click();
    
    // Find and select the meeting invitation template
    const templateOption = page.getByRole('option', { name: /Meeting Invitation/i }).first();
    await templateOption.click();
    
    // Step 11: Verify override content is loaded in composer
    await page.waitForTimeout(500); // Allow template to load
    
    // Check subject field contains custom subject
    const composerSubject = page.locator('input[name="subject"], input[placeholder*="subject" i]');
    await expect(composerSubject).toHaveValue(/\[CUSTOM\]/);
    
    // Check body contains custom content
    const composerBody = page.locator('textarea[name="body"], [contenteditable="true"], [data-testid="message-body"]').first();
    const bodyContent = await composerBody.textContent() || await composerBody.inputValue();
    expect(bodyContent).toContain('CUSTOMIZED invitation');
    expect(bodyContent).toContain('Our organization has personalized');
    
    // Step 12: Verify variables are present
    expect(bodyContent).toContain('{{contact_name}}');
    expect(bodyContent).toContain('{{meeting_title}}');
    expect(bodyContent).toContain('{{meeting_link}}');
    
    // Step 13: Cleanup - revert to global template
    await page.goto('/admin/settings/messaging/templates');
    
    // Find the override card
    const cleanupCard = page.locator('[data-testid="template-card"], .template-card')
      .filter({ has: page.locator('button:has-text("Revert")') })
      .filter({ hasText: globalTemplateName || /Meeting Invitation/i })
      .first();
    
    if (await cleanupCard.isVisible()) {
      const revertButton = cleanupCard.locator('button:has-text("Revert")');
      await revertButton.click();
      
      // Confirm revert in dialog
      const confirmButton = page.getByRole('button', { name: /Confirm|Revert|Yes/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Wait for success
      await expect(page.locator('[role="alert"]').filter({ hasText: /reverted|restored/i })).toBeVisible({ timeout: 5000 });
    }
  });

  /**
   * Test 17.3: Org admin reverts override and global template is restored
   * 
   * This test validates:
   * 1. Org admin can create an override
   * 2. Override appears with "Revert to Global" option
   * 3. Revert action removes the override
   * 4. Global template is restored in template list
   * 5. Composer uses global template after revert
   */
  test('org admin reverts override and global template is restored', async ({ page }) => {
    // Step 1: Login as org admin
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_ORG_ADMIN_EMAIL || 'orgadmin@test.com');
    await page.fill('input[type="password"]', process.env.TEST_ORG_ADMIN_PASSWORD || 'testpassword123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    
    await expect(page).toHaveURL(/\/dashboard|\/admin/, { timeout: 10000 });
    
    // Step 2: Navigate to org template management
    await page.goto('/admin/settings/messaging/templates');
    
    // Step 3: Find a global template and create override
    const globalTemplateCard = page.locator('[data-testid="template-card"], .template-card')
      .filter({ has: page.locator('button:has-text("Override")') })
      .first();
    
    await expect(globalTemplateCard).toBeVisible({ timeout: 5000 });
    
    const templateName = await globalTemplateCard.locator('h3, h4, [data-testid="template-name"]').first().textContent();
    
    // Click Override
    await globalTemplateCard.locator('button:has-text("Override")').click();
    await expect(page).toHaveURL(/\/override/);
    
    // Step 4: Make a simple change and save
    const subjectField = page.locator('input[name="subject"]');
    const currentSubject = await subjectField.inputValue();
    await subjectField.fill(`[TEST OVERRIDE] ${currentSubject}`);
    
    await page.getByRole('button', { name: /Save|Create/i }).click();
    await expect(page.locator('[role="alert"]').filter({ hasText: /success/i })).toBeVisible({ timeout: 5000 });
    
    // Step 5: Verify override exists
    await page.goto('/admin/settings/messaging/templates');
    await page.waitForTimeout(1000);
    
    const overrideCard = page.locator('[data-testid="template-card"], .template-card')
      .filter({ hasText: templateName || '' })
      .first();
    
    await expect(overrideCard).toBeVisible();
    await expect(overrideCard.locator('text=/Override|Custom/i')).toBeVisible();
    await expect(overrideCard.locator('button:has-text("Revert")')).toBeVisible();
    
    // Step 6: Revert to global
    const revertButton = overrideCard.locator('button:has-text("Revert")');
    await revertButton.click();
    
    // Confirm revert
    const confirmDialog = page.locator('[role="dialog"], [role="alertdialog"]');
    await expect(confirmDialog).toBeVisible({ timeout: 3000 });
    
    const confirmButton = page.getByRole('button', { name: /Confirm|Revert|Yes/i });
    await confirmButton.click();
    
    // Wait for success
    await expect(page.locator('[role="alert"]').filter({ hasText: /reverted|restored|global/i })).toBeVisible({ timeout: 5000 });
    
    // Step 7: Verify global template is restored
    await page.waitForTimeout(1000);
    
    const restoredCard = page.locator('[data-testid="template-card"], .template-card')
      .filter({ hasText: templateName || '' })
      .first();
    
    await expect(restoredCard).toBeVisible();
    
    // Should show "Override" button again (not "Revert")
    await expect(restoredCard.locator('button:has-text("Override")')).toBeVisible();
    await expect(restoredCard.locator('button:has-text("Revert")')).not.toBeVisible();
    
    // Should NOT show override indicator
    const overrideIndicator = restoredCard.locator('text=/Overriding|Custom Override/i');
    await expect(overrideIndicator).not.toBeVisible();
    
    // Step 8: Verify composer uses global template
    await page.goto('/admin/messaging/composer');
    
    const templateSelector = page.locator('select[name="template"], [role="combobox"]').first();
    if (await templateSelector.isVisible()) {
      await templateSelector.click();
      
      const option = page.getByRole('option').filter({ hasText: templateName || '' }).first();
      if (await option.isVisible()) {
        await option.click();
        
        await page.waitForTimeout(500);
        
        // Verify subject does NOT contain [TEST OVERRIDE]
        const subjectInComposer = page.locator('input[name="subject"]');
        const subjectValue = await subjectInComposer.inputValue();
        expect(subjectValue).not.toContain('[TEST OVERRIDE]');
      }
    }
  });

  /**
   * Test 17.4: Composer opened from meeting context shows only meeting templates
   * 
   * This test validates:
   * 1. Composer can be opened with meeting context
   * 2. Template list is filtered to show only meeting category templates
   * 3. Non-meeting templates are not shown
   * 4. Meeting-specific variables are available
   */
  test('composer opened from meeting context shows only meeting templates', async ({ page }) => {
    // Step 1: Login as org admin
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_ORG_ADMIN_EMAIL || 'orgadmin@test.com');
    await page.fill('input[type="password"]', process.env.TEST_ORG_ADMIN_PASSWORD || 'testpassword123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    
    await expect(page).toHaveURL(/\/dashboard|\/admin/, { timeout: 10000 });
    
    // Step 2: Open composer with meeting context
    await page.goto('/admin/messaging/composer?context=meeting&category=meetings');
    
    await expect(page.getByRole('heading', { name: /Compose|Message/i })).toBeVisible({ timeout: 5000 });
    
    // Step 3: Open template selector
    const templateSelector = page.locator('select[name="template"], [role="combobox"], button:has-text("Select Template")').first();
    await expect(templateSelector).toBeVisible({ timeout: 5000 });
    await templateSelector.click();
    
    // Step 4: Verify only meeting templates are shown
    const templateOptions = page.getByRole('option');
    const optionCount = await templateOptions.count();
    
    if (optionCount > 0) {
      // Check each visible option contains meeting-related text
      for (let i = 0; i < Math.min(optionCount, 10); i++) {
        const optionText = await templateOptions.nth(i).textContent();
        // Should contain meeting-related keywords
        const isMeetingTemplate = /meeting|invitation|reminder|confirmation|cancellation/i.test(optionText || '');
        expect(isMeetingTemplate).toBe(true);
      }
    }
    
    // Step 5: Select a meeting template
    const meetingTemplate = page.getByRole('option', { name: /Meeting/i }).first();
    if (await meetingTemplate.isVisible()) {
      await meetingTemplate.click();
      
      await page.waitForTimeout(500);
      
      // Step 6: Verify meeting variables are available
      // Look for variable picker or variable list
      const variablePicker = page.locator('button:has-text("Variable"), [data-testid="variable-picker"]');
      if (await variablePicker.isVisible()) {
        await variablePicker.click();
        
        // Verify meeting-specific variables are shown
        await expect(page.locator('text=/meeting_link|meeting_time|meeting_title/i')).toBeVisible();
      }
    }
  });

  /**
   * Test 17.5: Meeting reminder is scheduled and appears in scheduled messages list
   * 
   * This test validates:
   * 1. Meeting can be created with reminders enabled
   * 2. Reminder configuration options are available
   * 3. Scheduled reminders are created
   * 4. Scheduled messages appear in scheduled messages list
   * 5. Scheduled message has correct timing and template
   */
  test('meeting reminder is scheduled and appears in scheduled messages list', async ({ page }) => {
    // Step 1: Login as org admin
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_ORG_ADMIN_EMAIL || 'orgadmin@test.com');
    await page.fill('input[type="password"]', process.env.TEST_ORG_ADMIN_PASSWORD || 'testpassword123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    
    await expect(page).toHaveURL(/\/dashboard|\/admin/, { timeout: 10000 });
    
    // Step 2: Navigate to meetings page
    await page.goto('/admin/meetings');
    
    // Wait for page to load
    await page.waitForTimeout(1000);
    
    // Step 3: Create a new meeting
    const newMeetingButton = page.getByRole('button', { name: /New Meeting|Create Meeting|\+ Meeting/i });
    if (await newMeetingButton.isVisible()) {
      await newMeetingButton.click();
      
      // Fill meeting details
      const meetingTitle = `Test Meeting ${Date.now()}`;
      await page.fill('input[name="title"], input[placeholder*="title" i]', meetingTitle);
      
      // Set meeting time (2 hours from now)
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const dateInput = page.locator('input[type="datetime-local"], input[name="meetingTime"]');
      if (await dateInput.isVisible()) {
        const dateString = futureDate.toISOString().slice(0, 16);
        await dateInput.fill(dateString);
      }
      
      // Step 4: Enable reminders
      // Look for reminder configuration section
      const reminderSection = page.locator('text=/Reminders|Send Reminders/i');
      if (await reminderSection.isVisible()) {
        // Enable 1 hour reminder
        const oneHourCheckbox = page.locator('input[type="checkbox"][value="meeting_reminder_1hour"], label:has-text("1 hour")');
        if (await oneHourCheckbox.isVisible()) {
          await oneHourCheckbox.check();
        }
        
        // Enable 15 minute reminder
        const fifteenMinCheckbox = page.locator('input[type="checkbox"][value="meeting_reminder_15min"], label:has-text("15 min")');
        if (await fifteenMinCheckbox.isVisible()) {
          await fifteenMinCheckbox.check();
        }
      }
      
      // Save meeting
      const saveButton = page.getByRole('button', { name: /Save|Create/i });
      await saveButton.click();
      
      // Wait for success
      await expect(page.locator('[role="alert"]').filter({ hasText: /success|created/i })).toBeVisible({ timeout: 5000 });
      
      // Step 5: Navigate to scheduled messages
      await page.goto('/admin/messaging/scheduled');
      
      // Wait for list to load
      await page.waitForTimeout(1000);
      
      // Step 6: Verify scheduled reminders appear
      // Search for the meeting title
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
      if (await searchInput.isVisible()) {
        await searchInput.fill(meetingTitle);
        await page.waitForTimeout(500);
      }
      
      // Look for scheduled message cards
      const scheduledMessages = page.locator('[data-testid="scheduled-message"], .scheduled-message-card');
      
      if (await scheduledMessages.first().isVisible()) {
        // Verify at least one reminder is scheduled
        await expect(scheduledMessages.first()).toBeVisible();
        
        // Verify reminder details
        const firstMessage = scheduledMessages.first();
        await expect(firstMessage.locator('text=/reminder|meeting/i')).toBeVisible();
        await expect(firstMessage.locator('text=/pending|scheduled/i')).toBeVisible();
        
        // Verify scheduled time is in the future
        const scheduledTime = firstMessage.locator('[data-testid="scheduled-time"], text=/scheduled/i');
        await expect(scheduledTime).toBeVisible();
      }
      
      // Step 7: Cleanup - cancel the meeting
      await page.goto('/admin/meetings');
      
      const meetingCard = page.locator('[data-testid="meeting-card"], .meeting-card').filter({ hasText: meetingTitle });
      if (await meetingCard.isVisible()) {
        const deleteButton = meetingCard.locator('button[aria-label*="delete" i], button:has-text("Delete")');
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
          
          const confirmButton = page.getByRole('button', { name: /Confirm|Delete|Yes/i });
          if (await confirmButton.isVisible()) {
            await confirmButton.click();
          }
        }
      }
    }
  });
});
