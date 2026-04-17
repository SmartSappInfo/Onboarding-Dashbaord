# Migration Runbook: SchoolId to EntityId

## Overview

This runbook provides step-by-step instructions for migrating SmartSapp from the legacy `schoolId` identifier to the unified `entityId` architecture. The migration uses a dual-write pattern to maintain backward compatibility while progressively adopting the new entity model.

**Migration Duration**: Estimated 2-4 hours for production data (varies by dataset size)

**Rollback Time**: < 30 minutes per feature module

## Pre-Migration Checklist

### 1. Backup Verification

- [ ] Verify automated Firestore backups are enabled
- [ ] Create manual backup of production Firestore database
- [ ] Document backup location and retention policy
- [ ] Test backup restoration process in staging environment
- [ ] Verify backup includes all collections: tasks, activities, forms, invoices, meetings, surveys, message_logs, pdfs, automation_logs

**Command**:
```bash
# Export Firestore backup
gcloud firestore export gs://[BUCKET_NAME]/backups/pre-migration-$(date +%Y%m%d)
```

### 2. Index Creation

- [ ] Review required Firestore indexes in `docs/FIRESTORE_INDEXES.md`
- [ ] Deploy indexes to production using Firebase CLI
- [ ] Wait for all indexes to build (check Firebase Console)
- [ ] Verify index status shows "Enabled" for all new indexes

**Command**:
```bash
# Deploy indexes
firebase deploy --only firestore:indexes

# Check index status
firebase firestore:indexes
```

**Required Indexes** (14 total):
- tasks: workspaceId + entityId + dueDate
- activities: workspaceId + entityId + timestamp
- workspace_entities: workspaceId + entityType + status
- workspace_entities: workspaceId + pipelineId + stageId
- message_logs: workspaceId + entityId + createdAt
- forms: workspaceId + entityId + status
- invoices: organizationId + entityId + status
- meetings: workspaceId + entityId + startTime
- surveys: workspaceId + entityId + status
- pdfs: workspaceId + entityId + createdAt
- automation_logs: workspaceId + entityId + executedAt

### 3. Testing Verification

- [ ] Run full test suite in staging: `pnpm test:run`
- [ ] Run property-based tests: `pnpm test:run migration`
- [ ] Run E2E tests: `pnpm test:e2e`
- [ ] Verify all tests pass (0 failures)
- [ ] Test migration on staging data (full cycle: fetch → enrich → restore → verify → rollback)

### 4. Monitoring Setup

- [ ] Verify Sentry error tracking is configured
- [ ] Set up migration dashboard monitoring
- [ ] Configure alert thresholds (error rate > 5%)
- [ ] Verify migration logs are being written to Firestore
- [ ] Test alert notifications

### 5. Communication

- [ ] Notify team of migration schedule
- [ ] Schedule maintenance window (recommended: low-traffic period)
- [ ] Prepare rollback communication template
- [ ] Assign on-call engineer for migration monitoring

### 6. Access Verification

- [ ] Verify Firebase Admin SDK credentials are valid
- [ ] Test write access to all feature collections
- [ ] Test write access to backup collections
- [ ] Verify sufficient Firestore quota for batch operations

## Migration Execution

### Phase 1: Foundation Verification (15 minutes)

Verify that foundation components are deployed and functional.

#### Step 1.1: Verify Contact Adapter

```bash
# Navigate to seeds page
open https://[YOUR_DOMAIN]/seeds

# Check "System Health" section
# Verify Contact Adapter status: ✓ Operational
```

**Expected Result**: Contact Adapter resolves both legacy schools and migrated entities.

#### Step 1.2: Verify Migration Engine

```bash
# Check migration engine initialization
# Navigate to "Feature Data Migration" section
# Verify all 14 feature cards are displayed
```

**Expected Feature Cards**:
1. Tasks
2. Activities
3. Forms & Submissions
4. Invoices
5. Meetings
6. Surveys & Responses
7. Message Logs
8. PDFs
9. Automation Logs

### Phase 2: Feature Module Migration (2-3 hours)

Migrate each feature module using the Fetch → Enrich & Restore → Verify workflow.

#### Migration Order (Recommended)

Migrate in dependency order to minimize issues:

