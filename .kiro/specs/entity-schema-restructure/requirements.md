# Requirements Document: Entity Schema Restructure

## 1. Business Requirements

### 1.1 Problem Statement

The current Entity data model has structural issues that create maintenance challenges and data inconsistencies:

- **Redundant institutionData node**: Contains fields (initials, location, logoUrl, referee) that should be at the entity root level
- **Scattered finance data**: Financial information is fragmented across institutionData and industryData nodes
- **Duplicate fields**: Critical fields like entityType, currency, billingAddress, and capacity appear in multiple locations
- **Inconsistent naming**: The field "companySize" should be "capacity" for clarity across all industry verticals

These issues lead to:
- Increased code complexity when reading/writing entity data
- Risk of data inconsistency between duplicate fields
- Confusion about the source of truth for specific fields
- Difficulty maintaining and extending the schema

### 1.2 Business Goals

1. **Simplify data model**: Create a clean, logical entity structure that's easy to understand and maintain
2. **Eliminate redundancy**: Remove all duplicate fields and consolidate related data
3. **Improve consistency**: Use consistent naming conventions across all industries
4. **Enhance maintainability**: Make it easier to add new industries and features
5. **Preserve data integrity**: Ensure zero data loss during restructuring
6. **Maintain performance**: Keep or improve query performance after restructuring

### 1.3 Success Metrics

- ✅ 100% of entities migrated to new schema with zero data loss
- ✅ All duplicate fields removed (entityType, currency, billingAddress, capacity)
- ✅ institutionData node completely removed
- ✅ All finance data consolidated in financeData node
- ✅ All entity operations (create, update, import, display) work with new schema
- ✅ Page load times maintained or improved (< 2 seconds for entity lists)
- ✅ Zero production incidents related to schema changes

---

## 2. Functional Requirements

### 2.1 Entity Root Structure

**REQ-2.1.1**: Entity MUST have core identity fields at root level
- `id`, `organizationId`, `entityType`, `industry`, `name`, `slug`

**REQ-2.1.2**: Entity MUST have institution-specific fields at root level (moved from institutionData)
- `initials` (optional): Institution abbreviation (e.g., "PMS")
- `logoUrl` (optional): Direct URL to institution logo
- `referee` (optional): Name of person who referred this entity
- `location` (optional): Location object with locationString and zone

**REQ-2.1.3**: Entity MUST have contact fields at root level
- `entityContacts`: Canonical contact list
- `primaryContactName`, `primaryEmail`, `primaryPhone`: Denormalized for performance

**REQ-2.1.4**: Entity MUST have status and audit fields at root level
- `status`: 'active' | 'inactive' | 'archived'
- `createdAt`, `updatedAt`: ISO timestamps

### 2.2 FinanceData Node

**REQ-2.2.1**: Entity MUST have a financeData node for all financial information

**REQ-2.2.2**: FinanceData MUST include subscription fields
- `planType` (optional): Subscription plan name
- `subscriptionIds` (optional): Array of subscription document IDs

**REQ-2.2.3**: FinanceData MUST include billing fields
- `currency` (required): Currency code (e.g., "GHS", "USD")
- `billingAddress` (optional): Physical billing address
- `subscriptionRate` (optional): Monthly/annual rate

**REQ-2.2.4**: FinanceData MUST include customer classification
- `customerTier` (optional): 'basic' | 'pro' | 'enterprise'

**REQ-2.2.5**: FinanceData MUST include date fields
- `signupDate` (optional): ISO timestamp of signup
- `renewalDate` (optional): ISO timestamp of next renewal

**REQ-2.2.6**: FinanceData MUST include payment tracking
- `paymentMethod` (optional): Payment method type
- `lastPaymentDate` (optional): ISO timestamp
- `nextPaymentDue` (optional): ISO timestamp

**REQ-2.2.7**: FinanceData MUST include reference arrays
- `invoiceIds` (optional): Array of invoice document IDs
- `paymentIds` (optional): Array of payment document IDs

### 2.3 IndustryData Cleanup

**REQ-2.3.1**: IndustryData MUST NOT contain entityType field
- entityType MUST only exist at entity root level

**REQ-2.3.2**: IndustryData MUST NOT contain finance fields
- All finance fields MUST be in financeData node
- Remove: billingAddress, currency, subscriptionRate, planType, subscriptionIds, signupDate, renewalDate, customerTier

