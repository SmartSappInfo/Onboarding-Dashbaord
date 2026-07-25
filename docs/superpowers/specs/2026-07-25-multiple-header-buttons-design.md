# Design Spec: Multiple Header Buttons & Modal Action Selectors

**Date**: 2026-07-25  
**Feature**: Multiple CTA Buttons, Styling Presets, High Contrast Sidebar, and Modal Target Selector  
**Status**: APPROVED  

---

## 1. Goal Description
The page builder header will support up to 3 customizable CTA buttons. Users can configure labels, select button styling presets (Solid Primary, Secondary Outline, and Minimal Link/Ghost), resolve links to URLs, scroll anchors, or modal overlay actions, and select resource action targets via a search/category selection dialog modal.

---

## 2. Technical Design

### A. Data Schema & Zod Schemas
In [schema.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/page-builder/schema.ts):
Extend `headerSettingsSchema` to validate:
- `buttons`: An array of `headerCtaButtonSchema` (capped at 3 items).

```typescript
export const headerCtaButtonSchema = z.object({
  id: z.string(),
  label: z.string().default('Button'),
  style: z.enum(['primary', 'outline', 'ghost']).default('primary'),
  linkType: z.enum(['url', 'scroll', 'action']).default('url'),
  url: z.string().optional(),
  targetSectionId: z.string().optional(),
  action: z.enum(['receipt_request', 'open_modal_form', 'open_modal_survey', 'open_modal_agreement']).optional(),
  surveyResultMode: z.enum(['modal', 'parent']).default('modal'),
  actionTargetId: z.string().optional(),
});
```

### B. High-Contrast Sidebar Accordion UI
In [HeaderFooterSettings.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/pages/%5Bid%5D/builder/components/HeaderFooterSettings.tsx):
- Design styling overrides using high-contrast color pairings:
  - Label text color: `text-slate-300 font-bold uppercase`
  - Input field background: `bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600`
  - Dropdown select background: `bg-slate-950 border-slate-700 text-slate-100`
- Render buttons list in a collapsible accordion structure.
- Limit adding buttons to a maximum of 3.

### C. Modal Action Target Selector
When choosing a trigger action:
- We will implement a dialog popover modal (`ActionTargetModal`) using Radix UI `Dialog` components.
- The modal will query and present categorized lists:
  - **Forms**: Fills form target resource IDs.
  - **Surveys**: Fills survey target resource IDs.
  - **Agreements**: Fills agreement target resource IDs.
- User clicks to select a target resource, updating `action` and `actionTargetId`.

### D. Renderer Component Mapping
In [PageRenderer.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/components/page-builder/PageRenderer.tsx):
- Map the preset styles:
  - `primary`: Filled primary color (`backgroundColor: theme.colors.primary`).
  - `outline`: Border colored (`border: 1px solid theme.colors.primary`, transparent background).
  - `ghost`: Borderless, subtle text style.
- Map button click triggers to interaction logging: `recordInteractionAction(page.id, button.id)`.

---

## 3. Verification Plan
- Verify TypeScript types compile cleanly (`pnpm typecheck`).
- Verify ESLint warning/error checks are successful (`pnpm lint`).
- Manually check sidebar configuration form legibility and button click behavior in editor preview.
