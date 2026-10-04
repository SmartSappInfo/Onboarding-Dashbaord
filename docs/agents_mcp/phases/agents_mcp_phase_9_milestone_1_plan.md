# SmartSapp Agentic & MCP Transformation: Phase 9 Milestone 1 Implementation Plan
## 360° Account Context Aggregator & Universal Timeline Assembly Engine
### Deeply Integrated with `docs/agents_mcp/`, `docs/agentic/`, `theme.md` §8 & The 69 Agentic Development Rules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete multi-domain account context aggregator and chronological timeline assembly engine that powers the Universal CRM Agent signature behavior ("What's going on with Greenfield School?"), incorporating dual-tier data model preservation (`entities` vs `workspace_entities`), prompt injection XML isolation, stratified knapsack context budgeting ($\le 4,000$ tokens), and real-time TTL caching.

**Architecture:** A multi-domain parallel data plane retrieval engine that concurrently queries across 8 platform collections (entities, workspace records, contacts, deals, meetings, notes, invoices, tasks, semantic memory), normalizes heterogeneous events into a chronologically sorted and deduplicated timeline, isolates untrusted external data within `<untrusted_reference_data id="...">` containers, compresses output using stratified greedy knapsack packing, and publishes domain events via `defaultEventBus`.

**Tech Stack:** TypeScript (strict zero-`any`), Next.js 15 App Router, Zod v4, Firestore Admin SDK, Qdrant Hybrid Retriever, EventBus, Vitest.

---

## 1. Executive Summary & Context Assembly Architecture

When any user asks the flagship CRM query:
> **“What's going on with Greenfield School?”**

The Universal CRM Agent requires an authoritative, unified, multi-domain 360° view of that account. In accordance with `agents_mcp_roadmap.md` (§ Phase 9) and `agents_mcp_tools.md` (§ Domain 2 CRM Tools), Milestone 1 builds the foundational data plane engine that retrieves, normalizes, containerizes, and budgets this data.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      360° ACCOUNT CONTEXT DATA PLANE (MILESTONE 1)                     │
│                                                                                        │
│     GLOBAL ENTITY MASTER                        WORKSPACE OPERATIONAL RECORD           │
│     /entities/{entityId}                        /workspace_entities/{wsId}_{entityId}  │
│     • Legal Identity, Tax ID, Domain            • Stage, Owner, Workspace Tags         │
│     • Primary Address, Global Contacts          • Lead Status, Pipeline SLA            │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
    Concurrently Assembles Across 8 Collections (Rule 9 & 23, <= 5,000ms Budget)
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PARALLEL MULTI-DOMAIN RETRIEVAL PLANE                           │
│                                                                                        │
│  [Contacts]     [Deals]        [Meetings]      [Notes]      [Invoices]     [Tasks]     │
│  Decision       Pipeline       Executive       Call memos   Aging &        Action      │
│  Makers &       Stages &       Dossiers &      & quick      unpaid         items &     │
│  Roles          Values         Transcripts     notes        balances       due dates   │
│                                                                                        │
│  [Institutional Semantic Memory] -> Qdrant RRF Hybrid Search (Tenant-Filtered)         │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SECURITY & CONTEXT BUDGETING PIPELINE                           │
│                                                                                        │
│  1. Prompt Injection Defense: scanForPoisoningDirective                                │
│  2. XML Containerization: <untrusted_reference_data id="...">                          │
│  3. In-Place Credential Redaction: [REDACTED_SECRET:<type>]                            │
│  4. Stratified Greedy Knapsack Compression: Total Context <= 4,000 Tokens              │
│  5. Universal Timeline Normalizer: Chronologically Sorted Event Stream                 │
│  6. Multi-Tenant In-Memory Cache: 3-Minute TTL with Reactive EventBus Invalidation    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Invariant Architecture: Dual-Tier CRM Data Model Preservation (Rule 69)

In accordance with `agents_mcp_tools.md` lines 505–514, SmartSapp strictly enforces the **dual-tier CRM data model**:
1. **Global Master Identity (`entities`):** `/entities/{entityId}` stores immutable, organization-wide corporate identity (legal name, national registration number, global headquarters address, base website, verified industry).
2. **Workspace Operational Record (`workspace_entities`):** `/workspace_entities/{workspaceId}_{entityId}` stores workspace-scoped CRM execution state (pipeline, stage, assigned account executive, workspace tags, lead score, local activity log).

**Milestone 1 Guarantee:** Context assembly polymorphically overlays `/workspace_entities/{workspaceId}_{entityId}` on top of `/entities/{entityId}` without modifying or overwriting global master records.

---

## 3. Master 69-Rules Alignment & Enforcement Matrix for Milestone 1

