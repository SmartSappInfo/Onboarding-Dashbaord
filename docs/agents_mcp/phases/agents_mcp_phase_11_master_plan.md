# SmartSapp Agentic & MCP Transformation: Phase 11 Master Implementation Plan
## Third Agent Wave: Meetings, Knowledge & Customer Intelligence Agents
### Conforms to `docs/agents_mcp/agents_mcp_rules.md` (Important Rules 1–10 as amended, Rules 11–69), `.agents/AGENTS.md`, and `theme.md` §8

**Version:** 1.1.0. Rules-conformance revision: every rule 1–69 is mapped to a concrete design decision, milestone task and verification (§7).
**Status:** PLANNING. Decisions D1–D4 (§14) must be confirmed before Milestone 0 starts.
**Date:** 2026-10-05
**Change log:**
- 1.0.0: initial plan.
- 1.1.0: full rules conformance. Added the trust-boundary matrix (§5.2), idempotency/approval-binding contracts (§5.4–5.5), budgets (§5.6), the risk register (§9, Rule 2), affected features and Backoffice (§10, Rule 3), UX rules (§11, Rule 7), the deployment policy (§12, Rule 5), the tracker (§13, Rule 1), the functionality-preservation guarantees (§3) and the per-rule matrix (§7).

**Governing documents (all reviewed for this plan):**

| Document | Sections used |
| --- | --- |
| [`agents_mcp_rules.md`](../agents_mcp_rules.md) | Important Rules 1–10 with the amended Rules 4 and 5; Rules 11–65; §66 cross-cutting gates for Phases 0–8 and the Phase 9–13 domain-agent deliverables; §67 Agent Implementation Gate; §68 Five Non-Negotiables; §69 governed capability layer; closing definition of done. |
| [`.agents/AGENTS.md`](../../../.agents/AGENTS.md) | `FieldsVariablesService` SSOT; `<TagSelector>` SSOT; actionable toasts (relative `actionConfig.path` only); Git & deployment protocol (no push unless asked in the current request; verify with `pnpm typecheck` + `pnpm lint`; no full local build); strict typing; no raw HTML/CSS; mobile-first; theme.md §8 modals. |
| `.agents/skills/` | `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations`, `frontend-design`, `backend-patterns`, `firebase-security-rules-auditor`, `cybersecurity-analyst`, `mcp-builder`, `qdrant`, `firebase-ai-logic`, `test-driven-development`, `writing-plans`, `verification-before-completion`, `systematic-debugging` (usage map §13.2). |
| [`agents_mcp_roadmap.md`](../agents_mcp_roadmap.md) | Phase 11 (1669–1729). Phase 4 memory (825–1003). Phase 7 known-process rule (1222–1247). §13 test pyramid; §19 retrieval algorithm; §20 graph schema; §34 release gates; §35 definition of done. |
| [`agents_mcp_tools.md`](../agents_mcp_tools.md) | Domain 4 (702–1300); Domain 5 task origin and idempotency; Domain 6 (1535–1600, consent rule); Domain 7 Zero-Silent-Send. |
| [`agents_mcp_prd.md`](../agents_mcp_prd.md) | §22–26 graph; §27–28 ingestion; §32–35 processing, extraction, consolidation, contradictions; §58–59 agents and memory policy; §62 Knowledge Inbox; §66–76 permissions, visibility, sensitivity, isolation, injection, exfiltration, middleware, audit, retention, deletion. |
| [`agents_mcp_ui.md`](../agents_mcp_ui.md) | Phase 11 UI (3499–3520); §35 Meeting Intelligence Surface (1488–1525); §14–18 Knowledge Inbox, Inspector, Search, Graph (643–915). |
| [`agents_mcp_cloudrun.md`](../agents_mcp_cloudrun.md), [`agents_mcp_idea.md`](../agents_mcp_idea.md) | Stateless Cloud Run and Cloud Tasks; memory layers, provenance and the feedback loop. |
| `docs/agentic/02, 03, 06, 07, 08` | `knowledge_memory` / `meetings_conversations` catalog; `meeting_prep` persona; 5-tier memory; `<untrusted_reference_data>`; mandatory tenant vector filter. |
| Phase 9/10 plans + 2026-10-04/05 code reviews | Conventions; Account360 reuse; honest baseline (§2). |

---

## 1. Executive Summary

Phase 9 taught SmartSapp to understand an account. Phase 10 taught it to grow the pipeline. **Phase 11 makes SmartSapp remember what was said and agreed.**

1. **Meeting Agent.**
   - Before a meeting it prepares a cited brief: the client, history, open deals, open commitments, risks, agenda and questions.
   - After a meeting it turns the transcript into topics, buying signals, decisions, commitments, tasks, CRM update proposals and a follow-up draft. Every item points to the transcript span it came from.
2. **Knowledge Agent.** It answers questions like *"What have we discussed about payment terms with this school?"* using agentic RAG: semantic, structured CRM, meetings, a bounded graph, temporal filtering and conflict detection. The answer is an **evidence stack**.
3. **Customer intelligence substrate.** Meeting-derived facts, decisions, commitments and relationships go through the **Knowledge Inbox** for review into persistent memory and the graph. Each carries provenance, confidence, temporal validity and sensitivity, and Phase 9's Account360 consumes them.

**Architectural rule (Rule 69):** nothing in Phase 11 is an "AI layer beside SmartSapp". The UI, the agents, MCP and workflows all call the same governed capabilities through `executeCapability`.

### 1.1 Signature workflows

**A. Post-meeting.** This is a known process, so it runs as a deterministic durable workflow with LLM steps (roadmap Phase 7; Rule 47 pipeline).
```text
Transcript ingested (consent verified · server-only write · injection scan · hash recorded)
  → chunk by speaker turns (≤ 6k tokens/chunk)
  → extract per chunk [Flash] → schema validation → business validation → evidence-span validation
  → merge & dedupe (stable item hashes)
  → summarize [Pro] (grounded only in validated items)
  → Knowledge Inbox candidates (never straight to memory)
  → tasks (L1, idempotent, undoable) · CRM proposals (L2) · follow-up draft (L3, draft only)
  → PREVIEW → APPROVE (bound to exact payload) → EXECUTE via executeCapability → VERIFY postconditions
```

**B. Knowledge query.** This is an unknown process, so it runs as a bounded planner at query time.
```text
question → resolve subject → plan ≤ 8 retrievals (parallel) → per-item authorization
        → rank (relevance · temporal decay · source diversity) → context budget ("found 183, using 17")
        → answer [Pro] constrained to citations → drop uncited claims → evidence stack
```

---

## 2. Honest Baseline (verified in code, 2026-10-05)

### 2.1 Assets reused, not rewritten (Rules 7, 69)

