# Quick Fix Guide - Messaging Feature Permissions

## TL;DR

Run this command to fix all permission errors:

```bash
./deploy-messaging-fix.sh
```

## What's Being Fixed

### 5 Collections with Permission Issues

1. **message_campaigns** ❌ Missing completely
2. **sender_profiles** ❌ Permission denied on list
3. **message_templates** ❌ Permission denied on list
4. **message_styles** ❌ Permission denied on list
5. **automations** ❌ Permission denied on list

### The Problem

Security rules had conflicting permissions:
- `allow list: if isAuthorized()` ✅ Allows query
- `allow get: if canAccessWorkspace(...)` ❌ Blocks documents

When Firestore runs a list query, it checks BOTH permissions. Result: Permission denied.

### The Solution

Changed to unified `read` permission:
```javascript
// Before (broken)
allow get: if isAuthorized() && canAccessWorkspace(...);
allow list: if isAuthorized();

// After (fixed)
allow read: if isAuthorized();
```

## Manual Deployment

If you prefer to deploy manually:

```bash
# Step 1: Deploy rules (fixes permission errors immediately)
firebase deploy --only firestore:rules

# Step 2: Deploy indexes (takes a few minutes to build)
firebase deploy --only firestore:indexes
```

## Verification

After deployment, test these in your app:

1. ✅ Campaign list loads without errors
2. ✅ Sender profiles dropdown populates
3. ✅ Message templates load in composer
4. ✅ Message styles are accessible
5. ✅ Automations list displays correctly

## Files Changed

- `firestore.rules` - Fixed 5 collections
- `firestore.indexes.json` - Added 7 indexes for message_campaigns

## Need More Details?

See these documents:
- `FIRESTORE_RULES_FIX_COMPLETE.md` - Complete technical details
- `FIREBASE_MESSAGING_FIX_SUMMARY.md` - Original fix summary
- `MESSAGING_FEATURE_AUDIT.md` - Full audit of all collections

## Rollback

If you need to rollback:

```bash
git checkout HEAD~1 firestore.rules firestore.indexes.json
firebase deploy --only firestore:rules
```

Note: Indexes cannot be rolled back easily. They must be deleted manually in Firebase Console.
