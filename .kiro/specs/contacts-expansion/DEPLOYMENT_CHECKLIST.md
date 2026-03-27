# SmartSapp Contacts Expansion - Deployment Checklist

**Version**: 1.0  
**Last Updated**: January 2025  
**Deployment Date**: [TO BE SCHEDULED]

---

## Pre-Deployment Checklist

### Code Quality

- [ ] All TypeScript compiles without errors
- [ ] No ESLint warnings or errors
- [ ] All unit tests pass (200+ tests)
- [ ] All 8 property-based tests pass
- [ ] All integration tests pass
- [ ] Code review completed and approved
- [ ] No console.log statements in production code
- [ ] All TODO comments resolved or documented

### Data Model

- [ ] `entities` collection schema validated
- [ ] `workspace_entities` collection schema validated
- [ ] All TypeScript interfaces match Firestore schema
- [ ] Migration script tested on production-like data
- [ ] Migration script idempotency verified
- [ ] Denormalization sync logic tested

### Firestore Indexes

- [ ] All required indexes defined in `firestore.indexes.json`
- [ ] Indexes deployed to staging environment
- [ ] Index build status: All indexes READY
- [ ] Query performance tested with indexes
- [ ] No missing index errors in staging logs

**Required Indexes**:
```
workspace_entities:
  - (workspaceId, status)
  - (workspaceId, stageId)
  - (workspaceId, assignedTo)
  - (workspaceId, workspaceTags array-contains)

entities:
  - (organizationId, entityType)
  - (organizationId, globalTags array-contains)
```

**Verification Command**:
```bash
firebase firestore:indexes
```

### Security Rules

- [ ] Security rules updated in `firestore.rules`
- [ ] `entities` collection rules deployed
- [ ] `workspace_entities` collection rules deployed
- [ ] ScopeGuard enforced in security rules
- [ ] Workspace-scoped permissions tested
- [ ] Permission leakage tests pass
- [ ] Access revocation immediately effective

**Verification**:
```bash
firebase deploy --only firestore:rules
```

### Backward Compatibility

- [ ] Adapter layer implemented and tested
- [ ] `resolveContact` function works with legacy schools
- [ ] Activity logger supports dual-write
- [ ] Task system supports dual-write
- [ ] Messaging engine supports dual-write
- [ ] Automation engine supports dual-write
- [ ] PDF forms support dual-write
- [ ] Surveys support dual-write
- [ ] Meetings continue using schoolSlug

### Testing

- [ ] Property 1: ScopeGuard Invariant - PASS
- [ ] Property 2: Pipeline State Isolation - PASS
- [ ] Property 3: Scope Immutability After Activation - PASS
- [ ] Property 4: Tag Partition Invariant - PASS
- [ ] Property 5: Denormalization Consistency - PASS
- [ ] Property 6: Import Round-Trip - PASS
- [ ] Property 7: Migration Idempotency - PASS
- [ ] Property 8: Workspace Query Isolation - PASS
- [ ] Integration tests: All existing features work with adapter
- [ ] Integration tests: All three entity types can be created
- [ ] Integration tests: Workspace switching works correctly
- [ ] Integration tests: Migration script tested on production-like data

---

## Staging Environment Testing

### Environment Setup

- [ ] Staging environment configured
- [ ] Firestore indexes deployed to staging
- [ ] Security rules deployed to staging
- [ ] Test data loaded (5+ schools, 3+ workspaces)
- [ ] Test users created with various permission levels

### Functional Testing

#### Institution Workspace
- [ ] Create institution workspace
- [ ] Add institution entity
- [ ] Link entity to workspace
- [ ] Move through pipeline stages
- [ ] Apply global tags
- [ ] Apply workspace tags
- [ ] Create tasks
- [ ] Log activities
- [ ] Send messages
- [ ] Trigger automations
- [ ] Export to CSV
- [ ] Import from CSV

#### Family Workspace
- [ ] Create family workspace
- [ ] Add family entity with guardians
- [ ] Add children to family
- [ ] Link entity to workspace
- [ ] Move through admissions pipeline
- [ ] Apply workspace tags
- [ ] Create tasks
- [ ] Log activities
- [ ] Export to CSV
- [ ] Import from CSV