**REQ-2.3.3**: IndustryData MUST use "capacity" field name consistently
- Rename: companySize → capacity
- Rename: nominalRoll → capacity (via migration)
- Rename: enrollmentCapacity → capacity

**REQ-2.3.4**: IndustryData MUST only contain industry-specific operational data
- SaaS: capacity, activeUsers, features, accountStatus, reference IDs
- SchoolEnrollment: gradeOfferings, academicYear, capacity, currentEnrollment, reference IDs
- Law: firmType, practiceAreas, barAssociations, capacity, conflictCheckRequired, reference IDs
- Marketing: clientIndustry, targetAudience, capacity, revenue, monthlyBudget, reference IDs
- RealEstate: developerType, investmentFocus, capacity, propertyPortfolio, reference IDs
- Consultancy: clientIndustry, consultingFocus, capacity, reference IDs

### 2.4 InstitutionData Removal

**REQ-2.4.1**: institutionData node MUST be completely removed from all entities

**REQ-2.4.2**: All fields from institutionData MUST be migrated to appropriate locations
- `initials` → `entity.initials`
- `logoUrl` → `entity.logoUrl`
- `referee` → `entity.referee`
- `location` → `entity.location`
- `zone` → `entity.location.zone`
- `billingAddress` → `financeData.billingAddress`
- `currency` → `financeData.currency`
- `subscriptionRate` → `financeData.subscriptionRate`
- `subscriptionPackageName` → `financeData.planType`
- `implementationDate` → `financeData.signupDate`

---

## 3. Data Migration Requirements

### 3.1 FER Migration Protocol

**REQ-3.1.1**: System MUST implement Fetch, Enrich, Restore (FER) migration protocol

**REQ-3.1.2**: FETCH phase MUST identify all entities needing restructure
- Query all institution entities
- Check for institutionData node existence
- Check for duplicate fields in industryData
- Check for missing financeData node
- Return count and list of entities needing migration

**REQ-3.1.3**: ENRICH phase MUST transform entities to new schema
- Extract fields from institutionData to entity root
- Build financeData from scattered finance fields
- Clean industryData (remove duplicates, rename fields)
- Remove institutionData node
- Preserve all data (zero data loss)
- Use Firestore batch writes (max 500 per batch)

**REQ-3.1.4**: RESTORE phase MUST validate transformed entities
- Verify institutionData removed
- Verify root fields populated correctly
- Verify financeData exists and complete
- Verify industryData cleaned (no duplicates)
- Verify entityType only at root
- Verify capacity field renamed
- Return validation results with error details

**REQ-3.1.5**: ROLLBACK phase MUST revert to original schema if needed
- Restore institutionData node from root/financeData
- Move finance fields back to original locations
- Restore industryData.entityType
- Rename capacity back to original names
- Preserve all data (zero data loss)

### 3.2 Migration UI

**REQ-3.2.1**: Seeding page MUST have "Entity Schema Restructure" section
- Position: Above "Workspace Industry Migration" section
- Display: Migration statistics (total, succeeded, failed, skipped)
- Buttons: Fetch, Enrich, Restore, Rollback
- Error display: Show first 5 errors with expandable view

**REQ-3.2.2**: Migration UI MUST provide real-time feedback
- Show loading state during operations
- Display success/error toasts
- Update statistics after each operation
- Show detailed entity list with before/after comparison

---

## 4. Entity Operations Requirements

### 4.1 Entity Creation

**REQ-4.1.1**: createEntityAction MUST use new schema
- Set root fields (initials, logoUrl, referee, location)
- Build financeData from input
- Build clean industryData (no duplicates)
- Do NOT create institutionData node

**REQ-4.1.2**: Entity creation MUST validate financeData
- Require currency field
- Validate planType against available plans
- Validate customerTier enum values

**REQ-4.1.3**: Entity creation MUST validate industryData
- Ensure no entityType field
- Ensure no finance fields
- Ensure capacity field (not companySize)
- Validate against industry-specific schema

### 4.2 Entity Update

**REQ-4.2.1**: updateEntityAction MUST use new schema
- Update root fields if provided
- Update financeData if provided
- Update clean industryData if provided
- Do NOT update institutionData node

