# Implementation Plan: Page Builder Independent Sidebars & Header/Footer Panel

This plan outlines the complete restructuring of the Page Builder layout sidebar drawers to operate independently, moving the Navigation Header and Page Footer settings to the right-side properties panel, and adding user-friendly header close buttons to both drawer panels.

---

## 1. What Could Go Wrong & Mitigation Strategies

| Scenario / Risk | Root Cause | Mitigation Strategy |
| :--- | :--- | :--- |
| **Canvas shrinkages or overlap** | Canvas and layout containers might scale poorly when both panels are open simultaneously. | Set proper flex sizing on Canvas and use CSS container transitions (`transition-all duration-300 ease-in-out`). |
| **Header/Footer configuration state loss** | Selecting a section/block might override or clear active header/footer editing states. | Ensure selection states are cleanly separated: selecting a block deselects header/footer selection, and selecting header/footer deselects block/section selection. |
| **Programmatic Tab Swapping** | Triggers (like clicking header or footer) that previously redirected to `'settings'` tab on left panel now need to expand the right panel instead. | Centralize canvas interactions so clicking header/footer updates the new `editingHeader` / `editingFooter` states and expands the right drawer. |
| **TypeScript Type Safety** | Introducing new states or components might lead to `any` cast shortcuts. | Maintain strict TypeScript typing across all component props, callbacks, and contexts. |
| **Mobile Screen Real Estate** | Having two drawers open on mobile screens will hide the canvas. | On mobile screens (defined by media queries), only allow one drawer to be open at a time (e.g. opening the right drawer closes the left sidebar drawer and vice versa). |

---

## 2. Impact on Other Features & Decoupled Elements
- **General Page Settings**: The `'settings'` tab on the left sidebar will continue to configure general page behaviors (Show Header/Show Footer checkboxes), SEO fields, and custom scripts. Only the nav links and footer copyright details move to the right.
- **Drag-and-Drop / Canvas Actions**: Unaffected because coordinates computations in `<Canvas>` use viewport-relative positions and bounds checks.

---

## 3. Firebase & Data Protocols
- **Database Schema**: No updates or new indexes required. Page structures (header, footer, sections, blocks) are stored inside the existing `CampaignPageVersion` document under the JSON columns.
- **State Hydration**: When the page loads, `builder.page` and `builder.version` are loaded from the database; header and footer settings are resolved directly from `version.structureJson`.

---

## 4. Phase-by-Phase Implementation Plan

### Phase 1: Create Header/Footer Configuration Components
- **[NEW] [HeaderFooterSettings.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/pages/%5Bid%5D/builder/components/HeaderFooterSettings.tsx)**:
  - Implement `HeaderSettingsControl` and `FooterSettingsControl` with complete inputs, selects, and links configurations.
  - Implement standard toggle row buttons matching tailwind theme design systems.

### Phase 2: Decouple Left & Right Sidebars in BuilderClient.tsx
- **[MODIFY] [BuilderClient.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/pages/%5Bid%5D/builder/BuilderClient.tsx)**:
  - Remove `'edit'` from left sidebar `tabs` list definitions.
  - Declare `editingHeader` and `editingFooter` react states.
  - Update layout width transition classes of left and right panels to be completely decoupled from tab select states.
  - Render close button toggle headers on both sidebars.
  - Integrate `HeaderSettingsControl` and `FooterSettingsControl` in the right properties sidebar.
  - Adjust canvas click triggers to open correct side configurations.

### Phase 3: Mobile Layout Optimizations
- **[MODIFY] [BuilderClient.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/pages/%5Bid%5D/builder/BuilderClient.tsx)**:
  - Add screen size check or media query detection.
  - If on mobile, opening the left panel collapses the right panel, and vice versa.

### Phase 4: Verification & Automated Tests
- **[MODIFY] [InlineEditable.test.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/components/page-builder/__tests__/InlineEditable.test.tsx)**:
  - Ensure all mock and unit tests align.
- **Compilation Check**: `pnpm typecheck`
- **Unit Test Runner**: `pnpm verify`

---

## 5. Trackable Checklist

- [ ] **Phase 1: Verify HeaderFooterSettings.tsx file creation**
- [ ] **Phase 2: Add editingHeader / editingFooter states and hooks in BuilderClient.tsx**
- [ ] **Phase 2: Decouple left and right drawers width sizing properties**
- [ ] **Phase 2: Add left panel close button header trigger**
- [ ] **Phase 2: Add right panel close button header trigger and render settings**
- [ ] **Phase 2: Remove the 'edit' icon tab button from left vertical tab bar**
- [ ] **Phase 2: Remove navigation header & page footer settings from SettingsPanel.tsx**
- [ ] **Phase 3: Add mobile drawer mutually-exclusive constraints**
- [ ] **Phase 4: Run typecheck and full vitest suite**
