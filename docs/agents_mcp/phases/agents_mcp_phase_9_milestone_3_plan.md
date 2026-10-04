# Phase 9 Milestone 3: CRM AI Overview, Knowledge Panel & In-Context Intelligence Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the agent-native CRM redesign specified in `docs/agents_mcp/agents_mcp_ui.md` (§ 30–35 & Phase 9 CRM redesign: Contact AI Overview, Knowledge, Recommendations, Deal Intelligence, Meeting Brief), embedded directly into existing entity and deal pages without breaking existing functionality (Rule 69 Strangler Fig).

**Architecture:** Build canonical CRM intelligence domain contracts and a pure synthesis service in `src/platform/agents/crm/intelligence/` that consumes `Account360Context` from Milestone 1 and evaluates deterministic heuristics + AI grounding. Expose 5 strictly typed Server Actions in `src/app/actions/crm-agent-actions.ts` with Clerk session auth, Anti-IDOR validation, dead-man switch evaluation, and domain event publishing. Create modular, accessible, mobile-first UI components adhering to `theme.md` §8 and embed them smoothly into `/admin/entities/[id]` and `/admin/deals/[id]`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (zero `any`/`any[]`), Zod v4, Lucide React, Tailwind CSS, Firestore Admin SDK, Vitest.

---

## Master Rules & Governance Mapping

| Rule # | Requirement | Architectural Enforcement in Milestone 3 |
|---|---|---|
| **Rule 4** | Zero `any` or `any[]` | 100% strict TypeScript types across all schemas, server actions, and UI props. |
| **Rule 7** | Mobile-First & Touch Targets | Touch targets $\ge 44\text{px}$ (`min-h-[44px]`), plain English copywriting, Emil Kowalski tactile clicks (`active:scale-[0.97]`). |
| **Rule 8 & 47** | Multi-Tenant Anti-IDOR | All actions enforce caller session `organizationId` matching requested workspace/entity boundaries. |
| **Rule 10** | Zod Schema Validation | All contracts validated using Zod v4 (`zod/v4`). |
| **Rule 12** | Risk Ceilings | Pure intelligence surfaces operate at `L0_READ`; mutating next-best-actions require explicit operator confirmation. |
| **Rule 13 & 30** | Untrusted Input & XML Isolation | Third-party notes, meeting transcripts, and citations wrapped in `<untrusted_reference_data id="...">` containers. |
| **Rule 21 & 22** | HITL & Tamper-Proof Proposals | Actionable recommendation triggers integrate with proposal bridge and generate SHA-256 payload hashes. |
| **Rule 28 & 56** | Knapsack Token Ceilings | Context payloads restricted strictly $\le 4,000$ tokens. |
| **Rule 40** | Audit Event Trail | Publishes `crm.intelligence.overview_viewed`, `crm.intelligence.deal_analyzed`, `crm.intelligence.meeting_briefed`. |
| **Rule 41** | Explainability Grid | Every recommendation contains explicit WHAT, WHY, and IMPACT dimensions. |
| **Rule 60** | Emergency Dead-Man Switch | `checkGovernanceDeadManSwitch` halts actions with `CRM_DEAD_MAN_PAUSED` when paused. |
| **Rule 69** | Strangler Fig Invariant | Zero regressions on existing entity and deal pages; dual-tier CRM model preserved (`/entities` vs `/workspace_entities`). |
| **`theme.md` §8** | Standardized Modal & Dialog System | Surface geometry `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`, demarcated header/footer, single-circle info tooltip at `z-[10050]`. |

---

## File Decomposition & Responsibility Map

