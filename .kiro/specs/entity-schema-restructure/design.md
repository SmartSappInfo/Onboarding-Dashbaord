# Design Document: Entity Schema Restructure

## Overview

### Purpose

This design document specifies the restructuring of the Entity data model to eliminate redundancy, improve consistency, and create a cleaner separation between core entity data, finance data, and industry-specific data.

### Current Problems

1. **Redundant institutionData node**: Contains fields that should be at entity root level (initials, location/zone, logoUrl, referee)
2. **Scattered finance data**: Financial fields are mixed in institutionData and industryData
3. **Duplicate fields**: entityType, currency, billingAddress, capacity (nominalRoll/companySize) duplicated across nodes
4. **Inconsistent naming**: companySize should be "capacity" for clarity across all industries

### Goals

1. **Eliminate institutionData node**: Move relevant fields to entity root
2. **Consolidate finance data**: Create unified FinanceData node at entity root
3. **Remove duplicates**: Keep entityType at root, remove from industryData
4. **Consistent naming**: Rename companySize → capacity
5. **Clean industryData**: Keep only industry-specific operational data

---

## New Entity Schema

### Entity Root Structure

```typescript
export interface Entity {
  // ============================================
  // IDENTITY & CORE DATA (Industry-Agnostic)
  // ============================================
  id: string;
  organizationId: string;
  entityType: 'institution' | 'family' | 'person'; // MOVED FROM industryData
  industry?: IndustryVertical; // Inherited from workspace
  
  name: string;
  slug: string;
  
  // ============================================
  // INSTITUTION-SPECIFIC ROOT FIELDS
  // (Moved from institutionData)
  // ============================================
  initials?: string; // e.g., "PMS" for Presbyterian Mission School
  logoUrl?: string; // Direct logo URL (renamed from logoUrl in institutionData)
  referee?: string; // Person who referred this entity
  
  // Location data (moved from institutionData.location)
  location?: {
    locationString: string; // e.g., "Anyaa NIC Accra"
    zone?: {
      id: string;
      name: string;
    };
  };
  
  // ============================================
  // CONTACTS & COMMUNICATION
  // ============================================
  entityContacts: EntityContact[]; // Canonical contact list (FER-01)
  primaryContactName?: string; // Denormalized
  primaryEmail?: string; // Denormalized
  primaryPhone?: string; // Denormalized
  
  // ============================================
  // FINANCE DATA (Consolidated)
  // ============================================
  financeData?: FinanceData;
  
  // ============================================
  // POLYMORPHIC DATA (Entity Type Specific)
  // ============================================
  institutionData?: InstitutionData; // REMOVED - fields moved to root/financeData
  familyData?: FamilyData;
  personData?: PersonData;
  
  // ============================================
  // INDUSTRY-SPECIFIC DATA (Polymorphic)
  // ============================================
  industryData?: IndustryData; // Clean, no duplicates
  
  // ============================================
  // TAGS & CATEGORIZATION
  // ============================================
  globalTags: string[]; // Cross-workspace tags
  
  // ============================================
  // STATUS & LIFECYCLE
  // ============================================
  status: 'active' | 'inactive' | 'archived';
  
  // ============================================
  // MIGRATION & AUDIT
  // ============================================
  migrationStatus?: 'legacy' | 'migrated' | 'dual-write';
  legacySchoolId?: string;
  
  createdAt: string;
  updatedAt: string;
}
```

### FinanceData Structure (NEW)

```typescript
/**
 * Consolidated finance data for all entity types
 * Replaces scattered billing fields across institutionData and industryData
 */
export interface FinanceData {
  // ============================================
  // SUBSCRIPTION & PLAN
  // ============================================
  planType?: string; // e.g., "Standard", "Premium", "Enterprise"
  subscriptionIds?: string[]; // References to subscription documents
  
  // ============================================
  // BILLING INFORMATION
  // ============================================
  currency: string; // e.g., "GHS", "USD", "EUR"
  billingAddress?: string; // Physical billing address
  subscriptionRate?: number; // Monthly/annual rate
  
  // ============================================
  // CUSTOMER CLASSIFICATION
  // ============================================
  customerTier?: 'basic' | 'pro' | 'enterprise';
  
  // ============================================
  // DATES
  // ============================================
  signupDate?: string; // ISO timestamp
  renewalDate?: string; // ISO timestamp
  
  // ============================================
  // PAYMENT TRACKING
  // ============================================
  paymentMethod?: 'card' | 'bank_transfer' | 'cash' | 'check';
  lastPaymentDate?: string;
  nextPaymentDue?: string;
  
  // ============================================
  // REFERENCES
  // ============================================
  invoiceIds?: string[]; // References to invoice documents
  paymentIds?: string[]; // References to payment documents
}
```