| Asset | Location | State |
| --- | --- | --- |
| Transcript model and utilities | `src/lib/meetings/transcript-service.ts`, `types/intelligence.ts` | Real |
| Intelligence prompt builder + parser | `src/lib/meetings/ai-intelligence-service.ts` | Real |
| Action-item extraction | `src/lib/meetings/action-items-service.ts` | Real (heuristic) |
| Meeting intelligence + prep brief actions | `src/app/actions/meeting-intelligence-actions.ts` | Real model call; **defects B1/B2** |
| Recording registry | `src/app/actions/meeting-recording-actions.ts` | Real |
| Compliance: host consent flag, GDPR retention purge, audit CSV | `src/lib/meetings/compliance-service.ts` | Partial |
| Unified meeting model | `src/lib/meetings/unified-meeting-service.ts` | Real |
| Account360 assembler + timeline | `src/platform/agents/crm/context/*` | Real |
| Knowledge Inbox, insights, relations | `src/lib/knowledge-inbox-repository.ts`, `knowledge-relation-repository.ts` | Real (Quick Notes) |
| Memory 2.0 repositories and engines | `src/lib/memory/*` (`memory_objects`, `graph_nodes`, `graph_edges`, `memory_conflicts`, conflict, consolidation, freshness, context builder) | Firestore-backed; **pipeline not wired** |
| Note vector index | `src/lib/note-index-repository.ts`, `src/ai/flows/embed-note-flow.ts` | **Real and wired** |
| Genkit gateway + flows | `src/ai/genkit.ts` (`getModel`, fallbacks), `extract-memories-flow.ts`, `resolve-entities-flow.ts` | Real |
| DOCX parsing | `mammoth` (already a dependency) | Real |
| Brain UI | `src/app/admin/brain`, `src/components/brain/*` | Real |
| Backoffice screens | `meetings-monitor`, `knowledge-graph`, `approvals`, `prompts`, `features`, `audit`, `companybrain` | Real |
| Durable workflows | `src/platform/workflows/*` + Cloud Tasks workers | **Executes** |
| `meeting_prep` persona | `src/platform/identity/agent-registry.ts` | Registered |

### 2.2 Defects Phase 11 fixes (not works around)

| # | Finding | Fix (milestone) |
| --- | --- | --- |
| B1 | Meeting intelligence **fabricates a transcript** when none exists | Fail closed; UI offers "Add transcript" (M1) |
| B2 | Meeting not verified to belong to the caller's workspace (IDOR) | Resource-ownership check on every meeting read (M1) |
| B3 | Clients may write `meeting_transcripts` / `meeting_intelligence` | Server-write-only rules. Verified: **no client code writes these today**, so no feature breaks (M1) |
| B4 | No production transcript source | Ingestion (M1, D1) |
| B5 | Platform memory is in-RAM with no embeddings; three parallel stores | One SSOT (M0, D2) |
| B6 | Agent paths call `capability.handler()` directly | Everything routes through `executeCapability` (M0) |
| B7 | CRM proposal execute performs no mutation; rollback only flips status | Real mutation + real compensation (M0) |
| B8 | Any org member can approve; workflow waits create no inbox item; resume uses the in-process bus | Permissioned, durable approvals (M0) |
| B9 | `smartsapp-resumption-secret-fallback`; SDR fallback phone; module-level `Map` state | Removed / persisted (M0) |
| B10 | Phase 9/10 "AI" outputs are templates | Phase 11 uses real Genkit calls, labelled honestly when unavailable (all) |
| B11 | MCP exposes tools only | Resources + prompts for meetings/knowledge (M4) |
| B12 | Long transcripts exceed the 1 MiB Firestore doc limit | Segments subcollection (M1) |

---

## 3. Functionality Preservation (Important Rules 1–3; "without compromising functionality")

| Existing feature | Guarantee | How it is verified |
| --- | --- | --- |
| All `/admin/meetings/*` routes, booking, calendars, polls, webinars, compliance pages | Untouched; Phase 11 only adds panels behind `FF_MEETING_AGENT` | Existing meetings test suites stay green; route smoke tests |
| Existing `generateMeetingIntelligenceAction` / `getMeetingIntelligenceAction` / `convertActionItemToCrmTaskAction` / `generateMeetingPrepBriefAction` | Same exported signatures (Strangler Fig); internals delegate to new capabilities | Existing tests + new contract tests |
| Stored `meeting_intelligence` docs | Read as-is; a new `schemaVersion` field distinguishes v2 documents | Migration-free read adapter test |
| Quick Notes, note search (`note_index`), knowledge inbox for notes | Unchanged; the knowledge agent reads `note_index` through an adapter | Quick Notes tests green |
| Phase 9 Meeting Brief UI / `getMeetingBriefAction` | Same surface; backing implementation upgraded from template to grounded synthesis with a **template fallback when the model is unavailable**, clearly labelled | Contract test + model-down test |
| Phase 10 sales flows touched by M0 (proposal execute, SDR state) | Behaviour becomes real (mutation happens, state persists); UI contracts unchanged | Existing sales tests + new E2E |
| Brain UI and Backoffice knowledge graph | Unchanged reads; new verification-state badges are additive | UI tests |

**Deliberate behaviour changes** (documented in the release notes; each one removes incorrect behaviour):
1. No transcript means no intelligence. Previously a fabricated transcript produced fake output.
2. Approving now requires the `approvals:decide` permission and workspace membership. Previously any org member could approve.
3. "Execute proposal" now changes the record. Previously it only reported success.

---

## 4. Definition of Done (rules §69 closing + §35 roadmap; stricter than Phases 4–10)

A task, milestone or phase is complete only when:
1. **It is functionally correct**, with no template presented as AI, no fabricated input and no false "success".
2. **It is secure under adversarial input:** the red-team suite passes (Rule 46).
3. **It is tenant-safe:** cross-org and cross-workspace probes fail (Rule 8).
4. **It is retry-safe:** idempotency and duplicate-delivery tests pass (Rules 19–20).
5. **It is observable:** OTel spans and audit entries are present (Rules 39–40).
6. **It is recoverable:** cancel, DLQ, compensation and replay are tested (Rules 25–27, 43).
7. **It is evaluated:** eval datasets meet the thresholds in §8.
8. **It is documented:** `@fileOverview` and caution comments (Rule 10), plus the runbook.
9. **It is operable from Backoffice without code** (Rules 15, 60–61).
10. **Pre-existing behaviour is proven intact** (§3).
11. **Local checks pass:** `pnpm typecheck` + `pnpm lint` + affected Vitest pass locally (AGENTS.md). CI on `main` (typecheck, lint, Vitest, Next build, rules) passes once the user asks to push.
12. **The completion report cites evidence**: test names and CI run IDs, plus Rule 67 gate answers. Any "N/A" carries an explanation.

---

## 5. Architecture & Contracts

### 5.1 Memory SSOT (resolves B5; decision D2)

```text
CanonicalMemoryService (src/platform/memory) ── the only façade agents/capabilities use
   ├─ FirestoreMemoryStore      memory_objects            (adapter over src/lib/memory repo)
   ├─ FirestoreVectorStore      memory_objects.embedding  findNearest + mandatory org/workspace pre-filter
   ├─ GraphStore                graph_nodes / graph_edges (PRD §22: Firestore projection; no graph DB yet)
   ├─ NoteIndexReadAdapter      note_index (existing, unchanged)
   └─ EmbeddingProvider         gemini-embedding-001, outputDimensionality 768 (matches note_index)
QdrantVectorStore → behind FF_MEMORY_QDRANT for later scale; not a v1 dependency.
MemoryVectorStore (RAM) → tests only; constructing it in production throws.
```