```text
src/
├── platform/
│   └── agents/
│       └── crm/
│           ├── intelligence/
│           │   ├── crm-intelligence-types.ts      # Canonical Zod v4 schemas & error taxonomy
│           │   ├── crm-intelligence-service.ts    # Pure deterministic synthesis & health scoring algorithms
│           │   └── index.ts                       # Public barrel export
│           └── index.ts                           # Augmented with intelligence exports
├── app/
│   ├── actions/
│   │   └── crm-agent-actions.ts                   # 5 Next.js Server Actions with Anti-IDOR & Dead-Man
│   └── admin/
│       ├── entities/
│       │   ├── [id]/page.tsx                      # Enhanced with EntityAiOverviewSection (Strangler Fig)
│       │   └── components/
│       │       └── EntityAiOverviewSection.tsx    # Section wrapper embedding AI Overview, Knowledge, Recs
│       └── deals/
│           ├── [id]/page.tsx                      # Enhanced with DealIntelligenceCard (Strangler Fig)
│           └── [id]/components/
│               └── DealAiIntelligencePanel.tsx    # Enhanced to delegate to DealIntelligenceCard
├── components/
│   └── crm/
│       └── intelligence/
│           ├── AccountAiOverviewCard.tsx          # Executive summary, health gauge, momentum, signal carousel
│           ├── AccountKnowledgePanel.tsx          # Grounded facts list, citations, citation drawer
│           ├── AccountRecommendationsCard.tsx      # Next-Best-Action chips with explainability grid (Rule 41)
│           ├── DealIntelligenceCard.tsx           # Velocity meter, win probability, competitor objections, playbook
│           ├── MeetingBriefDrawer.tsx             # Pre-meeting briefing drawer (theme.md §8)
│           └── index.ts                           # Public barrel export
└── platform/
    └── __tests__/
        ├── agents/
        │   └── crm/
        │       ├── crm-intelligence-contracts.test.ts # Contract schemas & validation tests
        │       ├── crm-intelligence-service.test.ts   # Pure algorithms & scoring tests
        │       └── crm-agent-actions.test.ts          # Server actions, anti-IDOR, dead-man pause
        └── ui/
            ├── crm-ai-overview.test.tsx               # Account AI Overview & Knowledge UI tests
            ├── deal-intelligence.test.tsx             # Deal Intelligence & Recommendations UI tests
            └── crm-page-integration.test.tsx          # Strangler Fig regression tests for entity & deal pages
```

---

## Tasks Breakdown

### Task 1: Canonical CRM Intelligence Contracts & Error Taxonomy
**Files:**
- Create: `src/platform/agents/crm/intelligence/crm-intelligence-types.ts`
- Create: `src/platform/agents/crm/intelligence/index.ts`
- Test: `src/platform/__tests__/agents/crm/crm-intelligence-contracts.test.ts`