| Rule # | Requirement | Milestone 1 Implementation & Architectural Defense |
| :---: | :--- | :--- |
| **Rule 1** | Skill Conformance & Standards | Conforms strictly to `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, and `backend-design`. All existing CRM functionality preserved. |
| **Rule 2** | Failure Mode Planning & Cleanliness | Full failure handling for missing entities, empty timelines, stale records, network timeouts, and model disconnects. |
| **Rule 3** | Backoffice Enhancement & Non-Breaking | Provides operator visibility into context assembly metrics and cache hit rates on `/admin/intelligence/agents`. |
| **Rule 4** | Zero `any` / Zero `any[]` Typing Policy | 100% strict TypeScript types. `unknown` permitted only at raw boundary, immediately parsed via Zod v4 schemas. |
| **Rule 5** | Staged Deployment & Security Verification | All sub-collection queries verified with security rules emulator tests before deployment. |
| **Rule 6** | Dependencies & Context7 Documentation | Uses verified stable versions of `@modelcontextprotocol/server`, `zod/v4`, and `date-fns`. Documentation verified via Context7 MCP. |
| **Rule 7** | Mobile-First & Plain UI English | All timeline items formatted in clean, plain English with zero raw stack traces or leaked JSON. |
| **Rule 8** | High Security, Data Protection & Anti-IDOR | Every context query immutably binds to authenticated `organizationId` and active `workspaceId`. Cross-tenant queries fail closed with HTTP 403. |
| **Rule 9** | High Load & Resource Exhaustion Defense | All sub-collection queries strictly bounded (`limit <= 50`). Total context assembly execution capped at 5,000ms. |
| **Rule 10** | Inline Architectural Documentation | Every authored file includes comprehensive `@fileOverview` documentation detailing architecture, security invariants, Rule mappings, and testability pointers. |
| **Rule 11** | MCP Protocol Compliance | Context data structures map directly to Streamable HTTP MCP tools (Spec 2026-07-28). |
| **Rule 12** | No MCP Annotations as Security Controls | Server-side risk evaluation independently computed (`L0_READ`). |
| **Rule 13** | Formal Trust Boundary Matrix | External customer notes, emails, and meeting transcripts treated as untrusted and wrapped in `<untrusted_reference_data id="...">` containers (Rule 30). |
| **Rule 14** | Tool Poisoning / Rug-Pull Defense | Pre-execution cryptographic SHA-256 fingerprint verification before capability dispatch. |
| **Rule 15** | Server Allowlisting & Supply-Chain Security | External enrichment data validated against allowlisted sources. |
| **Rule 16** | Agent Identity as Security Principal | Context queries execute on behalf of authenticated agent personas with explicit scopes; wildcard (`*`) scopes banned. |
| **Rule 17** | Non-Delegable Actions | Destructive actions (e.g. entity deletion) stripped from agent authority. |
| **Rule 18** | TOCTOU Live Principal / Delegation Check | Live optimistic concurrency check: record versions verified before reading operational state. |
| **Rule 19** | Mandatory Idempotency for Mutating Tools | Context caching and assembly keys deterministically hashed. |
| **Rule 20** | Replay & Distributed Tracing | Context assembly injects `correlationId` and `transactionId` into metadata. |
| **Rule 21** | Two-Phase Action Model for High-Risk Work | Milestone 1 is read-only (`L0_READ`), preparing structured context for Milestone 4's Two-Phase Proposal Interceptor. |
| **Rule 22** | Cryptographic Approval Binding | Generates deterministic SHA-256 state hashes for timeline events. |
| **Rule 23** | Budget, Backpressure & Resource Governance | Sub-retrieval timeouts, token ceilings ($\le 4,000$ tokens), and bounded queries enforced. |
| **Rule 24** | 5-State Circuit Breakers | Hybrid memory retriever protected by circuit breakers (`healthy`, `degraded`, `open`, `half_open`). |
| **Rule 25** | Dead-Letter & Recovery Queues | Failed context assemblies log structured diagnostic reports. |
| **Rule 26** | True Cooperative Cancellation Semantics | Context assembly methods accept native `AbortSignal` for instantaneous cooperative cancellation. |
| **Rule 27** | Formal Saga / Compensation Model | Prepares compensating capability IDs for any downstream proposals. |
| **Rule 28** | Context Budgeting | Stratified greedy knapsack packing ensures prompt context strictly $\le 4,000$ tokens. |
| **Rule 29** | Memory Governance | Semantic memory retrieval utilizes temporal decay weighting, prioritizing fresh notes and recent meetings. |
| **Rule 30** | Knowledge Poisoning Defense | Adversarial directives in customer notes or transcripts neutralized by pre-retrieval regex scanning and XML containerization (`<untrusted_reference_data id="...">`). |
| **Rule 31** | Output Validation Between Agent & Tool | Step validator verifies capability output schema via `safeParse`. |
| **Rule 32** | Cross-Domain Data Exfiltration Detection | CRM context restricted strictly to allowed domains (`crm_contacts`, `deals_revenue`, `knowledge_memory`, `tasks_productivity`). |
| **Rule 33** | Egress Control & Redaction | In-place redaction masks credentials, API keys, and sensitive financial data (`[REDACTED_SECRET:<type>]`). |
| **Rule 34** | SSRF & Network Boundary Controls | External website links or company URLs validated with `validateSafeEgressUrl` blocking loopback and private subnets. |
| **Rule 35** | MCP Discovery Caching | Discovery schemas cached with deterministic ETag HTTP 304 validation. |
| **Rule 36** | Capability Version Compatibility | Agent definitions declare exact SemVer requirements. |
| **Rule 37** | MCP Spec Compatibility Testing | Verifies context output conforms to MCP Protocol Spec 2026-07-28 test suites. |
| **Rule 38** | No Features on Deprecated MCP Primitives | Rejects legacy stateful sessions; uses Streamable HTTP. |
| **Rule 39** | OpenTelemetry From Day One | Emits `traceparent` headers and OpenTelemetry span attributes on all context aggregations. |
| **Rule 40** | Audit Log Immutability | Publishes `crm.account.context_assembled` and `crm.timeline.assembled` events via `defaultEventBus`. |
| **Rule 41** | "Why Did You Do This?" Audit View | Timeline items include semantic impact category, source reference, and actor attribution. |
| **Rule 42** | Shadow Mode (Dry-Run Simulation) | Context assembly operates hermetically in simulation mode (`dryRun: true`) with zero database writes. |
| **Rule 43** | Replayable Agent Runs | Context packages persist full snapshot traces allowing exact replay. |
| **Rule 44** | Deterministic Simulation Harness | Hermetic Vitest test harness with mock CRM data stores simulating 14-step assembly. |
| **Rule 45** | Chaos Testing | Simulates Firestore query failures, delayed sub-queries, missing entity relations, and model timeouts. |
| **Rule 46** | Adversarial UI Testing | Red-team test suite against prompt injection via notes and cross-tenant IDOR probing. |
| **Rule 47** | Never Trust the Model | All extracted context records validated with Zod v4 schemas before returning. |
| **Rule 48** | Sanitized Error Reporting | Internal database paths, stack traces, and system internals stripped from errors. |
| **Rule 49** | Public Resource Isolation | CRM context queries restricted strictly to authenticated admin/workspace surfaces; zero public leakage. |
| **Rule 50** | Cache Isolation Rules | In-memory timeline and context caches partitioned by `organizationId`, `workspaceId`, and `entityId`. |
| **Rule 51** | Server Action / Route Handler Security Gate | Every exported Server Action enforces `'use server'`, Clerk session authentication (`requireAuth()`), and tenant IDOR checks. |
| **Rule 52** | Client/Server Boundary Tests | Verifies that server-side database access, API secrets, and AI prompts are never bundled into client bundles. |
| **Rule 53** | Dependency Governance | Zero unvetted dependencies added; all packages locked and security-audited. |
| **Rule 54** | Performance Budgets | Timeline assembly $<500\text{ms}$; 360° context package assembly $<1,500\text{ms}$. |
| **Rule 55** | Graph & Canvas Resource Limits | Relationship graph displays bounded to $\le 30$ connected nodes. |
| **Rule 56** | Agent Context Compression | Knapsack context compressor summarizes long account histories, keeping input tokens strictly $\le 4,000$. |
| **Rule 57** | Data Residency & Retention Awareness | Context queries honor tenant data residency tags and redaction policies. |
| **Rule 58** | Model Routing Policy | Timeline normalization routes to Flash; deep semantic summarization routes to Pro. |
| **Rule 59** | Tool Selection Evaluation | CRM agents restricted strictly to allowed capability domains (`crm_contacts`, `deals_revenue`, `knowledge_memory`, `tasks_productivity`). |
| **Rule 60** | Emergency Dead-Man Controls | `checkGovernanceDeadManSwitch` evaluated before executing context aggregation. Active switch pauses all reasoning with HTTP 503 / `CRM_DEAD_MAN_PAUSED`. |
| **Rule 61** | Surface Isolation | CRM backoffice administrative configurations restricted to `isBackofficeSurface()`. |
| **Rule 62** | Real-Time UI Reactivity via SSE | Live timeline updates stream via Server-Sent Events (`useEventStream`) without client polling. |
| **Rule 63** | Agent Incident Management | Operators can pause runs and reject proposals directly from the UI. |
| **Rule 64** | Zero Raw HTML/CSS Leakage & Feature Flags | Synthesized notes and AI summaries rendered through sanitized markdown components; features gated by `FF_CRM_AGENT_WAVE`. |
| **Rule 65** | Canary Releases | Staged release supporting dark launches and tenant-specific beta access. |
| **Rule 66** | Phased Roadmap Alignment | Fully aligned with Phase 9 roadmap requirements and forward-compatible with Phase 10. |
| **Rule 67** | The Agent Implementation Gate | Mandatory 9-point pre-flight checklist verified before marking Milestone 1 complete. |
| **Rule 68** | The Five Non-Negotiable Invariants | 1. Identity is not the user. 2. Never trust the model. 3. Never trust untrusted data. 4. High-risk actions require two phases. 5. No dead ends in user experience. |
| **Rule 69** | Strangler Fig Pattern SSOT | Preserves dual-tier data model (`entities` vs `workspace_entities`); zero regressions across existing CRM tests, tabs, and routes. |

---

## 4. Architectural Specifications & Data Contracts

### 4.1 Canonical Data Contracts (`src/platform/agents/crm/context/account-context-types.ts`)

```typescript
import { z } from 'zod/v4';

