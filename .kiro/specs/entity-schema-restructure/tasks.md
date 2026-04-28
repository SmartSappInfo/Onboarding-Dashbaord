# Implementation Tasks: Entity Schema Restructure

## Phase 1: Type Definitions & Schemas

### 1.1 Update Core Type Definitions
- [ ] 1.1.1 Update Entity interface in `src/lib/types.ts`
  - [ ] Add root-level fields: `initials`, `logoUrl`, `referee`, `location`
  - [ ] Add `financeData?: FinanceData` field
  - [ ] Remove `institutionData?: InstitutionData` field
  - [ ] Ensure `entityType` at root level only

- [ ] 1.1.2 Create FinanceData interface in `src/lib/types.ts`
  - [ ] Add subscription fields: `planType`, `subscriptionIds`
  - [ ] Add billing fields: `currency`, `billingAddress`, `subscriptionRate`
  - [ ] Add customer fields: `customerTier`
  - [ ] Add date fields: `signupDate`, `renewalDate`
  - [ ] Add payment fields: `paymentMethod`, `lastPaymentDate`, `nextPaymentDue`
  - [ ] Add reference fields: `invoiceIds`, `paymentIds`

- [ ] 1.1.3 Update IndustryData interfaces in `src/lib/types.ts`
  - [ ] Remove `entityType` field from all industry data interfaces
  - [ ] Rename `companySize` → `capacity` in SaaSInstitutionData
  - [ ] Remove finance fields from all industry data interfaces
  - [ ] Update SchoolEnrollmentInstitutionData: rename `enrollmentCapacity` → `capacity`
  - [ ] Update LawInstitutionData: add optional `capacity` field
  - [ ] Update MarketingInstitutionData: add optional `capacity` field, move `revenue` out
  - [ ] Update RealEstateInstitutionData: add optional `capacity` field
  - [ ] Update ConsultancyInstitutionData: add optional `capacity` field

- [ ] 1.1.4 Remove InstitutionData interface from `src/lib/types.ts`
  - [ ] Mark as deprecated with migration note
  - [ ] Keep for backward compatibility during migration

### 1.2 Update Validation Schemas
- [ ] 1.2.1 Update industry schemas in `src/lib/industry-schemas.ts`
  - [ ] Remove `entityType` from all industry schemas
  - [ ] Remove finance fields from all industry schemas
  - [ ] Update field name: `companySize` → `capacity`
  - [ ] Add FinanceData Zod schema

- [ ] 1.2.2 Create entity root schema validation
  - [ ] Add validation for `initials`, `logoUrl`, `referee`, `location`
  - [ ] Add validation for `financeData` node
  - [ ] Ensure `entityType` validation at root only

### 1.3 Run Type Check
- [ ] 1.3.1 Run `pnpm typecheck` to identify all affected files
- [ ] 1.3.2 Document all files that need updates
- [ ] 1.3.3 Create checklist of affected components

---

## Phase 2: FER Migration Implementation

### 2.1 Create Migration Actions File
- [ ] 2.1.1 Create `src/app/actions/entity-schema-restructure-actions.ts`
  - [ ] Add server action imports
  - [ ] Add type imports
  - [ ] Add helper function imports

### 2.2 Implement FETCH Phase
- [ ] 2.2.1 Create `fetchEntitiesForSchemaRestructure()` function
  - [ ] Query all institution entities from Firestore
  - [ ] Check for `institutionData` node existence
  - [ ] Check for duplicate fields in `industryData`
  - [ ] Check for missing `financeData` node
  - [ ] Check for old field names (`companySize`, `nominalRoll`)
  - [ ] Return migration result with statistics

- [ ] 2.2.2 Add detailed entity analysis
  - [ ] Identify which fields need migration
  - [ ] Calculate migration complexity per entity
  - [ ] Return entity details for preview

### 2.3 Implement ENRICH Phase
- [ ] 2.3.1 Create `enrichEntitiesWithNewSchema()` function
  - [ ] Implement field extraction from `institutionData`
  - [ ] Implement `financeData` construction logic
  - [ ] Implement `industryData` cleaning logic
  - [ ] Implement field renaming logic
  - [ ] Use Firestore batch writes (max 500 per batch)

