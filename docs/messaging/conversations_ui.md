# SmartSapp Conversations 2.0

## UI/UX Architecture, User Flows, and Phase-by-Phase Requirements

**Document type:** Product design and implementation specification\
**Status:** Proposed baseline for engineering, product, design, and QA
review\
**Scope:** Unified WhatsApp, SMS, and Email inbox with human-approved AI
assistance\
**Primary route:** `/admin/messaging/conversations`

------------------------------------------------------------------------

## 1. Purpose

This document translates the agreed Conversations 2.0 roadmap into an
implementable UI/UX architecture, interaction model, user flows,
functional requirements, accessibility requirements, and phase-specific
acceptance criteria.

The objective is to evolve the existing conversation-log experience into
a reliable, approachable customer communications workspace. Staff should
be able to find a conversation, understand its context, reply through an
appropriate channel, track its status, and use AI assistance without
learning a complicated new system.

The product should be **reliable first, assistive second, selectively
automated later**.

### 1.1 Product outcomes

1.  Give staff one chronological view of WhatsApp, SMS, and email
    messages associated with a contact.
2.  Make one-to-one replies possible directly from a conversation,
    without opening a campaign wizard.
3.  Make ownership, unread state, follow-up status, and delivery outcome
    visible.
4.  Reduce the time required to understand a conversation and compose a
    useful response.
5.  Give staff optional AI assistance while retaining human control over
    customer-facing messages.
6.  Support secure multi-tenant operation, mobile use, accessibility,
    and scalable conversation history.
7.  Give managers meaningful operational metrics without overwhelming
    frontline staff.

### 1.2 Non-goals for the initial releases

-   Autonomous AI sending customer-facing messages.
-   Replacing the existing campaign and bulk-messaging workflows.
-   Building a full ticketing system with complex queues, SLAs,
    escalation trees, and custom workflow designers.
-   Introducing multiple visible AI agents or a prompt-engineering
    interface.
-   Requiring users to configure AI before they can use the inbox.
-   Promising channel capabilities that the connected provider does not
    actually support.

------------------------------------------------------------------------

## 2. Users, Jobs, and Design Principles

### 2.1 Primary user roles

  -----------------------------------------------------------------------
  Role                    Main jobs               Important controls
  ----------------------- ----------------------- -----------------------
  Messaging agent /       Read and reply, follow  Reply, assign to self,
  regional representative up, manage assigned     status, notes, AI draft
                          conversations           

  Team lead / manager     Balance workload,       Assignment visibility,
                          monitor overdue work,   team filters, metrics
                          review outcomes         

  Workspace administrator Configure defaults,     Messaging settings,
                          access, channel         permissions, retention
                          availability, AI policy and AI controls

  Authorized automation / Retrieve permitted      Scoped tools, explicit
  AI tool                 context and propose or  authorization, audit
                          execute permitted       trail
                          actions                 
  -----------------------------------------------------------------------

Roles and permissions must be derived from the application's existing
authorization model. UI visibility is not an authorization boundary.

### 2.2 Core jobs-to-be-done

-   "Show me which conversations need my attention."
-   "Help me understand the last interaction quickly."
-   "Let me reply in the right channel without leaving this page."
-   "Help me draft a clear response, but let me check it before
    sending."
-   "Show me whether my message actually sent or failed."
-   "Let me assign, pause, or resolve a conversation so the team knows
    what happens next."
-   "Help me see workload and response performance without manually
    reading every thread."

### 2.3 UX principles

1.  **One primary workflow:** find → understand → reply or take action.
2.  **Progressive disclosure:** reveal channel-specific options only
    when needed.
3.  **Human control:** AI creates drafts and suggestions; the user
    decides what to send.
4.  **Visible system state:** distinguish sending, sent, delivered,
    read, and failed where the provider supports those states.
5.  **Safe defaults:** choose a sensible channel, but never silently
    switch channels or bypass consent rules.
6.  **Low cognitive load:** keep the main interface to a small number of
    stable regions and actions.
7.  **Consistent interaction patterns:** use the same status,
    assignment, search, and feedback conventions throughout the app.
8.  **Responsive by design:** desktop is optimized for triage and
    multitasking; mobile is optimized for focused conversation handling.
9.  **Accessible feedback:** never communicate status through color
    alone.
10. **Tenant-aware by default:** every view and action respects
    organization, workspace, and record-level permissions.

------------------------------------------------------------------------

## 3. Information Architecture

### 3.1 Navigation

Conversations should remain under the existing Messaging area. The
primary navigation should not become a new collection of AI-specific
destinations.

**Messaging** - Conversations - Message Composer / Campaigns -
Templates - Queues, if already available and useful in the existing
product

The Conversations page should link to existing CRM contact/entity
records and existing campaign/template tools where relevant. Avoid
duplicating those tools inside Conversations.

### 3.2 Main page structure

Desktop uses a three-region layout:

1.  **Conversation list:** approximately 300--340 px.
2.  **Active conversation:** flexible central region and the dominant
    focus.
3.  **Contact context panel:** approximately 260--300 px, collapsible.

