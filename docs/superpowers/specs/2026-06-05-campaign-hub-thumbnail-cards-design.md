# Campaign Hub — Thumbnail Card Redesign Spec

**Date:** 2026-06-05  
**Feature:** Campaign Hub (`/admin/pages`) page card redesign with high-fidelity preview thumbnails, inline engagement stats, hover-based quick actions, and a kebab menu for infrequent operations.

---

## Summary

Replace the current `PageCard` component in `PagesClient.tsx` with a premium, industry-standard card design. Each card is a perfect square showing a CSS-rendered goal-aware mini page preview, engagement stats in a single horizontal row, and context-sensitive actions accessible via hover overlay (icons) and a persistent kebab menu.

---

## Design Decisions Confirmed

### Card Layout (top → bottom)
1. **Preview window** — fills all remaining vertical space (flex: 1), overflows hidden, contains:
   - `GoalPreview` component: CSS-only mini page scaled to fill exactly (JS `transform: scale(cardWidth/900)`)
   - **Hover overlay** (opacity 0 → 1 on card hover): 5 frosted-glass icon buttons with tooltips
   - **Kebab `⋮` button** — always visible, top-right corner, frosted glass, `z-index: 20`
2. **Title + slug + badges row** — fixed height (52px), flex, truncates long names
3. **Stats row** — 3-column grid, single horizontal row: Views · Converts · CVR

### Card Shape
- `aspect-ratio: 1 / 1` (perfect square)
- `border-radius: 20px`
- `border: 2px solid` (default border; indigo on selected/hover)
- `overflow: hidden`

### Hover Overlay — Icon Buttons (5 icons)
| Icon | Action | Tooltip |
|------|--------|---------|
| Pencil | Open Builder | "Open Builder" |
| Eye | Preview modal | "Preview" |
| External link | Open live page (new tab) | "Live Page" |
| Link chain | Copy public URL | "Copy Link" |
| Copy stack | Duplicate as draft | "Duplicate" |

### Kebab Menu Items
- Edit Draft _(opens builder, same as pencil icon)_
- View Analytics _(opens analytics detail view)_
- Publish / Unpublish _(toggle page status)_
- Settings _(opens page settings panel)_
- Archive
- Delete _(draft-only, shows confirmation dialog)_

---

## Goal-Aware Preview Component (`GoalPreview`)

A CSS-only component that renders a mini-page layout matching the `CampaignPage.pageGoal` value. Uses the page's `settings.themeOverrides.primary` color (fallback: indigo `#6366f1`).

| `pageGoal` | Preview Layout |
|-----------|---------------|
| `lead_capture` | Dark gradient hero, headline, email input + CTA, social proof avatars |
| `registration` | Light split layout — value props left, branded form panel right |
| `information` | Dark editorial — bento grid of feature tiles + CTA row |
| `payment` | Clean centered pricing card with amount, feature checklist, pay button |
| `thank_you` | Centered success state — large checkmark, confirmation message, next steps |

The inner content div is always `900px` wide. JavaScript calculates `scale = cardWidth / 900` and sets `height = previewWindowHeight / scale` so the mini page fills the preview window perfectly with no letterboxing.

---

## Files to Create/Modify

### New Files
- `src/app/admin/pages/components/PageCard.tsx` — extracted card component (from inline in `PagesClient.tsx`)
- `src/app/admin/pages/components/GoalPreview.tsx` — CSS-only goal-aware mini page renderer

### Modified Files
- `src/app/admin/pages/PagesClient.tsx` — replace inline `PageCard` with imported component; wire new action handlers (analytics, publish/unpublish, archive, delete, settings)

---

## Stats Displayed

From `CampaignPage.stats`:
- **Views** → `stats.views`
- **Converts** → `stats.conversions`
- **CVR** → `(conversions / views * 100).toFixed(1)%` (handle division by zero → `"—"`)

When `stats` is absent (new/draft pages with no data): show `—` in each stat cell.

---

## Kebab Menu Implementation

Use existing `DropdownMenu` + `DropdownMenuContent` from `@/components/ui/dropdown-menu`. The button is absolutely positioned `top: 10px; right: 10px` over the preview window with `z-index: 20`. Frosted glass style: `bg-black/40 backdrop-blur-md border border-white/20 text-white`.

Conditional rendering:
- **Edit Draft** — only when `status === 'draft'`
- **Publish** — only when `status === 'draft'` or `'archived'`
- **Unpublish** — only when `status === 'published'`
- **Delete** — only when `status === 'draft'`
- **Archive** — when not already `'archived'`

---

## Hover Overlay Tooltip Pattern

Use CSS `::after` pseudo-elements (no JS, no Radix Tooltip overhead) for the icon button tooltips. Each `.overlay-btn::after { content: attr(data-tip); }` pattern — no imports required.

---

## Accessibility

- All icon buttons have `aria-label` attributes matching the tooltip text
- Kebab trigger has `aria-label="More options"`
- `aspect-ratio` cards remain keyboard-navigable (tabIndex on card wrapper)
- Hover overlay actions are also reachable via the kebab menu (same actions available both places for keyboard/touch users)

---

## Error / Empty States

- **No pages yet**: existing empty state preserved (dashed border, icon, CTA)
- **Stats loading**: display `—` skeleton-style until data resolves
- **Duplicate in-progress**: kebab item shows `Loader2` spinner while duplicating (existing pattern from `PagesClient.tsx`)

---

## Out of Scope

- Server-side screenshot generation (Puppeteer/headless) — deferred
- Drag-to-reorder cards
- Bulk selection/actions
