# Phase 4 - Final Error Resolution Plan

**Current:** 66 errors  
**Target:** ≤10 errors  
**To Fix:** 56+ errors

---

## Execution Strategy (Grouped by Fix Type)

### Group 1: Type Exports & Interfaces (8 errors) - 5 min
1. Add DashboardLayout export to types.ts
2. Add BillingSettings export to types.ts
3. Fix FocalPersonManager note/attachment types
4. Fix ActivityItemProps school property
5. Fix LogActivityInput workspaceIds property

### Group 2: Analytics View Type Issues (17 errors) - 10 min
1. Fix generateInsight function parameter type
2. Fix tempResult type inference issues
3. Add proper type guards for discriminated unions

### Group 3: Survey Component Issues (5 errors) - 5 min
1. Add workspaceIds and internalName to survey objects
2. Fix logic case in survey-preview-renderer

### Group 4: Card Ref Issues (4 errors) - 5 min
1. Fix SchoolCard ref prop
2. Fix TaskCard ref prop
3. Fix InvoicePortalClient CardContent ref

### Group 5: Controller Render Return Types (3 errors) - 5 min
1. Fix internal-notification-config null returns
2. Fix question-editor null return

### Group 6: Function Signature Fixes (8 errors) - 10 min
1. Fix createPdfForm call with workspaceIds
2. Fix upsertContractAction with workspaceId
3. Fix pdfBuffer.toString call
4. Fix pdf-actions replace function
5. Fix updatePdfFormSlug import

### Group 7: Component Prop Fixes (10 errors) - 10 min
1. Fix PopoverContent modal prop
2. Fix Tooltip cursor/content props
3. Fix Toast variant
4. Fix Legend fontBlack prop
5. Fix Button disabled type
6. Fix SignaturePadModal willReadFrequently

### Group 8: Miscellaneous (11 errors) - 10 min
1. Fix sortConfig null check
2. Fix submissions.length undefined
3. Fix setIsSubmitting hoisting
4. Fix Element.focus
5. Fix sidebar showOnHover
6. Fix billing-actions id duplication
7. Fix bulk-upload-actions missing properties
8. Fix contract null check
9. Fix StagedFile import
10. Fix React UMD global
11. Fix API route Response type

---

**Total Estimated Time:** 60 minutes
