# Architecture & Implementation Plan: List Block & Preset Styles

> **Owner:** Principal UI/UX Architect & Senior Frontend Specialist  
> **Status:** Completed & Verified  
> **Date:** September 25, 2026  
> **Governing Standards:** `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `backend-design`  

---

## 1. Overview & Problem Statement

Users of the page builder need a dedicated, versatile **List Block** (`type: 'list'`) capable of presenting structured editorial copy, feature checklists, step sequences, item cards, and minimal bullet points without forcing users to write manual HTML or embed complex generic text blocks.

Crucially, users must have its **available preset styles clearly visible in the properties panel** via tactile, miniature WYSIWYG cards, matching the high design standard established by the Image, Video, and Divider presets.

---

## 2. Visual Architecture & Inspector Presentation

```
┌───────────────────────────────────────────────────────────────┐
│                      LIST BLOCK PROPERTIES                    │
├───────────────────────────────────────────────────────────────┤
│ LIST PRESET STYLE (Tactile WYSIWYG Wireframe Cards)           │
│ [ ● Bullet List ]       [ ✔ Feature Checklist ]               │
│ [ ① Numbered Steps ]    [ ▢ Item Cards ]                      │
│ [ — Minimal Dash ]      [ 💊 Compact Pills ]                  │
│                                                               │
│ LIST ITEMS (Interactive Repeater)                             │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ ▼ 1. Streamlined workspace setup                      [✕] │ │
│ │   Item Title: [ Streamlined workspace setup ]             │ │
│ │   Item Subtext: [ Complete your initial profile... ]      │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ ▶ 2. Automated compliance tracking                    [✕] │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ ▶ 3. One-click roster synchronizations                [✕] │ │
│ └───────────────────────────────────────────────────────────┘ │
│ [ + Add Item ]                                                │
│                                                               │
│ LAYOUT & COLUMNS                                              │
│ [ 1 Column ] [ 2 Columns ] [ 3 Columns ]                      │
│                                                               │
│ ITEM SPACING                                                  │
│ [ Compact (8px) ] [ Normal (14px) ] [ Relaxed (20px) ]        │
│                                                               │
│ ACCENT / BULLET COLOR                                         │
│ [ Swatch + Hex Input ]                                        │
│                                                               │
│ SHOW DESCRIPTIONS / SUBTEXT                                   │
│ [ Toggle Switch: ON ]                                         │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. The 6 Distinct List Archetypes (Presets)

| Preset Key | Archetype Name | Visual Treatment | Best Used For |
| :--- | :--- | :--- | :--- |
| `checklist` | **Feature Checklist** | Emerald / Theme checkmark circles with title & subtext | Feature highlights, "What's Included", onboarding prerequisites |
| `bullet` | **Classic Bulleted** | Solid circular accent dots with refined baseline alignment | Key takeaways, summaries, editorial lists |
| `numbered` | **Numbered Steps** | High-contrast circular index badges (`1`, `2`, `3`...) | Step-by-step instructions, ranked points, execution workflows |
| `cards` | **Item Cards** | Elevated bordered cards with subtle hover shadow | Product modules, deliverable deliverables, benefits grid |
| `minimal-dash` | **Minimal Dash** | Refined typographic em-dash markers (`—`) | Editorial magazines, minimal landing pages, legal clauses |
| `icon-pill` | **Compact Pills** | Soft rounded badges / chips with leading dot | Skill tags, platform badges, horizontal/wrapped feature pills |

---

## 4. What Could Go Wrong & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **R-1: Mobile Layout Overflow on Multi-Column Lists** | 2-column and 3-column settings breaking on narrow phone screens (390px). | Force mobile responsive grid breakpoints (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) based on selected column setting. |
| **R-2: Inspector Label Redundancy** | AutoBlockEditor printing an outer `<Label>Preset Style</Label>` above `<ListPresetSelector />`. | Add `isListPreset = field.key === 'preset' && block.type === 'list'` to outer label suppression in `AutoBlockEditor.tsx`. |
| **R-3: Keyboard Accessibility in Wireframe Selector** | Missing arrow key navigation or lack of focus trapping on the preset radiogroup. | Implement full WAI-ARIA `role="radiogroup"` / `role="radio"` with roving tabindex, Arrow key handlers, and DOM focus transfer. |
| **R-4: Empty State & Edit Mode Fallback** | List block rendering completely blank when items array is empty. | Display a friendly, tactile empty placeholder in edit mode (`"No list items added yet. Click + Add to start."`). |

---

## 5. Phase-by-Phase Implementation Plan

### Phase 1: Block Type Contract & Registration (TDD)
- [x] Update `PageBlockType` in `src/lib/types.ts` to include `'list'`.
- [x] Update `normalizeBlockType()` in `src/lib/page-builder/registry.tsx` to handle `'list'`, `'listsection'`, `'bulletlist'`, `'checklist'`, `'featurelist'`.
- [x] Register `'list'` in `src/lib/page-builder/blocks/index.ts`.
- [x] Expose in `BlockPalette.tsx` (Basic & Marketing) and `BlockInsertButton.tsx` (Quick Blocks).

### Phase 2: List Block Definition & Runtime Renderer (`src/lib/page-builder/blocks/list.tsx`)
- [x] Write failing unit tests in `src/components/page-builder/__tests__/ListBlockSchema.test.tsx`.
- [x] Implement Zod schema with `items`, `preset`, `columns`, `spacing`, `bulletColor`, `textColor`, `showDescriptions`.
- [x] Implement rendering pipeline supporting all 6 presets, responsive grid columns, and theme adaptation.

### Phase 3: Visual Wireframe Selector (`ListPresetSelector.tsx`)
- [x] Write failing unit tests in `src/components/page-builder/__tests__/ListPresetSelector.test.tsx`.
- [x] Create `src/components/page-builder/ListPresetSelector.tsx` with 6 interactive miniature WYSIWYG cards.
- [x] Support roving tabindex, keyboard arrow navigation, active checkmark badges, and touch targets $\ge 44\text{px}$.

### Phase 4: AutoBlockEditor Integration & Progressive Disclosure
- [x] Route `field.key === 'preset' && block.type === 'list'` to `<ListPresetSelector />`.
- [x] Ensure repeater `items` renders clean collapsible list cards.
- [x] Add test and verification in `src/components/page-builder/__tests__/AutoBlockEditorListPresets.test.tsx`.

### Phase 5: Verification & Quality Gates
- [x] Run all vitest unit tests (30 suites, 134/134 passed).
- [x] Run `tsc --noEmit` (0 errors).
- [x] Run `npm run lint` (0 errors).
- [x] Commit locally with descriptive message (no remote pushes).
