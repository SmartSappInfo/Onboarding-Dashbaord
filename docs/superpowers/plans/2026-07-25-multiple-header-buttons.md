# Multiple Header Buttons & Modal Action Selectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement support for up to 3 header CTA buttons, button styling presets, high-contrast configuration accordion, and modal selectors for action targets, with full backward compatibility and analytics tracking.

**Architecture:** Use a `buttons` array nested inside header structure JSON. Implement a normalization helper to fallback to legacy single CTA fields. Create a modal dialog using Radix UI/shadcn `Dialog` for resource target selection, and update renderer components to map styling presets and log clicks.

**Tech Stack:** Next.js (app router), React 19, Radix UI Dialog, Tailwind CSS, Zod, Vitest.

---

### Task 1: Extend Data Schemas & Normalization Helper

**Files:**
- Modify: `src/lib/types.ts:3690-3715` (Add `HeaderCtaButton` and `PageHeaderSettings` extensions)
- Modify: `src/lib/page-builder/schema.ts:35-55` (Update `headerSettingsSchema` and declare `headerCtaButtonSchema`)
- Modify: `src/lib/page-builder/resolve-theme.ts:40-60` (Add `getNormalizedHeaderButtons` helper)
- Test: `src/lib/page-builder/__tests__/resolve-theme.test.ts` (Unit test normalization logic)

- [ ] **Step 1: Update type definitions in `src/lib/types.ts`**
  Add the `HeaderCtaButton` type and extend `PageHeaderSettings` with the `buttons` array:
  ```typescript
  export interface HeaderCtaButton {
    id: string;
    label: string;
    style: 'primary' | 'outline' | 'ghost';
    linkType: 'url' | 'scroll' | 'action';
    url?: string;
    targetSectionId?: string;
    action?: 'receipt_request' | 'open_modal_form' | 'open_modal_survey' | 'open_modal_agreement';
    surveyResultMode?: 'modal' | 'parent';
    actionTargetId?: string;
  }
  ```

- [ ] **Step 2: Update validation schema in `src/lib/page-builder/schema.ts`**
  Declare `headerCtaButtonSchema` and append `buttons: z.array(headerCtaButtonSchema).default([])` inside `headerSettingsSchema`.

- [ ] **Step 3: Implement normalization helper in `src/lib/page-builder/resolve-theme.ts`**
  Implement `getNormalizedHeaderButtons` to ensure backward compatibility:
  ```typescript
  export function getNormalizedHeaderButtons(header: PageHeaderSettings): HeaderCtaButton[] {
    if (header.buttons && header.buttons.length > 0) {
      return header.buttons;
    }
    if (header.showCta) {
      return [{
        id: 'header-cta-1',
        label: header.ctaText || 'Get Started',
        style: 'primary',
        linkType: header.ctaLinkType || 'url',
        url: header.ctaUrl,
        targetSectionId: header.ctaTargetSectionId,
        action: header.ctaAction,
        surveyResultMode: header.ctaSurveyResultMode || 'modal',
      }];
    }
    return [];
  }
  ```

- [ ] **Step 4: Write unit tests in `src/lib/page-builder/__tests__/resolve-theme.test.ts`**
  Verify the mapping of legacy properties and new button lists:
  ```typescript
  describe('getNormalizedHeaderButtons', () => {
    it('should map legacy header settings correctly when no buttons array exists', () => {
      const legacyHeader: PageHeaderSettings = {
        preset: 'native',
        overlap: false,
        sticky: false,
        floating: false,
        showSearch: false,
        showCta: true,
        ctaText: 'Apply Now',
        ctaUrl: '/apply',
        ctaLinkType: 'url',
        showPhone: false,
        navItems: []
      };
      const buttons = getNormalizedHeaderButtons(legacyHeader);
      expect(buttons).toHaveLength(1);
      expect(buttons[0].label).toBe('Apply Now');
      expect(buttons[0].url).toBe('/apply');
      expect(buttons[0].style).toBe('primary');
    });
  });
  ```

- [ ] **Step 5: Verify tests and type compilation**
  Run: `pnpm test resolve-theme.test.ts`
  Run: `NODE_OPTIONS='--max-old-space-size=4096' pnpm typecheck`
  Expected: All tests pass, type compilation passes.

- [ ] **Step 6: Commit**
  ```bash
  git add src/lib/types.ts src/lib/page-builder/schema.ts src/lib/page-builder/resolve-theme.ts src/lib/page-builder/__tests__/resolve-theme.test.ts
  git commit -m "feat(header): extend zod validation schema, types and normalization helper for multiple buttons"
  ```

