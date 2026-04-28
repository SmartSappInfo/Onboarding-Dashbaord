# Industry Migration Scripts - Execution Guide

This document provides a comprehensive guide for executing the industry-scoped entity expansion migration in four phases.

## Overview

The migration transforms SmartSapp from a SaaS B2B CRM into a multi-industry vertical CRM system. Existing schools (B2B SaaS accounts) will be migrated to the "SaaS" industry vertical with proper data transformation.

## Prerequisites

- Firebase Admin SDK credentials (`serviceAccountKey.json` in project root)
- Node.js and pnpm installed
- Full Firestore backup completed
- All users notified of maintenance window (if running live)

## Migration Phases

### Phase 1: Audit and Data Integrity Validation

**Purpose**: Analyze existing data and identify any issues before migration.

**What it does**:
- Reads all documents from `schools` collection
- Reads all `entities` with `entityType: 'institution'`
- Identifies SaaS-specific fields (nominalRoll, subscriptionPackage, modules, implementationDate)
- Validates data integrity and flags anomalies
- Outputs detailed audit report

**Commands**:
```bash
# Run audit (read-only, safe to run anytime)
npx tsx scripts/migrate-industry-phase1.ts
```

**Output**:
- Console report with statistics and anomalies
- JSON report file: `migration-audit-phase1-{timestamp}.json`

**Review checklist**:
- [ ] All schools have `organizationId`
- [ ] Required SaaS fields have good coverage (>95%)
- [ ] No critical data integrity errors
- [ ] Duplicate slugs identified and resolved

**Do not proceed to Phase 2 if there are critical errors.**

---

### Phase 2: Schema Extension

**Purpose**: Add new industry-related fields to workspaces without modifying entity data.

**What it does**:
- Updates all workspaces missing `industry` field to default `'SaaS'`
- Sets `industryScopeLocked: false` on workspaces lacking the field
- Preserves all existing data

**Commands**:
```bash
# Dry run (preview changes without applying)
npx tsx scripts/migrate-industry-phase2.ts --dry-run

# Live migration (applies changes)
npx tsx scripts/migrate-industry-phase2.ts
```

**Output**:
- Console report with changes applied
- JSON report file: `migration-phase2-{dryrun-}{timestamp}.json`

**Validation**:
```bash
# Check a sample workspace in Firestore console
# Verify fields: industry, industryScopeLocked
```

**Rollback**: If issues occur, workspaces can be manually reverted by removing the added fields.

---

### Phase 3: Data Transformation

**Purpose**: Transform existing entity data to include industry-specific fields.

**What it does**:
- For each entity with `entityType: 'institution'` and no `industryData`:
  - Creates `SaaSInstitutionData` structure
  - Maps legacy fields:
    - `nominalRoll` → `companySize`
    - `subscriptionPackage` → `planType`
    - `modules` → `features`
    - `implementationDate` → `signupDate`
  - Preserves billing fields (billingAddress, currency, subscriptionRate)
  - Sets `accountStatus: 'active'` as default
  - Sets `migrationStatus: 'dual-write'`
- Processes in batches of 500 with progress logging

**Commands**:
```bash
# Dry run (preview transformations)
npx tsx scripts/migrate-industry-phase3.ts --dry-run

# Live migration (applies transformations)
npx tsx scripts/migrate-industry-phase3.ts
```

**Output**:
- Console report with transformations and warnings
- JSON report file: `migration-phase3-{dryrun-}{timestamp}.json`

**Validation**:
```bash
# Check a sample entity in Firestore console
# Verify fields: industry, industryData, migrationStatus
```

**Important notes**:
- Entities remain in `dual-write` status until Phase 4 validation passes
- Original `institutionData` is preserved
- Warnings indicate fields that were missing or defaulted

**Rollback**: Entities can be reverted by removing `industry`, `industryData`, and `migrationStatus` fields.

---

### Phase 4: Validation and Cutover

**Purpose**: Validate data integrity and switch entities to "migrated" status.

**What it does**:
- Validates all entities in `dual-write` status:
  - Checks required fields (organizationId, name)
  - Validates industry data consistency (industry field matches industryData.industry)
  - Validates entity type consistency
  - Checks workspace_entities relationships
  - Verifies workspace industry fields
  - Validates entity industry matches workspace industry
- Switches `migrationStatus` from `'dual-write'` to `'migrated'` after validation passes
- Writes migration audit log to `migrationAuditLogs` collection

**Commands**:
```bash
# Dry run (validation only, no cutover)
npx tsx scripts/migrate-industry-phase4.ts --dry-run

# Live migration (validation + cutover)
npx tsx scripts/migrate-industry-phase4.ts
```

