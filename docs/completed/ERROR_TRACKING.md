# Error Tracking Matrix
## Systematic Error Resolution Tracker

**Total TypeScript Errors:** 299  
**Total ESLint Errors:** 208  
**Total Files Affected:** 88

---

## Error Categories & Distribution

### Category 1: Missing Dependencies (4 errors)
**Priority:** CRITICAL | **Phase:** 1

| Package | Type | Status |
|---------|------|--------|
| @radix-ui/react-context-menu | Runtime | ⏳ Pending |
| @types/three | DevDep | ⏳ Pending |
| next-themes (import fix) | Config | ⏳ Pending |
| Path alias (~ to @) | Config | ⏳ Pending |

---

### Category 2: School Model Issues (45+ errors)
**Priority:** CRITICAL | **Phase:** 2.1

| Field Reference | Files Affected | Solution |
|----------------|----------------|----------|
| school.phone | 6 files | Use getSchoolPhone() helper |
| school.email | 8 files | Use getSchoolEmail() helper |
| school.contactPerson | 4 files | Use getContactPerson() helper |

**Key Files:**
- src/app/admin/schools/[id]/page.tsx (3 errors)
- src/app/admin/schools/components/school-details-modal.tsx (8 errors)
- src/lib/messaging-engine.ts (2 errors)
- src/lib/automation-engine.ts (1 error)

---

### Category 3: Workspace ID Inconsistency (25+ errors)
**Priority:** CRITICAL | **Phase:** 2.2

| Issue | Files | Pattern |
|-------|-------|---------|
| workspaceId vs workspaceIds | 12 | school.workspaceIds.includes() |
| school.track reference | 2 | school.workspaceIds[0] |
| logActivity workspaceIds array | 11 | Change to workspaceId: string |

**Key Files:**
- src/app/admin/schools/[id]/page.tsx
- src/app/admin/schools/[id]/edit/page.tsx
- src/app/admin/schools/new/page.tsx
- All files calling logActivity()

---

### Category 4: Missing Type Exports (8 errors)
**Priority:** HIGH | **Phase:** 2.3

| Type | Usage Count | Action |
|------|-------------|--------|
| SchoolStatus | 2 | Add type definition |
| AutomationRule | 1 | Add interface |
| AutomationAction | 1 | Add interface |
| CampaignSession | 1 | Add interface |

---

### Category 5: Missing UI Imports (35+ errors)
**Priority:** HIGH | **Phase:** 3.1

| Component | Files Missing Import |
|-----------|---------------------|
| Button | 3 files |
| Card, CardHeader, etc. | 5 files |
| Separator | 2 files |
| Select components | 1 file |
| SmartSappIcon | 1 file |

---

### Category 6: React Hook Form Issues (8 errors)
**Priority:** HIGH | **Phase:** 3.2

| Issue | Files | Fix |
|-------|-------|-----|
| form.control.disabled | 2 | Use state + disabled prop |
| Hook in wrong scope | 2 | Move to component level |

**Files:**
- src/app/signup/page.tsx (2 errors)
- src/app/surveys/[slug]/components/survey-form.tsx (1 error)

---

### Category 7: Firebase SDK Mixing (4 errors)
**Priority:** HIGH | **Phase:** 4.1

| File | Issue | Solution |
|------|-------|----------|
| src/lib/activity-actions.ts | Client SDK with Admin DB | Use admin SDK methods |

---

### Category 8: Survey Type Issues (15+ errors)
**Priority:** MEDIUM | **Phase:** 5

| Issue | Files | Fix |
|-------|-------|-----|
| 'logic' not in type union | 2 | Add to SurveyLayoutBlock |
| Missing Survey fields | 2 | Add workspaceIds, internalName |
| AnalyzedResult mismatch | 1 | Review type definition |

---

### Category 9: PDF/Binary Data (8 errors)
**Priority:** MEDIUM | **Phase:** 6

| Issue | Files | Fix |
|-------|-------|-----|
| Uint8Array to Blob | 4 | Use .buffer property |
| Buffer.toString() | 1 | Use Buffer.from() |

---

### Category 10: Component-Specific (20+ errors)
**Priority:** MEDIUM | **Phase:** 8

| Component | Issue | Files |
|-----------|-------|-------|
| DnD Kit | ref prop | 2 |
| Framer Motion | transition type | 1 |
| Recharts | Invalid prop | 1 |
| Canvas | willReadFrequently | 1 |

---

### Category 11: ESLint - Unused Variables (120+ warnings)
**Priority:** LOW | **Phase:** 7.1

**Strategy:** Bulk fix with prefix or removal

**Top Offenders:**
- Unused imports: 40+
- Unused state variables: 30+
- Unused function parameters: 50+

---

### Category 12: ESLint - Accessibility (45+ warnings)
**Priority:** LOW | **Phase:** 7.2

