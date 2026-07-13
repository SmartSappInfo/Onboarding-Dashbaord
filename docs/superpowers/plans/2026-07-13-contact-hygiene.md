# Deliverability-Based Contact Hygiene & Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a unified contact-level hygiene system that updates contact verification states based on delivery history, blocks sending to bounced/low-scoring records, and allows bulk or granular correction, re-verification, and role-preserving deletion.

**Architecture:** Use a background delivery-telemetry helper that updates verification status. Implement a transactional role-preserving delete flow. Build a responsive, mobile-first hygiene dashboard and message-log drawer for quick fixes.

**Tech Stack:** React, Next.js (App Router), Tailwind CSS, Lucide icons, Firebase Admin (Firestore).

---

## 1. What Could Go Wrong & Mitigation

### A. Risk: Deletion of Signatories Breaks Document Workflows
- **Risk**: Deleting a contact who is the primary or sole signatory of an active entity leaves the entity without a legal representative in transactional flows.
- **Mitigation**: The transaction will automatically promote the next contact in line to both `isPrimary` and `isSignatory` roles. If no other contacts exist, the transaction deletes the parent entity completely to prevent orphaned shells.

### B. Risk: Concurrency Race Conditions on contact list edits
- **Risk**: If a user runs a manual cleanup while a background verifier is writing, database updates to `entityContacts` (array) could overwrite each other.
- **Mitigation**: All contact mutations will run inside strict Firestore Transactions, taking document-level locks on the parent `entities` record before merging changes.

### C. Risk: Performance Latency in Flattened Lists
- **Risk**: Querying 10,000+ workspace entities and mapping/flattening their contact arrays on the client will cause CPU lockups.
- **Mitigation**: Implement pagination, client-side caching of mapped contacts, and debounce input search by 300ms.

### D. Risk: UI Squishing on Mobile Screens
- **Risk**: The hygiene table with columns for Company Name, Contact Email, Score, Verification Level, and Inline Actions will overflow on mobile viewports.
- **Mitigation**: Use Tailwind responsive directives to hide standard table columns on screens `< 768px` and display a mobile-friendly card layout with stackable action buttons.

---

## 2. Affected & Broken Features

- **Lead Scoring Page Filters**: The existing page-level Hygiene tab queries only at the company level. It will be refactored to filter and display individual contacts.
- **Bulk Archive/Delete Operations**: Re-verify and clean operations must support batch execution at the contact level.
- **Email/SMS Ingress**: Automations must check `emailVerificationScore` or `phoneVerificationScore` and filter out candidates before dispatching.

---

## 3. Database Schema, Rules & Indexes

### A. Firestore Indexes Required
Ensure the following composite indexes exist:
- **Collection**: `message_logs`
  - Fields: `recipient` (Ascending), `sentAt` (Descending)
- **Collection**: `workspace_entities`
  - Fields: `workspaceId` (Ascending), `status` (Ascending)

### B. Firestore Security Rules
```javascript
match /verification_cache/{hashId} {
  allow read: if request.auth != null;
  allow write: if false; // Cloud function / server action only
}
match /phone_verification_cache/{hashId} {
  allow read: if request.auth != null;
  allow write: if false; // Cloud function / server action only
}
```

---

## 4. Phase-by-Phase Tasks

### Task 1: Delivery Telemetry Helper

**Files:**
- Create: `src/lib/services/delivery-telemetry.ts`
- Test: `src/lib/__tests__/delivery-telemetry-verification.test.ts`

- [ ] **Step 1: Write the failing test**
  Create `src/lib/__tests__/delivery-telemetry-verification.test.ts` with test cases verifying that positive delivery logs return `verified` / `100` and bounced logs return `bounced` / `10`.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/lib/__tests__/delivery-telemetry-verification.test.ts`
  Expected: Fail (Module not found).
- [ ] **Step 3: Implement delivery telemetry**
  Create `src/lib/services/delivery-telemetry.ts` with `checkMessageDeliveryLogs(recipient: string, type: 'email' | 'phone')` querying `message_logs`.
- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/lib/__tests__/delivery-telemetry-verification.test.ts`
  Expected: Pass.
- [ ] **Step 5: Commit**
  Run: `git add src/lib/services/delivery-telemetry.ts src/lib/__tests__/delivery-telemetry-verification.test.ts && git commit -m "feat(hygiene): implement message delivery logs telemetry parser"`

---

### Task 2: Verifier Integration

**Files:**
- Modify: `src/lib/email-verifier.ts`
- Modify: `src/lib/phone-verifier.ts`
- Test: `src/lib/__tests__/verifier-delivery-integration.test.ts`

