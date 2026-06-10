# Test Refactoring Plan - Feature-Based Organization

## Overview
Refactor 100+ test files into modular, feature-based test suites that can be run independently. Fix Firebase emulator connection issues and update tests to match current codebase architecture.

## Current Issues Identified

### 1. Firebase Emulator Connection Errors
- **Error**: `adminDb.collection(...).doc is not a function`
- **Error**: `adminDb.collection(...).where(...).where is not a function`
- **Root Cause**: Tests are not properly mocking Firebase Admin SDK or connecting to emulator
- **Impact**: ~30+ tests failing

### 2. Test Organization Issues
- Tests scattered across multiple directories
- No clear feature boundaries
- Running all tests takes too long (210+ seconds for some suites)
- Console output overflow

### 3. Deprecated Test Patterns
- Tests using old `schools` collection instead of `entities` + `workspace_entities`
- Tests not accounting for workspace-scoped RBAC
- Tests using legacy contact adapter methods

## Feature-Based Test Organization

### Phase 1: Core Infrastructure Tests (Priority: HIGH)
**Directory**: `src/lib/__tests__/01-core/`

#### 1.1 Firebase & Database
- `firebase-admin.test.ts` - Admin SDK initialization
- `firestore-emulator.test.ts` - Emulator connection
- `firestore-queries.test.ts` - Basic query operations

#### 1.2 Authentication & Authorization
- `auth-context.test.ts` - User authentication
- `rbac-permissions.test.ts` - Role-based access control
- `workspace-permissions.test.ts` - Workspace access control

#### 1.3 Type System
- `typescript-types.test.ts` - Type definitions
- `type-guards.test.ts` - Runtime type checking

**Run Command**: `pnpm test src/lib/__tests__/01-core`

---

### Phase 2: Entity Management Tests (Priority: HIGH)
**Directory**: `src/lib/__tests__/02-entities/`

#### 2.1 Entity CRUD
- `entity-create.test.ts` - Entity creation
- `entity-read.test.ts` - Entity retrieval
- `entity-update.test.ts` - Entity updates
- `entity-delete.test.ts` - Entity deletion

#### 2.2 Entity Types
- `institution-entity.test.ts` - Institution-specific logic
- `family-entity.test.ts` - Family-specific logic
- `person-entity.test.ts` - Person-specific logic

#### 2.3 Entity Migration
- `entity-migration.test.ts` - Schools → Entities migration
- `contact-adapter.test.ts` - Legacy adapter layer
- `dual-write.test.ts` - Dual-write patterns

#### 2.4 Entity Security
- `entity-security.test.ts` - Entity access control
- `entity-workspace-isolation.test.ts` - Workspace boundaries

**Run Command**: `pnpm test src/lib/__tests__/02-entities`

---

### Phase 3: Workspace Management Tests (Priority: HIGH)
**Directory**: `src/lib/__tests__/03-workspaces/`

#### 3.1 Workspace CRUD
- `workspace-create.test.ts`
- `workspace-read.test.ts`
- `workspace-update.test.ts`
- `workspace-delete.test.ts`

#### 3.2 Workspace Features
- `workspace-rbac.test.ts` - Workspace-scoped roles
- `workspace-entities.test.ts` - Entity associations
- `workspace-tags.test.ts` - Workspace tag scoping
- `workspace-isolation.test.ts` - Data isolation

#### 3.3 Industry Verticals
- `industry-features.test.ts` - Industry-specific features
- `industry-validation.test.ts` - Industry data validation
- `feature-gates.test.ts` - Feature gating by industry

**Run Command**: `pnpm test src/lib/__tests__/03-workspaces`

---

### Phase 4: Tagging System Tests (Priority: MEDIUM)
**Directory**: `src/lib/__tests__/04-tags/`

#### 4.1 Tag Operations
- `tag-create.test.ts`
- `tag-assign.test.ts`
- `tag-remove.test.ts`
- `tag-bulk-operations.test.ts`

#### 4.2 Tag Scoping
- `global-tags.test.ts` - Cross-workspace tags
- `workspace-tags.test.ts` - Workspace-scoped tags
- `tag-filtering.test.ts` - Tag-based queries

