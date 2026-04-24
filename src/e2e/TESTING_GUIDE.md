# Template Management E2E Testing Guide

## Overview

This guide provides detailed instructions for running and maintaining the E2E tests for the Messaging Template Customization System.

## Test Suite: template-management.spec.ts

### Test Coverage

The template management test suite validates the complete two-tier template architecture:

1. **Global Template Creation (17.1)**
   - Super admin authentication
   - Back office template management UI
   - Global template creation with categorization
   - Template visibility in organization lists

2. **Template Override (17.2)**
   - Organization admin override creation
   - Custom content in overrides
   - Override indicator display
   - Composer integration with overrides

3. **Override Reversion (17.3)**
   - Revert to global functionality
   - Global template restoration
   - Composer fallback to global template

4. **Context-Aware Filtering (17.4)**
   - Meeting context filtering
   - Category-based template display
   - Variable availability by context

5. **Reminder Scheduling (17.5)**
   - Meeting creation with reminders
   - Scheduled message creation
   - Scheduled message list display

## Prerequisites

### 1. Test Accounts Setup

Create the following test accounts in Firebase Authentication:

#### Super Admin Account
```
Email: superadmin@test.smartsapp.com
Password: [secure password]
Role: Super Admin
Permissions: 
  - Create/edit/delete global templates
  - Access back office
  - Full system access
```

#### Organization Admin Account
```
Email: orgadmin@test.smartsapp.com
Password: [secure password]
Role: Organization Admin
Organization: Test Organization (create if needed)
Permissions:
  - Create/edit organization templates
  - Override global templates
  - Access admin settings
```

### 2. Firestore Setup

Ensure the following collections exist:

- `message_templates` - For storing templates
- `scheduled_messages` - For storing scheduled reminders
- `organizations` - Test organization data
- `workspaces` - Test workspace data

### 3. Global Templates

Seed at least one global meeting invitation template:

```typescript
{
  id: "global-meeting-invitation-email",
  scope: "global",
  category: "meetings",
  templateType: "meeting_invitation",
  channel: "email",
  name: "Meeting Invitation (Email)",
  subject: "You're Invited: {{meeting_title}}",
  body: "Dear {{contact_name}}, ...",
  status: "approved",
  isActive: true,
  version: 1
}
```

### 4. Environment Configuration

Create `.env.test` file:

```env
TEST_SUPER_ADMIN_EMAIL=superadmin@test.smartsapp.com
TEST_SUPER_ADMIN_PASSWORD=your_secure_password
TEST_ORG_ADMIN_EMAIL=orgadmin@test.smartsapp.com
TEST_ORG_ADMIN_PASSWORD=your_secure_password
TEST_ORGANIZATION_ID=test-org-id
TEST_WORKSPACE_ID=test-workspace-id
```

## Running Tests

### Run All Template Management Tests
```bash
pnpm exec playwright test src/e2e/template-management.spec.ts
```

### Run Specific Test
```bash
# Test 17.1 - Global template creation
pnpm exec playwright test src/e2e/template-management.spec.ts -g "super admin creates global"

# Test 17.2 - Template override
pnpm exec playwright test src/e2e/template-management.spec.ts -g "org admin overrides"

# Test 17.3 - Override reversion
pnpm exec playwright test src/e2e/template-management.spec.ts -g "reverts override"

# Test 17.4 - Context filtering
pnpm exec playwright test src/e2e/template-management.spec.ts -g "meeting context"

# Test 17.5 - Reminder scheduling
pnpm exec playwright test src/e2e/template-management.spec.ts -g "reminder is scheduled"
```

### Run with UI (Recommended for Development)
```bash
pnpm exec playwright test src/e2e/template-management.spec.ts --ui
```

### Run in Headed Mode (See Browser)
```bash
pnpm exec playwright test src/e2e/template-management.spec.ts --headed
```

### Run in Debug Mode
```bash
pnpm exec playwright test src/e2e/template-management.spec.ts --debug
```

