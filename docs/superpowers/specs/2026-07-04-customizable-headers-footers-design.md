# Design Specification: Customizable Headers & Footers

Allows users to configure premium header navigation and footer presets at the page level in the Page Builder, with click-to-edit canvas triggers.

---

## 1. Objectives

- **Custom Header Navigation Presets**: Support multiple industry header layouts (Native, Minimal, Full Nav, CTA-only, Search-nav).
- **Page Layout Versatility**: User-configurable header positioning: Docked vs. Floating, Sticky vs. Scroll-away, and Overlapping vs. Flowed.
- **Interactive Header Features**: Fully customizable nav links (external redirects, smooth anchor scrolling to canvas sections, triggers for modals), search toggles, and CTA button destinations.
- **Custom Footer Presets**: Support Simple, Multi-Column, Social-Heavy, and Minimal footers, defaulting to organization branding metadata but allowing full manual overrides.
- **Click-to-Edit Interaction**: Clicking the header/footer on the canvas automatically focuses the builder settings panel and displays the customization drawer.

---

## 2. Proposed Database Schema updates

We will extend `CampaignPage['settings']` with optional `header` and `footer` configuration blocks:

```typescript
export interface HeaderNavItem {
  id: string;
  label: string;
  linkType: 'url' | 'scroll' | 'action';
  url?: string;
  targetSectionId?: string; // Anchor scroll destination
  action?: 'receipt_request' | 'open_modal_form' | 'open_modal_survey' | 'open_modal_agreement';
}

export interface PageHeaderSettings {
  preset: 'native' | 'minimal' | 'full-nav' | 'cta-only' | 'search-nav';
  overlap: boolean;      // Floats absolute over first section
  sticky: boolean;       // CSS position: sticky top
  floating: boolean;     // Pill capsule visual with margins vs full width docked
  showSearch: boolean;   // Show/hide search input
  showCta: boolean;
  ctaText?: string;
  ctaUrl?: string;
  showPhone: boolean;
  phoneNumber?: string;
  navItems: HeaderNavItem[];
}

export interface PageFooterSettings {
  preset: 'org' | 'simple' | 'multi-column' | 'social-heavy' | 'minimal';
  overrideOrg: boolean;  // False: use OrgBranding. True: use fields below
  copyrightText?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
  };
  navItems?: Array<{ label: string; url: string }>;
}
```

---

## 3. UI/UX and Component Structure

### Canvas Click-to-Edit Triggers
- When the user hovers over the Header or Footer in the Canvas, we render a thin dashed border outline and a small tooltip label (`Edit Navigation Header` / `Edit Page Footer`).
- Clicking on these canvas elements fires:
  ```typescript
  dispatch({ type: 'SET_TAB', payload: 'settings' });
  // Also opens the nested section in the settings tab
  ```

### Header Presets Rendering
- **Docked vs Floating**:
  - `docked`: `w-full border-b bg-white dark:bg-zinc-950 px-8 py-3` (zero margins).
  - `floating`: `max-w-4xl mx-auto my-4 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur border shadow-md px-6 py-2` (pill style).
- **Sticky vs Scroll-away**:
  - `sticky`: Uses `sticky top-0 z-50` positioning.
  - `scroll-away`: Standard static layout positioning.
- **Overlapping first section**:
  - `overlap`: absolute positioned container overlaying the first section background, utilizing transparent/glassy fills.
  - `flowed`: Sits in its own relative layout height, pushing the first section down.

---

## 4. Implementation Steps

1. **Schema & Typings**: Add definitions to `src/lib/types.ts`. Set up defaults in `src/lib/page-builder/tree-operations.ts` or initialization scripts.
2. **Settings Panel Upgrades**: Re-write `SettingsPanel.tsx` to display Accordion menus for **Header Settings** and **Footer Settings** with all field options (Preset list, alignment, overrides, sticky switches, nav item builder).
3. **Canvas Header / Footer Components**: Replace the static headers/footers in `Canvas.tsx` with dynamic, editable layouts. Connect clicks to Redux/reducer actions.
4. **Public Render Updates**: Update `PublicPageClient.tsx` to render the header and footer presets, handling overlaps, sticky scrolling, anchor navigation clicks, and search/CTA triggers.
5. **Branding Fallback Resolve**: Create a helper to dynamically resolve organization branding footers/socials when `overrideOrg` is disabled.

---

## 5. Verification Plan

- Verify dynamic header presets rendering on viewport toggles (Mobile/Tablet/Desktop).
- Test anchor scroll functionality on nav item click.
- Validate sticky vs scroll-away layout behaviors.
- Ensure click-to-edit canvas triggers properly focus settings.