The memory object fields follow Rule 29 and PRD §67:

`id, organizationId, workspaceId, type, content, sourceType, sourceId, sourceTrust, evidenceSpans[], confidence, validFrom, validUntil?, supersededBy?, sensitivity (public|internal|confidential|restricted), visibility (private|workspace|organization|restricted|system), dataClass, region, retentionPolicy, verificationState (proposed|verified|disputed|superseded), version, createdBy, createdAt`.

### 5.2 Trust-Boundary Matrix (Rule 13)

| Data | Trust class | Handling |
| --- | --- | --- |
| System prompts, policies, persona definitions | SYSTEM TRUST | Versioned; never mixed with retrieved content |
| Operator instructions (UI, command bar) | USER TRUST | Authorization-checked; never widens persona scope |
| Workspace config, consent records | TENANT TRUST | Server-read only |
| CRM records, tasks, deals | INTERNAL DATA | Per-record authorization before context inclusion |
| Meeting transcripts, notes, uploaded documents | CUSTOMER DATA, **untrusted** | `<untrusted_reference_data>` isolation; injection scan; never an instruction |
| Model outputs (extractions, summaries, answers) | MODEL-GENERATED, **untrusted** | Schema → business → permission → policy validation (Rule 31) |
| Capability results | UNTRUSTED TOOL OUTPUT | Parsed, validated, classified, sanitized and scoped before entering context (Rule 48) |
| Recording audio files | CUSTOMER DATA | Read only from the workspace's own Storage path; no URL fetching |
| Third-party MCP / web content | Not used in Phase 11 | N/A, with a reason: Phase 11 adds no external MCP servers or web retrieval |

### 5.3 Capability contracts (Rules 12, 19, 36; all executed via `executeCapability`)

| Capability | Risk (server-enforced; annotations are hints only) | Idempotency key | Version |
| --- | --- | --- | --- |
| `meeting.search`, `meeting.get`, `meeting.generate_prep_brief` | L0 | n/a (read) | 1.0.0 |
| `meeting.ingest_transcript` | L1 | `mtg_tx_{meetingId}_{sha256(content)}` | 1.0.0 |
| `meeting.transcribe_recording` | L1 | `mtg_stt_{recordingId}_{recordingVersion}` | 1.0.0 |
| `meeting.extract_intelligence` | L1 | `mtg_ext_{transcriptId}_{chunkIndex}_{promptVersion}` | 1.0.0 |
| `meeting.summarize` | L1 | `mtg_sum_{transcriptId}_{promptVersion}` | 1.0.0 |
| `meeting.create_followup_tasks` | L1 | `mtg_task_{meetingId}_{itemHash}` | 1.0.0 |
| `meeting.link_to_crm` (proposal) | L2 | `mtg_crm_{meetingId}_{targetId}_{fieldHash}` | 1.0.0 |
| `message.generate_draft` (follow-up) | L3 (draft only) | `mtg_draft_{meetingId}_{version}` | 1.0.0 |
| `knowledge.ingest_meeting_outcome`, `knowledge.propose_*` | L1 | `kn_cand_{sourceId}_{itemHash}` | 1.0.0 |
| `knowledge.review_queue.decide` | L2 (human only; non-delegable) | `kn_dec_{candidateId}_{candidateVersion}` | 1.0.0 |
| `memory.supersede` | L2 | `mem_sup_{oldId}_{newId}` | 1.0.0 |
| `knowledge.search*`, `knowledge.get_evidence`, `knowledge.get_citations`, `knowledge_graph.get_neighbors`, `knowledge_graph.find_path`, `context.get_*`, `context.explain_inclusion` | L0 | n/a | 1.0.0 |

**Execution record (Rule 20)** for every invocation: `runId, toolCallId, executionId, idempotencyKey, status (first|retry|duplicate|already_completed|unknown_outcome), attempt, agentVersion, toolVersion, schemaVersion, policyVersion, modelVersion, promptVersion`.

### 5.4 Two-phase actions & approval binding (Rules 18, 21, 22)

PLAN → **PREVIEW** (operator sees exact changes, record counts and the evidence spans) → **APPROVE** → **EXECUTE** (via `executeCapability`) → **VERIFY** (re-read the target and assert the postcondition).

Approval binding = `approvalId, payloadHash (canonical SHA-256), targetResourceId, targetVersion (expectedVersion/updatedAt), transcriptHash, intelligenceVersion, policyVersion, toolVersion, recipient (for drafts), expiresAt (24 h)`. Any change invalidates the approval. A version mismatch at execute time rejects the action and offers a re-proposal (TOCTOU, Rule 18).

Approvers: the `approvals:decide` permission **and** workspace membership; never the proposer (all risk levels); L4 needs dual control.

### 5.5 Identity & delegation (Rules 16, 17)

Every run and step carries `organizationId, workspaceId, userId, agentId, agentVersion, runId, delegationId, policyVersion, toolInvocationId`. Effective authority = user ∩ agent ∩ workspace ∩ tool ∩ delegated scope ∩ policy. It is **re-derived live at each workflow step** (the PR-2 live-principal check), never trusted from the stored principal.

**Non-delegable in Phase 11:** deciding Knowledge Inbox items, approving proposals, deleting memory, reading `restricted` memory, sending any message, changing consent or retention policy, changing auto-accept policy.

### 5.6 Budgets, quotas & backpressure (Rules 9, 23)

| Limit | Meeting pipeline | Knowledge agent |
| --- | --- | --- |
| maxDuration | 180 s per step; 30 min per pipeline | 20 s |
| maxTokens | 120k per meeting | 30k context, 4k answer |
| maxToolCalls / maxParallelCalls | 40 / 4 | 8 / 4 |
| maxRecordsRead / maxRecordsMutated | 500 / 25 proposed | 200 / 0 |
| maxMessageCount | 1 draft, 0 sends | 0 |
| maxRetryCount | 3 per step (backoff + jitter) | 1 |
| Transcript size | ≤ 4 h audio / 60k words / 5 MB text | n/a |
| Queue | Cloud Tasks queue `meeting-intelligence`, max concurrent dispatches 10 | n/a |
| Quotas | Per-workspace daily: 50 pipelines, 2 h transcription; per-org model cost ceiling (Backoffice-editable) | Per-user: 60 queries/h |

Exceeding a limit stops cleanly with a clear message ("Daily meeting-analysis limit reached. Resets at 00:00."). It never fails silently.

### 5.7 Transcript ingestion & consent (resolves B3, B4, B12; decision D1)

