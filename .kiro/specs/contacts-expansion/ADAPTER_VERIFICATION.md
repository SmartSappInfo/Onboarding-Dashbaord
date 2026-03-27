# Adapter Layer Verification Guide

## Quick Verification Checklist

Use this checklist to verify the adapter layer is properly deployed:

### ✅ File Existence Check

Check that these files exist in your codebase:

```bash
# Core adapter file
ls -la src/lib/contact-adapter.ts

# Files that use the adapter
ls -la src/lib/activity-logger.ts
ls -la src/lib/task-server-actions.ts
ls -la src/lib/task-actions.ts
ls -la src/lib/pdf-actions.ts
ls -la src/lib/automation-processor.ts
ls -la src/lib/messaging-engine.ts
ls -la src/lib/billing-actions.ts
ls -la src/lib/notification-engine.ts
```

**Expected**: All files should exist

---

### ✅ Code Verification

#### 1. Check contact-adapter.ts exists and exports resolveContact

```bash
grep -n "export async function resolveContact" src/lib/contact-adapter.ts
```

**Expected output**:
```
33:export async function resolveContact(
```

#### 2. Check adapter is imported in key files

```bash
# Check activity logger
grep "resolveContact" src/lib/activity-logger.ts

# Check task actions
grep "resolveContact" src/lib/task-server-actions.ts

# Check messaging engine
grep "resolveContact" src/lib/messaging-engine.ts
```

**Expected**: Each file should show import and usage of `resolveContact`

#### 3. Check ResolvedContact type exists

```bash
grep -n "export interface ResolvedContact" src/lib/types.ts
```

**Expected output**: Should show the interface definition

---

### ✅ Runtime Verification

#### Method 1: Check in Browser Console

1. Open your app in browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Run this code:

```javascript
// Test if adapter module exists
import('/src/lib/contact-adapter').then(module => {
  console.log('✅ Adapter module loaded:', module);
  console.log('✅ resolveContact function exists:', typeof module.resolveContact === 'function');
}).catch(err => {
  console.error('❌ Adapter module not found:', err);
});
```

**Expected**: Should log success messages

#### Method 2: Check Server Logs

When your app runs, check server logs for adapter usage:

```bash
# Look for adapter log messages
grep "\[ADAPTER\]" logs/*.log

# Or check in real-time
tail -f logs/app.log | grep ADAPTER
```

**Expected**: Should see adapter log messages when features are used

#### Method 3: Test with a School Record

1. Navigate to a school detail page
2. Open browser console
3. Check Network tab for API calls
4. Look for calls to endpoints that use the adapter

**Expected**: No errors, data loads correctly

---

### ✅ Functional Verification

Test that existing features still work (they use the adapter):

#### Test 1: Activity Logging
```
1. Go to any school detail page
2. Create a new activity (note, call, email, etc.)
3. Check that activity appears in timeline
4. ✅ Pass if activity created successfully
```

#### Test 2: Task Creation
```
1. Go to any school detail page
2. Create a new task
3. Check that task appears in task list
4. ✅ Pass if task created successfully
```

#### Test 3: Messaging
```
1. Go to messaging page
2. Send a message to a school
3. Check message history
4. ✅ Pass if message sent successfully
```

#### Test 4: PDF Generation
```
1. Go to PDF forms page
2. Generate a PDF for a school
3. Check that PDF downloads
4. ✅ Pass if PDF generated successfully
```

---

### ✅ Migration Status Check

Check if schools have migration status field:

```javascript
// In browser console or Node.js script
const firestore = getFirestore();
const schoolsRef = collection(firestore, 'schools');
const snapshot = await getDocs(query(schoolsRef, limit(5)));

snapshot.forEach(doc => {
  const data = doc.data();
  console.log(`School ${doc.id}:`, {
    name: data.name,
    migrationStatus: data.migrationStatus || 'NOT SET',
    entityId: data.entityId || 'NOT SET'
  });
});
```

**Expected output**:
```
School school_123: { name: "Example School", migrationStatus: "legacy", entityId: "NOT SET" }
School school_456: { name: "Another School", migrationStatus: "legacy", entityId: "NOT SET" }
```

---

## Detailed Verification Steps

### Step 1: Verify File Structure

Run this command to check all adapter-related files:

```bash
find src/lib -name "*adapter*" -o -name "*contact*" | grep -E "\.(ts|tsx)$"
```

**Expected files**:
- `src/lib/contact-adapter.ts`
- `src/lib/__tests__/contact-adapter.test.ts`

### Step 2: Verify Imports

Check that the adapter is imported in all necessary files:

```bash
# Find all files that import resolveContact
grep -r "import.*resolveContact" src/lib --include="*.ts" --include="*.tsx"
```

**Expected files** (at minimum):
- `src/lib/activity-logger.ts`
- `src/lib/task-server-actions.ts`
- `src/lib/task-actions.ts`
- `src/lib/pdf-actions.ts`
- `src/lib/automation-processor.ts`
- `src/lib/messaging-engine.ts`
- `src/lib/billing-actions.ts`
- `src/lib/notification-engine.ts`

### Step 3: Verify Type Definitions

Check that ResolvedContact type is defined:

```bash
grep -A 20 "export interface ResolvedContact" src/lib/types.ts
```

**Expected output** (should include these fields):
```typescript
export interface ResolvedContact {
  id: string;
  name: string;
  slug?: string;
  contacts?: any[];
  pipelineId?: string;
  stageId?: string;
  stageName?: string;
  assignedTo?: string;
  status?: string;
  tags?: string[];
  globalTags?: string[];
  entityType?: EntityType;
  entityId?: string;
  workspaceEntityId?: string;
  migrationStatus?: MigrationStatus;
  schoolData?: School;
}
```

