# Test Refactoring - Complete Guide

## 📖 Overview

This guide provides a complete roadmap for refactoring the SmartSapp test suite from a monolithic structure to a modular, feature-based organization.

## 🎯 Goals

1. **Fix all failing tests** - Currently ~30+ tests failing due to Firebase mock issues
2. **Organize tests by feature** - Group related tests for easier maintenance
3. **Improve test performance** - Reduce execution time from 210s+ to <30s per feature
4. **Update to new architecture** - Use entity model instead of legacy schools collection
5. **Enable feature-based testing** - Run tests for specific features independently

## 📁 Documentation Structure

### 1. **IMMEDIATE_ACTION_PLAN.md** ⭐ START HERE
- Step-by-step guide to fix tests TODAY
- Current status and immediate next steps
- Common patterns and quick fixes
- **Read this first to get started**

### 2. **TEST_REFACTORING_PLAN.md**
- Comprehensive 4-week refactoring plan
- Detailed phase breakdown (11 phases)
- Target directory structure
- Success criteria and metrics

### 3. **TEST_REFACTORING_SUMMARY.md**
- Quick reference guide
- NPM scripts reference
- Test execution strategies
- Progress tracking checklist

### 4. **This File (TEST_REFACTORING_README.md)**
- Overview and navigation guide
- Quick start instructions
- Key concepts and tools

## 🚀 Quick Start

### Step 1: Understand the Current State
```bash
# Run all tests to see failures
pnpm test:run

# Output: ~30+ tests failing, mostly Firebase mock issues
```

### Step 2: Fix Contact Adapter Tests (First Priority)
```bash
# Run contact adapter tests
pnpm test:adapter

# Expected: 1 failing, 8 passing
# Issue: Firebase Admin mock not properly structured
```

### Step 3: Use Test Utilities
```typescript
// Import test utilities
import { mockFirebaseAdmin } from '@/test/firebase-test-utils';
import { createTestInstitution } from '@/test/factories/entity-factory';
import { createTestWorkspace } from '@/test/factories/workspace-factory';

// Use in tests
const { mockDb } = mockFirebaseAdmin();
const entity = createTestInstitution();
const workspace = createTestWorkspace('org-id');
```

### Step 4: Run Feature-Specific Tests
```bash
# Contact Adapter
pnpm test:adapter

# Tagging System
pnpm test:tags

# Workspace Management
pnpm test:workspaces

# Messaging System
pnpm test:messaging

# All tests
pnpm test:run
```

## 🛠️ Tools Created

### 1. Firebase Test Utilities
**File**: `src/test/firebase-test-utils.ts`

**Functions**:
- `initializeTestFirebase()` - Initialize Firebase for testing
- `getTestFirestore()` - Get Firestore instance
- `clearFirestoreData()` - Clear all test data
- `seedTestData()` - Seed test data
- `mockFirebaseAdmin()` - Mock Firebase Admin SDK
- `waitForEmulator()` - Wait for emulator to be ready

**Usage**:
```typescript
import { mockFirebaseAdmin } from '@/test/firebase-test-utils';

const { mockDb, mockCollection, mockDoc } = mockFirebaseAdmin();
```

### 2. Entity Factories
**File**: `src/test/factories/entity-factory.ts`

**Functions**:
- `createTestInstitution()` - Create test institution
- `createTestFamily()` - Create test family
- `createTestPerson()` - Create test person
- `createTestWorkspaceEntity()` - Create workspace entity
- `createLegacySchool()` - Create legacy school (for migration tests)

**Usage**:
```typescript
import { createTestInstitution } from '@/test/factories/entity-factory';

const entity = createTestInstitution({
  name: 'Custom Name',
  organizationId: 'test-org',
});
```

### 3. Workspace Factories
**File**: `src/test/factories/workspace-factory.ts`

**Functions**:
- `createTestOrganization()` - Create test organization
- `createTestWorkspace()` - Create test workspace
- `createTestUser()` - Create test user
- `createTestUserWithWorkspaceRoles()` - Create user with RBAC
- `createTestAdminUser()` - Create admin user
- `createTestOrganizationSetup()` - Create complete org setup

**Usage**:
```typescript
import { createTestOrganization, createTestWorkspace } from '@/test/factories/workspace-factory';

const org = createTestOrganization();
const workspace = createTestWorkspace(org.id);
```

### 4. Test Runner Script
**File**: `scripts/test-by-feature.sh`

**Usage**:
```bash
# Run specific feature
./scripts/test-by-feature.sh adapter
./scripts/test-by-feature.sh tags
./scripts/test-by-feature.sh workspaces

# Run all features
./scripts/test-by-feature.sh all
```

## 📊 NPM Scripts Reference

### Feature-Based Testing
```json
{
  "test:feature": "./scripts/test-by-feature.sh",
  "test:adapter": "vitest run src/lib/__tests__/contact-adapter",
  "test:workspaces": "vitest run src/lib/__tests__/workspace",
  "test:tags": "vitest run src/lib/__tests__/tag",
  "test:entities": "vitest run src/lib/__tests__/entity",
  "test:messaging": "vitest run src/lib/__tests__/messaging",
  "test:automation": "vitest run src/lib/__tests__/automation",
  "test:components": "vitest run src/components/__tests__",
  "test:property": "vitest run src/lib/__tests__/**/*.property.test.ts"
}
```

