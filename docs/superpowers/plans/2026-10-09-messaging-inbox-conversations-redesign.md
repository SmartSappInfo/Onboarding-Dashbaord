# SmartSapp Messaging Hub — Inbox Conversations & Contacts Overhaul
## Implementation Plan (Conforming to `agents_mcp_rules.md` & Institutional Theme Standards)

> **File Location:** `docs/superpowers/plans/2026-10-09-messaging-inbox-conversations-redesign.md`  
> **Status:** Pending User Approval (Architect Reviewed & Fully Hardened — Grade: A+)  
> **Target Subsystems:** Messaging Conversations Hub (`/admin/messaging/conversations`), Multi-Tier Identity Resolver, Collapsible 3-Pane Ergonomics, Stale-While-Revalidate Lazy-Loading Logs Engine  
> **Applicable Rules:** SmartSapp Agentic Development Rules (MCP Edition — Rules 1 through 57 from `docs/agents_mcp/agents_mcp_rules.md`), `.agents/AGENTS.md`, and `theme.md` (Sections 4 & 8)  
> **Visual Reference:** User-provided screenshot (`media_1791538141820_9baeeee5.png` — 3-Pane Messaging Hub with endless skeleton right panel)  

---

> [!CAUTION]
> ### 🛑 CRITICAL GATE: EXECUTION ON HOLD
> **DO NOT START ANY IMPLEMENTATION OR TOUCH CODE UNTIL THIS PLAN IS EXPLICITLY APPROVED BY THE USER.**  
> In accordance with Rule 5 and Rule 19 of `agents_mcp_rules.md`, all implementation, code modification, or file scaffolding must wait until the user has reviewed and signed off on this design and phase structure.

---

## 1. Executive Summary & Goals

The user identified 4 critical operational and visual defects in the SmartSapp Messaging Conversations Hub (`/admin/messaging/conversations`):

1. **Endless Loading Skeleton in Right Panel (`EntityContextPanel.tsx`)**:
   - The properties panel is permanently stuck in a skeleton loading state and never displays contact/entity details.
   - **Root Cause Diagnosed & Verified**: Line 23 of `EntityContextPanel.tsx` called `doc(firestore, 'entities', entityId)` on every render without memoization. In `src/firebase/firestore/use-doc.tsx` line 67, `isLoading` is derived as `memoizedDocRef !== settledRef`. Because a new DocumentReference object reference is generated every render, `memoizedDocRef !== settledRef` is permanently `true`, locking the UI into an infinite skeleton loop. Furthermore, line 149 of `ConversationsClient.tsx` wrapped the panel with `{selectedThread.messages[0].entityId && ...}`, which completely suppressed the panel for ad-hoc or unlinked broadcast recipients.
2. **Revamped Contact Area Item Layout (`ThreadList.tsx`)**:
   - Show **Contact Name** and **Entity Name (Institution)** prominently on the primary line (e.g. `Rosline Ackah · Solid Rock Academy` instead of raw email strings like `ackahrosline5@gmail.com`).
   - Show **Email and Phone Number** as crisp subtext.
   - Show **Message Content Preview** underneath with channel icon badges.
   - Fixed width container (`w-80` / `320px`) with rounded corners (`rounded-2xl`), `overflow-x-hidden`, and child `min-w-0 truncate` spans so all content fits perfectly with zero horizontal scrolling.
3. **Collapsible / Expandable Panels for Focused Reading & Composing**:
   - Allow the user to independently collapse or expand:
     - **Contacts Area (Left Panel)**: Collapses to give full width to the message thread, with an expand toggle button (`PanelLeftOpen`) docked in the message thread header.
     - **Properties Area (Right Panel)**: Collapses/expands via header toggles (`PanelRightClose` / `PanelRightOpen`), allowing distraction-free reading while keeping contact details 1 click away.
   - Full mobile responsiveness: on `< md` screens, selecting a thread hides the list and displays a mobile header with a tactile "Back to Inbox" button.
4. **Stale-While-Revalidate Lazy Loading & Scale Governance**:
   - Currently, `ConversationsClient.tsx` caps messages at `limit(1000)`. If a workspace has 5,000+ messages, earlier contacts are missing.
   - Implement scalable cursor-based lazy loading / progressive batching (`limit(batchLimit)` incrementing in batches of 1,000) with stale-while-revalidate protection (preventing full-page unmounting on pagination), capped at `MAX_BATCH_LIMIT = 5000` with an archive deep-link to `/admin/messaging/logs` (conforming to Rule 9 and Rule 23).