export const AccountEntitySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  industry: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const AccountWorkspaceEntitySummarySchema = z.object({
  id: z.string(),
  entityId: z.string(),
  workspaceId: z.string(),
  pipelineId: z.string().nullable().optional(),
  stageId: z.string().nullable().optional(),
  stageName: z.string().nullable().optional(),
  assignedTo: z
    .object({
      userId: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  workspaceTags: z.array(z.string()).default([]),
  leadStatus: z.string().nullable().optional(),
  updatedAt: z.string(),
});

export const AccountContactSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  isPrimary: z.boolean().default(false),
  channelPreferences: z.array(z.string()).default([]),
});

export const AccountDealSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  pipelineId: z.string(),
  stageId: z.string(),
  stageName: z.string(),
  value: z.number().default(0),
  currency: z.string().default('USD'),
  probability: z.number().min(0).max(100).default(50),
  ageInDays: z.number().int().min(0),
  expectedCloseDate: z.string().nullable().optional(),
  isStalled: z.boolean().default(false),
});

export const AccountMeetingSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  startTime: z.string(),
  attendees: z.array(z.string()).default([]),
  summary: z.string().nullable().optional(),
  transcriptSnippet: z.string().nullable().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'unknown']).default('unknown'),
  isolatedContent: z.string().optional(),
});