- **Sources (v1):** upload `.vtt/.srt/.txt/.docx` (DOCX via the existing `mammoth`; VTT/SRT parsers in-house, so no new dependency), paste, and transcription of the workspace's own `meeting_recordings` through the Genkit gateway (async Cloud Task). **Deferred:** Google Meet/Zoom provider transcripts.
- **Consent (tools Domain 6):** when `enforceHostConsentForAI` is on, ingestion and retrieval require `consent { recordedBy, method, at }`; a refusal is audited.
- **Storage:** header in `meeting_transcripts/{id}` (+ `contentHash`, `schemaVersion`); segments in `meeting_transcripts/{id}/segments/{chunk}` (≤ 500 segments per doc).
- **Retention / deletion (Rule 57, PRD §75–76):** `evaluateGDPRRetentionPurge` cascades by `sourceId` across transcripts → intelligence → inbox candidates → memory → embeddings → graph edges. Deletion is audited.

### 5.8 Knowledge Inbox → memory (Rules 29, 30)

```text
candidate → dedupe → conflict check → sensitivity + instruction-like-content classification → trust score
  → auto-accept only if: sourceTrust=internal ∧ confidence ≥ 0.9 ∧ no conflict ∧ not sensitive
                         ∧ no injection flag ∧ workspace policy ON (default OFF; Backoffice-controlled)
  → otherwise human review (Accept · Accept all similar · Edit · Reject)
  → accepted → memory_objects + embedding + graph edge (verified) → memory.created
  → conflicting fact → never overwrite: old fact gets validUntil + supersededBy; history kept
```

### 5.9 Model routing (Rules 38, 57, 58)

| Task | Model tier | Notes |
| --- | --- | --- |
| Chunk extraction, classification, sensitivity, injection heuristics | Flash | JSON mode; Zod-validated |
| Summary, prep brief, knowledge answer | Pro | Citation-constrained output schema |
| Transcription | Gemini audio-capable model via the gateway | Cost-metered |
| Embeddings | `gemini-embedding-001` @ 768 dims | Same as `note_index` |

Model choice respects tenant `allowedModels` / `allowedExternalProviders` / `region`. If no allowed model exists, the feature is disabled for that tenant with a clear message. MCP Sampling is never used (Rule 38); all generation goes through `src/ai/genkit.ts`.

### 5.10 MCP exposure (Rules 11, 14, 35–38, 49)

- **Before any MCP code** (Rule 11): fetch the current spec and SDK docs via Context7, check deprecations, pin the package version and record the spec version (2026-07-28) in the milestone plan.
- `meetings` and `knowledge` domain servers on the existing v2 Streamable HTTP route (stateless; no `Mcp-Session-Id`; no Roots/Sampling/Logging/legacy SSE).
- Resources: `meeting://{id}`, `knowledge://{id}`, `memory://{id}`. Authenticated only (never public, Rule 49), consent-checked and per-item ACL'd.
- Prompts: `skill://meeting-preparation`, `skill://meeting-followup` (versioned).
- New tools are fingerprinted (`toolId, serverId, serverVersion, toolVersion, schemaHash, descriptionHash, permissionHash, riskHash, approvedAt, approvedBy`). Drift above the risk threshold blocks execution. Discovery cache entries carry `ttlMs, cacheScope, schemaHash, version, invalidatedAt`.
- **No external MCP servers** are added in Phase 11, so the Rule 15 allowlist lifecycle is N/A for this phase. Any future addition goes through the existing allowlist service.

---

## 6. Personas (Rules 16, 17, 59)

| Persona | Status | Allowed domains | Ceiling | Never |
| --- | --- | --- | --- | --- |
| `meeting_prep` | Exists, extended | meetings_conversations, crm_contacts, knowledge_memory | L0 | Any write |
| `meeting_analyst` | New | meetings_conversations, knowledge_memory, tasks_productivity, crm_contacts (proposals), messaging_outbound (draft only) | L1 autonomous; L2/L3 by proposal | Send; mutate CRM without approval; cross-workspace reads; decide inbox items |
| `knowledge_agent` | New | knowledge_memory, crm_contacts, deals_revenue, meetings_conversations (read) | L0 | Write memory; bypass per-item ACL; read restricted memory |

Sub-agent authority attenuates monotonically. The persona count test moves 15 → 17 deliberately.

---

## 7. Rules Conformance Matrix (every rule → design → milestone → verification)

### 7.1 Important Rules 1–10 (as amended)

| Rule | Requirement | Phase 11 conformance | Where | Verified by |
| --- | --- | --- | --- | --- |
| 1 | Skills conformance; preserve and improve existing features; professional, reviewable, **trackable** plan | Skills map (§13.2); functionality guarantees (§3); task tracker with IDs, acceptance criteria and evidence (§13.1) | All | Milestone code review against the skills checklist; tracker kept current |
| 2 | What could go wrong; clean, testable, scalable; run typecheck/lint, commit, debug; **no push until asked** | Risk register (§9); TDD per task; `pnpm typecheck` + `pnpm lint` + affected Vitest before each commit; commits stay local until the user asks to push; then CI on `main` is the build gate | All | Commit log; CI run IDs in reports |
| 3 | Affected features; Backoffice management without code | Affected-features table (§10.1); Backoffice enhancements (§10.2) | M5 | Backoffice E2E: pause, policy, reprocess without deploy |
| 4 | No `any` / `any[]` / unchecked casts; `unknown` only at trust boundaries, immediately schema-validated | Zod v4 at every boundary (uploads, model output, Firestore reads, Cloud Task payloads, MCP args); lint rule + review | All | ESLint (`no-explicit-any`), grep gate for `as unknown as` in Phase 11 paths |
| 5 | Generate, validate, test, stage, verify indexes/rules/migrations; staging first; production needs explicit approval; never auto-deploy security changes | §12 deployment policy | M0, M1, M3 | Rules emulator tests; staging deploy record; written approval before production |
| 6 | Proper dependencies; latest docs via Context7 | No new runtime deps planned (`mammoth` exists; VTT/SRT parsers in-house). Context7 checks for Genkit embedding/audio, Firestore vector `findNearest`, MCP SDK v2 and `server-only` before use | M0, M1, M4 | Dependency record in `docs/agentic/16-dependency-governance.md` if anything is added |
| 7 | Mobile-first, gestures, all screens/OS, reuse code, plain English, minimal text | §11 UX rules; reuse Brain, Account360, theme.md §8 modals, `CardInfoTooltip`, actionable toasts | M5 | Mobile viewport tests (375/768/1280); gesture tests; copy review |
| 8 | High security, no leaks | §5.2–5.5, §7.2 Rules 12–34, 46–52; `firebase-security-rules-auditor` + `cybersecurity-analyst` skills run per milestone | All | Red-team suite; rules tests; IDOR tests |
| 9 | Huge load, no exhaustion, all edge cases | Budgets and quotas (§5.6); chunked Cloud Tasks; bounded queries; edge-case catalogue (§9.2) | M1–M4 | Load test: 100 concurrent ingestions, 50 concurrent knowledge queries |
| 10 | Guiding comments | `@fileOverview` per file (purpose, rules, caution areas, test pointers); `// CAUTION:` at tenant, approval, consent and retention code | All | Review checklist |

### 7.2 Rules 11–69