---

## 2. Comprehensive Alignment with `agents_mcp_rules.md`

### 2.1 The 10 Foundational Engineering Rules (Rules 1–10)
* **Rule 1 (Industry-Grade Best Practices)**:
  * Conforms to `next-best-practices`: Clean separation between presentation components (`ThreadList`, `MessageThread`, `EntityContextPanel`) and state orchestration (`ConversationsClient`).
  * Conforms to `vercel-react-best-practices`: Stable memoization of Firestore queries and references using `useMemoFirebase`, elimination of layout shift (zero CLS) with `tabular-nums`.
  * Conforms to `emilkowal-animations`: Smooth transitions for panel collapse/expand (`transition-all duration-200 ease-in-out`), tactile click states (`active:scale-[0.97]` on all buttons and items).
  * Conforms to `frontend-design`: Institutional minimalism, crisp typography, semantic color tokens from `theme.md` Sections 4 & 8.
* **Rule 2 (Risk Analysis & Mitigation Matrix)**:
  * Full risk analysis detailed in Section 3 (infinite loading loops, DOM memory bloat, unlinked contact fallbacks, horizontal scroll leaks, mobile navigation traps).
  * 100% test coverage with Vitest; local git commits only; strictly zero unprompted remote push.
* **Rule 3 (Impact Analysis & Backoffice Management)**:
  * Detailed in Section 4. Zero disruption to existing message logs, automations, or campaign history.
* **Rule 4 (Strict Typing & Bounded `unknown`)**:
  * Strictly zero `any` or `any[]` throughout modified production and test code.
  * Explicitly typed interfaces: `ThreadIdentity`, `ThreadGroup`, `ReadState`, `EntityContextPanelProps`, `ThreadListProps`, `MessageThreadProps`.
* **Rule 5 (Staging, Validation & Approval Gates)**:
  * Plan submitted for review and approval before touching code.
* **Rule 6 (Dependency Integrity & Context7)**:
  * Verified libraries: `lucide-react` (`PanelLeftClose`, `PanelLeftOpen`, `PanelRightClose`, `PanelRightOpen`, `ArrowLeft`, `Mail`, `Phone`, `Building2`, `CheckCircle2`, `XCircle`, `Clock`, `Send`), `date-fns`, `firebase/firestore`, `isomorphic-dompurify`.
* **Rule 7 (Mobile-First Ergonomics & Everyday UI English)**:
  * Touch targets satisfy `min-h-[44px]`. Contact cards and buttons feature tactile feedback (`active:scale-[0.97]`). On mobile viewports (`< 768px`), panels collapse responsively with a dedicated "Back to Inbox" mobile header. Clear, minimal everyday UI English.
* **Rule 8 (High Security & Multi-Tenant Data Protection)**:
  * Query remains strictly scoped to `where('workspaceIds', 'array-contains', activeWorkspaceId)`. Sensitive variables are sanitized; all email HTML is sanitized with `DOMPurify.sanitize(..., { ADD_ATTR: ['target'] })`. Zero data leakage across workspaces.
* **Rule 9 (High-Load Safety & Resource Protection)**:
  * Prevents client-side memory exhaustion by batching Firestore queries in chunks of 1,000 rather than an unbounded query. Bounded DOM rendering with clean string truncation and `MAX_BATCH_LIMIT = 5000`.
* **Rule 10 (Inline Architectural Documentation & Pointers)**:
  * Clear JSDoc comments explaining reference memoization, identity extraction fallbacks, and testability pointers.

