# Industry-Scoped Entity Expansion - E2E Tests

## Overview

This document describes the end-to-end tests for the industry-scoped entity expansion feature. These tests verify that workspace creation, industry selection, terminology mapping, and feature visibility work correctly across different industry verticals.

## Test Files

### 1. `workspace-creation-industry.spec.ts`

Tests the workspace creation flow with industry selection and scope locking.

#### Test Cases

**Test 30.1.1: Create SaaS Workspace with "Accounts" Terminology**
- **Purpose**: Verify that creating a SaaS workspace displays "Accounts" terminology in sidebar and page titles
- **Steps**:
  1. Login as organization admin
  2. Navigate to workspace settings
  3. Click "New Workspace"
  4. Fill in workspace name and description
  5. Select "SaaS" industry
  6. Select "institution" contact scope
  7. Confirm workspace creation
  8. Navigate to the new workspace
  9. Verify "Accounts" appears in sidebar
  10. Verify "Accounts" appears in page title
  11. Verify SaaS-specific sidebar items (Trials, Subscriptions, Health)
- **Requirements**: 13.1-13.6, 19.1-19.6

**Test 30.1.2: Create School Enrollment Workspace with "Schools" Terminology**
- **Purpose**: Verify that creating a School Enrollment workspace displays "Schools" terminology
- **Steps**:
  1. Login as organization admin
  2. Navigate to workspace settings
  3. Click "New Workspace"
  4. Fill in workspace name and description
  5. Select "School Enrollment" industry
  6. Select "institution" contact scope
  7. Confirm workspace creation
  8. Navigate to the new workspace
  9. Verify "Schools" appears in sidebar
  10. Verify "Schools" appears in page title
  11. Verify School Enrollment-specific sidebar items (Admissions, Enrollments)
  12. Verify SaaS-specific items are NOT present
- **Requirements**: 13.1-13.6, 19.1-19.6

**Test 30.1.3: Industry Scope Lock After Entity Creation**
- **Purpose**: Verify that industry selection is disabled after first entity is linked
- **Steps**:
  1. Login as organization admin
  2. Create a new workspace with SaaS industry
  3. Navigate to the workspace
  4. Create an entity (triggers scope lock)
  5. Navigate back to workspace settings
  6. Click edit on the workspace
  7. Verify "Industry Locked" indicator is present
  8. Verify lock icon is visible
  9. Verify industry selection buttons are not present
  10. Verify informational message about scope lock
- **Requirements**: 2.2, 2.3, 19.1-19.6

**Test 30.1.4: Filter Workspaces by Industry**
- **Purpose**: Verify that workspace list can be filtered by industry
- **Steps**:
  1. Login as organization admin
  2. Navigate to workspace settings
  3. Verify industry filter dropdown is present
  4. Select "SaaS" filter
  5. Verify only SaaS workspaces are shown
- **Requirements**: 19.1-19.6

### 2. `industry-feature-visibility.spec.ts`

Tests that industry-specific features are only visible in the correct workspaces.

#### Test Cases

**Test 30.2.1: SaaS Workspace Shows SaaS-Specific Sidebar Items**
- **Purpose**: Verify SaaS workspace displays Trials, Subscriptions, Health sidebar items
- **Steps**:
  1. Login as organization admin
  2. Navigate to SaaS workspace
  3. Verify "Accounts" sidebar item is visible
  4. Verify "Users" sidebar item is visible
  5. Verify "Trials" sidebar item is visible
  6. Verify "Subscriptions" sidebar item is visible
  7. Verify "Health" sidebar item is visible
  8. Verify "Support" sidebar item is visible
- **Requirements**: 15.7, 17.1-17.6

**Test 30.2.2: SaaS Workspace Hides School Enrollment Items**
- **Purpose**: Verify SaaS workspace does NOT show School Enrollment-specific items
- **Steps**:
  1. Login as organization admin
  2. Navigate to SaaS workspace
  3. Verify "Admissions" sidebar item is NOT visible
  4. Verify "Enrollments" sidebar item is NOT visible
  5. Verify "School Visits" sidebar item is NOT visible
- **Requirements**: 15.7, 17.1-17.6

**Test 30.2.3: SaaS Workspace Hides Law Items**
- **Purpose**: Verify SaaS workspace does NOT show Law-specific items
- **Steps**:
  1. Login as organization admin
  2. Navigate to SaaS workspace
  3. Verify "Matters" sidebar item is NOT visible
  4. Verify "Intake" sidebar item is NOT visible
  5. Verify "Consultations" sidebar item is NOT visible
  6. Verify "Time Tracking" sidebar item is NOT visible
- **Requirements**: 15.7, 17.1-17.6

**Test 30.2.4: School Enrollment Workspace Shows School-Specific Items**
- **Purpose**: Verify School Enrollment workspace displays Admissions, Enrollments sidebar items
- **Steps**:
  1. Login as organization admin
  2. Navigate to School Enrollment workspace
  3. Verify "Schools" sidebar item is visible
  4. Verify "Families" sidebar item is visible
  5. Verify "Pipeline" sidebar item is visible
  6. Verify "Admissions" sidebar item is visible
  7. Verify "Enrollments" sidebar item is visible
- **Requirements**: 15.7, 17.1-17.6

**Test 30.2.5: School Enrollment Workspace Hides SaaS Items**
- **Purpose**: Verify School Enrollment workspace does NOT show SaaS-specific items
- **Steps**:
  1. Login as organization admin
  2. Navigate to School Enrollment workspace
  3. Verify "Trials" sidebar item is NOT visible
  4. Verify "Subscriptions" sidebar item is NOT visible
  5. Verify "Health" sidebar item is NOT visible
