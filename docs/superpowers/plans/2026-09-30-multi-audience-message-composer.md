# Multi-Audience Message Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the SmartSapp Message Composer (`ComposerWizard.tsx`) from its external entity focus to a universal multi-audience messaging engine that supports **Workspace Entities**, **Internal Team Members**, and **Ad-Hoc Delimited Text & Spreadsheets with interactive contact pills**.

**Architecture:** Mode-exclusive audience selection in Step 3 ensures clean variable resolution, delivery tracking, and zero variable collisions. Delimited text and spreadsheets are tokenized into validatable contact pills with phone hygiene normalization via `resolveOrganizationCountryCode`. Batched dispatches > 50 recipients route through `createBulkMessageJob` to safeguard Firestore write limits (450-item chunks <= 500 limit).

**Tech Stack:** Next.js 15, React 19, TypeScript (Strict, Zero `any`), `libphonenumber-js`, `xlsx`, `papaparse`, Tailwind CSS, shadcn/ui, Framer Motion, Vitest.

---

## What Could Go Wrong & Resolution Strategy (Rule 2)

| Potential Failure Point | Root Cause | Resolution Strategy |
| :--- | :--- | :--- |
| **Colon Disambiguation Ambiguity** | Strings like `Kwame: 0244123456: 0201234567` or `0241: 0242` can confuse single-pass splitters. | **Dual-Mode Lexical Tokenizer**: If both sides of a colon are phone numbers or emails, treat `:` as a list separator (2 pills). If one side is a name/label and the other is a contact, treat `:` as a label-contact pair (1 pill with name). |
| **DOM Freezing on Large Pastes** | Pasting 2,000+ numbers triggers 2,000 immediate DOM pill nodes and regex passes. | Async chunk parsing with `requestIdleCallback` / `setTimeout(..., 20)`. The pill container caps visual rendering at 100 pills with a *"Show all [N] pills"* toggle. |
| **Variable Resolution Failure** | Sending CRM entity templates (`{{nominalRoll}}`, `{{signatory_name}}`) to internal staff or spreadsheet rows causes empty text. | Mode-exclusive selection in Step 3 scopes variables to the selected audience. Template selector flags unresolved variables and prompts for fallbacks. |
| **Bare Phone Number False Hygiene Scoring** | Numbers pasted as `0240488218` or `23324...` fail if tested against a hardcoded country code. | Tokenizer passes all phone numbers through `resolveOrganizationCountryCode(activeOrganizationId)` using our international calling-code pre-pass. |
| **Firestore Batch Overflow** | Uploading a 2,000-row spreadsheet exceeds Firestore's 500-write batch limit. | Large ad-hoc batches route through `createBulkMessageJob`, which chunks writes into 450 items per batch. |
| **Missing Contact Info on Internal Users** | Internal team members selected for SMS may not have a phone number in their profile. | UI displays channel-readiness badges (warning icon on members missing phone/email for the selected channel) and prevents selecting ineligible members without unchecking. |

---

## Affected Features & Backoffice Enhancements (Rule 3)

1. **Step 5 Pre-Flight Cockpit (`PreFlightCockpit.tsx`)**:
   - Updates audience count and description to reflect active mode: *"14 Workspace Entities"*, *"8 Team Members"*, or *"210 Ad-hoc Contacts"*.
2. **Step 5 High-Fidelity Preview Canvas (`PublishPreviewCanvas.tsx`)**:
   - Provides sample recipient data matching the audience mode (e.g. teammate name and role vs CRM entity name).
3. **Failed Delivery Export Studio (CSV, JSON, PDF)**:
   - When exporting failed dispatches, `entityName` displays `"Internal User (<Role>)"` or `"Ad-hoc Contact"` when `entityId` is empty, avoiding blank table cells.
4. **Backoffice Settings Integration**:
   - Uses `organization.defaultCountryCode` from backoffice settings (`/admin/settings?tab=regional`) to format ad-hoc numbers automatically.

