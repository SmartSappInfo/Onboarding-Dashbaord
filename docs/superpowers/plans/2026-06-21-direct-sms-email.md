# Direct SMS and Direct Email Implementation Plan

**Goal:** Implement Direct SMS and Direct Email automation action steps allowing users to draft raw templates/texts with dynamic variables and manual destination scoping inside the automation hub.

**Architecture:** We will register two new automation action types (`DIRECT_EMAIL` and `DIRECT_SMS`). Their UI config panels will use existing `MappableInputField` controls (with multiline text areas for message bodies) and dynamic `sender_profiles` collections. The backend will intercept these actions, resolve the variables inside the subject/body using the pre-existing parser, and execute the dispatch using the raw messaging service.

---

## Technical Audit & Code Review Findings

1. **Async Waterfalls in Loop Execution**: Running sequential `await` calls for each recipient in a loop introduces an execution bottleneck. The handler must execute all dispatches concurrently using `Promise.all`.
2. **Dynamic Brand Layout Wrapper Resolution**: The current `resolveAndRender` function queries Firestore for a specific template. Passing a dummy tag like `'custom_direct_body'` will throw a database template lookup error. To resolve this, we will build the variable map dynamically using `buildVariableMap` and wrap the resolved body text in a dynamically generated HTML email template layout programmatically in memory.
3. **Suppression & Hygiene Fault Tolerance**: If a single recipient in a list of contact targets (e.g. one signatory out of three) is suppressed or fails hygiene validation, the engine must not crash the entire automation node. It should log a warning step event and proceed with the remaining recipients.
4. **Audit Logging & Activity Tracking**: `sendRawMessage` will be upgraded to write dispatches directly to the `message_logs` collection and register a `notification_sent` activity (with `isAutomation: true` to prevent recursion loops).
5. **Strict JSX Conditional Rendering**: In compliance with Vercel's `rendering-conditional-render` rule, all conditional displays in JSX in modified files must use ternary operators (`condition ? JSX : null`) instead of the logical `&&` operator to prevent accidental rendering of falsy values (like `0`).
6. **Aesthetic Transitions (Kowalski Guidelines)**: Interactive buttons and dropdown selectors must use active scale press feedback (`active:scale-[0.97] transition-all duration-150 ease-out`) and checkboxes must use `active:scale-[0.95] transition-transform` for high-fidelity interaction design.
7. **Type Safety & `any` Elimination**: Avoid all new occurrences of `any` or `any[]` in modified files. Handle exceptions using `catch (err: unknown)` with safe string/message checks.

---

## Detailed Task Breakdown

### Task 1: Schema Types and Libraries Registration

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/app/admin/automations/components/NodeInspector.tsx`
- Modify: `src/app/admin/automations/components/AutomationStepLibraryModal.tsx`

- [ ] **Step 1: Update AutomationAction type**
  Modify `src/lib/types.ts` to include `'DIRECT_EMAIL'` and `'DIRECT_SMS'` in the `AutomationAction['type']` union, and declare optional fields for direct messages.

- [ ] **Step 2: Register Actions in Action Inspector Node Registry**
  Modify `src/app/admin/automations/components/NodeInspector.tsx` to add `DIRECT_EMAIL` and `DIRECT_SMS` to the `ACTION_TYPES` registry array. Ensure all conditional renders in modified code use strict JSX ternaries.

- [ ] **Step 3: Register Actions in Step Library Modal**
  Modify `src/app/admin/automations/components/AutomationStepLibraryModal.tsx` to add `direct_email` and `direct_sms` in the `'sending_options'` category. Swap all logical `&&` conditional renders in modified code to ternaries.

---

### Task 2: Automation Schema Validation

**Files:**
- Modify: `src/lib/automation-validation.ts`

- [ ] **Step 1: Write Validation Rules for Direct Actions**
  Modify `src/lib/automation-validation.ts` inside `validateAutomationNode` to enforce configuration rules for `DIRECT_EMAIL` and `DIRECT_SMS`.

---

### Task 3: UI Configuration Panel

**Files:**
- Modify: `src/app/admin/automations/components/ActionConfigPanel.tsx`

- [ ] **Step 1: Initialize Recipient Targets and Fetch Sender Profiles**
  Add Hook queries to fetch active profiles from Firestore dynamically. Include Kowalski transitions and press states.
  
- [ ] **Step 2: Config Panel Rendering with JSX Ternaries and Animations**
  Render forms conditionally. Replace logical `&&` in the configs with strict ternaries. Use `active:scale-[0.97]` for selection controls and `active:scale-[0.95]` for checkbox triggers.

---

### Task 4: Upgrading Raw Messaging Delivery Service

**Files:**
- Modify: `src/lib/messaging-engine.ts`

- [ ] **Step 1: Audit Logging and Activity Tracking**
  Modify `sendRawMessage` to add timeline logging, activity registration, and message log writes. Clean up any instances of `any`.

---

### Task 5: Backend Engine Handler

**Files:**
- Modify: `src/lib/automations/actions/index.ts`
- Modify: `src/lib/automations/actions/message-actions.ts`

- [ ] **Step 1: Route Action Types**
  Add cases for `DIRECT_EMAIL` and `DIRECT_SMS` in `processActionNode`.
  
- [ ] **Step 2: Build handleDirectMessage and dynamic HTML Wrapper**
  Write the execution runner inside `message-actions.ts` incorporating:
  - concurrent dispatches (`Promise.all`),
  - dynamic variable compiler (`buildVariableMap`),
  - in-memory HTML email layout generator,
  - safe error boundaries (`catch (err: unknown)`).

---

### Task 6: Unit Testing

**Files:**
- Create: `src/lib/__tests__/direct-actions.test.ts`

- [ ] **Step 1: Implement direct-actions.test.ts**
  Write tests covering fixed targets, variable resolution, brand layouts, and raw sending integration using Vitest without using any `any` declarations.

---

## Verification Plan

### Automated Tests
- Run: `npx vitest run src/lib/__tests__/direct-actions.test.ts`

### Manual Verification
1. Add Direct Email / SMS nodes in canvas.
2. Edit body, add variables, check wrapper checkbox.
3. Mock run workflow and check `message_logs` in Firestore.
