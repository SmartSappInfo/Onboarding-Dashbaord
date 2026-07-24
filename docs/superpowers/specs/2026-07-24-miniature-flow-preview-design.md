# Specification: Miniature Automation Page Flow Preview

This document defines the specification for replacing the current unreadable dot-cluster flow preview in the Automation Hub with a high-fidelity miniature canvas preview card of the actual automation page.

## Problem Statement
The current `MiniFlowPreview` component calculates the bounding box of *all* nodes and scales the entire graph down to fit inside a tiny `48x48px` container. For complex workflows, this results in clusters of tiny unreadable dots, providing no clear visual insight into the trigger and initial actions.

## Proposed Design: Miniature Workspace Preview

Instead of scaling the entire graph, we will render a realistic miniature card representing the **top section** of the actual automation workspace before scrolling or zooming:

```
+--------------------------+
|  ⚡ TRIGGER: TAG ADDED   |  <- Scaled 0.25x trigger node
+------------+-------------+
             |
             v                <- SVG connector line with arrowhead
+------------+-------------+
|    ✉️ ACTION: SEND SMS    |  <- Scaled 0.25x action node
+--------------------------+
|  (subtle bottom fade)    |  <- Fade-out overlay
+--------------------------+
```

### Key Specifications:
1. **Dimensions**: A landscape card of `120px` width and `80px` height, offering a clean aspect ratio in the table view.
2. **Fixed Scaling**: Render nodes and edges at a fixed scale of `0.25x` (25% of original size).
   - Trigger node: original width 220px -> mini-node width 55px (plus padding).
   - Action/Delay node: original width 220px -> mini-node width 55px.
3. **Top-Centered Alignment**: Position the trigger node (or root node) horizontally centered at the top of the card. Compute relative coordinates of children nodes relative to the trigger node's coordinates, ensuring consistent layout positioning regardless of where the builder coordinate boundaries are.
4. **Visual Elements**:
   - **Background**: Dot grid pattern matching the visual builder canvas.
   - **Mini-Nodes**: Colored borders and backgrounds matching node types (green for trigger, blue for action, purple for delay, yellow for conditions). Includes step icons and scaled-down text.
   - **Edges**: Solid SVG lines with arrowheads linking the parent and child nodes.
   - **Bottom Fade**: A CSS linear-gradient overlay (`background: linear-gradient(to top, var(--background), transparent)`) at the bottom of the card to indicate the graph extends further.
5. **Performance**: Lightweight rendering using pure React and inline SVG coordinates. No ReactFlow initialization overhead, preventing lagging in multi-row table views.

## Proposed Changes

### Component Refactoring

#### [MODIFY] [AutomationsClient.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/automations/AutomationsClient.tsx)
* Replace the current `MiniFlowPreview` implementation with the miniature workspace preview card logic.
* Adjust column styling in the table view to accommodate the `120px` width layout cleanly.

## Verification Plan

### Automated Checks
* Run TypeScript compiler: `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --project tsconfig.json --noEmit` to verify type safety.
* Run Vitest suite: `npx vitest run` to ensure all existing tests compile and pass.

### Manual Verification
* Inspect the table view on desktop and mobile viewports to ensure column sizing wraps beautifully.
* Verify the miniature preview displays the trigger node and initial actions at high-fidelity with the bottom fade-out.