export const AccountNoteSummarySchema = z.object({
  id: z.string(),
  content: z.string(),
  isolatedContent: z.string().optional(),
  authorName: z.string().nullable().optional(),
  createdAt: z.string(),
  category: z.string().default('general'),
});

export const AccountTaskSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().nullable().optional(),
  assignedToName: z.string().nullable().optional(),
  isOverdue: z.boolean().default(false),
});

export const AccountFinancialSummarySchema = z.object({
  openBalance: z.number().default(0),
  overdueBalance: z.number().default(0),
  currency: z.string().default('USD'),
  invoiceCount: z.number().int().default(0),
  agingCategory: z.enum(['CURRENT', 'OVERDUE_30', 'OVERDUE_60', 'OVERDUE_90_PLUS', 'CLEAR']).default('CLEAR'),
});

export const AccountMemoryFactSchema = z.object({
  id: z.string(),
  content: z.string(),
  sourceType: z.string(),
  confidence: z.number().min(0).max(1),
  citationId: z.string(),
});

export const AccountTimelineItemSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  category: z.enum(['COMMERCIAL', 'ENGAGEMENT', 'OPERATIONAL', 'FINANCIAL', 'ADMINISTRATIVE']),
  title: z.string(),
  summary: z.string(),
  actor: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sourceRef: z.object({
    type: z.enum(['note', 'meeting', 'deal', 'task', 'invoice', 'tag', 'communication']),
    id: z.string(),
  }),
});

export const AccountContextMetadataSchema = z.object({
  assembledAt: z.string(),
  durationMs: z.number(),
  estimatedTokens: z.number(),
  correlationId: z.string(),
  isKnapsackCompressed: z.boolean().default(false),
  rawItemCounts: z.record(z.string(), z.number()).optional(),
});

export const Account360ContextSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  entityId: z.string().min(1),
  entity: AccountEntitySummarySchema,
  workspaceEntity: AccountWorkspaceEntitySummarySchema.nullable().optional(),
  contacts: z.array(AccountContactSummarySchema).default([]),
  deals: z.array(AccountDealSummarySchema).default([]),
  meetings: z.array(AccountMeetingSummarySchema).default([]),
  notes: z.array(AccountNoteSummarySchema).default([]),
  tasks: z.array(AccountTaskSummarySchema).default([]),
  finances: AccountFinancialSummarySchema,
  memories: z.array(AccountMemoryFactSchema).default([]),
  timeline: z.array(AccountTimelineItemSchema).default([]),
  metadata: AccountContextMetadataSchema,
});

export const AssembleAccountContextOptionsSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  entityId: z.string().min(1),
  maxTokens: z.number().int().min(500).max(8000).default(4000),
  includeMemory: z.boolean().default(true),
  includeFinancials: z.boolean().default(true),
  correlationId: z.string().optional(),
  signal: z.instanceof(AbortSignal).optional(),
});

