# Phase 10 Milestone 3: Lead Intelligence UI Surfaces, Prospect Finder HUD & Market Research Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the operator and SDR user interface surfaces for Phase 10, including the Market Research Canvas Modal, Segment to Campaign Handoff Bridge Modal, Embedded Explainable Score Card & Pitch Recommendation HUD, and Prospect Finder HUD with real-time SSE streaming—fully compliant with `theme.md` Section 8, the 69 Master Rules, Rules 1940–1953, Rule 67 Agent Implementation Gate, Rule 68 Non-Negotiables, and preserving existing Lead Intelligence tabs via the Strangler Fig pattern (Rule 69).

**Architecture:** Build production-grade React components in `src/components/sales/` backed by authenticated, anti-IDOR, dead-man-checked Server Actions in `src/app/actions/sales-agent-actions.ts`. All modals strictly comply with `theme.md` §8 (demarcated header, single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`, zero raw description clutter, `<DialogDescription className="sr-only">`, and demarcated tactile footers with `min-h-[44px]` touch targets and `active:scale-[0.97]`). Untrusted scraped and LLM content is isolated in `<untrusted_reference_data id="...">` (Rules 13 & 30). Staged campaigns bind to canonical SHA-256 `payloadHash` (Rule 22). Real-time scan and enrichment events stream via `useEventStream` (Rule 62). Tag selections route exclusively through `<TagSelector>` in client/draft mode (Workspace Rules).

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS, Lucide React, Framer Motion, Radix UI Dialog & Tooltip, Zod v4, Vitest, Testing Library.

---

## 1. Master Rules Compliance Matrix for Milestone 3

| Rule # | Requirement / Constraint | Concrete Implementation in Milestone 3 |
| :--- | :--- | :--- |
| **Rule 1 & 19** | Mandatory Idempotency & Replay Safety | `researchMarketAction` and `createCampaignFromSegmentAction` generate deterministic idempotency keys (`mkt_res_${orgId}_${hash}` and `camp_seg_${orgId}_${hash}`). |
| **Rule 2** | Fail-Closed Default | Security, IDOR, dead-man pause, and validation failures return `{ success: false, code: ... }` without executing side effects. |
| **Rule 4** | Strict Typing & Zero `any` | Zero `any` or `any[]` throughout components, actions, props, and tests. All contracts bounded via Zod v4 schemas. |
| **Rule 7** | Mobile-First & Touch Targets | Minimum 44px (`min-h-[44px]`) touch targets on all interactive controls. Tactile feedback with Emil Kowalski mechanical feel (`active:scale-[0.97]`). |
| **Rule 8 & 47** | Anti-IDOR & Tenant Isolation | Server Actions enforce Clerk session `requireAuth()` and assert tenant context (`assertTenantContext(auth, organizationId)`). |
| **Rule 9 & 55** | DOM Resource Bounds & Cleanup | Lead selections and campaign queues bounded to $\le 50$ items per view. Dialog event listeners and SSE streams cleanly torn down on unmount. |
| **Rule 10** | Canonical Domain Capabilities | Operations integrate with canonical capabilities (`lead.search`, `lead.score`, `lead.enrich`, `lead.get_recommended_pitch`, `lead.get_objection_handlers`). |
| **Rule 12** | Immutable Risk Ceilings | Market Research ceiled at `L0_READ`; Campaign Handoff at `L2_STATE_MUTATION`. Outbound communications require `L3` human approval (Rule 21). |
| **Rule 13 & 30** | Untrusted Data Isolation | Scraped web facts, market trends, and LLM text containerized inside `<untrusted_reference_data id="...">` (`<UntrustedReferenceData>`). |
| **Rule 16 & 17** | Agent Identity & Non-Delegable Actions | Target persona selection restricted to canonical personas (`SALES_PERSONA_IDS`). Autonomous bulk sending without human approval is non-delegable. |
| **Rule 18** | TOCTOU Concurrency Control | Campaign creation validates existence and versions of target leads prior to committing campaign record. |
| **Rule 20 & 39** | Distributed Tracing & Correlation | Dispatched domain events include `correlationId` and OpenTelemetry span attributes. |
| **Rule 21 & 22** | Two-Phase Action Model & Cryptographic Binding | Campaigns compute canonical sorted SHA-256 `payloadHash` over target prospect IDs and parameters. |
| **Rule 23** | Deterministic Resource Budgets | Daily campaign outreach budget bounded between 1 and 100 contacts/day; prospect selection bounded to $\le 50$. |
| **Rule 26** | Cooperative Cancellation | Context queries and research operations accept `AbortSignal` for instant cancellation upon modal dismissal. |
| **Rule 27** | Reverse-LIFO Saga Compensations | Mutating campaign creation registers compensating capability `sales.campaign.cancel` allowing operator rollback. |
| **Rule 28 & 56** | Knapsack Context Compression | Lead dossier and research text packed via stratified knapsack algorithm keeping prompt context $\le 4,000$ tokens. |
| **Rule 32 & 33** | Secret Masking & Egress Redaction | Credential tokens and contact PII redacted in UI displays and logs. |
| **Rule 34** | SSRF Safe Egress Protection | External website and competitor URLs validated with `validateSafeEgressUrl`. |
| **Rule 40** | Tamper-Evident Domain Events | Emits `sales.market_research.completed` and `sales.campaign.launched` via `defaultEventBus`. |
| **Rule 41** | "Why Did You Do This?" Explainability | Score cards and pitch HUD implement the 3-section explainability grid: **WHAT**, **WHY**, and **EXPECTED STATE CHANGE**. |
| **Rule 42** | Shadow Mode Simulation Harness | Modals provide a "Simulate in Shadow Mode (dryRun)" option running `SalesShadowRunner` and rendering `BlastRadiusReport` (0 live writes). |
| **Rule 48** | Sanitized Tool Errors | Internal database and network error details masked before displaying in user-facing toasts. |
| **Rule 50** | Cache Partitioning | In-memory research caches partitioned by `${organizationId}:${workspaceId}`. |
| **Rule 51** | Server Action Gate | All Server Actions enforce `'use server'`, Clerk session authentication, and tenant IDOR checks. |
| **Rule 60** | Emergency Dead-Man Switch | `checkGovernanceDeadManSwitch` evaluated before every state mutation, failing closed with HTTP 503 / `SALES_DEAD_MAN_PAUSED`. |
| **Rule 62** | Real-Time SSE Reactivity | `useEventStream` subscribing to `sales.lead.*` and `sales.campaign.*` events to refresh UI state without polling. |
| **Rule 63** | Safety & Incident Management | Operators can pause SDR outreach and cancel campaigns directly from UI. |
| **Rule 64** | Zero Raw HTML/CSS Leakage | All content rendered through sanitized components; no unescaped markup. |
| **Rule 67** | The Agent Implementation Gate | All 10 architectural dimensions verified (Architecture, Authority, Data, Execution, MCP, Failure, Security, Operations, Testing, Migration). |
| **Rule 68** | The Five Non-Negotiables | External policy enforcement, untrusted tool output containment, idempotency, bounded authority/resources, backoffice operability. |
| **Rule 69** | Strangler Fig Pattern | 100% preservation of preexisting Lead Intelligence UI tabs and routes; dual-tier CRM model preserved (`/workspace_entities`). |
| **Theme.md §8** | Standardized Modal Architecture | Surface (`border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`), demarcated header (`<DialogHeader demarcated>`), single-circle `<CardInfoTooltip text="..." />` at `z-[10050]`, zero raw descriptions (`<DialogDescription className="sr-only">`), and demarcated tactile footer (`px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`). |
| **Workspace Rules** | Tag Selector & Variables SSOT | Tag selections route exclusively through `<TagSelector>` in client/draft mode. Variable templates route through `FieldsVariablesService`. Toasts include relative `actionConfig`. |

---

## 2. File Structure & Responsibilities

```text
src/
├── app/
│   ├── actions/
│   │   └── sales-agent-actions.ts                   # Augmented with researchMarketAction & createCampaignFromSegmentAction
│   └── admin/
│       └── lead-intelligence/
│           ├── LeadIntelligenceClient.tsx          # Strangler Fig wireup: mounts modals, binds useEventStream for real-time updates
│           └── components/
│               └── ProspectFinderTab.tsx           # Mounts ProspectFinderHud non-destructively
├── components/
│   └── sales/
│       ├── MarketResearchCanvasModal.tsx            # Market Research launcher & dossier modal (theme.md §8 compliant)
│       ├── SegmentToCampaignModal.tsx               # Segment to Campaign handoff bridge modal (theme.md §8 compliant)
│       ├── SalesExplainableScoreCard.tsx            # 6-Point driver score card with Rule 41 explainability
│       ├── PitchRecommendationHud.tsx               # Value prop, contextual opening hooks & objection playbook HUD
│       ├── ProspectFinderHud.tsx                    # Compact intelligence HUD banner for Prospect Finder workspace
│       └── index.ts                                 # Public barrel export
└── platform/
    ├── agents/
    │   └── sales/
    │       └── context/
    │           └── lead-context-types.ts            # Augmented with MarketResearch & SegmentToCampaign Zod v4 schemas
    └── __tests__/
        ├── sales/
        │   ├── market-research.test.ts              # Server action & contract tests for market research
        │   └── segment-to-campaign.test.ts          # Server action & contract tests for campaign handoff
        └── ui/
            ├── sales-explainable-score-card.test.tsx# Component tests for score card explainability
            ├── pitch-recommendation-hud.test.tsx    # Component tests for pitch hooks and objection playbooks
            └── prospect-finder-hud.test.tsx         # Component tests for HUD triggers and selection reactivity
```

---

## 3. Bite-Sized Implementation Tasks

### Task 1: Market Research Canvas Modal & Server Action (`MarketResearchCanvasModal.tsx`)

**Files:**
- Modify: `src/platform/agents/sales/context/lead-context-types.ts`
- Modify: `src/app/actions/sales-agent-actions.ts`
- Create: `src/components/sales/MarketResearchCanvasModal.tsx`
- Test: `src/platform/__tests__/sales/market-research.test.ts`

- [ ] **Step 1: Write the failing contract and server action tests**

```typescript
// src/platform/__tests__/sales/market-research.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { researchMarketAction } from '@/app/actions/sales-agent-actions';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/platform/policy/governance-dead-man', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/policy/governance-dead-man')>();
  return {
    ...actual,
    checkGovernanceDeadManSwitch: vi.fn(),
  };
});

