# Architecture & Implementation Plan: Divider Block Properties & Visual Styling System

> **Owner:** Principal UI/UX Architect & Senior Frontend Specialist  
> **Status:** In Progress (Plan & Execute)  
> **Date:** September 25, 2026  
> **Governing Standards:** `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `backend-design`  

---

## 1. Executive Summary & Design Vision

Currently, the Divider Block displays a standard, generic HTML text dropdown (`<select>`) with four raw text options: *Solid*, *Dashed*, *Dotted*, *Gradient*. It provides zero visual feedback, lacks width, weight/thickness, vertical spacing, alignment, and decorative center badge capabilities, and feels disjointed from the premium, tactile page builder experience established by Image Presets, Video Presets, and Title Presets.

This specification modernizes the Divider Block by replacing the dropdown with **interactive WYSIWYG wireframe cards**, adding granular visual controls, supporting dark/light theme adaptation, and introducing modern landing page divider styles (Double Hairline, Neon Glow Aura, and Center Badge/Notch).

```
┌───────────────────────────────────────────────────────────────┐
│                    DIVIDER BLOCK PROPERTIES                   │
├───────────────────────────────────────────────────────────────┤
│ DIVIDER STYLE (WYSIWYG Wireframe Cards)                       │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐ │
│ │ ──────────── │ │ - - - - - -  │ │ · · · · · ·  │ │ ── ·· ─│ │
│ │    Solid     │ │    Dashed    │ │    Dotted    │ │ Gradient │
│ └──────────────┘ └──────────────┘ └──────────────┘ └────────┘ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐ │
│ │ ════════════ │ │ ── Glow ───  │ │ ── [ OR ] ── │ │ ── ◆ ── │ │
│ │ Double Line  │ │  Neon Aura   │ │ Center Badge │ │ Diamond  │
│ └──────────────┘ └──────────────┘ └──────────────┘ └────────┘ │
│                                                               │
│ LINE WIDTH & ALIGNMENT                                        │
│ [ 100% Full ] [ 75% Wide ] [ 50% Half ] [ 25% Narrow ] [ 64px]│
│ Segmented Alignment: [ ⇤ Left ] [ ⇹ Center ] [ ⇥ Right ]      │
│                                                               │
│ THICKNESS / WEIGHT                                            │
│ [ 1px Hairline ] [ 2px Medium ] [ 4px Thick ] [ 6px Heavy ]   │
│                                                               │
│ VERTICAL SPACING                                              │
│ [ Compact (16px) ] [ Normal (32px) ] [ Relaxed (48px) ] [ 64px│
│                                                               │
│ COLOR & CENTER TEXT                                           │
│ [ Color Swatch + Hex Input ]                                  │
│ Badge Text: [ "OR" / "SECTION" / "✦" ] (if Badge / Diamond)   │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. What Could Go Wrong & Mitigation Strategies

| Potential Risk | Root Cause | Architectural Mitigation |
| :--- | :--- | :--- |
| **R-1: Backward Compatibility Break** | Existing saved pages in Firestore only possess `{ style: 'solid', color: '#e2e8f0' }` or legacy values. | Zod schema `.default()` values for all new properties (`width: 'full'`, `thickness: 'hairline'`, `spacing: 'medium'`, `alignment: 'center'`). Zero migrations required. |
| **R-2: Dark Mode Invisibility or Harsh Contrast** | Hardcoded `#e2e8f0` divider border is stark white in dark mode and can look washed out in custom backgrounds. | If color is `#e2e8f0` or default, render with semantic CSS variable tokens (`border-border/60 dark:border-white/15`), while respecting explicit custom hex picks. |
| **R-3: Alignment Layout Collapse on Narrow Widths** | Dividing lines with `< 100%` width floating left or right without proper flex containment could collapse or shift surrounding blocks. | Render inner rule inside an outer full-width flex container (`w-full flex`) with `justify-start`, `justify-center`, or `justify-end`. |
| **R-4: Mobile Touch Ergonomics Failure** | Preset cards or segmented buttons becoming smaller than 44px on mobile screens. | Strict compliance with `min-h-[44px]` (or `min-h-[58px]` for style cards), `active:scale-[0.97]` feedback, and `touch-manipulation`. |
| **R-5: Duplicate Labels in Inspector** | `AutoBlockEditor` rendering an uppercase "STYLE" label above the wireframe selector. | Suppress field label in `AutoBlockEditor` when routing divider style cards (`isDividerStyle`). |

---

## 3. What Other Features Will Be Affected?

1. **`AutoBlockEditor.tsx`**:
   - Routes `field.key === 'style'` (when divider options are present) to `<DividerStyleSelector />`.
   - Suppresses duplicate outer field label.
   - Routes `width`, `thickness`, and `spacing` to responsive segmented controls with tactile feedback.
2. **`src/lib/page-builder/blocks/divider.tsx`**:
   - Extends schema and runtime renderer to support 8 styles, 5 widths, 4 thicknesses, 4 spacings, and 3 alignments.
   - Center badge and diamond notch inline text with background cutout.
3. **Public Page & Client Portal Rendering** (`PublicPageClient.tsx`, `ContentBlockRenderer.tsx`, `PageRenderer.tsx`):
   - Seamlessly renders modern dividers with reactive styles without any breaking changes.

---

## 4. Phase-by-Phase Implementation Plan

### Phase 1: Divider Schema & Backward-Compatibility Test (TDD)
- Create `src/components/page-builder/__tests__/DividerBlockSchema.test.tsx`.
- Extend `src/lib/page-builder/blocks/divider.tsx` with Zod schema for `width`, `thickness`, `spacing`, `alignment`, `label`.
- Verify existing legacy divider blocks parse with 100% fidelity.

### Phase 2: Visual Wireframe Selector Component (`<DividerStyleSelector>`)
- Create `src/components/page-builder/__tests__/DividerStyleSelector.test.tsx`.
- Create `src/components/page-builder/DividerStyleSelector.tsx`:
  - 8 visual wireframe cards with live CSS rendering of each divider style.
  - ARIA radiogroup/radio semantics, roving tabindex, arrow navigation, DOM `.focus()` movement.
  - Touch targets $\ge 44\text{px}$ (`min-h-[58px]`), `active:scale-[0.97]`.

### Phase 3: Segmented Width, Thickness & Spacing Controls
- Create `src/components/page-builder/DividerSegmentedControls.tsx`:
  - Visual segmented buttons for Width (`100%`, `75%`, `50%`, `25%`, `Accent`).
  - Visual segmented buttons for Thickness (`1px`, `2px`, `4px`, `6px`) with actual stroke weight previews.
  - Visual segmented buttons for Vertical Spacing (`Compact`, `Normal`, `Relaxed`, `Spacious`).
  - Integrated Alignment Selector (`Left`, `Center`, `Right`).

### Phase 4: Runtime Divider Renderer Upgrade
- Upgrade `render` in `src/lib/page-builder/blocks/divider.tsx`:
  - Support Double Line, Neon Glow Aura, Center Badge Pill, and Diamond Glyph.
  - Width and alignment container layout.
  - Spacing container layout (`py-2`, `py-6`, `py-10`, `py-14`).
  - Dark mode and custom color support.
- Write runtime render tests in `src/components/page-builder/__tests__/DividerRuntimeRender.test.tsx`.

### Phase 5: AutoBlockEditor Integration & Progressive Disclosure
- Update `src/components/page-builder/AutoBlockEditor.tsx`:
  - Route `field.key === 'style'` for divider to `<DividerStyleSelector />`.
  - Route divider width, thickness, spacing, and alignment to their respective visual controls.
  - Conditional progressive disclosure for Center Badge text input.

### Phase 6: Verification, Type Check, Lint & Local Commit
- Run all vitest suites (`npx vitest run src/components/page-builder/__tests__/`).
- Run `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`.
- Run `npm run lint`.
- Local git commit (zero remote pushes).
