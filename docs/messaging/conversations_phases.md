# Unified Omnichannel Messaging Centre (Conversations 2.0)
## Master Architecture & Phase-by-Phase Implementation Plan

> **File Location:** `docs/messaging/conversations_phases.md`  
> **Status:** Draft / Ready for Implementation  
> **Target Subsystems:** Messaging Hub, Workspace Settings, Real-time Thread Engine, Agent MCP Tools  
> **Author:** Antigravity Engineering

---

## 1. Executive Summary & Vision

The **Unified Messaging Centre** transforms the existing read-only message log viewer at `/admin/messaging/conversations` into an interactive, real-time, omnichannel customer communications hub inspired by the ergonomic standards of WhatsApp Web, Front, and Intercom.

Staff, agents, and managers can view the full unified timeline of interactions (**WhatsApp, SMS, and Email**) with any contact or entity in a single chronological stream, and directly reply from inside the chat viewport using the appropriate communication channel and native message format.

---

## 2. Architectural Principles & Tenancy Invariants

1. **Multi-Tenant Isolation (Fail-Closed)**:
   * Every thread, query, log entry, and outbound dispatch is strictly scoped by `organizationId` and `workspaceId`.
   * Cross-tenant leaks are physically impossible: queries filter by `organizationId == activeOrg.id` and `workspaceIds array-contains activeWorkspaceId`.
   * Dispatch credentials (Meta WABA Access Token, mNotify API Key, Resend API Key/Domain) are dynamically resolved via `resolveOrgProviderKeys(orgId)` from encrypted vault storage.

2. **Strict TypeScript Typing (Rule 1)**:
   * Zero use of `any` or `any[]`.
   * All dispatch payloads, session objects, channel options, and UI states are strictly modeled with Zod schemas and TypeScript interfaces.

3. **Single Source of Truth for Messages (`message_logs`)**:
   * No shadow databases or separate chat tables.
   * Both inbound messages (from Meta WhatsApp webhooks or future Resend email webhooks) and outbound messages (from campaigns, automations, or direct staff replies) write to the Firestore `message_logs` collection.

4. **Meta WhatsApp 24-Hour Customer-Service Window Compliance**:
   * The composer dynamically inspects `whatsapp_sessions/{orgId}_{recipientPhone}`.
   * **Window Active (< 24h since last inbound)**: Enables free-form conversational text replies (`type: 'text'`).
   * **Window Expired (> 24h or no inbound)**: Automatically prompts the agent to select an approved Meta template (`type: 'template'`), preventing Meta API rejection error 131047.

5. **Scale & Performance Bounds (Rule 9)**:
   * Client-side unbounded `limit(1000)` queries are deprecated in favor of cursor-paginated thread history.
   * Recipient search utilizes debounced indexing and memoized thread grouping.

6. **Mobile & Accessibility First (Rule 6)**:
   * Responsive two/three-panel layout: On mobile screens (< 768px), seamless drill-in navigation (thread list → message thread with back button).
   * All touch targets meet the `min-h-[44px]` standard.
   * Tactile interactions follow Emil Kowalski animation best practices (`active:scale-[0.97]`).

---