| Issue | Count | Fix Pattern |
|-------|-------|-------------|
| Click without keyboard | 15 | Add onKeyDown + role |
| Missing alt text | 10 | Add alt prop |
| Media without captions | 5 | Add <track> or note |

---

### Category 13: ESLint - Explicit Any (43 errors)
**Priority:** LOW | **Phase:** 7.3

**Distribution:**
- Type definitions: 15
- Function parameters: 20
- Component props: 8

**Strategy:** Progressive typing, critical paths first

---

## File-Level Error Count

### Top 20 Files by Error Count

| Rank | File | TS Errors | ESLint | Total | Phase |
|------|------|-----------|--------|-------|-------|
| 1 | src/app/admin/surveys/components/question-editor.tsx | 12 | 8 | 20 | 3,5 |
| 2 | src/lib/dashboard.ts | 18 | 0 | 18 | 2 |
| 3 | src/app/admin/schools/[id]/page.tsx | 3 | 0 | 3 | 2 |
| 4 | src/app/admin/surveys/[id]/results/components/analytics-view.tsx | 17 | 0 | 17 | 5 |
| 5 | src/lib/automation-processor.ts | 15 | 0 | 15 | 2,4 |
| 6 | src/app/admin/surveys/new/page.tsx | 14 | 0 | 14 | 3 |
| 7 | src/app/admin/tasks/TasksClient.tsx | 1 | 12 | 13 | 3,7 |
| 8 | src/app/surveys/[slug]/components/survey-form.tsx | 11 | 0 | 11 | 3,5 |
| 9 | src/components/SignaturePadModal.tsx | 2 | 8 | 10 | 8 |
| 10 | src/app/admin/schools/components/FocalPersonManager.tsx | 4 | 0 | 4 | 2 |

---

## Progress Tracking

### Phase Completion Status

| Phase | Description | Files | Errors | Status | ETA |
|-------|-------------|-------|--------|--------|-----|
| 1 | Dependencies | 0 | 4 | ⏳ Not Started | 2h |
| 2.1 | School Model | 18 | 45 | ⏳ Not Started | 3h |
| 2.2 | Workspace IDs | 12 | 25 | ⏳ Not Started | 2h |
| 2.3 | Type Exports | 1 | 8 | ⏳ Not Started | 1h |
| 3.1 | UI Imports | 12 | 35 | ⏳ Not Started | 1h |
| 3.2 | React Hooks | 4 | 8 | ⏳ Not Started | 2h |
| 4.1 | Firebase SDK | 1 | 4 | ⏳ Not Started | 2h |
| 5 | Survey Types | 6 | 15 | ⏳ Not Started | 2h |
| 6 | PDF/Binary | 5 | 8 | ⏳ Not Started | 1h |
| 7 | ESLint | 88 | 208 | ⏳ Not Started | 5h |
| 8 | Components | 6 | 20 | ⏳ Not Started | 3h |
| 9 | Validation | - | - | ⏳ Not Started | 2h |

**Legend:**
- ⏳ Not Started
- 🔄 In Progress
- ✅ Complete
- ⚠️ Blocked
- ❌ Failed

---

## Daily Progress Log

### Day 1: [Date]
**Target:** Phases 1, 2  
**Actual:**  
**Blockers:**  
**Notes:**

### Day 2: [Date]
**Target:** Phases 3, 4  
**Actual:**  
**Blockers:**  
**Notes:**

### Day 3: [Date]
**Target:** Phases 5, 6, 8  
**Actual:**  
**Blockers:**  
**Notes:**

### Day 4: [Date]
**Target:** Phase 7  
**Actual:**  
**Blockers:**  
**Notes:**

### Day 5: [Date]
**Target:** Phase 9  
**Actual:**  
**Blockers:**  
**Notes:**

---

## Validation Checkpoints

### After Phase 2 (Type System)
```bash
pnpm exec tsc --noEmit | grep -E "(School|workspace|Activity)"
# Expected: Significant reduction in type errors
```

### After Phase 4 (Firebase)
```bash
pnpm exec tsc --noEmit | grep -E "Firestore"
# Expected: Zero Firestore-related errors
```

### After Phase 7 (ESLint)
```bash
pnpm lint 2>&1 | grep "Error:"
# Expected: Zero errors (warnings OK)
```

### Final Validation
```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
# Expected: All pass
```

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking school data access | Medium | High | Test queries after Phase 2 |
| Firebase auth issues | Low | High | Keep admin SDK separate |
| Build time increase | Low | Low | Monitor bundle size |
| Runtime errors in production | Medium | High | Staging deployment first |
| Type system regression | Low | Medium | Lock TypeScript version |

---

**Document Status:** ACTIVE  
**Last Updated:** March 23, 2026  
**Next Review:** After Phase 2 completion