### Clean IndustryData (No Duplicates)

```typescript
// ============================================
// SaaS Industry Data (CLEANED)
// ============================================
export interface SaaSInstitutionData {
  industry: 'SaaS'; // Discriminator only
  // entityType REMOVED (now at root)
  
  // ============================================
  // CAPACITY & USAGE
  // ============================================
  capacity: number; // Renamed from companySize (number of users/seats)
  activeUsers?: number;
  
  // ============================================
  // FEATURES & MODULES
  // ============================================
  features: string[]; // Enabled features/modules
  
  // ============================================
  // ACCOUNT STATUS
  // ============================================
  accountStatus: 'lead' | 'trial' | 'active' | 'suspended' | 'churned';
  
  // ============================================
  // REFERENCES (Industry-Specific Collections)
  // ============================================
  trialIds?: string[];
  onboardingIds?: string[];
  supportTicketIds?: string[];
  healthScoreIds?: string[];
  
  // Finance fields REMOVED (moved to root financeData)
  // - billingAddress → financeData.billingAddress
  // - currency → financeData.currency
  // - subscriptionRate → financeData.subscriptionRate
  // - planType → financeData.planType
  // - subscriptionIds → financeData.subscriptionIds
  // - signupDate → financeData.signupDate
  // - renewalDate → financeData.renewalDate
  // - customerTier → financeData.customerTier
}

// ============================================
// School Enrollment Industry Data (CLEANED)
// ============================================
export interface SchoolEnrollmentInstitutionData {
  industry: 'SchoolEnrollment';
  // entityType REMOVED (now at root)
  
  // ============================================
  // ACADEMIC CONFIGURATION
  // ============================================
  gradeOfferings: string[]; // e.g., ['K', '1', '2', ..., '12']
  academicYear: string; // e.g., '2024-2025'
  
  // ============================================
  // ENROLLMENT CAPACITY
  // ============================================
  capacity: number; // Total enrollment capacity (renamed from enrollmentCapacity)
  currentEnrollment?: number;
  
  // ============================================
  // REFERENCES
  // ============================================
  applicationIds?: string[];
  enrollmentIds?: string[];
  schoolVisitIds?: string[];
}

// ============================================
// Law Industry Data (CLEANED)
// ============================================
export interface LawInstitutionData {
  industry: 'Law';
  // entityType REMOVED (now at root)
  
  // ============================================
  // FIRM CONFIGURATION
  // ============================================
  firmType: 'solo' | 'partnership' | 'corporate';
  practiceAreas: string[]; // e.g., ['litigation', 'corporate', 'family']
  barAssociations?: string[];
  
  // ============================================
  // CAPACITY
  // ============================================
  capacity?: number; // Number of attorneys/staff
  
  // ============================================
  // COMPLIANCE
  // ============================================
  conflictCheckRequired: boolean;
  
  // ============================================
  // REFERENCES
  // ============================================
  matterIds?: string[];
  intakeFormIds?: string[];
  conflictCheckIds?: string[];
}

// ============================================
// Marketing Industry Data (CLEANED)
// ============================================
export interface MarketingInstitutionData {
  industry: 'Marketing';
  // entityType REMOVED (now at root)
  
  // ============================================
  // CLIENT PROFILE
  // ============================================
  clientIndustry: string;
  targetAudience?: string;
  
  // ============================================
  // BUSINESS SIZE
  // ============================================
  capacity?: number; // Number of employees
  revenue?: number; // Annual revenue
  
  // ============================================
  // BUDGET
  // ============================================
  monthlyBudget?: number;
  
  // ============================================
  // REFERENCES
  // ============================================
  campaignIds?: string[];
  proposalIds?: string[];
  deliverableIds?: string[];
}

// ============================================
// Real Estate Industry Data (CLEANED)
// ============================================
export interface RealEstateInstitutionData {
  industry: 'RealEstate';
  // entityType REMOVED (now at root)
  
  // ============================================
  // DEVELOPER PROFILE
  // ============================================
  developerType: 'residential' | 'commercial' | 'mixed';
  investmentFocus?: string;
  
  // ============================================
  // PORTFOLIO
  // ============================================
  capacity?: number; // Number of properties managed
  propertyPortfolio?: string[];
  
  // ============================================
  // REFERENCES
  // ============================================
  propertyIds?: string[];
  transactionIds?: string[];
}

// ============================================
// Consultancy Industry Data (CLEANED)
// ============================================
export interface ConsultancyInstitutionData {
  industry: 'Consultancy';
  // entityType REMOVED (now at root)
  
  // ============================================
  // CLIENT PROFILE
  // ============================================
  clientIndustry: string;
  consultingFocus: string[]; // e.g., ['strategy', 'operations', 'technology']
  
  // ============================================
  // CAPACITY
  // ============================================
  capacity?: number; // Number of consultants
  
  // ============================================
  // REFERENCES
  // ============================================
  projectIds?: string[];
  proposalIds?: string[];
  deliverableIds?: string[];
}
```

