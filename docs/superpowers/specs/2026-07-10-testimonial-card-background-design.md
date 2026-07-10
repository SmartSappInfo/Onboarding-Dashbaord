# Design Specification: Customizable Testimonial Card Backgrounds

**Date**: 2026-07-10  
**Status**: Draft / Approved

---

## 1. Goal Description

Provide website authors with the ability to customize the backgrounds of testimonial cards. Instead of being locked to the preset backgrounds (white, slate, or default dark gradient), authors can choose to:
1. Use a **Solid Color** background (via color picker).
2. Use a **Gradient** background (via start and end color pickers).
3. Use a **Custom Image** background (uploaded or selected from the media gallery) with adjustable overlay opacity (for text readability).

This option will apply to the single `testimonial` block card, as well as the individual cards within the `testimonial_grid` block.

---

## 2. Requirements & Behavior

### Schema Additions

Both `testimonial` and `testimonial_grid` schemas will support the following optional fields:

*   `cardBgType`: `'default' | 'color' | 'gradient' | 'image'` (default: `'default'`)
*   `cardBgColor`: Hex color string (default: `#0f172a` for overlays/solid background)
*   `cardBgGradientFrom`: Hex color string (default: `#3b82f6`)
*   `cardBgGradientTo`: Hex color string (default: `#8b5cf6`)
*   `cardBgImage`: URL string for background image (default: empty)
*   `cardBgImageOpacity`: Integer slider `0` to `100` (default: `50`)
*   `cardTextColor`: Hex color string (default: empty, meaning it defaults to theme colors)
*   `cardBorderColor`: Hex color string (default: empty, meaning it defaults to preset border colors)

### Editor Panel Controls

We will register fields in the block config of `testimonial` and `testimonial_grid`.
In `AutoBlockEditor.tsx`, fields will be displayed/hidden dynamically based on the current value of `cardBgType`:
*   `cardBgColor` will be shown when `cardBgType` is `'color'` or `'image'` (as the overlay tint).
*   `cardBgGradientFrom` and `cardBgGradientTo` will be shown when `cardBgType` is `'gradient'`.
*   `cardBgImage` and `cardBgImageOpacity` will be shown when `cardBgType` is `'image'`.
*   `cardTextColor` and `cardBorderColor` will be shown when `cardBgType` is any value except `'default'`.

---

## 3. Proposed Code Changes

### `testimonial.tsx` and `testimonial-grid.tsx`
*   Add the schema fields to the zod schemas.
*   Update `fields` properties array to include the new custom field definitions.
*   Add a shared helper `getCardStyle(props)` to build the React inline styles object.
*   Apply the calculated style object and text color overrides to card containers in their render methods.
*   Conditionally add inline style overrides that disable or override Tailwind background classes when `props.cardBgType !== 'default'`.

---

## 4. Verification Plan

### Automated Tests
*   Run the page-builder vitest tests: `vitest run src/lib/__tests__/page-builder` (if any exist) or components tests: `npm run test`.

### Manual Verification
1. Open the page builder and insert a Testimonial block.
2. Verify the new background fields appear in the properties panel.
3. Verify changing the background style to Solid Color, Gradient, and Image updates the card wrapper in real-time.
4. Verify the image overlay opacity slider works.
5. Verify the custom text and border colors override the defaults successfully.
6. Verify testimonial grids apply the chosen background to all individual cards inside the grid.