#### Person Workspace
- [ ] Create person workspace
- [ ] Add person entity
- [ ] Link entity to workspace
- [ ] Move through sales pipeline
- [ ] Apply workspace tags
- [ ] Create tasks
- [ ] Send messages
- [ ] Export to CSV
- [ ] Import from CSV

### Scope Enforcement Testing

- [ ] Attempt to add family to institution workspace (should fail)
- [ ] Attempt to add institution to family workspace (should fail)
- [ ] Attempt to add person to institution workspace (should fail)
- [ ] Verify error messages are clear and actionable
- [ ] Attempt to change workspace scope after adding entity (should fail)
- [ ] Verify scope lock indicator appears in UI

### Multi-Workspace Testing

- [ ] Link same entity to 2+ workspaces
- [ ] Verify independent pipeline state per workspace
- [ ] Verify independent workspace tags per workspace
- [ ] Verify workspace query isolation
- [ ] Update entity name in one workspace
- [ ] Verify denormalized fields sync across all workspaces

### Migration Testing

- [ ] Run migration script in dry-run mode
- [ ] Review dry-run summary report
- [ ] Run migration script in live mode on staging
- [ ] Verify all schools migrated successfully
- [ ] Verify entities created correctly
- [ ] Verify workspace_entities created correctly
- [ ] Verify migrationStatus set to "migrated"
- [ ] Run migration script again (idempotency test)
- [ ] Verify no duplicate entities created
- [ ] Verify adapter layer resolves migrated schools correctly

### Performance Testing

- [ ] Workspace list query: Max 2 Firestore reads
- [ ] Contact detail page: Load time < 1 second
- [ ] Denormalization sync: Completes within 5 seconds for 100 workspace_entities
- [ ] Migration script: Processes 1000 schools in < 10 minutes
- [ ] No slow query warnings in Firestore logs

### Security Testing

- [ ] User in Workspace A cannot read entities from Workspace B
- [ ] User without schools_edit permission cannot create entities
- [ ] User without workspace access cannot read workspace_entities
- [ ] Workspace access revocation immediately denies access
- [ ] ScopeGuard enforced in security rules (direct SDK writes rejected)

---

## Production Deployment Plan

### Phase 1: Deploy Code (No Migration)

**Objective**: Deploy new code with adapter layer, no user-facing changes

**Steps**:
1. [ ] Merge feature branch to main
2. [ ] Deploy to production: `firebase deploy`
3. [ ] Verify deployment successful
4. [ ] Monitor error logs for 1 hour
5. [ ] Verify existing features continue working
6. [ ] No user-facing changes visible

**Rollback Trigger**: Any critical errors in logs, existing features broken

### Phase 2: Deploy Firestore Indexes

**Objective**: Create required indexes for new collections

**Steps**:
1. [ ] Deploy indexes: `firebase deploy --only firestore:indexes`
2. [ ] Monitor index build status
3. [ ] Wait for all indexes to reach READY state
4. [ ] Verify no missing index errors

**Rollback Trigger**: Index build failures, query performance degradation

### Phase 3: Deploy Security Rules

**Objective**: Enable security rules for entities and workspace_entities

**Steps**:
1. [ ] Deploy rules: `firebase deploy --only firestore:rules`
2. [ ] Verify rules deployed successfully
3. [ ] Test entity creation in staging
4. [ ] Test workspace_entity creation in staging
5. [ ] Verify ScopeGuard enforced

**Rollback Trigger**: Security rule errors, permission denied errors for valid operations

### Phase 4: Run Migration Script (Dry Run)

**Objective**: Validate migration on production data without writes

**Steps**:
1. [ ] Run migration script with --dry-run flag
2. [ ] Review summary report
3. [ ] Identify any edge cases or errors
4. [ ] Fix any issues found
5. [ ] Re-run dry run until clean

**Rollback Trigger**: N/A (no writes performed)

### Phase 5: Run Migration Script (Live)

**Objective**: Backfill entities and workspace_entities from schools

**Steps**:
1. [ ] Schedule migration window (low-traffic period)
2. [ ] Notify team of migration start
3. [ ] Run migration script in live mode
4. [ ] Monitor progress in real-time
5. [ ] Review summary report
6. [ ] Verify success rate > 99%
7. [ ] Investigate any failures
8. [ ] Re-run migration for failed schools