---

## Field Migration Mapping

### From institutionData → Entity Root

| Old Location | New Location | Notes |
|-------------|-------------|-------|
| `institutionData.initials` | `entity.initials` | Direct move |
| `institutionData.logoUrl` | `entity.logoUrl` | Direct move |
| `institutionData.referee` | `entity.referee` | Direct move |
| `institutionData.location` | `entity.location` | Direct move (nested object) |
| `institutionData.zone` | `entity.location.zone` | Nested under location |

### From institutionData → FinanceData

| Old Location | New Location | Notes |
|-------------|-------------|-------|
| `institutionData.billingAddress` | `financeData.billingAddress` | Consolidated |
| `institutionData.currency` | `financeData.currency` | Consolidated |
| `institutionData.subscriptionRate` | `financeData.subscriptionRate` | Consolidated |
| `institutionData.subscriptionPackageId` | `financeData.planType` | Lookup package name |
| `institutionData.subscriptionPackageName` | `financeData.planType` | Direct move |
| `institutionData.implementationDate` | `financeData.signupDate` | Renamed |

### From industryData → FinanceData

| Old Location | New Location | Notes |
|-------------|-------------|-------|
| `industryData.billingAddress` | `financeData.billingAddress` | Deduplicated |
| `industryData.currency` | `financeData.currency` | Deduplicated |
| `industryData.subscriptionRate` | `financeData.subscriptionRate` | Deduplicated |
| `industryData.planType` | `financeData.planType` | Moved |
| `industryData.subscriptionIds` | `financeData.subscriptionIds` | Moved |
| `industryData.signupDate` | `financeData.signupDate` | Moved |
| `industryData.renewalDate` | `financeData.renewalDate` | Moved |
| `industryData.customerTier` | `financeData.customerTier` | Moved |

### Removed Duplicates

| Field | Kept At | Removed From |
|-------|---------|-------------|
| `entityType` | `entity.entityType` (root) | `industryData.entityType` |
| `currency` | `financeData.currency` | `institutionData.currency`, `industryData.currency` |
| `billingAddress` | `financeData.billingAddress` | `institutionData.billingAddress`, `industryData.billingAddress` |
| `capacity` | `industryData.capacity` | `institutionData.nominalRoll` (renamed) |

### Renamed Fields

| Old Name | New Name | Location | Reason |
|----------|----------|----------|--------|
| `companySize` | `capacity` | `industryData.capacity` | More generic across industries |
| `nominalRoll` | `capacity` | `industryData.capacity` | Consistent naming |
| `enrollmentCapacity` | `capacity` | `industryData.capacity` | Consistent naming |

---

## FER Migration Protocol

### Phase 1: FETCH

**Objective**: Identify all entities needing schema restructure