Suggested layout:

``` text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Conversations                                      Search / filters / actions│
├───────────────────────┬────────────────────────────────┬─────────────────────┤
│ Inbox filters         │ Contact + status + assignment  │ Contact context     │
│ Search                ├────────────────────────────────┤                     │
│ Conversation list     │ Date separators                │ Contact / entity    │
│                       │ Inbound and outbound messages  │ CRM link / stage    │
│                       │ Delivery state                 │ Summary / next step │
│                       ├────────────────────────────────┤                     │
│                       │ Channel + reply composer       │                     │
└───────────────────────┴────────────────────────────────┴─────────────────────┘
```

The page header should stay compact. Avoid duplicating global
navigation, CRM fields, and campaign actions in the conversation header.

### 3.3 Conversation list filters

Recommended stable filter set:

-   **All**
-   **Unread**
-   **Assigned to me**
-   **Waiting**
-   **Resolved**

Channel filters should be available as a secondary filter or compact
dropdown: All channels, WhatsApp, SMS, Email. If the current application
already has familiar channel pills, preserve them rather than
introducing competing controls.

Additional filter options may include owner and date range, but should
be hidden under "More filters" until needed.

### 3.4 Conversation list item

Each item should show only the information needed to choose a
conversation:

-   Contact display name; fallback to a normalized phone number or
    email.
-   Last-message preview.
-   Time of latest message.
-   Channel icon or label.
-   Unread count or unread indicator.
-   Assignment avatar/name when assigned.
-   Small status indicator when Waiting or Resolved.
-   Optional priority indicator only when it triggers an action.

Do not show a separate badge for every metadata field. AI-generated
labels must not crowd the preview.

### 3.5 Conversation header

The active thread header should show:

-   Contact/entity name and a clear identity fallback.
-   Current channel availability only where relevant.
-   Conversation status control.
-   Assigned owner control.
-   More actions menu: copy contact detail, open CRM record, add private
    note, mark unread, resolve/reopen.
-   Context panel toggle on desktop and mobile.

The header should not become a dashboard. Put detailed CRM information
in the context panel.

### 3.6 Message timeline

The timeline is the primary work area. It should support:

-   Chronological messages from all linked channels.
-   Date separators such as Today, Yesterday, or a localized date.
-   Clear inbound vs outbound alignment and sender identity.
-   Channel label for each message.
-   Timestamp and provider status where relevant.
-   Failed-message details and safe retry action.
-   Loading older messages through cursor pagination.
-   New-message indicator and "Scroll to latest" action when the user
    has scrolled up.
-   Optimistic local rendering for outgoing messages with an explicit
    Sending state.
-   Private notes visually distinct from customer-visible messages.

Email should appear as an email card with subject and sanitized body,
not as an oversized chat bubble containing raw HTML. Any rendered HTML
must be sanitized and isolated from application scripts.

### 3.7 Contact context panel

Use progressive disclosure and a compact hierarchy:

1.  **Identity:** contact name, organization/entity, phone, email.
2.  **CRM context:** record link, lifecycle/pipeline stage, owner,
    relevant tags.
3.  **Conversation summary:** a short, dismissible AI-generated summary
    when available.
4.  **Outstanding commitment / next action:** concise and
    evidence-grounded.
5.  **Recent related activity:** only if relevant and authorized.

The panel should distinguish verified CRM fields from AI-generated
interpretations. If there is no summary yet, offer "Summarize
conversation"; do not show an empty AI card.

------------------------------------------------------------------------

## 4. Core Interaction Model

### 4.1 Conversation lifecycle

Keep the initial lifecycle simple:

-   **Open:** conversation needs handling or is actively being handled.
-   **Waiting:** staff has replied or handed off and is waiting for the
    contact or another action.
-   **Resolved:** no immediate action is expected.

Unread/read is a separate attribute, not a lifecycle status. Assignment
is also separate from status.

Rules: - New inbound message on a resolved conversation reopens it,
subject to workspace policy. - A staff reply does not automatically mark
a conversation resolved. - A user may resolve a conversation manually. -
A resolved conversation can be reopened. - A private note does not count
as a customer response. - Status changes should be timestamped and
auditable.

### 4.2 Assignment model

Minimum viable assignment: - Unassigned. - Assigned to me. - Assigned to
a permitted team member.

Requirements: - Only authorized users can assign or reassign
conversations. - The current owner is visible in the thread header and
list item. - Reassignment is recorded in the audit trail. - If a user
lacks permission to assign others, they may still be allowed to assign a
conversation to themselves according to policy. - Concurrent assignment
changes must not silently overwrite one another.

### 4.3 Default channel selection

Recommended default: **auto-match the most recent usable interaction
channel**.

Resolution order: 1. If the user explicitly selects a channel for the
current draft, preserve that selection. 2. Otherwise, prefer the most
recent inbound channel that is connected, available, permitted, and has
a valid destination. 3. If no suitable inbound channel exists, use the
last-used channel for that contact in the current session if it is still
usable. 4. Otherwise use the workspace default, then an explicit prompt
if no safe option can be chosen.

