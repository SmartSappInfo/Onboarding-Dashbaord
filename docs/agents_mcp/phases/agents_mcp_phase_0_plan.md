# SmartSapp Unified Agentic & MCP Transformation: Phase 0 Plan & Remediation Roadmap
**Architecture Freeze, Real AST Inventory, Cloud Run Topology & Executable Behavioral Baseline**

---

## 1. Status (updated 2026-09-27)

**Status: IN PROGRESS — not certified.** The round-2 review blockers R1–R7 and the round-3 findings (§5) are fixed and verified. Phase 0's exit gate (roadmap: *"No major domain can be migrated until its current behavior is represented by executable regression tests"*) is met for the Phase 1 domains Identity, CRM and Portals. The Phase 0 deliverables listed in §6 are still open.

Numbers in this document come from commands run on 2026-09-27; re-run them rather than copying figures forward.

### Release gates (roadmap §34 definitions)

| Gate | Phase 0 status | Evidence |
| :--- | :--- | :--- |
| **A — Functional** (current behavior locked by executable tests) | **Met at service level for Phase 1 domains** (no end-to-end journeys yet) | `pnpm test:agentic:baseline`: 43 files, 444 tests pass. Includes 30 existing Identity/CRM/Portal suites listed in `src/platform/__tests__/baseline/baseline-manifest.json`, plus a new `PortalMembershipService` characterization. Missing: payments, scheduling and the UI critical-journey tests (UI doc §82). |
| **B — Security** (cannot cross tenant, workspace, permission, delegation or approval boundaries) | **Partial** | Evaluator refuses by default, with an explicit tenant target. Every principal declares `actorType`; agent rules apply unless it is an explicit interactive user, and MCP and queued steps are always agents. Approvals are verified server-side and bound to the payload. MCP tenant scope comes from the authenticated principal. The SSRF check runs inside the connection's DNS lookup. 731 actions/routes have no detected guard and still need triage (§5). |
| **C — Agentic** (agent can discover and correctly use capabilities) | **Not started** (Phase 5) | MCP server builds and gates calls, but has no transport route yet. The capability registry exists but is empty until Phase 1. |
| **D — Evaluation** | **Not applicable to Phase 0** | Golden tasks are defined in `docs/agentic/12-evaluation-model.md`; nothing is measured yet. |

---

## 2. Core Architectural Alignments

### 2.1 The Master Axiom (Rule 69)
> **Do not build an "AI layer" beside SmartSapp. Build a governed capability layer underneath SmartSapp that both humans and agents use.**

The agent never interacts with Firestore or external providers directly. The user interface, AI copilots, MCP servers, workflows, mobile app, and backoffice all converge on the **Canonical Capability Layer** (`src/platform/capabilities/` and `src/platform/domains/`).

```
                    HUMAN OPERATOR / MOBILE / API
                                 │
                            IN-APP AGENT
                                 │
                    MCP CLIENTS / STREAMABLE HTTP
                                 │
                     ┌───────────▼───────────┐
                     │ POLICY + TRUST MATRIX │ (Rules 13, 16, 47, 48)
                     └───────────┬───────────┘
                                 │
                        CAPABILITY REGISTRY
                     (Versioned, Hashed, Typed)
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
      CRM DOMAIN         EXPERIENCE/PORTALS        MESSAGING / SALES
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                          DOMAIN SERVICES
                                 │
                ┌─────────────────┴─────────────────┐
                ▼                                   ▼
        FIRESTORE (Truth)                  QDRANT (Semantic)
        Ambient Cloud Run Auth             Multi-tenant Shards
```

