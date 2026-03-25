# Quick Fix Reference Guide
## Common Patterns & Solutions

---

## 🔧 Pattern 1: School Field Access

### ❌ BEFORE (Broken)
```typescript
const email = school.email;
const phone = school.phone;
const contact = school.contactPerson;
```

### ✅ AFTER (Fixed)
```typescript
import { getSchoolEmail, getSchoolPhone, getContactPerson } from '@/lib/school-helpers';

const email = getSchoolEmail(school);
const phone = getSchoolPhone(school);
const contact = getContactPerson(school);
```

**Files:** 18+ files referencing school.email, school.phone, school.contactPerson

---

## 🔧 Pattern 2: Workspace ID Access

### ❌ BEFORE (Broken)
```typescript
const isProspect = school.workspaceId === 'prospect';
const track = school.track;
```

### ✅ AFTER (Fixed)
```typescript
const isProspect = school.workspaceIds.includes('prospect');
const track = school.workspaceIds[0]; // or appropriate logic
```

**Files:** 12+ files using school.workspaceId or school.track

---

## 🔧 Pattern 3: Activity Logging

### ❌ BEFORE (Broken)
```typescript
logActivity({
  workspaceIds: [activeWorkspaceId],
  schoolId: school.id,
  // ...
});
```

### ✅ AFTER (Fixed)
```typescript
logActivity({
  workspaceId: activeWorkspaceId, // singular for Activity
  schoolId: school.id,
  // ...
});
```

**Files:** 11+ files calling logActivity()

---

## 🔧 Pattern 4: Form Control Disabled

### ❌ BEFORE (Broken)
```typescript
const onSubmit = (data) => {
  form.control.disabled = true;
  // ... submit logic
  form.control.disabled = false;
};
```

### ✅ AFTER (Fixed)
```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

const onSubmit = async (data) => {
  setIsSubmitting(true);
  try {
    // ... submit logic
  } finally {
    setIsSubmitting(false);
  }
};

// In JSX
<Input disabled={isSubmitting} />
<Button disabled={isSubmitting}>Submit</Button>
```

**Files:** src/app/signup/page.tsx, others

---

## 🔧 Pattern 5: React Hook Placement

### ❌ BEFORE (Broken)
```typescript
const onSubmit = (data) => {
  const [isSubmitting, setIsSubmitting] = useState(false); // ❌ Hook in function
  // ...
};
```

### ✅ AFTER (Fixed)
```typescript
export default function Component() {
  const [isSubmitting, setIsSubmitting] = useState(false); // ✅ Hook at top level
  
  const onSubmit = (data) => {
    setIsSubmitting(true);
    // ...
  };
}
```

**Files:** src/app/signup/page.tsx, src/app/surveys/[slug]/components/survey-form.tsx

---

## 🔧 Pattern 6: Firebase Admin SDK

### ❌ BEFORE (Broken)
```typescript
import { doc, updateDoc } from 'firebase/firestore'; // Client SDK
import { getDb } from './server-only-firestore'; // Admin DB

const noteRef = doc(db, 'activities', activityId); // ❌ Type mismatch
await updateDoc(noteRef, { ... });
```

### ✅ AFTER (Fixed)
```typescript
import { adminDb } from './firebase-admin'; // Admin SDK

const noteRef = adminDb.collection('activities').doc(activityId);
await noteRef.update({ ... });
```

**Files:** src/lib/activity-actions.ts

---

## 🔧 Pattern 7: Missing UI Imports

### ❌ BEFORE (Broken)
```typescript
// Using Card but not imported
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
</Card>
```

### ✅ AFTER (Fixed)
```typescript
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
</Card>
```

**Files:** 12+ files with missing imports

---

## 🔧 Pattern 8: Path Alias

### ❌ BEFORE (Broken)
```typescript
import { Button } from "~/components/ui/button";
```

### ✅ AFTER (Fixed)
```typescript
import { Button } from "@/components/ui/button";
```

**Files:** Any file using `~/` imports

---

## 🔧 Pattern 9: next-themes Import

### ❌ BEFORE (Broken)
```typescript
import { type ThemeProviderProps } from 'next-themes/dist/types';
```

### ✅ AFTER (Fixed)
```typescript
import type { ThemeProviderProps } from 'next-themes';
```

**Files:** Theme-related components

---

## 🔧 Pattern 10: Uint8Array to Blob

### ❌ BEFORE (Broken)
```typescript
const pdfBytes: Uint8Array = await pdf.save();
const blob = new Blob([pdfBytes], { type: 'application/pdf' }); // ❌ Type error
```