A WhatsApp session outside the 24-hour customer-service window is not
necessarily an unavailable channel; it means the composer must require
an approved template. Do not silently switch to SMS or email.

Persist the selected channel for the active draft. If the user switches
channels, preserve draft content where safe and supported, but do not
carry channel-specific metadata (for example, an email subject or
WhatsApp template parameters) into an incompatible channel without
explicit transformation.

### 4.4 Sending states

UI must distinguish: - Draft - Sending - Accepted by provider / Sent -
Delivered (only if provider confirms) - Read (only if provider
confirms) - Failed - Unknown / awaiting reconciliation

Never display "Delivered" merely because the dispatch API returned
success. If a provider does not expose read receipts, do not invent
them.

For a failure: - Explain the issue in user-understandable language. -
Preserve the draft where safe. - Offer a retry only when it will not
create a duplicate. - Offer an alternative channel only if permitted and
make the channel change explicit.

------------------------------------------------------------------------

## 5. User Flows

### Flow A --- Open and reply to a conversation

1.  User opens Messaging → Conversations.
2.  Inbox loads permitted conversations and available filters.
3.  User selects a conversation from the list.
4.  Thread loads recent messages and the contact context panel.
5.  The system determines the default channel using the
    channel-selection rules.
6.  User types a reply or requests an AI draft.
7.  The composer validates channel-specific requirements and displays
    any relevant warnings.
8.  User explicitly sends the message.
9.  The server rechecks permission, tenant scope, destination,
    consent/suppression rules, provider configuration, and channel
    constraints.
10. The UI shows Sending, then the best confirmed provider state.
11. The conversation timeline and list preview update.
12. If dispatch fails, the UI explains the failure and retains a
    recoverable draft.

**Acceptance criteria** - Replying does not open the campaign wizard. -
The active thread remains selected after sending. - The message appears
once, even if the client retries. - A failure cannot be mistaken for a
successful send. - All dispatch checks run server-side.

### Flow B --- Switch channels

1.  User opens the channel selector.
2.  UI lists only channels available for this contact and workspace,
    while explaining disabled channels when useful.
3.  User selects WhatsApp, SMS, or Email.
4.  Composer changes its controls to the selected channel.
5.  If WhatsApp is outside the allowed service window, the composer
    presents approved templates.
6.  If Email is selected, subject is shown and validated.
7.  If SMS is selected, the UI shows encoding-aware character/segment
    estimates.
8.  The user reviews and sends explicitly.

**Acceptance criteria** - Channel switching never sends a message. - A
channel switch is visually obvious. - The destination and sending
identity are visible before sending. - A disabled channel does not
silently fall back to another channel. - SMS segment estimates are based
on the actual encoding and provider rules, not a simplistic fixed
counter alone.

### Flow C --- Use AI to draft a reply

1.  User clicks "Help me reply."
2.  AI uses only authorized, relevant conversation and CRM context.
3.  UI shows a loading state without blocking the entire inbox.
4.  A draft appears in the normal editable composer.
5.  User may insert, edit, regenerate, shorten, or discard the draft.
6.  The UI indicates when the draft may be based on incomplete context.
7.  User explicitly sends the final message.
8.  The system logs AI assistance metadata according to policy without
    unnecessarily retaining hidden reasoning or sensitive prompt copies.

**Acceptance criteria** - AI never sends a customer-facing message
merely because a draft was generated. - The user can edit the full draft
before sending. - AI output does not bypass channel validation or server
authorization. - Failure to reach the model does not disable manual
replies. - The system does not fabricate pricing, commitments, product
capabilities, dates, or CRM facts. - Retrieved message content is
treated as untrusted data and cannot authorize tools or override system
policy.

### Flow D --- Summarize a long conversation

1.  User opens the summary area or selects "Summarize conversation."
2.  The system retrieves an authorized and bounded slice of relevant
    thread history.
3.  AI returns a compact structured summary:
    -   Contact's goal or issue.
    -   Important facts and commitments.
    -   Outstanding questions.
    -   Suggested next action.
4.  Summary shows its freshness or the latest message it covers.
5.  User may dismiss it, refresh it, or report/correct an issue.
6.  New messages invalidate or mark the summary stale according to
    policy.

**Acceptance criteria** - Summary is clearly labeled as AI-generated. -
The summary does not replace the original messages. - Unsupported
details are omitted or marked uncertain. - Only authorized records are
included. - The UI can function when the summary service is unavailable.

### Flow E --- Assign a conversation

1.  User selects the owner control in the conversation header.
2.  UI shows permitted users and optionally "Unassigned" / "Assign to
    me."
3.  User selects an owner.
4.  Server checks assignment permission and current record version.
5.  Header and list item update.
6.  An audit event records who changed the owner and when.

**Acceptance criteria** - Unauthorized users cannot assign or reassign
others. - Assignment updates are consistent across clients. -
Conflicting changes are surfaced instead of silently lost. - Assignment
is not inferred solely from who last sent a message.

### Flow F --- Manage status and unread state