### 2.2 Cloud Run Serverless Architecture Alignment
SmartSapp is deployed on Google Cloud Run via GitHub Actions. The MCP server and agent architecture strictly accommodates Cloud Run's serverless constraints:
* **Stateless Streamable HTTP (MCP `2026-07-28` Spec, Rule 11)** — *blueprint, not yet implemented*: domain MCP servers are built by `buildDomainMcpServer`; the Streamable HTTP route (`createMcpHandler`) lands in Phase 5. Header names such as `Mcp-Transaction-Id` must be confirmed against the spec before use.
* **Dual-Surface Isolation (`APP_SURFACE`)**: The client application (`smartsapp-app` on `go.smartsapp.com`) and control plane (`smartsapp-backoffice` on `goadmin.smartsapp.com`) are deployed from one container image but strictly isolated at runtime via `src/lib/platform/app-surface.ts`.
* **Ambient Credentials (No JSON Keys)**: In Cloud Run, Firebase Admin self-configures via container `FIREBASE_CONFIG` and Google Cloud Workload Identity Federation (`GCP_RUNTIME_SA`). Zero service account keys exist in the Docker image. Secret Manager mounts provider keys at deployment.
* **Asynchronous Execution via Google Cloud Tasks**: the dispatcher records `agent_runs/{runId}` + `steps/{n}` server-side, then enqueues a task carrying only `{ runId, stepNumber, idempotencyKey }`. The worker claims the step in a transaction (lease + attempt budget), re-authorizes the run's principal, runs the registered capability and records the real outcome. In production a missing queue fails loudly (no in-process `setTimeout` fallback).
* **32 MB Payload Ceiling & Direct Storage**: Cloud Run's 32 MB HTTP limit is respected by routing large documents/audio through Firebase Storage signed URLs, never streaming raw binaries through MCP tool arguments.
* **Metadata Server SSRF Protection (Rule 34)**: one guard, `src/lib/security/ssrf-guard.ts`. `safeUrlFetch` checks every hop's URL (all IPv6 spellings, including mapped/NAT64/6to4 forms of metadata and private addresses), checks every connection's DNS answer inside the connection itself (undici `Agent` lookup — closes DNS rebinding), follows redirects manually and drops credential headers across origins. Both production callers (`api/organizations/scrape`, `api/call-centre/webhook`) use it.

### 2.3 Strict Typing & Single Sources of Truth
* **Modified Rule 4**: `unknown` is permitted **only** at external trust boundaries (incoming HTTP, MCP requests, tool returns, webhooks) and must be immediately validated and narrowed via Zod schemas before reaching domain logic. No `any`, `any[]` or unchecked casts in `src/platform` application code (tests use labelled casts for fakes only).
* **Variables Single Source of Truth**: All template token parsing routes exclusively through `FieldsVariablesService` (`src/lib/services/fields-variables-service-impl.ts`).
* **Tags Single Source of Truth**: All contact tagging operations route exclusively through `tag-actions.ts` / `scoped-tag-actions.ts`.
* **Deployment Gate (Modified Rule 5)**: Automated deployments go to staging first. Production deployment requires explicit approval.

---

## 3. Inventory (generated)

`pnpm audit:agentic-inventory` parses every surface with the TypeScript compiler. It writes `docs/agentic/inventory.json` and `docs/agentic/tool-registry-capability-matrix.md` (tools §7.3). Facts such as collections, guards, permission ids and external APIs come from each capability's own code, including same-file helpers it calls. Risk level and catalog mapping are name-based heuristics and are labelled as such.

| Measure | Value |
| :--- | ---: |
| Capabilities | 2,214 (server actions 1,751 · API handlers 102 · Genkit flows 156 · services 205) |
| API route files covered | 85 / 85 (73 api · 11 webhook · 7 cron · 8 task worker · 3 MCP handlers) |
| Guard detected / explicit permission id | 1,130 / 191 |
| Domain assigned by fallback (`crm_contacts`) | 664 |
| Risk assigned with low confidence | 442 |
| Catalog tools with a candidate implementation | 80 / 310 |
| Gap lists: missing tools · unmapped capabilities · auth gaps · test gaps · duplicate groups | 230 · 1,832 · 731 · 1,478 · 28 |

Capabilities by domain: CRM & Contacts 753 · Forms & Surveys 178 · Lead Intelligence 165 · Automation 132 · Knowledge 123 · Portals 121 · Meetings 120 · Deals 115 · Identity 90 · Media 82 · AI Governance 79 · Messaging 66 · Finance 56 · Analytics 44 · Tasks 35 · Campaigns 23 · Platform Integrations 18 · School Operations 14.