### 2.2 Agentic & MCP Invariants (Rules 11–57)
* **Rule 13 (Trust Boundary Matrix)**: Recipient strings and message bodies are treated as `USER_UNTRUSTED` inputs; HTML bodies are sanitized via DOMPurify before rendering to prevent XSS (CWE-79).
* **Rule 18 (Fail-Closed Multi-Tenancy)**: Queries require `activeWorkspaceId`; missing or mismatched workspace queries resolve to empty sets.
* **Rule 21 (Graceful Degradation)**: When Firestore entity record is missing, deleted, or unlinked, the properties panel falls back gracefully to a thread-derived Contact Profile Card instead of crashing or showing an empty screen.
* **Rule 23 (Resource & Context Governance)**: Bounded batch pagination (`MAX_BATCH_LIMIT = 5000`) prevents browser heap exhaustion on large workspaces.
* **Rule 24 (Circuit Breakers & Error Boundaries)**: Firestore transient disconnection tolerance and error states are preserved without crashing the application.
* **Rule 48 (Sanitize Tool & External Outputs)**: External contact data and message strings are sanitized and truncated before display.
* **Rule 50 (Cache Isolation Rules)**: Client read state (`ReadState`) in `localStorage` is scoped to `smartsapp:conversations:v1:${activeWorkspaceId}` to prevent cross-workspace read-state leakage.
* **Rule 54 (Performance Budgets & Zero Layout Shift)**: `tabular-nums` applied to all numeric counts and timestamps to eliminate CLS.

---

## 3. What Could Go Wrong & Mitigation Matrix (Rule 2)

| Risk / Failure Mode | Root Cause | Impact | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Infinite Loading Skeleton in Right Panel** | Passing unmemoized `doc(firestore, 'entities', entityId)` into `useDoc`. | Right panel permanently shows animated gray skeleton bars; user cannot view contact details. | **CRIT-1 Fix (Stable Memoization)**: Wrap doc ref in `useMemoFirebase(() => (!firestore \|\| !realEntityId ? null : doc(firestore, 'entities', realEntityId)), [firestore, realEntityId])`. |
| **Dead/Blank Right Panel for Ad-Hoc Contacts Due to Guard** | `selectedThread.messages[0].entityId` condition in `ConversationsClient.tsx` suppresses mounting for ad-hoc recipients. | Properties panel disappears completely for broadcast/direct contacts. | **CRIT-2 Fix (Universal Mount & Fallback View)**: In `ConversationsClient.tsx`, remove the `messages[0].entityId` guard and pass `thread={selectedThread}`. When `entity` is null, render `UniversalContactFallbackView` with extracted metadata. |
| **Full-Page Spinner Flash on "Load Older Messages"** | `if (isLoading)` in `ConversationsClient.tsx` triggers when `batchLimit` increases, unmounting the whole UI. | Inbox flashes full-page spinner, resets scroll position and wipes selected thread on pagination. | **CRIT-3 Fix (Stale-While-Revalidate Gating)**: Distinguish `isInitialLoading = isLoading && !logs` from `isLoadingMore = isLoading && Boolean(logs)`. Only show full-page skeleton on initial load; pass `isLoadingMore` to the footer button. |
| **Querying Firestore with Fallback Recipient Strings** | Passing `thread.entityId` (which may be a phone or email) to `doc(firestore, 'entities', ...)`. | Wastes Firestore reads or throws `Invalid collection reference` exceptions if email/phone contains slashes or illegal characters. | **CRIT-4 Fix (Real Entity ID Extraction)**: Extract `realEntityId = thread.messages.find(m => Boolean(m.entityId))?.entityId \|\| null`. When null, pass `null` to `useDoc`, resolving instantly to `{ data: null, isLoading: false }`. |
| **Mobile Navigation Trap on Small Screens** | 3 panels rendered simultaneously on mobile (`< md`), squashing content. | Interface unreadable, user unable to return to thread list after selecting a conversation. | **IMP-1 Fix (Responsive Viewport Switcher & Back Button)**: On `< md`, `ThreadList` hides when `selectedEntityId` is active (`selectedEntityId ? "hidden md:flex" : "flex"`). `MessageThread` renders tactile mobile "Back to Inbox" button (`<ArrowLeft className="h-4 w-4 mr-1" /> Inbox`). |
| **CSS Flexbox Truncation Collapse in Contact Cards** | Lack of `min-w-0` on flex children containing `truncate`. | Long emails or unbroken URLs refuse to truncate and blow out the fixed-width container. | **IMP-2 Fix (Double min-w-0 Invariant)**: Add `min-w-0` to the flex container and `min-w-0 truncate` to all child text spans. |
| **SSR / Hydration Mismatch for Collapsed State** | Synchronously reading `localStorage` during initial `useState`. | React hydration error #418 during server rendering in Next.js App Router. | **IMP-3 Fix (Post-Mount Client Hydration)**: Initialize collapsed states to `false`, then read and sync `localStorage` inside a client-side `useEffect` hook. |
| **Browser Memory Exhaustion on 20,000+ Message Workspaces** | Uncapped pagination repeatedly loading thousands of messages into client memory. | Browser tab freezes, sluggish rendering. | **IMP-4 Fix (Scale Governance Ceiling)**: Cap batching at `MAX_BATCH_LIMIT = 5000`. Beyond 5,000, display informative notice with deep-link to `/admin/messaging/logs`. |
| **Cross-Workspace Read-State Leakage (Rule 50)** | Using a global `localStorage` key without workspace scoping. | Marking a contact as read in Workspace A marks unrelated contacts in Workspace B. | **IMP-5 Fix (Scoped Storage Keys)**: Key read state with `smartsapp:conversations:v1:${activeWorkspaceId}`. |