## Test Data Management

### Automatic Cleanup

All tests include cleanup steps to remove test data:

- **Test 17.1**: Deletes created global template
- **Test 17.2**: Reverts override to global
- **Test 17.3**: Cleanup handled by revert action
- **Test 17.5**: Deletes test meeting and cancels reminders

### Manual Cleanup

If tests fail before cleanup, manually remove test data:

```typescript
// Delete test templates
db.collection('message_templates')
  .where('name', '>=', 'Test Meeting Invitation')
  .where('name', '<=', 'Test Meeting Invitation\uf8ff')
  .get()
  .then(snapshot => {
    snapshot.forEach(doc => doc.ref.delete());
  });

// Delete test meetings
db.collection('meetings')
  .where('title', '>=', 'Test Meeting')
  .where('title', '<=', 'Test Meeting\uf8ff')
  .get()
  .then(snapshot => {
    snapshot.forEach(doc => doc.ref.delete());
  });

// Delete test scheduled messages
db.collection('scheduled_messages')
  .where('status', '==', 'pending')
  .where('createdAt', '>', Date.now() - 3600000) // Last hour
  .get()
  .then(snapshot => {
    snapshot.forEach(doc => doc.ref.delete());
  });
```

## Troubleshooting

### Test 17.1 Fails: Template Not Created

**Symptoms**: Template creation succeeds but template doesn't appear in list

**Possible Causes**:
1. Firestore security rules blocking read
2. Insufficient wait time for Firestore sync
3. Template status not set to "approved"

**Solutions**:
```typescript
// Increase wait time
await page.waitForTimeout(2000);

// Check Firestore rules
allow read: if request.auth != null;

// Verify template status
console.log(await db.collection('message_templates').doc(templateId).get());
```

### Test 17.2 Fails: Override Not Used in Composer

**Symptoms**: Composer loads global template instead of override

**Possible Causes**:
1. Template resolution logic not checking org overrides first
2. organizationId mismatch
3. Override not marked as active

**Solutions**:
```typescript
// Verify override exists
const override = await db.collection('message_templates')
  .where('scope', '==', 'organization')
  .where('organizationId', '==', orgId)
  .where('category', '==', 'meetings')
  .where('templateType', '==', 'meeting_invitation')
  .get();

// Check resolution logic in template-resolver.ts
```

### Test 17.3 Fails: Revert Doesn't Work

**Symptoms**: Override still appears after revert

**Possible Causes**:
1. Revert action not deleting override document
2. Cache not cleared after revert
3. UI not refreshing after revert

**Solutions**:
```typescript
// Force page reload after revert
await page.reload();

// Clear cache
await page.evaluate(() => localStorage.clear());

// Verify deletion
const deleted = await db.collection('message_templates').doc(overrideId).get();
console.log('Override exists:', deleted.exists);
```

### Test 17.4 Fails: Non-Meeting Templates Shown

**Symptoms**: Composer shows templates from other categories

**Possible Causes**:
1. Context parameter not passed correctly
2. Template filtering not implemented
3. Category field missing on templates

**Solutions**:
```typescript
// Verify URL includes context
expect(page.url()).toContain('context=meeting');

// Check ComposerWizard filtering logic
const query = query(
  collection(firestore, 'message_templates'),
  where('category', '==', composerContext?.category)
);

// Verify template categories
await db.collection('message_templates').get().then(snapshot => {
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data().category);
  });
});
```

### Test 17.5 Fails: Reminders Not Scheduled

**Symptoms**: No scheduled messages created after meeting creation

**Possible Causes**:
1. Reminder scheduling logic not triggered
2. Meeting time in the past
3. Reminder configuration not saved

**Solutions**:
```typescript
// Verify meeting time is in future
const meetingTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
console.log('Meeting time:', meetingTime.toISOString());

// Check reminder configuration
const meeting = await db.collection('meetings').doc(meetingId).get();
console.log('Reminders enabled:', meeting.data().remindersEnabled);

// Verify scheduled messages created
const scheduled = await db.collection('scheduled_messages')
  .where('sourceEventId', '==', meetingId)
  .get();
console.log('Scheduled count:', scheduled.size);
```