#### 4.3 Tag Performance
- `tag-query-performance.test.ts`
- `tag-indexing.test.ts`

**Run Command**: `pnpm test src/lib/__tests__/04-tags`

---

### Phase 5: Pipeline & Stage Management (Priority: MEDIUM)
**Directory**: `src/lib/__tests__/05-pipelines/`

#### 5.1 Pipeline Operations
- `pipeline-create.test.ts`
- `pipeline-stages.test.ts`
- `pipeline-defaults.test.ts` - Industry-specific defaults

#### 5.2 Stage Transitions
- `stage-change.test.ts`
- `stage-automation.test.ts`
- `stage-validation.test.ts`

#### 5.3 Pipeline Security
- `pipeline-workspace-isolation.test.ts`
- `pipeline-permissions.test.ts`

**Run Command**: `pnpm test src/lib/__tests__/05-pipelines`

---

### Phase 6: Messaging System Tests (Priority: MEDIUM)
**Directory**: `src/lib/__tests__/06-messaging/`

#### 6.1 Message Composition
- `message-composer.test.ts`
- `message-templates.test.ts`
- `template-variables.test.ts`

#### 6.2 Message Delivery
- `sequential-scheduler.test.ts`
- `bulk-messaging.test.ts`
- `message-delivery.test.ts`

#### 6.3 Message Tracking
- `message-logs.test.ts`
- `webhook-handlers.test.ts`
- `delivery-status.test.ts`

#### 6.4 Email Verification
- `email-verification.test.ts`
- `email-hygiene.test.ts`

**Run Command**: `pnpm test src/lib/__tests__/06-messaging`

---

### Phase 7: Automation System Tests (Priority: MEDIUM)
**Directory**: `src/lib/__tests__/07-automation/`

#### 7.1 Automation Engine
- `automation-create.test.ts`
- `automation-triggers.test.ts`
- `automation-actions.test.ts`

#### 7.2 Automation Execution
- `automation-processor.test.ts`
- `automation-jobs.test.ts`
- `automation-logs.test.ts`

#### 7.3 Tag-Based Automation
- `tag-automation.test.ts`
- `tag-triggers.test.ts`

**Run Command**: `pnpm test src/lib/__tests__/07-automation`

---

### Phase 8: Forms & Surveys Tests (Priority: LOW)
**Directory**: `src/lib/__tests__/08-forms/`

#### 8.1 Survey Management
- `survey-create.test.ts`
- `survey-publish.test.ts`
- `survey-responses.test.ts`

#### 8.2 PDF Forms
- `pdf-create.test.ts`
- `pdf-submissions.test.ts`

#### 8.3 Dynamic Variables
- `dynamic-variables.test.ts`
- `variable-resolution.test.ts`

**Run Command**: `pnpm test src/lib/__tests__/08-forms`

---

### Phase 9: Import/Export Tests (Priority: LOW)
**Directory**: `src/lib/__tests__/09-import-export/`

#### 9.1 Import Operations
- `csv-import.test.ts`
- `import-validation.test.ts`
- `import-deduplication.test.ts`

#### 9.2 Export Operations
- `csv-export.test.ts`
- `export-filtering.test.ts`

#### 9.3 Data Transformation
- `data-cleaner.test.ts`
- `data-normalization.test.ts`

**Run Command**: `pnpm test src/lib/__tests__/09-import-export`

---

### Phase 10: UI Component Tests (Priority: LOW)
**Directory**: `src/components/__tests__/`

#### 10.1 Core Components
- `app-sidebar.test.tsx`
- `workspace-switcher.test.tsx`
- `contact-display.test.tsx`

#### 10.2 Form Components
- `composer-wizard.test.tsx`
- `entity-selector.test.tsx`
- `variable-picker.test.tsx`

#### 10.3 UI Primitives
- `badge.test.tsx`
- `button.test.tsx`
- `dialog.test.tsx`

**Run Command**: `pnpm test src/components/__tests__`

---

### Phase 11: Property-Based Tests (Priority: LOW)
**Directory**: `src/lib/__tests__/11-property/`

#### 11.1 Data Integrity
- `workspace-isolation.property.test.ts`
- `entity-security.property.test.ts`
- `identifier-preservation.property.test.ts`

