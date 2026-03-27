# Seeds Page Usage Guide

## Overview

The seeds page has been updated with comprehensive entity migration functionality. You can now migrate all schools to the new `entities` + `workspace_entities` architecture with full backup and rollback support.

## Accessing the Seeds Page

1. Navigate to `/seeds` or `/admin/seeds`
2. Enter password: `mijay2123`
3. Click "Unlock Engine"

## Migration Sections

### 1. Architectural Restoration (Existing)

These migrations prepare the database for multi-workspace support:

- **Blueprint Reconstruction**: Rebuilds pipelines and stages from school metadata
- **Shared Registry Sync**: Migrates to `workspaceIds` arrays
- **Timeline Binding**: Binds activities to workspaces

### 2. Entity Architecture Migration (NEW)

This is the core migration for the contacts expansion feature:

#### Migrate All Schools Button
- **What it does**: 
  - Creates `entity` documents for each school with `entityType: institution`
  - Creates `workspace_entities` documents for each workspace link
  - Migrates tags to `globalTags` (entity) and `workspaceTags` (workspace_entities)
  - Sets `migrationStatus: "migrated"` on schools
  - Creates backup in `backup_entities_migration` collection

- **When to use**: 
  - After completing architectural restoration migrations
  - When ready to enable multi-scope features
  - First time migrating to entity architecture

- **Safety**: 
  - ✅ Idempotent - safe to run multiple times
  - ✅ Skips already migrated schools
  - ✅ Creates backups before any changes
  - ✅ Processes in batches to avoid Firestore limits

#### Verify Migration Button
- **What it does**:
  - Counts total schools, migrated schools, and legacy schools
  - Counts total entities created
  - Counts total workspace_entities created
  - Displays summary in console

- **When to use**:
  - After running migration to check status
  - To verify migration completeness
  - Before and after rollback

#### Rollback Migration Button
- **What it does**:
  - Restores original schools from `backup_entities_migration`
  - Deletes all created entities
  - Deletes all created workspace_entities
  - Removes migration status from schools

- **When to use**:
  - If migration fails or has errors
  - If you need to re-run migration with fixes
  - For testing purposes in development

### 3. Domain Enrichment (Existing)

Quick sync buttons for specific collections:
- User Identity Sync
- CRM Task Sync
- Roles & Governance
- Workspaces
- Billing Profiles

### 4. Emergency Rollback (Existing)

Rollback buttons for previous migrations:
- Restore Schools Snapshot
- Restore Tasks Snapshot

## Migration Workflow

### Recommended Order

1. **Pre-Migration Checks**:
   ```
   ✅ Verify Firestore indexes are deployed
   ✅ Verify security rules are deployed
   ✅ Verify adapter layer code is deployed (see ADAPTER_VERIFICATION.md)
   ✅ Create manual backup of Firestore (optional)
   ```

   **Quick Adapter Verification**:
   ```bash
   # Check adapter file exists
   ls -la src/lib/contact-adapter.ts
   
   # Check adapter is exported
   grep "export async function resolveContact" src/lib/contact-adapter.ts
   
   # Check adapter is imported in key files
   grep -r "import.*resolveContact" src/lib --include="*.ts" | head -5
   ```
   
   **Expected**: All commands return results. For detailed verification, see [ADAPTER_VERIFICATION.md](./ADAPTER_VERIFICATION.md)

2. **Run Architectural Restoration** (if not done):
   - Click "Sync Domain" on "Blueprint Reconstruction"
   - Click "Sync Domain" on "Shared Registry Sync"
   - Click "Sync Domain" on "Timeline Binding"

3. **Run Entity Migration**:
   - Click "Migrate All Schools" button
   - Monitor console for progress
   - Wait for completion (5-10 minutes for ~1000 schools)

4. **Verify Migration**:
   - Click "Verify Migration" button
   - Check console output for statistics
   - Verify counts match expectations

5. **Test Features**:
   - Test existing features (activities, tasks, messaging)
   - Test adapter layer resolves migrated schools
   - Test new entity features

6. **Rollback if Needed**:
   - Click "Rollback Migration" if issues found
   - Fix issues in code
   - Re-run migration

## Console Output

### During Migration

```
🚀 Starting schools → entities migration...
📊 Found 1000 schools to process
⏭️  Skipping school_123 - already migrated
✅ Committed batch (500 schools processed)
✅ Committed final batch

📈 Migration Summary:
   Total: 1000
   ✅ Succeeded: 995
   ⏭️  Skipped: 5
   ❌ Failed: 0
```

### During Verification

```
🔍 Verifying migration status...

📊 Migration Status:
   Schools: 1000 total (995 migrated, 5 legacy)
   Entities: 995
   Workspace Entities: 1245
```

