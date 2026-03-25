# TypeScript & ESLint Error Resolution Plan
## Comprehensive Implementation Strategy

**Project:** SmartSapp Onboarding Dashboard  
**Total Errors:** 299 TypeScript errors + 208 ESLint errors  
**Status:** Pre-Implementation Planning Phase  
**Date:** March 23, 2026

---

## Executive Summary

The application has accumulated technical debt across 88 files with systematic issues in:
- Type system drift (model vs implementation mismatch)
- Missing dependencies and imports
- Firebase SDK version conflicts
- React Hook Form API misuse
- Workspace/workspace ID model inconsistency

This plan addresses all issues systematically without breaking functionality.

---

## Phase 1: Foundation & Dependencies (Priority: CRITICAL)
**Estimated Time:** 2-3 hours  
**Risk Level:** Low  
**Blocking:** Yes - Must complete before other phases

### 1.1 Install Missing Dependencies

**Actions:**
```bash
pnpm add @radix-ui/react-context-menu
pnpm add -D @types/three
```

**Files Affected:** 0 (dependency only)  
**Validation:** `pnpm list @radix-ui/react-context-menu @types/three`

### 1.2 Fix Import Paths & Aliases

**Problem:** Mixed use of `~` and `@` path aliases, invalid next-themes import

**Actions:**
1. Replace all `~/` imports with `@/`
2. Fix next-themes import pattern
3. Verify tsconfig.json paths configuration

**Files to Update:**
- Search pattern: `from "~/` → replace with `from "@/`
- `src/components/theme-toggle.tsx` (if exists)
- Any file importing from `next-themes/dist/types`

**Code Changes:**

```typescript
// BEFORE
import { type ThemeProviderProps } from 'next-themes/dist/types';

// AFTER
import type { ThemeProviderProps } from 'next-themes';
```

**Validation:** `pnpm typecheck` should show reduced errors

---

## Phase 2: Type System Reconciliation (Priority: CRITICAL)
**Estimated Time:** 4-6 hours  
**Risk Level:** Medium  
**Blocking:** Yes - Affects 60+ files

### 2.1 School Model Standardization

**Problem:** Code references removed fields: `school.phone`, `school.email`, `school.contactPerson`

**Current Model (src/lib/types.ts):**
```typescript
export interface School {
  focalPersons: FocalPerson[];  // NEW: Array of contacts
  // REMOVED: phone, email, contactPerson
}
```

**Decision Required:** Choose ONE approach:


**Option A (Recommended):** Migrate all code to use `focalPersons` array
**Option B:** Add deprecated fields back to School interface temporarily

**Recommended: Option A**

**Implementation Steps:**
1. Create helper functions for backward compatibility:
```typescript
// src/lib/school-helpers.ts
export function getPrimaryContact(school: School): FocalPerson | undefined {
  return school.focalPersons.find(fp => fp.isSignatory) || school.focalPersons[0];
}

export function getSchoolEmail(school: School): string | undefined {
  return getPrimaryContact(school)?.email;
}

export function getSchoolPhone(school: School): string | undefined {
  return getPrimaryContact(school)?.phone;
}

export function getContactPerson(school: School): string | undefined {
  return getPrimaryContact(school)?.name;
}
```

2. Update all references systematically:

**Files to Update (18 files):**

- `src/app/admin/schools/[id]/page.tsx`
- `src/app/admin/schools/components/school-details-modal.tsx`
- `src/app/admin/schools/components/FocalPersonManager.tsx`
- `src/lib/messaging-engine.ts`
- `src/lib/automation-engine.ts`
- All other files with `school.phone`, `school.email`, `school.contactPerson`

**Pattern:**
```typescript
// BEFORE
school.email

// AFTER
import { getSchoolEmail } from '@/lib/school-helpers';
getSchoolEmail(school)
```

**Validation:** Search for `school\.(phone|email|contactPerson)` should return 0 results

### 2.2 Workspace ID Model Standardization

**Problem:** Inconsistent use of `workspaceId` (singular) vs `workspaceIds` (array)

**Current Model:** All entities use `workspaceIds: string[]` (array)