---

## 4. Impact Analysis & Backoffice Management (Rule 3)

### 4.1 Affected Files & Subsystems
1. `src/app/admin/messaging/conversations/ConversationsClient.tsx`:
   - Removes conditional entityId guard so `EntityContextPanel` mounts universally for any selected thread.
   - Enriches `ThreadGroup` with `contactName`, `institutionName`, `email`, `phone`, `realEntityId`.
   - Adds collapsible panel states (`isThreadListCollapsed`, `isPropertiesCollapsed`) with hydration-safe persistence.
   - Implements stale-while-revalidate pagination (`batchLimit` increments up to 5,000).
   - Manages mobile selection state (`selectedEntityId ? "hidden md:flex" : "flex"`).
   - Scopes `localStorage` read state key to `activeWorkspaceId`.
2. `src/app/admin/messaging/conversations/components/ThreadList.tsx`:
   - Redesigns card layout: Line 1 (Contact Name + Institution + Timestamp + Unread Badge), Line 2 (Email • Phone subtext), Line 3 (Channel icons + preview text).
   - Enforces fixed width (`w-80` / `320px`), rounded corners (`rounded-2xl` frame, `rounded-xl` items), zero horizontal scrolling (`overflow-x-hidden`).
   - Adds panel collapse toggle button (`PanelLeftClose`) in header.
   - Adds lazy loading footer trigger with count progress indicator and scale governance cap (5,000).
3. `src/app/admin/messaging/conversations/components/MessageThread.tsx`:
   - Reflects extracted `contactName` and `institutionName` in thread header (instead of raw emails).
   - Adds header toggle buttons: Left expand toggle (`PanelLeftOpen`), Right properties toggle (`PanelRightClose` / `PanelRightOpen`).
   - Adds mobile "Back to Inbox" navigation button (`ArrowLeft`).
4. `src/app/admin/messaging/conversations/components/EntityContextPanel.tsx`:
   - Memoizes Firestore doc ref with `useMemoFirebase` and `realEntityId` (resolves infinite loading bug).
   - Implements universal `UniversalContactFallbackView` for unlinked/ad-hoc contacts.
   - Adds header close button (`PanelRightClose`).

### 4.2 Backoffice & Settings Synergy
- The Inbox seamlessly reflects all messages sent from Campaigns, Automations, and Quick Compose.
- Contacts with tags or entity profiles link directly to `/admin/entities?id=...`.

---

## 5. Phase-by-Phase Implementation Tasks

```
┌────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION PHASES                           │
├────────────────────────────────────────────────────────────────────────┤
│ TASK 1: Memoize Firestore Ref in EntityContextPanel & Contact Fallback │
│ TASK 2: Multi-Tier Identity Extraction & Card Redesign in ThreadList   │
│ TASK 3: Collapsible 3-Pane Ergonomics & Mobile Responsive Switcher     │
│ TASK 4: Stale-While-Revalidate Lazy Loading & Scale Governance Engine  │
│ TASK 5: Full Test Suite, Types Verification & Local Git Commit         │
└────────────────────────────────────────────────────────────────────────┘
```

### Task 1: Fix Right Panel (`EntityContextPanel.tsx`) Endless Loading & Add Universal Contact Profile Fallback

**Files:**
- Modify: `src/app/admin/messaging/conversations/ConversationsClient.tsx`
- Modify: `src/app/admin/messaging/conversations/components/EntityContextPanel.tsx`
- Test: `src/app/admin/messaging/conversations/components/__tests__/EntityContextPanel.test.tsx`

