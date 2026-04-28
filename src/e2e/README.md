# E2E Testing Guide

## Overview

This directory contains end-to-end tests for SmartSapp using Playwright. Tests cover critical user journeys including authentication, template management, and survey workflows.

## Setup

### Prerequisites

1. Install dependencies:
```bash
pnpm install
```

2. Install Playwright browsers:
```bash
pnpm exec playwright install
```

### Test Environment Configuration

Create a `.env.test` file in the project root with test account credentials:

```env
# Super Admin Test Account
TEST_SUPER_ADMIN_EMAIL=superadmin@test.smartsapp.com
TEST_SUPER_ADMIN_PASSWORD=your_secure_password

# Organization Admin Test Account
TEST_ORG_ADMIN_EMAIL=orgadmin@test.smartsapp.com
TEST_ORG_ADMIN_PASSWORD=your_secure_password

# Regular User Test Account
TEST_USER_EMAIL=user@test.smartsapp.com
TEST_USER_PASSWORD=your_secure_password
```

### Firebase Emulator Setup (Optional)

For isolated testing without affecting production data:

```bash
# Start Firebase emulators
firebase emulators:start

# Run tests against emulators
TEST_USE_EMULATOR=true pnpm test:e2e
```

## Running Tests

### Run all E2E tests
```bash
pnpm test:e2e
```

### Run tests with UI
```bash
pnpm test:e2e:ui
```

### Run specific test file
```bash
pnpm exec playwright test src/e2e/template-management.spec.ts
```

### Run tests in headed mode (see browser)
```bash
pnpm exec playwright test --headed
```

### Run tests in debug mode
```bash
pnpm exec playwright test --debug
```

### Run tests in specific browser
```bash
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=firefox
pnpm exec playwright test --project=webkit
```

## Test Files

### `auth.spec.ts`
Tests authentication flows including login, signup, and error handling.

### `survey-loop.spec.ts`
Tests public survey experience and branding display.

### `template-management.spec.ts`
Tests the two-tier template management system:
- **Test 17.1**: Super admin creates global meeting invitation template and verifies it appears in org template list
- **Test 17.2**: Org admin overrides a global template and the override is used in the composer
- **Test 17.3**: Org admin reverts override and global template is restored
- **Test 17.4**: Composer opened from meeting context shows only meeting templates
- **Test 17.5**: Meeting reminder is scheduled and appears in scheduled messages list
- Category filtering in organization template list

### `workspace-creation-industry.spec.ts`
Tests workspace creation with industry selection:
- **Test 30.1.1**: Creating a SaaS workspace shows "Accounts" terminology in sidebar and page title
- **Test 30.1.2**: Creating a SchoolEnrollment workspace shows "Schools" terminology
- **Test 30.1.3**: Industry select is disabled after first entity is linked (scope lock UI)
- **Test 30.1.4**: Workspace filter by industry functionality

### `industry-feature-visibility.spec.ts`
Tests industry-specific feature visibility:
- **Test 30.2.1**: SaaS workspace shows Trials, Subscriptions, Health sidebar items
- **Test 30.2.2**: SaaS workspace does NOT show School Enrollment-specific items
- **Test 30.2.3**: School Enrollment workspace shows Admissions, Enrollments sidebar items
- **Test 30.2.4**: School Enrollment workspace does NOT show SaaS-specific items (Trials, Subscriptions)
- **Test 30.2.5**: Law workspace shows Matters, Intake, Time Tracking sidebar items
- **Test 30.2.6**: Feature-gated panels are hidden for wrong industry

## Test Data Management

### Creating Test Accounts

Before running template management tests, ensure test accounts exist in Firebase:

1. **Super Admin Account**:
   - Email: `superadmin@test.smartsapp.com`
   - Role: Super Admin
   - Permissions: Full system access

2. **Organization Admin Account**:
   - Email: `orgadmin@test.smartsapp.com`
   - Role: Organization Admin
   - Organization: Test Organization
   - Permissions: Organization-level template management

3. **Regular User Account**:
   - Email: `user@test.smartsapp.com`
   - Role: Team Member
   - Permissions: View and use templates

### Test Data Cleanup

Tests should clean up after themselves by deleting created resources. The template management test includes cleanup steps to remove test templates.

## Debugging Failed Tests

### View test report
```bash
pnpm exec playwright show-report
```

### View trace for failed test
Traces are automatically captured on first retry. View them in the HTML report.

### Take screenshots during test
```typescript
await page.screenshot({ path: 'screenshot.png' });
```

### Pause test execution
```typescript
await page.pause();
```

## CI/CD Integration

Tests are configured to run in CI with:
- 2 retries for flaky tests
- Single worker for consistency
- Video recording on first retry
- Trace recording on first retry

## Best Practices

1. **Use data-testid attributes** for stable selectors
2. **Wait for elements** before interacting
3. **Clean up test data** after each test
4. **Use environment variables** for credentials
5. **Test in isolation** - don't depend on other tests
6. **Use meaningful test names** that describe the scenario
7. **Add comments** for complex test logic

## Troubleshooting

### Test times out waiting for element
- Increase timeout: `await expect(element).toBeVisible({ timeout: 10000 })`
- Check if element selector is correct
- Verify element is not hidden by CSS

### Authentication fails
- Verify test account credentials in `.env.test`
- Check if test accounts exist in Firebase
- Ensure Firebase Auth is properly configured

### Template not appearing in list
- Add wait time for Firestore sync: `await page.waitForTimeout(1000)`
- Check Firestore security rules allow read access
- Verify template was created successfully

### Flaky tests
- Add explicit waits for async operations
- Use `waitForLoadState('networkidle')` after navigation
- Increase timeouts for slow operations

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Selectors](https://playwright.dev/docs/selectors)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