### During Rollback

```
🔄 Starting entities migration rollback...
📊 Found 995 backups to restore
✅ Committed rollback batch (500 schools restored)
✅ Committed final rollback batch

📈 Rollback Summary:
   Total: 995
   ✅ Restored: 995
   ❌ Failed: 0
```

## Migration Details

### What Gets Created

For each school:

1. **Entity Document** (`entities` collection):
   ```typescript
   {
     id: "entity_school_123",
     entityType: "institution",
     organizationId: "smartsapp-hq",
     name: "Example School",
     slug: "example-school",
     globalTags: ["tag1", "tag2"],
     institutionData: {
       nominalRoll: 500,
       billingAddress: "...",
       currency: "GHS",
       subscriptionPackageId: "...",
       subscriptionRate: 1000,
       focalPersons: [...]
     },
     createdAt: "...",
     updatedAt: "..."
   }
   ```

2. **Workspace Entity Documents** (`workspace_entities` collection):
   ```typescript
   {
     id: "onboarding_entity_school_123",
     workspaceId: "onboarding",
     entityId: "entity_school_123",
     organizationId: "smartsapp-hq",
     displayName: "Example School",
     primaryEmail: "",
     primaryPhone: "",
     pipelineId: "...",
     stageId: "...",
     currentStageName: "...",
     status: "Onboarding",
     assignedTo: "...",
     workspaceTags: [],
     createdAt: "...",
     updatedAt: "..."
   }
   ```

3. **Updated School Document** (`schools` collection):
   ```typescript
   {
     // ... existing fields ...
     migrationStatus: "migrated",
     entityId: "entity_school_123",
     migratedAt: "..."
   }
   ```

4. **Backup Document** (`backup_entities_migration` collection):
   ```typescript
   {
     // ... complete original school data ...
     backedUpAt: "..."
   }
   ```

## Troubleshooting

### Migration Fails to Start

**Symptoms**: Button doesn't respond or immediate error

**Solutions**:
- Check browser console for errors
- Verify Firestore connection
- Verify user has admin permissions
- Refresh page and try again

### High Failure Rate

**Symptoms**: Many schools fail during migration

**Solutions**:
- Check console for specific error messages
- Verify schools have required fields (name, workspaceIds)
- Fix data issues in Firestore
- Run migration again (it will skip already migrated schools)

### Migration Hangs

**Symptoms**: Progress stops, no console output

**Solutions**:
- Wait 5 minutes (large batches take time)
- Check Firestore quota limits
- Check network connection
- Refresh page and verify migration status
- Run verification to see how many completed

### Verification Shows Mismatched Counts

**Symptoms**: Entity count doesn't match migrated school count

**Solutions**:
- Check for failed migrations in console
- Run migration again to complete failed schools
- Check for duplicate entities (shouldn't happen with idempotency)
- Manually inspect Firestore collections

### Rollback Fails

**Symptoms**: Rollback button errors or doesn't complete

**Solutions**:
- Check console for specific errors
- Verify backup collection exists
- Run rollback again (it's idempotent)
- Manually restore from Firestore backup if needed

## Safety Features

### Idempotency
- Migration can be run multiple times safely
- Already migrated schools are skipped
- No duplicate entities created

### Backups
- Complete school data backed up before migration
- Backup includes all fields and metadata
- Rollback restores exact original state

### Batch Processing
- Processes in batches of 450 operations
- Avoids Firestore batch size limits
- Commits incrementally for progress tracking

### Error Handling
- Individual school errors don't abort migration
- Errors logged with school ID and message
- Failed schools can be retried separately

## Post-Migration

### Immediate Actions
- [ ] Verify migration statistics
- [ ] Test existing features
- [ ] Test adapter layer
- [ ] Monitor error logs

### Short-Term Actions
- [ ] Investigate any failed schools
- [ ] Re-run migration for failed schools
- [ ] Test new entity features
- [ ] Gather user feedback

### Long-Term Actions
- [ ] Monitor performance
- [ ] Optimize queries if needed
- [ ] Plan for legacy schools deprecation
- [ ] Document lessons learned

## Support

If you encounter issues:

1. Check console output for error messages
2. Review this guide for troubleshooting steps
3. Check MIGRATION_RUNBOOK.md for detailed procedures
4. Contact development team with:
   - Console output
   - Migration statistics
   - Specific error messages
   - Steps to reproduce

## Related Documentation

- `MIGRATION_RUNBOOK.md` - Detailed migration procedures
- `SEED_PAGE_MIGRATION_GUIDE.md` - Technical implementation details
- `USER_GUIDE.md` - End-user documentation
- `architecture-notes.md` - Architecture decisions

---

**Last Updated**: January 2025  
**Version**: 1.0