1. **Tasks** (foundational, widely used)
2. **Activities** (logging, low risk)
3. **Message Logs** (communication tracking)
4. **Forms & Submissions** (data collection)
5. **Surveys & Responses** (feedback)
6. **Meetings** (scheduling)
7. **PDFs** (document generation)
8. **Invoices** (billing)
9. **Automation Logs** (workflow tracking)

#### Per-Feature Migration Steps

For each feature module, follow this workflow:

##### Step 2.1: Fetch Unmigrated Records

1. Navigate to feature card on seeds page
2. Click **"Fetch"** button
3. Review fetch results:
   - Total records to migrate
   - Sample records (first 5)
   - Invalid records (if any)

**Expected Output**:
```
Fetch Results:
- Total records: 1,234
- Records to migrate: 856
- Invalid records: 0
- Sample: [displays 5 records with schoolId]
```

**Decision Point**: If invalid records > 0, investigate before proceeding.

##### Step 2.2: Enrich & Restore

1. Click **"Enrich & Restore"** button
2. Monitor real-time progress:
   - Percentage complete
   - Records processed
   - Current batch
   - Errors (if any)

**Expected Output**:
```
Migration Progress:
- Status: In Progress
- Processed: 450/856 (52%)
- Current Batch: 1/2
- Errors: 0
```

**Decision Point**: If error rate > 5%, pause and investigate.

##### Step 2.3: Verify Migration

1. Wait for "Enrich & Restore" to complete
2. Click **"Verify"** button
3. Review verification results:
   - Migrated records count
   - Unmigrated records count
   - Orphaned records count
   - Validation errors

**Expected Output**:
```
Verification Results:
- Migrated: 856
- Unmigrated: 0
- Orphaned: 0
- Validation Errors: 0
```

**Success Criteria**:
- Unmigrated = 0
- Orphaned = 0
- Validation Errors = 0

**Decision Point**: If verification fails, proceed to rollback.

##### Step 2.4: Smoke Testing

After each feature migration, perform smoke tests:

**Tasks**:
- [ ] Create new task with entity
- [ ] View task list filtered by entity
- [ ] Edit existing task
- [ ] Complete task

**Activities**:
- [ ] Log new activity for entity
- [ ] View activity timeline
- [ ] Filter activities by entity

**Forms**:
- [ ] Create form for entity
- [ ] Submit form response
- [ ] View form submissions

**Invoices**:
- [ ] Create invoice for entity
- [ ] View invoice list
- [ ] Generate invoice PDF

**Meetings**:
- [ ] Schedule meeting with entity
- [ ] View meeting calendar
- [ ] Access public meeting page

**Surveys**:
- [ ] Create survey for entity
- [ ] Submit survey response
- [ ] View survey results

**Messages**:
- [ ] Send message to entity
- [ ] View message history

**PDFs**:
- [ ] Generate PDF for entity
- [ ] View PDF list

**Automations**:
- [ ] Trigger automation for entity
- [ ] View automation logs

### Phase 3: Post-Migration Validation (30 minutes)

#### Step 3.1: Data Integrity Checks

Run comprehensive verification across all features:

```bash
# Navigate to Migration Dashboard
open https://[YOUR_DOMAIN]/seeds#migration-dashboard

# Check "Migration Summary" section
# Verify all features show "Completed" status
```

**Expected Summary**:
```
Migration Summary:
- Total Features: 9
- Completed: 9
- Failed: 0
- Total Records Migrated: 5,432
- Success Rate: 100%
```

#### Step 3.2: Query Performance Testing

Test query performance with new indexes:

```bash
# Run performance tests
pnpm test:run performance

# Expected: All queries < 1000ms
```

#### Step 3.3: Contact Adapter Verification

Verify Contact Adapter handles both legacy and migrated data:

```bash
# Run adapter tests
pnpm test:run contact-adapter

# Expected: All tests pass
```

#### Step 3.4: End-to-End User Flows

Test critical user workflows:

- [ ] User logs in and views dashboard
- [ ] User creates new contact (entity)
- [ ] User assigns contact to pipeline stage
- [ ] User creates task for contact
- [ ] User logs activity for contact
- [ ] User sends message to contact
- [ ] User generates invoice for contact
- [ ] User schedules meeting with contact