- [ ] **Step 1: Write the failing test**
  Create `src/lib/__tests__/verifier-delivery-integration.test.ts` verifying verifier falls back to offline checks when telemetry is absent, and returns telemetry immediately if present.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/lib/__tests__/verifier-delivery-integration.test.ts`
  Expected: Fail.
- [ ] **Step 3: Update verifiers**
  Modify verifier engines in `src/lib/email-verifier.ts` and `src/lib/phone-verifier.ts` to call `checkMessageDeliveryLogs` first.
- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/lib/__tests__/verifier-delivery-integration.test.ts`
  Expected: Pass.
- [ ] **Step 5: Commit**
  Run: `git add src/lib/email-verifier.ts src/lib/phone-verifier.ts src/lib/__tests__/verifier-delivery-integration.test.ts && git commit -m "feat(hygiene): integrate delivery telemetry with verifier engines"`

---

### Task 3: Automation Node Sending Guard

**Files:**
- Modify: `src/lib/automations/actions/message-actions.ts`
- Test: `src/lib/__tests__/automation-message-guard.test.ts`

- [ ] **Step 1: Write the failing test**
  Create `src/lib/__tests__/automation-message-guard.test.ts` verifying recipients with low scores (<40) or `bounced` status are filtered out.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/lib/__tests__/automation-message-guard.test.ts`
  Expected: Fail.
- [ ] **Step 3: Update sending actions**
  Modify `src/lib/automations/actions/message-actions.ts` to exclude bounced or low-score contacts.
- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/lib/__tests__/automation-message-guard.test.ts`
  Expected: Pass.
- [ ] **Step 5: Commit**
  Run: `git add src/lib/automations/actions/message-actions.ts src/lib/__tests__/automation-message-guard.test.ts && git commit -m "feat(hygiene): block messaging to bounced/low-score contacts"`

---

### Task 4: Database Server Actions

**Files:**
- Modify: `src/lib/automation-actions.ts`
- Test: `src/lib/__tests__/contact-hygiene-deletion.test.ts`

- [ ] **Step 1: Write the failing test**
  Create `src/lib/__tests__/contact-hygiene-deletion.test.ts` testing primary/signatory role reassignment on deletion, and clearing bounced email status.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run src/lib/__tests__/contact-hygiene-deletion.test.ts`
  Expected: Fail.
- [ ] **Step 3: Implement clean, delete, and re-verify actions**
  Append `cleanContactEmailAction`, `deleteContactAction`, and `verifySingleContactAction` to `src/lib/automation-actions.ts`.
- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run src/lib/__tests__/contact-hygiene-deletion.test.ts`
  Expected: Pass.
- [ ] **Step 5: Commit**
  Run: `git add src/lib/automation-actions.ts src/lib/__tests__/contact-hygiene-deletion.test.ts && git commit -m "feat(hygiene): implement clean, re-verify and role-preserving delete contact actions"`

---

### Task 5: CleanContactEmailDialog Component

**Files:**
- Create: `src/components/shared/CleanContactEmailDialog.tsx`

- [ ] **Step 1: Create Dialog UI**
  Implement the React dialog in `src/components/shared/CleanContactEmailDialog.tsx` with tailwind styling, validation, and action handlers. It must not expose raw code/HTML strings in the DOM, and layout must stack on mobile viewports.
- [ ] **Step 2: Typecheck the component**
  Run: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`
  Expected: Pass.
- [ ] **Step 3: Commit**
  Run: `git add src/components/shared/CleanContactEmailDialog.tsx && git commit -m "feat(ui): add CleanContactEmailDialog component"`

---

### Task 6: Hygiene Tab Re-design & Mobile Optimization

**Files:**
- Modify: `src/app/admin/entities/lead-scoring/page.tsx`

- [ ] **Step 1: Flat List & Mobile View implementation**
  Modify `src/app/admin/entities/lead-scoring/page.tsx`'s hygiene tab:
  - Flatten workspace entities into lists of individual contacts.
  - Implement verification level filters: All, High, Medium, Low/Bounced.
  - Add card elements for mobile rendering (`md:hidden`) with actions stacked vertically.
- [ ] **Step 2: Typecheck the page**
  Run: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`
  Expected: Pass.
- [ ] **Step 3: Commit**
  Run: `git add src/app/admin/entities/lead-scoring/page.tsx && git commit -m "feat(ui): flat hygiene contact list with mobile optimization and filters"`

---

### Task 7: Message Node Logs Integration

**Files:**
- Modify: `src/app/admin/automations/components/message-stats/MessageNodeLogsDialog.tsx`

- [ ] **Step 1: Embed Clean Action**
  Open `src/app/admin/automations/components/message-stats/MessageNodeLogsDialog.tsx` and place a sparkles icon trigger next to failed send logs. Mount `<CleanContactEmailDialog>` and trigger list refresh on success.
- [ ] **Step 2: Typecheck the workspace**
  Run: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`
  Expected: Pass.
- [ ] **Step 3: Commit**
  Run: `git add src/app/admin/automations/components/message-stats/MessageNodeLogsDialog.tsx && git commit -m "feat(ui): integrate CleanContactEmailDialog in MessageNodeLogsDialog"`