| Rule | Phase 11 conformance | Milestone | Verification |
| --- | --- | --- | --- |
| 11 MCP compliance | Pre-MCP checklist (§5.10); spec 2026-07-28, SDK v2 `@modelcontextprotocol/server` | M4 | MCP conformance tests |
| 12 Annotations ≠ security | Risk enforced in `executeCapability` stage 08/09; annotations are informational only | M0, M4 | Test: tool with a false `readOnlyHint` is still denied |
| 13 Trust boundaries | Matrix §5.2; isolation tags; classifier | M1–M4 | Injection fixtures in eval datasets |
| 14 Rug-pull defense | Fingerprints on all new tools; drift blocks | M4 | Drift test |
| 15 Server allowlist | N/A: no external MCP servers added (reason stated in §5.10) | n/a | n/a |
| 16 Agent identity | Full principal (§5.5), re-derived live per step | M0, M2 | Live-principal test (revoked user → step refused) |
| 17 Non-delegable | List in §5.5 | M0, M3 | Agent attempts each → denied |
| 18 TOCTOU | `expectedVersion` on CRM proposals, inbox decisions and memory supersede | M0, M2, M3 | Concurrent-edit tests |
| 19 Idempotency | Keys per §5.3 | M0–M3 | Duplicate-submit tests |
| 20 Replay/duplicate delivery | Execution record (§5.3); unknown-outcome reconciliation by key | M0–M2 | Duplicate Cloud Task delivery test |
| 21 Two-phase | PLAN→PREVIEW→APPROVE→EXECUTE→VERIFY (§5.4) | M0, M2 | E2E A |
| 22 Approval binding | Binding fields (§5.4); invalidation on change | M0 | Tamper test: payload edited after approval → rejected |
| 23 Budgets/backpressure | §5.6 | M2, M4 | Budget-exceeded tests |
| 24 Circuit breakers | Model provider, transcription, Firestore throttling; 5 states; UI copy "Meeting analysis is paused because the AI service is busy. Nothing was changed." | M2, M4 | Chaos tests |
| 25 DLQ/recovery | Terminal states completed/failed/cancelled/waiting/dead-lettered; manual recovery queue in Backoffice meetings-monitor | M2 | DLQ test + Backoffice replay |
| 26 Cancellation | Pipeline cancel: stop scheduling further chunks, let in-flight model calls finish, discard un-merged results, keep already-created inbox candidates marked `partial`, show exact state | M2 | Cancel-mid-run test |
| 27 Saga/compensation | Tasks → cancel agent-created tasks (only if untouched by humans); CRM field → revert to `previousValue` with version check; inbox candidates → withdraw; memory from a deleted source → purge by `sourceId` | M0, M2, M3 | Compensation tests |
| 28 Context budgeting | Retrieval/context budgets, ranking, dedupe, temporal decay, source diversity, evidence threshold; UI shows "found N, using M" | M4 | Over-retrieval eval metric |
| 29 Memory governance | Fields §5.1; supersession, not overwrite | M3 | Temporal eval cases |
| 30 Knowledge poisoning | Source trust, instruction-like detection, sensitivity, provenance, human review threshold (§5.8) | M1, M3 | Poisoned-transcript red-team cases |
| 31 Output validation | Schema → business (e.g. due date not in the past, assignee is a workspace member, amount ≥ 0, entity exists in workspace) → permission → policy | M2 | Validation unit tests |
| 32 Exfiltration detection | Egress policy on follow-up drafts: may reference only the meeting's own account data; restricted/financial PII redacted unless the recipient is an attendee of that account; drafts listing > 5 other customers blocked | M2 | Exfiltration red-team test |
| 33 Egress control | Phase 11 never sends; drafts go to the approval desk; recipients limited to meeting attendees/CRM contacts of the linked account | M2 | Recipient-outside-account test |
| 34 SSRF | No URL ingestion; audio read only from the workspace Storage path; any future URL import must use `validateSafeEgressUrl` | M1 | Path-traversal / foreign-bucket test |
| 35 Discovery caching | Cache entries with TTL/hash/version/invalidatedAt; stale cache cannot execute | M4 | Invalidation test |
| 36 Version compatibility | SemVer on capabilities; runs record agent/tool/schema/policy/model/prompt versions | M0–M4 | Run-record assertions |
| 37 Spec compatibility testing | New client→server; 2025-style client→compat path | M4 | MCP compat suite |
| 38 No deprecated MCP | No Roots/Sampling/Logging/legacy SSE; generation via Genkit gateway | M4 | Code review + test |
| 39 OpenTelemetry | Spans: ingest, chunk, extract, merge, summarize, propose, approve, execute, verify, retrieve, rank, answer; `traceId/spanId/runId/toolCallId/correlationId/causationId` | M1–M4 | Span assertions in integration tests |
| 40 Audit immutability | Append-only ledger; hash-chained entries for approvals, inbox decisions, memory deletes | M0, M3 | Tamper-detection test |
| 41 "Why did you do this?" | Each proposal/candidate shows goal, context, policy, capability, arguments, result, evidence spans, verification, actor (no chain-of-thought) | M5 | UI test |
| 42 Shadow mode | Stages: shadow → internal beta → canary → limited → delegated; shadow compares agent output with human edits | M2, M4, M6 | Shadow reports |
| 43 Replayable runs | Snapshot: input hash, context snapshot, tool defs/versions, policy, model and prompt versions, retrieval results, tool outputs, state; replay never writes | M2, M4 | Replay test |
| 44 Deterministic simulation | Fake model (scripted outputs), Firestore emulator, fake transcription provider | M1–M4 | Hermetic suites |
| 45 Chaos | Model timeout/429/500/malformed JSON; partial chunk failure; duplicate task delivery; Firestore contention; stale approval; concurrent edit; expected behaviour defined first in the failure matrix | M6 | Chaos suite |
| 46 Red team | Injection, knowledge poisoning, cross-tenant, escalation, exfiltration, approval bypass, replay, race, confused deputy, forged client writes, consent bypass | M6 | Red-team suite |
| 47 Never trust the model | MODEL→PROPOSAL→VALIDATOR→POLICY→PERMISSION→EXECUTOR→VERIFIER; uncited claims dropped; spans must exist | M2, M4 | Hallucination eval |
| 48 Never trust the tool | Tool outputs parsed/validated/classified/sanitized/scoped; sanitized errors | All | Unit tests |
| 49 Public isolation | No public access to transcripts, intelligence, memory or MCP resources; public booking pages untouched | M1, M4 | Rules tests (unauthenticated → denied) |
| 50 Cache isolation | Cache keys include org + workspace + user scope; no `unstable_cache` of workspace data without scope | M2, M4 | Cache-key test |
| 51 Server Action gate | `'use server'` + `requireAuth` + workspace **membership** + resource ownership in every action, plus capability authorization (defense in depth) | All | Action security tests |
| 52 Client/server boundary | `import 'server-only'` in server modules (verify via Context7); client imports only `*-types` / browser-safe modules; CI build is the gate | All | Boundary test + CI build |
| 53 Dependency governance | No new deps planned; any addition is recorded (version, licence, maintenance, advisories, bundle impact, peers); lockfile committed | All | Dependency record |
| 54 Performance budgets | Prep brief p95 < 6 s; knowledge answer p95 < 12 s; retrieval < 1.5 s; Meeting panel route JS < 60 KB gz added; inbox virtualized > 50 rows | M4, M5 | Perf tests |
| 55 Graph/canvas limits | ≤ 80 visible nodes, ≤ 150 edges, auto-expand depth ≤ 2; "Showing most relevant 80 of N · Expand" | M3, M5 | UI limit test |
| 56 Context compression | Compression keeps source refs, dates, entities, decisions, uncertainty | M4 | Compression unit test |
| 57 Residency/retention | `dataClass`, `region`, `retentionPolicy`, `allowedModels`, `allowedExternalProviders` honoured before any model call | M0, M1 | Disallowed-provider test |
| 58 Model routing | §5.9 | M2, M4 | Routing unit tests |
| 59 Tool-selection eval | Knowledge eval scores correct tool choice, unnecessary calls, over-retrieval, missed capability | M4 | Eval report |
| 60 Dead-man controls | Disable agent, disable capability, disable model, pause all runs, cancel queued runs, block external sends, global "Disable Autonomous Execution", all from Backoffice | M5 | Backoffice E2E |
| 61 Backoffice control plane | §10.2 | M5 | Backoffice E2E |
| 62 Security command center | New feeds: injection detections in transcripts, poisoning flags, consent refusals, cross-workspace denials, egress blocks, approval-bypass attempts | M5 | Feed tests |
| 63 Incident management | Runbook entry: affected runs/tenants/tools, actions executed, data touched, remediation (compensate / purge by source), replay test, policy change, postmortem | M6 | Runbook drill |
| 64 Feature flags (3+ levels) | `FF_MEETING_AGENT`, `FF_KNOWLEDGE_AGENT`, `FF_KNOWLEDGE_AUTO_ACCEPT`, `FF_MEETING_TRANSCRIPTION` at global/org/workspace, plus per-agent and per-capability toggles | M0, M5 | Flag tests |
| 65 Canary releases | 5% → 20% → 50% → 100% of workspaces; automatic rollback if: extraction schema-failure > 5%, operator rejection rate > 40%, evidence-span failures > 2%, p95 latency > 2× budget, cost > 150% of forecast | M6 | Canary plan + dashboard |
| 66 Cross-cutting gates | Phase 4 gates (provenance, validity, poisoning, sensitivity, retention, deletion, conflicts) completed here for meeting memory; Phase 7 gates (cancel, retry, DLQ, recovery, compensation, replay) applied to the pipeline; Phase 8 gates (approval clarity, provenance, state visibility, stale-state warnings, recovery UI) in M5 | All | Gate answers per milestone |
| 66 (Phases 9–13) Domain-agent deliverables | §8 | M2, M4, M6 | §8 table |
| 67 Implementation Gate | §8.2, answered in every completion report; N/A must be explained | All | Report review |
| 68 Five non-negotiables | (1) Model is not the boundary → §5.4/5.5; (2) Tool output untrusted → §5.2; (3) Mutations idempotent, authorized, version-checked, auditable → §5.3/5.4; (4) Bounded authority + resources → §5.5/5.6; (5) Operable without code → §10.2 | All | Mapped tests |
| 69 Governed capability layer | Every Phase 11 behaviour is a capability; UI/agents/MCP/workflows converge on `executeCapability`; CI grep gate: no `capability.handler(` outside stage 13 in Phase 11 paths | M0+ | Grep gate test |