**REQ-4.2.2**: Entity update MUST preserve data integrity
- Merge updates with existing data
- Do NOT overwrite entire nodes
- Validate updates against schemas

### 4.3 Entity Import

**REQ-4.3.1**: Import service MUST map CSV columns to new schema
- Map institution fields to root level
- Map finance fields to financeData
- Map industry fields to clean industryData
- Do NOT create institutionData node

**REQ-4.3.2**: Import templates MUST reflect new schema
- Update institution template
- Update family template
- Update person template
- Provide example CSV files

### 4.4 Entity Display

**REQ-4.4.1**: All entity list components MUST read from new locations
- Read initials, logoUrl, referee, location from root
- Read finance data from financeData node
- Read industry data from clean industryData
- Handle missing fields gracefully (backward compatibility)

**REQ-4.4.2**: Entity detail pages MUST display new schema
- Show root fields in appropriate sections
- Show financeData in finance section
- Show industryData in industry-specific section
- Use consistent field labels

**REQ-4.4.3**: Entity cards/widgets MUST use new schema
- Display logoUrl from root
- Display capacity from industryData
- Display finance info from financeData
- Handle missing fields gracefully

### 4.5 Entity Forms

**REQ-4.5.1**: Add entity forms MUST use new schema
- Input fields for root-level fields
- Input fields for financeData
- Input fields for clean industryData
- Do NOT show institutionData fields

**REQ-4.5.2**: Edit entity forms MUST use new schema
- Pre-populate from new locations
- Update new locations on save
- Validate against new schemas
- Handle missing fields gracefully

---

## 5. Backward Compatibility Requirements

### 5.1 Legacy Data Support

**REQ-5.1.1**: System MUST support entities with old schema during migration period
- Read from institutionData if new fields missing
- Read from old industryData locations if financeData missing
- Fallback to old field names (companySize, nominalRoll)

**REQ-5.1.2**: Contact adapter MUST map legacy schools to new schema
- Map school fields to entity root
- Map school finance fields to financeData
- Map school industry fields to clean industryData
- Handle missing fields gracefully

### 5.2 Dual-Read Period

**REQ-5.2.1**: System MUST support dual-read during migration
- Try new locations first
- Fallback to old locations if missing
- Log when fallback occurs
- Track migration progress

---

## 6. Performance Requirements

### 6.1 Query Performance

**REQ-6.1.1**: Entity list queries MUST complete in < 2 seconds
- For lists of up to 1000 entities
- With all necessary fields loaded
- With proper indexing

**REQ-6.1.2**: Entity detail queries MUST complete in < 1 second
- For single entity load
- With all nested data
- With proper indexing

### 6.2 Migration Performance

**REQ-6.2.1**: FETCH phase MUST complete in < 30 seconds
- For up to 10,000 entities
- With full validation checks

**REQ-6.2.2**: ENRICH phase MUST complete in < 5 minutes
- For up to 10,000 entities
- With batch writes (500 per batch)
- With error handling

**REQ-6.2.3**: RESTORE phase MUST complete in < 2 minutes
- For up to 10,000 entities
- With full validation checks

---

## 7. Security Requirements

### 7.1 Data Access

**REQ-7.1.1**: Migration operations MUST require admin permissions
- Only organization admins can run migrations
- Log all migration operations
- Track who initiated each migration

**REQ-7.1.2**: Entity operations MUST respect workspace permissions
- Create/update/delete based on user role
- Read based on workspace access
- Enforce industry scope validation

### 7.2 Data Integrity

**REQ-7.2.1**: Migration MUST preserve all data
- Zero data loss during transformation
- All fields accounted for
- Validation before and after

**REQ-7.2.2**: Migration MUST be atomic per entity
- Either fully migrate or not at all
- No partial migrations
- Rollback capability

---

## 8. Testing Requirements

### 8.1 Unit Tests

**REQ-8.1.1**: MUST have unit tests for field mapping logic
- institutionData → root/financeData
- Deduplication logic
- Rename logic (companySize → capacity)
- FinanceData construction
- IndustryData cleaning

**REQ-8.1.2**: MUST have unit tests for validation logic
- Schema validation
- Required field checks
- Enum value validation
- Type checking

### 8.2 Integration Tests

