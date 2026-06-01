# Spec: Messaging Styles Restructuring (Dual-Wrapper & Visual Overrides)

**Created Date**: 2026-06-01  
**Status**: Draft  
**Workspace**: SmartSappInfo/Onboarding-Dashbaord  

---

## 1. Goal Description
Restructure the email styling system to separate internal administrative communications from customer-facing client communications under a single, unified `MessageStyle` model (Dual-Wrapper set). Add custom visual override tokens (colors, fonts, spacing, border-radius) that override the block-builder defaults when a style is active. Implement a Free-Text to Rich-Blocks (FER) protocol to migrate legacy templates to modern block templates.

---

## 2. Risk Analysis & Mitigations

### Risk 1: Schema Drift & Deprecation Breaks Send Engine
* **What could go wrong**: If a background job attempts to read `style.htmlWrapper` (which is deprecated/cleared in new seed styles) it will send blank or unstyled emails.
* **Mitigation**: Implement strict fallbacks. In the send engine, resolve the wrapper as:
  ```typescript
  const wrapper = target === 'internal_team' 
    ? (style.htmlWrapperInternal || style.htmlWrapper || '') 
    : (style.htmlWrapperExternal || style.htmlWrapper || '');
  ```

### Risk 2: Client-Server Rendering Divergence
* **What could go wrong**: The frontend live preview renders correctly, but the actual sent email resolves with missing placeholders or different variables.
* **Mitigation**: Extract style resolution into shared helper functions in `src/lib/messaging-utils.ts` and use them in both the preview components (`template-workshop.tsx`, `template-preview-modal.tsx`) and sending services (`messaging-engine.ts`, `bulk-messaging.ts`).

### Risk 3: Organization-Scoped Security Rule Failures
* **What could go wrong**: Attempting to fetch organization-wide styles fails due to Firestore permission boundaries.
* **Mitigation**: Update all queries fetching styles to include `where('organizationId', '==', activeOrganizationId)` alongside workspace filters, matching the security rules structure.

---

## 3. Affected Systems

1. **Send Engines**:
   - `src/lib/messaging-engine.ts` (Core render and compile routines)
   - `src/lib/bulk-messaging.ts` (Campaign sends)
   - `src/app/actions/scheduled-message-actions.ts` (Scheduled send tasks)
2. **Template Workshop Components**:
   - `src/app/admin/messaging/templates/components/template-workshop.tsx` (Style dropdown, simulated preview layout)
   - `src/app/admin/messaging/templates/components/template-preview-modal.tsx` (Target-aware previews)
   - `src/app/admin/messaging/campaigns/components/campaign-wizard.tsx` & `ComposerWizard.tsx` (Campaign preview resolution)
3. **Style Management Library**:
   - `src/app/admin/messaging/styles/page.tsx` (Library list views, set default triggers, organization scope sharing)
   - `src/app/admin/messaging/styles/[id]/page.tsx` (Double text-areas, preview toggle, color/font picker fields)

---

## 4. Phase-by-Phase Implementation Plan

### Phase 1: Database Types & Firestore Update
- Update `src/lib/types.ts` to include `htmlWrapperInternal`, `htmlWrapperExternal`, and customization fields (`primaryColor`, `fontFamily`, `backgroundColor`, etc.).
- Update Firestore rule validations (if any schema constraints exist in local rules, verify).

### Phase 2: Engine Compilation Refactoring
- Refactor `src/lib/messaging-engine.ts` compiler:
  - If `styleId` is `'default'` or empty, fetch the workspace default style.
  - If `styleId` is `'none'`, bypass styling.
  - If a style is selected, resolve the internal or external wrapper based on `template.target` (`'internal_team'` vs `'external_client'`).
- Refactor `renderBlocksToHtml` in `src/lib/messaging-utils.ts` to accept the style overrides and apply colors, typography, and card styling dynamically.
- Update `bulk-messaging.ts` and `scheduled-message-actions.ts` to use this unified compilation logic.

### Phase 3: Style Editor UI & Organational Sharing
- Modify `styles/[id]/page.tsx`:
  - Add tabbed layout to toggle editing `Internal Wrapper` vs `External Wrapper`.
  - Add inputs/color-pickers for primary/secondary colors, background, border-radius, and font.
  - Hook up the preview iframe to render the corresponding wrapper based on the active tab.
- Modify `styles/page.tsx`:
  - Fetch both local styles and organization-shared styles.
  - Ensure any workspace can view and edit organizational styles (as requested: Shared Read/Write).
  - Add "No wrapper" default state selector option.

### Phase 4: Template Composer Integration
- Modify `template-workshop.tsx`:
  - Update style selector to support: **"Use Workspace Default Style"** (`'default'`), **"No Wrapper"** (`'none'`), and specific custom styles.
  - Update preview to automatically load the workspace's default style (internal or external wrapper depending on `template.target`) if `'default'` is selected.
- Update `template-preview-modal.tsx` to handle the target-aware default wrapper resolution.

### Phase 5: FER (Free-Text to Rich-Blocks) Migration Protocol
- Create `src/lib/migrate-messaging-fer.ts`:
  - Retrieve all templates.
  - Parse legacy text-based or HTML templates and convert them into structured rich blocks (`MessageBlock[]`).
  - Set `contentMode` to `'rich_builder'`.
- Modify `src/lib/seed-messaging-blueprint.ts` to seed the three modern dual-wrapper template styles.