**Rollback Trigger**: Success rate < 95%, critical data loss detected

**Migration Window**: [TO BE SCHEDULED]  
**Estimated Duration**: 30-60 minutes for 1000 schools

### Phase 6: Enable New Workspace Creation

**Objective**: Allow users to create workspaces with scope selection

**Steps**:
1. [ ] Enable workspace creation UI with scope selection
2. [ ] Deploy UI changes
3. [ ] Verify workspace creation wizard works
4. [ ] Verify scope lock indicator appears
5. [ ] Monitor for scope mismatch errors
6. [ ] Gather user feedback

**Rollback Trigger**: High volume of scope mismatch errors, user confusion

### Phase 7: Monitor and Optimize

**Objective**: Track performance and user adoption

**Steps**:
1. [ ] Monitor error rates (target: < 0.1%)
2. [ ] Monitor query performance (target: < 1 second)
3. [ ] Monitor denormalization sync success rate (target: 100%)
4. [ ] Track new workspaces created by scope type
5. [ ] Gather user feedback
6. [ ] Optimize based on usage patterns

**Duration**: 2 weeks post-deployment

---

## Rollback Plan

### Immediate Rollback (Critical Issues)

**Triggers**:
- Data loss detected
- Critical security vulnerability
- System-wide errors
- Success rate < 95% in migration

**Steps**:
1. [ ] Disable new workspace creation with scope selection
2. [ ] Revert to previous code version
3. [ ] Redeploy: `firebase deploy`
4. [ ] Verify existing features working
5. [ ] Notify team of rollback
6. [ ] Investigate root cause

**Data Safety**: Entities and workspace_entities collections remain intact, no data deleted

### Partial Rollback (Non-Critical Issues)

**Triggers**:
- High volume of scope mismatch errors
- User confusion
- Performance degradation

**Steps**:
1. [ ] Disable new workspace creation UI
2. [ ] Keep adapter layer active
3. [ ] Keep migrated data intact
4. [ ] Investigate and fix issues
5. [ ] Redeploy with fixes

---

## Post-Deployment Monitoring

### Key Metrics

- [ ] Migration success rate: ___% (target: > 99%)
- [ ] Scope mismatch error rate: ___% (target: < 0.1%)
- [ ] Query performance: ___ ms (target: < 1000ms)
- [ ] Denormalization sync success rate: ___% (target: 100%)
- [ ] New workspaces created: ___ (by scope type)
- [ ] User-reported issues: ___ (target: < 5 in first week)

### Alerts to Configure

- [ ] Migration script failures
- [ ] Scope mismatch errors (> 10 per hour)
- [ ] Permission denied errors (> 5 per hour)
- [ ] Slow query performance (> 2 seconds)
- [ ] Denormalization sync failures (> 1 per hour)
- [ ] Security rule violations

### Daily Checks (First Week)

- [ ] Review error logs
- [ ] Check migration status
- [ ] Monitor query performance
- [ ] Review user feedback
- [ ] Check denormalization sync status

---

## Sign-Off

### Development Team

- [ ] All code implemented and tested
- [ ] All property-based tests pass
- [ ] Migration script tested on production-like data
- [ ] Documentation complete

**Signed**: ________________  **Date**: ________

### QA Team

- [ ] All test scenarios executed
- [ ] Staging environment validated
- [ ] Performance benchmarks met
- [ ] Security rules verified

**Signed**: ________________  **Date**: ________

### Product Team

- [ ] All requirements met
- [ ] User experience validated
- [ ] Rollback plan approved
- [ ] Ready for production deployment

**Signed**: ________________  **Date**: ________

### DevOps Team

- [ ] Deployment plan reviewed
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Rollback plan tested

**Signed**: ________________  **Date**: ________

---

## Deployment Schedule

**Deployment Date**: [TO BE SCHEDULED]  
**Deployment Window**: [TO BE SCHEDULED] (Recommended: Weekend, low-traffic period)  
**Estimated Duration**: 2-3 hours  
**Team Availability**: All team members on standby

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: After Phase 7 completion