**Files with Issues:**
- `src/app/admin/schools/[id]/page.tsx` (uses `school.workspaceId`)
- `src/app/admin/schools/[id]/edit/page.tsx` (uses `school.track`)
- `src/lib/activity-logger.ts` (LogActivityInput expects `workspaceId`)

**Implementation:**


1. **Update Activity Logger Type:**
```typescript
// src/lib/activity-logger.ts
type LogActivityInput = Omit<Activity, 'id' | 'timestamp'>;

// Activity interface already has workspaceId: string (singular)
// This is CORRECT for activities (they belong to ONE workspace)
```

2. **Fix School References:**
```typescript
// BEFORE
const isProspect = school.workspaceId === 'prospect';

// AFTER
const isProspect = school.workspaceIds.includes('prospect');

// BEFORE
school.track

// AFTER
school.workspaceIds[0] // or appropriate logic
```

3. **Update logActivity Calls:**
```typescript
// BEFORE
logActivity({
  workspaceIds: [activeWorkspaceId],
  // ...
})

// AFTER
logActivity({
  workspaceId: activeWorkspaceId, // singular for Activity
  // ...
})
```

**Files to Update (12+ files):**
- All files calling `logActivity()`
- All files accessing `school.workspaceId` or `school.track`

**Validation:** `pnpm typecheck` for workspaceId errors

### 2.3 Missing Type Exports

**Problem:** Types not exported from `src/lib/types.ts`

**Missing Exports:**

