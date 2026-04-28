# Industry Security Rules Testing

## Overview

This document describes how to test the Firestore security rules for industry-specific collections.

## Test File

- **Location**: `src/lib/__tests__/industry-security-rules.test.ts`
- **Purpose**: Validates that industry-specific collections enforce proper access control based on workspace industry

## What's Tested

### Industry Collections Covered

1. **SaaS Industry**
   - `trials` collection
   - `onboarding` collection
   - `subscriptions` collection
   - `supportTickets` collection
   - `healthScores` collection

2. **School Enrollment Industry**
   - `applications` collection
   - `enrollments` collection
   - `schoolVisits` collection

3. **Law Industry**
   - `matters` collection
   - `conflictChecks` collection
   - `timeTracking` collection

4. **Marketing Industry**
   - `campaigns` collection
   - `deliverables` collection

5. **Real Estate Industry**
   - `properties` collection
   - `viewings` collection
   - `offers` collection

6. **Consultancy Industry**
   - `engagements` collection
   - `milestones` collection

### Security Rules Validated

✅ **Requirement 10.9**: Collection access is validated based on Workspace Industry_Vertical
✅ **Requirement 16.8**: Read/write operations are gated on both `hasWorkspaceAccess` AND `workspaceIndustryMatches`
✅ **Design Property 3**: Strict data isolation between industries

### Test Scenarios

1. **Positive Access Tests**
   - Users with correct workspace industry can create, read, and update documents
   - Super admins can access all industry collections

2. **Negative Access Tests**
   - SaaS workspace users cannot read Law collections (`matters`)
   - School Enrollment workspace users cannot read SaaS collections (`trials`)
   - Law workspace users cannot read Marketing collections (`campaigns`)
   - And all other cross-industry access attempts are denied

3. **Data Integrity Tests**
   - Users cannot change `workspaceId` in updates (prevents cross-workspace data leakage)
   - Users cannot change `organizationId` in updates

## Running the Tests

### Option 1: Auto-start Emulator (Recommended)

This command automatically starts the Firebase emulator, runs the tests, and stops the emulator:

```bash
pnpm test:emulator
```

### Option 2: Manual Emulator Control

If you need more control or want to run tests multiple times:

**Step 1: Start the Firebase emulator**
```bash
firebase emulators:start --only firestore
```

**Step 2: In a separate terminal, run the tests**
```bash
pnpm test:run src/lib/__tests__/industry-security-rules.test.ts
```

**Step 3: Stop the emulator**
Press `Ctrl+C` in the emulator terminal

### Option 3: Run Specific Test Suites

```bash
# Run only SaaS industry tests
pnpm test:emulator -- --grep "SaaS Industry Collections"

# Run only cross-industry access control tests
pnpm test:emulator -- --grep "Cross-Industry Access Control"
```

## Test Structure

### User Contexts

The tests create the following user contexts:

- **Super Admin**: Has `system_admin` permission, can access all collections
- **SaaS User**: Has `saas_trials_manage` and `finance_manage` permissions, workspace access to SaaS workspace
- **School User**: Has `schoolenrollment_admissions_manage` permission, workspace access to School Enrollment workspace
- **Law User**: Has `law_matters_manage` and `law_conflict_check` permissions, workspace access to Law workspace
- **Marketing User**: Has `marketing_campaigns_manage` permission, workspace access to Marketing workspace
- **Real Estate User**: Has `realestate_properties_manage` and `realestate_viewings_manage` permissions, workspace access to Real Estate workspace
- **Consultancy User**: Has `consultancy_engagements_manage` permission, workspace access to Consultancy workspace

### Workspace Setup

Each test creates workspaces with different industries:

- `saas-workspace-1` → `industry: 'SaaS'`
- `school-workspace-1` → `industry: 'SchoolEnrollment'`
- `law-workspace-1` → `industry: 'Law'`
- `marketing-workspace-1` → `industry: 'Marketing'`
- `realestate-workspace-1` → `industry: 'RealEstate'`
- `consultancy-workspace-1` → `industry: 'Consultancy'`

## Expected Results

All 28 tests should pass when the emulator is running:

```
✓ Industry-Specific Collection Security Rules (28 tests)
  ✓ SaaS Industry Collections (6 tests)
  ✓ School Enrollment Industry Collections (6 tests)
  ✓ Law Industry Collections (5 tests)
  ✓ Marketing Industry Collections (2 tests)
  ✓ Real Estate Industry Collections (2 tests)
  ✓ Consultancy Industry Collections (2 tests)
  ✓ Cross-Industry Access Control (2 tests)
```

## Troubleshooting

### Error: "fetch failed"

**Cause**: Firebase emulator is not running

**Solution**: Use `pnpm test:emulator` instead of `pnpm test:run`

### Error: "ECONNREFUSED 127.0.0.1:8080"

**Cause**: Firestore emulator is not accessible on port 8080

**Solution**: 
1. Check if another process is using port 8080: `lsof -i :8080`
2. Kill the process if needed: `kill -9 <PID>`
3. Restart the emulator: `firebase emulators:start --only firestore`

### Error: "Permission denied"

**Cause**: Security rules are working correctly! This error in tests means the rules are blocking unauthorized access.

**Solution**: Check that the test is using `assertFails()` for this scenario, not `assertSucceeds()`

## CI/CD Integration

For continuous integration, use the `test:emulator` script:

```yaml
# Example GitHub Actions workflow
- name: Run Firestore Security Rules Tests
  run: pnpm test:emulator
```

This ensures the emulator is started and stopped automatically.

## Related Files

- **Security Rules**: `firestore.rules`
- **Test File**: `src/lib/__tests__/industry-security-rules.test.ts`
- **Emulator Config**: `firebase.json`
- **Package Scripts**: `package.json` (see `test:emulator` script)

## Next Steps

After all tests pass:

1. Deploy the updated security rules to Firebase:
   ```bash
   firebase deploy --only firestore:rules
   ```

2. Verify rules in production using Firebase Console → Firestore → Rules tab

3. Monitor rule violations in Firebase Console → Firestore → Usage tab
