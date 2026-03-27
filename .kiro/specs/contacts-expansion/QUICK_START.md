# Quick Start: Entity Migration

## 🚀 5-Minute Migration Guide

### Prerequisites
- ✅ Firestore indexes deployed
- ✅ Security rules deployed
- ✅ Adapter layer code deployed

### Steps

#### 1. Access Seeds Page (30 seconds)
```
URL: /seeds or /admin/seeds
Password: mijay2123
```

#### 2. Run Migration (5-10 minutes)
```
Click: "Migrate All Schools" (green button)
Wait: Watch console for progress
Done: Toast notification appears
```

#### 3. Verify (30 seconds)
```
Click: "Verify Migration"
Check: Console shows statistics
```

#### 4. Done! ✅
```
Your schools are now migrated to entities + workspace_entities
```

---

## 🎯 What Each Button Does

### Migrate All Schools (Green)
**Purpose**: Runs the main migration  
**Time**: 5-10 minutes for 1000 schools  
**Safe**: Yes, idempotent  
**Rollback**: Yes, via Rollback button

### Verify Migration (Emerald)
**Purpose**: Checks migration status  
**Time**: 5 seconds  
**Output**: Console statistics  
**Use**: After migration to verify

### Rollback Migration (Red)
**Purpose**: Undoes migration  
**Time**: 5-10 minutes  
**Safe**: Yes, restores from backup  
**Use**: If migration fails or for testing

---

## 📊 Expected Console Output

### During Migration
```
🚀 Starting schools → entities migration...
📊 Found 1000 schools to process
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

---

## ⚠️ Troubleshooting

### Migration Doesn't Start
- Refresh page
- Check browser console for errors
- Verify Firestore connection

### Migration Hangs
- Wait 5 minutes (batches take time)
- Check Firestore quota
- Run verification to see progress

### Some Schools Failed
- Check console for error messages
- Fix data issues in Firestore
- Run migration again (skips completed)

### Need to Undo
- Click "Rollback Migration" button
- Wait for completion
- Verify with "Verify Migration"

---

## 🔒 Safety Features

- ✅ **Idempotent**: Run multiple times safely
- ✅ **Backups**: Full backup before changes
- ✅ **Rollback**: One-click undo
- ✅ **Batch Processing**: Avoids Firestore limits
- ✅ **Error Handling**: Individual errors don't abort

---

## 📚 More Information

- **SEEDS_PAGE_USAGE.md** - Detailed instructions
- **SEEDS_PAGE_SUMMARY.md** - Visual overview
- **MIGRATION_RUNBOOK.md** - Production procedures

---

**Ready to migrate?** Navigate to `/seeds` and click the green button! 🚀