## 3. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               WORKSPACE SETTINGS                                      │
│   workspace.messagingSettings.defaultConversationChannel:                              │
│   • 'auto' (Default: match last inbound/outbound)                                     │
│   • 'whatsapp' (Always default to WhatsApp if connected)                              │
│   • 'sms' (Always default to SMS)                                                     │
│   • 'email' (Always default to Email)                                                 │
│   • 'prompt' (Force agent to select channel pill before typing)                       │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               UNIFIED CONVERSATIONS CLIENT (/admin/messaging/conversations)           │
├────────────────────────────┬─────────────────────────────┬─────────────────────────────┤
│   THREAD LIST (320px)      │    MESSAGE THREAD (Flex-1)  │    ENTITY CONTEXT (280px)   │
├────────────────────────────┼─────────────────────────────┼─────────────────────────────┤
│ • Search by name/phone/mail│ • Date dividers             │ • Avatar & Contact Person   │
│ • Filter: All/WA/SMS/Email │ • Inbound (Left / Neutral)  │ • Phone & Email with 1-click│
│ • Unread badges & Snippets │ • Outbound (Right / Primary)│ • CRM Pipeline Stage & Value│
│ • Channel icon per thread  │ • Status Checkmarks         │ • Tags & Quick Notes        │
│ • Real-time badge counter  │   (Sent, Delivered, Read)   │ • Link to full CRM record   │
│                            ├─────────────────────────────┤                             │
│                            │   DOCKABLE OMNI-COMPOSER    │                             │
│                            │ [ WA ] [ SMS ] [ Email ]    │                             │
│                            │ • WA: 24h session or Tpl    │                             │
│                            │ • SMS: 160-char GSM counter │                             │
│                            │ • Email: Subject + Toolbar  │                             │
│                            │ [ Type reply... ]  [ Send ] │                             │
└────────────────────────────┴──────────────┬──────────────┴─────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DIRECT DISPATCH ENGINE & SERVER ACTIONS                         │
│                           sendDirectConversationReplyAction()                          │
├────────────────────────────┬─────────────────────────────┬─────────────────────────────┤
│   WhatsApp Dispatcher      │        SMS Dispatcher       │       Email Dispatcher      │
│   • Session Window Check   │        • GSM-7 Validation   │       • Subject Line Valid. │
│   • Free-text or Template  │        • Sender ID Stamp    │       • HTML Body Wrapper   │
│   • Meta Cloud Graph API   │        • mNotify Gateway    │       • Resend API Egress   │
└────────────────────────────┴──────────────┬──────────────┴─────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     FIRESTORE DATA STORAGE & EVENT LOGGING                             │
│   • Writes to `message_logs` (direction: 'outbound', channel: selectedChannel)         │
│   • Updates `whatsapp_sessions` if applicable                                          │
│   • Emits domain event `conversation.message_replied` to EventBus                      │
│   • Reconciles delivery/read receipts via existing Svix/Meta webhooks                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Phase-by-Phase Implementation Roadmap

### Phase 1: Workspace Settings Schema & Tenant Preferences
**Goal**: Allow organizations and workspaces to configure the default conversation channel behavior.

* **Tasks**:
  1. **Schema Extension (`src/lib/types.ts`)**:
     * Add `ConversationChannelPreference = 'auto' | 'whatsapp' | 'sms' | 'email' | 'prompt'`.
     * Extend `Workspace` type with `messagingSettings?: { defaultConversationChannel?: ConversationChannelPreference }`.
  2. **Settings UI (`src/app/admin/settings/workspace/` or `MessagingSettingsTab.tsx`)**:
     * Add a "Conversations & Two-Way Inbox" settings card.
     * Select dropdown with 5 options:
       * `Auto-match last interaction channel (Recommended)`
       * `Always default to WhatsApp`
       * `Always default to SMS`
       * `Always default to Email`
       * `Always prompt agent to choose`
  3. **Server Action**:
     * Update `updateWorkspaceMessagingSettingsAction` with tenant permission validation.
  4. **Unit Tests**:
     * Verify schema validation and default fallback to `'auto'`.

---

### Phase 2: Direct Reply Dispatch Engine & Server Actions
**Goal**: Create a lightweight, secure server action to dispatch messages directly from the conversation thread without triggering the multi-step bulk campaign wizard.

* **Files**:
  * Create: `src/app/actions/conversation-reply-actions.ts`
  * Test: `src/app/actions/__tests__/conversation-reply-actions.test.ts`