1.  User chooses Open, Waiting, or Resolved.
2.  UI updates the status with clear feedback.
3.  If a new inbound message arrives, the configured reopen policy is
    applied.
4.  Unread/read state is tracked independently and according to the
    product's per-user or per-inbox model.
5.  User can mark a thread unread to return to it later.

**Acceptance criteria** - Status and unread state are separate. -
Private notes do not change customer-facing delivery state. - Reopening
is visible and auditable. - Real-time updates do not unexpectedly move
the user to a different conversation.

### Flow G --- Recover from a failed message

1.  A message receives a confirmed failure or remains in an unknown
    state beyond the configured threshold.
2.  The message shows a failure/unknown indicator and concise
    explanation.
3.  User opens details to see a safe, human-readable reason.
4.  System determines whether retry is safe based on provider request
    ID, idempotency key, and dispatch state.
5.  User retries or selects a permitted alternative channel.
6.  The original attempt remains in the audit trail; retries are linked
    to it.

**Acceptance criteria** - Unknown state is not treated as definite
failure or success. - Retry does not create duplicate messages. -
Provider secrets and raw sensitive error payloads are never exposed to
the client. - The original draft and attempt history remain traceable.

### Flow H --- Manager reviews inbox performance

1.  Manager opens the relevant reporting view or inbox overview.
2.  Filters by workspace, team, owner, channel, and period within their
    permissions.
3.  Views open/unassigned conversations, overdue conversations,
    first-response time, resolution time, and failure rates.
4.  Optional AI brief summarizes trends from authorized, aggregated
    information.
5.  Manager can open a metric's underlying conversations where
    permitted.

**Acceptance criteria** - Metrics use documented definitions and
timezone rules. - AI-generated interpretations are separated from
measured facts. - Empty or incomplete data is labeled honestly. -
Manager access does not imply access to every message body.

------------------------------------------------------------------------

## 6. Phase-by-Phase UI/UX Requirements

## Phase 1 --- Reliable Conversations

### Objective

Deliver a trustworthy, functional omnichannel thread and direct reply
flow.

### UI requirements

-   Correct inbound/outbound alignment, sender identity, channel label,
    timestamps, and delivery state.
-   Direct reply composer docked at the bottom of the thread.
-   Channel selector with explicit current-channel label.
-   WhatsApp service-window state and approved-template selection when
    required.
-   SMS encoding-aware character/segment estimate and sending identity
    where available.
-   Email subject field and safe rendering of historical email bodies.
-   Loading, sending, sent, failed, and retry states.
-   Scroll-to-latest behavior that does not force the user to the bottom
    while reading older messages.
-   Responsive mobile thread view with a clear back-to-inbox action.

### Functional requirements

-   Reuse existing dispatch services where their behavior has been
    verified.
-   Reuse `message_logs` as the message source of truth; do not
    introduce a second independent message history.
-   Resolve tenant/workspace scope on the server from authenticated
    context wherever possible; do not trust a client-provided workspace
    ID by itself.
-   Validate input with shared Zod schemas.
-   Verify the acting user's permission to contact the recipient.
-   Check consent, suppression, destination validity, provider
    configuration, and channel constraints before dispatch.
-   Use idempotency and provider-message identifiers for safe retries
    and reconciliation.
-   Log actor, channel, timestamp, dispatch outcome, and relevant source
    metadata.
-   Do not log provider credentials or expose them in client payloads.

### Acceptance criteria

-   Staff can send a one-to-one message without opening a campaign
    workflow.
-   Provider acceptance, delivery, read, and failure are represented
    accurately.
-   Duplicate-click and network-retry tests do not create duplicate
    sends.
-   Inbound messages appear on the inbound side; outbound messages
    appear on the outbound side.
-   Tenant-isolation and permission tests pass.
-   Manual reply still works when AI services are unavailable.

## Phase 2 --- Inbox Management

### Objective

Help staff triage and own conversations without adding ticketing-system
complexity.

### UI requirements

-   Primary filters: All, Unread, Assigned to me, Waiting, Resolved.
-   Secondary channel filter and search by supported contact
    identifiers.
-   Conversation owner in the list and active-thread header.
-   Simple Open / Waiting / Resolved status control.
-   Private note action visually distinct from customer-visible reply.
-   Mark unread and reopen actions.
-   Useful empty, loading, and error states.
-   Mobile list-to-thread drill-in; no forced three-column layout on
    small screens.

### Functional requirements

-   Define the conversation identity and canonical contact association
    rules.
-   Define unread state scope: per user, per team inbox, or
    organization; select one explicitly.
-   Use indexed, cursor-based queries for thread history and list
    pagination.
-   Search message bodies only through an intentional indexed/search
    mechanism; do not claim full-text search if only client-side
    filtering is implemented.
-   Record assignment and status changes with actor and timestamp.
-   Define how new inbound messages affect resolved status.
-   Ensure real-time updates do not reorder or steal focus unexpectedly.

### Acceptance criteria

-   A user can find unread and assigned conversations without scrolling
    the full archive.