### Step 4: Verify Adapter Logic

Check the adapter has all required functions:

```bash
# Check for main function
grep -n "export async function resolveContact" src/lib/contact-adapter.ts

# Check for helper functions
grep -n "async function resolveFromEntity" src/lib/contact-adapter.ts
grep -n "function resolveFromSchool" src/lib/contact-adapter.ts
```

**Expected**: All three functions should be found

### Step 5: Test Adapter in Development

Create a test script to verify the adapter works:

```typescript
// test-adapter.ts
import { resolveContact } from './src/lib/contact-adapter';

async function testAdapter() {
  console.log('Testing adapter layer...\n');
  
  // Test with a known school ID
  const schoolId = 'YOUR_SCHOOL_ID_HERE';
  const workspaceId = 'onboarding';
  
  console.log(`Resolving contact: ${schoolId} in workspace: ${workspaceId}`);
  
  const contact = await resolveContact(schoolId, workspaceId);
  
  if (contact) {
    console.log('✅ Adapter working!');
    console.log('Contact details:', {
      id: contact.id,
      name: contact.name,
      migrationStatus: contact.migrationStatus,
      entityId: contact.entityId,
      hasSchoolData: !!contact.schoolData
    });
  } else {
    console.log('❌ Adapter returned null');
  }
}

testAdapter();
```

Run with:
```bash
npx tsx test-adapter.ts
```

---

## Common Issues and Solutions

### Issue 1: "Cannot find module 'contact-adapter'"

**Cause**: File doesn't exist or path is wrong

**Solution**:
```bash
# Check if file exists
ls -la src/lib/contact-adapter.ts

# If missing, create it from the implementation
# (See contact-adapter.ts in the codebase)
```

### Issue 2: "resolveContact is not a function"

**Cause**: Function not exported or import path wrong

**Solution**:
```typescript
// Check export in contact-adapter.ts
export async function resolveContact(...) { ... }

// Check import in consuming file
import { resolveContact } from './contact-adapter';
// or
import { resolveContact } from '@/lib/contact-adapter';
```

### Issue 3: "ResolvedContact type not found"

**Cause**: Type not defined in types.ts

**Solution**:
```bash
# Check if type exists
grep "ResolvedContact" src/lib/types.ts

# If missing, add the interface to types.ts
```

### Issue 4: Adapter returns null for valid schools

**Cause**: Database connection issue or school doesn't exist

**Solution**:
```typescript
// Add debug logging in contact-adapter.ts
console.log('[ADAPTER] Resolving:', schoolId, workspaceId);
console.log('[ADAPTER] School data:', schoolData);
console.log('[ADAPTER] Migration status:', migrationStatus);
```

---

## Deployment Verification Checklist

Before running migration, verify:

- [ ] `src/lib/contact-adapter.ts` exists
- [ ] `resolveContact` function is exported
- [ ] `ResolvedContact` type is defined in `types.ts`
- [ ] Adapter is imported in activity-logger.ts
- [ ] Adapter is imported in task-server-actions.ts
- [ ] Adapter is imported in messaging-engine.ts
- [ ] Adapter is imported in pdf-actions.ts
- [ ] Adapter is imported in automation-processor.ts
- [ ] Adapter is imported in billing-actions.ts
- [ ] Adapter is imported in notification-engine.ts
- [ ] All imports use correct path
- [ ] TypeScript compiles without errors
- [ ] Tests pass (if adapter tests exist)
- [ ] Existing features work (activities, tasks, messaging)
- [ ] No console errors in browser
- [ ] No server errors in logs

---

## Quick Test Script

Save this as `verify-adapter.sh` and run it:

```bash
#!/bin/bash

echo "🔍 Verifying Adapter Layer Deployment..."
echo ""

# Check file exists
if [ -f "src/lib/contact-adapter.ts" ]; then
    echo "✅ contact-adapter.ts exists"
else
    echo "❌ contact-adapter.ts NOT FOUND"
    exit 1
fi

# Check function export
if grep -q "export async function resolveContact" src/lib/contact-adapter.ts; then
    echo "✅ resolveContact function exported"
else
    echo "❌ resolveContact function NOT exported"
    exit 1
fi

# Check type definition
if grep -q "export interface ResolvedContact" src/lib/types.ts; then
    echo "✅ ResolvedContact type defined"
else
    echo "❌ ResolvedContact type NOT defined"
    exit 1
fi

# Check imports in key files
FILES=(
    "src/lib/activity-logger.ts"
    "src/lib/task-server-actions.ts"
    "src/lib/messaging-engine.ts"
)

for file in "${FILES[@]}"; do
    if grep -q "resolveContact" "$file"; then
        echo "✅ $file imports adapter"
    else
        echo "⚠️  $file does NOT import adapter"
    fi
done

echo ""
echo "✅ Adapter layer verification complete!"
```

Run with:
```bash
chmod +x verify-adapter.sh
./verify-adapter.sh
```

---

## Summary

The adapter layer is deployed if:

1. ✅ `src/lib/contact-adapter.ts` file exists
2. ✅ `resolveContact` function is exported
3. ✅ `ResolvedContact` type is defined
4. ✅ Key files import and use the adapter
5. ✅ Existing features work without errors
6. ✅ TypeScript compiles successfully

If all checks pass, your adapter layer is deployed and ready for migration! 🎉

---

**Need Help?**

If verification fails, check:
- MIGRATION_RUNBOOK.md for detailed procedures
- SEEDS_PAGE_USAGE.md for migration instructions
- Contact development team with verification results