#### Step 3.5: Monitor Error Rates

Check Sentry for migration-related errors:

```bash
# Check Sentry dashboard
open https://sentry.io/organizations/[ORG]/issues/

# Filter by: last 1 hour, tag:migration
# Expected: 0 errors
```

### Phase 4: Cleanup (15 minutes)

#### Step 4.1: Review Migration Logs

```bash
# Check migration logs in Firestore
# Collection: migration_logs
# Filter: timestamp > [migration_start_time]

# Review for any warnings or errors
```

#### Step 4.2: Archive Backup Collections

Backup collections are retained for 90 days:

- `backup_tasks_entity_migration`
- `backup_activities_entity_migration`
- `backup_forms_entity_migration`
- `backup_form_submissions_entity_migration`
- `backup_invoices_entity_migration`
- `backup_meetings_entity_migration`
- `backup_surveys_entity_migration`
- `backup_survey_responses_entity_migration`
- `backup_message_logs_entity_migration`
- `backup_pdfs_entity_migration`
- `backup_automation_logs_entity_migration`

**Cleanup Script** (run after 90 days):
```bash
pnpm run cleanup:migration-backups
```

#### Step 4.3: Update Documentation

- [ ] Mark migration as complete in project docs
- [ ] Update API documentation to reflect entityId as primary
- [ ] Update developer guide with entity-first patterns
- [ ] Archive this runbook with completion date

## Rollback Procedures

### When to Rollback

Rollback if any of the following occur:

- Error rate > 5% during migration
- Orphaned records detected in verification
- Critical functionality broken in smoke tests
- Query performance degraded > 50%
- Data integrity issues discovered

### Rollback Steps

#### Per-Feature Rollback

1. Navigate to feature card on seeds page
2. Click **"Rollback"** button
3. Confirm rollback action
4. Monitor rollback progress
5. Verify rollback completion

**Expected Output**:
```
Rollback Results:
- Total Restored: 856
- Failed: 0
- Backup Collection Deleted: Yes
```

#### Full Migration Rollback

To rollback all features:

1. Navigate to Migration Dashboard
2. Click **"Rollback All Features"** button
3. Confirm action (requires admin password)
4. Monitor progress for each feature
5. Verify all features rolled back

**Rollback Duration**: ~5 minutes per feature (45 minutes total)

#### Post-Rollback Verification

- [ ] Verify all entityId and entityType fields removed
- [ ] Verify schoolId fields intact
- [ ] Run smoke tests with schoolId
- [ ] Check error rates in Sentry
- [ ] Verify backup collections deleted

#### Rollback Communication

```
Subject: Migration Rollback Completed

The SchoolId to EntityId migration has been rolled back due to [REASON].

Status:
- All features restored to pre-migration state
- Data integrity verified
- No data loss occurred

Next Steps:
- [DESCRIBE INVESTIGATION PLAN]
- [DESCRIBE RETRY TIMELINE]

Contact [ON-CALL ENGINEER] with questions.
```

## Troubleshooting

### Issue: High Error Rate During Migration

**Symptoms**: Error rate > 5% during enrich & restore

**Diagnosis**:
1. Check migration logs for error patterns
2. Identify common error messages
3. Check if specific schoolIds are failing

**Solutions**:
- **Missing schoolId**: Skip records, log for manual review
- **Invalid entityId format**: Fix generation logic, retry
- **Firestore quota exceeded**: Reduce batch size, retry
- **Network timeout**: Increase timeout, retry failed batch

### Issue: Orphaned Records Detected

**Symptoms**: Verification shows orphaned records > 0

**Diagnosis**:
1. Query orphaned records: `entityId` exists but entity doesn't
2. Check if entities were deleted after migration
3. Verify entity collection integrity

**Solutions**:
- **Entities deleted**: Restore entities from backup
- **Invalid entityId**: Regenerate entityId, re-migrate
- **Data corruption**: Rollback, investigate, retry

### Issue: Query Performance Degraded

**Symptoms**: Queries taking > 2000ms after migration

**Diagnosis**:
1. Check if indexes are built (Firebase Console)
2. Verify query uses indexed fields
3. Check Firestore metrics for hot spots