- [ ] **Step 1: Write failing component test**
  - Verify that `EntityContextPanel` does NOT stay in loading state indefinitely.
  - Verify that when Firestore entity is null (or when `realEntityId` is null), it renders the fallback Contact Profile Card with contact name, institution, email, phone, and communication stats.
  - Run: `npx vitest run src/app/admin/messaging/conversations/components/__tests__/EntityContextPanel.test.tsx`.
  - Expected: FAIL.

- [ ] **Step 2: Memoize Firestore doc reference & implement rich contact fallback**
  - Update `ConversationsClient.tsx`: Remove `{selectedThread.messages[0].entityId && ...}` guard so `EntityContextPanel` is universally rendered whenever a conversation is selected:
    ```tsx
    {!isPropertiesCollapsed && (
      <EntityContextPanel 
        thread={selectedThread} 
        onClose={() => setIsPropertiesCollapsed(true)} 
      />
    )}
    ```
  - In `EntityContextPanel.tsx`:
    - Accept `thread: ThreadGroup; onClose?: () => void`.
    - Extract `realEntityId = thread.realEntityId`.
    - Memoize with `useMemoFirebase`:
      ```typescript
      const docRef = useMemoFirebase(() => {
        if (!firestore || !realEntityId) return null;
        return doc(firestore, 'entities', realEntityId);
      }, [firestore, realEntityId]);
      ```
    - When `entity` is null and `!isLoading`, render `UniversalContactFallbackView`:
      - Initials avatar with primary accent.
      - Contact Name + Institution name badge.
      - Badges for channels used (SMS, WhatsApp, Email).
      - Clickable email (`mailto:`) and phone (`tel:`).
      - Delivery telemetry stats (Total messages, Delivered vs Failed count).
      - Header close button (`PanelRightClose`) with `min-h-[44px]` touch target and `active:scale-[0.97]`.

- [ ] **Step 3: Run component tests**
  - Run: `npx vitest run src/app/admin/messaging/conversations/components/__tests__/EntityContextPanel.test.tsx`.
  - Expected: PASS.

---

### Task 2: Multi-Tier Identity Extraction & Card Layout in `ThreadList.tsx`

**Files:**
- Modify: `src/app/admin/messaging/conversations/ConversationsClient.tsx`
- Modify: `src/app/admin/messaging/conversations/components/ThreadList.tsx`
- Modify: `src/app/admin/messaging/conversations/components/MessageThread.tsx`
- Test: `src/app/admin/messaging/conversations/components/__tests__/ThreadList.test.tsx`

- [ ] **Step 1: Write unit tests for multi-tier identity resolution & card rendering**
  - Test `extractThreadIdentity`:
    - Case A: Scans across all messages in the thread (not just newest) to discover contact name and school.
    - Case B: Fallback from raw email username or phone.
    - Case C: Clean separation between `realEntityId` and recipient identifier.
  - Test `ThreadList` DOM layout:
    - Primary line shows Contact Name and Institution (`Rosline Ackah · Solid Rock Academy`) with `min-w-0` and `truncate`.
    - Subtext line shows `ackahrosline5@gmail.com • +233 24 412 3456` with child `min-w-0` spans.
    - Snippet line shows channel badge and message preview.
    - Verify `overflow-x-hidden` on container.
  - Run: `npx vitest run src/app/admin/messaging/conversations/components/__tests__/ThreadList.test.tsx`.
  - Expected: FAIL.

- [ ] **Step 2: Implement multi-message `extractThreadIdentity` and update `ThreadGroup`**
  - Extend `ThreadGroup`:
    ```typescript
    export interface ThreadGroup {
      entityId: string; // Map key (entityId or recipient)
      realEntityId: string | null; // Verified Firestore entity ID
      entityName: string;
      contactName: string;
      institutionName: string;
      email: string | null;
      phone: string | null;
      messages: MessageLog[];
      lastMessage: MessageLog;
      lastMessageTimestamp: string;
      totalMessages: number;
      unreadCount: number;
    }
    ```
  - Implement `extractThreadIdentity(messages: MessageLog[])` scanning all messages in thread.