---

## 8. Domain-Agent Deliverables & Implementation Gate

### 8.1 Mandatory deliverables (rules §66, Phases 9–13)

| Deliverable | Meeting Agent | Knowledge Agent |
| --- | --- | --- |
| Shadow mode | Workflow `dryRun` on recorded transcripts; blast-radius report | Answers logged, not shown; compared with gold answers |
| Evaluation dataset | ≥ 20 transcripts (sales, onboarding, support, multilingual EN/FR/Twi-mixed, no-decision meetings, injection-laced, contradictory) with gold items + spans. Thresholds: decision/commitment F1 ≥ 0.8; span validity 100%; zero fabricated items | ≥ 25 questions (contradictions, stale facts, restricted items, cross-workspace bait, empty evidence). Thresholds: citation precision ≥ 0.95; zero leaks; correct "no evidence" ≥ 0.9 |
| Permission matrix | `meeting_analyst`, `meeting_prep` | `knowledge_agent` |
| Tool matrix | §5.3 | §5.3 read set |
| Failure matrix | §9.2 + chunk-level failures | Source outages, empty evidence, ACL withholding |
| Security tests | Injection, forged client writes, IDOR, self-approval, consent bypass, exfiltration | Cross-workspace bait, restricted leakage, graph explosion, poisoned memory |
| Rollback plan | Compensations (Rule 27 row) + flags | Flags (no writes) |

### 8.2 Agent Implementation Gate (Rule 67), answered per milestone

```text
ARCHITECTURE  Capabilities §5.3 · reuse §2.1 (no duplicate services) · SoT Firestore · events:
              meeting.transcript.ingested, meeting.intelligence.completed, meeting.intelligence.failed,
              knowledge.candidate.created, knowledge.candidate.decided, memory.created, memory.superseded,
              memory.conflict.detected, memory.purged
AUTHORITY     meetings:view / meetings:analyze / knowledge:review / approvals:decide · personas §6 ·
              non-delegable §5.5 · sub-agents attenuated
DATA          trust matrix §5.2 · sensitive: HR/compensation/legal/financial → restricted, log-redacted
EXECUTION     idempotent §5.3 · retries with backoff · cancellable §7.2/26 · duplicates detected ·
              version-checked §5.4 · lost response → reconcile by idempotency key
MCP           2026-07-28 · SDK v2 · tools/resources/prompts · fingerprints · stateless
FAILURE       timeout · 429 · 500 · partial · provider down · stale approval · concurrent edit → §9.2
SECURITY      injection · tool poisoning · confused deputy · SSRF (N/A + reason) · exfiltration ·
              escalation · cross-tenant → §7.2
OPERATIONS    disable · inspect · replay · rollback · change policy, all in Backoffice (§10.2)
TESTING       unit · integration · contract · E2E · security · tenant isolation · adversarial · load ·
              chaos · evaluation
MIGRATION     existing behaviour/routes/data preserved (§3) · backfill: embed accepted knowledge_insights ·
              restore procedure documented · rollback = flags off + compensations
```

---

## 9. What Could Go Wrong (Important Rule 2)

### 9.1 Risk register

