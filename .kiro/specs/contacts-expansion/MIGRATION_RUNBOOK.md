# SmartSapp Contacts Expansion - Migration Runbook

**Version**: 1.0  
**Last Updated**: January 2025  
**Migration Date**: [TO BE SCHEDULED]

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Migration Checks](#pre-migration-checks)
3. [Migration Execution](#migration-execution)
4. [Post-Migration Verification](#post-migration-verification)
5. [Rollback Procedure](#rollback-procedure)
6. [Troubleshooting](#troubleshooting)

---

## Overview

### Purpose

This runbook provides step-by-step instructions for migrating existing `schools` collection data to the new `entities` + `workspace_entities` architecture.

### Migration Scope

- **Source**: `schools` collection (legacy)
- **Target**: `entities` + `workspace_entities` collections (new)
- **Estimated Records**: ~1000 schools
- **Estimated Duration**: 30-60 minutes
- **Downtime Required**: None (migration runs in background)

### Migration Strategy

1. **Idempotent**: Can be run multiple times safely
2. **Non-Destructive**: Legacy `schools` collection remains intact
3. **Backward Compatible**: Adapter layer ensures existing features continue working
4. **Incremental**: Processes schools in batches with error handling

### Team Roles

- **Migration Lead**: Executes migration script, monitors progress
- **Database Admin**: Monitors Firestore performance, index status
- **QA Lead**: Verifies data integrity post-migration
- **Product Owner**: Approves go/no-go decisions
- **On-Call Engineer**: Available for emergency rollback

---

## Pre-Migration Checks

### 1. Environment Verification

**Objective**: Ensure production environment is ready

```bash
# Verify Firebase project
firebase use production
firebase projects:list

# Verify current project
echo "Current project: $(firebase use)"
```

**Checklist**:
- [ ] Connected to correct Firebase project
- [ ] Production credentials configured
- [ ] Migration script deployed to production environment

### 2. Firestore Indexes Status

**Objective**: Verify all required indexes are READY

```bash
# Check index status
firebase firestore:indexes

# Expected output: All indexes show "READY" status
```

**Required Indexes**:
- [ ] `workspace_entities (workspaceId, status)` - READY
- [ ] `workspace_entities (workspaceId, stageId)` - READY
- [ ] `workspace_entities (workspaceId, assignedTo)` - READY
- [ ] `workspace_entities (workspaceId, workspaceTags)` - READY
- [ ] `entities (organizationId, entityType)` - READY
- [ ] `entities (organizationId, globalTags)` - READY

**If any index is BUILDING**: Wait for completion before proceeding

### 3. Security Rules Deployment

**Objective**: Verify security rules are deployed

```bash
# Deploy security rules
firebase deploy --only firestore:rules

# Verify deployment
firebase firestore:rules
```

**Checklist**:
- [ ] `entities` collection rules deployed
- [ ] `workspace_entities` collection rules deployed
- [ ] ScopeGuard enforced in rules

### 4. Backup Verification

**Objective**: Ensure recent backup exists

```bash
# Verify Firestore backups
gcloud firestore operations list --project=<project-id>

# Check last backup timestamp
```

**Checklist**:
- [ ] Backup exists within last 24 hours
- [ ] Backup includes `schools` collection
- [ ] Backup restoration procedure documented

### 5. Dry Run Execution

**Objective**: Validate migration logic without writes

```bash
# Run migration in dry-run mode
npm run migrate:schools -- --dry-run

# Review output
```

**Expected Output**:
```
Found 1000 schools to migrate
Processing batch 1/10...
Processing batch 2/10...
...
=== Migration Summary (DRY RUN) ===
Total schools: 1000
Would migrate: 1000
Would skip: 0
Errors: 0
```

**Checklist**:
- [-] Dry run completes without errors
- [ ] All schools would be migrated
- [ ] No unexpected edge cases
- [ ] Summary report looks correct

### 6. Team Notification

**Objective**: Notify team of migration start

**Checklist**:
- [ ] Migration window communicated to team
- [ ] All team members available
- [ ] Slack channel created for migration updates
- [ ] Escalation path defined

---


## Migration Execution

### Step 1: Start Migration

**Time**: T+0 minutes

```bash
# Navigate to project directory
cd /path/to/smartsapp

# Verify environment
firebase use production
echo "Starting migration at $(date)"

# Start migration script
npm run migrate:schools 2>&1 | tee migration-$(date +%Y%m%d-%H%M%S).log
```

**Expected Output**:
```
Starting migration...
Found 1000 schools to migrate
Processing school 1/1000: school_abc123
✓ Migrated school_abc123 → entity_school_abc123
Processing school 2/1000: school_def456
✓ Migrated school_def456 → entity_school_def456
...
```

**Checklist**:
- [ ] Migration script started successfully
- [ ] Log file created
- [ ] Progress updates appearing in console

### Step 2: Monitor Progress

**Time**: T+0 to T+60 minutes

**Real-Time Monitoring**:
```bash
# In separate terminal, monitor Firestore operations
watch -n 5 'gcloud firestore operations list --project=<project-id> --limit=10'

# Monitor error logs
tail -f migration-*.log | grep "✗"
```

**Metrics to Track**:
- [ ] Schools processed per minute: ___ (target: 20-30)
- [ ] Success rate: ___% (target: > 99%)
- [ ] Error count: ___ (target: < 10)
- [ ] Firestore write operations: ___ per second

**Progress Checkpoints**:
- [ ] 25% complete (250 schools) - Time: ___
- [ ] 50% complete (500 schools) - Time: ___
- [ ] 75% complete (750 schools) - Time: ___
- [ ] 100% complete (1000 schools) - Time: ___

**Red Flags** (Trigger investigation):
- Success rate drops below 95%
- Error count exceeds 50
- Migration stalls for > 5 minutes
- Firestore quota errors

### Step 3: Review Summary Report

**Time**: T+60 minutes (after completion)

**Expected Output**:
```
=== Migration Summary ===
Total schools: 1000
Succeeded: 995
Failed: 5
Skipped: 0

Errors:
  school_xyz789: Invalid workspaceIds array
  school_abc321: Missing organizationId
  school_def654: Firestore timeout
  school_ghi987: Permission denied
  school_jkl246: Invalid contacts array
```

**Checklist**:
- [ ] Success rate > 99%: ___% (995/1000 = 99.5%)
- [ ] Failed schools documented: ___ schools
- [ ] Error reasons reviewed
- [ ] Summary report saved to file

**Decision Point**:
- **If success rate > 99%**: Proceed to Step 4
- **If success rate < 99%**: Investigate failures, fix issues, re-run migration for failed schools

### Step 4: Re-Run for Failed Schools (If Needed)

**Time**: T+70 minutes

```bash
# Extract failed school IDs from log
grep "✗ Failed" migration-*.log | awk '{print $4}' > failed-schools.txt

# Re-run migration for specific schools
npm run migrate:schools -- --schools-file=failed-schools.txt
```

**Checklist**:
- [ ] Failed schools identified
- [ ] Root causes fixed
- [ ] Re-run completed
- [ ] Final success rate > 99%

---

## Post-Migration Verification

### Verification 1: Data Integrity

**Objective**: Verify all schools migrated correctly

```bash
# Run verification script
npm run verify:migration
```

**Expected Output**:
```
=== Migration Verification ===
Total schools: 1000
Migrated schools: 995
Unmigrated schools: 5

Checking entities collection...
✓ 995 entities created
✓ All entities have correct entityType
✓ All entities have organizationId

Checking workspace_entities collection...
✓ 1,245 workspace_entities created (some schools in multiple workspaces)
✓ All workspace_entities have correct workspaceId
✓ All workspace_entities have correct entityId

Checking migrationStatus...
✓ 995 schools marked as "migrated"
✓ 5 schools remain "legacy"
```

**Checklist**:
- [ ] Entity count matches migrated school count
- [ ] Workspace_entities count >= entity count (multi-workspace schools)
- [ ] All migrated schools have `migrationStatus: "migrated"`
- [ ] All entities have valid `entityType`
- [ ] All workspace_entities have valid `workspaceId`

### Verification 2: Sample Data Spot Check

**Objective**: Manually verify 5 random schools

**Process**:
1. Select 5 random schools from migration log
2. For each school:
   - [ ] Verify entity document exists
   - [ ] Verify entity data matches school data
   - [ ] Verify workspace_entities documents exist for all workspaces
   - [ ] Verify workspace_entities data matches school data
   - [ ] Verify `migrationStatus: "migrated"` on school document

**Sample Schools**:
1. School ID: __________ - ✓ Verified
2. School ID: __________ - ✓ Verified
3. School ID: __________ - ✓ Verified
4. School ID: __________ - ✓ Verified
5. School ID: __________ - ✓ Verified

### Verification 3: Adapter Layer Test

**Objective**: Verify adapter layer resolves migrated schools correctly

```bash
# Run adapter layer tests
npm test -- adapter-layer.test.ts
```

**Expected Output**:
```
PASS src/lib/__tests__/adapter-layer.test.ts
  ✓ resolveContact returns entity data for migrated school
  ✓ resolveContact returns school data for legacy school
  ✓ resolveContact combines entity + workspace_entities correctly
  ✓ resolveContact handles missing schools gracefully
```

**Checklist**:
- [ ] All adapter layer tests pass
- [ ] Migrated schools resolved from entities + workspace_entities
- [ ] Legacy schools resolved from schools collection
- [ ] No errors in adapter layer

### Verification 4: Existing Features Test

**Objective**: Verify existing features work with migrated data

**Test Cases**:
1. **Activity Logging**:
   - [ ] Create activity for migrated school
   - [ ] Verify activity includes both `schoolId` and `entityId`
   - [ ] Verify activity displays correctly in UI

2. **Task Management**:
   - [ ] Create task for migrated school
   - [ ] Verify task includes both `schoolId` and `entityId`
   - [ ] Verify task displays correctly in task list

3. **Messaging**:
   - [ ] Send message to migrated school
   - [ ] Verify message log includes `workspaceId`
   - [ ] Verify message variables resolve correctly

4. **Automations**:
   - [ ] Trigger automation for migrated school
   - [ ] Verify automation event includes `workspaceId` and `entityId`
   - [ ] Verify automation actions execute correctly

5. **PDF Forms**:
   - [ ] Generate PDF for migrated school
   - [ ] Verify PDF includes both `schoolId` and `entityId`

**Checklist**:
- [ ] All existing features work with migrated schools
- [ ] No errors in feature integration
- [ ] Dual-write populates both legacy and new fields

### Verification 5: Performance Check

**Objective**: Verify query performance meets targets

```bash
# Run performance tests
npm run test:performance
```

**Metrics**:
- [ ] Workspace list query: ___ ms (target: < 1000ms)
- [ ] Contact detail page load: ___ ms (target: < 1000ms)
- [ ] Denormalization sync: ___ ms for 100 records (target: < 5000ms)

**Checklist**:
- [ ] All performance targets met
- [ ] No slow query warnings in Firestore logs
- [ ] Denormalized fields populated correctly

### Verification 6: Security Rules Test

**Objective**: Verify security rules enforce workspace boundaries

**Test Cases**:
1. **Workspace Isolation**:
   - [ ] User in Workspace A cannot read entities from Workspace B
   - [ ] User without workspace access cannot read workspace_entities

2. **ScopeGuard Enforcement**:
   - [ ] Attempt to create workspace_entity with mismatched entityType (should fail)
   - [ ] Verify error message is clear

3. **Permission Checks**:
   - [ ] User without `schools_edit` permission cannot create entities
   - [ ] User without workspace access cannot update workspace_entities

**Checklist**:
- [ ] All security rules enforced correctly
- [ ] No permission leakage detected
- [ ] ScopeGuard rejects mismatched types

---


## Rollback Procedure

### When to Rollback

**Critical Triggers** (Immediate rollback required):
- Success rate < 95%
- Data loss detected
- Critical security vulnerability
- System-wide errors
- Firestore quota exceeded

**Non-Critical Triggers** (Investigate first, rollback if unresolved):
- Success rate 95-99%
- Isolated feature failures
- Performance degradation
- User-reported issues

### Rollback Decision Matrix

| Success Rate | Action |
|--------------|--------|
| > 99% | Proceed, investigate failures separately |
| 95-99% | Investigate, fix issues, re-run for failed schools |
| < 95% | **ROLLBACK IMMEDIATELY** |

### Rollback Steps

#### Step 1: Stop Migration (If Running)

```bash
# If migration is still running, stop it
Ctrl+C

# Verify no migration processes running
ps aux | grep migrate
```

#### Step 2: Assess Impact

**Questions to Answer**:
- [ ] How many schools were migrated? ___
- [ ] How many schools failed? ___
- [ ] Are any entities corrupted? ___
- [ ] Are any workspace_entities corrupted? ___
- [ ] Are existing features broken? ___

#### Step 3: Disable New Features

```bash
# Disable new workspace creation UI
# (Deploy code with feature flag disabled)
firebase deploy --only hosting
```

**Checklist**:
- [ ] New workspace creation disabled
- [ ] Users cannot create institution/family/person workspaces
- [ ] Existing workspaces continue working

#### Step 4: Revert Code (If Necessary)

**Only if existing features are broken**:

```bash
# Revert to previous deployment
git revert <migration-commit-hash>
git push origin main

# Deploy reverted code
firebase deploy
```

**Checklist**:
- [ ] Code reverted to pre-migration state
- [ ] Deployment successful
- [ ] Existing features working

#### Step 5: Clean Up Partial Migration (Optional)

**Only if data corruption detected**:

```bash
# Delete entities created during failed migration
npm run cleanup:migration -- --start-date=<migration-start-time>

# Verify cleanup
npm run verify:cleanup
```

**Checklist**:
- [ ] Corrupted entities deleted
- [ ] Corrupted workspace_entities deleted
- [ ] Schools collection intact
- [ ] No data loss

#### Step 6: Reset Migration Status

```bash
# Reset migrationStatus for all schools
npm run reset:migration-status
```

**Expected Output**:
```
Resetting migrationStatus for 1000 schools...
✓ Reset 995 schools from "migrated" to "legacy"
✓ 5 schools already "legacy"
```

**Checklist**:
- [ ] All schools have `migrationStatus: "legacy"`
- [ ] Adapter layer resolves from schools collection
- [ ] Existing features working

#### Step 7: Notify Team

**Communication**:
- [ ] Post rollback announcement in Slack
- [ ] Email stakeholders with rollback summary
- [ ] Schedule post-mortem meeting

**Rollback Summary Template**:
```
Migration Rollback Summary

Date: [DATE]
Time: [TIME]
Reason: [REASON]

Impact:
- Schools migrated: [COUNT]
- Schools rolled back: [COUNT]
- Data loss: [YES/NO]
- Downtime: [DURATION]

Next Steps:
- [ACTION 1]
- [ACTION 2]
- [ACTION 3]

Post-Mortem: [DATE/TIME]
```

---

## Troubleshooting

### Issue 1: Migration Script Fails to Start

**Symptoms**:
- Script exits immediately
- Error: "Cannot connect to Firestore"

**Diagnosis**:
```bash
# Check Firebase project
firebase use

# Check credentials
echo $GOOGLE_APPLICATION_CREDENTIALS

# Test Firestore connection
npm run test:firestore-connection
```

**Solutions**:
- [ ] Verify correct Firebase project selected
- [ ] Verify credentials configured
- [ ] Verify network connectivity
- [ ] Verify Firestore API enabled

### Issue 2: High Failure Rate

**Symptoms**:
- Success rate < 99%
- Many schools failing with same error

**Diagnosis**:
```bash
# Analyze error patterns
grep "✗ Failed" migration-*.log | awk '{print $NF}' | sort | uniq -c | sort -rn
```

**Common Errors**:

1. **"Invalid workspaceIds array"**
   - **Cause**: School has malformed workspaceIds
   - **Solution**: Fix workspaceIds in schools collection, re-run migration

2. **"Missing organizationId"**
   - **Cause**: School missing required field
   - **Solution**: Backfill organizationId, re-run migration

3. **"Firestore timeout"**
   - **Cause**: Network issues or Firestore overload
   - **Solution**: Reduce batch size, add retry logic, re-run migration

4. **"Permission denied"**
   - **Cause**: Security rules blocking write
   - **Solution**: Verify security rules, verify credentials, re-run migration

### Issue 3: Denormalization Not Syncing

**Symptoms**:
- Entity name updated but workspace_entities.displayName not updated
- Denormalized fields out of sync

**Diagnosis**:
```bash
# Check denormalization sync logs
npm run test:denormalization-sync

# Manually trigger sync for specific entity
npm run sync:entity -- --entity-id=<entity-id>
```

**Solutions**:
- [ ] Verify `syncDenormalizedFields` function called after entity updates
- [ ] Verify batch writes completing successfully
- [ ] Manually trigger sync for affected entities

### Issue 4: Adapter Layer Not Resolving Correctly

**Symptoms**:
- Existing features showing wrong data
- Activities/tasks not displaying correctly

**Diagnosis**:
```bash
# Test adapter layer
npm test -- adapter-layer.test.ts

# Check migrationStatus
npm run check:migration-status -- --school-id=<school-id>
```

**Solutions**:
- [ ] Verify `migrationStatus` set correctly on schools
- [ ] Verify `entityId` field populated on schools
- [ ] Verify adapter layer logic correct
- [ ] Clear cache if applicable

### Issue 5: Performance Degradation

**Symptoms**:
- Workspace list queries slow (> 2 seconds)
- Contact detail pages slow to load

**Diagnosis**:
```bash
# Check Firestore indexes
firebase firestore:indexes

# Check query performance
npm run test:query-performance
```

**Solutions**:
- [ ] Verify all indexes are READY
- [ ] Verify denormalized fields populated
- [ ] Verify query patterns use indexes
- [ ] Add missing indexes if needed

### Issue 6: Security Rules Blocking Valid Operations

**Symptoms**:
- Users cannot create entities
- Users cannot read workspace_entities
- Permission denied errors

**Diagnosis**:
```bash
# Test security rules
npm run test:security-rules

# Check user permissions
npm run check:user-permissions -- --user-id=<user-id>
```

**Solutions**:
- [ ] Verify user has `schools_edit` permission
- [ ] Verify user has workspace access
- [ ] Verify `user.workspaceIds` array up to date
- [ ] Verify security rules deployed correctly

---

## Post-Migration Tasks

### Immediate (Day 1)

- [ ] Monitor error logs for 24 hours
- [ ] Review user feedback
- [ ] Fix any critical issues
- [ ] Update migration status dashboard

### Short-Term (Week 1)

- [ ] Investigate all failed schools
- [ ] Re-run migration for failed schools
- [ ] Optimize query performance if needed
- [ ] Gather user feedback on new features

### Long-Term (Month 1)

- [ ] Analyze migration metrics
- [ ] Document lessons learned
- [ ] Update migration runbook based on experience
- [ ] Plan for legacy schools collection deprecation

---

## Migration Metrics

### Success Metrics

- [ ] Success rate: ___% (target: > 99%)
- [ ] Total schools migrated: ___ / ___
- [ ] Total entities created: ___
- [ ] Total workspace_entities created: ___
- [ ] Migration duration: ___ minutes (target: < 60)
- [ ] Downtime: ___ minutes (target: 0)

### Performance Metrics

- [ ] Schools processed per minute: ___ (target: 20-30)
- [ ] Average entity creation time: ___ ms
- [ ] Average workspace_entity creation time: ___ ms
- [ ] Firestore write operations: ___ per second

### Quality Metrics

- [ ] Data integrity: ___% (target: 100%)
- [ ] Denormalization sync success: ___% (target: 100%)
- [ ] Adapter layer test pass rate: ___% (target: 100%)
- [ ] Security rules test pass rate: ___% (target: 100%)

---

## Contact Information

### Migration Team

- **Migration Lead**: [NAME] - [EMAIL] - [PHONE]
- **Database Admin**: [NAME] - [EMAIL] - [PHONE]
- **QA Lead**: [NAME] - [EMAIL] - [PHONE]
- **Product Owner**: [NAME] - [EMAIL] - [PHONE]
- **On-Call Engineer**: [NAME] - [EMAIL] - [PHONE]

### Escalation Path

1. **Level 1**: Migration Lead
2. **Level 2**: Database Admin + QA Lead
3. **Level 3**: Product Owner + On-Call Engineer
4. **Level 4**: CTO

### Communication Channels

- **Slack**: #migration-contacts-expansion
- **Email**: migration-team@smartsapp.com
- **Phone**: [EMERGENCY HOTLINE]

---

## Appendix

### Migration Script Usage

```bash
# Basic usage
npm run migrate:schools

# Dry run (no writes)
npm run migrate:schools -- --dry-run

# Migrate specific schools
npm run migrate:schools -- --schools-file=schools.txt

# Migrate with custom batch size
npm run migrate:schools -- --batch-size=50

# Verbose logging
npm run migrate:schools -- --verbose
```

### Verification Script Usage

```bash
# Verify migration completeness
npm run verify:migration

# Verify specific school
npm run verify:migration -- --school-id=<school-id>

# Verify data integrity
npm run verify:data-integrity

# Verify adapter layer
npm run verify:adapter-layer
```

### Cleanup Script Usage

```bash
# Clean up failed migration
npm run cleanup:migration

# Clean up specific entities
npm run cleanup:migration -- --entity-ids=<id1>,<id2>,<id3>

# Reset migration status
npm run reset:migration-status
```

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: After migration completion