---

## 4. Phase 0 Workstreams & Deliverables

### Workstream 0.1: Capability inventory & coverage matrix
- `scripts/audit-agentic-inventory.ts` (run via `pnpm audit:agentic-inventory`), with pure, unit-tested helpers in `scripts/agentic-inventory/analysis.ts`.
- Outputs `docs/agentic/inventory.json` and `docs/agentic/tool-registry-capability-matrix.md`: full inventory plus catalog coverage and the auth-gap, duplicate, missing-tool, unmapped and test-gap lists.

### Workstream 0.2: Master Architecture Documentation Suite (`docs/agentic/00-15.md`)
16 master specification documents authored and aligned with the 69 rules and Cloud Run constraints:
- `00-master-architecture.md`: Master Axiom, Cloud Run topology, 3-tier memory.
- `01-current-state-inventory.md`: Narrative synthesis (its counts predate the regenerated inventory; the generated matrix is authoritative).
- `02-capability-catalog.md`: Complete taxonomy across all 17 domains (elevating Portals & Experience).
- `03-domain-boundaries.md`: Strict domain boundaries, contracts, and encapsulation.
- `04-data-contracts.md`: Zod schema validation, Modified Rule 4, and core contracts.
- `05-permission-model.md`: Effective Principal formula, L0–L4 risk levels, non-delegable actions.
- `06-event-taxonomy.md`: Canonical `DomainEvent` schema, correlation/causation tracking, dead-letter queues.
- `07-agent-model.md`: Specialized agent profiles, state machines, resource limits.
- `08-memory-model.md`: 5-tier memory, Qdrant multitenant filtering, temporal validity, knowledge poisoning defense.
- `09-mcp-architecture.md`: MCP `2026-07-28` Streamable HTTP, domain partitioning, rug-pull fingerprinting, and allowlisting.
- `10-workflow-architecture.md`: Cloud Tasks durable execution, Saga compensation, cancellation semantics.
- `11-security-model.md`: Trust Boundary Matrix, SSRF protection, Rules 47 & 48.
- `12-evaluation-model.md`: Golden benchmark tasks (`CRM-001`, `PORTAL-001`, `SALES-001`), tool accuracy metrics.
- `13-uiux-architecture.md`: Three-zone shell, Global ⌘K Command Bar, Context Rail, interactive tool cards, human approval modals, and Backoffice Control Plane (`goadmin.smartsapp.com`).
- `14-migration-plan.md`: Strangler migration pattern, feature flag hierarchy, canary rollouts.
- `15-runbooks.md`: Emergency agent kill-switches, tool rug-pull remediation, Cloud Run rollback steps.
- `docs/agents_mcp/agents_mcp_cloudrun.md`: Cloud Run deployment topology, ambient auth, Cloud Tasks, and metadata SSRF defense.

### Workstream 0.3: Capability contracts & runtime primitives
- `src/platform/capabilities/contracts/`
  - `capability-definition.ts`: typed contract. The result type requires `data` on success; `VerifiedApproval` type; required `actorType` on principals with `isAutomatedPrincipal` (fails closed).
  - `risk-levels.ts`: one canonical L0–L4 scale plus the `requiresAgentApproval` rule.
  - `canonical-json.ts`: canonical JSON encoding and hashing.
- `src/platform/capabilities/policy/`
  - `principal-evaluator.ts`: pure evaluator; refuses by default, returns violation codes.
  - `approval-verifier.ts`: server-side `capability_approvals` records, single-use binding.
- `src/platform/capabilities/registry/capability-registry.ts`: the one capability lookup (populated in Phase 1).
- `src/platform/capabilities/registry/register-capabilities.ts`: the single registration entry point, called by the worker and the dispatcher. Phase 1 adds domain registrars here.
- `src/platform/tasks/`
  - `agent-step-contract.ts`: Zod records (steps pin `capabilityVersion`) and pure claim rules.
  - `agent-step-executor.ts`: claim → authorize → validate → execute → record.
  - `firestore-agent-step-store.ts`: Firestore adapter.
  - `cloud-tasks-dispatcher.ts`: writes run/step records, then enqueues.