- [ ] **Step 1: Write the failing contract tests**
Author `src/platform/__tests__/agents/crm/crm-intelligence-contracts.test.ts` verifying Zod v4 validation, safe parsing, valid ranges for health scores (0–100), momentum enums, risk severities, recommendation explainability grids, and error codes.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/platform/__tests__/agents/crm/crm-intelligence-contracts.test.ts`
Expected: FAIL ("Cannot find module '@/platform/agents/crm/intelligence/crm-intelligence-types'").

- [ ] **Step 3: Implement `crm-intelligence-types.ts` and `index.ts`**
Author `crm-intelligence-types.ts` defining:
  - `AccountAiOverviewSchema` (`healthStatus`, `healthScore`, `executiveSummary`, `activeMomentum`, `keyRisks`, `stakeholders`, `recentSignals`).
  - `AccountKnowledgeSchema` (`groundedFacts`, `meetingTakeaways`, `citations`).
  - `AccountRecommendationsSchema` (`items` with `explainability: { what, why, impact }`).
  - `DealIntelligenceSchema` (`stageVelocity`, `winProbability`, `healthScore`, `healthCategory`, `stallRisk`, `buyingSignals`, `riskFactors`, `competitorAnalysis`, `recommendedPlaybook`).
  - `MeetingBriefSchema` (`attendees`, `relationshipSummary`, `openCommitments`, `likelyObjectives`, `potentialObjections`, `suggestedQuestions`, `recommendedStrategy`).
  - `CRM_INTELLIGENCE_ERROR_CODES` and `CrmIntelligenceError`.
  - Zero `any` or `any[]` (Rule 4).

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/platform/__tests__/agents/crm/crm-intelligence-contracts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
`git add src/platform/agents/crm/intelligence/ src/platform/__tests__/agents/crm/crm-intelligence-contracts.test.ts && git commit -m "feat(crm-agent): add canonical CRM intelligence contracts and error taxonomy"`

---

### Task 2: Core Domain Synthesis Engine (`crm-intelligence-service.ts`)
**Files:**
- Create: `src/platform/agents/crm/intelligence/crm-intelligence-service.ts`
- Modify: `src/platform/agents/crm/intelligence/index.ts`
- Modify: `src/platform/agents/crm/index.ts`
- Test: `src/platform/__tests__/agents/crm/crm-intelligence-service.test.ts`

- [ ] **Step 1: Write the failing service tests**
Author `src/platform/__tests__/agents/crm/crm-intelligence-service.test.ts` testing:
  - Health score computation based on recency, sentiment, overdue tasks, and invoice aging.
  - Health status categorization (`HEALTHY`, `ATTENTION_NEEDED`, `AT_RISK`, `DORMANT`).
  - Untrusted data XML containerization (`<untrusted_reference_data id="...">`) for citations and snippets.
  - Next-Best-Action synthesis with explainability grids.
  - Stage velocity calculation and win probability evaluation for deals.
  - Pre-meeting briefing synthesis.
  - Emergency dead-man switch evaluation (`checkGovernanceDeadManSwitch`).

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/platform/__tests__/agents/crm/crm-intelligence-service.test.ts`
Expected: FAIL ("Cannot find module '@/platform/agents/crm/intelligence/crm-intelligence-service'").

- [ ] **Step 3: Implement `crm-intelligence-service.ts`**
Author pure synthesis methods:
  - `synthesizeAccountAiOverview(context: Account360Context): AccountAiOverview`
  - `synthesizeAccountKnowledge(context: Account360Context): AccountKnowledge`
  - `synthesizeAccountRecommendations(context: Account360Context): AccountRecommendations`
  - `synthesizeDealIntelligence(deal: AccountDealSummary, context: Account360Context): DealIntelligence`
  - `synthesizeMeetingBrief(meeting: AccountMeetingSummary, context: Account360Context): MeetingBrief`
  - Export service singleton `getCrmIntelligenceService()`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/platform/__tests__/agents/crm/crm-intelligence-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
`git add src/platform/agents/crm/intelligence/ src/platform/agents/crm/index.ts src/platform/__tests__/agents/crm/crm-intelligence-service.test.ts && git commit -m "feat(crm-agent): implement CRM intelligence synthesis service"`

---

### Task 3: Secure Operator Server Actions (`crm-agent-actions.ts`)
**Files:**
- Create: `src/app/actions/crm-agent-actions.ts`
- Test: `src/platform/__tests__/agents/crm/crm-agent-actions.test.ts`

