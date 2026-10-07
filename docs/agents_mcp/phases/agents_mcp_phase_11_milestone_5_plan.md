# Phase 11 · Milestone 5 Implementation Plan
## UI & Operator Experience: Meeting Brief, AI Timeline, Post-Meeting Execution Panel, Knowledge Inbox, Item Inspector, ⌘⇧K Search, Visual Graph Explorer & Backoffice Control Plane

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Version:** 1.0.0 (Exhaustive `agents_mcp_rules.md` Conformance; Zero Functionality Removed)  
**Status:** PLANNING (Awaiting User Review & Approval Before Execution)  
**Date:** October 7, 2026  
**Parent Document:** [`docs/agents_mcp/phases/agents_mcp_phase_11_master_plan.md`](agents_mcp_phase_11_master_plan.md) §1.1 (Signature Workflows A & B), §5.1 (Memory SSOT on Firestore), §5.6 (Budgets), §5.8 (Knowledge Inbox → Memory), §7.2 (Rules Conformance), §8.1 (Deliverables), §9 (Risks), §10.1 (Affected Features), §10.2 (Backoffice Enhancements), §11 (UX Rules), §13 (Milestone Tracker P11-M5-T1…T7).  
**Depends On:**
- Phase 11 Milestone 0 (Memory SSOT on Firestore, governed gateway routing, durable approvals, zero fallback secrets).
- Phase 11 Milestone 1 (Meeting capabilities, ingestion, segments subcollection, consent gate).
- Phase 11 Milestone 2 (Autonomous Meeting Analyst extraction pipeline, outcomes, items, verified tasks, and CRM proposals).
- Phase 11 Milestone 3 (Knowledge Inbox, Deduplication, Contradiction Detection, Temporal Graph Linking, Embeddings Backfill).
- Phase 11 Milestone 4 (Adaptive Retrieval, Hybrid RAG, Recency Decay, Cross-Workspace Partitioning, MCP Resources & Prompts).