| # | Risk | Likelihood / impact | Mitigation | Owner milestone |
| --- | --- | --- | --- | --- |
| R1 | Hallucinated commitments become "memory" and mislead staff or customers | Med / High | Evidence-span validation; inbox review; no auto-accept by default; F1/fabrication eval gates | M2, M3 |
| R2 | Transcript prompt injection triggers actions | Med / High | Untrusted isolation; actions only via proposals; injection flag forces review | M1–M3 |
| R3 | Cross-workspace leakage through knowledge answers | Low / Critical | Per-item ACL after retrieval; mandatory vector pre-filters; red-team bait | M4 |
| R4 | M0 remediation breaks Phase 9/10 flows | Med / Med | Contract tests before refactor; unchanged UI contracts; E2E for proposal execute | M0 |
| R5 | Model cost spikes (long transcripts, retries) | Med / Med | Quotas, chunk caps, cost ceiling per org, canary cost threshold | M2 |
| R6 | Transcription quality poor (accents, multilingual, crosstalk) | High / Med | Speaker-mapping UI; confidence surfaced; low-confidence spans excluded from auto-actions | M1 |
| R7 | Embedding dimension mismatch across indexes | Low / High | Single provider config, 768 dims, startup assertion | M0 |
| R8 | Firestore vector index or query limits (KNN caps, no realtime) | Med / Med | Bounded k ≤ 50, pre-filters, Qdrant path behind a flag | M0 |
| R9 | Rules tightening blocks a hidden client writer | Low / Med | Verified none exist today; rules tests; staging soak | M1 |
| R10 | Consent misconfiguration → processing without consent | Low / High | Default deny when the flag is on; audited refusals; Backoffice report | M1 |
| R11 | Duplicate tasks from retries / double clicks | Med / Low | Idempotency keys; duplicate tests | M2 |
| R12 | Stale approvals executed after record edits | Med / Med | Version binding; 24 h expiry | M0 |
| R13 | Long pipelines killed by Cloud Run restarts | Med / Low | Durable steps, leases, checkpoint resume | M2 |
| R14 | Plan-vs-reality drift (as seen in Phases 4–10) | Med / High | DoD §4; evidence-backed reports; grep gates; E2E on emulator | All |

### 9.2 Edge cases (Important Rule 9)

No transcript · empty or whitespace transcript · transcript in an unsupported format · > size cap · non-UTF-8 · unknown speakers · single-speaker monologue · meeting with no decisions · cancelled meeting with a transcript · meeting linked to no CRM entity · attendee not in CRM · entity merged or deleted mid-pipeline · deal closed between extraction and approval · duplicate upload · two operators approving at once · approver loses permission before execute · workspace flag turned off mid-run · consent revoked after ingestion (purge) · retention expiry during review · model returns spans outside the transcript · relative dates ("next Friday") resolved against meeting date and timezone · amounts with currency ambiguity (GHS/NGN/USD) · contradictory statements within one meeting · knowledge query with zero results · query mentioning another workspace's customer · graph hub nodes with 10k+ edges · user on a slow mobile network (streamed partial UI, retry).

---

## 10. Affected Features & Backoffice (Important Rule 3)

### 10.1 Features affected

| Feature | Effect | Plan |
| --- | --- | --- |
| Meetings detail page | New Brief / Outcomes panels (flagged) | M5; no change when the flag is off |
| Meeting intelligence actions | Internals delegate to capabilities; fabricated fallback removed | M1; contract tests |
| Tasks module | Receives agent tasks with `origin` + idempotency | M2; task list shows an "From meeting" chip |
| CRM entity/deal views (Phase 9) | Account360 includes verified meeting memory | M3 |
| Approvals desk (`/admin/intelligence/approvals`, Backoffice approvals) | New proposal types; permission enforcement | M0, M5 |
| Quick Notes / Brain | Shares the inbox model; unchanged behaviour | M3 adapter tests |
| Sales (Phase 10) | Proposal execution and SDR persistence become real | M0 |
| Command bar | "Search/Analyze" routes to the knowledge agent (real answers) | M4 |
| Firestore rules/indexes | Tightened/added | §12 |

### 10.2 Backoffice enhancements (operable without code)

Extend existing screens rather than adding parallel ones:
- **`meetings-monitor`:** ingestion queue, pipeline runs, DLQ with **Reprocess**, per-workspace usage and cost, consent refusals.
- **`knowledge-graph`:** verification states, conflict queue, purge-by-source.
- **`approvals`:** new proposal types, approver policy (who may decide, per workspace).
- **`features`:** the four flags at global/org/workspace, plus per-agent and per-capability toggles.
- **`prompts`:** versioned extraction, summary and answer prompts with canary assignment.
- **`audit`:** memory read/write/export/delete ledger with hash-chain verification.
- **`companybrain` / security:** injection and poisoning feed, egress blocks, cross-workspace denials (Rule 62).
- **Policy editor:** auto-accept threshold, quotas, cost ceilings, retention, allowed models.
- **Kill switches:** disable agent / capability / model, pause runs, cancel queued, block sends (Rule 60).

---

## 11. UX Rules for Phase 11 Surfaces (Important Rule 7, AGENTS.md, theme.md §8)

- **Plain, short English.** Buttons: "Add transcript", "Review", "Apply", "Create tasks", "Draft follow-up", "Accept", "Reject". Errors say what happened and what to do, in one line, with an actionable toast (`actionConfig.path` relative only).
- **Minimal text.** Guidance goes in `CardInfoTooltip`, not paragraphs. Evidence is shown as chips ("Meeting · 12:41").
- **Mobile-first.** ≥ 44 px targets. The inbox supports swipe right (accept) / left (reject) with undo, long-press for details and pull-to-refresh. Bottom sheets on phones, side drawers on desktop. Works with the iOS/Android virtual keyboard and safe areas. Layouts verified at 375 / 768 / 1280.
- **Motion** (`emilkowal-animations`): ≤ 200 ms ease-out for sheet and drawer transitions; respects `prefers-reduced-motion`.
- **States.** Loading skeletons, empty states with one action, streamed partial results for the knowledge agent, stale-state warning ("This deal changed since the proposal. Review again."), recovery UI for failed runs.
- **Reuse.** theme.md §8 modals, Brain components (graph canvas, item drawer, candidate card, search box), Phase 9 cards, `<TagSelector>` wherever tags are applied, `<VariablesPanel>` / `FieldsVariablesService` for follow-up variables.
- **No raw HTML/CSS leakage.** Model text is rendered through the sanitized markdown renderer.
- **Accessibility.** Keyboard navigation, focus rings, screen-reader labels; ⌘⇧K opens Knowledge Search.

---

## 12. Deployment Policy (Important Rule 5, AGENTS.md Git protocol)

1. **Local:** `pnpm typecheck` + `pnpm lint` + affected Vitest; commit. No full local build (AGENTS.md; low-memory machine).
2. **Push:** only when the user asks in the current request. Then CI on `main` (typecheck, lint, Vitest, Next build, Firestore rules) must be green. Failures are fixed and re-pushed.
3. **Firestore rules/indexes:** generated → emulator-tested (`firebase-security-rules-auditor` skill) → deployed to **staging** (the `staging` branch trigger) → verified → **production only after explicit written approval** (the `deployment` branch). Rules changes are security-sensitive and never auto-deployed.
4. **App deploy:** via the existing `deployment` branch workflow, only on explicit approval; flags default OFF; canary per Rule 65.
5. **Backfills/migrations:** dry run first, then idempotent and resumable with a progress record; reversible or with a documented restore.

---

## 13. Tracking (Important Rule 1)

### 13.1 Milestone & task tracker

Status values: ☐ not started · ◐ in progress · ☑ done (evidence linked) · ⛔ blocked. Each milestone plan expands its tasks into TDD steps. A task closes only with evidence: test names plus a commit, and a CI run when pushed.