**REQ-8.2.1**: MUST have integration tests for entity operations
- Create entity with new schema
- Update entity with new schema
- Import entities with new schema
- Query entities with new schema
- Display entities with new schema

**REQ-8.2.2**: MUST have integration tests for migration
- FETCH identifies correct entities
- ENRICH transforms correctly
- RESTORE validates correctly
- ROLLBACK reverts correctly
- No data loss during migration

### 8.3 E2E Tests

**REQ-8.3.1**: MUST have E2E tests for critical workflows
- Create institution entity
- Edit institution entity
- Import institution entities
- View entity list
- View entity detail

---

## 9. Documentation Requirements

### 9.1 Technical Documentation

**REQ-9.1.1**: MUST document new entity schema
- Field descriptions
- Data types
- Validation rules
- Examples

**REQ-9.1.2**: MUST document migration process
- Step-by-step guide
- Rollback procedure
- Troubleshooting guide
- FAQ

### 9.2 User Documentation

**REQ-9.2.1**: MUST document changes for end users
- What changed
- How to use new features
- Migration timeline
- Support contacts

---

## 10. Acceptance Criteria

### 10.1 Migration Success

- ✅ All entities migrated to new schema
- ✅ Zero data loss verified
- ✅ All duplicate fields removed
- ✅ institutionData node removed from all entities
- ✅ financeData node present on all entities
- ✅ industryData cleaned on all entities
- ✅ All validation checks pass

### 10.2 Functionality Success

- ✅ All entity operations work with new schema
- ✅ All UI components display correctly
- ✅ All forms work with new schema
- ✅ All imports work with new schema
- ✅ All queries return correct data
- ✅ Performance maintained or improved

### 10.3 Quality Success

- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ All E2E tests pass
- ✅ No production incidents
- ✅ User acceptance testing passed
- ✅ Documentation complete

---

## 11. Out of Scope

The following are explicitly OUT OF SCOPE for this project:

- ❌ Changes to workspace schema
- ❌ Changes to organization schema
- ❌ Changes to user schema
- ❌ Changes to pipeline/stage schema
- ❌ Changes to activity logging schema
- ❌ New industry verticals
- ❌ New entity types
- ❌ UI redesign (only schema-related updates)
- ❌ Performance optimization beyond maintaining current levels
- ❌ New features unrelated to schema restructure

---

## 12. Dependencies

### 12.1 Technical Dependencies

- Firebase Admin SDK (existing)
- Firestore database (existing)
- TypeScript type system (existing)
- Zod validation library (existing)
- Next.js App Router (existing)

### 12.2 Project Dependencies

- Industry-scoped entity expansion (completed)
- Workspace industry migration (completed)
- Entity SaaS migration (completed)
- Contact adapter (existing)

---

## 13. Risks and Mitigation

### 13.1 Data Loss Risk

**Risk**: Data could be lost during migration
**Mitigation**: 
- Full database backup before migration
- Atomic operations per entity
- Validation before and after
- Rollback capability
- Dual-read period

### 13.2 Performance Risk

**Risk**: New schema could degrade performance
**Mitigation**:
- Performance testing before production
- Index optimization
- Query optimization
- Monitoring and alerting

### 13.3 Breaking Changes Risk

**Risk**: Existing functionality could break
**Mitigation**:
- Comprehensive testing
- Backward compatibility layer
- Gradual rollout
- Feature flags
- Rollback plan

---

## 14. Timeline

### Phase 1: Design & Planning (Week 1)
- Design document review
- Requirements document review
- Technical spike for migration approach
- Risk assessment

### Phase 2: Implementation (Week 2-3)
- Update type definitions
- Implement FER migration script
- Update core actions
- Update UI components
- Write tests

### Phase 3: Testing (Week 4)
- Unit testing
- Integration testing
- E2E testing
- Performance testing
- User acceptance testing

### Phase 4: Deployment (Week 5)
- Deploy to dev environment
- Deploy to staging environment
- Production deployment
- Monitoring and validation

---

## 15. Approval

This requirements document must be approved by:

- [ ] Product Owner
- [ ] Technical Lead
- [ ] Engineering Team
- [ ] QA Team
- [ ] DevOps Team

**Approval Date**: _________________

**Approved By**: _________________
