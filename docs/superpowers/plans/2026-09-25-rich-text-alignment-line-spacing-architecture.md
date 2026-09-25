# Architecture & Implementation Plan: Rich Text Block Alignment & Line Spacing

> **Owner:** Principal UI/UX Architect & Senior Frontend Specialist  
> **Status:** Completed & Verified  
> **Date:** September 25, 2026  
> **Governing Standards:** `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `backend-design`  

---

## 1. Overview & Problem Statement

In the Rich Text Block properties panel, users currently only have **Preset Style**, **Font Size Override**, and **Custom Text Color**. They lack:
1. **Text Alignment Property**: Left, Center, Right, and Justified controls to structure headings, callouts, and body paragraphs without relying on inline CSS hacks.
2. **Line Spacing (Line Height) Property**: Tight (1.25×), Normal (1.5×), Relaxed (1.75×), and Loose (2.0×) controls to enhance readability across various font sizes and editorial contexts.

---

## 2. Visual Architecture & Inspector Presentation

```
┌───────────────────────────────────────────────────────────────┐
│                    RICH TEXT BLOCK PROPERTIES                 │
├───────────────────────────────────────────────────────────────┤
│ PRESET STYLE (WYSIWYG Cards)                                  │
│ [ Standard Paragraph ] [ Feature Lead Intro ] [ Disclaimer ]  │
│ [ Blockquote ]         [ Two-Column ]         [ Checklist ]   │
│                                                               │
│ FONT SIZE OVERRIDE                                            │
│ [ Slider Control: Default ───────●─────── 2XL Headline ]      │
│                                                               │
│ TEXT ALIGNMENT                                                │
│ Segmented Control: [ ⇤ Left ] [ ⇹ Center ] [ ⇥ Right ] [ ⇿ Justify ]
│                                                               │
│ LINE SPACING (LINE HEIGHT)                                    │
│ [ Tight (1.25×) ] [ Normal (1.5×) ] [ Relaxed (1.75×) ] [ Loose (2.0×) ]
│ (with stacked line indicators showing relative vertical gap)  │
│                                                               │
│ CUSTOM TEXT COLOR                                             │
│ [ Swatch + Hex Input ]                                        │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. What Could Go Wrong & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **R-1: TipTap Editor CSS Override Conflict** | ProseMirror / TipTap `<div contenteditable>` styles may override outer text-align or line-height. | In `text.tsx`, apply `#text-block-${blockId}` styles with `!important` to both outer container and child paragraphs/headings (`#text-block-${blockId} p, #text-block-${blockId} h1, #text-block-${blockId} h2, #text-block-${blockId} h3, #text-block-${blockId} div`). |
| **R-2: Backward Compatibility with Existing Content** | Existing saved blocks don't possess `lineHeight` or may have default `textAlign: 'left'`. | Default `lineHeight: 'normal'` and `textAlign: 'left'` in Zod schema so legacy blocks render identically. |
| **R-3: Mobile Touch Targets Below 44px** | Segmented alignment or line spacing buttons becoming cramped on narrow mobile screens (390px). | Enforce `min-h-[44px]` (or `min-h-[40px]` with touch-manipulation padding), responsive grid, and `active:scale-[0.97]` tactile feedback. |

---

## 4. Phase-by-Phase Implementation Steps

### Phase 1: Test-Driven Schema & CSS Verification
- Create `src/components/page-builder/__tests__/TextBlockAlignmentLineSpacing.test.tsx`.
- Extend `src/lib/page-builder/blocks/text.tsx` schema with `lineHeight` and expose `textAlign` + `lineHeight` in `fields`.
- Inject `line-height` into `#text-block-${blockId}` in `cssStyles`.

### Phase 2: Tactile `<LineSpacingSelector>` Component
- Create `src/components/page-builder/LineSpacingSelector.tsx`:
  - 4 segmented options: `tight` (1.25×), `normal` (1.5×), `relaxed` (1.75×), `loose` (2.0×).
  - Visual stacked horizontal lines showing relative leading gap.
  - Keyboard navigation (arrows, space, enter) and WAI-ARIA `role="radiogroup"`.

### Phase 3: AutoBlockEditor Routing
- In `src/components/page-builder/AutoBlockEditor.tsx`:
  - Route `lineHeight` / `lineSpacing` to `<LineSpacingSelector />`.
  - Ensure `textAlign` routes to `<AlignmentSelector />` (with `justify` icon support).

### Phase 4: Full System Verification
- Run Vitest test suites.
- Run TypeScript compiler (`tsc --noEmit`).
- Run `npm run lint`.
- Local git commit (zero remote pushes).
