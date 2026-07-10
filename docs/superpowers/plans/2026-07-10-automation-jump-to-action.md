# Implementation Plan: Automation "Jump To" Workflow Action

This document details the implementation plan for adding the **"Jump To"** (formerly Goal) automation action to the Visual Automation Builder and the step traversal runner.

---

## 1. What Could Go Wrong & Mitigation Strategies

| Scenario / Risk | Root Cause | Mitigation Strategy |
| :--- | :--- | :--- |
| **Infinite Jump Loops** | A contact jumps to a target node that immediately jumps back to the original or parent node. | Enforce a maximum chain depth limit or recursion check (already built in our runner as `chainDepth` checking). Additionally, validation in the UI should prevent selecting a target node that is an ancestor or forms a cycle. |
| **Target Node Deleted** | The target node that the "Jump To" step points to is subsequently deleted. | Perform diagnostics validation. In `DiagnosticsPanel.tsx`, flag any `jumpToNode` whose `targetNodeId` does not exist in the automation node graph. |
| **Backward Jumps** | Contact jumps backwards in the flow, causing potential state inconsistency. | Allowed by ActiveCampaign Goal nodes (e.g. for re-enrolling or retry logic). The backend execution supports this because jobs are processed contextually. |

---

## 2. Firebase & Data Protocols
- **Data Schema**: The step target and conditions are stored directly in the `Automation` document schema inside the `nodes` array:
  ```json
  {
    "id": "node-id",
    "type": "jumpToNode",
    "data": {
      "label": "Jump To Step",
      "config": {
        "targetNodeId": "target-node-id",
        "targetNodeLabel": "Target Step Label",
        "relation": "and",
        "groups": [...]
      }
    }
  }
  ```
- **Firebase Indexes/Rules**: No new indexes or rules are required since the data is stored in the existing `automations` and `automation_runs` collections.

---

## 3. Phase-by-Phase Implementation Plan

### Phase 1: Custom JumpToNode Component
- **[NEW] [JumpToNode.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/automations/%5Bid%5D/edit/components/nodes/JumpToNode.tsx)**:
  - Implement visual React Flow custom node with `CornerUpRight` icon, sky-blue accent styling, target and source handles.

### Phase 2: Node Registration & Library Additions
- **[MODIFY] [AutomationBuilder.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/automations/components/AutomationBuilder.tsx)**:
  - Register `jumpToNode` in `nodeTypes`.
  - Pass the current list of `nodes` to `<NodeInspector />`.
- **[MODIFY] [AutomationStepLibraryModal.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/automations/components/AutomationStepLibraryModal.tsx)**:
  - Add the "Jump To" action item to the list of steps in the `conditions_flow` category.

### Phase 3: Node Inspector Panel Configuration
- **[MODIFY] [NodeInspector.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/automations/components/NodeInspector.tsx)**:
  - Render configuration options for `jumpToNode`:
    - Dropdown list containing all other nodes in the automation to select the target step.
    - Render `ConditionsBuilder` to configure the jump conditions.

### Phase 4: Runner Traversal Integration
- **[MODIFY] [traverse.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/automations/nodes/traverse.ts)**:
  - Add traversal handler for `jumpToNode` that evaluates conditions:
    - If conditions are met, jump (teleport) to `targetNodeId`.
    - If not met, continue sequentially.

---

## 4. Trackable Checklist

- [x] Phase 1: Implement visual JumpToNode custom step component
- [ ] Phase 2: Add jumpToNode to visual builder nodeTypes list
- [ ] Phase 2: Add Jump To node card metadata to Step Library Modal list
- [ ] Phase 3: Build NodeInspector configuration panel with target select and conditions builder
- [ ] Phase 4: Integrate condition evaluation and teleportation jump logic in runner traverse.ts
- [ ] Phase 5: Verification tests and compilation check