- [ ] 2.3.2 Implement field mapping helpers
  - [ ] `extractRootFields(institutionData)` - Extract initials, logoUrl, referee, location
  - [ ] `buildFinanceData(institutionData, industryData)` - Consolidate finance fields
  - [ ] `cleanIndustryData(industryData)` - Remove duplicates, rename fields
  - [ ] `lookupSubscriptionPackageName(packageId)` - Resolve package names

- [ ] 2.3.3 Add error handling and logging
  - [ ] Log each entity transformation
  - [ ] Catch and record errors per entity
  - [ ] Continue processing on individual failures
  - [ ] Return detailed error information

### 2.4 Implement RESTORE Phase
- [ ] 2.4.1 Create `restoreEntitySchemaRestructure()` function
  - [ ] Validate `institutionData` removed
  - [ ] Validate root fields populated
  - [ ] Validate `financeData` exists and complete
  - [ ] Validate `industryData` cleaned
  - [ ] Validate `entityType` only at root
  - [ ] Validate `capacity` field exists (not `companySize`)

- [ ] 2.4.2 Add comprehensive validation checks
  - [ ] Check required fields present
  - [ ] Check no duplicate fields
  - [ ] Check field types correct
  - [ ] Check enum values valid
  - [ ] Return validation results with details

### 2.5 Implement ROLLBACK Phase
- [ ] 2.5.1 Create `rollbackEntitySchemaRestructure()` function
  - [ ] Restore `institutionData` node from root/financeData
  - [ ] Move finance fields back to original locations
  - [ ] Restore `industryData.entityType`
  - [ ] Rename `capacity` back to original names
  - [ ] Use Firestore batch writes

- [ ] 2.5.2 Add rollback validation
  - [ ] Verify original schema restored
  - [ ] Verify no data loss
  - [ ] Return rollback results

### 2.6 Add Migration UI to Seeding Page
- [ ] 2.6.1 Update `src/app/admin/seeds/SeedsClient.tsx`
  - [ ] Import entity schema restructure actions
  - [ ] Add state variables for migration status
  - [ ] Add handler functions for FETCH, ENRICH, RESTORE, ROLLBACK

- [ ] 2.6.2 Create "Entity Schema Restructure" UI section
  - [ ] Position above "Workspace Industry Migration" section
  - [ ] Add migration statistics display (total, succeeded, failed, skipped)
  - [ ] Add entity details table with before/after comparison
  - [ ] Add error display panel
  - [ ] Add Fetch, Enrich, Restore buttons (3-column layout)
  - [ ] Add Rollback button (full-width, warning style)

- [ ] 2.6.3 Add real-time feedback
  - [ ] Show loading states during operations
  - [ ] Display success/error toasts
  - [ ] Update statistics after each operation
  - [ ] Show detailed error messages

---

## Phase 3: Core Actions Update

### 3.1 Update Entity Creation
- [ ] 3.1.1 Update `createEntityAction` in `src/lib/entity-actions.ts`
  - [ ] Set root-level fields from input (initials, logoUrl, referee, location)
  - [ ] Build `financeData` from input
  - [ ] Build clean `industryData` (no duplicates, use capacity)
  - [ ] Do NOT create `institutionData` node
  - [ ] Validate against new schemas

- [ ] 3.1.2 Update entity creation validation
  - [ ] Validate `financeData` structure
  - [ ] Validate clean `industryData` structure
  - [ ] Ensure no duplicate fields
  - [ ] Ensure `entityType` only at root

### 3.2 Update Entity Update
- [ ] 3.2.1 Update `updateEntityAction` in `src/lib/entity-actions.ts`
  - [ ] Update root-level fields if provided
  - [ ] Update `financeData` if provided
  - [ ] Update clean `industryData` if provided
  - [ ] Do NOT update `institutionData` node
  - [ ] Merge updates with existing data

- [ ] 3.2.2 Add backward compatibility
  - [ ] Read from old locations if new ones missing
  - [ ] Log when fallback occurs
  - [ ] Track migration progress