export type AccountEntitySummary = z.infer<typeof AccountEntitySummarySchema>;
export type AccountWorkspaceEntitySummary = z.infer<typeof AccountWorkspaceEntitySummarySchema>;
export type AccountContactSummary = z.infer<typeof AccountContactSummarySchema>;
export type AccountDealSummary = z.infer<typeof AccountDealSummarySchema>;
export type AccountMeetingSummary = z.infer<typeof AccountMeetingSummarySchema>;
export type AccountNoteSummary = z.infer<typeof AccountNoteSummarySchema>;
export type AccountTaskSummary = z.infer<typeof AccountTaskSummarySchema>;
export type AccountFinancialSummary = z.infer<typeof AccountFinancialSummarySchema>;
export type AccountMemoryFact = z.infer<typeof AccountMemoryFactSchema>;
export type AccountTimelineItem = z.infer<typeof AccountTimelineItemSchema>;
export type AccountContextMetadata = z.infer<typeof AccountContextMetadataSchema>;
export type Account360Context = z.infer<typeof Account360ContextSchema>;
export type AssembleAccountContextOptions = z.infer<typeof AssembleAccountContextOptionsSchema>;

export const ACCOUNT_CONTEXT_ERROR_CODES = {
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  GOVERNANCE_PAUSED: 'GOVERNANCE_PAUSED',
  CONTEXT_ASSEMBLY_TIMEOUT: 'CONTEXT_ASSEMBLY_TIMEOUT',
  CANCELLED: 'CANCELLED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RETRIEVAL_FAILED: 'RETRIEVAL_FAILED',
} as const;

export type AccountContextErrorCode = keyof typeof ACCOUNT_CONTEXT_ERROR_CODES;