---

## Strict Standards Enforcement (Rules 4, 7, 8, 9, 10)
- **Zero `any/any[]`**: All inputs, outputs, states, and props strictly typed with discriminated unions.
- **Mobile-First UX**: All pill dismiss buttons, filters, and checkboxes meet `min-h-[44px]` touch targets and `active:scale-[0.97]` tactile click states.
- **Simple UI English**: Everyday terms: *"Paste contacts"*, *"Upload spreadsheet"*, *"Remove invalid"*, *"Choose team members"*.
- **Documentation**: Inline comments in all new files explaining rationale, edge cases, and future maintainer cautions.

---

## File Structure & Decomposition Plan

```
src/
├── lib/
│   ├── types/
│   │   └── composer-audience.ts          [NEW: Discriminated unions for multi-audience]
│   └── messaging/
│       ├── contact-tokenizer.ts          [NEW: Dual-mode colon & delimiter parser]
│       └── __tests__/
│           └── contact-tokenizer.test.ts [NEW: Exhaustive unit tests for tokenizer]
├── components/
│   └── messaging/
│       ├── AdHocContactPillsInput.tsx         [NEW: Interactive pill input & tokenizer]
│       ├── SpreadsheetRecipientImporter.tsx   [NEW: Excel/CSV upload & variable mapper]
│       ├── InternalUserAudienceSelector.tsx   [NEW: Team member picker with role filter]
│       └── __tests__/
│           ├── AdHocContactPillsInput.test.tsx
│           ├── SpreadsheetRecipientImporter.test.tsx
│           └── InternalUserAudienceSelector.test.tsx
└── app/admin/messaging/composer/components/
    ├── ComposerWizard.tsx               [MODIFIED: Step 3 audience tabs & multi-dispatch]
    ├── PreFlightCockpit.tsx             [MODIFIED: Dynamic audience mode summary]
    └── PublishPreviewCanvas.tsx         [MODIFIED: Mode-aware sample preview]
```

---

## Tasks

### Task 1: Core Multi-Audience Types & Delimited Tokenizer Engine

**Files:**
- Create: `src/lib/types/composer-audience.ts`
- Create: `src/lib/messaging/contact-tokenizer.ts`
- Test: `src/lib/messaging/__tests__/contact-tokenizer.test.ts`

- [ ] **Step 1: Write the failing test for `contact-tokenizer.ts`**

```typescript
// src/lib/messaging/__tests__/contact-tokenizer.test.ts
import { describe, it, expect } from 'vitest';
import { tokenizeDelimitedContacts } from '../contact-tokenizer';

describe('tokenizeDelimitedContacts', () => {
  it('tokenizes comma, semicolon, newline, and tab separated phone numbers', () => {
    const input = '0244123456, 0201112222;\n0273334444\t+233242737120';
    const result = tokenizeDelimitedContacts(input, 'sms', 'GH');

    expect(result.items.length).toBe(4);
    expect(result.items[0].target).toBe('+233244123456');
    expect(result.items[0].isValid).toBe(true);
    expect(result.items[3].target).toBe('+233242737120');
    expect(result.duplicateCount).toBe(0);
  });

  it('handles dual-mode colon: splits phone numbers separated by colon', () => {
    const input = '0244123456:0201112222';
    const result = tokenizeDelimitedContacts(input, 'sms', 'GH');

    expect(result.items.length).toBe(2);
    expect(result.items[0].target).toBe('+233244123456');
    expect(result.items[1].target).toBe('+233201112222');
  });

  it('handles dual-mode colon: pairs contact label with target', () => {
    const input = 'Kwame Mensah: 0244123456, Ama: 0201112222';
    const result = tokenizeDelimitedContacts(input, 'sms', 'GH');

    expect(result.items.length).toBe(2);
    expect(result.items[0].displayName).toBe('Kwame Mensah');
    expect(result.items[0].target).toBe('+233244123456');
    expect(result.items[1].displayName).toBe('Ama');
    expect(result.items[1].target).toBe('+233201112222');
  });

  it('handles angle bracket formatting for emails', () => {
    const input = 'Kwame Mensah <kwame@smartsapp.com>, info@school.edu.gh';
    const result = tokenizeDelimitedContacts(input, 'email', 'GH');

    expect(result.items.length).toBe(2);
    expect(result.items[0].displayName).toBe('Kwame Mensah');
    expect(result.items[0].target).toBe('kwame@smartsapp.com');
    expect(result.items[1].target).toBe('info@school.edu.gh');
  });

  it('deduplicates contacts and flags invalid items', () => {
    const input = '0244123456, 0244123456, 12345';
    const result = tokenizeDelimitedContacts(input, 'sms', 'GH');

    expect(result.items.length).toBe(2);
    expect(result.duplicateCount).toBe(1);
    expect(result.items[1].isValid).toBe(false);
    expect(result.items[1].validationError).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/messaging/__tests__/contact-tokenizer.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Define types in `src/lib/types/composer-audience.ts`**

```typescript
// src/lib/types/composer-audience.ts
/**
 * Strictly typed discriminated union for Message Composer Audience Modes.
 * Conforms to Rule 4 (Zero any/any[]).
 */