| ID | Task | Acceptance criteria | Status | Evidence |
| --- | --- | --- | --- | --- |
| **M0** | **Foundation remediation** | | ☐ | |
| P11-M0-T1 | Memory SSOT on Firestore + vector + embeddings; RAM store test-only | Persisted memory survives restart; tenant pre-filter mandatory; 768-dim assertion | ☐ | |
| P11-M0-T2 | Route step runner, sagas, CRM proposal bridge and sales actions through `executeCapability` | Grep gate passes; live-principal test passes | ☐ | |
| P11-M0-T3 | Proposal execute performs the mutation; rollback runs compensation; both version-checked | E2E: approve → record changed → rollback restores | ☐ | |
| P11-M0-T4 | Approvals: inbox items for workflow waits; `approvals:decide` + membership; no self-approval; durable resume via Cloud Task | E2E on emulator; self-approval denied | ☐ | |
| P11-M0-T5 | Remove secret fallback, SDR fallback phone and module-level Maps | Startup fails closed without the secret; state persists across instances | ☐ | |
| P11-M0-T6 | Approval binding fields + append-only hash-chained audit | Tamper tests pass | ☐ | |
| **M1** | **Meetings capabilities & ingestion** | | ☐ | |
| P11-M1-T1 | `meeting.*` read capabilities + ownership checks (B2) | IDOR tests pass | ☐ | |
| P11-M1-T2 | Ingestion: VTT/SRT/TXT/DOCX/paste parsers + segments subcollection (B12) | Fixtures parse; 4 h transcript stored | ☐ | |
| P11-M1-T3 | Recording transcription Cloud Task (D1) | Fake-provider hermetic test; cost metered | ☐ | |
| P11-M1-T4 | Consent gate + retention cascade | Refusal audited; purge cascades by `sourceId` | ☐ | |
| P11-M1-T5 | Remove fabricated transcript (B1); server-only rules (B3) | Rules tests; "no transcript" path returns a clear state | ☐ | |
| **M2** | **Meeting Agent** | | ☐ | |
| P11-M2-T1 | Personas + permission/tool/failure matrices | Persona tests (17) | ☐ | |
| P11-M2-T2 | Grounded prep brief (Account360 + commitments) with labelled fallback | Citation test; model-down test | ☐ | |
| P11-M2-T3 | Post-meeting workflow template + chunk extraction + span validation | E2E A on emulator | ☐ | |
| P11-M2-T4 | Tasks / CRM proposals / follow-up drafts with egress policy | Idempotency, exfiltration, recipient tests | ☐ | |
| P11-M2-T5 | Eval dataset (≥ 20) + shadow mode | F1 ≥ 0.8; zero fabricated items | ☐ | |
| **M3** | **Knowledge Inbox & graph** | | ☐ | |
| P11-M3-T1 | Candidate capabilities + review queue (non-delegable decide) | Agent decide → denied | ☐ | |
| P11-M3-T2 | Dedupe, conflict, sensitivity, injection classification, supersession | Temporal and poisoning cases pass | ☐ | |
| P11-M3-T3 | Graph edges (deterministic + inferred with verification state) + limits | ≤ 80 nodes rendered; bounded traversal | ☐ | |
| P11-M3-T4 | Backfill embeddings for accepted `knowledge_insights` (dry run → run) | Resumable progress record | ☐ | |
| **M4** | **Knowledge Agent & MCP** | | ☐ | |
| P11-M4-T1 | Planner + parallel retrieval + per-item ACL + context budget | Zero-leak red-team; "found N, using M" | ☐ | |
| P11-M4-T2 | Answer contract (claims ↔ citations, conflicts, gaps, temporal) | Citation precision ≥ 0.95 | ☐ | |
| P11-M4-T3 | MCP domain servers, resources, prompts, fingerprints, cache policy | Conformance + drift tests | ☐ | |
| P11-M4-T4 | Eval (≥ 25) + tool-selection metrics + shadow | Thresholds §8.1 | ☐ | |
| **M5** | **UI & Backoffice** | | ☐ | |
| P11-M5-T1 | Meeting Brief + AI timeline + Post-Meeting Execution Panel | Mobile viewport + gesture tests | ☐ | |
| P11-M5-T2 | Knowledge Inbox + Item Inspector + ⌘⇧K Search | Swipe/undo; evidence stack | ☐ | |
| P11-M5-T3 | Backoffice §10.2 (monitor, flags, policies, kill switches, security feed) | Operate without deploy (E2E) | ☐ | |
| **M6** | **Verification & release** | | ☐ | |
| P11-M6-T1 | E2E A and B; tenant-isolation, red-team, chaos, load suites | All green; CI run IDs | ☐ | |
| P11-M6-T2 | Rule 67 gate answers + completion report + runbook drill | Reviewed | ☐ | |
| P11-M6-T3 | Staging soak → approval → canary 5/20/50/100 | Rollback thresholds wired | ☐ | |

**Ordering:** M0 → M1 → (M2 ∥ M3) → M4 → M5 → M6. UI can be built against M1 contracts behind flags; nothing is enabled until M6 passes.

### 13.2 Skills usage map (Important Rule 1)

| Skill (`.agents/skills`) | Applied in |
| --- | --- |
| `writing-plans`, `task-planning`, `test-driven-development`, `verification-before-completion`, `systematic-debugging` | Every milestone plan and task |
| `backend-patterns` (backend design), `next-best-practices` | Capabilities, Server Actions, workflows, caching (M0–M4) |
| `vercel-react-best-practices`, `frontend-design`, `ui-ux-pro-max`, `emilkowal-animations`, `web-design-guidelines` | M5 surfaces |
| `firebase-security-rules-auditor`, `cybersecurity-analyst` | Rules, IDOR, red-team (M0, M1, M6) |
| `mcp-builder` | M4 MCP servers/resources/prompts |
| `firebase-ai-logic` (+ Context7 for Genkit) | Embeddings, transcription, model calls (M0–M2) |
| `qdrant` | Only if D2 changes to Qdrant |
| `requesting-code-review`, `receiving-code-review` | End of each milestone |

---

## 14. Decisions Required Before Milestone 0

| # | Decision | Recommended default |
| --- | --- | --- |
| D1 | Transcript sources in v1 | Upload/paste **plus** transcription of existing recordings; defer Google Meet/Zoom |
| D2 | Memory SSOT backend | Firestore store + Firestore vector search (already proven by `note_index`); Qdrant later behind a flag |
| D3 | Foundation fixes inside Phase 11 | Yes, as M0, scoped to what Phase 11 depends on |
| D4 | Action items → tasks | Auto-create internal tasks (L1, idempotent, origin-tagged, undoable); CRM changes and messages always need approval |

---

## 15. Immediate Next Step

After D1–D4 are confirmed, write [`agents_mcp_phase_11_milestone_0_plan.md`](agents_mcp_phase_11_milestone_0_plan.md) with bite-sized TDD steps for P11-M0-T1…T6, then implement in small local commits verified with `pnpm typecheck` + `pnpm lint` + affected tests. Push to `main` only when asked; CI is then the build gate.