**Query Strategy**:
```typescript
// Fetch all institution entities
const entities = await adminDb.collection('entities')
  .where('entityType', '==', 'institution')
  .get();

// Check for entities with:
// 1. institutionData node exists
// 2. industryData with duplicate fields
// 3. Missing financeData node
```

**Validation Checks**:
- Has `institutionData` node → Needs migration
- Has `industryData.entityType` → Needs deduplication
- Has `industryData.companySize` → Needs rename to capacity
- Missing `financeData` → Needs finance consolidation
- Has `industryData.billingAddress` or `industryData.currency` → Needs deduplication

### Phase 2: ENRICH

**Objective**: Transform entity structure to new schema

**Transformation Steps**:

1. **Extract from institutionData**:
   ```typescript
   entity.initials = institutionData.initials;
   entity.logoUrl = institutionData.logoUrl;
   entity.referee = institutionData.referee;
   entity.location = {
     locationString: institutionData.location?.locationString,
     zone: institutionData.zone
   };
   ```

2. **Build financeData**:
   ```typescript
   entity.financeData = {
     planType: institutionData.subscriptionPackageName || lookupPackageName(institutionData.subscriptionPackageId),
     currency: institutionData.currency || industryData.currency || 'GHS',
     billingAddress: institutionData.billingAddress || industryData.billingAddress,
     subscriptionRate: institutionData.subscriptionRate || industryData.subscriptionRate,
     signupDate: institutionData.implementationDate || industryData.signupDate,
     renewalDate: industryData.renewalDate,
     customerTier: industryData.customerTier,
     subscriptionIds: industryData.subscriptionIds || []
   };
   ```

3. **Clean industryData**:
   ```typescript
   // Remove duplicates
   delete industryData.entityType;
   delete industryData.billingAddress;
   delete industryData.currency;
   delete industryData.subscriptionRate;
   delete industryData.planType;
   delete industryData.subscriptionIds;
   delete industryData.signupDate;
   delete industryData.renewalDate;
   delete industryData.customerTier;
   
   // Rename companySize → capacity
   if (industryData.companySize) {
     industryData.capacity = industryData.companySize;
     delete industryData.companySize;
   }
   ```

4. **Remove institutionData node**:
   ```typescript
   delete entity.institutionData;
   ```

### Phase 3: RESTORE

**Objective**: Validate transformed entities

**Validation Checks**:
- ✅ `institutionData` node removed
- ✅ `entity.initials`, `entity.logoUrl`, `entity.referee`, `entity.location` exist (if were in institutionData)
- ✅ `financeData` node exists with all finance fields
- ✅ `industryData.entityType` removed
- ✅ `industryData.capacity` exists (renamed from companySize)
- ✅ No duplicate fields between financeData and industryData
- ✅ `entityType` only at root level

### Phase 4: ROLLBACK

**Objective**: Revert to original schema if needed

**Rollback Steps**:
1. Restore `institutionData` node from root fields
2. Move finance fields back to `institutionData` and `industryData`
3. Restore `industryData.entityType`
4. Rename `capacity` back to `companySize`/`nominalRoll`

---

## Impact Analysis

### Affected Components

#### 1. **Entity Creation** (`createEntityAction`)
- **Changes**: Build financeData, set root fields, no institutionData
- **Impact**: Medium - Update entity creation logic

#### 2. **Entity Update** (`updateEntityAction`)
- **Changes**: Update financeData, root fields, clean industryData
- **Impact**: Medium - Update entity update logic

#### 3. **Entity Import** (`import-service.ts`)
- **Changes**: Map CSV columns to new schema
- **Impact**: High - Update all import templates

#### 4. **Entity Display** (All entity list pages)
- **Changes**: Read from new locations (root, financeData, clean industryData)
- **Impact**: High - Update all entity display components

#### 5. **Entity Forms** (Add/Edit entity pages)
- **Changes**: Form fields map to new schema
- **Impact**: High - Update all entity forms

#### 6. **Contact Adapter** (`contact-adapter.ts`)
- **Changes**: Map legacy schools to new entity schema
- **Impact**: High - Update adapter mapping logic