-   Ownership and status are consistent across sessions.
-   A new inbound message follows the documented reopen policy.
-   Search behavior and limitations are clearly represented.
-   The list remains responsive at expected data volumes.

## Phase 3 --- AI Reply Assistant

### Objective

Reduce drafting time while keeping every customer-facing message under
human control.

### UI requirements

-   A single "Help me reply" or "AI draft" action adjacent to the
    composer.
-   Optional tone/length controls: Professional, Friendly, Empathetic,
    Concise.
-   Generated content appears in the normal editable input.
-   Actions: Insert/use draft, Regenerate, Shorten, Make clearer, Change
    tone, Discard.
-   Loading state, model error state, and "context may be incomplete"
    state.
-   No full-screen AI modal for routine drafting.

### Functional requirements

-   Use a typed request/response contract and validate model output.
-   Build context from the active thread and explicitly permitted CRM
    data.
-   Set token/context limits and rate limits.
-   Treat message content and retrieved CRM notes as untrusted data.
-   Do not provide the model with provider credentials or unrestricted
    tool access.
-   Do not allow generated output to override consent, tenant scope,
    channel policy, or user permissions.
-   Record appropriate AI usage metadata and feedback while applying
    privacy/retention rules.
-   Allow manual drafting when AI is disabled, unavailable, or over
    quota.

### Acceptance criteria

-   AI drafts can be fully edited or discarded.
-   No send action occurs as a side effect of generation.
-   Suggestions do not bypass the normal server-side send path.
-   Unsupported factual claims are minimized and the UI gives users a
    way to correct the result.
-   AI errors do not erase the user's current draft.
-   Users can understand that the content was AI-generated.

## Phase 4 --- Contextual Intelligence

### Objective

Reduce the time needed to understand a thread and decide what to do
next.

### UI requirements

-   Compact summary card in the contact context panel.
-   Summary fields: issue/goal, important context, commitments, open
    questions, suggested next action.
-   "Summarize" and "Refresh summary" controls.
-   A small intent/priority indicator in the list only when it helps
    triage.
-   Explainable labels and a way to correct/dismiss incorrect
    suggestions.
-   Template recommendations displayed as suggestions, not forced
    selections.

### Functional requirements

-   Classify only the minimum fields required for a useful workflow.
-   Use deterministic rules for simple, high-confidence conditions where
    appropriate.
-   Record summary freshness and invalidate or refresh when the
    underlying thread changes materially.
-   Define confidence thresholds and a "Needs review"/unknown fallback.
-   Never let AI priority alone trigger punitive staff actions or
    customer-facing sends.
-   Retrieve only relevant and authorized records.
-   Cache outputs with a documented invalidation strategy and avoid
    stale summaries being presented as current.
-   Keep the original messages as the authoritative record.

### Acceptance criteria

-   Users can identify summary freshness.
-   The interface distinguishes source facts from AI suggestions.
-   Low-confidence classifications are not presented as certain facts.
-   AI can be disabled without breaking the inbox.
-   A user can report or correct a mistaken suggestion.

## Phase 5 --- Team Performance

### Objective

Make workload and response quality measurable without overwhelming
frontline users.

### UI requirements

-   Compact overview cards for open, unassigned, overdue, and failed
    conversations.
-   Filters by period, channel, team, and owner subject to permission.
-   Clear metric definitions accessible from the report.
-   Optional AI-generated daily/weekly brief.
-   Drill-through from metrics to authorized underlying conversations.
-   Avoid adding manager-only metrics to every agent's main inbox.

### Functional requirements

-   Define first-response time, resolution time, reopened conversation
    treatment, business hours, timezone, and excluded statuses.
-   Calculate metrics from reliable timestamps and reconciled events.
-   Identify incomplete data and avoid presenting estimates as exact
    measurements.
-   Separate numeric facts from AI-generated interpretation.
-   Aggregate data before sending it to AI where possible.
-   Enforce reporting permissions and prevent cross-tenant aggregation.

### Acceptance criteria

-   Managers can explain how each metric is calculated.
-   AI briefs do not invent counts or trends.
-   Incomplete or unavailable data is labeled.
-   Reporting is permission-scoped and does not leak message content
    across workspaces.

## Phase 6 --- Controlled Automation and MCP

### Objective

Introduce automation only after direct replies, status management, and
AI assistance are stable.

### UI requirements

-   Show when a suggested action is AI-generated.
-   Require explicit approval for customer-facing sends by default.
-   Provide a review/confirmation surface for any future permitted
    automated action.
-   Show automation execution status and a clear audit history.
-   Provide workspace-level enablement and usage controls where
    appropriate.

### Functional requirements

-   Separate read-only tools, proposal tools, and side-effecting tools.
-   Apply least privilege, tenant scoping, user/agent authorization,
    rate limits, and audit logging.
-   Use the same authoritative server-side dispatch service as the UI.
-   Require idempotency for side-effecting tools.
-   Treat inbound message content as untrusted; do not let it authorize
    tool calls.
-   Define tool timeouts, retry limits, failure handling, and maximum
    execution budgets.
