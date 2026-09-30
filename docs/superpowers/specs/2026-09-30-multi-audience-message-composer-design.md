# Design Spec: Multi-Audience Message Composer

**Date**: 2026-09-30  
**Status**: Draft for User Review  
**Target Module**: `src/app/admin/messaging/composer` & related messaging services  
**Authors**: Antigravity & User Pair-Programming  

---

## 1. Problem Statement & Motivation
Currently, the Message Composer (`ComposerWizard.tsx`) is designed primarily to dispatch messages to **workspace entities and entity contacts**. While this works seamlessly for CRM outreach to external schools, institutions, and clients, users cannot directly:
1. Message **internal workspace team members** (e.g., notifying field agents, managers, or facilitators).
2. Dispatch to **ad-hoc lists of contacts** without creating transient, dummy entity records in the CRM database.
3. Paste or type raw comma-, colon-, semicolon-, or newline-delimited lists of phone numbers/emails and have them automatically parse into **interactive, validatable contact pills**.
4. Upload an **Excel (.xlsx, .xls)** or **CSV** spreadsheet with dynamic column-to-variable mapping.

This specification defines the complete architecture to expand Step 3 of the Message Composer into a **Mode-Exclusive Multi-Audience Selector** that cleanly accommodates all three recipient audiences without compromising variable resolution, reporting, or performance.

---

## 2. Architectural Overview

### 2.1 Mode-Exclusive Audience Architecture
To prevent variable collisions (such as CRM entity fields `{{nominalRoll}}` or `{{contact_signatory}}` being undefined for internal staff or ad-hoc rows), Step 3 operates in **Mode-Exclusive Tabs**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TARGET AUDIENCE MODE                                                        │
│ ┌──────────────────────┬──────────────────────┬───────────────────────────┐ │
│ │ 🏢 Entities & Clients│ 👥 Internal Team     │ 📋 Direct / Spreadsheet   │ │
│ │ (Active CRM Records) │ (Workspace Staff)    │ (Pills & Excel / CSV)     │ │
│ └──────────────────────┴──────────────────────┴───────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

The user selects **one** audience mode per message. All subsequent steps (Step 4: Tags & Automations, Step 5: Publish & Preview) seamlessly adapt to the selected audience mode.

---

### 2.2 The Three Audience Modes

#### Mode A: Entities & Clients (`audienceMode: 'entities'`) — *Existing & Preserved*
- **Source**: `workspace_entities` and `workspace_contacts`.
- **Targeting**: Individual selection (`EntitySelector`), custom filter rules (contact scope: `primary`, `signatories`, `roles`, `all`), and saved tag audiences.
- **Variables**: Full access to CRM entity variables and custom fields via `FieldsVariablesService`.
- **CRM Sync**: Updates `lastContactedAt` on dispatched entities.

#### Mode B: Internal Team Members (`audienceMode: 'team'`) — *New*
- **Source**: `users` collection filtered by `workspaceIds array-contains activeWorkspaceId` via the existing `useWorkspaceUsers` hook.
- **Targeting**:
  - **Role Filter Buttons**: `All`, `Admins`, `Managers`, `Staff`, `Agents`.
  - **Member Directory**: Interactive multi-select checkbox list with search bar, user avatar, display name, email, phone number, and channel readiness badge (e.g. warning icon if member has no phone and SMS/WhatsApp is chosen).
- **Variables**: Scoped to user variables (`{{user_name}}`, `{{user_email}}`, `{{user_role}}`, `{{organization_name}}`, `{{workspace_name}}`).
- **CRM Sync**: Entity CRM timelines are not modified; delivery logs are recorded in `message_logs`.

#### Mode C: Direct Input & Spreadsheet (`audienceMode: 'adhoc'`) — *New & Modernized*
- **Sub-Tabs / Toggle**:
  1. **Direct Delimited Text**: A multi-line textarea with live tokenizer converting text into interactive pills.
  2. **Spreadsheet Upload**: File dropzone supporting `.xlsx`, `.xls`, and `.csv`.
- **Variables**:
  - Direct Text: Standard fallbacks or prompt inputs.
  - Spreadsheet: Dynamic column mapper binding arbitrary spreadsheet columns (e.g. `Column "Fee Due"` -> `{{fee_due}}`).
- **CRM Sync**: No dummy entities created in Firestore; delivery logged directly in `message_logs` and `message_jobs`.

---

## 3. Intelligent Delimiter & Colon Tokenizer Specification

### 3.1 Supported Delimiters
The tokenizer accepts any combination of:
- Comma: `,`
- Semicolon: `;`
- Newline: `\n` or `\r\n`
- Tab: `\t`
- Colon: `:` (handled with smart dual-mode disambiguation)

### 3.2 Dual-Mode Colon Disambiguation (`support both`)
When a colon `:` is encountered in an input string (e.g. `X : Y`), the tokenizer applies the following deterministic heuristic:
1. **Case 1: Both X and Y are contact identifiers** (e.g. `0244123456:0201234567` or `john@a.com:jane@b.com`):
   - Treat `:` as a **list delimiter**.
   - Generates two independent contact pills (`0244123456` and `0201234567`).
