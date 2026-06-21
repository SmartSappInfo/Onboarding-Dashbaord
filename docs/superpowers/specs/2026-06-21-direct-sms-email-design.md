# Design Specification: Direct Email and Direct SMS Automation Actions

**Author**: Antigravity  
**Date**: 2026-06-21  
**Status**: Draft  

---

## 1. Executive Summary

This design document outlines the implementation of two new automation actions in the SmartSapp automation hub: **Direct Email** (`DIRECT_EMAIL`) and **Direct SMS** (`DIRECT_SMS`). These actions enable workflows to dispatch emails and SMS messages directly from the automation canvas without requiring pre-defined message templates. The messages support full parameter interpolation of workflow-available variables (webhook data, entity fields, and workspace configuration) and support manual mapping of destination addresses. The previous template-based messaging action (`SEND_MESSAGE`) remains completely untouched and functional.

---

## 2. User Experience & UI Design

### 2.1 Node Registry
The two new actions will be added to the automation node selection library:
- **Direct Email**:
  - **Category**: Contacts & Data (`contacts_data`) or Sending Options (`sending_options`).
  - **Icon**: `Mail`
  - **Label**: `Direct Email`
  - **Description**: "Send an email directly without templates, interpolating variables."
- **Direct SMS**:
  - **Category**: Contacts & Data (`contacts_data`) or Sending Options (`sending_options`).
  - **Icon**: `Smartphone`
  - **Label**: `Direct SMS`
  - **Description**: "Send an SMS directly without templates, interpolating variables."

### 2.2 Inspector Configuration Panel (`ActionConfigPanel.tsx`)
When a user selects a `DIRECT_EMAIL` or `DIRECT_SMS` node, the inspector panel will slide open with the following fields:

#### Direct Email Configuration:
1. **Sender Profile Selection** (Required):
   - A `<Select>` component containing active email sender profiles for the workspace/organization.
2. **Recipient Targeting** (Required):
   - Multiselect checkbox options matching the existing CRM message action:
     - `Triggering Contact`
     - `Primary Contact`
     - `Campus Signatories`
     - `Specific Role(s)`
     - `All Contacts`
     - `Manual Identity Entry`
   - When **Manual Identity Entry** is selected, a `<MappableInputField>` is displayed to allow custom emails or mapping tags like `{{1.body.customer_email}}`.
3. **Subject Line** (Required):
   - A `<MappableInputField>` allowing subjects to contain variables (e.g. `New registration from {{entity.displayName}}`).
4. **Message Body** (Required):
   - A multiline `<MappableInputField>` with `isTextArea={true}` allowing users to write rich body text with variables.
5. **Brand Layout Wrap Option** (Boolean):
   - A toggle/checkbox: "Wrap in Brand Layout" (defaults to `true`). If enabled, wraps the raw text inside the organization's brand email template wrapper.

#### Direct SMS Configuration:
1. **Sender Profile Selection** (Required):
   - A `<Select>` component containing active SMS sender profiles.
2. **Recipient Targeting** (Required):
   - Checkbox options matching the email panel, with "Manual Identity Entry" displaying a `<MappableInputField>` for a custom phone number/variable.
3. **Message Body** (Required):
   - A multiline `<MappableInputField>` with `isTextArea={true}` for the SMS message text with variables.

---

## 3. Data Architecture & Firestore Changes

### 3.1 Automation Document Node Configurations
The schema for nodes of types `DIRECT_EMAIL` and `DIRECT_SMS` inside the `automations` collection will adhere to the following typesafe structure:

```typescript
export interface DirectEmailConfig {
  senderProfileId: string;
  recipientTargets: ('triggering' | 'primary' | 'signatories' | 'roles' | 'all' | 'fixed')[];
  recipientRoles?: string[];
  recipient?: string; // Manual identity entry (email value or variable mapping string)
  directSubject: string;
  directBody: string;
  useBrandLayout: boolean;
}

export interface DirectSmsConfig {
  senderProfileId: string;
  recipientTargets: ('triggering' | 'primary' | 'signatories' | 'roles' | 'all' | 'fixed')[];
  recipientRoles?: string[];
  recipient?: string; // Manual identity entry (phone value or variable mapping string)
  directBody: string;
}
```

---

## 4. Backend Engine Integration

### 4.1 Variable Resolution & Parameter Interpolation
Before executing any action, the automation processor resolves workflow variables:
- `const resolvedConfig = resolveConfigVariables(config, context.payload);`
This step converts `{{1.body.email}}` -> `recipient@domain.com` inside the configuration object. The resolved config is then passed directly to the handler.

### 4.2 Dispatch Logic
A new handler function `handleDirectMessage` will be created in `src/lib/automations/actions/message-actions.ts`:
- Resolves recipient addresses:
  - If target is a CRM contact option (Triggering, Primary, etc.), resolves their emails or phone numbers from the active contact record.
  - If target is "Manual Identity Entry", uses the resolved `recipient` field.
- Iterates over resolved recipients and calls `sendRawMessage` from `src/lib/messaging-engine.ts`:
  - **Direct Email**:
    - Invokes `sendRawMessage` with `channel: 'email'`, `recipient`, `body: resolvedBody`, `subject: resolvedSubject`, `senderProfileId`, `workspaceIds: [context.workspaceId]`, and `useBrandLayout`.
  - **Direct SMS**:
    - Invokes `sendRawMessage` with `channel: 'sms'`, `recipient`, `body: resolvedBody`, `senderProfileId`, and `workspaceIds: [context.workspaceId]`.

---

## 5. Potential Risks & Resolutions

| Risk / Edge Case | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **No Active Sender Profiles** | Automation run fails silently. | Validate existence of sender profiles during builder setup. In backend execution, fall back to `'default'` and throw a descriptive error if no sender profile is available. |
| **Out-of-Bounds Text Length** | SMS body exceeds character counts. | Add helper limits or length indicators in the UI. Ensure variables do not unexpectedly expand to block-sized payloads (handled via truncating filters if necessary). |
| **Unsubscribed Recipients** | Legal non-compliance (CAN-SPAM/TCPA). | `sendRawMessage` already enforces suppression list checks. Direct actions will respect this check automatically. |
| **Invalid/Risky Email Hygiene** | High bounce rates damaging sender reputation. | `sendRawMessage` already executes email validation via the hygiene repository. Any address marked `invalid` or `risky` is blocked. |

---

## 6. Verification and Test Plan

### 6.1 Automated Testing
We will add comprehensive vitest tests in `src/lib/__tests__/direct-actions.test.ts` verifying:
1. `DIRECT_EMAIL` execution correctly resolving variables and calling `sendRawMessage` with the subject and body.
2. `DIRECT_SMS` execution correctly resolving variables and calling `sendRawMessage` with the body.
3. Correct behavior when "Manual Identity Entry" is selected with dynamic variables.
4. Correct behavior when the organization's brand layout wrapper toggle is enabled or disabled.