#### 11.2 Performance
- `query-performance.property.test.ts`
- `tag-performance.property.test.ts`

#### 11.3 Consistency
- `denormalization.property.test.ts`
- `dual-write.property.test.ts`

**Run Command**: `pnpm test src/lib/__tests__/11-property`

---

## Implementation Strategy

### Step 1: Setup Test Infrastructure (Week 1)
1. Create Firebase emulator test utilities
2. Create shared test fixtures and factories
3. Setup test database seeding
4. Create mock factories for common objects

### Step 2: Refactor Core Tests (Week 1-2)
1. Phase 1: Core Infrastructure
2. Phase 2: Entity Management
3. Phase 3: Workspace Management

### Step 3: Refactor Feature Tests (Week 2-3)
1. Phase 4: Tagging System
2. Phase 5: Pipeline Management
3. Phase 6: Messaging System
4. Phase 7: Automation System

### Step 4: Refactor Remaining Tests (Week 3-4)
1. Phase 8: Forms & Surveys
2. Phase 9: Import/Export
3. Phase 10: UI Components
4. Phase 11: Property-Based Tests

### Step 5: Cleanup & Documentation (Week 4)
1. Remove deprecated tests
2. Update test documentation
3. Create test running scripts
4. Setup CI/CD test pipelines

---

## Test Utilities to Create

### 1. Firebase Test Utilities
```typescript
// src/test/utils/firebase-test-utils.ts
export const setupFirebaseEmulator = () => { ... }
export const clearFirestoreData = () => { ... }
export const seedTestData = () => { ... }
```

### 2. Entity Factories
```typescript
// src/test/factories/entity-factory.ts
export const createTestInstitution = () => { ... }
export const createTestFamily = () => { ... }
export const createTestPerson = () => { ... }
```

### 3. Workspace Factories
```typescript
// src/test/factories/workspace-factory.ts
export const createTestWorkspace = () => { ... }
export const createTestOrganization = () => { ... }
```

### 4. Mock Factories
```typescript
// src/test/mocks/firebase-admin-mock.ts
export const mockAdminDb = () => { ... }
export const mockAuth = () => { ... }
```

---

## NPM Scripts to Add

```json
{
  "scripts": {
    "test:core": "vitest run src/lib/__tests__/01-core",
    "test:entities": "vitest run src/lib/__tests__/02-entities",
    "test:workspaces": "vitest run src/lib/__tests__/03-workspaces",
    "test:tags": "vitest run src/lib/__tests__/04-tags",
    "test:pipelines": "vitest run src/lib/__tests__/05-pipelines",
    "test:messaging": "vitest run src/lib/__tests__/06-messaging",
    "test:automation": "vitest run src/lib/__tests__/07-automation",
    "test:forms": "vitest run src/lib/__tests__/08-forms",
    "test:import-export": "vitest run src/lib/__tests__/09-import-export",
    "test:components": "vitest run src/components/__tests__",
    "test:property": "vitest run src/lib/__tests__/11-property",
    "test:feature": "vitest run",
    "test:watch:core": "vitest watch src/lib/__tests__/01-core"
  }
}
```

---

## Success Criteria

1. ✅ All tests organized by feature
2. ✅ Each feature test suite runs independently
3. ✅ No Firebase emulator connection errors
4. ✅ All tests updated to use new entity model
5. ✅ All tests updated to use workspace-scoped RBAC
6. ✅ Test execution time < 30s per feature
7. ✅ 100% test pass rate
8. ✅ Clear test documentation
9. ✅ CI/CD pipeline configured

---

## Next Steps

1. **Immediate**: Fix Firebase emulator connection issues
2. **Week 1**: Create test infrastructure and refactor Phase 1-3
3. **Week 2**: Refactor Phase 4-7
4. **Week 3**: Refactor Phase 8-11
5. **Week 4**: Cleanup and documentation

---

## Notes

- Use `vitest.workspace.ts` for parallel test execution
- Configure test timeouts appropriately (30s for property tests)
- Use test.concurrent for independent tests
- Mock external services (email, SMS, etc.)
- Use Firebase emulator for all Firestore operations