- [ ] **Step 1: Write the failing server action tests**
Author `src/platform/__tests__/agents/crm/crm-agent-actions.test.ts` testing:
  - Session auth verification (`requireAuth`).
  - Anti-IDOR tenant checks rejecting mismatched workspace/organization IDs.
  - Emergency dead-man switch rejection returning `CRM_DEAD_MAN_PAUSED`.
  - Calling `getAccount360Context` and invoking synthesis methods.
  - Publishing audit events via `defaultEventBus`.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/platform/__tests__/agents/crm/crm-agent-actions.test.ts`
Expected: FAIL ("Cannot find module '@/app/actions/crm-agent-actions'").

- [ ] **Step 3: Implement `crm-agent-actions.ts`**
Implement 5 Server Actions with `'use server'` (Rule 51):
  - `getAccountAiOverviewAction({ workspaceId, entityId })`
  - `getAccountKnowledgeAction({ workspaceId, entityId })`
  - `getAccountRecommendationsAction({ workspaceId, entityId })`
  - `getDealIntelligenceAction({ workspaceId, entityId, dealId })`
  - `getMeetingBriefAction({ workspaceId, entityId, meetingId })`

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/platform/__tests__/agents/crm/crm-agent-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
`git add src/app/actions/crm-agent-actions.ts src/platform/__tests__/agents/crm/crm-agent-actions.test.ts && git commit -m "feat(crm-agent): implement secure CRM intelligence server actions"`

---

### Task 4: Contact AI Overview & Account Knowledge Components
**Files:**
- Create: `src/components/crm/intelligence/AccountAiOverviewCard.tsx`
- Create: `src/components/crm/intelligence/AccountKnowledgePanel.tsx`
- Create: `src/components/crm/intelligence/index.ts`
- Test: `src/platform/__tests__/ui/crm-ai-overview.test.tsx`

- [ ] **Step 1: Write the failing component tests**
Author `src/platform/__tests__/ui/crm-ai-overview.test.tsx` rendering:
  - `AccountAiOverviewCard`: verifies health status badge, score meter, executive summary, stakeholder pills, signals carousel, info tooltip.
  - `AccountKnowledgePanel`: verifies grounded facts list, source chips, citation drawer slide-over with `<UntrustedReferenceData>`.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/platform/__tests__/ui/crm-ai-overview.test.tsx`
Expected: FAIL ("Cannot find module '@/components/crm/intelligence/AccountAiOverviewCard'").

- [ ] **Step 3: Implement `AccountAiOverviewCard.tsx` and `AccountKnowledgePanel.tsx`**
- Adhere strictly to `theme.md` §8 (demarcated header/footer, single-circle info tooltip at `z-[10050]`, zero raw descriptions, screen-reader support).
- Mobile-first touch targets $\ge 44\text{px}$ (`min-h-[44px]`).
- Untrusted text wrapped inside `<UntrustedReferenceData>`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/platform/__tests__/ui/crm-ai-overview.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
`git add src/components/crm/intelligence/ src/platform/__tests__/ui/crm-ai-overview.test.tsx && git commit -m "feat(crm-ui): add Account AI Overview card and Knowledge panel components"`

---

### Task 5: Account Recommendations & Deal Intelligence Cards
**Files:**
- Create: `src/components/crm/intelligence/AccountRecommendationsCard.tsx`
- Create: `src/components/crm/intelligence/DealIntelligenceCard.tsx`
- Create: `src/components/crm/intelligence/MeetingBriefDrawer.tsx`
- Modify: `src/components/crm/intelligence/index.ts`
- Test: `src/platform/__tests__/ui/deal-intelligence.test.tsx`