**Output**:
- Console report with validation results and cutover statistics
- JSON report file: `migration-phase4-{dryrun-}{timestamp}.json`
- Audit log in Firestore: `migrationAuditLogs` collection

**Validation**:
```bash
# Check entities in Firestore console
# Verify migrationStatus: 'migrated'

# Check migrationAuditLogs collection
# Verify audit log entry with status: 'success'
```

**Important notes**:
- Migration will NOT proceed if validation errors are found
- All validation errors must be fixed before cutover
- Warnings are logged but do not block migration

**Rollback**: Use `scripts/rollback-industry-migration.ts` (Task 27) to revert entities to `legacy` status.

---

## Execution Checklist

### Pre-Migration
- [ ] Complete Firestore backup
- [ ] Run Phase 1 audit and review report
- [ ] Fix any critical data integrity issues
- [ ] Notify users of maintenance window (if applicable)
- [ ] Test migration scripts in staging environment

### Migration Execution
- [ ] Run Phase 2 dry run and review changes
- [ ] Run Phase 2 live migration
- [ ] Verify workspace fields in Firestore console
- [ ] Run Phase 3 dry run and review transformations
- [ ] Run Phase 3 live migration
- [ ] Verify entity fields in Firestore console
- [ ] Run Phase 4 dry run and review validation results
- [ ] Fix any validation errors
- [ ] Run Phase 4 live migration
- [ ] Verify migrationStatus: 'migrated' in Firestore console
- [ ] Review migration audit log

### Post-Migration
- [ ] Test entity CRUD operations
- [ ] Test workspace functionality
- [ ] Test industry-specific features
- [ ] Monitor application logs for errors
- [ ] Keep `schools` collection intact for 90-day rollback window
- [ ] Update documentation with new industry fields

## Troubleshooting

### Phase 1: Audit Issues

**Issue**: Missing organizationId on schools
**Solution**: Run organization migration script first or manually add organizationId

**Issue**: High percentage of missing required SaaS fields
**Solution**: Review data quality and consider data enrichment before migration

### Phase 2: Schema Extension Issues

**Issue**: Workspace update fails
**Solution**: Check Firestore permissions and retry

### Phase 3: Transformation Issues

**Issue**: Entity transformation fails with validation error
**Solution**: Review entity data structure and ensure institutionData is present

**Issue**: Warnings about missing fields
**Solution**: Review warnings and decide if defaults are acceptable or if data enrichment is needed

### Phase 4: Validation Issues

**Issue**: Industry mismatch errors
**Solution**: Manually fix entity industry field to match workspace industry

**Issue**: Missing workspace industry field
**Solution**: Re-run Phase 2 for affected workspaces

**Issue**: Workspace_entities relationship errors
**Solution**: Check workspace existence and fix orphaned workspace_entities

## Rollback Procedures

### Phase 2 Rollback
Manually remove added fields from workspaces:
```typescript
// Remove industry and industryScopeLocked fields
await db.collection('workspaces').doc(workspaceId).update({
  industry: FieldValue.delete(),
  industryScopeLocked: FieldValue.delete(),
  industryScopeLockedAt: FieldValue.delete()
});
```

### Phase 3 Rollback
Manually remove added fields from entities:
```typescript
// Remove industry, industryData, and migrationStatus fields
await db.collection('entities').doc(entityId).update({
  industry: FieldValue.delete(),
  industryData: FieldValue.delete(),
  migrationStatus: FieldValue.delete()
});
```

### Phase 4 Rollback
Use the rollback script (Task 27):
```bash
# Rollback specific workspace
npx tsx scripts/rollback-industry-migration.ts --workspace-id=<workspaceId>

# Rollback all workspaces
npx tsx scripts/rollback-industry-migration.ts --all
```

## Performance Considerations

- **Batch size**: 500 entities per batch (Firestore limit)
- **Estimated time**: ~1-2 minutes per 1000 entities
- **Firestore reads**: Phase 1 reads all schools and entities
- **Firestore writes**: Phases 2-4 write in batches

## Support

For issues or questions:
1. Review the migration report JSON files
2. Check Firestore console for data state
3. Review application logs for errors
4. Consult the spec documents in `.kiro/specs/industry-scoped-entity-expansion/`

## References

- Requirements: `.kiro/specs/industry-scoped-entity-expansion/requirements.md`
- Design: `.kiro/specs/industry-scoped-entity-expansion/design.md`
- Tasks: `.kiro/specs/industry-scoped-entity-expansion/tasks.md`