-   Provide a kill switch and organization-level feature controls.
-   Start with low-risk actions such as suggesting a status or creating
    a follow-up task; keep autonomous messaging out of the initial
    release.

### Acceptance criteria

-   AI/MCP cannot bypass UI-level business rules because the same rules
    are enforced server-side.
-   Every side effect has a traceable actor or initiating agent, request
    ID, and outcome.
-   Unauthorized tool calls fail closed.
-   Retries cannot duplicate a customer-facing action.
-   Automation can be disabled without affecting manual inbox
    operations.

------------------------------------------------------------------------

## 7. Composer Requirements by Channel

### 7.1 Shared composer behavior

-   Preserve unsent drafts when switching threads where safe and
    feasible.
-   Keep the active recipient visible or otherwise unambiguous.
-   Prevent accidental sends caused by Enter key alone; use an explicit
    Send button and an optional documented shortcut such as
    Ctrl/Cmd+Enter.
-   Disable Send while the request is in a non-retryable in-flight
    state.
-   Provide a clear sending indicator and a recoverable error state.
-   Confirm destructive draft clearing if unsent content would be lost.
-   Keep keyboard focus predictable after send and after AI generation.
-   Do not clear the draft until the server response is sufficiently
    definitive for the chosen dispatch model.

### 7.2 WhatsApp

-   Show the current service-window state based on authoritative server
    data.
-   Outside the allowed free-form window, require an approved template
    where the provider's policy requires it.
-   Show template name, language, required variables, and a preview of
    the resolved message.
-   Validate required template parameters before enabling Send.
-   Never assume a session is active based only on client time or a
    stale cache.
-   Do not silently convert a free-form message to a template or switch
    channels.
-   Explain restrictions in plain language.

### 7.3 SMS

-   Show character count and estimated segment count using actual
    encoding rules, including Unicode/non-GSM content.
-   Warn when the content increases the segment count.
-   Show sender ID where the provider makes it available.
-   Respect provider length limits, opt-outs, and regional requirements.
-   Do not present a universal 160-character assumption as correct for
    every message.

### 7.4 Email

-   Require a subject before sending.
-   Default to a sensible reply subject when a previous subject is
    available, but allow editing.
-   Support a lightweight formatting model only if the existing email
    service safely supports it.
-   Sanitize historical HTML email content before rendering.
-   Avoid making the reply composer a full marketing email builder.
-   Make sender identity and recipient visible.

------------------------------------------------------------------------

## 8. Responsive Design Requirements

### Desktop: 1280 px and above

-   Three-region layout by default.
-   Conversation list and context panel can be collapsed.
-   Central thread receives the largest share of space.
-   Keyboard shortcuts are documented and discoverable.
-   Filters remain visible without dominating the page.

### Tablet: 768--1279 px

-   Two primary regions at a time.
-   Context panel opens as a drawer or overlay.
-   Composer controls remain touch-friendly.
-   Avoid squeezing three fixed-width columns into the viewport.

### Mobile: below 768 px

-   Inbox list and conversation thread are separate views.
-   Selecting a thread opens it full-screen with a clear back action.
-   Contact details and context open in a sheet/drawer.
-   Composer is docked above the on-screen keyboard and respects safe
    areas.
-   Channel selection and Send remain accessible.
-   Do not rely on hover-only tooltips.
-   Avoid horizontal scrolling for primary workflows.

Breakpoints should be based on content fit and tested across realistic
viewport widths, not only device names.

------------------------------------------------------------------------

## 9. Accessibility and Interaction Standards

Target WCAG 2.2 AA where applicable.

-   Minimum touch target approximately 44 × 44 CSS pixels for primary
    touch interactions.
-   Full keyboard operation for list navigation, channel selection,
    composer, assignment, and status changes.
-   Visible focus indicators.
-   Semantic buttons, labels, and form controls.
-   Screen-reader announcements for message sending, failure, and
    important live updates without announcing every irrelevant data
    refresh.
-   Status must not rely on color alone; pair colors with text/icons.
-   Respect reduced-motion preferences.
-   Maintain readable contrast for inbound/outbound messages and
    disabled controls.
-   Keep focus within dialogs/drawers while open and restore focus to
    the triggering control on close.
-   Avoid moving focus automatically when a new inbound message arrives.
-   Provide accessible error descriptions adjacent to invalid controls.

------------------------------------------------------------------------

## 10. Design System and Visual Direction

Use the existing SmartSapp design system and established brand colors.
The preferred direction is minimal, calm, high-contrast, and
content-first.

### Visual hierarchy

1.  Contact identity and conversation state.
2.  Message content and composer.
3.  Unread, owner, and delivery indicators.
4.  Supporting CRM details and AI insights.

### Component guidance

-   Use consistent status chips for Open, Waiting, and Resolved.
-   Use subtle surfaces for inbound messages and a high-contrast,
    accessible treatment for outbound messages.
-   Use icons plus labels for channel and delivery state.
-   Keep AI suggestions visually distinct but not visually dominant.
-   Reserve warning colors for meaningful warnings such as an expired
    WhatsApp window or failed send.