---

### Task 2: Create Action Modal Target Selector

**Files:**
- Create: `src/app/admin/pages/[id]/builder/components/ActionTargetModal.tsx` (Target picker dialog modal)
- Test: Build validation check via typescript compilation.

- [ ] **Step 1: Implement ActionTargetModal layout**
  Implement the component wrapping forms, surveys, and agreements lists inside shadcn `Dialog`:
  ```typescript
  'use client';

  import * as React from 'react';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
  } from '@/components/ui/dialog';
  import { Button } from '@/components/ui/button';
  import { Search, Sheet, FormInput, FileText } from 'lucide-react';
  import type { BuilderResources } from '@/lib/types';

  interface ActionTargetModalProps {
    readonly isOpen: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly resources: BuilderResources;
    readonly onSelect: (action: 'receipt_request' | 'open_modal_form' | 'open_modal_survey' | 'open_modal_agreement', targetId: string) => void;
  }

  export function ActionTargetModal({ isOpen, onOpenChange, resources, onSelect }: ActionTargetModalProps) {
    const [search, setSearch] = React.useState('');
    const [activeTab, setActiveTab] = React.useState<'form' | 'survey' | 'agreement'>('form');

    const filteredForms = (resources.forms || []).filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    const filteredSurveys = (resources.surveys || []).filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    const filteredAgreements = (resources.agreements || []).filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-slate-900 border border-slate-800 text-slate-100 p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-md font-bold text-white">Select Action Target</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Pick the resource modal overlay that this CTA button triggers.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search resource..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="flex border-b border-slate-800 text-xs mt-3">
            <button
              onClick={() => setActiveTab('form')}
              className={`pb-2 px-3 flex items-center gap-1.5 font-bold ${activeTab === 'form' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-450 hover:text-slate-300'}`}
            >
              <FormInput className="h-3 w-3" /> Forms
            </button>
            <button
              onClick={() => setActiveTab('survey')}
              className={`pb-2 px-3 flex items-center gap-1.5 font-bold ${activeTab === 'survey' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-450 hover:text-slate-300'}`}
            >
              <Sheet className="h-3 w-3" /> Surveys
            </button>
            <button
              onClick={() => setActiveTab('agreement')}
              className={`pb-2 px-3 flex items-center gap-1.5 font-bold ${activeTab === 'agreement' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-450 hover:text-slate-300'}`}
            >
              <FileText className="h-3 w-3" /> Agreements
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 mt-3">
            {activeTab === 'form' && filteredForms.map(f => (
              <button
                key={f.id}
                onClick={() => {
                  onSelect('open_modal_form', f.id);
                  onOpenChange(false);
                }}
                className="w-full text-left h-8 px-2 text-xs rounded hover:bg-slate-800 transition-colors flex items-center justify-between group"
              >
                <span>{f.name}</span>
                <span className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
              </button>
            ))}

            {activeTab === 'survey' && filteredSurveys.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  onSelect('open_modal_survey', s.id);
                  onOpenChange(false);
                }}
                className="w-full text-left h-8 px-2 text-xs rounded hover:bg-slate-800 transition-colors flex items-center justify-between group"
              >
                <span>{s.name}</span>
                <span className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
              </button>
            ))}

            {activeTab === 'agreement' && filteredAgreements.map(a => (
              <button
                key={a.id}
                onClick={() => {
                  onSelect('open_modal_agreement', a.id);
                  onOpenChange(false);
                }}
                className="w-full text-left h-8 px-2 text-xs rounded hover:bg-slate-800 transition-colors flex items-center justify-between group"
              >
                <span>{a.name}</span>
                <span className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
              </button>
            ))}

            {activeTab === 'form' && filteredForms.length === 0 && (
              <div className="text-[10px] text-slate-550 text-center py-4">No forms found.</div>
            )}
            {activeTab === 'survey' && filteredSurveys.length === 0 && (
              <div className="text-[10px] text-slate-550 text-center py-4">No surveys found.</div>
            )}
            {activeTab === 'agreement' && filteredAgreements.length === 0 && (
              <div className="text-[10px] text-slate-550 text-center py-4">No agreements found.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  ```

- [ ] **Step 2: Export from components directory index or verify compilation**
  Run: `NODE_OPTIONS='--max-old-space-size=4096' pnpm typecheck`
  Expected: TypeScript compiles clean.

- [ ] **Step 3: Commit**
  ```bash
  git add src/app/admin/pages/\[id\]/builder/components/ActionTargetModal.tsx
  git commit -m "feat(editor): implement ActionTargetModal picker dialog component"
  ```

---

### Task 3: Implement High-Contrast Accordion UI Config Panel

**Files:**
- Modify: `src/app/admin/pages/[id]/builder/components/HeaderFooterSettings.tsx:90-180` (Replace CTA button section with high contrast accordion and ActionTargetModal integration)

- [ ] **Step 1: Update imports and state variables in `HeaderFooterSettings.tsx`**
  Import `getNormalizedHeaderButtons` and `ActionTargetModal`. Initialize states:
  ```typescript
  import { getNormalizedHeaderButtons } from '@/lib/page-builder/resolve-theme';
  import { ActionTargetModal } from './ActionTargetModal';
  import type { HeaderCtaButton } from '@/lib/types';
  ```
  Inside the component state definitions:
  ```typescript
  const [activeBtnIndex, setActiveBtnIndex] = React.useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalTargetBtnIdx, setModalTargetBtnIdx] = React.useState<number | null>(null);
  ```

- [ ] **Step 2: Implement dynamic list manipulation and Accordion view**
  Inside the render block, map over normalized buttons. Ensure strict high-contrast UI design matches:
  - Text labels: `text-slate-300 font-bold uppercase text-[9px]`
  - Background container cards: `bg-slate-900 border border-slate-800`
  - Input & Select controls: `bg-slate-950 border-slate-700 text-slate-100`
  - Render "+ Add Button" (only if buttons length < 3).
  - Integrates `ActionTargetModal` to bind `action` and `actionTargetId`.

- [ ] **Step 3: Verify linter and typecheck compilation**
  Run: `pnpm lint`
  Run: `NODE_OPTIONS='--max-old-space-size=4096' pnpm typecheck`
  Expected: 0 errors.

- [ ] **Step 4: Commit**
  ```bash
  git add src/app/admin/pages/\[id\]/builder/components/HeaderFooterSettings.tsx
  git commit -m "feat(editor): render high-contrast collapsible CTA buttons accordion controls with modal picker"
  ```

---

### Task 4: Integrate Renderers (Canvas & PageRenderer)

**Files:**
- Modify: `src/components/page-builder/PageRenderer.tsx` (Render dynamic buttons and style presets, track clicks)
- Modify: `src/app/admin/pages/[id]/builder/components/Canvas.tsx` (Render dynamic buttons in edit mode)

- [ ] **Step 1: Refactor `CardNavMenu` call in `PageRenderer.tsx` & `Canvas.tsx`**
  Pass the normalized buttons payload to `CardNavMenuProps` and map them inside `CardNavMenu`.

- [ ] **Step 2: Update `PageRenderer.tsx` button click handlers**
  Map button styles inside all presets:
  - `primary`: Filled color.
  - `outline`: Bordered outline.
  - `ghost`: Minimal ghost/link.
  Ensure click logs trigger `recordInteractionAction(page.id, button.id)`.

- [ ] **Step 3: Update `Canvas.tsx` header CTA rendering**
  Implement similar rendering of the dynamic buttons list. Ensure buttons are disabled/editable using inline edit configurations.

- [ ] **Step 4: Run validation linter & typecheck compiler checks**
  Run: `pnpm lint`
  Run: `NODE_OPTIONS='--max-old-space-size=4096' pnpm typecheck`
  Expected: 0 errors.

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/page-builder/PageRenderer.tsx src/app/admin/pages/\[id\]/builder/components/Canvas.tsx
  git commit -m "feat(renderer): connect dynamic buttons rendering and style presets mapping to renderer views"
  ```

---

### Task 5: Firebase Rules Verification & Production Build Validation

**Files:**
- Modify: `firestore.rules` (Double-check that structure rules permit nested configurations)

- [ ] **Step 1: Inspect firestore.rules validations**
  Verify that standard document write access holds true for the structure update changes.

- [ ] **Step 2: Run build bundle verification**
  Run: `pnpm build`
  Expected: Production bundle compiles cleanly without compile errors.

- [ ] **Step 3: Deploy Firebase rules and indexes**
  Run: `npx -y firebase-tools deploy --only firestore`
  Expected: Deploy completed successfully.

- [ ] **Step 4: Commit & Update Walkthrough**
  Create or append to `walkthrough.md` with final screenshots, verification details, and close the issue.
  ```bash
  git add walkthrough.md
  git commit -m "docs: finalize multiple header buttons implementation walkthrough"
  ```