- `SchoolStatus` (referenced but not defined)
- `AutomationRule` (imported but doesn't exist)
- `AutomationAction` (imported but doesn't exist)
- `CampaignSession` (imported but doesn't exist)

**Actions:**

1. **Add SchoolStatus type:**
```typescript
// src/lib/types.ts
export type SchoolStatus = 'Active' | 'Inactive' | 'Archived' | 'Lead' | 'Prospect';
```

2. **Add Automation types:**
```typescript
// src/lib/types.ts
export interface AutomationRule {
  id: string;
  condition: string;
  operator: string;
  value: any;
}

export interface AutomationAction {
  id: string;
  type: 'send_email' | 'send_sms' | 'create_task' | 'update_field' | 'webhook';
  config: Record<string, any>;
}
```

3. **Add CampaignSession:**
```typescript
// src/lib/types.ts
export interface CampaignSession {
  id: string;
  campaignId: string;
  schoolId: string;
  startedAt: string;
  completedAt?: string;
  data: Record<string, any>;
}
```

**Validation:** Imports should resolve without errors

---

## Phase 3: React & Component Fixes (Priority: HIGH)
**Estimated Time:** 3-4 hours  
**Risk Level:** Medium

### 3.1 Missing UI Component Imports

**Problem:** Components used but not imported

**Pattern:** Add missing imports to affected files

**Files & Missing Imports:**


```typescript
// src/app/register-new-signup-form.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// src/app/admin/surveys/new/page.tsx
import { Button } from '@/components/ui/button';

// src/app/admin/tasks/TasksClient.tsx
import { Separator } from '@/components/ui/separator';

// src/app/admin/pipeline/settings/PipelineSettingsClient.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// src/app/invoice/[id]/InvoicePortalClient.tsx
import { SmartSappIcon } from '@/components/icons';
```

**Validation:** Each file should compile without "Cannot find name" errors

### 3.2 React Hook Form API Fixes

**Problem:** Invalid `form.control.disabled` usage

**Current (WRONG):**
```typescript
form.control.disabled = true;
form.control.disabled = false;
```

**Correct Pattern:**
```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

// In JSX
<Input disabled={isSubmitting} />
<Button disabled={isSubmitting}>Submit</Button>
```

**Files to Update:**
- `src/app/signup/page.tsx`
- Any other file using `form.control.disabled`

**Implementation:**


1. Remove all `form.control.disabled` assignments
2. Add state management for form submission
3. Pass disabled prop to form elements

### 3.3 React Hooks Rules Violations

**Problem:** Hooks called conditionally or in wrong scope

**File:** `src/app/signup/page.tsx`
```typescript
// WRONG: Hook called inside onSubmit function
const onSubmit = (data: FormData) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false); // ❌
  // ...
}
```

**Fix:**
```typescript
// CORRECT: Hook at component level
export default function SignupPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false); // ✅
  
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // ... submission logic
    } finally {
      setIsSubmitting(false);
    }
  };
}
```

**Files to Update:**
- `src/app/signup/page.tsx`
- `src/app/surveys/[slug]/components/survey-form.tsx`
- Any file with "Hook called conditionally" error

**Validation:** No react-hooks/rules-of-hooks errors

---

## Phase 4: Firebase SDK Reconciliation (Priority: HIGH)
**Estimated Time:** 2-3 hours  
**Risk Level:** High (data access)

### 4.1 Firestore SDK Mixing Issue

**Problem:** Mixing Admin SDK and Client SDK in same file

**Current Error:**
```
Argument of type 'FirebaseFirestore.Firestore' is not assignable to parameter
```

**Root Cause:** `src/lib/activity-actions.ts` uses client SDK imports with admin DB

**Solution:**


```typescript
// src/lib/activity-actions.ts
// BEFORE (WRONG - mixing SDKs)
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'; // Client SDK
import { getDb } from './server-only-firestore'; // Returns admin DB

// AFTER (CORRECT - use admin SDK)
import { adminDb } from './firebase-admin';

export async function updateNote(activityId: string, newContent: string) {
  const noteRef = adminDb.collection('activities').doc(activityId);
  
  await noteRef.update({
    'metadata.content': newContent,
    timestamp: new Date().toISOString(),
  });
}

export async function deleteNote(activityId: string) {
  const noteRef = adminDb.collection('activities').doc(activityId);
  await noteRef.delete();
}
```

**Files to Update:**
- `src/lib/activity-actions.ts`
- Any other server action file mixing SDKs

**Validation:** No Firestore type mismatch errors

---

## Phase 5: Survey & Form Type Fixes (Priority: MEDIUM)
**Estimated Time:** 2-3 hours  
**Risk Level:** Medium

### 5.1 Survey Element Type Issues

**Problem:** `'logic'` type not in union, missing fields in Survey type

**Actions:**

1. **Add logic type to SurveyLayoutBlock:**
```typescript
// src/lib/types.ts
export interface SurveyLayoutBlock extends SurveyElement {
  type: 'heading' | 'description' | 'divider' | 'image' | 'video' | 'audio' | 'document' | 'embed' | 'section' | 'logic';
  // ... rest
}
```

2. **Add missing Survey fields:**
```typescript
export interface Survey {
  // ... existing fields
  workspaceIds: string[]; // Already exists
  internalName: string;   // Already exists
  // Ensure these are present
}
```

3. **Fix survey creation:**
```typescript
// src/app/admin/surveys/components/ai-survey-generator.tsx
const newSurvey: Omit<Survey, 'id'> = {
  workspaceIds: [activeWorkspaceId],
  internalName: data.title,
  // ... all required fields
};
```

**Files to Update:**
- `src/app/admin/surveys/components/ai-survey-generator.tsx`
- `src/app/admin/surveys/components/survey-preview-button.tsx`
- `src/app/admin/surveys/components/survey-preview-renderer.tsx`

### 5.2 Analytics Result Type Fixes

**Problem:** Type mismatch in analytics view

**Current Issue:** `AnalyzedResult` type doesn't match usage

**Solution:** Review and update type definition or usage pattern

---

## Phase 6: PDF & Binary Data Handling (Priority: MEDIUM)
**Estimated Time:** 1-2 hours  
**Risk Level:** Low

### 6.1 Uint8Array to Blob Conversion

**Problem:** Type mismatch when creating Blob from Uint8Array

**Current:**
```typescript
const blob = new Blob([pdfBytes], { type: 'application/pdf' });
// Error: Uint8Array<ArrayBufferLike> not assignable to BlobPart
```

**Solution:**
```typescript
const blob = new Blob([pdfBytes.buffer], { type: 'application/pdf' });
// or
const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
```

**Files to Update:**
- `src/app/forms/results/components/SharedResultsListView.tsx`
- `src/app/forms/results/components/SharedSubmissionView.tsx`
- `src/app/invoice/[id]/InvoicePortalClient.tsx`
- `src/app/api/pdfs/[pdfId]/generate/[submissionId]/route.ts`

### 6.2 PDF Buffer toString Issue

**Problem:** `pdfBuffer.toString('base64')` expects 0 arguments

**Solution:** Use proper Buffer API or convert differently

```typescript
// If pdfBuffer is Uint8Array
const base64 = Buffer.from(pdfBuffer).toString('base64');
```

**Files to Update:**
- `src/app/api/pdfs/submit/route.ts`

---

## Phase 7: ESLint & Code Quality (Priority: LOW)
**Estimated Time:** 4-6 hours  
**Risk Level:** Low

### 7.1 Unused Variables & Imports

**Strategy:** Prefix with underscore or remove

**Pattern:**
```typescript
// BEFORE
const [mobileMode, setMobileMode] = useState('edit');

// AFTER (if truly unused)
const [_mobileMode, _setMobileMode] = useState('edit');

// OR remove entirely if not needed
```

**Bulk Actions:**
1. Run: `pnpm lint --fix` (auto-fixes some issues)
2. Manually review remaining unused vars
3. Decide: prefix with `_` or remove

### 7.2 Accessibility Fixes

**Common Issues:**
- Missing `alt` text on images
- Click handlers without keyboard listeners
- Media elements without captions

**Pattern:**
```typescript
// BEFORE
<div onClick={handleClick}>

// AFTER
<div 
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  role="button"
  tabIndex={0}
>
```

**Strategy:** Fix high-priority a11y issues first, defer cosmetic ones

### 7.3 Explicit Any Types

**Problem:** 208 instances of `any` type

**Strategy:** Progressive typing
1. Identify critical paths (data mutations, API calls)
2. Add proper types to those first
3. Use `unknown` instead of `any` where appropriate
4. Add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` for legitimate cases

---

## Phase 8: Component-Specific Fixes (Priority: MEDIUM)
**Estimated Time:** 3-4 hours  
**Risk Level:** Medium

### 8.1 DnD Kit Ref Issues

**Problem:** `ref` prop not accepted by Card component

**Files:**
- `src/app/admin/schools/components/SchoolCard.tsx`
- `src/app/admin/tasks/components/TaskCard.tsx`

**Solution:**
```typescript
// Use forwardRef wrapper or separate div
<div ref={setNodeRef} style={style}>
  <Card className={className}>
    {/* content */}
  </Card>
</div>
```

### 8.2 Framer Motion Type Issues

**Problem:** `transition` prop type mismatch

**Files:**
- `src/app/admin/schools/upload/BulkUploadClient.tsx`

**Solution:**
```typescript
// BEFORE
transition: { type: 'spring', damping: 20, stiffness: 100 }

// AFTER
transition: { type: 'spring' as const, damping: 20, stiffness: 100 }
```

### 8.3 Recharts Props

**Problem:** Invalid `fontBlack` prop in Legend

**File:** `src/app/admin/reports/ReportsClient.tsx`

**Solution:**
```typescript
// BEFORE
<Legend wrapperStyle={{ fontBlack: true }} />

// AFTER
<Legend wrapperStyle={{ fontWeight: 'bold' }} />
```

### 8.4 Canvas Props

**Problem:** `willReadFrequently` not in type

**File:** `src/components/SignaturePadModal.tsx`

**Solution:**
```typescript
// BEFORE
canvasProps={{ willReadFrequently: true }}

// AFTER
canvasProps={{ 
  // Remove willReadFrequently or cast
}}
```

---

## Phase 9: Validation & Testing (Priority: CRITICAL)
**Estimated Time:** 2-3 hours  
**Risk Level:** Low

### 9.1 Type Check Validation

**Commands:**
```bash
# Full type check
pnpm exec tsc --noEmit

# Expected: 0 errors
```

### 9.2 Lint Validation

**Commands:**
```bash
# Run linter
pnpm lint

# Expected: Warnings only, no errors
```

### 9.3 Build Validation

**Commands:**
```bash
# Local build
pnpm build

# Expected: Successful build
```

### 9.4 Runtime Testing

**Critical Paths to Test:**
1. School creation flow
2. Survey creation and submission
3. PDF form submission
4. Task management
5. Activity logging
6. Authentication flow

---

## Implementation Order & Dependencies

```
Phase 1 (Dependencies)
  ↓
Phase 2 (Type System) ← BLOCKING
  ↓
Phase 4 (Firebase SDK) ← BLOCKING
  ↓
Phase 3 (React/Components)
  ↓
Phase 5 (Survey/Forms)
  ↓
Phase 6 (PDF/Binary)
  ↓
Phase 8 (Component-Specific)
  ↓
Phase 7 (ESLint/Quality) ← Can be parallel
  ↓
Phase 9 (Validation) ← FINAL
```

---

## Risk Mitigation

### High-Risk Changes
1. **Firebase SDK changes** - Test thoroughly, affects data access
2. **School model changes** - Impacts 18+ files, core entity
3. **Workspace ID changes** - Affects multi-tenancy logic

### Mitigation Strategies
1. **Create feature branch:** `fix/typescript-errors-comprehensive`
2. **Commit after each phase** for easy rollback
3. **Test critical paths** after Phases 2, 3, 4
4. **Keep production backup** before deployment

---

## Success Criteria

### Must Have (Blocking Deployment)
- ✅ Zero TypeScript errors (`pnpm exec tsc --noEmit`)
- ✅ Zero ESLint errors (warnings acceptable)
- ✅ Successful build (`pnpm build`)
- ✅ All critical paths functional

### Should Have (Post-Deployment)
- ✅ Accessibility warnings addressed
- ✅ Unused code removed
- ✅ All `any` types replaced with proper types

### Nice to Have
- ✅ Code documentation updated
- ✅ Type coverage report generated

---

## Tracking & Progress

### Phase Completion Checklist

- [ ] Phase 1: Dependencies installed
- [ ] Phase 2: Type system reconciled
- [ ] Phase 3: React components fixed
- [ ] Phase 4: Firebase SDK unified
- [ ] Phase 5: Survey types corrected
- [ ] Phase 6: Binary data handling fixed
- [ ] Phase 7: ESLint issues resolved
- [ ] Phase 8: Component-specific fixes applied
- [ ] Phase 9: All validations passed

### File-Level Tracking

Create tracking spreadsheet with:
- File path
- Error count
- Phase assignment
- Status (Not Started / In Progress / Complete)
- Tester assigned
- Test result

---

## Estimated Timeline

**Total Estimated Time:** 22-30 hours

**Breakdown:**
- Phase 1: 2-3 hours
- Phase 2: 4-6 hours (CRITICAL PATH)
- Phase 3: 3-4 hours
- Phase 4: 2-3 hours (CRITICAL PATH)
- Phase 5: 2-3 hours
- Phase 6: 1-2 hours
- Phase 7: 4-6 hours (Can parallelize)
- Phase 8: 3-4 hours
- Phase 9: 2-3 hours

**Recommended Schedule:**
- Day 1: Phases 1, 2 (Foundation)
- Day 2: Phases 3, 4 (React & Firebase)
- Day 3: Phases 5, 6, 8 (Domain-specific)
- Day 4: Phase 7 (Quality)
- Day 5: Phase 9 (Validation & Testing)

---

## Next Steps

1. **Review & Approve** this plan
2. **Create feature branch** from main
3. **Begin Phase 1** (dependencies)
4. **Commit after each phase** with descriptive message
5. **Run validation** after critical phases
6. **Request code review** before merge
7. **Deploy to staging** for integration testing
8. **Monitor production** after deployment

---

## Notes & Considerations

### Type System Philosophy
- Prefer explicit types over `any`
- Use helper functions for backward compatibility
- Document breaking changes in migration guide

### Code Quality
- Fix errors first, warnings second
- Maintain existing functionality
- Don't over-engineer solutions

### Testing Strategy
- Unit tests for helper functions
- Integration tests for critical paths
- Manual testing for UI flows

---

**Plan Status:** READY FOR APPROVAL  
**Plan Version:** 1.0  
**Last Updated:** March 23, 2026
