# Call Script Builder Step Cloning Design Specification

## Overview

This specification details the design for step cloning inside the Call Script Builder's **Visual Flow** and **List View** tabs. It allows users to duplicate any script step (excluding the unique **Start Call** node) and choose between duplicating only the selected step or the entire downstream conversation branch (subtree).

---

## User Interface & Experience

### 1. Trigger Buttons
- **Visual Flow Tab:** A clone button (represented by a `Copy` icon) will be added to the properties panel header for the selected node (next to the delete/close buttons).
- **List View Tab:** A "Clone Step" button (with the `Copy` icon and uppercase text "Clone Step") will be added to the properties panel header, aligned with the "Delete Step" button.
- *Note:* Both buttons will be hidden or disabled when the protected `start` node is selected.

### 2. Duplication Choice Dialog
When clicking the clone button, a modern modal dialog (built using Radix UI's `@/components/ui/dialog` component) will prompt the user to select the cloning scope:

- **Title:** `Clone Step`
- **Body:** `How would you like to clone the step "[Step Title]"? You can clone only this step or include the entire downstream branch.`
- **Action Options:**
  1. **Clone Step Only:** Duplicates only the target step.
  2. **Clone Step & Subtree:** Duplicates the target step and all of its connected downstream descendants.
  3. **Cancel:** Closes the dialog without any modifications.

---

## Graph Duplication Algorithms

### Approach A: Clone Single Step Only
In this mode, the target step $O$ is duplicated to a new node $D$. $D$ is inserted directly below $O$, and any existing downstream connections of $O$ are transferred to exit from $D$ instead.

```
Before:
  [Parent] -> [Originator (O)] -> [Child (C)]

After:
  [Parent] -> [Originator (O)] -> [Duplicate (D)] -> [Child (C)]
```

#### Algorithm Steps:
1. **Find Descendants:** Compute the set of all descendant node IDs of $O$ by recursively traversing outgoing edges.
2. **Shift Layout:**
   - Let $dy = \text{NODE\_APPROX\_H}[O.\text{type}] + \text{VERTICAL\_GAP}$.
   - Shift the $y$-coordinate of all descendant nodes of $O$ down by $dy$ to make space for the duplicate node.
3. **Create Duplicate Node ($D$):**
   - Generate a new unique ID $D_{\text{id}}$.
   - Duplicate $O$'s properties (label, type, data, config) and append `" (Copy)"` to the label.
   - Position $D$ at $D_{\text{pos}} = (O.\text{position.x}, O.\text{position.y} + dy)$.
4. **Re-route Edges:**
   - For each outgoing edge $e$ of $O$ (where $e.\text{source} == O.\text{id}$):
     - Create a duplicate edge from $D$ to the child: $D \xrightarrow{e.\text{sourceHandle}} e.\text{target}$.
     - Replace the original edge $e$ with an edge from $O$ to $D$: $O \xrightarrow{e.\text{sourceHandle}} D$.
   - If $O$ has no outgoing edges:
     - Create a new edge $O \xrightarrow{\text{primaryHandle}} D$ (where $\text{primaryHandle}$ is retrieved via `getPrimarySourceHandle`).

---

### Approach B: Clone Step & Subtree
In this mode, the target step $O$ and all its connected descendants are duplicated. The duplicated subtree is connected to the same parent node(s) as the originator, branching as a sibling subtree.

```
Before:
  [Parent] -> [Originator (O)] -> [Child (C)]

After:
  [Parent] -> [Originator (O)] -> [Child (C)]
          \-> [Duplicate (O')] -> [Child (C')]
```

#### Algorithm Steps:
1. **Traverse Subtree:**
   - Run a breadth-first or depth-first search starting from $O$, traversing only outgoing edges.
   - Collect the set of nodes in the subtree, $\mathcal{S} = \{O, C_1, C_2, \dots\}$.
2. **Duplicate Nodes:**
   - For each node $N \in \mathcal{S}$:
     - Generate a new unique ID $N'_{\text{id}}$ and record the mapping $N \to N'$ in a dictionary.
     - Clone $N$ as $N'$ with a visual horizontal offset: $N'_{\text{pos}} = (N.\text{position.x} + 300, N.\text{position.y})$.
     - If $N$ is the root node $O$, append `" (Copy)"` to the label.
3. **Duplicate Internal Edges:**
   - For each edge $e$ in the graph where both $e.\text{source}$ and $e.\text{target}$ are in $\mathcal{S}$:
     - Create a cloned edge $e'$ connecting the duplicates: $e'.\text{source} = \text{map}[e.\text{source}]$ and $e'.\text{target} = \text{map}[e.\text{target}]$, preserving handle names and labels.
4. **Duplicate Incoming Edges:**
   - For each edge $e$ in the graph where $e.\text{target} == O.\text{id}$:
     - Create a cloned incoming edge $e'$ connecting the parent to the new root: $e'.\text{source} = e.\text{source}$ and $e'.\text{target} = \text{map}[O.\text{id}]$, preserving handle names and labels.

---

## Technical Implementation Details

We will implement the state management, dialog rendering, and graph mutation logic inside `ScriptBuilderClient.tsx`.

### 1. New Component State Hooks
```typescript
const [isCloneDialogOpen, setIsCloneDialogOpen] = React.useState(false);
const [nodeToClone, setNodeToClone] = React.useState<Node | null>(null);
```

### 2. Dialog Component Integration
Add the `<Dialog>` component at the bottom of `ScriptBuilderClient.tsx` to handle user confirmation.

### 3. Verification Plan
- **Unit Testing:** Write automated unit tests for the clone handler in a vitest file verifying edge redirecting and node shifting.
- **Manual Testing:**
  1. Add a visual flowchart branch: `Start -> Say -> Question (Yes/No) -> End`.
  2. Select `Question` and click the clone button in the sidebar. Choose "Clone Step Only".
     - Verify `Question (Copy)` is created between `Question` and its children.
     - Verify layout does not overlap and child nodes shift down.
  3. Select `Question` again and click the clone button. Choose "Clone Step & Subtree".
     - Verify a duplicated branch `Question (Copy) -> End (Copy)` is created 300px to the right.
     - Verify both branches are linked to the parent `Say` node.
