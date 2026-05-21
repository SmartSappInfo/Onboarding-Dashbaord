# Immediate Action Plan - Test Refactoring

## 🎯 Current Status

### ✅ Completed
1. Created test infrastructure:
   - `src/test/firebase-test-utils.ts` - Firebase mocking utilities
   - `src/test/factories/entity-factory.ts` - Entity test factories
   - `src/test/factories/workspace-factory.ts` - Workspace test factories
2. Created test runner script: `scripts/test-by-feature.sh`
3. Added NPM scripts for feature-based testing
4. Created comprehensive refactoring plan: `TEST_REFACTORING_PLAN.md`

### 📊 Test Results Summary
- **Total Test Files**: 100+
- **Contact Adapter Tests**: 1 failed, 8 passed
- **Main Issue**: Firebase Admin mock not properly structured

## 🔥 Immediate Fix Required

### Issue: Contact Adapter Test Failure
**File**: `src/lib/__tests__/contact-adapter-new-methods.test.ts`
**Test**: "should return true when school exists"
**Error**: `adminDb.collection(...).doc is not a function`

**Root Cause**: The mock structure doesn't properly chain `.collection().doc().get()`

**Solution**: Use the `mockFirebaseAdmin()` utility from `firebase-test-utils.ts`

## 📋 Step-by-Step Implementation Plan

### Phase 1: Fix Contact Adapter Tests (TODAY)
**Time Estimate**: 1-2 hours

#### Step 1.1: Fix `contact-adapter-new-methods.test.ts`
```typescript
// Replace manual mocking with utility
import { mockFirebaseAdmin } from '@/test/firebase-test-utils';

beforeEach(() => {
  const { mockDb, mockDoc, mockCollection } = mockFirebaseAdmin();
  
  // Configure mock responses
  mockDoc.get.mockResolvedValue({
    exists: true,
    data: () => ({ /* test data */ }),
  });
  
  vi.mock('@/lib/firebase-admin', () => ({
    adminDb: mockDb,
  }));
});
```

#### Step 1.2: Remove Duplicate Keys
Fix duplicate `entityContacts` keys in test objects (lines 57, 130, 253, 312)

#### Step 1.3: Run Tests
```bash
pnpm test:adapter
```

**Expected Result**: All 9 tests passing

---

### Phase 2: Fix Tag System Tests (NEXT)
**Time Estimate**: 2-3 hours

#### Issues to Fix:
1. `adminDb.collection(...).where(...).where is not a function`
2. Property-based tests timing out (30s+)
3. Update to workspace-scoped queries

#### Files to Update:
- `src/lib/__tests__/tag-actions.test.ts`
- `src/lib/__tests__/tag-actions.property.test.ts`
- `src/lib/__tests__/workspace-tag-filtering.test.ts`

#### Step 2.1: Fix Query Chaining
```typescript
const mockCollection = {
  where: vi.fn().mockReturnThis(), // Return this for chaining
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn().mockResolvedValue({
    docs: [],
    empty: true,
  }),
};
```

#### Step 2.2: Reduce Property Test Iterations
```typescript
// In property tests, reduce iterations for speed
fc.assert(
  fc.asyncProperty(/* ... */),
  { numRuns: 10 } // Instead of 100
);
```

#### Step 2.3: Run Tests
```bash
pnpm test:tags
```

---

### Phase 3: Fix Messaging Tests
**Time Estimate**: 2-3 hours

#### Issues to Fix:
1. Sequential scheduler emulator connection errors
2. Tests using old `schools` collection
3. Contact adapter resolution failures

#### Files to Update:
- `src/lib/__tests__/sequential-scheduler.test.ts`
- `src/lib/__tests__/sequential-scheduler-invocation-count.property.test.ts`
- `src/lib/__tests__/sequential-execution-order.property.test.ts`

#### Step 3.1: Mock Contact Adapter
```typescript
import { createTestInstitution } from '@/test/factories/entity-factory';

vi.mock('@/lib/contact-adapter', () => ({
  resolveContactFromEntity: vi.fn().mockResolvedValue(
    createTestInstitution()
  ),
}));
```

#### Step 3.2: Run Tests
```bash
pnpm test:messaging
```

---

### Phase 4: Fix Remaining High-Priority Tests
**Time Estimate**: 3-4 hours

#### 4.1 Workspace Tests
```bash
pnpm test:workspaces
```

#### 4.2 Entity Tests
```bash
pnpm test:entities
```

#### 4.3 Automation Tests
```bash
pnpm test:automation
```

---

## 🚀 Quick Start Guide

### Option A: Fix Tests Incrementally (Recommended)