### 3.3 Update Contact Adapter
- [ ] 3.3.1 Update `mapSchoolToEntity` in `src/lib/contact-adapter.ts`
  - [ ] Map school fields to entity root (initials, logoUrl, referee, location)
  - [ ] Map school finance fields to `financeData`
  - [ ] Map school industry fields to clean `industryData`
  - [ ] Do NOT create `institutionData` node

- [ ] 3.3.2 Update `mapEntityToSchool` for backward compatibility
  - [ ] Read from new locations
  - [ ] Fallback to old locations if missing
  - [ ] Map to legacy school format

### 3.4 Update Import/Export Services
- [ ] 3.4.1 Update `parseInstitutionRow` in `src/lib/import-export/import-service.ts`
  - [ ] Map CSV columns to entity root fields
  - [ ] Map CSV columns to `financeData`
  - [ ] Map CSV columns to clean `industryData`
  - [ ] Do NOT create `institutionData` node

- [ ] 3.4.2 Update institution template in `src/lib/import-export/institution-template.ts`
  - [ ] Update column definitions for new schema
  - [ ] Update example data
  - [ ] Update documentation

- [ ] 3.4.3 Update export service in `src/lib/import-export/export-service.ts`
  - [ ] Read from new locations
  - [ ] Export with new column names
  - [ ] Handle missing fields gracefully

---

## Phase 4: UI Components Update

### 4.1 Update Entity List Components
- [ ] 4.1.1 Update `EntitiesClient` in `src/app/admin/entities/EntitiesClient.tsx`
  - [ ] Read `logoUrl` from entity root
  - [ ] Read `initials` from entity root
  - [ ] Read capacity from `industryData.capacity`
  - [ ] Read finance info from `financeData`
  - [ ] Handle missing fields gracefully

- [ ] 4.1.2 Update entity table columns
  - [ ] Update logo column to use `entity.logoUrl`
  - [ ] Update capacity column to use `industryData.capacity`
  - [ ] Update finance columns to use `financeData`
  - [ ] Add fallback for old schema

- [ ] 4.1.3 Update entity filters
  - [ ] Update capacity filter to use new location
  - [ ] Update finance filters to use new location
  - [ ] Handle missing fields in filters

### 4.2 Update Entity Detail Pages
- [ ] 4.2.1 Update entity detail page in `src/app/admin/entities/[id]/page.tsx`
  - [ ] Read all fields from new locations
  - [ ] Display root fields in appropriate sections
  - [ ] Display `financeData` in finance section
  - [ ] Display clean `industryData` in industry section

- [ ] 4.2.2 Update entity detail components
  - [ ] Update EntityHeader to use `entity.logoUrl`
  - [ ] Update EntityInfo to use root fields
  - [ ] Update FinanceSection to use `financeData`
  - [ ] Update IndustrySection to use clean `industryData`

### 4.3 Update Entity Forms
- [ ] 4.3.1 Update add entity form in `src/app/admin/entities/new/page.tsx`
  - [ ] Add input fields for root-level fields (initials, logoUrl, referee, location)
  - [ ] Add input fields for `financeData`
  - [ ] Add input fields for clean `industryData`
  - [ ] Remove `institutionData` fields
  - [ ] Validate against new schemas

- [ ] 4.3.2 Update edit entity form in `src/app/admin/entities/[id]/edit/page.tsx`
  - [ ] Pre-populate from new locations
  - [ ] Update new locations on save
  - [ ] Handle missing fields gracefully
  - [ ] Validate against new schemas

- [ ] 4.3.3 Update form components
  - [ ] Update InstitutionForm component
  - [ ] Update FinanceForm component (new)
  - [ ] Update IndustryForm component
  - [ ] Add field validation

### 4.4 Update Entity Cards/Widgets
- [ ] 4.4.1 Update EntityCard component
  - [ ] Display `logoUrl` from entity root
  - [ ] Display capacity from `industryData.capacity`
  - [ ] Display finance info from `financeData`
  - [ ] Handle missing fields gracefully

- [ ] 4.4.2 Update dashboard widgets
  - [ ] Update entity count widgets
  - [ ] Update capacity widgets
  - [ ] Update finance widgets
  - [ ] Handle missing fields gracefully

