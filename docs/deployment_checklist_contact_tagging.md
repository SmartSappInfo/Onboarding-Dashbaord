# Deployment Checklist: Contact Tagging System

Internal ops document. Complete steps in order.

---

## 1. Pre-Deployment Verification

### Firestore Indexes
- [ ] Confirm `firestore.indexes.json` contains all tag indexes:
  - `tags`: `workspaceId + category + name`
  - `tags`: `workspaceId + usageCount DESC`
  - `tags`: `workspaceId + name`
  - `tag_audit_logs`: `workspaceId + timestamp DESC`
  - `tag_audit_logs`: `tagId + timestamp DESC`
  - `tag_audit_logs`: `workspaceId + action + timestamp DESC`
  - `tag_audit_logs`: `contactId + timestamp DESC`

### Security Rules
- [ ] Confirm `firestore.rules` contains the `Contact Tagging System` section with rules for `/tags/{tagId}` and `/tag_audit_logs/{logId}`
- [ ] Confirm `schools` collection rules include the tag-only update permission (`tags`, `taggedAt`, `taggedBy` fields with `schools_edit` permission)

### Tests
- [ ] Run full test suite and confirm it passes: `pnpm test:run`
- [ ] Review any failures before proceeding

---

## 2. Deployment Steps

> Firebase project: `studio-9220106300-f74cb` (App Hosting backend: `studio`)

### 2a. Deploy Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```
- [ ] Command exits successfully
- [ ] Verify in Firebase Console → Firestore → Indexes that tag indexes show status **Enabled** (may take a few minutes to build)

### 2b. Deploy Firestore Security Rules
```bash
firebase deploy --only firestore:rules
```
- [ ] Command exits successfully
- [ ] Verify in Firebase Console → Firestore → Rules that the new rules are live

### 2c. Deploy Application
```bash
firebase apphosting:backends:deploy studio
```
Or push to the connected Git branch to trigger App Hosting auto-deploy.
- [ ] Deployment completes without errors
- [ ] App is reachable and loads correctly

### 2d. Run Migration Script (per workspace)

The migration is idempotent — safe to re-run. Run once per workspace that has existing contact data.

**Dry run first:**
```bash
DRY_RUN=true pnpm migrate:tags --workspaceId <workspaceId> --organizationId <organizationId>
```
- [ ] Dry run output looks correct (expected tag counts, no errors)

**Live run:**
```bash
pnpm migrate:tags --workspaceId <workspaceId> --organizationId <organizationId>
```
- [ ] Migration summary shows expected `Tags created` and `Schools updated` counts
- [ ] No errors in output
- [ ] Repeat for each workspace

---

## 3. Staging Verification

Run these checks against the staging environment before promoting to production.

### Tag CRUD
- [ ] Create a new tag (name, category, color) — tag appears in tag list
- [ ] Edit tag name and color — changes persist
- [ ] Delete a non-system tag — tag is removed
- [ ] Attempt to delete a system tag (`isSystem: true`) — should be blocked

### Contact Tagging
- [ ] Apply a tag to a contact — tag appears on contact record
- [ ] Remove a tag from a contact — tag is removed from contact record
- [ ] Apply multiple tags to a single contact

### Bulk Operations
- [ ] Select multiple contacts and bulk-apply a tag — all selected contacts receive the tag
- [ ] Select multiple contacts and bulk-remove a tag — tag is removed from all selected contacts

### Automation Triggers
- [ ] Create an automation with trigger: "Tag added" — automation fires when tag is applied to a contact
- [ ] Create an automation with trigger: "Tag removed" — automation fires when tag is removed
- [ ] Verify automation run logs show correct contact and tag context

### Audit Logs
- [ ] Apply a tag to a contact and check `tag_audit_logs` in Firestore — entry created with correct `action`, `contactId`, `tagId`, `workspaceId`, and `timestamp`
- [ ] Remove a tag and verify a corresponding audit log entry is created
- [ ] Confirm audit logs are visible in the UI activity timeline for the contact

### Permissions
- [ ] User with `tags_manage` permission can create/edit/delete tags
- [ ] User without `tags_manage` permission cannot create/edit/delete tags
- [ ] User with `schools_edit` permission can apply/remove tags on contacts
- [ ] Audit logs are visible to users with `activities_view` permission

---

## 4. Rollback Plan

### 4a. Revert Security Rules
Restore the previous `firestore.rules` from version control and redeploy:
```bash
git checkout <previous-commit> -- firestore.rules
firebase deploy --only firestore:rules
```

### 4b. Revert Firestore Indexes
Restore the previous `firestore.indexes.json` from version control and redeploy:
```bash
git checkout <previous-commit> -- firestore.indexes.json
firebase deploy --only firestore:indexes
```
> Note: Removing indexes is non-destructive — it only affects query performance, not data.

### 4c. Revert Application
Redeploy the previous app version via App Hosting rollback in the Firebase Console, or push a revert commit to the connected branch.

### 4d. Remove Tags from Contacts (if needed)

Only required if the migration script was run and you need to undo it.

Run a targeted Firestore script to strip `tags`, `taggedAt`, and `taggedBy` fields from `schools` documents, then delete documents in the `tags` collection for the affected workspaces.

> There is no automated rollback script for the migration. Coordinate with engineering before executing data removal in production.

---

## Notes

- Index builds can take several minutes after deploy. Queries against new indexes may fail until they are fully built.
- The migration script is idempotent — re-running it will skip already-migrated data.
- System tags (`isSystem: true`) cannot be deleted or modified by non-admin users by design.