- [ ] **Step 1: Write the failing component tests**
Author `src/platform/__tests__/ui/deal-intelligence.test.tsx` testing:
  - `AccountRecommendationsCard`: verifies priority badges, Rule 41 explainability grid (WHAT, WHY, IMPACT), action trigger buttons.
  - `DealIntelligenceCard`: verifies stage velocity meter, win probability gauge, competitor objections, tactical playbook steps.
  - `MeetingBriefDrawer`: verifies attendee briefs, open commitments, suggested questions, and strategy.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/platform/__tests__/ui/deal-intelligence.test.tsx`
Expected: FAIL ("Cannot find module '@/components/crm/intelligence/AccountRecommendationsCard'").

- [ ] **Step 3: Implement `AccountRecommendationsCard.tsx`, `DealIntelligenceCard.tsx`, and `MeetingBriefDrawer.tsx`**
- Strictly typed props.
- Emil Kowalski tactile compression (`active:scale-[0.97]`).
- Modal/Drawer adherence to `theme.md` §8.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/platform/__tests__/ui/deal-intelligence.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
`git add src/components/crm/intelligence/ src/platform/__tests__/ui/deal-intelligence.test.tsx && git commit -m "feat(crm-ui): add Account Recommendations, Deal Intelligence, and Meeting Brief components"`

---

### Task 6: Surface Embeddings into Entity & Deal Pages (Rule 69 Strangler Invariant)
**Files:**
- Create: `src/app/admin/entities/components/EntityAiOverviewSection.tsx`
- Modify: `src/app/admin/entities/[id]/page.tsx`
- Modify: `src/app/admin/deals/[id]/components/DealAiIntelligencePanel.tsx`
- Modify: `src/app/admin/deals/[id]/page.tsx`
- Test: `src/platform/__tests__/ui/crm-page-integration.test.tsx`

- [ ] **Step 1: Write the failing page integration tests**
Author `src/platform/__tests__/ui/crm-page-integration.test.tsx` validating:
  - `EntityAiOverviewSection` loads overview, knowledge, and recommendations.
  - Existing entity tabs (`overview`, `deals`, `meetings`, `tasks`, etc.) remain 100% functional.
  - Deal intelligence card renders seamlessly inside deal workspace without displacing legacy components.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/platform/__tests__/ui/crm-page-integration.test.tsx`
Expected: FAIL ("Cannot find module '@/app/admin/entities/components/EntityAiOverviewSection'").

- [ ] **Step 3: Implement `EntityAiOverviewSection.tsx` and embed into pages**
- In `src/app/admin/entities/[id]/page.tsx`, mount `EntityAiOverviewSection` at the top of the entity page or inside the `overview` and `ai-context` tab flows.
- In `src/app/admin/deals/[id]/components/DealAiIntelligencePanel.tsx`, enhance the panel to render `DealIntelligenceCard`.
- Verify zero regressions on legacy functionality.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm vitest run src/platform/__tests__/ui/crm-page-integration.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification gates**
Run:
  - `pnpm vitest run src/platform/__tests__/agents/crm/`
  - `pnpm vitest run src/platform/__tests__/ui/`
  - `pnpm vitest run src/platform/__tests__/baseline/`
  - `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
  - `NODE_OPTIONS='--max-old-space-size=8192' pnpm lint`

- [ ] **Step 6: Commit**
`git add src/app/admin/entities/ src/app/admin/deals/ src/platform/__tests__/ui/crm-page-integration.test.tsx && git commit -m "feat(crm-page): embed CRM AI intelligence surfaces into entity and deal pages"`

---

## Verification Gates & Quality Checklist

- [ ] All 6 Tasks completed with dedicated unit and integration tests.
- [ ] Zero `any` or `any[]` across all files (Rule 4).
- [ ] Multi-tenant isolation verified: `organizationId` and `workspaceId` checks on all server actions (Rule 8 & 47).
- [ ] Untrusted inputs wrapped in `<untrusted_reference_data id="...">` containers (Rule 13 & 30).
- [ ] Emergency dead-man switch evaluation (`checkGovernanceDeadManSwitch`) verified (Rule 60).
- [ ] All touch targets $\ge 44\text{px}$ (`min-h-[44px]`) and tactile clicks (`active:scale-[0.97]`) verified (Rule 7).
- [ ] Modal/Drawer architecture adheres 100% to `theme.md` §8.
- [ ] Dual-tier CRM data model preserved (`entities` master vs `workspace_entities` operational layer) (Rule 69).
- [ ] Strangler Fig verified: 100% pass on baseline regression test suites.
- [ ] Clean TypeScript typecheck (`exit code 0`).
- [ ] Clean ESLint static analysis (`exit code 0`, warnings < 670 threshold, 0 errors).
- [ ] Code review completed with Senior Principal Systems & AI Agentic Architecture Reviewer.