**Solutions**:
- **Indexes not built**: Wait for index build completion
- **Missing index**: Add index, deploy, wait for build
- **Query not optimized**: Refactor query to use indexes

### Issue: Contact Adapter Errors

**Symptoms**: UI shows "Contact not found" errors

**Diagnosis**:
1. Check if entityId exists in entities collection
2. Check if workspace_entity exists for workspace
3. Verify Contact Adapter cache

**Solutions**:
- **Entity missing**: Create entity from school data
- **Workspace_entity missing**: Create workspace_entity link
- **Cache stale**: Clear cache, retry

### Issue: Dual-Write Inconsistency

**Symptoms**: Records have entityId but missing schoolId

**Diagnosis**:
1. Check if school was deleted
2. Verify dual-write logic in server actions
3. Check migration enrichment logic

**Solutions**:
- **School deleted**: Acceptable (entity-only mode)
- **Dual-write bug**: Fix server action, re-migrate
- **Enrichment bug**: Fix enrichment logic, re-migrate

## FAQ

### Q: Can I migrate features in parallel?

**A**: No. Migrate features sequentially to isolate issues and simplify rollback.

### Q: How long do backup collections persist?

**A**: 90 days. After that, run cleanup script to delete backups.

### Q: Can I re-run migration on the same feature?

**A**: Yes. Migration is idempotent. Already-migrated records are skipped.

### Q: What happens to new records created during migration?

**A**: New records use dual-write pattern and include both schoolId and entityId. They are skipped during migration.

### Q: Can I rollback a single feature?

**A**: Yes. Each feature can be rolled back independently.

### Q: What if a school doesn't have an entityId?

**A**: Migration generates one using format `entity_<schoolId>`.

### Q: Do I need to migrate all features at once?

**A**: No. You can migrate features incrementally over multiple sessions.

### Q: How do I know if migration is complete?

**A**: Verification shows 0 unmigrated records for all features.

### Q: Can users continue working during migration?

**A**: Yes. Dual-write pattern maintains functionality. However, schedule during low-traffic period for safety.

### Q: What if I discover issues after 90 days?

**A**: Backup collections are deleted after 90 days. Ensure thorough testing before cleanup.

## Success Criteria

Migration is considered successful when:

- [ ] All 9 feature modules show "Completed" status
- [ ] Verification shows 0 unmigrated records
- [ ] Verification shows 0 orphaned records
- [ ] All smoke tests pass
- [ ] Query performance < 1000ms
- [ ] Error rate < 1% in Sentry
- [ ] Contact Adapter resolves all contacts
- [ ] End-to-end user flows work correctly

## Post-Migration

### Monitoring Period

Monitor for 7 days after migration:

- Daily error rate checks in Sentry
- Daily query performance checks
- User feedback collection
- Data integrity spot checks

### Deprecation Timeline

After successful migration:

- **Week 1-4**: Monitor and stabilize
- **Week 5-8**: Update documentation to prefer entityId
- **Week 9-12**: Add deprecation warnings for schoolId APIs
- **Month 4-6**: Plan removal of schoolId fields (future phase)

### Documentation Updates

- [ ] Update API docs to show entityId as primary
- [ ] Update developer guide with entity-first examples
- [ ] Update architecture docs with migration completion
- [ ] Archive this runbook with completion date

## Support

For migration support:

- **Technical Issues**: [ON-CALL ENGINEER]
- **Data Issues**: [DATA TEAM]
- **User Issues**: [SUPPORT TEAM]
- **Escalation**: [ENGINEERING MANAGER]

## Appendix

### A. Firestore Batch Limits

- Max operations per batch: 500
- Migration batch size: 450 (safety margin)
- Max document size: 1 MB
- Max concurrent connections: 100

### B. Migration Metrics

Track these metrics during migration:

- Records processed per minute
- Error rate (%)
- Average batch processing time
- Query performance (p50, p95, p99)
- Firestore read/write operations
- Memory usage
- CPU usage

### C. Emergency Contacts

- **On-Call Engineer**: [PHONE]
- **Engineering Manager**: [PHONE]
- **CTO**: [PHONE]
- **Firebase Support**: [SUPPORT LINK]

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-28  
**Owner**: Engineering Team