- **Requirements**: 15.7, 17.1-17.6

**Test 30.2.6: Law Workspace Shows Law-Specific Items**
- **Purpose**: Verify Law workspace displays Matters, Intake, Time Tracking sidebar items
- **Steps**:
  1. Login as organization admin
  2. Navigate to Law workspace
  3. Verify "Clients" sidebar item is visible
  4. Verify "Matters" sidebar item is visible
  5. Verify "Intake" sidebar item is visible
  6. Verify "Consultations" sidebar item is visible
  7. Verify "Deadlines" sidebar item is visible
  8. Verify "Time Tracking" sidebar item is visible
- **Requirements**: 15.7, 17.1-17.6

**Test 30.2.7: Feature-Gated Panels Hidden for Wrong Industry**
- **Purpose**: Verify feature-gated UI components are hidden in wrong industry workspaces
- **Steps**:
  1. Login as organization admin
  2. Navigate to School Enrollment workspace
  3. Navigate to entities page
  4. Verify trial-related UI elements are NOT present
  5. Navigate to SaaS workspace
  6. Navigate to accounts page
  7. Verify admissions-related UI elements are NOT present
- **Requirements**: 15.7, 15.8

## Running the Tests

### Prerequisites

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Install Playwright browsers**:
   ```bash
   pnpm exec playwright install
   ```

3. **Configure test environment**:
   - Copy `.env.test.example` to `.env.test`
   - Fill in test account credentials

### Run All Industry E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run only industry-related tests
pnpm exec playwright test src/e2e/workspace-creation-industry.spec.ts
pnpm exec playwright test src/e2e/industry-feature-visibility.spec.ts

# Run with UI
pnpm exec playwright test src/e2e/workspace-creation-industry.spec.ts --ui
pnpm exec playwright test src/e2e/industry-feature-visibility.spec.ts --ui

# Run in headed mode (see browser)
pnpm exec playwright test src/e2e/workspace-creation-industry.spec.ts --headed

# Run in debug mode
pnpm exec playwright test src/e2e/workspace-creation-industry.spec.ts --debug
```

### Run Specific Test

```bash
# Run a specific test by name
pnpm exec playwright test -g "should create a SaaS workspace"
pnpm exec playwright test -g "should show SaaS-specific sidebar items"
```

## Test Data Requirements

### Test Accounts

The tests require the following test accounts to be set up in Firebase:

1. **Organization Admin Account**:
   - Email: `orgadmin@test.smartsapp.com` (or as configured in `.env.test`)
   - Role: Organization Admin
   - Permissions: Create and manage workspaces

### Test Workspaces

The tests will create workspaces dynamically during test execution. If workspaces already exist, the tests will use them.

Expected workspaces:
- SaaS workspace (created by tests)
- School Enrollment workspace (created by tests)
- Law workspace (created by tests)

## Test Cleanup

The tests create workspaces during execution. To clean up test data:

1. **Manual cleanup**:
   - Navigate to `/admin/settings`
   - Delete test workspaces created during test runs

2. **Automated cleanup** (future enhancement):
   - Add `afterAll` hooks to delete created workspaces
   - Use Firebase Admin SDK to clean up test data

## Debugging Failed Tests

### View Test Report

```bash
pnpm exec playwright show-report
```

### View Trace for Failed Test

Traces are automatically captured on first retry. View them in the HTML report.

### Take Screenshots During Test

Add to test code:
```typescript
await page.screenshot({ path: 'screenshot.png' });
```

### Pause Test Execution

Add to test code:
```typescript
await page.pause();
```

## Common Issues

### Issue: Test times out waiting for workspace creation
**Cause**: Firestore write latency or network issues
**Solution**: Increase timeout in test or add explicit wait after workspace creation

### Issue: Sidebar items not visible
**Cause**: Industry context not loaded or workspace not properly selected
**Solution**: Add explicit wait for sidebar to render, verify workspace is active

### Issue: Industry selection buttons not found
**Cause**: UI structure changed or selectors are incorrect
**Solution**: Update selectors to match current UI structure

### Issue: Scope lock not triggered
**Cause**: Entity creation failed or scope lock logic not executed
**Solution**: Verify entity creation succeeds, check `industryScopeLocked` field in Firestore

## CI/CD Integration

These tests are configured to run in CI with:
- 2 retries for flaky tests
- Single worker for consistency
- Video recording on first retry
- Trace recording on first retry

## Best Practices

1. **Use data-testid attributes** for stable selectors in production code
2. **Wait for elements** before interacting (use `waitForLoadState`, `waitForTimeout`)
3. **Clean up test data** after each test (future enhancement)
4. **Use environment variables** for credentials
5. **Test in isolation** - don't depend on other tests
6. **Use meaningful test names** that describe the scenario
7. **Add comments** for complex test logic

## Future Enhancements

1. **Automated test data cleanup**: Add hooks to delete created workspaces
2. **Firebase emulator support**: Run tests against emulators for isolation
3. **Visual regression testing**: Add screenshot comparison for UI consistency
4. **Performance testing**: Measure page load times and interaction latency
5. **Accessibility testing**: Add a11y checks for industry-specific UI
6. **Cross-browser testing**: Expand coverage to Firefox, Safari, Edge
7. **Mobile testing**: Add tests for mobile viewport sizes

## Related Documentation

- [E2E Testing Guide](./README.md)
- [Playwright Documentation](https://playwright.dev/)
- [Industry Configuration](../../lib/industry-config.ts)
- [Industry Context](../../context/IndustryContext.tsx)
- [Workspace Editor Component](../../app/admin/settings/components/WorkspaceEditor.tsx)