-   Avoid multiple competing primary buttons.
-   Use skeletons for loading lists/threads only where they reduce
    perceived latency; provide empty states for genuinely empty data.
-   Prefer simple transitions and reduced-motion support over decorative
    animation.

### Content language

Use plain language: - "Needs a WhatsApp template" rather than a provider
error code alone. - "Message failed to send" with a useful
explanation. - "AI suggested reply" rather than implying the message is
verified. - "Waiting for customer" only when that meaning is accurate. -
"No conversations match these filters" rather than a generic empty
screen.

------------------------------------------------------------------------

## 11. Settings and Preferences

Do not make the settings area a prerequisite for using the inbox.

### Workspace messaging settings

-   Default channel preference: Auto-match, WhatsApp, SMS, Email, or
    Prompt.
-   Channel availability and sender identity indicators.
-   AI assistance enabled/disabled, subject to organization policy.
-   AI usage limits or quotas where applicable.
-   Default conversation status/reopen policy.
-   Assignment permissions and eligible team members.
-   Retention and privacy settings according to the existing governance
    model.

### User preferences

-   Last-used channel for the current contact/session where supported.
-   Optional composer shortcut preference only if there is a
    demonstrated need.
-   Dismissed or hidden AI suggestions should not be treated as consent
    to disable all AI functionality.

Every preference needs a documented precedence rule: organization
policy, workspace setting, user preference, then safe default. User
preferences must never override compliance or security controls.

------------------------------------------------------------------------

## 12. Data and State Requirements for UX

The UI depends on consistent backend state. The final schema should be
reconciled with existing code before adding new fields.

### Message record: required concepts

-   Stable internal message ID.
-   Organization/workspace scope.
-   Canonical conversation/contact reference where available.
-   Channel and direction.
-   Recipient/sender identity.
-   Body and email subject where applicable.
-   Created/received timestamp and provider timestamp where available.
-   Dispatch state and provider message ID.
-   Idempotency key or request correlation ID.
-   Actor/source metadata.
-   Failure category suitable for safe user display.
-   Delivery/read timestamps only when supported and confirmed.

### Conversation record or derived aggregate: required concepts

-   Stable conversation ID.
-   Tenant scope.
-   Contact/entity links.
-   Latest-message reference and timestamp.
-   Status.
-   Assignment owner.
-   Unread state with a clearly defined scope.
-   Optional priority/intent labels and provenance.
-   Summary content, source range/version, and freshness metadata if
    summaries are cached.

A conversation aggregate can be a derived index while `message_logs`
remains the authoritative message record. Do not assume that every
thread can be efficiently computed by loading all message logs on the
client.

### AI result metadata

-   Feature type (draft, summary, classification).
-   Source message/version range or context fingerprint.
-   Model/config version where useful for audit and debugging.
-   Created timestamp and requesting user.
-   User feedback or action (used, edited, discarded) when collected.
-   No unnecessary retention of hidden reasoning or unrestricted
    sensitive context.

------------------------------------------------------------------------

## 13. Error, Empty, and Edge States

Design and test the following states explicitly:

-   No conversations yet.
-   No results for current search/filters.
-   Conversation exists but contact identity is unresolved.
-   Contact has multiple possible CRM matches.
-   Thread history is loading or older messages are being fetched.
-   New message arrives while the user is reading older messages.
-   Provider is disconnected or credentials are unavailable.
-   WhatsApp template list cannot be loaded.
-   WhatsApp window state is unknown or stale.
-   SMS estimate changes because of Unicode content.
-   Email subject is missing.
-   User lacks permission to send or assign.
-   Consent or suppression rule blocks dispatch.
-   AI service is unavailable or rate-limited.
-   AI returns invalid or unsupported output.
-   Dispatch result is unknown due to timeout.
-   Duplicate send is prevented.
-   Another agent changes assignment/status concurrently.
-   Conversation is resolved but receives a new inbound message.
-   Mobile network disconnects during send.

For each state, specify: visible message, available recovery action,
whether user input is preserved, and whether the event is logged.

------------------------------------------------------------------------

## 14. Analytics and Product Instrumentation

Instrument only events needed to improve product quality and user
outcomes. Avoid logging full message content in analytics events.

Suggested events: - `conversation_opened` - `conversation_assigned` -
`conversation_status_changed` - `conversation_marked_unread` -
`composer_channel_changed` - `reply_draft_started` -
`reply_dispatch_started` - `reply_dispatch_succeeded` -
`reply_dispatch_failed` - `reply_retry_requested` -
`ai_draft_requested` - `ai_draft_used` - `ai_draft_edited` -
`ai_draft_discarded` - `conversation_summary_requested` -
`conversation_summary_feedback` - `conversation_resolved`

Events must be tenant-scoped and permission-aware. Analytics should not
become a side channel for message bodies, contact secrets, or provider
credentials.

### Baseline and target-setting