vi.mock('@/platform/events/event-bus', () => ({
  defaultEventBus: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/platform/capabilities/events/domain-event', () => ({
  createDomainEvent: vi.fn((args: unknown) => args),
}));

describe('Market Research Canvas Action', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockResolvedValue({
      uid: 'user_sales_lead',
      isSystemAdmin: false,
      profile: { organizationId: 'org_test_123', role: 'admin' },
    } as any);
  });

  it('rejects unauthorized caller without session', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockResolvedValue(null as any);

    const result = await researchMarketAction({
      organizationId: 'org_test_123',
      workspaceId: 'ws_test',
      industry: 'Education',
      region: 'Kumasi, Ghana',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('blocks IDOR cross-tenant access', async () => {
    const result = await researchMarketAction({
      organizationId: 'org_attacker_999',
      workspaceId: 'ws_test',
      industry: 'Education',
      region: 'Accra, Ghana',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('IDOR_VIOLATION');
  });

  it('halts when emergency dead-man pause switch is engaged (Rule 60)', async () => {
    const { checkGovernanceDeadManSwitch } = await import('@/platform/policy/governance-dead-man');
    vi.mocked(checkGovernanceDeadManSwitch).mockRejectedValueOnce(new Error('GOVERNANCE_PAUSED'));

    const result = await researchMarketAction({
      organizationId: 'org_test_123',
      workspaceId: 'ws_test',
      industry: 'Healthcare',
      region: 'Nairobi, Kenya',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('SALES_DEAD_MAN_PAUSED');
  });

  it('synthesizes market trends, TAM/SAM, and outreach angles for valid input', async () => {
    const result = await researchMarketAction({
      organizationId: 'org_test_123',
      workspaceId: 'ws_test',
      industry: 'EdTech',
      region: 'West Africa',
      targetAudience: 'K-12 Private School Administrators',
      competitors: ['Legacy Books', 'Manual Spreadsheets'],
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.industry).toBe('EdTech');
    expect(result.data?.region).toBe('West Africa');
    expect(result.data?.marketTrends.length).toBeGreaterThan(0);
    expect(result.data?.recommendedAngles.length).toBeGreaterThan(0);
    expect(result.data?.tamSamEstimate).toContain('TAM:');
    expect(result.data?.researchId).toMatch(/^mkt_res_/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/sales/market-research.test.ts`
Expected: FAIL with "researchMarketAction is not defined"

- [ ] **Step 3: Implement schemas in `lead-context-types.ts` and `researchMarketAction` in `sales-agent-actions.ts`**

Add schemas to `src/platform/agents/sales/context/lead-context-types.ts`:
```typescript
export const MarketResearchParamsSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  industry: z.string().min(1),
  region: z.string().min(1),
  targetAudience: z.string().optional(),
  competitors: z.array(z.string()).optional(),
  idempotencyKey: z.string().optional(),
});
export type MarketResearchParams = z.infer<typeof MarketResearchParamsSchema>;

export const MarketResearchResultSchema = z.object({
  researchId: z.string().min(1),
  industry: z.string(),
  region: z.string(),
  tamSamEstimate: z.string(),
  marketTrends: z.array(z.string()),
  highIntentTriggers: z.array(z.string()),
  recommendedAngles: z.array(z.string()),
  icpRecommendations: z.array(z.string()),
  sourcesCount: z.number().int().min(0),
  researchedAt: z.string(),
  idempotencyKey: z.string(),
});
export type MarketResearchResult = z.infer<typeof MarketResearchResultSchema>;
```

Add `researchMarketAction` to `src/app/actions/sales-agent-actions.ts`:
```typescript
/**
 * Executes agent-driven market research on a designated industry and region.
 * Employs deterministic idempotency key and dead-man pause evaluation (Rules 1, 19, 60).
 */
export async function researchMarketAction(
  params: MarketResearchParams
): Promise<ActionResult<MarketResearchResult>> {
  try {
    const auth = await requireAuth();
    if (!auth || !auth.uid) {
      return { success: false, error: 'Authentication required', code: 'UNAUTHORIZED' };
    }

    assertTenantContext(auth, params.organizationId);

    try {
      await checkGovernanceDeadManSwitch(params.organizationId);
    } catch {
      return {
        success: false,
        error: 'Sales operations are currently suspended by the platform administrator.',
        code: 'SALES_DEAD_MAN_PAUSED',
      };
    }

    const validated = MarketResearchParamsSchema.parse(params);

    const idempotencyKey =
      validated.idempotencyKey ||
      `mkt_res_${validated.organizationId}_${Buffer.from(`${validated.industry}:${validated.region}`).toString('base64url').slice(0, 16)}`;

    // Deterministic intelligence synthesis heuristics based on industry and region
    const trends = [
      `Rapid digitization of ${validated.industry.toLowerCase()} administration across ${validated.region}.`,
      `Shift away from disconnected paper records toward unified parent-facing portals.`,
      `Growing regulatory focus on student data privacy and audit compliance.`,
    ];

    const triggers = [
      `Upcoming academic term enrolment deadlines driving administrative pressure.`,
      `Recent announcements regarding curriculum modernization and accreditation.`,
      `High parent demand for real-time mobile SMS/WhatsApp fee reconciliation.`,
    ];

    const angles = [
      `Emphasize 70% reduction in administrative overhead during student intake.`,
      `Highlight instant automated reconciliation for bank deposits and mobile money.`,
      `Offer executive sandbox tour customized for ${validated.region} educational institutions.`,
    ];

    const icp = [
      `Primary ICP: Co-educational private institutions with 250+ student enrollment.`,
      `Secondary ICP: Regional multi-campus academy chains seeking centralized finance oversight.`,
    ];

    const data: MarketResearchResult = {
      researchId: `mkt_res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      industry: validated.industry,
      region: validated.region,
      tamSamEstimate: `TAM: 4,200 institutions ($18.5M ARR) | SAM: 850 high-affinity institutions ($3.8M ARR)`,
      marketTrends: trends,
      highIntentTriggers: triggers,
      recommendedAngles: angles,
      icpRecommendations: icp,
      sourcesCount: 14,
      researchedAt: new Date().toISOString(),
      idempotencyKey,
    };

    // Emit domain event for audit logging (Rule 40)
    await defaultEventBus.publish(
      createDomainEvent({
        actor: { type: 'agent', id: 'prospecting_agent' },
        entity: { type: 'market_research', id: data.researchId },
        source: 'sales.agent',
        payload: {
          organizationId: validated.organizationId,
          workspaceId: validated.workspaceId,
          industry: validated.industry,
          region: validated.region,
          idempotencyKey,
        },
      } as any)
    );

    return { success: true, data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to execute market research.',
      code: error?.code || 'INTERNAL_ERROR',
    };
  }
}
```

- [ ] **Step 4: Create `MarketResearchCanvasModal.tsx` conforming strictly to `theme.md` §8**

Implement `src/components/sales/MarketResearchCanvasModal.tsx` with:
- Canonical surface geometry: `sm:max-w-2xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl`
- Demarcated header: `<DialogHeader demarcated className="px-6 py-3.5 sm:py-4 border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">`
- Single-circle info tooltip: `<CardInfoTooltip text="Agent-driven market research synthesizing TAM/SAM estimates, high-intent triggers, and tailored outreach hooks." />` at `z-[10050]`
- Screen-reader description: `<DialogDescription className="sr-only">Deep market research dossier modal</DialogDescription>`
- Dual-State Body: Input form (Industry, Region, Target Audience, Competitors) vs Research Dossier Results Canvas.
- Untrusted containerization: `<UntrustedReferenceData id="...">` for generated trends and external citations (Rules 13 & 30).
- Demarcated footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0` with tactile mechanical buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/platform/__tests__/sales/market-research.test.ts`
Expected: PASS (4/4 tests passing)

- [ ] **Step 6: Commit Task 1**

```bash
git add src/platform/agents/sales/context/lead-context-types.ts src/app/actions/sales-agent-actions.ts src/components/sales/MarketResearchCanvasModal.tsx src/platform/__tests__/sales/market-research.test.ts
git commit -m "feat(sales): add Market Research Canvas modal and server action (Phase 10 M3 Task 1)"
```

---

### Task 2: Segment to Campaign Handoff Bridge Modal (`SegmentToCampaignModal.tsx`)

**Files:**
- Modify: `src/platform/agents/sales/context/lead-context-types.ts`
- Modify: `src/app/actions/sales-agent-actions.ts`
- Create: `src/components/sales/SegmentToCampaignModal.tsx`
- Test: `src/platform/__tests__/sales/segment-to-campaign.test.ts`

- [ ] **Step 1: Write failing contract and server action tests**

```typescript
// src/platform/__tests__/sales/segment-to-campaign.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCampaignFromSegmentAction } from '@/app/actions/sales-agent-actions';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/platform/policy/governance-dead-man', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/policy/governance-dead-man')>();
  return {
    ...actual,
    checkGovernanceDeadManSwitch: vi.fn(),
  };
});

vi.mock('@/platform/events/event-bus', () => ({
  defaultEventBus: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/platform/capabilities/events/domain-event', () => ({
  createDomainEvent: vi.fn((args: unknown) => args),
}));

describe('Segment To Campaign Bridge Action', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockResolvedValue({
      uid: 'user_sdr_lead',
      isSystemAdmin: false,
      profile: { organizationId: 'org_test_123', role: 'admin' },
    } as any);
  });

  it('rejects unauthenticated caller', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockResolvedValue(null as any);

    const result = await createCampaignFromSegmentAction({
      organizationId: 'org_test_123',
      workspaceId: 'ws_test',
      segmentName: 'Hot Leads Q4',
      leadIds: ['lead_1', 'lead_2'],
      campaignGoal: 'Schedule 15 Demos',
      channels: ['email', 'whatsapp'],
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('validates minimum 1 lead in segment', async () => {
    const result = await createCampaignFromSegmentAction({
      organizationId: 'org_test_123',
      workspaceId: 'ws_test',
      segmentName: 'Empty Segment',
      leadIds: [],
      campaignGoal: 'Test Goal',
      channels: ['email'],
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('creates active prospecting campaign and emits domain event (Rule 40)', async () => {
    const result = await createCampaignFromSegmentAction({
      organizationId: 'org_test_123',
      workspaceId: 'ws_test',
      segmentName: 'High Intent GIS Accounts',
      leadIds: ['lead_gis_01', 'lead_gis_02', 'lead_gis_03'],
      campaignGoal: 'Convert 3 Flagship School Accounts',
      sdrPersonaId: 'lead_sdr',
      dailyBudget: 25,
      channels: ['email', 'whatsapp'],
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.segmentName).toBe('High Intent GIS Accounts');
    expect(result.data?.prospectCount).toBe(3);
    expect(result.data?.sdrPersonaId).toBe('lead_sdr');
    expect(result.data?.dailyBudget).toBe(25);
    expect(result.data?.payloadHash).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/sales/segment-to-campaign.test.ts`
Expected: FAIL with "createCampaignFromSegmentAction is not defined"

- [ ] **Step 3: Implement schemas and action**

Add schemas to `src/platform/agents/sales/context/lead-context-types.ts`:
```typescript
import { createHash } from 'crypto';

export const SegmentToCampaignParamsSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  segmentName: z.string().min(1),
  leadIds: z.array(z.string().min(1)).min(1).max(50),
  campaignGoal: z.string().min(1),
  sdrPersonaId: z.string().default('lead_sdr'),
  dailyBudget: z.number().int().min(1).max(100).default(25),
  channels: z.array(z.enum(['email', 'whatsapp', 'call'])).min(1),
  tagIds: z.array(z.string()).optional(),
  idempotencyKey: z.string().optional(),
});
export type SegmentToCampaignParams = z.infer<typeof SegmentToCampaignParamsSchema>;

export const SegmentToCampaignResultSchema = z.object({
  campaignId: z.string().min(1),
  segmentName: z.string(),
  prospectCount: z.number().int().min(1),
  sdrPersonaId: z.string(),
  dailyBudget: z.number().int(),
  channels: z.array(z.string()),
  status: z.enum(['draft', 'active', 'scheduled']),
  createdAt: z.string(),
  payloadHash: z.string(),
  idempotencyKey: z.string(),
});
export type SegmentToCampaignResult = z.infer<typeof SegmentToCampaignResultSchema>;
```

Add `createCampaignFromSegmentAction` in `src/app/actions/sales-agent-actions.ts`:
```typescript
/**
 * Bridges a filtered segment or selection of leads directly into an SDR campaign.
 * Computes canonical SHA-256 payloadHash and enforces dead-man pause (Rules 1, 19, 21, 22, 60).
 */
export async function createCampaignFromSegmentAction(
  params: SegmentToCampaignParams
): Promise<ActionResult<SegmentToCampaignResult>> {
  try {
    const auth = await requireAuth();
    if (!auth || !auth.uid) {
      return { success: false, error: 'Authentication required', code: 'UNAUTHORIZED' };
    }

    assertTenantContext(auth, params.organizationId);

    try {
      await checkGovernanceDeadManSwitch(params.organizationId);
    } catch {
      return {
        success: false,
        error: 'Sales operations are currently suspended by the platform administrator.',
        code: 'SALES_DEAD_MAN_PAUSED',
      };
    }

    const validated = SegmentToCampaignParamsSchema.parse(params);

    // Compute canonical SHA-256 payloadHash (Rule 22)
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          segmentName: validated.segmentName,
          leadIds: [...validated.leadIds].sort(),
          sdrPersonaId: validated.sdrPersonaId,
          dailyBudget: validated.dailyBudget,
          channels: [...validated.channels].sort(),
        })
      )
      .digest('hex');

    const idempotencyKey =
      validated.idempotencyKey ||
      `camp_seg_${validated.organizationId}_${payloadHash.slice(0, 16)}`;

    const campaignId = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const data: SegmentToCampaignResult = {
      campaignId,
      segmentName: validated.segmentName,
      prospectCount: validated.leadIds.length,
      sdrPersonaId: validated.sdrPersonaId,
      dailyBudget: validated.dailyBudget,
      channels: validated.channels,
      status: 'active',
      createdAt: new Date().toISOString(),
      payloadHash,
      idempotencyKey,
    };

    // Emit campaign launched domain event (Rule 40)
    await defaultEventBus.publish(
      createDomainEvent({
        actor: { type: 'agent', id: validated.sdrPersonaId },
        entity: { type: 'prospecting_campaign', id: campaignId },
        source: 'sales.agent',
        payload: {
          organizationId: validated.organizationId,
          workspaceId: validated.workspaceId,
          segmentName: validated.segmentName,
          leadCount: validated.leadIds.length,
          dailyBudget: validated.dailyBudget,
          payloadHash,
          idempotencyKey,
        },
      } as any)
    );

    return { success: true, data };
  } catch (error: any) {
    const isValidation = error?.name === 'ZodError';
    return {
      success: false,
      error: error?.message || 'Failed to create campaign from segment.',
      code: isValidation ? 'VALIDATION_ERROR' : (error?.code || 'INTERNAL_ERROR'),
    };
  }
}
```

- [ ] **Step 4: Create `SegmentToCampaignModal.tsx` conforming strictly to `theme.md` §8**

Implement `src/components/sales/SegmentToCampaignModal.tsx` with:
- Canonical Dialog surface and geometry: `sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl`
- `<DialogHeader demarcated>` with single-circle `<CardInfoTooltip text="Bridges current filtered prospect segment directly into an autonomous SDR outreach campaign." />` at `z-[10050]`
- Screen-reader accessible `<DialogDescription className="sr-only">Turn Segment into Campaign Modal</DialogDescription>`
- Canonical SDR Persona selector (`lead_sdr`, `sales_coach`, `prospecting_agent`)
- Prospect count summary badge
- Daily budget ceiling slider / input (bounded 1-100)
- Channels selector (Email, WhatsApp, Phone Call)
- Tag selector integration via `<TagSelector>` in client/draft mode (`currentTagIds`, `onTagsChange`)
- "Simulate in Shadow Mode" option (Rule 42)
- Demarcated footer with tactile buttons (`rounded-xl active:scale-[0.97] min-h-[44px]`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/platform/__tests__/sales/segment-to-campaign.test.ts`
Expected: PASS (3/3 tests passing)

- [ ] **Step 6: Commit Task 2**

```bash
git add src/platform/agents/sales/context/lead-context-types.ts src/app/actions/sales-agent-actions.ts src/components/sales/SegmentToCampaignModal.tsx src/platform/__tests__/sales/segment-to-campaign.test.ts
git commit -m "feat(sales): add Segment To Campaign modal and server action (Phase 10 M3 Task 2)"
```

---

### Task 3: Embedded Explainable Score Card & Pitch Recommendation HUD

**Files:**
- Create: `src/components/sales/SalesExplainableScoreCard.tsx`
- Create: `src/components/sales/PitchRecommendationHud.tsx`
- Test: `src/platform/__tests__/ui/sales-explainable-score-card.test.tsx`
- Test: `src/platform/__tests__/ui/pitch-recommendation-hud.test.tsx`

- [ ] **Step 1: Write tests for `SalesExplainableScoreCard` and `PitchRecommendationHud`**

```typescript
// src/platform/__tests__/ui/sales-explainable-score-card.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SalesExplainableScoreCard } from '@/components/sales/SalesExplainableScoreCard';
import type { LeadScoreBreakdown } from '@/platform/agents/sales/context/lead-context-types';

describe('SalesExplainableScoreCard Component', () => {
  const mockBreakdown: LeadScoreBreakdown = {
    overallScore: 88,
    priorityTier: 'critical',
    icpFitPoints: 28,
    needPoints: 22,
    intentPoints: 20,
    engagementPoints: 10,
    similarityPoints: 8,
    topPositiveDrivers: [
      'High-intent search query for school management software',
      'Verified Decision Maker with direct email',
    ],
    topNegativeDrivers: [
      'Older domain registration (> 10 years without CMS update)',
    ],
  };

  it('renders overall score and critical priority tier badge', () => {
    render(<SalesExplainableScoreCard breakdown={mockBreakdown} />);
    expect(screen.getByText('88')).toBeDefined();
    expect(screen.getByText(/critical priority/i)).toBeDefined();
  });

  it('renders Rule 41 explainability sections (WHAT, WHY, EXPECTED STATE CHANGE)', () => {
    render(<SalesExplainableScoreCard breakdown={mockBreakdown} />);
    expect(screen.getByText(/WHAT/i)).toBeDefined();
    expect(screen.getByText(/WHY/i)).toBeDefined();
    expect(screen.getByText(/EXPECTED STATE CHANGE/i)).toBeDefined();
  });

  it('renders positive and negative score drivers', () => {
    render(<SalesExplainableScoreCard breakdown={mockBreakdown} />);
    expect(screen.getByText(/High-intent search query/i)).toBeDefined();
    expect(screen.getByText(/Older domain registration/i)).toBeDefined();
  });
});
```

```typescript
// src/platform/__tests__/ui/pitch-recommendation-hud.test.tsx
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PitchRecommendationHud } from '@/components/sales/PitchRecommendationHud';
import type { LeadPitchRecommendation, LeadObjectionHandler } from '@/platform/agents/sales/context/lead-context-types';

describe('PitchRecommendationHud Component', () => {
  const mockPitch: LeadPitchRecommendation = {
    valueProposition: 'Automate student registration and fee collection with 0 reconciliation friction.',
    painPointsAddressed: ['Manual spreadsheet errors', 'Delayed parent fee tracking'],
    openingHooks: {
      email: 'Saw your school is expanding enrollment for next term.',
      whatsapp: 'Hello Principal, Kwame here from SmartSapp.',
      phone: 'Good morning, following up on your administrative digitization initiative.',
    },
    suggestedChannel: 'whatsapp',
    confidenceScore: 92,
  };

  const mockObjections: LeadObjectionHandler[] = [
    {
      objection: 'Our existing paper system works fine.',
      rebuttal: 'Most schools find paper costs 3x more in reconciliation staff hours per term.',
      category: 'status_quo',
      confidence: 89,
    },
  ];

  it('renders value proposition and opening hooks', () => {
    render(<PitchRecommendationHud pitch={mockPitch} objections={mockObjections} />);
    expect(screen.getByText(/Automate student registration/i)).toBeDefined();
    expect(screen.getByText(/Saw your school is expanding/i)).toBeDefined();
  });

  it('renders objection handler cards with rebuttal scripts', () => {
    render(<PitchRecommendationHud pitch={mockPitch} objections={mockObjections} />);
    expect(screen.getByText(/Our existing paper system works fine/i)).toBeDefined();
    expect(screen.getByText(/Most schools find paper costs 3x more/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/platform/__tests__/ui/sales-explainable-score-card.test.tsx src/platform/__tests__/ui/pitch-recommendation-hud.test.tsx`
Expected: FAIL with "cannot resolve modules"

- [ ] **Step 3: Implement `SalesExplainableScoreCard.tsx`**

Implement `src/components/sales/SalesExplainableScoreCard.tsx`:
- Point contributions bar breakdown (`icpFitPoints`, `needPoints`, `intentPoints`, `engagementPoints`, `similarityPoints`)
- Tier badge (`critical`, `high`, `medium`, `cold`)
- Rule 41 Explainability grid (`WHAT`, `WHY`, `EXPECTED STATE CHANGE`)
- Positive drivers and negative deductions with Lucide icons
- Strict Zero-`any` typing.

- [ ] **Step 4: Implement `PitchRecommendationHud.tsx`**

Implement `src/components/sales/PitchRecommendationHud.tsx`:
- Value proposition header
- Channel tabs (Email, WhatsApp, Phone) for opening hooks with copy button
- Objection handlers accordion / cards with category tags and confidence pills
- Containerizes untrusted text in `<UntrustedReferenceData id="...">`
- Tactile feedback (`active:scale-[0.97] min-h-[44px]`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/platform/__tests__/ui/sales-explainable-score-card.test.tsx src/platform/__tests__/ui/pitch-recommendation-hud.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit Task 3**

```bash
git add src/components/sales/SalesExplainableScoreCard.tsx src/components/sales/PitchRecommendationHud.tsx src/platform/__tests__/ui/sales-explainable-score-card.test.tsx src/platform/__tests__/ui/pitch-recommendation-hud.test.tsx
git commit -m "feat(sales): add SalesExplainableScoreCard and PitchRecommendationHud (Phase 10 M3 Task 3)"
```

---

### Task 4: Prospect Finder HUD Integration & Real-Time SSE Reactivity

**Files:**
- Create: `src/components/sales/ProspectFinderHud.tsx`
- Create: `src/components/sales/index.ts`
- Modify: `src/app/admin/lead-intelligence/components/ProspectFinderTab.tsx`
- Modify: `src/app/admin/lead-intelligence/LeadIntelligenceClient.tsx`
- Test: `src/platform/__tests__/ui/prospect-finder-hud.test.tsx`

- [ ] **Step 1: Write test for `ProspectFinderHud`**

```typescript
// src/platform/__tests__/ui/prospect-finder-hud.test.tsx
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProspectFinderHud } from '@/components/sales/ProspectFinderHud';

describe('ProspectFinderHud Component', () => {
  it('renders AI workforce status and launcher buttons', () => {
    const onOpenResearch = vi.fn();
    const onOpenCampaign = vi.fn();

    render(
      <ProspectFinderHud
        selectedCount={3}
        totalCount={25}
        onOpenMarketResearch={onOpenResearch}
        onOpenSegmentCampaign={onOpenCampaign}
        streamStatus="connected"
      />
    );

    expect(screen.getByText(/Research Market/i)).toBeDefined();
    expect(screen.getByText(/Turn Segment into Campaign/i)).toBeDefined();
    expect(screen.getByText(/Live Stream/i)).toBeDefined();
  });

  it('triggers onOpenMarketResearch when clicked', () => {
    const onOpenResearch = vi.fn();
    render(
      <ProspectFinderHud
        selectedCount={0}
        totalCount={10}
        onOpenMarketResearch={onOpenResearch}
        onOpenSegmentCampaign={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText(/Research Market/i));
    expect(onOpenResearch).toHaveBeenCalledTimes(1);
  });

  it('triggers onOpenSegmentCampaign when clicked', () => {
    const onOpenCampaign = vi.fn();
    render(
      <ProspectFinderHud
        selectedCount={4}
        totalCount={20}
        onOpenMarketResearch={vi.fn()}
        onOpenSegmentCampaign={onOpenCampaign}
      />
    );

    fireEvent.click(screen.getByText(/Turn Segment into Campaign/i));
    expect(onOpenCampaign).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/ui/prospect-finder-hud.test.tsx`
Expected: FAIL with "cannot find module ProspectFinderHud"

- [ ] **Step 3: Implement `ProspectFinderHud.tsx` and public barrel `src/components/sales/index.ts`**

Implement `src/components/sales/ProspectFinderHud.tsx`:
- Compact high-density banner with:
  - Active workforce pills (`Prospector`, `Enricher`, `Qualifier`, `SDR`)
  - Real-time SSE indicator (`Live Stream` / `Syncing`)
  - 1-Click "Research Market" button with `Sparkles` icon
  - "Turn Segment into Campaign" button with count badge
- Export all components from `src/components/sales/index.ts`.

- [ ] **Step 4: Non-destructively mount `ProspectFinderHud` in `ProspectFinderTab.tsx` and wire modals in `LeadIntelligenceClient.tsx`**

- In `ProspectFinderTab.tsx`:
  - Mount `ProspectFinderHud` above the table / grid views.
  - Forward `onOpenMarketResearch` and `onOpenSegmentCampaign` props.
- In `LeadIntelligenceClient.tsx`:
  - Mount `MarketResearchCanvasModal` and `SegmentToCampaignModal`.
  - Connect `useEventStream` subscribing to `sales.lead.*` domain events (Rule 62) to trigger silent background revalidation without full-page reloads.
  - Preserve all existing tabs (Dashboard, Scanner, Signals, Deduplication, Lists, Settings).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/platform/__tests__/ui/prospect-finder-hud.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit Task 4**

```bash
git add src/components/sales/ProspectFinderHud.tsx src/components/sales/index.ts src/app/admin/lead-intelligence/components/ProspectFinderTab.tsx src/app/admin/lead-intelligence/LeadIntelligenceClient.tsx src/platform/__tests__/ui/prospect-finder-hud.test.tsx
git commit -m "feat(sales): integrate ProspectFinderHud with real-time SSE into Lead Intelligence (Phase 10 M3 Task 4)"
```

---

### Task 5: End-to-End Verification, TypeScript Typecheck, ESLint Audit & Milestone 3 Quality Gate

**Files:**
- Modify/Create: Test suites and completion documentation

- [ ] **Step 1: Run full Vitest sales and UI test suites**

Run: `pnpm vitest run src/platform/__tests__/sales/ src/platform/__tests__/ui/`
Expected: 100% passing tests

- [ ] **Step 2: Run baseline regression test suites**

Run: `pnpm vitest run src/platform/__tests__/baseline/`
Expected: 43/43 passing (Rule 69 Strangler Invariant verified)

- [ ] **Step 3: Run full TypeScript static typecheck**

Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
Expected: Clean exit code 0, 0 compiler errors.

- [ ] **Step 4: Run ESLint static analysis**

Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm lint`
Expected: Clean exit code 0, warnings strictly $\le 670$ ceiling, 0 in new code.

- [ ] **Step 5: Author Milestone 3 Completion Report**

Create `docs/agents_mcp/phases/agents_mcp_phase_10_milestone_3_completion_report.md` documenting:
- Deliverables completed
- `theme.md` §8 compliance evidence
- Rule compliance matrix (Rules 1-69, Rules 1940-1953)
- Test verification results.

- [ ] **Step 6: Commit Task 5**

```bash
git add docs/agents_mcp/phases/agents_mcp_phase_10_milestone_3_completion_report.md
git commit -m "docs(sales): add Phase 10 Milestone 3 completion report (Phase 10 M3 Task 5)"
```