## Common Issues

### Authentication Failures

**Issue**: Tests fail at login step

**Solutions**:
1. Verify test account credentials in `.env.test`
2. Check Firebase Auth is enabled
3. Ensure test accounts exist in Firebase Console
4. Verify email/password auth provider is enabled

### Timeout Errors

**Issue**: Tests timeout waiting for elements

**Solutions**:
1. Increase timeout: `{ timeout: 10000 }`
2. Check if dev server is running: `pnpm dev`
3. Verify element selectors are correct
4. Add explicit waits: `await page.waitForLoadState('networkidle')`

### Flaky Tests

**Issue**: Tests pass sometimes, fail other times

**Solutions**:
1. Add explicit waits for async operations
2. Use `waitForTimeout` after Firestore writes
3. Check for race conditions in UI updates
4. Increase retry count in CI: `retries: 2`

### Data Isolation Issues

**Issue**: Tests interfere with each other

**Solutions**:
1. Use unique identifiers: `Date.now()` in names
2. Run tests sequentially: `fullyParallel: false`
3. Implement proper cleanup in each test
4. Use Firebase emulators for isolation

## Best Practices

### 1. Stable Selectors

Use data-testid attributes for reliable element selection:

```typescript
// Good
await page.locator('[data-testid="template-card"]').click();

// Avoid
await page.locator('.card-123').click();
```

### 2. Explicit Waits

Always wait for async operations:

```typescript
// After Firestore write
await page.waitForTimeout(1000);

// After navigation
await page.waitForLoadState('networkidle');

// For element visibility
await expect(element).toBeVisible({ timeout: 5000 });
```

### 3. Error Messages

Use descriptive error messages:

```typescript
await expect(templateCard).toBeVisible({
  timeout: 5000,
  message: 'Template card should be visible after creation'
});
```

### 4. Test Independence

Each test should be independent:

```typescript
// Setup
beforeEach(async ({ page }) => {
  await page.goto('/login');
  // ... login logic
});

// Cleanup
afterEach(async ({ page }) => {
  // ... cleanup logic
});
```

### 5. Meaningful Assertions

Assert on meaningful state, not implementation details:

```typescript
// Good - tests behavior
await expect(composerBody).toContain('CUSTOMIZED invitation');

// Avoid - tests implementation
await expect(page.locator('.body-field-123')).toHaveClass('active');
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps
      
      - name: Run E2E tests
        env:
          TEST_SUPER_ADMIN_EMAIL: ${{ secrets.TEST_SUPER_ADMIN_EMAIL }}
          TEST_SUPER_ADMIN_PASSWORD: ${{ secrets.TEST_SUPER_ADMIN_PASSWORD }}
          TEST_ORG_ADMIN_EMAIL: ${{ secrets.TEST_ORG_ADMIN_EMAIL }}
          TEST_ORG_ADMIN_PASSWORD: ${{ secrets.TEST_ORG_ADMIN_PASSWORD }}
        run: pnpm test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Maintenance

### Updating Tests

When UI changes:
1. Update selectors to match new structure
2. Adjust wait times if needed
3. Update assertions for new content
4. Re-run tests to verify

### Adding New Tests

Follow the existing pattern:
1. Add test to `template-management.spec.ts`
2. Include setup, execution, verification, cleanup
3. Add documentation to this guide
4. Update test count in README

### Deprecating Tests

When features change:
1. Mark test as skipped: `test.skip(...)`
2. Add comment explaining why
3. Create new test for updated feature
4. Remove old test after verification

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Firebase Testing Guide](https://firebase.google.com/docs/rules/unit-tests)
- [SmartSapp Template System Design](../../.kiro/specs/messaging-template-customization/design.md)