### 4.5 Update Pipeline/Stage Views
- [ ] 4.5.1 Update pipeline board in `src/app/admin/pipeline/page.tsx`
  - [ ] Read entity data from new locations
  - [ ] Display entity cards with new schema
  - [ ] Handle missing fields gracefully

- [ ] 4.5.2 Update stage cards
  - [ ] Display entity info from new locations
  - [ ] Update entity actions to use new schema

---

## Phase 5: Testing

### 5.1 Unit Tests
- [ ] 5.1.1 Create unit tests for field mapping
  - [ ] Test `extractRootFields()` helper
  - [ ] Test `buildFinanceData()` helper
  - [ ] Test `cleanIndustryData()` helper
  - [ ] Test field renaming logic

- [ ] 5.1.2 Create unit tests for validation
  - [ ] Test FinanceData schema validation
  - [ ] Test clean IndustryData schema validation
  - [ ] Test entity root schema validation
  - [ ] Test duplicate field detection

- [ ] 5.1.3 Create unit tests for migration logic
  - [ ] Test FETCH phase logic
  - [ ] Test ENRICH phase logic
  - [ ] Test RESTORE phase logic
  - [ ] Test ROLLBACK phase logic

### 5.2 Integration Tests
- [ ] 5.2.1 Create integration tests for entity operations
  - [ ] Test create entity with new schema
  - [ ] Test update entity with new schema
  - [ ] Test import entities with new schema
  - [ ] Test query entities with new schema

- [ ] 5.2.2 Create integration tests for migration
  - [ ] Test full FETCH → ENRICH → RESTORE flow
  - [ ] Test ROLLBACK after ENRICH
  - [ ] Test data integrity during migration
  - [ ] Test error handling during migration

- [ ] 5.2.3 Create integration tests for backward compatibility
  - [ ] Test reading old schema entities
  - [ ] Test dual-read fallback logic
  - [ ] Test contact adapter with old schema

### 5.3 E2E Tests
- [ ] 5.3.1 Create E2E tests for entity workflows
  - [ ] Test create institution entity flow
  - [ ] Test edit institution entity flow
  - [ ] Test import institution entities flow
  - [ ] Test view entity list flow
  - [ ] Test view entity detail flow

- [ ] 5.3.2 Create E2E tests for migration UI
  - [ ] Test FETCH operation from UI
  - [ ] Test ENRICH operation from UI
  - [ ] Test RESTORE operation from UI
  - [ ] Test ROLLBACK operation from UI

### 5.4 Performance Tests
- [ ] 5.4.1 Test entity list query performance
  - [ ] Measure query time for 1000 entities
  - [ ] Ensure < 2 seconds load time
  - [ ] Verify proper indexing

- [ ] 5.4.2 Test migration performance
  - [ ] Measure FETCH time for 10,000 entities
  - [ ] Measure ENRICH time for 10,000 entities
  - [ ] Measure RESTORE time for 10,000 entities
  - [ ] Ensure within performance requirements

---

## Phase 6: Documentation

### 6.1 Technical Documentation
- [ ] 6.1.1 Document new entity schema
  - [ ] Create schema reference document
  - [ ] Add field descriptions
  - [ ] Add data type specifications
  - [ ] Add validation rules
  - [ ] Add code examples

- [ ] 6.1.2 Document migration process
  - [ ] Create migration guide
  - [ ] Add step-by-step instructions
  - [ ] Add rollback procedure
  - [ ] Add troubleshooting guide
  - [ ] Add FAQ section

- [ ] 6.1.3 Update API documentation
  - [ ] Update entity creation API docs
  - [ ] Update entity update API docs
  - [ ] Update entity query API docs
  - [ ] Update import/export API docs

### 6.2 User Documentation
- [ ] 6.2.1 Create user-facing documentation
  - [ ] Document what changed
  - [ ] Document how to use new features
  - [ ] Document migration timeline
  - [ ] Add support contacts

- [ ] 6.2.2 Create training materials
  - [ ] Create video tutorials
  - [ ] Create screenshot guides
  - [ ] Create FAQ for end users