#### 7. **Industry Schemas** (`industry-schemas.ts`)
- **Changes**: Update Zod schemas for clean industryData
- **Impact**: Medium - Update validation schemas

#### 8. **Entity Queries** (All Firestore queries)
- **Changes**: Query new field locations
- **Impact**: High - Update all entity queries

---

## Implementation Phases

### Phase 1: Type Definitions & Schemas (Week 1)
1. Update `types.ts` with new Entity, FinanceData interfaces
2. Update industry-specific data interfaces (remove duplicates, rename fields)
3. Update Zod schemas in `industry-schemas.ts`
4. Run type check to identify all affected files

### Phase 2: FER Migration Script (Week 1-2)
1. Create `entity-schema-restructure-actions.ts`
2. Implement FETCH logic
3. Implement ENRICH logic with field mapping
4. Implement RESTORE validation
5. Implement ROLLBACK logic
6. Add to seeding page UI (above workspace migration)

### Phase 3: Core Actions Update (Week 2)
1. Update `createEntityAction` for new schema
2. Update `updateEntityAction` for new schema
3. Update `contact-adapter.ts` for legacy mapping
4. Update import/export services

### Phase 4: UI Components Update (Week 3)
1. Update entity list components (read from new locations)
2. Update entity detail pages
3. Update entity forms (add/edit)
4. Update entity cards/widgets

### Phase 5: Testing & Validation (Week 4)
1. Run FER migration on test data
2. Validate all entity operations
3. Test all UI components
4. Performance testing
5. Rollback testing

---

## Testing Strategy

### Unit Tests
- ✅ Field mapping logic (institutionData → root/financeData)
- ✅ Deduplication logic (remove entityType, currency, etc.)
- ✅ Rename logic (companySize → capacity)
- ✅ FinanceData construction
- ✅ IndustryData cleaning

### Integration Tests
- ✅ Create entity with new schema
- ✅ Update entity with new schema
- ✅ Import entities with new schema
- ✅ Query entities with new schema
- ✅ Display entities with new schema

### Migration Tests
- ✅ FETCH identifies correct entities
- ✅ ENRICH transforms correctly
- ✅ RESTORE validates correctly
- ✅ ROLLBACK reverts correctly
- ✅ No data loss during migration

---

## Rollout Plan

### Stage 1: Development Environment
1. Run FER migration on dev database
2. Test all entity operations
3. Validate UI components
4. Fix any issues

### Stage 2: Staging Environment
1. Run FER migration on staging database
2. Full regression testing
3. Performance testing
4. User acceptance testing

### Stage 3: Production Environment
1. **Backup database** before migration
2. Run FER migration during low-traffic window
3. Monitor for errors
4. Validate critical workflows
5. Keep rollback script ready

---

## Success Criteria

1. ✅ All entities have clean schema (no institutionData, no duplicates)
2. ✅ All finance data consolidated in financeData node
3. ✅ All industry data clean (no entityType, no finance fields)
4. ✅ All entity operations work with new schema
5. ✅ All UI components display correctly
6. ✅ No data loss during migration
7. ✅ Performance maintained or improved
8. ✅ Rollback capability verified

---

## Risk Mitigation

### Risk 1: Data Loss During Migration
**Mitigation**: 
- Full database backup before migration
- Dual-write period (write to both old and new locations)
- Rollback script tested and ready

### Risk 2: Breaking Existing Functionality
**Mitigation**:
- Comprehensive testing before production
- Gradual rollout (dev → staging → production)
- Feature flags for new schema

### Risk 3: Performance Degradation
**Mitigation**:
- Performance testing before production
- Index optimization for new field locations
- Query optimization

### Risk 4: UI Display Issues
**Mitigation**:
- Visual regression testing
- Manual QA of all entity pages
- Fallback to old field locations if new ones missing

---

## Next Steps

1. **Review this design document** with team
2. **Update type definitions** in `types.ts`
3. **Create FER migration script** in `entity-schema-restructure-actions.ts`
4. **Add migration UI** to seeding page
5. **Update core actions** (create, update, import)
6. **Update UI components** (lists, forms, details)
7. **Test thoroughly** in dev environment
8. **Deploy to staging** for validation
9. **Deploy to production** with monitoring