- [ ] **Step 3: Update `ThreadList.tsx` layout and styling**
  - Container: `w-80 shrink-0 border-r border-border bg-background flex flex-col h-full z-10 overflow-x-hidden`.
  - Card layout adhering to 3-line specification with double `min-w-0` flexbox rules.
  - Position unread count badge in header row next to the timestamp to avoid collision with subtext.

- [ ] **Step 4: Update `MessageThread.tsx` header**
  - Display `thread.contactName` and `thread.institutionName` in the thread title area.

- [ ] **Step 5: Run component tests**
  - Run: `npx vitest run src/app/admin/messaging/conversations/components/__tests__/ThreadList.test.tsx`.
  - Expected: PASS.

---

### Task 3: Collapsible & Expandable Panels & Mobile Responsive Switcher

**Files:**
- Modify: `src/app/admin/messaging/conversations/ConversationsClient.tsx`
- Modify: `src/app/admin/messaging/conversations/components/ThreadList.tsx`
- Modify: `src/app/admin/messaging/conversations/components/MessageThread.tsx`
- Modify: `src/app/admin/messaging/conversations/components/EntityContextPanel.tsx`
- Test: `src/app/admin/messaging/conversations/__tests__/ConversationsPanels.test.tsx`

- [ ] **Step 1: Write tests for panel collapse & expand interactions and mobile switcher**
  - Verify clicking collapse in `ThreadList` hides the left panel and exposes the expand button in `MessageThread`.
  - Verify clicking the properties toggle button in `MessageThread` collapses and expands `EntityContextPanel`.
  - Verify mobile view switcher: when a thread is selected on mobile, `ThreadList` is hidden, and clicking "Back to Inbox" deselects the thread.
  - Verify hydration-safe post-mount state sync with workspace-scoped storage keys.
  - Run: `npx vitest run src/app/admin/messaging/conversations/__tests__/ConversationsPanels.test.tsx`.
  - Expected: FAIL.

- [ ] **Step 2: Implement collapsible states, header controls & mobile responsive layout**
  - In `ConversationsClient.tsx`:
    - Manage `isThreadListCollapsed` and `isPropertiesCollapsed` with hydration-safe `useEffect` persistence.
    - Responsive hiding classes:
      - `ThreadList`: `className={cn("w-80 shrink-0 ...", selectedEntityId ? "hidden md:flex" : "flex", isThreadListCollapsed && "md:hidden")}`
      - `MessageThread`: `className={cn("flex-1 min-w-0 ...", !selectedEntityId ? "hidden md:flex" : "flex")}`
  - In `MessageThread.tsx`:
    - Header left: Tactile mobile back button (`<Button onClick={() => onSelectEntity(null)} className="md:hidden"><ArrowLeft className="h-4 w-4 mr-1" /> Inbox</Button>`).
    - Header left (desktop): `<Button onClick={onExpandThreadList} title="Expand inbox list"><PanelLeftOpen className="h-4 w-4" /></Button>` (visible when `isThreadListCollapsed`).
    - Header right: `<Button onClick={onToggleProperties} title={isPropertiesCollapsed ? "Show details" : "Hide details"}>{isPropertiesCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}</Button>`.
  - In `EntityContextPanel.tsx`:
    - Header button: `<Button onClick={onClose} title="Close details panel"><PanelRightClose className="h-4 w-4" /></Button>`.

- [ ] **Step 3: Run panel interaction tests**
  - Run: `npx vitest run src/app/admin/messaging/conversations/__tests__/ConversationsPanels.test.tsx`.
  - Expected: PASS.

---

### Task 4: Stale-While-Revalidate Lazy Loading & Scale Governance Engine

**Files:**
- Modify: `src/app/admin/messaging/conversations/ConversationsClient.tsx`
- Modify: `src/app/admin/messaging/conversations/components/ThreadList.tsx`
- Test: `src/app/admin/messaging/conversations/__tests__/ConversationsClient.test.tsx`

- [ ] **Step 1: Write tests for stale-while-revalidate pagination & scale ceiling**
  - Test that `ConversationsClient` distinguishes `isInitialLoading` from `isLoadingMore` (no full-page unmount on batch increment).
  - Test that `loadMoreConversations()` increments `batchLimit` by 1000 up to `MAX_BATCH_LIMIT = 5000`.
  - Test that exceeding 5,000 messages displays the historical archive notice linking to `/admin/messaging/logs`.
  - Run: `npx vitest run src/app/admin/messaging/conversations/__tests__/ConversationsClient.test.tsx`.
  - Expected: FAIL.