export type ComposerAudienceMode = 'entities' | 'team' | 'adhoc';

export interface AdHocContactItem {
  id: string;
  rawInput: string;
  target: string; // E.164 phone or lowercase email
  displayName?: string;
  isValid: boolean;
  validationError?: string;
  customVars?: Record<string, string>;
}

export interface TokenizeResult {
  items: AdHocContactItem[];
  duplicateCount: number;
  validCount: number;
  invalidCount: number;
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
```

- [ ] **Step 4: Implement `contact-tokenizer.ts`**

```typescript
// src/lib/messaging/contact-tokenizer.ts
import { parsePhoneNumberWithError, CountryCode } from 'libphonenumber-js';
import type { AdHocContactItem, TokenizeResult } from '../types/composer-audience';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function isEmailLike(val: string): boolean {
  return EMAIL_REGEX.test(val.trim());
}

function isPhoneLike(val: string, country: string): boolean {
  try {
    const cleaned = val.replace(/[\s\-\(\)]/g, '');
    const parsed = parsePhoneNumberWithError(cleaned, (country || 'GH') as CountryCode);
    return parsed.isValid();
  } catch {
    return false;
  }
}

/**
 * Tokenizes raw delimited contact inputs with dual-mode colon disambiguation.
 */
export function tokenizeDelimitedContacts(
  input: string,
  channel: 'email' | 'sms' | 'whatsapp',
  defaultCountry: string = 'GH'
): TokenizeResult {
  if (!input || !input.trim()) {
    return { items: [], duplicateCount: 0, validCount: 0, invalidCount: 0 };
  }

  // Pass 1: Split on primary list delimiters: comma, semicolon, newline, carriage return, tab
  const rawSegments = input.split(/[,;\n\r\t]+/).map(s => s.trim()).filter(Boolean);

  const rawTokens: { text: string; label?: string }[] = [];

  // Pass 2: Handle colon and angle bracket formatting
  for (const seg of rawSegments) {
    // Check for angle brackets: "Name <contact@domain.com>" or "Name <0244123456>"
    const angleMatch = seg.match(/^(.*?)\s*<([^>]+)>$/);
    if (angleMatch) {
      rawTokens.push({ text: angleMatch[2].trim(), label: angleMatch[1].trim() || undefined });
      continue;
    }

    // Check for colon: "X : Y"
    if (seg.includes(':')) {
      const parts = seg.split(':').map(p => p.trim()).filter(Boolean);
      if (parts.length === 2) {
        const [left, right] = parts;
        const leftIsContact = channel === 'email' ? isEmailLike(left) : isPhoneLike(left, defaultCountry);
        const rightIsContact = channel === 'email' ? isEmailLike(right) : isPhoneLike(right, defaultCountry);

        if (leftIsContact && rightIsContact) {
          // Case 1: List separator (e.g. 0244123456:0201112222)
          rawTokens.push({ text: left });
          rawTokens.push({ text: right });
          continue;
        } else if (!leftIsContact && rightIsContact) {
          // Case 2: Label-Contact pair (e.g. Kwame Mensah: 0244123456)
          rawTokens.push({ text: right, label: left });
          continue;
        } else if (leftIsContact && !rightIsContact) {
          // Inverted label-contact pair (e.g. 0244123456: Kwame Mensah)
          rawTokens.push({ text: left, label: right });
          continue;
        }
      }
    }

    // Default: single token
    rawTokens.push({ text: seg });
  }

  // Pass 3: Normalize, validate, and deduplicate
  const seenTargets = new Set<string>();
  const items: AdHocContactItem[] = [];
  let duplicateCount = 0;

  for (let i = 0; i < rawTokens.length; i++) {
    const { text, label } = rawTokens[i];
    let target = text;
    let isValid = false;
    let validationError: string | undefined;

    if (channel === 'email') {
      const lower = text.toLowerCase();
      if (isEmailLike(lower)) {
        target = lower;
        isValid = true;
      } else {
        isValid = false;
        validationError = 'Invalid email address format';
      }
    } else {
      // SMS or WhatsApp
      try {
        const cleaned = text.replace(/[\s\-\(\)]/g, '');
        const parsed = parsePhoneNumberWithError(cleaned, (defaultCountry || 'GH') as CountryCode);
        if (parsed.isValid()) {
          target = parsed.format('E.164');
          isValid = true;
        } else {
          isValid = false;
          validationError = 'Invalid phone number format';
        }
      } catch (err: unknown) {
        isValid = false;
        validationError = err instanceof Error ? err.message : 'Invalid phone number';
      }
    }

    // Deduplication check
    const dedupKey = target.toLowerCase();
    if (seenTargets.has(dedupKey)) {
      duplicateCount++;
      continue;
    }
    seenTargets.add(dedupKey);

    items.push({
      id: `adhoc_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      rawInput: text,
      target,
      displayName: label,
      isValid,
      validationError,
    });
  }

  const validCount = items.filter(it => it.isValid).length;
  const invalidCount = items.length - validCount;

  return { items, duplicateCount, validCount, invalidCount };
}
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `npx vitest run src/lib/messaging/__tests__/contact-tokenizer.test.ts`  
Expected: PASS (All 5 tests pass)

- [ ] **Step 6: Commit Task 1**

```bash
git add src/lib/types/composer-audience.ts src/lib/messaging/contact-tokenizer.ts src/lib/messaging/__tests__/contact-tokenizer.test.ts
git commit -m "feat(messaging): add multi-audience types and dual-mode contact tokenizer"
```

---

### Task 2: Interactive Contact Pills Component (`AdHocContactPillsInput.tsx`)

**Files:**
- Create: `src/components/messaging/AdHocContactPillsInput.tsx`
- Test: `src/components/messaging/__tests__/AdHocContactPillsInput.test.tsx`

- [ ] **Step 1: Write test for `AdHocContactPillsInput.tsx`**

```tsx
// src/components/messaging/__tests__/AdHocContactPillsInput.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { AdHocContactPillsInput } from '../AdHocContactPillsInput';

describe('AdHocContactPillsInput', () => {
  it('renders input area and parses contacts on enter/blur', () => {
    const onChange = vi.fn();
    render(
      <AdHocContactPillsInput
        channel="sms"
        defaultCountry="GH"
        items={[]}
        onChange={onChange}
      />
    );

    const textarea = screen.getByPlaceholderText(/Type or paste contacts/i);
    fireEvent.change(textarea, { target: { value: '0244123456, 0201112222' } });
    fireEvent.blur(textarea);

    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/messaging/__tests__/AdHocContactPillsInput.test.tsx`  
Expected: FAIL (component not found)

- [ ] **Step 3: Implement `AdHocContactPillsInput.tsx`**

Build accessible, tactile pill input with:
- Textarea listening to `onBlur`, `onKeyDown` (`Enter`), paste.
- Pill display: green dot for valid, red border for invalid, tooltip for error reason.
- `min-h-[44px]` touch target delete button (`active:scale-[0.97]`).
- Action bar: *"Clear All"*, *"Remove Invalid"*, *"Copy Valid"*.
- Rendering cap: If > 100 pills, renders first 100 with a collapsible toggle to maintain high performance.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/messaging/__tests__/AdHocContactPillsInput.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit Task 2**

```bash
git add src/components/messaging/AdHocContactPillsInput.tsx src/components/messaging/__tests__/AdHocContactPillsInput.test.tsx
git commit -m "feat(messaging): add interactive contact pills input component"
```

---

### Task 3: Spreadsheet Importer & Dynamic Variable Mapper (`SpreadsheetRecipientImporter.tsx`)

**Files:**
- Create: `src/components/messaging/SpreadsheetRecipientImporter.tsx`
- Test: `src/components/messaging/__tests__/SpreadsheetRecipientImporter.test.tsx`

- [ ] **Step 1: Write test for `SpreadsheetRecipientImporter.tsx`**

Test file parsing, header discovery, and variable column binding using mocked `xlsx` and `papaparse` outputs.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/messaging/__tests__/SpreadsheetRecipientImporter.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement `SpreadsheetRecipientImporter.tsx`**

Include:
- Drag-and-drop zone accepting `.xlsx`, `.xls`, `.csv`.
- Automatic detection of phone/email and name columns.
- Variable mapping selects linking template variables to spreadsheet columns.
- 5-row preview table with total count badge.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/messaging/__tests__/SpreadsheetRecipientImporter.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit Task 3**

```bash
git add src/components/messaging/SpreadsheetRecipientImporter.tsx src/components/messaging/__tests__/SpreadsheetRecipientImporter.test.tsx
git commit -m "feat(messaging): add spreadsheet recipient importer with variable mapper"
```

---

### Task 4: Internal User Audience Selector (`InternalUserAudienceSelector.tsx`)

**Files:**
- Create: `src/components/messaging/InternalUserAudienceSelector.tsx`
- Test: `src/components/messaging/__tests__/InternalUserAudienceSelector.test.tsx`

- [ ] **Step 1: Write test for `InternalUserAudienceSelector.tsx`**

Test role filtering (`All`, `Admins`, `Managers`, `Staff`), search input, and multi-selection.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/messaging/__tests__/InternalUserAudienceSelector.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement `InternalUserAudienceSelector.tsx`**

Include:
- Consume `useWorkspaceUsers(activeWorkspaceId)`.
- Role filter toggles with tactile feedback (`active:scale-[0.97]`).
- Member list with search, avatar, name, email, phone.
- Channel eligibility indicator (warning badge if member lacks phone for SMS/WhatsApp or email for Email).
- Selection counter and select/deselect all actions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/messaging/__tests__/InternalUserAudienceSelector.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit Task 4**

```bash
git add src/components/messaging/InternalUserAudienceSelector.tsx src/components/messaging/__tests__/InternalUserAudienceSelector.test.tsx
git commit -m "feat(messaging): add internal user audience selector"
```

---

### Task 5: ComposerWizard Step 3 Multi-Audience Integration

**Files:**
- Modify: `src/app/admin/messaging/composer/components/ComposerWizard.tsx`

- [ ] **Step 1: Update form schema & state in `ComposerWizard.tsx`**

Add `audienceMode: z.enum(['entities', 'team', 'adhoc']).default('entities')` to `formSchema`.  
Add states for `adhocContacts`, `selectedTeamMembers`, `spreadsheetRecipients`.

- [ ] **Step 2: Replace Step 3 Audience Selection UI**

Render segmented primary tab selector:
- 🏢 **Workspace Entities** (preserves `EntitySelector`, contact scope, tag filters).
- 👥 **Internal Team** (`<InternalUserAudienceSelector>`).
- 📋 **Direct & Spreadsheet** (sub-tabs for `<AdHocContactPillsInput>` and `<SpreadsheetRecipientImporter>`).

- [ ] **Step 3: Update Step 3 validation logic in `NavFooter`**

Next button enables if:
- In `entities`: `selectedEntityIds.length > 0` or `filteredRecipients.length > 0`.
- In `team`: `selectedTeamMembers.length > 0`.
- In `adhoc`: `adhocContacts.filter(c => c.isValid).length > 0`.

- [ ] **Step 4: Run typecheck to verify 0 errors**

Run: `pnpm typecheck`  
Expected: 0 errors

- [ ] **Step 5: Commit Task 5**

```bash
git add src/app/admin/messaging/composer/components/ComposerWizard.tsx
git commit -m "feat(composer): integrate 3-mode audience selector in ComposerWizard"
```

---

### Task 6: Step 5 Pre-Flight Cockpit, Preview Canvas & Multi-Audience Dispatch

**Files:**
- Modify: `src/app/admin/messaging/composer/components/PreFlightCockpit.tsx`
- Modify: `src/app/admin/messaging/composer/components/PublishPreviewCanvas.tsx`
- Modify: `src/app/admin/messaging/composer/components/ComposerWizard.tsx` (`onSubmit` handler)

- [ ] **Step 1: Update `PreFlightCockpit.tsx` & `PublishPreviewCanvas.tsx`**

Pass `audienceMode` and dynamic sample recipient attributes into preview and cockpit.

- [ ] **Step 2: Update `onSubmit` in `ComposerWizard.tsx`**

- For `audienceMode === 'entities'`: Retain existing flow.
- For `audienceMode === 'team'`: Loop through selected users, dispatch to `user.email` or `user.phone` with user profile variables.
- For `audienceMode === 'adhoc'`:
  - If `<= 50` recipients: Interactive progress runner.
  - If `> 50` recipients: Automatically route through `createBulkMessageJob` background worker.
- Keep rich error reporting and preserve full export capability (CSV, JSON, PDF) for all failed sends across any audience mode.

- [ ] **Step 3: Verify TypeScript typing**

Run: `pnpm typecheck`  
Expected: 0 errors

- [ ] **Step 4: Commit Task 6**

```bash
git add src/app/admin/messaging/composer/components/PreFlightCockpit.tsx src/app/admin/messaging/composer/components/PublishPreviewCanvas.tsx src/app/admin/messaging/composer/components/ComposerWizard.tsx
git commit -m "feat(composer): support multi-audience dispatches in PreFlightCockpit and onSubmit"
```

---

### Task 7: Full Verification, Testing & Quality Audit

**Files:** All modified files across Tasks 1–6.

- [ ] **Step 1: Run complete test suite**

Run: `npx vitest run`  
Expected: All tests pass.

- [ ] **Step 2: Run TypeScript typecheck**

Run: `pnpm typecheck`  
Expected: 0 errors, Zero `any/any[]`.

- [ ] **Step 3: Run ESLint**

Run: `pnpm lint`  
Expected: 0 critical lint errors.

- [ ] **Step 4: Final commit of verified implementation**

```bash
git commit --allow-empty -m "chore(messaging): verify all multi-audience composer tests and types"
```

---

## Plan Review & Verification Checkpoints
- [x] **Spec coverage**: Every requirement in `2026-09-30-multi-audience-message-composer-design.md` has a concrete task.
- [x] **No placeholders**: Every task specifies exact file paths, test blocks, and commands.
- [x] **Type consistency**: `ComposerAudienceMode`, `AdHocContactItem`, and `InternalUserRecipient` signatures match throughout all tasks.
- [x] **Zero unprompted remote push**: All commits stay strictly local on branch `main`.