```bash
# 1. Fix contact adapter tests
pnpm test:adapter

# 2. Fix tag tests
pnpm test:tags

# 3. Fix messaging tests
pnpm test:messaging

# 4. Fix workspace tests
pnpm test:workspaces

# 5. Run all tests
pnpm test:run
```

### Option B: Run All Tests and Fix Failures

```bash
# Run all tests (will show all failures)
pnpm test:run

# Fix failures one by one using test:watch
pnpm test:watch:adapter
```

---

## 📝 Common Patterns for Fixes

### Pattern 1: Mock Firebase Admin
```typescript
import { mockFirebaseAdmin } from '@/test/firebase-test-utils';

describe('My Test Suite', () => {
  let mockDb: any;
  
  beforeEach(() => {
    const mocks = mockFirebaseAdmin();
    mockDb = mocks.mockDb;
    
    vi.mock('@/lib/firebase-admin', () => ({
      adminDb: mockDb,
    }));
  });
  
  it('should work', async () => {
    // Test code
  });
});
```

### Pattern 2: Use Entity Factories
```typescript
import { 
  createTestInstitution,
  createTestWorkspaceEntity 
} from '@/test/factories/entity-factory';

const entity = createTestInstitution({
  organizationId: 'test-org',
  name: 'Custom Name',
});

const workspaceEntity = createTestWorkspaceEntity(
  entity.id,
  'test-workspace',
  { status: 'Active' }
);
```

### Pattern 3: Mock Contact Adapter
```typescript
import { createTestInstitution } from '@/test/factories/entity-factory';

vi.mock('@/lib/contact-adapter', () => ({
  resolveContactFromEntity: vi.fn().mockResolvedValue(
    createTestInstitution()
  ),
  contactExists: vi.fn().mockResolvedValue(true),
}));
```

### Pattern 4: Reduce Property Test Iterations
```typescript
import fc from 'fast-check';

// Before (slow)
fc.assert(fc.asyncProperty(/* ... */));

// After (fast)
fc.assert(
  fc.asyncProperty(/* ... */),
  { numRuns: 10, timeout: 5000 }
);
```

---

## 🎯 Success Criteria

### Phase 1 Complete When:
- ✅ All contact adapter tests passing (9/9)
- ✅ No Firebase mock errors
- ✅ Tests run in < 10 seconds

### Phase 2 Complete When:
- ✅ All tag tests passing
- ✅ Property tests complete in < 30 seconds
- ✅ No query chaining errors

### Phase 3 Complete When:
- ✅ All messaging tests passing
- ✅ No emulator connection errors
- ✅ Tests use entity model

### All Phases Complete When:
- ✅ `pnpm test:run` passes 100%
- ✅ Total test time < 5 minutes
- ✅ No deprecated patterns
- ✅ All tests use new entity model
- ✅ All tests use workspace-scoped RBAC

---

## 📊 Progress Tracking

### Today's Goals
- [x] Create test infrastructure
- [x] Create test factories
- [x] Create test runner scripts
- [x] Document refactoring plan
- [ ] Fix contact adapter tests (1 failing)
- [ ] Fix tag system tests
- [ ] Fix messaging tests

### This Week's Goals
- [ ] All unit tests passing
- [ ] All property tests passing
- [ ] Tests organized by feature
- [ ] CI/CD pipeline updated

---

## 🔧 Tools & Commands

### Run Specific Test File
```bash
pnpm vitest run src/lib/__tests__/contact-adapter-new-methods.test.ts
```

### Watch Specific Test
```bash
pnpm vitest watch src/lib/__tests__/contact-adapter-new-methods.test.ts
```

### Run Tests Matching Pattern
```bash
pnpm vitest run --grep "contactExists"
```

### Run Tests with Coverage
```bash
pnpm vitest run --coverage
```

---

## 📚 Resources

- **Main Plan**: `TEST_REFACTORING_PLAN.md`
- **Summary**: `TEST_REFACTORING_SUMMARY.md`
- **This Document**: `IMMEDIATE_ACTION_PLAN.md`
- **Test Utilities**: `src/test/firebase-test-utils.ts`
- **Entity Factories**: `src/test/factories/entity-factory.ts`
- **Workspace Factories**: `src/test/factories/workspace-factory.ts`

---

## 🎬 Next Action

**START HERE**: Fix the one failing contact adapter test

```bash
# Open the test file
code src/lib/__tests__/contact-adapter-new-methods.test.ts

# Run in watch mode
pnpm vitest watch src/lib/__tests__/contact-adapter-new-methods.test.ts

# Fix the mock structure using mockFirebaseAdmin()
# Remove duplicate entityContacts keys
# Verify all 9 tests pass
```

Once this is done, move to Phase 2 (Tag Tests).
