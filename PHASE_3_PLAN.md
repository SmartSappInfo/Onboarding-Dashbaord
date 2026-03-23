# Phase 3 - Final Error Resolution Plan

**Current Status:** 106 errors remaining (65% complete)  
**Target:** 0 errors (100% complete)  
**Estimated Time:** 1.5 hours

---

## Error Categories & Fix Strategy

### Category 1: Dashboard Implicit Any Types (28 errors) - PRIORITY 1
**File:** `src/lib/dashboard.ts`  
**Issue:** Missing type annotations on arrow function parameters  
**Fix:** Add explicit types to all parameters  
**Time:** 15 minutes

**Errors:**
- Line 58: `sum`, `school` parameters
- Line 63-66: `m`, `a`, `b`, `meeting` parameters
- Line 83: `a`, `b` parameters
- Line 96-99: `stage`, `school`, `sum` parameters
- Line 131-134: `user`, `s`, `acc`, `school` parameters
- Line 142: `ua` parameter
- Line 145-150: `zone`, `s`, `sum` parameters
- Line 152: `zd` parameter
- Line 156-157: `school`, `m` parameters
- Line 167-170: `l` parameters (4 occurrences)

### Category 2: Survey Analytics Type Issues (17 errors) - PRIORITY 2
**File:** `src/app/admin/surveys/[id]/results/components/analytics-view.tsx`  
**Issue:** AnalyzedResult interface missing properties (total, average, otherText)  
**Fix:** Create proper type definition for AnalyzedResult with discriminated unions  
**Time:** 20 minutes

**Errors:**
- Lines 41-47: Missing `total` and `average` properties
- Lines 83: Missing `total` property
- Line 273: Type mismatch in array assignment
- Lines 288, 303, 306, 320: Object literal property issues
- Line 313: Type conversion issue

### Category 3: Missing Interface Properties (10 errors) - PRIORITY 3
**Files:** Multiple  
**Issue:** Properties missing from interfaces  
**Fix:** Add missing properties to interfaces  
**Time:** 15 minutes

**Errors:**
- Task.startDate (2 errors) - `src/app/admin/tasks/components/TaskEditor.tsx`
- School.track (1 error) - `src/app/admin/schools/[id]/edit/page.tsx`
- School.lifecycleStatus (1 error) - `src/app/admin/pipeline/components/KanbanBoard.tsx`
- PDFForm.createdBy (1 error) - `src/lib/pdf-actions.ts`
- FocalPersonManager note/attachment types (3 errors)
- LogActivityInput.workspaceIds (1 error)
- MediaAsset.originalName (handled - 0 errors)

### Category 4: Missing Imports & Components (8 errors) - PRIORITY 4
**Files:** Multiple  
**Issue:** Missing component/function imports  
**Fix:** Add missing imports  
**Time:** 10 minutes

**Errors:**
- Copy icon - `src/app/admin/pdfs/[id]/submissions/page.tsx`
- SmartSappIcon - `src/app/invoice/[id]/InvoicePortalClient.tsx`
- handleRemove function - `src/app/admin/surveys/components/question-editor.tsx`
- question variable - `src/app/admin/surveys/components/question-editor.tsx` (3 errors)

### Category 5: PDF & Blob Issues (3 errors) - PRIORITY 5
**Files:** PDF-related files  
**Issue:** Uint8Array type issues, function signatures  
**Fix:** Fix type conversions and signatures  
**Time:** 10 minutes

**Errors:**
- PdfUploader createPdfForm call (1 error)
- API route Response type (1 error)
- pdfBuffer.toString (1 error)

### Category 6: Component Prop Issues (8 errors) - PRIORITY 6
**Files:** Multiple  
**Issue:** Invalid props, ref issues, type mismatches  
**Fix:** Fix prop types and component usage  
**Time:** 15 minutes

**Errors:**
- Card ref prop (3 errors) - SchoolCard, TaskCard, InvoicePortalClient
- PopoverContent modal prop (1 error)
- Tooltip content prop (2 errors)
- Legend wrapperStyle fontBlack (1 error)
- Toast variant (1 error)

### Category 7: Survey Component Issues (5 errors) - PRIORITY 7
**Files:** Survey components  
**Issue:** Missing properties, type mismatches  
**Fix:** Add missing properties to Survey interface  
**Time:** 10 minutes

**Errors:**
- Survey.workspaceIds, internalName (2 errors)
- survey-preview-renderer logic case (2 errors)
- Controller render return type (1 error)

### Category 8: Miscellaneous (27 errors) - PRIORITY 8
**Files:** Various  
**Issue:** Various type issues  
**Fix:** Individual fixes  
**Time:** 25 minutes

**Errors:**
- Zod enum issue (1 error)
- sortConfig null check (1 error)
- submissions.length undefined (1 error)
- setIsSubmitting hoisting (2 errors)
- Element.focus (1 error)
- sidebar showOnHover (1 error)
- SignaturePadModal willReadFrequently (1 error)
- RecentActivity school prop (1 error)
- billing-actions id duplication (1 error)
- bulk-upload-actions missing properties (1 error)
- pdf-actions replace return type (1 error)
- Contract wizard workspaceId (1 error)
- DashboardGrid issues (4 errors)
- internal-notification-config (2 errors)
- ContractsClient (1 error)
- InvoiceStudioClient (1 error)
- image-editor-dialog (1 error)
- media-uploader React UMD (1 error)
- pdfs/[id]/edit (1 error)
- pdfs/[id]/submissions/[submissionId] (2 errors)
- finance/contracts (1 error)

---

## Execution Order

1. ✅ Dashboard implicit any types (28 errors) - Quick win
2. ✅ Missing imports (8 errors) - Quick win
3. ✅ Missing interface properties (10 errors) - Medium effort
4. ✅ PDF & Blob issues (3 errors) - Quick win
5. ✅ Component prop issues (8 errors) - Medium effort
6. ✅ Survey analytics (17 errors) - Complex
7. ✅ Survey components (5 errors) - Medium effort
8. ✅ Miscellaneous (27 errors) - Various

---

## Success Criteria

- All 106 TypeScript errors resolved
- No new errors introduced
- Code maintains functionality
- Type safety improved throughout codebase