### ✅ AFTER (Fixed)
```typescript
const pdfBytes: Uint8Array = await pdf.save();
const blob = new Blob([pdfBytes.buffer], { type: 'application/pdf' });
// or
const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
```

**Files:** 4+ files handling PDF generation

---

## 🔧 Pattern 11: Unused Variables

### ❌ BEFORE (Broken)
```typescript
const [mobileMode, setMobileMode] = useState('edit'); // ❌ Unused
```

### ✅ AFTER (Fixed - Option 1: Prefix)
```typescript
const [_mobileMode, _setMobileMode] = useState('edit');
```

### ✅ AFTER (Fixed - Option 2: Remove)
```typescript
// Remove if truly not needed
```

**Files:** 120+ instances across codebase

---

## 🔧 Pattern 12: Accessibility - Click Handler

### ❌ BEFORE (Broken)
```typescript
<div onClick={handleClick}>
  Click me
</div>
```

### ✅ AFTER (Fixed)
```typescript
<div 
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  role="button"
  tabIndex={0}
>
  Click me
</div>
```

**Files:** 15+ instances

---

## 🔧 Pattern 13: DnD Kit Ref

### ❌ BEFORE (Broken)
```typescript
<Card ref={setNodeRef} style={style}>
  {/* content */}
</Card>
```

### ✅ AFTER (Fixed)
```typescript
<div ref={setNodeRef} style={style}>
  <Card>
    {/* content */}
  </Card>
</div>
```

**Files:** src/app/admin/schools/components/SchoolCard.tsx, TaskCard.tsx

---

## 🔧 Pattern 14: Framer Motion Transition

### ❌ BEFORE (Broken)
```typescript
<motion.div
  transition={{ type: 'spring', damping: 20, stiffness: 100 }}
>
```

### ✅ AFTER (Fixed)
```typescript
<motion.div
  transition={{ type: 'spring' as const, damping: 20, stiffness: 100 }}
>
```

**Files:** src/app/admin/schools/upload/BulkUploadClient.tsx

---

## 🔧 Pattern 15: Survey Type Union

### ❌ BEFORE (Broken)
```typescript
case 'logic': return null; // ❌ 'logic' not in type
```

### ✅ AFTER (Fixed)
```typescript
// Add to type definition
export interface SurveyLayoutBlock extends SurveyElement {
  type: 'heading' | 'description' | 'divider' | 'image' | 'video' | 'audio' | 'document' | 'embed' | 'section' | 'logic';
}

// Then use
case 'logic': return null; // ✅ Now valid
```

**Files:** src/lib/types.ts + survey renderers

---

## 📋 Search & Replace Commands

### Global Replacements (Use with caution!)

```bash
# Replace path alias
find src -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i 's|from "~/|from "@/|g'

# Find all school.email references
grep -r "school\.email" src/

# Find all school.phone references
grep -r "school\.phone" src/

# Find all school.contactPerson references
grep -r "school\.contactPerson" src/

# Find all workspaceIds array usage
grep -r "workspaceIds:" src/

# Find all logActivity calls
grep -r "logActivity(" src/
```

---

## 🧪 Quick Validation Commands

```bash
# Check specific error category
pnpm exec tsc --noEmit | grep "School"
pnpm exec tsc --noEmit | grep "workspace"
pnpm exec tsc --noEmit | grep "Firestore"

# Count remaining errors
pnpm exec tsc --noEmit 2>&1 | grep "error TS" | wc -l

# Check specific file
pnpm exec tsc --noEmit | grep "filename.tsx"

# Run lint on specific file
pnpm eslint src/path/to/file.tsx
```

---

## 🎯 Priority Order for Manual Fixes

1. **Phase 1:** Install dependencies (5 min)
2. **Phase 2.1:** Create school-helpers.ts (30 min)
3. **Phase 2.1:** Update all school field references (2 hours)
4. **Phase 2.2:** Fix workspace ID references (1.5 hours)
5. **Phase 3.1:** Add missing imports (1 hour)
6. **Phase 3.2:** Fix React Hook issues (1 hour)
7. **Phase 4.1:** Fix Firebase SDK mixing (1 hour)
8. **Rest:** Follow implementation plan

---

## 💡 Pro Tips

1. **Work in small batches:** Fix one pattern across all files before moving to next
2. **Commit frequently:** After each pattern fix
3. **Test critical paths:** After Phases 2, 3, 4
4. **Use IDE refactoring:** For renames and imports
5. **Run typecheck often:** `pnpm exec tsc --noEmit`
6. **Keep backup branch:** Before starting

---

**Last Updated:** March 23, 2026