### 6.3 Code Documentation
- [ ] 6.3.1 Add JSDoc comments to new functions
  - [ ] Document migration functions
  - [ ] Document helper functions
  - [ ] Document validation functions

- [ ] 6.3.2 Update existing code comments
  - [ ] Update entity action comments
  - [ ] Update type definition comments
  - [ ] Update schema comments

---

## Phase 7: Deployment

### 7.1 Development Environment
- [ ] 7.1.1 Deploy to dev environment
  - [ ] Run database backup
  - [ ] Run FER migration
  - [ ] Validate migration results
  - [ ] Test all entity operations
  - [ ] Test all UI components

- [ ] 7.1.2 Fix any issues found
  - [ ] Document issues
  - [ ] Implement fixes
  - [ ] Re-test
  - [ ] Validate fixes

### 7.2 Staging Environment
- [ ] 7.2.1 Deploy to staging environment
  - [ ] Run database backup
  - [ ] Run FER migration
  - [ ] Validate migration results
  - [ ] Full regression testing
  - [ ] Performance testing
  - [ ] User acceptance testing

- [ ] 7.2.2 Fix any issues found
  - [ ] Document issues
  - [ ] Implement fixes
  - [ ] Re-test
  - [ ] Validate fixes

### 7.3 Production Environment
- [ ] 7.3.1 Prepare for production deployment
  - [ ] Create deployment checklist
  - [ ] Schedule deployment window
  - [ ] Notify stakeholders
  - [ ] Prepare rollback plan
  - [ ] Set up monitoring

- [ ] 7.3.2 Execute production deployment
  - [ ] Run full database backup
  - [ ] Run FER migration during low-traffic window
  - [ ] Monitor for errors
  - [ ] Validate critical workflows
  - [ ] Monitor performance metrics

- [ ] 7.3.3 Post-deployment validation
  - [ ] Verify all entities migrated
  - [ ] Verify zero data loss
  - [ ] Verify all operations working
  - [ ] Verify UI displaying correctly
  - [ ] Monitor error logs

- [ ] 7.3.4 Post-deployment monitoring
  - [ ] Monitor for 24 hours
  - [ ] Track error rates
  - [ ] Track performance metrics
  - [ ] Respond to any issues
  - [ ] Document lessons learned

---

## Phase 8: Cleanup

### 8.1 Remove Deprecated Code
- [ ] 8.1.1 Remove InstitutionData interface (after migration complete)
- [ ] 8.1.2 Remove backward compatibility code (after validation period)
- [ ] 8.1.3 Remove old field references
- [ ] 8.1.4 Remove migration UI from seeding page (optional, after migration)

### 8.2 Optimize Queries
- [ ] 8.2.1 Review and optimize entity queries
- [ ] 8.2.2 Add/update Firestore indexes
- [ ] 8.2.3 Remove unused indexes

### 8.3 Final Documentation
- [ ] 8.3.1 Update all documentation to reflect final state
- [ ] 8.3.2 Archive migration documentation
- [ ] 8.3.3 Create post-migration report

---

## Success Criteria

### Migration Success
- [x] All entities migrated to new schema
- [x] Zero data loss verified
- [x] All duplicate fields removed
- [x] institutionData node removed from all entities
- [x] financeData node present on all entities
- [x] industryData cleaned on all entities
- [x] All validation checks pass

### Functionality Success
- [x] All entity operations work with new schema
- [x] All UI components display correctly
- [x] All forms work with new schema
- [x] All imports work with new schema
- [x] All queries return correct data
- [x] Performance maintained or improved

### Quality Success
- [x] All unit tests pass
- [x] All integration tests pass
- [x] All E2E tests pass
- [x] No production incidents
- [x] User acceptance testing passed
- [x] Documentation complete

---

## Notes

- **Priority**: High - This is a critical data restructuring project
- **Estimated Timeline**: 5 weeks (1 week per phase + 1 week buffer)
- **Team Size**: 2-3 developers + 1 QA + 1 DevOps
- **Risk Level**: High - Involves data migration and schema changes
- **Rollback Plan**: Full rollback capability via ROLLBACK phase
- **Monitoring**: 24/7 monitoring for first week after production deployment