* **Tasks**:
  1. **Input Schema & Validation**:
     ```typescript
     export interface SendDirectReplyInput {
       workspaceId: string;
       entityId?: string;
       recipient: string; // Phone number or email
       channel: 'whatsapp' | 'sms' | 'email';
       body: string;
       subject?: string; // Required for email
       whatsappTemplateName?: string; // If 24h window closed
       whatsappTemplateParams?: string[];
     }
     ```
  2. **Channel Dispatch Logic**:
     * **WhatsApp**: Check `whatsapp_sessions`. If open, call `sendWhatsApp` with `mode: 'text'`. If expired, require `whatsappTemplateName` and call with `mode: 'template'`.
     * **SMS**: Validate character length, resolve organization's mNotify key and sender ID, call `sendSms`.
     * **Email**: Validate subject and body, resolve Resend API key and sending domain, call `sendEmail`.
  3. **Message Log Audit Trail**:
     * Immediately record the outbound message in `message_logs`:
       * `direction: 'outbound'`
       * `source: 'conversations_inbox'`
       * `actorUserId: currentUserId`
       * `actorUserName: currentUserDisplayName`
       * `sentAt: new Date().toISOString()`
  4. **Unit & Integration Tests**:
     * Test tenant isolation (ensuring user cannot dispatch using another org's credentials).
     * Test validation rejections (empty body, missing email subject, expired WhatsApp session without template).

---

### Phase 3: Omnichannel Chat Thread UI & Inbound/Outbound Bubbles
**Goal**: Redesign the chat stream in [`MessageThread.tsx`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/messaging/conversations/components/MessageThread.tsx) to provide real conversational ergonomics.

* **Tasks**:
  1. **Inbound vs Outbound Bubble Differentiation**:
     * **Inbound (`direction === 'inbound'`)**:
       * Aligned to **LEFT** (`items-start mr-auto`).
       * Styled in subtle card surface (`bg-card border border-border/70 text-card-foreground`).
       * Header shows the customer/contact's name or number with an inbound badge.
     * **Outbound (`direction === 'outbound'`)**:
       * Aligned to **RIGHT** (`items-end ml-auto`).
       * WhatsApp / SMS: Styled with solid brand/primary bubble (`bg-primary text-primary-foreground`) or high-contrast bubble.
       * Email: Styled as a clean card with an envelope icon, subject line header, and sanitized HTML body.
  2. **Delivery & Read Receipts**:
     * WhatsApp / SMS checkmarks in the bottom-right of outbound bubbles:
       * `sent`: Single gray checkmark (`✓`).
       * `delivered`: Double gray checkmarks (`✓✓`).
       * `read`: Double emerald / cyan checkmarks (`✓✓`).
       * `failed`: Red exclamation badge with error tooltip.
  3. **Channel Badges & Tooltips**:
     * Visual channel pill (`💬 WhatsApp`, `📱 SMS`, `✉️ Email`) on every bubble so agents immediately recognize the medium of each historical message.
  4. **Date Separators & Sticky Headers**:
     * Clean sticky date pills (`Today`, `Yesterday`, `Friday, Oct 6`).
  5. **Auto-Scroll Behavior**:
     * Smooth auto-scroll to bottom on thread load and upon receiving/sending a message, with a floating "Scroll to bottom" button if scrolled up.

---

### Phase 4: Docked Omnichannel Reply Bar & WhatsApp 24h Session Guard
**Goal**: Build the interactive input area at the bottom of the message thread.

* **Component**: `src/app/admin/messaging/conversations/components/OmnichannelComposerBar.tsx`
* **Features**:
  1. **Dynamic Channel Selector Tabs**:
     * Pill switch: `[ 💬 WhatsApp ] [ 📱 SMS ] [ ✉️ Email ]`.
     * Pre-selects based on workspace setting:
       * If `'auto'`: Auto-selects the channel of the last message in the active thread.
       * If `'whatsapp' / 'sms' / 'email'`: Pre-selects the configured default.
       * If `'prompt'`: Displays a neutral pill until the user selects.
  2. **WhatsApp 24-Hour Session Cockpit**:
     * Subscribes to `whatsapp_sessions/{orgId}_{recipientPhone}`.
     * **If Active**: Displays a green dot + `🟢 24h Customer Window Active (Expires in Xh)`. Allows standard free-form textarea.
     * **If Expired / Inactive**:
       * Displays amber banner: `⚠️ Outside 24h window. Meta requires an approved template to message this contact.`
       * Shows a dropdown to select an approved template (`WhatsAppTemplateSelector`).
       * Auto-populates template preview with variable tokens.
  3. **SMS Mode Affordances**:
     * GSM-7 character counter (e.g. `84 / 160 characters · 1 Segment`).
     * Displays active Sender ID (e.g. `Sending as: SmartSapp`).
  4. **Email Mode Affordances**:
     * Expandable `Subject` input (defaults to `Re: <Last Subject>` or blank).
     * Lightweight toolbar (Bold, Italic, Link, Template Variable token picker).
  5. **Tactile Interactions & Shortcuts**:
     * Keyboard shortcut: `⌘ + Enter` (Mac) or `Ctrl + Enter` (Windows) to instantly send.
     * Optimistic UI update: message appears immediately in thread with a `sending` spinner before confirmation.

---

### Phase 5: Thread List Search, Filtering & Scalable Indexing
**Goal**: Upgrade [`ThreadList.tsx`](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/messaging/conversations/components/ThreadList.tsx) for performance at scale.

* **Tasks**:
  1. **Channel Filter Pills**:
     * Filter list by `All`, `WhatsApp`, `SMS`, `Email`, or `Unread`.
  2. **Multi-Field Search**:
     * Live filtering by contact name, phone number, email address, or message body content.
  3. **Scalable Pagination**:
     * Replace client-side 1000-message fetch with an indexed query or background thread aggregator if message volume exceeds 10,000 logs.
  4. **Mobile Slide-Over Support**:
     * On screens `< 768px`, selecting a thread hides the thread list and opens the conversation full-screen with a "← Back to Inbox" navigation bar.

---

### Phase 6: AI Agent Copilot & MCP Tools Registration
**Goal**: Wire the unified messaging center into the platform's AI copilot and MCP tool registry so autonomous agents can inspect threads and propose replies.

* **New MCP Tools (`src/lib/mcp/tools/messaging-conversation-tools.ts`)**:
  1. `get_conversation_thread`:
     * Parameters: `workspaceId`, `entityId` or `recipientPhone` or `recipientEmail`, `limit`.
     * Returns: Chronological history of interactions across WhatsApp, SMS, and Email with status metadata.
  2. `send_conversation_reply`:
     * Parameters: `workspaceId`, `recipient`, `channel`, `message`, `subject?`.
     * Validates tenant isolation, verifies WhatsApp 24h window, and dispatches via `sendDirectConversationReplyAction`.
  3. `suggest_conversation_reply`:
     * Parameters: `workspaceId`, `threadId`, `tone` (professional, friendly, urgent).
     * Uses Genkit / Gemini to draft a context-aware response using CRM entity history, past tickets, and surveys.
* **UI Integration**:
  * Add a 1-click **"✨ AI Draft Reply"** button in the Omnichannel Composer Bar that populates the input with an AI-generated suggestion for human review before sending.

---

### Phase 7: Automated Testing, Security Audit & Verification
**Goal**: Ensure zero regressions across existing messaging pipelines and verify strict rule compliance.

* **Test Suites**:
  1. `conversation-reply-actions.test.ts`: Verify multi-tenant permissions, WhatsApp session window enforcement, and message log creation.
  2. `OmnichannelComposerBar.test.tsx`: Verify channel switching, SMS segment counting, email subject validation, and template picker toggling.
  3. `MessageThread.test.tsx`: Verify inbound vs outbound bubble alignment, DOMPurify HTML sanitization for emails, and status icon rendering.
  4. `messaging-mcp-tools.test.ts`: Verify AI agent tool execution and tenant boundary safety.
* **Verification Invariants**:
  * Run `pnpm typecheck` (0 errors, Rule 1).
  * Run `pnpm lint` (0 errors).
  * Run targeted Vitest test suites.

---

## 5. File Inventory & Touchpoints

| Action | File Path | Responsibility |
| :--- | :--- | :--- |
| **Modify** | `src/lib/types.ts` | Define `ConversationChannelPreference` and workspace messaging settings types. |
| **Create** | `src/app/actions/conversation-reply-actions.ts` | Server action for immediate in-thread replies across WhatsApp, SMS, and Email. |
| **Create** | `src/app/actions/__tests__/conversation-reply-actions.test.ts` | Unit tests for reply validation, tenant isolation, and dispatch routing. |
| **Modify** | `src/app/admin/messaging/conversations/ConversationsClient.tsx` | Wire workspace channel settings, active thread selection, and responsive layout. |
| **Modify** | `src/app/admin/messaging/conversations/components/ThreadList.tsx` | Add channel filters (`All`, `WhatsApp`, `SMS`, `Email`), unread filters, and search. |
| **Modify** | `src/app/admin/messaging/conversations/components/MessageThread.tsx` | True two-way bubbles (left/right), checkmarks, and embed `OmnichannelComposerBar`. |
| **Create** | `src/app/admin/messaging/conversations/components/OmnichannelComposerBar.tsx` | Multi-channel docked input with WhatsApp 24h guard, SMS counter, Email subject, and AI draft. |
| **Create** | `src/app/admin/messaging/conversations/components/__tests__/OmnichannelComposerBar.test.tsx` | Test suite for composer state, channel switching, and keyboard shortcuts. |
| **Create** | `src/lib/mcp/tools/messaging-conversation-tools.ts` | MCP tools for AI agents (`get_conversation_thread`, `send_conversation_reply`, `suggest_reply`). |
| **Create** | `src/lib/mcp/tools/__tests__/messaging-conversation-tools.test.ts` | Unit tests for agent MCP tool execution and permission guards. |

---

## 6. Adoption & UX Strategy

* **Zero Learning Curve**:
  * Agents who know WhatsApp or iMessage will immediately feel at home with the thread view and `⌘ + Enter` sending.
* **Clear Safety Rails**:
  * The WhatsApp 24h window badge prevents agent confusion over why a free-form message might fail.
  * The SMS segment counter avoids unexpected SMS credit consumption from accidental long texts.
  * Email mode automatically prevents sends with missing subjects.
* **Speed**:
  * Eliminates the 5-step modal wizard for simple direct replies, reducing customer response time from minutes to seconds.