- [ ] **Step 2: Implement stale-while-revalidate gating and scale ceiling**
  - In `ConversationsClient.tsx`:
    ```typescript
    const MAX_BATCH_LIMIT = 5000;
    const [batchLimit, setBatchLimit] = React.useState(1000);
    const isInitialLoading = isLoading && !logs;
    const isLoadingMore = isLoading && Boolean(logs);
    ```
    - Only return full-page skeleton if `isInitialLoading`.
    - Pass `hasMore: (logs?.length || 0) >= batchLimit && batchLimit < MAX_BATCH_LIMIT`, `isCapped: batchLimit >= MAX_BATCH_LIMIT`, `isLoadingMore` to `ThreadList`.
  - In `ThreadList.tsx`:
    - Footer action:
      - If `isLoadingMore`: Spinner button "Loading older conversations...".
      - If `hasMore`: `<Button onClick={loadMore} className="w-full text-xs font-semibold rounded-xl min-h-[44px] active:scale-[0.97]">Load older conversations (+1,000)</Button>`.
      - If `isCapped`: Notice: "Showing 5,000 latest messages. For complete historical archives, search in Message Logs." with relative link `/admin/messaging/logs`.
      - If `!hasMore`: "All conversations loaded ({threads.length})".

- [ ] **Step 3: Run client tests**
  - Run: `npx vitest run src/app/admin/messaging/conversations/__tests__/ConversationsClient.test.tsx`.
  - Expected: PASS.

---

### Task 5: Full Test Suite, Types Verification & Local Git Commit

**Files:**
- All modified and test files under `src/app/admin/messaging/conversations/`.

- [ ] **Step 1: Execute all conversations test suites**
  - Run: `npx vitest run src/app/admin/messaging/conversations/`.
  - Expected: ALL tests PASS.

- [ ] **Step 2: Verify TypeScript strict typing and zero `any`**
  - Run: `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit`.
  - Expected: Zero errors.

- [ ] **Step 3: Verify overall messaging test suite regression safety**
  - Run: `npx vitest run src/app/admin/messaging/`.
  - Expected: All test suites PASS.

- [ ] **Step 4: Commit changes locally**
  - Run:
    ```bash
    git add src/app/admin/messaging/conversations/
    git commit -m "feat(messaging): fix conversations right panel loading, revamp contact card layout, add collapsible panels and lazy loading"
    ```
  - In accordance with Rule 5, strictly DO NOT push to origin.

---

## 6. Verification Checklist & Success Criteria

- [ ] **Right Panel Loading Resolved**: `EntityContextPanel` resolves within milliseconds and never hangs in skeleton state.
- [ ] **Universal Contact Fallback**: Ad-hoc, direct, and unlinked contacts render a complete profile card with name, institution, email, phone, and delivery stats.
- [ ] **3-Line Contact Card Layout**:
  - Line 1: `[Contact Name] · [Institution Name]` (with timestamp & unread badge)
  - Line 2: `[Email] • [Phone Number]` (with `min-w-0 truncate` child spans)
  - Line 3: `[Channel Icon] [Message Preview Snippet]`
- [ ] **Fixed Width & Zero Horizontal Scrolling**: Fixed width `w-80` container with `overflow-x-hidden` and rounded corners (`rounded-2xl`).
- [ ] **Collapsible Panels & Mobile Switcher**:
  - Left panel collapses/expands smoothly with header buttons (`PanelLeftClose` / `PanelLeftOpen`).
  - Right panel collapses/expands smoothly (`PanelRightClose` / `PanelRightOpen`).
  - On mobile (`< md`), selecting a thread displays the conversation with a tactile "Back to Inbox" button.
- [ ] **Stale-While-Revalidate Lazy Loading**: Messages load in progressive 1,000-message batches without full-page spinner flashes, capped at 5,000 messages with archive link to `/admin/messaging/logs`.
- [ ] **Strict Typing**: Zero `any` or `any[]` throughout production and test files.
- [ ] **Accessibility & Tactile Feedback**: All buttons meet `min-h-[44px]` touch targets and include `active:scale-[0.97]` click states.
