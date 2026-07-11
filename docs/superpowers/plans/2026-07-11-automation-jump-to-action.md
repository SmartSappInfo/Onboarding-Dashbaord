# Implementation Plan: Automation "Jump To" Milestone Action

This document outlines the design and step-by-step implementation for adding a new **"Jump To"** (Goals) milestone action step to the Automation Builder, Node Inspector, and Traversal Run Engine.

---

## 1. What Could Go Wrong & Mitigation Strategies

| Scenario / Risk | Root Cause | Mitigation Strategy |
| :--- | :--- | :--- |
| **Recursive/Infinite Jump Loops** | A contact meeting conditions of multiple Jump To nodes could trigger a loop of endless jumps. | Maintain a jump cycle detector per run (e.g. max 5 jumps per contact in a single execution sweep, or skip if target is same node). |
| **Stale Condition Evaluations** | When checking conditions during profile/tag updates, caching might cause the system to miss the fact that conditions are met. | Perform direct, live fetches of entity parameters and tags (bypassing caching layers) before evaluating condition groups. |
| **Interrupted Delay Jobs** | Jumping to a new node must clean up any pending delay wait timers/jobs for that contact run. | Execute a cleanup query inside a Firestore batch that cancels or deletes any pending `automation_jobs` for that contact and run before queueing the jump target job. |
| **Sequential Block Blockages** | If a contact reaches a Jump To node sequentially and the behavior is set to `'wait'`, they should be held. | If conditions aren't met, schedule a delay job or set node status to `'waiting'` so the traverse engine halts until resume triggers. |

---

## 2. Technical Architecture & Database

- **No Schema Changes**: All step details are saved inline inside the existing automation nodes and edges JSON graph.
- **Node Structure**:
  - `type`: `'jumpToNode'`
  - `label`: Name of the Goal/Milestone (e.g., "Goal: Lead Purchased Product")
  - `config`:
    - `groups`: List of condition groups containing fields/operators/values.
    - `relation`: `'and' | 'or'`
    - `jumpFromAnywhere`: `boolean` (Default: `true`)
    - `sequentialBehavior`: `'wait' | 'proceed' | 'exit'` (Default: `'wait'`)

---

## 3. Phase-by-Phase Implementation Plan

### Phase 1: Register Node Type in Builder UI
- **[NEW] [JumpToNode.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/automations/%5Bid%5D/edit/components/nodes/JumpToNode.tsx)**:
  - Create a custom React Flow node component styled with indigo/fuchsia badges, dynamic label, and active contact counter from `automation_jobs`.
- **[MODIFY] [AutomationBuilder.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/automations/components/AutomationBuilder.tsx)**:
  - Register `jumpToNode: JumpToNode` in `nodeTypes`.
  - Add label formatting case around line 943.
- **[MODIFY] [AutomationStepLibraryModal.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/automations/components/AutomationStepLibraryModal.tsx)**:
  - Add "Jump To (Goal)" option under the "Conditions & Flow" category with payload structure.

### Phase 2: Add Config Form to Node Inspector
- **[MODIFY] [NodeInspector.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/automations/components/NodeInspector.tsx)**:
  - Add editor fields for `'jumpToNode'`: Goal Name input, `ConditionsBuilder` integration, `jumpFromAnywhere` toggle, and `sequentialBehavior` select menu.

### Phase 3: Update Engine Traversal & Jump Triggers
- **[MODIFY] [traverse.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/automations/nodes/traverse.ts)**:
  - Handle `'jumpToNode'` sequentially: if conditions are met, proceed. If behavior is `'wait'`, schedule a wait job. If `'proceed'`, traverse next. If `'exit'`, complete run.
- **[NEW/MODIFY] [jump-engine.ts](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/lib/automations/jump-engine.ts)**:
  - Create standard listener/utility that checks all active runs, finds `jumpToNode` steps, evaluates conditions, terminates old active waits/jobs, and dispatches jumps.

---

## 4. Verification Plan
- **Type Checking**: Run `pnpm typecheck` to verify no compilation errors.
- **Unit Tests**:
  - Write test cases for sequential behavior and teleportation flow checks.
  - Verify overall test runner passes.