export class AccountContextError extends Error {
  public readonly code: AccountContextErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: AccountContextErrorCode, statusCode = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AccountContextError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
```

---

## 5. Bite-Sized Implementation Tasks

### Task 1: Canonical Context & Timeline Contracts (`account-context-types.ts`)

**Files:**
- Create: `src/platform/agents/crm/context/account-context-types.ts`
- Test: `src/platform/__tests__/agents/crm/account-context-contracts.test.ts`

- [ ] **Step 1: Write the failing contract test**

```typescript
// src/platform/__tests__/agents/crm/account-context-contracts.test.ts
import { describe, it, expect } from 'vitest';
import {
  Account360ContextSchema,
  AccountTimelineItemSchema,
  AccountEntitySummarySchema,
  AccountContactSummarySchema,
  AccountDealSummarySchema,
  AccountMeetingSummarySchema,
  AccountNoteSummarySchema,
  AccountTaskSummarySchema,
  AccountFinancialSummarySchema,
  AccountMemoryFactSchema,
  AssembleAccountContextOptionsSchema,
  ACCOUNT_CONTEXT_ERROR_CODES,
  AccountContextError,
} from '../../../agents/crm/context/account-context-types';

describe('Account Context Contracts (Milestone 1)', () => {
  it('validates a valid Account360Context object with Zod v4', () => {
    const validContext = {
      organizationId: 'org_123',
      workspaceId: 'ws_456',
      entityId: 'ent_789',
      entity: {
        id: 'ent_789',
        name: 'Greenfield International School',
        type: 'school',
        status: 'active',
        industry: 'education',
        email: 'info@greenfield.edu',
        phone: '+233201234567',
        city: 'Accra',
        address: '12 Independence Ave',
        createdAt: '2026-01-15T08:00:00.000Z',
      },
      workspaceEntity: {
        id: 'ws_456_ent_789',
        entityId: 'ent_789',
        workspaceId: 'ws_456',
        pipelineId: 'pipe_sales',
        stageId: 'stage_negotiation',
        stageName: 'Negotiation',
        assignedTo: {
          userId: 'user_1',
          name: 'Sarah Connor',
          email: 'sarah@smartsapp.com',
        },
        workspaceTags: ['high-value', 'q4-target'],
        leadStatus: 'qualified',
        updatedAt: '2026-10-01T12:00:00.000Z',
      },
      contacts: [
        {
          id: 'con_1',
          name: 'Dr. Arthur Greenfield',
          role: 'Headmaster',
          email: 'arthur@greenfield.edu',
          phone: '+233209876543',
          isPrimary: true,
          channelPreferences: ['email', 'whatsapp'],
        },
      ],
      deals: [
        {
          id: 'deal_1',
          title: 'Campus Management Suite Enterprise',
          pipelineId: 'pipe_sales',
          stageId: 'stage_negotiation',
          stageName: 'Negotiation',
          value: 45000,
          currency: 'USD',
          probability: 80,
          ageInDays: 32,
          expectedCloseDate: '2026-11-15',
          isStalled: false,
        },
      ],
      meetings: [
        {
          id: 'meet_1',
          title: 'Executive Demo & Pricing Review',
          startTime: '2026-10-02T14:00:00.000Z',
          attendees: ['arthur@greenfield.edu', 'sarah@smartsapp.com'],
          summary: 'Reviewed custom onboarding milestones. Client requested net-60 payment terms.',
          transcriptSnippet: 'We need confirmation on the SLA before board approval on Tuesday.',
          sentiment: 'positive',
        },
      ],
      notes: [
        {
          id: 'note_1',
          content: 'Follow-up call with bursar confirmed budget is allocated.',
          authorName: 'Sarah Connor',
          createdAt: '2026-10-03T09:30:00.000Z',
          category: 'commercial',
        },
      ],
      tasks: [
        {
          id: 'task_1',
          title: 'Send amended SLA agreement',
          status: 'pending',
          priority: 'high',
          dueDate: '2026-10-06T17:00:00.000Z',
          assignedToName: 'Sarah Connor',
          isOverdue: false,
        },
      ],
      finances: {
        openBalance: 0,
        overdueBalance: 0,
        currency: 'USD',
        invoiceCount: 0,
        agingCategory: 'CURRENT',
      },
      memories: [
        {
          id: 'mem_1',
          content: 'Greenfield School prefers WhatsApp for operational notifications and email for invoicing.',
          sourceType: 'note',
          confidence: 0.95,
          citationId: 'cite_123',
        },
      ],
      timeline: [
        {
          id: 'tl_1',
          timestamp: '2026-10-03T09:30:00.000Z',
          category: 'COMMERCIAL',
          title: 'Note Added',
          summary: 'Follow-up call with bursar confirmed budget is allocated.',
          actor: 'Sarah Connor',
          sourceRef: { type: 'note', id: 'note_1' },
        },
      ],
      metadata: {
        assembledAt: '2026-10-04T18:00:00.000Z',
        durationMs: 240,
        estimatedTokens: 1450,
        correlationId: 'corr_test_1',
        isKnapsackCompressed: false,
      },
    };

    const parsed = Account360ContextSchema.safeParse(validContext);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid or missing tenant fields', () => {
    const invalid = {
      entityId: 'ent_789',
    };
    const parsed = AssembleAccountContextOptionsSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('throws typed AccountContextError with structured error codes', () => {
    const err = new AccountContextError(
      'Account entity not found',
      ACCOUNT_CONTEXT_ERROR_CODES.ENTITY_NOT_FOUND,
      404,
      { entityId: 'ent_missing' }
    );
    expect(err.name).toBe('AccountContextError');
    expect(err.code).toBe('ENTITY_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/agents/crm/account-context-contracts.test.ts`
Expected: FAIL with module not found `account-context-types`.

- [ ] **Step 3: Write minimal implementation**

Author `src/platform/agents/crm/context/account-context-types.ts` as specified in Section 4.1.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/agents/crm/account-context-contracts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/agents/crm/context/account-context-types.ts src/platform/__tests__/agents/crm/account-context-contracts.test.ts
git commit -m "feat(crm-agent): add canonical 360 account context and timeline contracts"
```

---

### Task 2: Multi-Domain Data Aggregation Engine (`account-context-assembler.ts`)

**Files:**
- Create: `src/platform/agents/crm/context/account-context-assembler.ts`
- Test: `src/platform/__tests__/agents/crm/account-context-assembler.test.ts`

- [ ] **Step 1: Write the failing assembler test**

```typescript
// src/platform/__tests__/agents/crm/account-context-assembler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountContextAssembler } from '../../../agents/crm/context/account-context-assembler';
import { AccountContextError } from '../../../agents/crm/context/account-context-types';

describe('AccountContextAssembler (Milestone 1)', () => {
  let assembler: AccountContextAssembler;

  beforeEach(() => {
    vi.clearAllMocks();
    assembler = new AccountContextAssembler();
  });

  it('assembles a full 360 account context package across multiple domains', async () => {
    const mockContext = await assembler.assembleContext({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      entityId: 'ent_school_1',
      maxTokens: 4000,
      includeMemory: true,
      includeFinancials: true,
    });

    expect(mockContext).toBeDefined();
    expect(mockContext.organizationId).toBe('org_test');
    expect(mockContext.workspaceId).toBe('ws_test');
    expect(mockContext.entity.id).toBe('ent_school_1');
    expect(mockContext.metadata.estimatedTokens).toBeLessThanOrEqual(4000);
  });

  it('wraps untrusted notes and transcripts in XML isolation containers', async () => {
    const context = await assembler.assembleContext({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      entityId: 'ent_with_notes',
    });

    for (const note of context.notes) {
      expect(note.isolatedContent).toContain('<untrusted_reference_data');
      expect(note.isolatedContent).toContain('</untrusted_reference_data>');
    }
  });

  it('enforces dead-man switch evaluation failing closed when paused', async () => {
    vi.spyOn(assembler, 'isGovernancePaused').mockResolvedValue(true);

    await expect(
      assembler.assembleContext({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        entityId: 'ent_test',
      })
    ).rejects.toThrow(AccountContextError);
  });

  it('supports cooperative cancellation via AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      assembler.assembleContext({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        entityId: 'ent_test',
        signal: controller.signal,
      })
    ).rejects.toThrow(/cancelled/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/agents/crm/account-context-assembler.test.ts`
Expected: FAIL with module not found `account-context-assembler`.

- [ ] **Step 3: Write minimal implementation**

Author `src/platform/agents/crm/context/account-context-assembler.ts`:
- Multi-domain parallel queries across `adminDb` collections:
  - Global entity `/entities/{entityId}` & workspace record `/workspace_entities/{workspaceId}_{entityId}` (Rule 69 dual-tier preservation).
  - Contacts associated with entity via `resolveEntityContacts`.
  - Deals via `/deals` where `entityId == targetEntityId`.
  - Meetings via `/meetings` where attendee or subject matches entity.
  - Notes via `/notes` where `entityId == targetEntityId`.
  - Invoices via `/invoices` where `entityId == targetEntityId`.
  - Tasks via `/tasks` where `entityId == targetEntityId`.
  - Semantic memory via `CanonicalMemoryService.searchSemanticMemory` with tenant payload filter (`organizationId` & `workspaceId`).
- Prompt injection defense scanning:
  - Scans note/transcript contents for injection patterns (`IGNORE ALL PREVIOUS INSTRUCTIONS`, etc.).
  - Wraps external text in `<untrusted_reference_data source="..." id="...">` (Rules 13 & 30).
- Linear non-backtracking credential redaction (Rules 32 & 33).
- Stratified knapsack compression keeping output strictly $\le 4,000$ tokens (Rules 28 & 56).
- Dead-man switch check (`checkGovernanceDeadManSwitch(organizationId)`, Rule 60).
- Cooperative cancellation check (`signal?.aborted`, Rule 26).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/agents/crm/account-context-assembler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/agents/crm/context/account-context-assembler.ts src/platform/__tests__/agents/crm/account-context-assembler.test.ts
git commit -m "feat(crm-agent): implement multi-domain account context assembler with prompt injection defense"
```

---

### Task 3: Universal Timeline Assembly & Normalization Engine (`account-timeline-service.ts`)

**Files:**
- Create: `src/platform/agents/crm/context/account-timeline-service.ts`
- Create: `src/platform/agents/crm/context/index.ts`
- Create: `src/platform/agents/crm/index.ts`
- Test: `src/platform/__tests__/agents/crm/account-timeline-service.test.ts`

- [ ] **Step 1: Write the failing timeline service test**

```typescript
// src/platform/__tests__/agents/crm/account-timeline-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountTimelineService } from '../../../agents/crm/context/account-timeline-service';
import type { Account360Context } from '../../../agents/crm/context/account-context-types';

describe('AccountTimelineService (Milestone 1)', () => {
  let service: AccountTimelineService;

  beforeEach(() => {
    service = new AccountTimelineService();
  });

  it('normalizes heterogeneous domain events into chronological order', () => {
    const mockContext: Partial<Account360Context> = {
      notes: [
        {
          id: 'n1',
          content: 'Discussed renewal terms',
          authorName: 'Alice',
          createdAt: '2026-10-02T10:00:00Z',
          category: 'commercial',
        },
      ],
      meetings: [
        {
          id: 'm1',
          title: 'Board Meeting',
          startTime: '2026-10-03T15:00:00Z',
          attendees: ['alice@smartsapp.com'],
          summary: 'Approved roadmap',
          sentiment: 'positive',
        },
      ],
      deals: [
        {
          id: 'd1',
          title: 'Upgrade Deal',
          pipelineId: 'p1',
          stageId: 's1',
          stageName: 'Negotiation',
          value: 20000,
          currency: 'USD',
          probability: 70,
          ageInDays: 10,
          isStalled: false,
        },
      ],
      tasks: [
        {
          id: 't1',
          title: 'Send invoice',
          status: 'completed',
          priority: 'medium',
          dueDate: '2026-10-01T12:00:00Z',
          assignedToName: 'Alice',
          isOverdue: false,
        },
      ],
    };

    const timeline = service.normalizeTimeline(mockContext as Account360Context);

    expect(timeline.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < timeline.length - 1; i++) {
      const current = new Date(timeline[i].timestamp).getTime();
      const next = new Date(timeline[i + 1].timestamp).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it('caches assembled timeline with 3-minute TTL and invalidates on EventBus event', async () => {
    const key = { orgId: 'org_1', wsId: 'ws_1', entityId: 'ent_1' };
    const timeline = [{ id: '1', timestamp: new Date().toISOString(), category: 'COMMERCIAL', title: 'Test', summary: 'Test', actor: 'Alice', sourceRef: { type: 'note', id: 'n1' } }];

    service.setCachedTimeline(key.orgId, key.wsId, key.entityId, timeline);
    expect(service.getCachedTimeline(key.orgId, key.wsId, key.entityId)).toEqual(timeline);

    service.invalidateCache(key.orgId, key.wsId, key.entityId);
    expect(service.getCachedTimeline(key.orgId, key.wsId, key.entityId)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/platform/__tests__/agents/crm/account-timeline-service.test.ts`
Expected: FAIL with module not found `account-timeline-service`.

- [ ] **Step 3: Write minimal implementation**

Author `src/platform/agents/crm/context/account-timeline-service.ts`:
- Normalizes heterogeneous events into `AccountTimelineItem[]` sorted descending by timestamp.
- Assigns semantic impact categories (`COMMERCIAL`, `ENGAGEMENT`, `OPERATIONAL`, `FINANCIAL`, `ADMINISTRATIVE`).
- Multi-tenant in-memory TTL cache (`TimelineCacheStore`, default 3 minutes) keyed by `${organizationId}_${workspaceId}_${entityId}` (Rule 50).
- Subscribes to `crm.activity.created`, `deal.updated`, `note.created` via `defaultEventBus` to evict cached records automatically.
- Publishes `crm.account.context_assembled` and `crm.timeline.assembled` events (Rule 40).
- Barrels: `src/platform/agents/crm/context/index.ts` and `src/platform/agents/crm/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/agents/crm/account-timeline-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/agents/crm/context/account-timeline-service.ts src/platform/agents/crm/context/index.ts src/platform/agents/crm/index.ts src/platform/__tests__/agents/crm/account-timeline-service.test.ts
git commit -m "feat(crm-agent): implement universal account timeline service with TTL caching and event invalidation"
```

---

### Task 4: Milestone 1 End-to-End Integration, Boundary & Security Tests

**Files:**
- Create: `src/platform/__tests__/agents/crm/account-context-integration.test.ts`

- [ ] **Step 1: Write comprehensive integration and boundary test suite**

Author `src/platform/__tests__/agents/crm/account-context-integration.test.ts`:
- Tests end-to-end context assembly combining `AccountContextAssembler` and `AccountTimelineService`.
- Verifies dual-tier CRM data model preservation (`entities` base identity + `workspace_entities` operational state).
- Verifies prompt injection defense (neutralizes adversarial prompt strings inside notes).
- Verifies knapsack context budgeting ceiling ($\le 4,000$ tokens).
- Verifies anti-IDOR tenant lock (rejects cross-tenant context retrieval).
- Verifies dead-man switch evaluation (halts assembly when governance dead-man is active).

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm vitest run src/platform/__tests__/agents/crm/account-context-integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Run full platform typecheck and lint verification**

Run: `NODE_OPTIONS='--max-old-space-size=8192' pnpm typecheck`
Expected: Clean exit code 0, 0 errors.

Run: `pnpm lint`
Expected: Clean exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/platform/__tests__/agents/crm/account-context-integration.test.ts
git commit -m "test(crm-agent): add end-to-end integration and security test suite for Milestone 1"
```

---

## 6. Verification Checklists & Acceptance Criteria

### 6.1 Strict Typing & Quality
- [ ] Absolute zero `any` or `any[]` (Rule 4).
- [ ] All schemas authored with `import { z } from 'zod/v4'` (Rule 10).
- [ ] Clean TypeScript static compilation (`tsc --noEmit`).
- [ ] Clean ESLint analysis with zero new warnings.

### 6.2 Security & Multi-Tenancy
- [ ] Anti-IDOR tenant validation strictly enforced on all queries (`organizationId` & `workspaceId`, Rules 8 & 47).
- [ ] External notes, customer emails, and meeting transcripts wrapped in `<untrusted_reference_data id="...">` containers (Rules 13 & 30).
- [ ] Linear non-backtracking regular expressions redact credentials and PII (Rules 32 & 33).
- [ ] Dead-man switch evaluated before context assembly (Rule 60).

### 6.3 Dual-Tier CRM Data Model (Rule 69)
- [ ] Global identity reads from `/entities/{entityId}`.
- [ ] Workspace operational state reads from `/workspace_entities/{workspaceId}_{entityId}`.
- [ ] Zero accidental mutation or overwrite of global entity identity.

### 6.4 Performance & Context Budgeting
- [ ] Sub-retrievals strictly bounded (`limit <= 50`, Rule 9).
- [ ] Context assembly latency $\le 1,500\text{ms}$ (Rule 54).
- [ ] Knapsack context budgeting ceiling enforced $\le 4,000$ tokens (Rules 28 & 56).
- [ ] In-memory TTL cache with EventBus reactive invalidation.