- `src/app/api/tasks/agent-step/route.ts`: thin worker route.
- `src/platform/mcp/`
  - `create-stateless-handler.ts`: authenticated caller required; tenant taken from the principal; validated input; output validation; audit sink required for audited capabilities.
  - `to-mcp-tool-schema.ts`: Zod v4 → MCP SDK v2 schema adapter.
- `src/lib/security/ssrf-guard.ts`: single SSRF guard with a pinned-lookup `safeUrlFetch`. `src/platform/security/safe-url-fetch.ts` re-exports it.
- Dependencies: `@modelcontextprotocol/server@2.1.0` and `undici@7.25.0` (MIT; Node ≥ 20.18.1 — chosen over v8, which needs Node ≥ 22.19 while `package.json` allows 22.13).

### Workstream 0.4: Behavioral baseline
- `pnpm test:agentic:baseline` runs the platform suites plus the existing domain suites in `src/platform/__tests__/baseline/baseline-manifest.json`:
  - Identity: 8 suites (auth guards, permissions engine, workspace permissions, role templates, cross-tenant messaging isolation).
  - CRM: 14 suites (contact adapter, workspace entity actions, pipeline/stage isolation, tag actions, entity security properties).
  - Portals: 9 suites, including the new `portal-membership.baseline.test.ts`. It pins current `PortalMembershipService` behavior, including five labelled KNOWN RISK cases for Phase 1 to change deliberately.
- `agentic-baseline-manifest.test.ts` fails if a listed suite is renamed or deleted.
- Platform suites use an in-memory Firestore fake (`src/platform/__tests__/helpers/fake-firestore.ts`) with serialized transactions. The SSRF suites are fully offline (stubbed DNS, undici `MockAgent`).

---

## 5. Verification evidence (2026-09-27)

| Check | Command | Result |
| :--- | :--- | :--- |
| Typecheck | `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit` | 0 errors |
| Lint (changed code) | `npx eslint src/platform src/lib/security src/app/api/tasks/agent-step scripts/agentic-inventory …` | 0 errors, 0 warnings |
| Agentic baseline | `pnpm test:agentic:baseline` | 43 files, 444 tests passed (after round 3) |
| Full suite (round 2; round 3 only changed `src/platform`, which only the worker route imports) | `npx vitest run` | 677 files passed, 1 failed, 8 skipped (5,142 tests passed). The failure, `platform-controls-client.test.tsx` "will not pause without a reason", times out at 30 s under full-suite load and passes on its own (9/9). It is pre-existing and unrelated. |

Round-2 blockers closed:

| # | Blocker | Fix |
| :--- | :--- | :--- |
| R1 | Worker marked steps completed without executing | Transactional claim with lease and attempt budget; executes via registry; real outcome recorded; 503/409 drive Cloud Tasks retries |
| R2 | MCP tenant check could never fail; anonymous fallback | Required `getPrincipal`; arguments naming another tenant refused; parsed input only; generic errors; audit |
| R3 | Approval proofs self-asserted | `VerifiedApproval` produced only by the approval verifier, bound to capability + version + tenant + payload hash + invocation, single-use |
| R4 | Bracketed IPv6 bypassed the sync check; DNS resolved twice | IPv6 parser (mapped/NAT64/6to4/ULA/…); lookup-time DNS check; production routes on `safeUrlFetch` |
| R5 | Inventory missed 58/85 routes and invented permissions | Unique ids per route handler; per-function facts; no fabricated permissions; catalog reconciliation and gap lists |
| R6 | CRM/Identity/Portal baselines did not exercise real code | Existing domain suites wired into the baseline; new `PortalMembershipService` characterization; tautological tests removed |
| R7 | Duplicate risk names; plan claims inaccurate | One L0–L4 name per level (fixture aligned and asserted); this document rewritten from measured results |

Round-3 findings (self-review of the round-2 fixes):

