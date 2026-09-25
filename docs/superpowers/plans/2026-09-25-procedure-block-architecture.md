# Architecture & Implementation Plan: Procedure Block (`procedure_list`) Overhaul

> **Owner:** Principal UI/UX Architect & Senior Frontend Specialist  
> **Status:** Pending User Approval  
> **Date:** September 25, 2026  
> **Governing Standards:** `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `backend-design`  
> **Tracking:** Checkbox (`- [ ]`) bite-sized tasks with Test-Driven Development (TDD)  

---

## 1. Executive Overview & Problem Statement

In the Page Builder & Content Studio, the **Procedure Block** (`procedure_list`) serves as the platform's **canonical chronological instructional engine**. It is used across:
- **Payment Guides:** Step-by-step instructions for Mobile Money (MoMo), USSD codes, bank wire transfers, and invoice clearing (e.g. `payment-guide-data.json`, `schools.ts`).
- **Institutional Admissions:** Multi-stage enrollment flows (e.g. `1. Book Campus Tour` ➔ `2. Submit Profile` ➔ `3. Family Welcome Conversation`).
- **Standard Operating Procedures (SOPs) & Documentation:** Structured technical walkthroughs, setup guides, and learning objectives.

### The Problem in Current Implementation (as captured in user's screenshot):
1. **Critical Defect — Steps Invisible in Inspector:** In `src/lib/page-builder/blocks/procedure-list.tsx`, `fields` only contains `[{ kind: 'text', key: 'title', label: 'Title' }, { kind: 'image', key: 'imageUrl', label: 'Image URL' }]`. The property `steps` exists in the Zod schema, but was **completely omitted from `fields`**. The properties panel provides zero interface to add, view, or edit steps!
2. **Missing Title Rendering:** `props.title` is accepted in props, but was **never rendered in the block's JSX** on canvas or client view.
3. **Dead Canvas Empty State:** When `steps.length === 0`, the canvas shows an un-clickable, dead text: `<p className="text-xs text-slate-400 italic text-center py-4">No steps added</p>`.
4. **No Visual Presets or Formatting:** Steps are rendered as an unstyled list of gray boxes with plain strings. There is no distinction between Step Title and Step Description, no connected timeline stepper, no time estimates, and no layout archetypes.

---

## 2. Visual Architecture & 5 Layout Presets

```
┌─────────────────────────────────────────────────────────────┐
│                 PROCEDURE BLOCK PROPERTIES                  │
├─────────────────────────────────────────────────────────────┤
│ PRESET STYLE (Tactile Miniature Wireframes)                 │
│ ┌─────────────────────────┐     ┌─────────────────────────┐ │
│ │ [ (1)─(2)─(3) ]         │     │ [ ┌───┐ ┌───┐ ┌───┐ ]   │ │
│ │ ✔ Connected Timeline    │     │   Elevated Cards        │ │
│ ├─────────────────────────┤     ├─────────────────────────┤ │
│ │ [ [Media] | (1)(2) ]    │     │ [ 01. ─── 02. ─── ]     │ │
│ │   Split-Media Guide     │     │   Minimal Clean         │ │
│ └─────────────────────────┘     └─────────────────────────┘ │
│                                                             │
│ PROCEDURE TITLE                                             │
│ [ Fidelity USSD Payment Procedure                         ] │
│                                                             │
│ PROCEDURE SUBTITLE                                          │
│ [ Follow these steps to complete your fee payment         ] │
│                                                             │
│ PROCEDURE STEPS                               [ + Add Step] │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ▼ Step 1: Dial USSD Code *170#              [ ⠿ ] [ 🗑 ] │ │
│ │   Title:        [ Dial USSD Code *170#                ] │ │
│ │   Description:  [ Open your phone dialer and enter... ] │ │
│ │   Time Estimate:[ 30 secs                             ] │ │
│ │   Status Badge: [ Required                            ] │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ▶ Step 2: Enter Merchant Paybill            [ ⠿ ] [ 🗑 ] │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ▶ Step 3: Confirm PIN                       [ ⠿ ] [ 🗑 ] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ COMPANION MEDIA (Diagram / Walkthrough)                     │
│ [ Image & Video Uploader Dropzone                         ] │
│                                                             │
│ MEDIA PLACEMENT                                             │
│ [ Top ]   [ Left ]   [ Right ]   [ Hidden ]                 │
│                                                             │
│ ACCENT COLOR                                                │
│ [ Swatch + #10B981                                        ] │
└─────────────────────────────────────────────────────────────┘
```

### The 5 Visual Presets:
1. **`connected-timeline` (Default / Chronological Stepper):** Vertical continuous accent line connecting numbered circular badges (`1`, `2`, `3`...). Active numbers glow with `accentColor` / primary theme. Ideal for payment procedures and sequential milestones.
2. **`elevated-cards` (Numbered Process Cards):** Modern floating cards with subtle border, soft drop shadow, numbered badge, title, and description. Ideal for member onboarding milestones and SOPs.
3. **`split-media` (Side-by-Side Diagram / Infographic Guide):** 50/50 responsive split with diagram/infographic/video on left, connected steps on right. Ideal for USSD cheat-sheets and banking details.
4. **`minimal-clean` (Editorial Numbered Outline):** Elegant typography, horizontal hairline dividers, and two-digit numerals (`01`, `02`, `03`). Ideal for academic regulations and institutional policies.
5. **`compact-badges` (Horizontal Milestone Pills):** Responsive horizontal grid of numbered pills with stage labels. Ideal for 3-4 stage journey overviews.

---

## 3. What Could Go Wrong & Mitigation Strategies (Risk Matrix)

| Risk ID | Potential Failure Scenario | Root Cause | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **R-1** | **Legacy Step Data Drift & Crash** | Existing Firestore pages and school templates store `steps: string[]`. If the schema strictly expects `steps: { id, title, description }[]`, loading legacy pages throws Zod validation errors or crashes `render()`. | Implement a **Universal Zod Union Transformer** (`z.union([z.string().transform(...), z.object(...)])`). Legacy strings automatically normalize to rich objects at parse time without database migrations or data loss. |
| **R-2** | **Public Page (`/p/[slug]`) Renderer Discrepancy** | `PublicPageClient.tsx` has its own inline renderer for `procedure_list` with `step: any`. If block properties change, public visitor pages could crash or render blank. | Align `PublicPageClient.tsx` to handle both legacy strings and rich step objects, eliminate `(step: any)`, and sanitize HTML text with `sanitizeHtml`. |
| **R-3** | **Canvas/Inspector Typing Focus Loss & Re-render Churn** | Rapidly typing into step inputs causing entire page re-renders or losing cursor focus. | Use stable step IDs (`id: genId('step')`), debounce input handlers (`RawDebouncedInput`, `RawDebouncedTextarea`), and use memoized list items. |
| **R-4** | **Empty State Trapping** | Canvas shows dead `<p>No steps added</p>` when steps array is empty, trapping author. | Render an interactive empty state card on canvas with a primary `[ + Add First Step ]` button that immediately seeds the first step. |
| **R-5** | **Text Extraction & AI Indexing Blindness** | `ContentService.extractPlainTextFromBlocks` only traversed `props.items`, missing `props.steps`. | Update `ContentService.extractPlainTextFromBlocks` to check both `props.items` and `props.steps`, ensuring SOPs and procedure steps are fully searchable in AI copilot and search indexing. |
| **R-6** | **DOM Bloat & Resource Exhaustion on Large Lists** | An author pasting 200 procedure steps causing DOM sluggishness and Firestore payload bloat. | Bound step array in schema (`z.array(...).max(50)`), and cap string lengths (`title` max 200 chars, `description` max 2000 chars). |

---

## 4. Backoffice Impact & Zero-Code Management

### How Does This Affect the Backoffice?
- In the Backoffice Content Studio (`/admin/portals` and `/admin/pages/[id]/builder`), administrators, educators, and course creators gain **100% visual, zero-code management** over procedural content:
  - **No code required to format steps:** Authors can add, remove, and reorder steps using the tactile `<ListField />` accordion.
  - **Instant 1-Click Layout Changes:** Switch between a connected vertical timeline, floating process cards, or a split-media layout using miniature wireframe cards.
  - **Media Integration:** Attach companion USSD infographic images or video walkthroughs directly through the unified uploader without external image hosting tools.
  - **Single Source of Truth:** All edits write to standard AST JSON (`block.props`), supporting instant Undo/Redo (`⌘Z`/`⌘⇧Z`) and dual-tier autosave recovery.

---

## 5. Security, Database Permissions & Scalability Protocols

1. **Public Scoped Access (`firestore.rules`):**
   - Public visitors (`/p/[slug]` and `/portal/[slug]`) access published blocks via `campaign_pages` and `campaign_page_versions` rules:
     `allow get: if resource.data.status == 'published' || resource.data.isPublishedVersion == true;`
   - Because `procedure_list` AST blocks reside directly inside the version document's `blocks` array, no new Firestore collections or indexes are required, preventing cross-tenant data leaks.
2. **XSS & Content Sanitization:**
   - All step titles and descriptions rendered in the DOM route through `sanitizeHtml()` from `src/lib/page-builder/sanitize.ts` or standard React text node escaping.
   - Companion media URLs are strictly validated against protocol whitelists (rejecting `javascript:`, data URIs, or vbscripts).
3. **Fetch, Enrich, Restore Integrity:**
   - Autosave draft recovery in `useAutosave` and `draft-actions.ts` persists the exact block state.
   - The Zod union transformer ensures that even if an emergency draft recovery restores a mixture of legacy strings and rich objects, it enriches them into the canonical format with zero data drift.

---

## 6. Phase-by-Phase Implementation Plan

### Phase 1: Universal Schema & Backward-Compatible Zod Adapter (TDD)
- **Files:**
  - Create: `src/components/page-builder/__tests__/ProcedureListSchema.test.tsx`
  - Modify: `src/lib/page-builder/blocks/procedure-list.tsx`
- [x] **Step 1: Write failing schema tests**
  - Test parsing legacy flat string steps (`steps: ['Step 1', 'Step 2']`).
  - Test parsing rich step objects (`steps: [{ id: 's1', title: 'Step 1', description: 'Desc' }]`).
  - Test default field generation and schema validation limits.
- [x] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/components/page-builder/__tests__/ProcedureListSchema.test.tsx`
- [x] **Step 3: Implement `procedureStepItemSchema` and `procedureBlockSchema`**
  - In `src/lib/page-builder/blocks/procedure-list.tsx`, define:
    ```typescript
    export const procedureStepItemSchema = z.union([
      z.string().transform((text) => ({
        id: `step-${Math.random().toString(36).substring(2, 9)}`,
        title: text,
        description: '',
        badgeText: '',
        timeEstimate: '',
      })),
      z.object({
        id: z.string().default(() => `step-${Math.random().toString(36).substring(2, 9)}`),
        title: z.string().default('Step Title'),
        description: z.string().default(''),
        badgeText: z.string().optional().default(''),
        timeEstimate: z.string().optional().default(''),
      }),
    ]);
    ```
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Commit locally** (`git commit -m "feat(procedure): implement backward-compatible universal step schema"`)

---

### Phase 2: Preset Archetypes & Runtime WYSIWYG Renderer (TDD)
- **Files:**
  - Create: `src/components/page-builder/__tests__/ProcedureListRuntime.test.tsx`
  - Modify: `src/lib/page-builder/blocks/procedure-list.tsx`
  - Modify: `src/app/p/[slug]/PublicPageClient.tsx`
  - Modify: `src/lib/services/content-service.ts`
- [x] **Step 1: Write failing runtime tests**
  - Test rendering `title` and `subtitle` on canvas.
  - Test rendering each of the 5 visual presets (`connected-timeline`, `elevated-cards`, `split-media`, `minimal-clean`, `compact-badges`).
  - Test interactive empty state card when 0 steps are present.
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement runtime renderer and presets in `procedure-list.tsx`**
  - Add `<InlineEditable />` for title and subtitle in edit mode.
  - Render connected vertical timeline line with `accentColor`.
  - Render interactive empty state card with `[ + Add First Step ]` button.
  - Render companion media (image or video) based on `mediaPosition` (`top`, `left`, `right`, `hidden`).
- [x] **Step 4: Update `PublicPageClient.tsx` and `content-service.ts`**
  - In `PublicPageClient.tsx`: remove `(step: any)`, support rich step rendering (`step.title` and `step.description`), and sanitize output.
  - In `content-service.ts`: check both `props.items` and `props.steps` in `extractPlainTextFromBlocks`.
- [x] **Step 5: Run tests to verify they pass**
- [x] **Step 6: Commit locally** (`git commit -m "feat(procedure): implement 5 visual presets, inline editing, and public runtime"`)

---

### Phase 3: Miniature Preset Selector & Inspector Wiring (TDD)
- **Files:**
  - Create: `src/components/page-builder/__tests__/ProcedurePresetSelector.test.tsx`
  - Create: `src/components/page-builder/ProcedurePresetSelector.tsx`
  - Modify: `src/lib/page-builder/blocks/procedure-list.tsx`
  - Modify: `src/components/page-builder/AutoBlockEditor.tsx`
- [x] **Step 1: Write failing selector test**
  - Test rendering 5 miniature wireframe cards.
  - Test WAI-ARIA `role="radiogroup"` and `role="radio"` with keyboard arrow navigation.
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement `ProcedurePresetSelector.tsx`**
  - 5 tactile miniature WYSIWYG wireframes with active checkmark badge and `active:scale-[0.97]` press states.
- [x] **Step 4: Register fields and wire `AutoBlockEditor.tsx`**
  - In `procedure-list.tsx`, register:
    - `preset` (`ProcedurePresetSelector`)
    - `title` (`kind: 'text'`)
    - `subtitle` (`kind: 'text'`)
    - `steps` (`kind: 'list'` with `title`, `description`, `timeEstimate`, `badgeText`)
    - `imageUrl` / `videoUrl` (`kind: 'image'`)
    - `mediaPosition` (`MediaPlacementSelector`)
    - `accentColor` (`kind: 'color'`)
  - In `AutoBlockEditor.tsx`, wire `isProcedurePreset` and suppress duplicate outer label.
- [x] **Step 5: Run tests to verify they pass**
- [x] **Step 6: Commit locally** (`git commit -m "feat(inspector): integrate ProcedurePresetSelector and rich step list management"`)

---

### Phase 4: Full System Verification & Quality Gates
- **Files:**
  - All test files across `src/components/page-builder/__tests__/` and `src/lib/services/__tests__/`
- [x] **Step 1: Run complete unit test suite**
  - Command: `npx vitest run src/components/page-builder/__tests__/ src/lib/services/__tests__/`
  - Target: 100% tests passing.
- [x] **Step 2: Run TypeScript strict check**
  - Command: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`
  - Target: 0 errors, strictly zero `any`/`any[]`/`unknown`.
- [x] **Step 3: Run ESLint verification**
  - Command: `npm run lint`
  - Target: 0 errors.
- [x] **Step 4: Verify existing templates**
  - Verify `schools.ts` and `content-templates.ts` render with 0 regressions.
- [x] **Step 5: Final local commit** (`git commit -m "refactor(procedure): complete procedure block overhaul with verification"`)
  - **Strictly local commit — no remote push.**

---

## 7. Guidelines & Inline Documentation Commitments
In all modified and created files, we will include:
1. File header block explaining the purpose, standards, and architecture.
2. Inline comments detailing what changed and why.
3. Caution areas for future maintainers (e.g. why the Zod union normalizer must be preserved for legacy string steps).
4. Testability pointers for edge cases.

---

Please review this plan. Upon your approval, we will begin implementation with Phase 1!