2. **Case 2: One side is a label/name and the other is a contact identifier** (e.g. `Kwame Mensah: 0244123456` or `Sales Desk: sales@smartsapp.com`):
   - Treat `:` as a **Label-Contact separator**.
   - Generates a single contact pill with `displayName: "Kwame Mensah"` and `target: "+233244123456"`.
3. **Case 3: Angle-bracket format** (e.g. `Kwame Mensah <kwame@smartsapp.com>`):
   - Supported natively; extracts label and target.

### 3.3 Phone Hygiene & Country Normalization
- All parsed numbers pass through `resolveOrganizationCountryCode(activeOrganizationId)` using `libphonenumber-js` (`parsePhoneNumberWithError`).
- Pre-pass handles bare international numbers (e.g. `233242737120` without leading `+`) and local numbers (e.g. `0240488218` formatted with active organization's calling code).
- Deduplication: In-memory `Set` removes duplicates while displaying a user-friendly badge: `"[N] unique contacts ([M] duplicates removed)"`.

---

## 4. UI/UX & Component Specifications

### 4.1 `<AdHocContactPillsInput>` (`src/components/messaging/AdHocContactPillsInput.tsx`)
- **Container**: Interactive card containing the pill display area and a multi-line input textarea.
- **Pill Presentation**:
  - Valid Pill: Slate background, emerald status dot, name/number text, and clear `X` button (`min-h-[44px]` touch target, `active:scale-[0.97]` tactile click).
  - Invalid Pill: Red border, amber alert badge, and an error tooltip explaining the exact issue (e.g. `"Too few digits for Ghana phone number"`).
- **Batch Actions Bar**:
  - *"Remove [N] Invalid"* (1-click cleanup).
  - *"Clear All"*.
  - *"Copy Valid"*.

### 4.2 `<SpreadsheetRecipientImporter>` (`src/components/messaging/SpreadsheetRecipientImporter.tsx`)
- Drag-and-drop dropzone supporting `.xlsx`, `.xls`, `.csv`.
- Uses `xlsx` and `papaparse` (already installed in `package.json`).
- Auto-detects columns for `recipient` / `phone` / `email` and `name`.
- Displays dynamic dropdowns for each template variable so users can map any spreadsheet column directly.
- First 5 rows shown in a preview table.

### 4.3 `<InternalUserAudienceSelector>` (`src/components/messaging/InternalUserAudienceSelector.tsx`)
- Consumes `useWorkspaceUsers(activeWorkspaceId)`.
- Filter chips: `All`, `Admin`, `Manager`, `Staff`, `Agent`.
- Search field with real-time filtering.
- Visual badge for missing channels (e.g. "No phone number registered" if SMS channel selected).

---

## 5. High-Throughput Dispatch & Scale Guard (Rules 8 & 9)

1. **Client-Side Scalability**:
   - Pasting large batches (up to 5,000 items) parses asynchronously in chunks to prevent UI thread freezing.
   - Pill container virtualizes/caps visual rendering at 100 pills with a *"Show all [N] pills"* toggle.
2. **Server-Side Scalability**:
   - Small batches (<= 50 recipients): Dispatched via the real-time progress runner in `ComposerWizard.tsx`.
   - Large batches (> 50 recipients): Automatically routed through `createBulkMessageJob`, which splits the array into **450-item chunks** (`taskChunks`) across Firestore batch writes, remaining strictly below the 500-document limit.

---

## 6. Strict Typing Contract (Rule 4)

No `any` or `any[]` will be permitted anywhere in the implementation.

```typescript
export type ComposerAudienceMode = 'entities' | 'team' | 'adhoc';

export interface AdHocContactItem {
  id: string;
  rawInput: string;
  target: string;          // E.164 phone or lowercase email
  displayName?: string;
  isValid: boolean;
  validationError?: string;
  customVars?: Record<string, string>;
}

export interface InternalUserRecipient {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  department?: string;
  isEligibleForChannel: boolean;
}

export type ComposerRecipient = 
  | { mode: 'entities'; entityId: string; entityName: string; contactDetail: string; contactName?: string }
  | { mode: 'team'; user: InternalUserRecipient; contactDetail: string }
  | { mode: 'adhoc'; contact: AdHocContactItem; contactDetail: string };
```

---

## 7. Spec Self-Review & Verification Checklist
- [x] **Zero `any`**: All types explicitly declared.
- [x] **No hardcoded countries**: Fully integrates with cached `resolveOrganizationCountryCode`.
- [x] **No remote git pushes**: Kept strictly local until user instructs.
- [x] **Preserves pre-existing features**: Mode A retains all current entity selection, tag filtering, and saved audiences.
- [x] **Mobile-first**: All pill buttons and filter chips meet `min-h-[44px]` touch targets and Emil Kowalski tactile animations.
- [x] **Dual colon support**: Both label-separator and list-delimiter colon usage cleanly handled.