| # | Finding | Resolution |
| :--- | :--- | :--- |
| 1 | Agent rules skipped when a principal omitted `agentId` (e.g. an MCP client using a user token) | **Fixed.** Required `actorType`; `isAutomatedPrincipal` fails closed; MCP and dispatcher force `'agent'`. Tests show the old logic fails them. |
| 2 | Steps not pinned to a capability version (Rule 36) | **Fixed.** Steps store `capabilityVersion`; the worker fails on mismatch (`CAPABILITY_VERSION_MISMATCH`). |
| 3 | Steps stuck in `running`/`retry_pending` have no recovery once Cloud Tasks gives up | **Deferred to Phase 7**; entry criterion in §6. |
| 4 | Worker checks only a shared secret, not the Cloud Tasks OIDC token | **Deferred**, tied to secret rotation; §6. |
| 5 | Re-execution after a crash depends on every handler honoring the idempotency key | **Deferred to Phase 1**: contract test for every registered capability; §6. |
| 6 | No wiring to load capabilities in the worker process | **Fixed.** `ensureCapabilitiesRegistered()` is the single entry point, called by the worker and dispatcher. |
| 7 | Scanner counted `JSON.parse` as input validation | **Fixed.** `JSON.parse` / `Date.parse` excluded; tested. |
| 8 | Cross-tenant input check covers top-level ids only | **By design**, documented: resource ownership (e.g. `entityId` belongs to the tenant) is each capability's job; Phase 1 contract requirement in §6. |
| 9 | Gate A wording too generous | **Fixed.** Now "met at service level". |

---

## 6. Remaining Phase 0 work (before certification)

- [ ] Triage the 731 auth gaps in the matrix. Confirmed real gaps so far:
    - `api/automations/webhook/[id]` (no check);
    - `api/call-centre/webhook` and `api/organizations/scrape` (unauthenticated; tracked as a separate task);
    - `membership-actions.ts` (no guard; actor defaults to `'system'`);
    - `law-actions.ts` (`'use server'` file using the client Firestore SDK).
- [ ] Confirm or correct the heuristic catalog mapping (80/310 tools have candidates) and record deliberate exclusions for unmapped capabilities.
- [ ] Deliverables still missing:
    - data classification and MCP compatibility matrix (rules §66);
    - PRD Phase 0 interfaces (`MemoryObject`, `KnowledgeObject`, Graph, Memory Service, ContextBuilder, Agent);
    - `docs/ux/00–09` inventory and critical-journey E2E tests (UI doc §82).
- [ ] Payments and scheduling baselines.
- [ ] Harden the `ai-admin` proposal approval flow: cross-org approval, dual approval not enforced, self-approval (tracked as a separate task).
- [ ] Rotate `CLOUD_TASKS_SECRET` and remove its hardcoded fallback before any agent worker ships.
- [ ] Commit on a branch (lockfile included).

**Entry criteria carried into later phases (from round 3):**
- [ ] Phase 1 — a contract test every registered capability must pass: same idempotency key twice ⇒ one side effect; foreign-tenant resource ids ⇒ refused.
- [ ] Phase 1 — each domain registrar added to `DOMAIN_REGISTRARS` in `register-capabilities.ts`.
- [ ] Phase 7 — a recovery sweeper for steps stuck in `running` past their lease or in `retry_pending`, plus dead-letter handling (Rule 25). Also provision `agent-worker-queue` with an explicit retry policy.
- [ ] Before any agent worker ships — verify the Cloud Tasks OIDC token in the worker, and remove the hardcoded dev secret from `cloud-tasks-auth.ts`.

## 7. Next phase: Phase 1 (Canonical Domain Capability Layer)

Once §6 is closed:
1. Capability adapters for Identity & Access and CRM & Contacts under `src/platform/domains/`, registered in the capability registry.
2. Adapters for Experience Platform & Portals. The KNOWN RISK cases in `portal-membership.baseline.test.ts` are changed deliberately there.
3. Strangler pattern: existing actions call the adapters; the baseline must stay green.
4. Agent shell UI per `docs/agentic/13-uiux-architecture.md`.