Before rollout, capture: - Median first-response time. - Median
resolution time. - Number and age of unassigned/open conversations. -
Dispatch failure rate. - Duplicate-send incidents. - Weekly active inbox
users. - AI draft use/edit/discard rate during the pilot. -
Staff-reported usefulness and time saved.

Set targets only after a reliable baseline exists.

------------------------------------------------------------------------

## 15. Testing Strategy

### Unit tests

-   Channel default resolution.
-   Channel-specific composer validation.
-   SMS encoding/segment estimation.
-   WhatsApp session/template state.
-   Status and unread transition rules.
-   AI output validation and fallback behavior.
-   Permission decisions and tenant scope.
-   Idempotency-key handling.

### Component tests

-   Thread list filters and search.
-   Message timeline alignment and ordering.
-   Composer channel switching and draft preservation.
-   Sending, failed, and unknown status UI.
-   Summary and AI draft loading/error states.
-   Assignment and status menus.
-   Responsive drawers and mobile back navigation.
-   Keyboard and accessible interaction behavior.

### Integration tests

-   Server dispatch through each existing provider adapter.
-   Webhook updates and provider-status reconciliation.
-   Inbound/outbound message association.
-   Retry and duplicate prevention.
-   Consent/opt-out enforcement.
-   AI context retrieval and permission boundaries.
-   MCP tool calls through the same authorization/dispatch layer.
-   Real-time updates across two authorized clients.

### End-to-end scenarios

1.  Receive WhatsApp message, open thread, draft a reply, send, and
    reconcile status.
2.  Attempt WhatsApp free-form reply after the service window; verify
    template requirement.
3.  Send SMS containing non-GSM characters and verify the
    estimate/warning.
4.  Send email without a subject and verify prevention.
5.  Simulate a dispatch timeout and ensure retry does not duplicate the
    message.
6.  Generate an AI draft, edit it, and send only after explicit user
    action.
7.  Attempt cross-workspace access and dispatch; verify fail-closed
    behavior.
8.  Resolve a thread and receive a new inbound message; verify the
    reopen policy.
9.  Assign a conversation from two clients concurrently.
10. Use the inbox on a narrow mobile viewport with keyboard and
    screen-reader checks.

------------------------------------------------------------------------

## 16. Release and Adoption Plan

### Internal pilot

-   Start with a small group of staff across representative workflows.
-   Enable direct replies and status/assignment controls first.
-   Collect qualitative feedback on channel defaults, composer behavior,
    and failure explanations.
-   Enable AI drafts for the pilot group only after baseline messaging
    is reliable.
-   Review errors and staff feedback before broad rollout.

### Rollout

-   Use feature flags for new composer and AI capabilities.
-   Preserve access to existing campaign workflows.
-   Monitor dispatch failure, duplicate-send, and tenant-boundary
    alerts.
-   Provide a short in-product onboarding hint the first time a user
    opens the inbox.
-   Do not force a tutorial for experienced users.
-   Keep an easy way to report an issue and disable AI assistance
    according to policy.

### Adoption indicators

-   Staff can send a direct reply without training on the campaign
    wizard.
-   Most pilot users can find, reply to, and resolve a conversation
    without assistance.
-   AI draft usage is accompanied by acceptable quality feedback.
-   Dispatch errors and duplicate sends do not increase during rollout.
-   The new inbox does not regress existing campaign messaging.

------------------------------------------------------------------------

## 17. Definition of Done

A phase is not complete merely because the UI renders or the TypeScript
build passes.

Each phase is complete only when:

1.  Requirements and interaction states are implemented.
2.  Authorization and tenant isolation are enforced server-side.
3.  Loading, empty, error, and recovery states are designed.
4.  Unit, component, integration, and relevant end-to-end tests pass.
5.  Keyboard, responsive, and accessibility checks are complete.
6.  Analytics and audit events are implemented where specified.
7.  Feature flags and rollback behavior are tested where relevant.
8.  Documentation is updated.
9.  Product and QA verify acceptance criteria against the running
    application.
10. No unsupported provider or AI capability is presented as guaranteed
    functionality.

------------------------------------------------------------------------

## 18. Recommended Implementation Order

1.  Audit existing thread identity, `message_logs` schema, provider
    adapters, webhook reconciliation, permissions, and current UI
    components.
2.  Agree on conversation identity, unread scope, status lifecycle,
    assignment model, and dispatch-state definitions.
3.  Implement reliable direct replies and channel-specific composer
    states.
4.  Add assignment, status, unread management, and robust list/thread
    pagination.
5.  Pilot the new inbox with staff.
6.  Add the human-approved AI Reply Assistant.
7.  Add summaries, intent/priority suggestions, and contextual template
    recommendations.
8.  Add manager reporting and AI briefs.
9.  Introduce limited MCP/workflow automation after authorization,
    audit, idempotency, and kill-switch controls are verified.

### Final product principle

**Conversations 2.0 should feel like a familiar inbox with unusually
good context and helpful AI---not like a complex AI platform that
happens to send messages.**

The default path should always remain simple: find the conversation,
understand what is needed, write or improve a reply, send it safely, and
know what happens next.