### Watch Mode
```json
{
  "test:watch:adapter": "vitest watch src/lib/__tests__/contact-adapter",
  "test:watch:tags": "vitest watch src/lib/__tests__/tag"
}
```

## 🔧 Common Issues & Solutions

### Issue 1: `adminDb.collection(...).doc is not a function`
**Solution**: Use `mockFirebaseAdmin()` utility
```typescript
import { mockFirebaseAdmin } from '@/test/firebase-test-utils';

const { mockDb } = mockFirebaseAdmin();
vi.mock('@/lib/firebase-admin', () => ({ adminDb: mockDb }));
```

### Issue 2: `adminDb.collection(...).where(...).where is not a function`
**Solution**: Ensure mock returns `this` for chaining
```typescript
const mockCollection = {
  where: vi.fn().mockReturnThis(), // Enable chaining
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn().mockResolvedValue({ docs: [] }),
};
```

### Issue 3: Property tests timing out (30s+)
**Solution**: Reduce iterations
```typescript
fc.assert(
  fc.asyncProperty(/* ... */),
  { numRuns: 10, timeout: 5000 } // Reduced from 100 runs
);
```

### Issue 4: Tests using old `schools` collection
**Solution**: Update to use entity model
```typescript
// Before
const school = { id: 'school-1', name: 'Test School' };

// After
import { createTestInstitution } from '@/test/factories/entity-factory';
const entity = createTestInstitution();
```

## 📈 Implementation Timeline

### Week 1: Core Infrastructure & High-Priority Fixes
- ✅ Day 1: Create test utilities and factories
- ✅ Day 1: Create test runner scripts
- ✅ Day 1: Document refactoring plan
- [ ] Day 2: Fix contact adapter tests
- [ ] Day 3: Fix tag system tests
- [ ] Day 4: Fix workspace tests
- [ ] Day 5: Fix entity tests

### Week 2: Feature Tests
- [ ] Day 1-2: Fix messaging tests
- [ ] Day 3-4: Fix automation tests
- [ ] Day 5: Fix pipeline tests

### Week 3: Remaining Tests
- [ ] Day 1-2: Fix forms & surveys tests
- [ ] Day 3: Fix import/export tests
- [ ] Day 4-5: Fix component tests

### Week 4: Organization & Cleanup
- [ ] Day 1-2: Reorganize into feature directories
- [ ] Day 3: Update CI/CD pipelines
- [ ] Day 4: Documentation updates
- [ ] Day 5: Final verification

## 🎯 Success Metrics

### Immediate (This Week)
- [ ] All contact adapter tests passing (9/9)
- [ ] All tag tests passing
- [ ] All workspace tests passing
- [ ] No Firebase mock errors

### Short-term (2 Weeks)
- [ ] All unit tests passing (100%)
- [ ] Test execution time < 30s per feature
- [ ] Tests use new entity model
- [ ] Tests use workspace-scoped RBAC

### Long-term (4 Weeks)
- [ ] Tests organized by feature
- [ ] CI/CD pipeline configured
- [ ] Documentation complete
- [ ] Team trained on new structure

## 📚 Additional Resources

### Internal Documentation
- `TEST_REFACTORING_PLAN.md` - Detailed 11-phase plan
- `TEST_REFACTORING_SUMMARY.md` - Quick reference
- `IMMEDIATE_ACTION_PLAN.md` - Today's action items

### Code References
- `src/test/firebase-test-utils.ts` - Firebase utilities
- `src/test/factories/` - Test factories
- `src/test/setup.ts` - Test configuration
- `vitest.config.ts` - Vitest configuration

### External Resources
- [Vitest Documentation](https://vitest.dev/)
- [Firebase Testing Guide](https://firebase.google.com/docs/rules/unit-tests)
- [Fast-check Documentation](https://fast-check.dev/)

## 🎬 Next Steps

1. **Read** `IMMEDIATE_ACTION_PLAN.md` for today's tasks
2. **Run** `pnpm test:adapter` to see current state
3. **Fix** the one failing contact adapter test
4. **Move** to tag tests, then workspace tests
5. **Track** progress in `TEST_REFACTORING_SUMMARY.md`

## 💡 Tips

- **Start small**: Fix one feature at a time
- **Use watch mode**: `pnpm test:watch:adapter` for rapid iteration
- **Leverage factories**: Don't create test data manually
- **Mock properly**: Use `mockFirebaseAdmin()` utility
- **Reduce iterations**: Property tests should run fast
- **Update as you go**: Keep documentation current

## 🤝 Getting Help

If you encounter issues:
1. Check the common issues section above
2. Review the test utilities documentation
3. Look at passing tests for examples
4. Consult the refactoring plan for context

---

**Remember**: The goal is not perfection, but progress. Fix tests incrementally, one feature at a time, and the entire suite will be refactored before you know it!

Good luck! 🚀