**Governing Documents & Standards:**
- Master 69 Rules: [`docs/agents_mcp/agents_mcp_rules.md`](../agents_mcp_rules.md) (Important Rules 1–10 as amended, Rules 11–69, Rule 67 Implementation Gate, Rule 68 Five Non-Negotiables).
- Workspace Standards: [`.agents/AGENTS.md`](../../../.agents/AGENTS.md) (Zero `any`/`any[]`, `FieldsVariablesService` SSOT, `<TagSelector>` SSOT, actionable relative toasts, mobile-first design, Modal & Dialog SSOT).
- Design Architecture: [`theme.md` §8](../../../theme.md) (Standardized Modal & Dialog System Architecture: zero raw descriptions, single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`, `<DialogHeader demarcated>`, demarcated footers with tactile `rounded-xl active:scale-[0.97]` buttons).
- Product Requirements: [`docs/agents_mcp/agents_mcp_prd.md`](../agents_mcp_prd.md) (§22–26 Graph, §51 Empty States, §62 Knowledge Inbox, §63 Memory Timeline, §64 Knowledge Graph UI, §65 Ask SmartSapp).
- User Interface: [`docs/agents_mcp/agents_mcp_ui.md`](../agents_mcp_ui.md) (§1–4 Mental Model & Nav, §14 Knowledge Inbox, §15 Item Inspector, §16 Knowledge Search ⌘⇧K, §17–18 Knowledge Graph & Modes, §3499–3520 Phase 11 UI).
- Cloud Run Serverless: [`docs/agents_mcp/agents_mcp_cloudrun.md`](../agents_mcp_cloudrun.md).

---

## 1. Executive Summary & Intent

Milestones 0 through 4 constructed the underlying data plane, autonomous agents, pipelines, curating review queues, adaptive hybrid retrieval engine, and enterprise MCP server. 

**Milestone 5 brings this entire intelligent substrate to life for human operators and executives across four cohesive surface areas:**

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               SMARTSAPP OPERATOR SURFACES                              │
├──────────────────────────┬──────────────────────────┬──────────────────────────────────┤
│ 1. MEETING OPERATOR HUB  │ 2. KNOWLEDGE INBOX & RAG │ 3. VISUAL GRAPH & EXPLORER       │
│    (/admin/meetings/[id])│    (/admin/intelligence/ │    (/admin/intelligence/         │
│                          │     knowledge/inbox)     │     knowledge/graph)             │
│ • Meeting Brief Card     │ • Triage Stream (10 types│ • Interactive SVG Graph Canvas   │
│ • Interactive AI Timeline│ • Swipe Right (Accept)   │ • Rule 55 Limits (≤80n, ≤150e)   │
│ • Post-Meeting Execution │ • Swipe Left (Reject)    │ • 3 Modes: Explore/Explain/      │
│   - Tasks (L1 origin)    │ • Inspector Side Drawer  │   Investigate                    │
│   - CRM Proposals (L2)   │ • Global ⌘⇧K Search      │ • Focus, Expand & Command Menu   │
│   - Follow-up Drafts (L3)│   - Grounded Answer Card │                                  │
│                          │   - Evidence Stack Stack │                                  │
├──────────────────────────┴──────────────────────────┴──────────────────────────────────┤
│ 4. BACKOFFICE CONTROL PLANE & SECURITY COMMAND CENTER                                  │
│    (/admin/intelligence/governance)                                                    │
│ • Ingestion Queue & Meeting Pipeline DLQ with "Reprocess" Action                       │
│ • 4-Tier Feature Flags: FF_MEETING_AGENT, FF_KNOWLEDGE_AGENT, FF_KNOWLEDGE_AUTO_ACCEPT, │
│   FF_MEETING_TRANSCRIPTION (Global, Org, Workspace)                                    │
│ • Policy Editor: Quotas, Cost Ceilings, Retention, Allowed Models, Auto-Accept Slider │
│ • Security Feeds (Rule 62): Injections, Poisoning, Consent Refusals, Egress Blocks     │
│ • Emergency Kill Switches (Rule 60): Disable Agent / Capability / Model / Global Switch│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Invariant Rules & Strict Conformance Guidelines

| Rule | Title | Milestone 5 Conformance Strategy |
| :--- | :--- | :--- |
| **Rule 1** | Professional Plan & Tracking | Structured TDD plan with checkbox tasks (`- [ ]`), acceptance criteria, file targets, and verification evidence. |
| **Rule 2** | What Could Go Wrong & Git Rules | Edge-case catalogue (§9.2), risk register (§9.1). All commits stay local until user explicitly requests push. Never run `pnpm typecheck` or `lint` locally; run targeted Vitest test suites. |
| **Rule 3** | Affected Features & Backoffice | Backoffice management without code (§10.2). Pause, policy, reprocess, and kill switches operable from UI. |
| **Rule 4** | Zero `any` or `any[]` | 100% strict TypeScript types and Zod v4 schemas across all components, hooks, and Server Actions. |
| **Rule 7** | Mobile-First & Micro-Interactions | Minimum 44px touch targets (`min-h-[44px]`), swipe gestures (accept/reject), Emil Kowalski mechanical feel (`active:scale-[0.97]`), responsive at 375px, 768px, and 1280px. |
| **Rule 8 & 47** | Multi-Tenant Anti-IDOR | All Server Actions assert tenant boundary (`assertTenantAccess`) failing closed on organization or workspace mismatch. |
| **Rule 10** | Guiding Comments | Every file has `@fileOverview` detailing purpose, governing rules, caution areas, and test pointers. |
| **Rule 13 & 30** | XML Isolation & Anti-Poisoning | Untrusted customer notes, external emails, and transcript excerpts wrapped in `<untrusted_reference_data id="...">` containers before UI rendering. |
| **Rule 16 & 17** | Non-Delegable Actions | Deciding Knowledge Inbox items, approving CRM proposals, and sending external communications are strictly non-delegable to agents (human operators only). |
| **Rule 18** | TOCTOU Concurrency Guards | Candidate decisions and memory supersession check `expectedVersion` / `updatedAt` to prevent concurrent overwrite. |
| **Rule 21 & 22** | Two-Phase Approval Binding | Mutating CRM updates route through two-phase proposal bridge (`CrmProposalModal`) with canonical SHA-256 `payloadHash` verification. |
| **Rule 26** | Cooperative Cancellation | In-flight searches, graph traversals, and meeting reprocess jobs support native `AbortSignal`. |
| **Rule 27** | Reverse-LIFO Saga Compensation | Tasks created from meetings carry `origin: 'meeting'` and support single-click undo (`meeting.undo_followup_task`). |
| **Rule 28 & 56** | Context Budgeting & Compression | Knowledge search results clearly show "Found N items, using M in context" with token budget badges. |
| **Rule 29** | Immutable Fact Supersession | Knowledge item invalidation updates `validUntil` and links `supersededBy`; history is preserved. |
| **Rule 32 & 33** | Exfiltration & Egress Control | Follow-up drafts bound to meeting attendees and verified contacts. Sending external messages requires explicit human confirmation. |
| **Rule 40** | Immutable Audit Ledger | All operator triage actions (`accept`, `reject`, `edit`, `supersede`, `kill_switch`) emit immutable domain events via `defaultEventBus`. |
| **Rule 41** | "Why did you do this?" Explainability | Meeting proposals, candidates, and graph connections include transparent WHAT / WHY / EVIDENCE / BLAST RADIUS cards. |
| **Rule 42** | Shadow Mode Telemetry | Backoffice displays real-time Shadow Mode metrics (precision $\ge 0.95$, leak rate $0.00\%$, zero live mutations). |
| **Rule 47** | Grounded Answer Contract | Grounded answer cards in ⌘⇧K search require supporting citation spans; uncited claims are dropped. |
| **Rule 49** | Public Isolation | All knowledge and meeting surfaces require authenticated session; zero public access. |
| **Rule 50** | Multi-Tenant Cache Isolation | In-memory UI caches partitioned strictly by `${orgId}:${workspaceId}:${userId}` with bounded TTL. |
| **Rule 51** | Next.js Server Actions Gate | `'use server'`, `requireAuth()`, workspace membership check, and dead-man pause evaluation in every action. |
| **Rule 54** | Performance Budgets | Knowledge search p95 $< 1.5$s; virtualized candidate lists for $> 50$ rows; zero UI jank. |
| **Rule 55** | Graph Canvas Limits | Strictly bounded to $\le 80$ visible nodes, $\le 150$ edges, and expand depth $\le 2$. |
| **Rule 60** | Emergency Dead-Man Switch | Backoffice kill switches instantly disable agents, capabilities, or models; evaluated in all actions. |
| **Rule 61** | Backoffice Control Plane | Full operational control without code changes. |
| **Rule 62** | Security Command Center Feeds | Live real-time feeds of injection attempts, poisoning flags, consent refusals, and IDOR denials. |
| **Rule 64** | 3-Tier Feature Flags | `FF_MEETING_AGENT`, `FF_KNOWLEDGE_AGENT`, `FF_KNOWLEDGE_AUTO_ACCEPT`, `FF_MEETING_TRANSCRIPTION` at global, org, and workspace tiers. |
| **Rule 67** | Implementation Gate | Architecture, authority, data, execution, MCP, failure, security, operations, testing, migration checklist. |
| **Rule 68** | Five Non-Negotiables | Model not the boundary; tool output untrusted; mutations idempotent/version-checked; bounded resources; operable without code. |
| **Rule 69** | Strangler Fig Invariant | 100% preservation of all existing routes (`/admin/meetings`, `/admin/quick-notes`, `/admin/quick-notes/graph`). |
| **Theme §8** | Standardized Modal Architecture | Demarcated header, single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`, zero raw descriptions, demarcated footer with `rounded-xl active:scale-[0.97]` buttons. |

---

## 3. Functionality Preservation Guarantees (Rule 69 Strangler Invariant)

1. **Preexisting Meeting Details (`/admin/meetings/[id]`):**
   - The existing 9 tabs (`overview`, `participants`, `registrants`, `facilitators`, `results`, `feedback`, `compliance`, `crm`, `intelligence`) remain 100% intact.
   - The new Meeting Brief Card and AI Timeline seamlessly enhance the `intelligence` tab and detail header without breaking existing session management or video recordings.
2. **Preexisting Quick Notes & Brain (`/admin/quick-notes` & `/admin/brain`):**
   - Retained with zero regressions; users can continue using Quick Notes and legacy search.
   - New Knowledge Inbox (`/admin/intelligence/knowledge/inbox`) and Knowledge Graph (`/admin/intelligence/knowledge/graph`) offer modern, governed enterprise surfaces while maintaining legacy backward-compatible redirect shims.
3. **Approvals Desk (`/admin/intelligence/approvals`):**
   - Preexisting CRM and SDR proposal workflows remain untouched; meeting CRM proposals seamlessly integrate into the unified proposal queue.
4. **Command Bar ⌘K:**
   - ⌘K omni-bar behavior remains unchanged, while `⌘Shift+K` introduces the dedicated multi-modal Knowledge Search Modal with evidence stacks.

---

## 4. Detailed Task Breakdown & Implementation Steps

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 11 MILESTONE 5 EXECUTION ROADMAP                          │
├─────────────┬──────────────────────────────────────────────────────────┬───────────────┤
│ Task ID     │ Scope & Deliverable                                      │ Primary Rules │
├─────────────┼──────────────────────────────────────────────────────────┼───────────────┤
│ P11-M5-T0   │ UI Types, Zod v4 Schemas & Server Action Contracts       │ 4, 10, 48, 51 │
├─────────────┼──────────────────────────────────────────────────────────┼───────────────┤
│ P11-M5-T1   │ Meeting Brief, AI Timeline & Post-Meeting Execution      │ 7, 13, 21, 27 │
├─────────────┼──────────────────────────────────────────────────────────┼───────────────┤
│ P11-M5-T2   │ Knowledge Inbox, Item Inspector & Swipe Triage           │ 7, 17, 18, 30 │
├─────────────┼──────────────────────────────────────────────────────────┼───────────────┤
│ P11-M5-T3   │ Global ⌘⇧K Knowledge Search Modal & Evidence Stack       │ 7, 28, 47, 56 │
├─────────────┼──────────────────────────────────────────────────────────┼───────────────┤
│ P11-M5-T4   │ Visual Knowledge Graph Explorer (Rule 55 Limits & Modes) │ 7, 55, 69     │
├─────────────┼──────────────────────────────────────────────────────────┼───────────────┤
│ P11-M5-T5   │ Backoffice Knowledge, Meeting & Security Control Plane   │ 3, 60, 61, 62 │
├─────────────┼──────────────────────────────────────────────────────────┼───────────────┤
│ P11-M5-T6   │ Navigation Unification & Strangler Fig Redirects         │ 69            │
├─────────────┼──────────────────────────────────────────────────────────┼───────────────┤
│ P11-M5-T7   │ Verification Battery, Mobile Viewports & Completion Rep. │ 1, 2, 7, 67   │
└─────────────┴──────────────────────────────────────────────────────────┴───────────────┘
```

---

### Task P11-M5-T0: UI Types, Zod v4 Schemas & Server Action Contracts
**Objective:** Define strictly typed contracts and Server Action envelopes for all Milestone 5 surfaces with zero `any` or `any[]` (Rule 4).

- [ ] **Step 0.1: Author Knowledge UI Types & Schemas**
  - **File:** `src/platform/domains/knowledge_memory/contracts/knowledge-ui-types.ts`
  - Define Zod v4 schemas & inferred types:
    - `KnowledgeInboxFilterSchema` (status, itemType, sourceTrust, confidenceRange, timeRange, search).
    - `KnowledgeCandidateTriageInputSchema` (candidateId, decision: `accept` | `reject` | `edit`, expectedVersion, editPayload).
    - `BatchTriageInputSchema` (candidateIds, decision, expectedVersions).
    - `KnowledgeSearchModalInputSchema` (query, filters, limit).
    - `GraphExplorerStateSchema` (centerNodeId, mode: `explore` | `explain` | `investigate`, visibleNodeIds, depth, filters).
    - `BackofficeGovernanceConfigSchema` (autoAcceptThreshold, quotas, costCeilingUsd, retentionDays, allowedModels, killSwitches).
    - `SecurityIncidentFeedItemSchema` (incidentId, eventType, severity, sourceId, tenantId, timestamp, metadata).

- [ ] **Step 0.2: Author Backoffice Governance Server Actions**
  - **File:** `src/app/actions/knowledge-governance-actions.ts`
  - Implement actions protected by `'use server'`, `requireAuth()`, `assertTenantAccess`, and `checkGovernanceDeadManSwitch`:
    - `getKnowledgeGovernanceMetricsAction`: retrieves candidate counts, conflict counts, graph metrics, and incident rates.
    - `updateKnowledgeGovernanceConfigAction`: updates auto-accept policies, quotas, and retention rules.
    - `setKnowledgeKillSwitchAction`: toggles agent, capability, model, or global dead-man kill switch (Rule 60).
    - `reprocessMeetingPipelineAction`: reprocesses failed meeting runs from DLQ.
    - `purgeKnowledgeBySourceAction`: cascades GDPR retention purge across transcripts, candidates, memory objects, embeddings, and graph edges (Rule 57).

- [ ] **Step 0.3: Unit Tests for UI Contracts & Actions**
  - **File:** `src/platform/__tests__/knowledge/knowledge-ui-contracts.test.ts`
  - Verify Zod parsing, input validation, and Server Action security boundaries.

---

### Task P11-M5-T1: Meeting Brief, AI Timeline & Post-Meeting Execution Panel
**Objective:** Deliver the complete operator experience for meeting intelligence in `/admin/meetings/[id]`.

- [ ] **Step 1.1: Author Meeting AI Timeline Feed**
  - **File:** `src/app/admin/meetings/[id]/components/MeetingAiTimeline.tsx`
  - Features:
    - Chronological list of speech segments and AI events.
    - Speaker avatar pills and sentiment chips.
    - Key moment tags (`DECISION`, `COMMITMENT`, `OBJECTION`, `QUESTION`, `DEAL_STAGE`).
    - Click-to-seek: clicking a timestamp jumps audio player/transcript viewer to the exact second.
    - Mobile-first vertical timeline layout.

- [ ] **Step 1.2: Polish Meeting Brief Card**
  - **File:** `src/app/admin/meetings/[id]/components/outcomes/MeetingBriefCard.tsx`
  - Features:
    - Pre-meeting preparation dossier: attendees history, open commitments, likely objectives, anticipated objections, suggested discovery questions, and recommended strategy.
    - Grounding confidence indicator and token budget indicator.
    - Containerized reference citations inside `<untrusted_reference_data id="...">` (Rule 13 & 30).
    - Single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`.

- [ ] **Step 1.3: Enhance Post-Meeting Execution Panel**
  - **File:** `src/app/admin/meetings/[id]/components/outcomes/MeetingOutcomesPanel.tsx`
  - Integrations:
    - **Tasks Section:** lists extracted action items; one-click "Create Task" (L1 autonomous with `origin: 'meeting'`), with single-click Undo (`meeting.undo_followup_task`, Rule 27).
    - **CRM Proposals Section:** lists detected deal stage changes; "Propose Update" triggers `CrmProposalModal` with two-phase SHA-256 binding (Rules 21, 22).
    - **Follow-up Drafts Section:** lists generated follow-up emails/messages; "Review Draft" opens `DraftSheet.tsx` with recipient validation (attendees/contacts only, Rules 32, 33) and `FieldsVariablesService` template rendering.
    - Non-delegable send button: explicit human confirmation required to transmit.

- [ ] **Step 1.4: Unit & Viewport Tests for Meeting Surfaces**
  - **File:** `src/platform/__tests__/ui/meeting-operator-surfaces.test.tsx`
  - Verify rendering, task creation, undo compensation, proposal trigger, and responsive layouts at 375px, 768px, and 1280px.

---

### Task P11-M5-T2: Knowledge Inbox, Item Inspector & Swipe Triage
**Objective:** Build the intelligent triage inbox for newly extracted knowledge candidates with mobile gestures and non-delegable human decision gates.

- [ ] **Step 2.1: Build Knowledge Inbox Surface & Client**
  - **Files:** `src/app/admin/intelligence/knowledge/inbox/page.tsx`, `KnowledgeInboxClient.tsx`
  - Features:
    - Three-Zone layout conforming to `theme.md` §8.
    - Status tabs: `[All]`, `[Needs review]`, `[Important]`, `[Conflicts]`, `[Saved]`.
    - 10 canonical item types: Fact, Relationship, Decision, Commitment, Preference, Procedure, Conflict, Duplicate, Sensitive, Low-Confidence.
    - Filter toolbar: Source type (`meeting`, `note`, `crm`, `document`), confidence slider, date range.
    - Batch selection: "Accept all selected", "Reject selected".
    - Real-time reactivity via `useEventStream` subscribing to `knowledge.candidate.*` (Rule 62).
    - Meaningful empty state (PRD §51): informative guidance with one primary action, never blank.

- [ ] **Step 2.2: Upgrade Knowledge Candidate Card with Swipe Gestures**
  - **File:** `src/components/knowledge/KnowledgeCandidateCard.tsx`
  - Features:
    - Fact title, statement excerpt, source trust pill (`internal` | `customer` | `external`), confidence badge.
    - Suggested entities and relationship chips.
    - Mobile gestures: swipe right to accept, swipe left to reject, with visual reveal feedback and undo toast (`actionConfig.path`, Rule 7).
    - Emil Kowalski tactile buttons: `Accept`, `Accept all similar`, `Edit`, `Reject`.
    - Human-only non-delegable gate (Rule 17).

- [ ] **Step 2.3: Upgrade Knowledge Item Inspector Side Drawer**
  - **File:** `src/components/knowledge/KnowledgeItemInspector.tsx`
  - Adherence to `theme.md` §8:
    - `<DialogHeader demarcated>` with single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`.
    - `<DialogDescription className="sr-only">`.
    - Demarcated footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5` with tactile buttons (`rounded-xl active:scale-[0.97]`).
    - 4 tabbed panels:
      - `Overview`: Statement, type, source, confidence, validity dates.
      - `Evidence & Provenance`: Transcript/note excerpt containerized in `<untrusted_reference_data id="...">` (Rules 13 & 30).
      - `Relationships`: Connected graph nodes and edges.
      - `Audit & Lineage`: Version history, immutable audit log, and consumer telemetry ("Used by 3 agents, 2 workflows").
    - Actions: `Edit Item`, `Invalidate / Supersede` (`memory.supersede` with TOCTOU `expectedVersion` check, Rule 18 & 29).

- [ ] **Step 2.4: Unit & Gesture Tests for Knowledge Inbox**
  - **File:** `src/platform/__tests__/ui/knowledge-inbox.test.tsx`
  - Verify triage actions, swipe handlers, inspector drawer, empty states, and TOCTOU optimistic locking.

---

### Task P11-M5-T3: Global ⌘⇧K Knowledge Search Modal & Evidence Stack
**Objective:** Deliver the global `⌘Shift+K` contextual knowledge search modal with Rule 47 evidence stacks.

- [ ] **Step 3.1: Build KnowledgeSearchModal Component**
  - **File:** `src/components/knowledge/KnowledgeSearchModal.tsx`
  - Features:
    - Global keyboard shortcut: `⌘Shift+K` (Mac) / `Ctrl+Shift+K` (Windows/Linux).
    - Multimodal search bar with debounced query dispatching to `askKnowledgeAgentAction` and `searchKnowledgeHybridAction`.
    - Filter chips: All, Meetings, CRM, Notes, Verified Only.
    - Knapsack context budgeting indicator: "Found 14 items · Using 5 in grounded answer (4,200 tokens)" (Rule 28 & 56).
    - Standardized Modal Architecture (`theme.md` §8): demarcated header, single-circle tooltip, zero raw descriptions.

- [ ] **Step 3.2: Build Evidence Stack Card**
  - **File:** `src/components/knowledge/KnowledgeEvidenceStack.tsx`
  - Features:
    - Grounded Answer Section: Synthesized text with inline interactive citation chips (`[1]`, `[2]`).
    - Evidence Section: Expandable cards showing source title, timestamp, excerpt in `<untrusted_reference_data id="...">`, and confidence score.
    - Conflict Banner: Highlights contradictory facts if detected by `KnowledgeAgentService`.
    - Action Bar: `Open in Knowledge Graph`, `Open Source Document`, `Create Task from Insight`.
    - Fallback: Clean `no_evidence` card without speculative hallucination (Rule 47).

- [ ] **Step 3.3: Register Global Shortcut in Layout**
  - **File:** `src/app/admin/layout-client.tsx`
  - Mount `KnowledgeSearchModal` and global keyboard listener `⌘Shift+K`.

- [ ] **Step 3.4: Unit Tests for ⌘⇧K Search & Evidence Stack**
  - **File:** `src/platform/__tests__/ui/knowledge-search-modal.test.tsx`
  - Verify shortcut trigger, query dispatch, citation navigation, conflict display, and empty evidence handling.

---

### Task P11-M5-T4: Visual Knowledge Graph Explorer (Rule 55 Limits & Modes)
**Objective:** Build the interactive SVG knowledge graph exploration surface adhering strictly to Rule 55 limits ($\le 80$ nodes, $\le 150$ edges).

- [ ] **Step 4.1: Build Knowledge Graph Canvas & Controls**
  - **Files:** `src/app/admin/intelligence/knowledge/graph/page.tsx`, `KnowledgeGraphClient.tsx`
  - Features:
    - SVG interactive canvas with pan, zoom, and force-directed node positioning.
    - Strict Rule 55 limits: Maximum 80 visible nodes, 150 edges, expand depth $\le 2$.
    - Visible node limit banner: "Showing most relevant 80 of N nodes · Bounded for performance" (Rule 55).
    - Filter toolbar: Entity type chips (School, Contact, Deal, Meeting, Preference, Task), Relation filter, Minimum confidence slider (0.0 to 1.0).

- [ ] **Step 4.2: Implement 3 Graph Modes (PRD §18)**
  - **File:** `src/components/knowledge/graph/KnowledgeGraphToolbar.tsx`
  - Modes:
    1. `Explore`: Manual pan/zoom, node clicking, neighborhood expansion.
    2. `Explain`: Clicking two nodes prompts AI ("Why is Greenfield School connected to Annual Billing?") and highlights the shortest connecting path.
    3. `Investigate`: Agent traverses connected subgraphs and returns Hypothesis, Evidence, and Recommended Next Steps in a side drawer.

- [ ] **Step 4.3: Node Context Menu & Quick Inspector**
  - **File:** `src/components/knowledge/graph/KnowledgeNodeContextMenu.tsx`
  - Actions on node right-click:
    - `Ask AI About Node` (opens ⌘K with entity context).
    - `Open in CRM / Detail Page`.
    - `Expand Neighborhood` (clamped to $\le 80$ nodes).
    - `Add to Review Queue`.

- [ ] **Step 4.4: Unit Tests for Knowledge Graph Explorer**
  - **File:** `src/platform/__tests__/ui/knowledge-graph-explorer.test.tsx`
  - Verify node clamping $\le 80$, edge clamping $\le 150$, mode toggles, path highlighting, and context menu.

---

### Task P11-M5-T5: Backoffice Knowledge, Meeting & Security Control Plane (§10.2 & Rules 60–64)
**Objective:** Implement the operational backoffice control plane operable without code deployments.

- [ ] **Step 5.1: Build Backoffice Governance Mission Control**
  - **Files:** `src/app/admin/intelligence/governance/page.tsx`, `KnowledgeGovernanceClient.tsx`
  - Layout & Zones:
    - **Zone 1: Executive Telemetry & Quota Status:** Active pipelines, memory objects count, graph density, daily transcription quota usage, and cost meter.
    - **Zone 2: Meeting Pipeline Queue & DLQ Monitor:** List of active/stalled ingestion jobs with single-click "Reprocess" action (Rule 25).
    - **Zone 3: Security Command Center Feeds (Rule 62):** Live real-time stream of detected prompt injection attempts, knowledge poisoning flags, consent refusals, and cross-workspace access denials.

- [ ] **Step 5.2: Build Backoffice Policy & Feature Flag Editor**
  - **File:** `src/components/knowledge/governance/PolicyConfigPanel.tsx`
  - Controls:
    - **4 Canonical Feature Flags (Rule 64):** `FF_MEETING_AGENT`, `FF_KNOWLEDGE_AGENT`, `FF_KNOWLEDGE_AUTO_ACCEPT`, `FF_MEETING_TRANSCRIPTION` with Global, Org, and Workspace toggles.
    - **Auto-Accept Policy Slider:** Threshold slider (default OFF, requires confidence $\ge 0.9$, sourceTrust=internal, no conflicts, no sensitive tags).
    - **Quota & Cost Ceilings:** Editable max daily transcriptions, token ceilings, and budget caps.
    - **Retention Cascade:** Configure auto-purge days per dataClass (`transcripts`, `candidates`, `memory_objects`).

- [ ] **Step 5.3: Build Emergency Dead-Man Switch Panel (Rule 60)**
  - **File:** `src/components/knowledge/governance/DeadManSwitchPanel.tsx`
  - Kill Switches:
    - `Disable Meeting Agent`
    - `Disable Knowledge Agent`
    - `Disable Hybrid Retrieval Capability`
    - `Block All Follow-Up Drafts`
    - `GLOBAL EMERGENCY HALT ("Disable Autonomous Execution")`
  - Requires double-confirmation dialog adhering to `theme.md` §8.

- [ ] **Step 5.4: Unit Tests for Backoffice Governance & Kill Switches**
  - **File:** `src/platform/__tests__/ui/knowledge-governance.test.tsx`
  - Verify policy updates, DLQ reprocess trigger, kill switch activation, and dead-man pause enforcement.

---

### Task P11-M5-T6: Navigation Unification & Strangler Fig Redirects (Rule 69)
**Objective:** Update sidebar navigation and author backward-compatible Strangler Fig redirects.

- [ ] **Step 6.1: Update AdminSidebar Navigation**
  - **File:** `src/app/admin/components/AdminSidebar.tsx`
  - Under `INTELLIGENCE` group:
    - Add `Knowledge Inbox` (`/admin/intelligence/knowledge/inbox`) with live unread badge.
    - Add `Knowledge Graph` (`/admin/intelligence/knowledge/graph`).
    - Add `Governance & Control` (`/admin/intelligence/governance`).
  - Preserve all 52 preexisting route items and access permissions (`can(...)`).

- [ ] **Step 6.2: Strangler Fig Backwards-Compatible Redirects**
  - **Files:**
    - `src/app/intelligence/knowledge/inbox/page.tsx` $\to$ redirect to `/admin/intelligence/knowledge/inbox`.
    - `src/app/intelligence/knowledge-graph/page.tsx` $\to$ redirect to `/admin/intelligence/knowledge/graph`.
    - `src/app/admin/quick-notes/inbox/page.tsx` $\to$ redirect to `/admin/intelligence/knowledge/inbox`.

- [ ] **Step 6.3: Navigation & Redirect Tests**
  - **File:** `src/platform/__tests__/ui/knowledge-navigation.test.tsx`
  - Verify sidebar links, badge counts, permission visibility, and redirect headers.

---

### Task P11-M5-T7: Verification Battery, Mobile Viewports & Completion Report
**Objective:** Execute the full UI and integration verification battery, mobile audits, and author the milestone completion report.

- [ ] **Step 7.1: Full Vitest UI Battery**
  - Run all UI test suites:
    - `knowledge-ui-contracts.test.ts`
    - `meeting-operator-surfaces.test.tsx`
    - `knowledge-inbox.test.tsx`
    - `knowledge-search-modal.test.tsx`
    - `knowledge-graph-explorer.test.tsx`
    - `knowledge-governance.test.tsx`
    - `knowledge-navigation.test.tsx`
  - Target: 100% pass rate.

- [ ] **Step 7.2: Mobile Viewport & Accessibility Verification (Rule 7)**
  - Verify touch targets $\ge 44$px (`min-h-[44px]`).
  - Verify layouts across 375px (mobile), 768px (tablet), and 1280px (desktop).
  - Verify screen-reader labels and zero raw description clutter (`theme.md` §8).

- [ ] **Step 7.3: Rule 67 Agent Implementation Gate Verification**
  - Complete all 10 architectural gate checks (Architecture, Authority, Data, Execution, MCP, Failure, Security, Operations, Testing, Migration).

- [ ] **Step 7.4: Author Milestone 5 Completion Report**
  - **File:** `docs/agents_mcp/phases/agents_mcp_phase_11_milestone_5_completion_report.md`
  - Document deliverables, verification metrics, rule compliance matrix, and readiness for Milestone 6 ("Verification, Release & Hardening").

---

## 5. Risk Register & Failure Matrix (Rule 2)

| Failure Mode / Edge Case | Likelihood / Impact | Mitigation & Expected System Behavior |
| :--- | :--- | :--- |
| **Operator accidentally accepts poisoned candidate** | Low / High | Candidate cards clearly highlight external source trust and adversarial directives. Even if accepted, immutable audit ledger allows single-click purge by source (`purgeKnowledgeBySourceAction`). |
| **Graph traversal explodes on large accounts** | Med / Med | Rule 55 strict clamping: $\le 80$ nodes, $\le 150$ edges, depth $\le 2$. UI renders "Showing most relevant 80 of N" warning banner. |
| **User on slow mobile network (high latency)** | High / Low | Skeletons rendered immediately; streaming partial synthesis for grounded answers; optimistic swipe transitions with undo rollback. |
| **Emergency dead-man switch engaged** | Low / Critical | UI displays persistent amber alert banner; all triage and search mutations disable gracefully with informative toast: "Autonomous execution is currently paused by platform administrators." |
| **Concurrent candidate triage (TOCTOU)** | Med / Low | Optimistic locking via `expectedVersion`; second operator receives clear toast: "This candidate was already reviewed by another operator. Refreshing queue." |
| **Small mobile screen touch collisions** | Med / Low | All interactive cards, swipe triggers, and buttons strictly enforce $\ge 44$px touch targets with Emil Kowalski mechanical spacing. |

---

## 6. Verification & Definition of Done (DoD)

To declare Milestone 5 complete:
1. **Zero `any` or `any[]` (Rule 4):** Strictly enforced across all new components, actions, and test files.
2. **Standardized Modal Architecture (`theme.md` §8):** All dialogs, drawers, and sheets use `<DialogHeader demarcated>`, `<DialogDescription className="sr-only">`, single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`, and demarcated footers with tactile `rounded-xl active:scale-[0.97]` buttons.
3. **100% Test Pass Rate:** All newly authored Vitest UI test files pass 100%.
4. **Platform Regression Safety (Rule 69):** Preexisting meeting details, Quick Notes, approvals, and CRM views continue functioning with zero regressions.
5. **No Local `npm run build`:** Local verification uses targeted Vitest test suites only. Remote CI on `main` acts as the build gate.
6. **No Unrequested Git Push:** All commits remain local until explicitly requested by the user.
