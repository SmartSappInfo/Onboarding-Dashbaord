# Phase 11 · Milestone 2 Implementation Plan
## Meeting Agent: Grounded Prep Briefs and Evidence-Backed Post-Meeting Intelligence

**Version:** 1.1.0 (full `agents_mcp_rules.md` conformance; no functionality removed)
**Status:** PLANNING. Decisions D14–D20 in §17.
**Date:** 2026-10-05
**Parent:** [`agents_mcp_phase_11_master_plan.md`](agents_mcp_phase_11_master_plan.md) §1.1 (workflow A), §5.2–5.6, §5.9, §6, §8, §9, §13 (P11-M2-T1…T5).
**Depends on** (§2.3):
- M1 (local) + its review fixes R1–R7.
- M0 T2 (gateway everywhere), T3 (real proposal execute), T4 (durable permissioned approvals), T6 (binding + append-only audit).

**Rules:** [`agents_mcp_rules.md`](../agents_mcp_rules.md) Important 1–10 (4 and 5 as amended) and 11–69, applied in full (§10 matrix, §11 gate). Also `.agents/AGENTS.md` and `theme.md` §8.

### Change log v1.0 → v1.1

| # | Change | Rule |
| --- | --- | --- |
| C1 | **Corrected facts:** workflow templates are static step lists (≤ 30), so there is no per-chunk fan-out; extraction is ONE resumable step with per-chunk checkpoints. Tasks have no `cancelled` status; undo deletes a task only if unchanged since creation (`deleteTaskCore`, version-checked), otherwise it explains why. The composer already accepts `?meetingId=`; drafts open by id, loaded server-side (no content in URLs). The approval store already refuses self-approval; binding is achieved by hashing a canonical payload that includes target version, transcript hash and analysis version (no schema change). | 2, 18, 22, 27 |
| C2 | Trust-boundary matrix, `unknown` boundary table, MCP annotation table (hints only) | 4, 12, 13 |
| C3 | Per-mutation table: idempotency, retry, duplicate, lost response, TOCTOU token | 18–20 |
| C4 | Non-delegable list made explicit; delegation intersection; sub-agent attenuation test | 16, 17 |
| C5 | Cancellation table, saga/compensation table, terminal states incl. `dead_lettered` | 25–27 |
| C6 | Context budgeting for briefs and summaries (ranking, dedupe, temporal decay, "found N, used M"); compression keeps source refs | 28, 56 |
| C7 | Egress matrix for drafts and model calls; cross-domain exfiltration checks (CRM data → draft) | 32, 33 |
| C8 | "Why did you do this?" view for items, proposals and drafts; replay record; shadow ladder | 41–43 |
| C9 | Per-run budgets (all Rule 23 fields), quotas, backpressure, circuit breakers per model tier | 9, 23, 24 |
| C10 | Model routing with fallback inside allowed providers; data policy before every call; prompt/skill versioning + canary | 57, 58, 65 |
| C11 | Security feed events, incident runbook additions, dead-man controls per persona/capability/trigger | 60–63 |
| C12 | Performance budgets for UI and pipeline; client/server boundary tests | 52, 54 |
| C13 | Full rules matrix (1–69) and the Rule 67 gate with every question answered | 66–69 |

**Documents reviewed:**

| Document | Used for |
| --- | --- |
| `agents_mcp_rules.md` (1–69) | This revision |
| Phase 11 master plan | Workflow A, contracts, budgets, routing, personas, deliverables, risks, edge cases |
| M0/M1 plans, M1 completion report, M0/M1 code reviews | Prerequisites and open findings |
| `agents_mcp_tools.md` Domain 6 | Meeting tool set |
| `agents_mcp_roadmap.md` Phase 11 | Before/after flows |
| `agents_mcp_prd.md` §80, "Meeting follow-up" (draft → **approval** → send), §127 | Pipeline order, human-sent messages, success metrics |
| `agents_mcp_ui.md` §35 + Phase 11 | Brief and outcomes panel |
| `docs/meetings/meetings_prd.md` §27, §60, §61, §97 · `meetings_ui.md` §30–31 | Insight model, prep inputs, post-meeting chain, confirmation for CRM changes |
| Code (verified 2026-10-05) | §2 |

---

## 1. Goal

**Before a meeting**, a person or agent gets a prep brief in which every statement cites its source:
- the client, history and open deals (Account360);
- previous meetings and open commitments from earlier meetings;
- risks, a suggested agenda and questions.

If the model is unavailable, the brief shows **facts only, labelled as such**.

**After a meeting**, a durable pipeline turns the transcript into topics, decisions, commitments, action items, buying signals, objections, risks and questions, then a grounded summary:
- **Every item cites the exact transcript lines it came from**; items without valid evidence are dropped, never repaired by guessing.
- From the items, people can create tasks, propose CRM updates (approved, then executed and verified) and produce a follow-up **draft** that a person sends from the existing composer.

**Non-goals:**
- Knowledge Inbox / memory (M3; M2 only emits events).
- Knowledge agent and MCP resources/prompts (M4).
- Full UI (M5).
- Any automatic sending.

---

## 2. Verified Baseline (code as of `6cf670ac`)

### 2.1 Reuse (Rules 7, 69)

| Asset | Location | Use in M2 |
| --- | --- | --- |
| Transcript store, consent, AI-use gates | `src/lib/meetings/transcript-store.ts`, `consent-store.ts` | Source + `ai_read` gate before every model call |
| AI gateway, data policy, model registry | `src/ai/genkit.ts`, `src/platform/policy/ai-data-policy.ts`, `src/lib/ai/model-registry.ts` | All generation; tier + provider routing |
| Intelligence prompt/parser (v1) | `src/lib/meetings/ai-intelligence-service.ts` | Legacy display only |
| Heuristic action items | `src/lib/meetings/action-items-service.ts` | Shadow baseline |
| Account360 assembler (`sourceRef` on items) | `src/platform/agents/crm/context/account-context-assembler.ts` | Brief grounding + citations |
| Workflows (static templates, leases, recovery, replay) | `src/platform/workflows/*` | Pipeline; **steps bypass the gateway today** (`workflow-step-runner.ts:394`) |
| Proposal bridge + approval store (self-approval refused, payloadHash, expiry) | `crm-proposal-bridge.ts`, `approval-store.ts` | **Execute changes nothing today** |
| Task core (`createTaskCore`, `deleteTaskCore`) | `src/lib/tasks/task-core.ts` | Tasks + undo |
| Composer (`/admin/messaging/composer?meetingId=`) | `src/app/admin/messaging/composer/page.tsx` | "Open draft in composer" |
| Egress policy engine (`evaluateEgress`) | `src/platform/mcp/security/egress-data-policy.ts` | Draft payload/recipient checks |
| Phase 9/10 matrices, eval, shadow | `src/platform/agents/{crm,sales}/*` | Same shapes |
| Circuit breaker | `src/platform/events/resilience/circuit-breaker.ts` | Per model tier |

### 2.2 Findings that shape M2

| # | Finding | Evidence | Consequence |
| --- | --- | --- | --- |
| F1 | `meeting_followup_v1` references 4 non-existent capabilities and **auto-sends** email | `workflows/templates/meeting-followup-template.ts` | Retire after a zero-instance check; replace with `meeting_postprocess_v2` |
| F2 | Workflow steps call `capability.handler` directly | `workflow-step-runner.ts:394` | M0 T2 first |
| F3 | Proposal execute performs no mutation | `crm-proposal-bridge.ts` | M0 T3 before CRM proposals |
| F4 | Intelligence uses a direct Gemini REST call; no evidence; one record | `meeting-intelligence-actions.ts` | Replaced by the governed pipeline; legacy readable |
| F5 | Prep brief is template text; uses casts | `generateMeetingPrepBriefAction` | Replaced; same signature |
| F6 | No draft/messaging capability registered | registry | New draft-only capability |
| F7 | `meeting_prep` lacks `rbac:operations.meetings.view` | `agent-registry.ts:145` | Fix |
| F8 | Templates have no fan-out; tasks have no `cancelled` status | `workflow-template-types.ts`, `TaskStatus` | §4.3, §4.6 |
| F9 | M1 review R3/R7 affect M2 outputs | M1 review | M2·T0 |

### 2.3 Prerequisites (D14)

| Prerequisite | Why | When |
| --- | --- | --- |
| M1 review R1–R7 | Derived data must die with its transcript (R7); stable transcription (R3); operations (R1/R2/R5) | **M2·T0** |
| M0 T2 | Every pipeline step authorized, flagged, idempotent, audited | Before M2·T3 |
| M0 T3, T4, T6 | Real execute + compensation; permissioned durable approvals; binding + append-only audit | Before M2·T4.3 (CRM proposals) |

---

## 3. Functionality Preservation

| Area | Today | After M2 | Guarantee & proof |
| --- | --- | --- | --- |
| "Analyse meeting" | Direct REST call | Governed pipeline; same button and return shape | Contract test on the action's return |
| Existing `meeting_intelligence` docs | Displayed | Displayed as "Earlier analysis (no line references)" | Legacy adapter test |
| "Convert to task" | Task core (M1) | `meeting.create_followup_tasks`, same key `mtg_task_{meetingId}_{actionItemId}` for legacy items | Same task id across paths |
| Prep brief action | Template text | Grounded or labelled facts-only; same signature plus `citations`, `mode` | Signature test |
| `meeting_followup_v1` | Listed (would fail) | Non-instantiable; removed after zero-instance verification | Registry test + data check |
| Composer | `?meetingId=` | Adds `?draftId=` (loaded server-side, permission-checked) | Composer test |
| Phase 9/10 agents, proposals | Unchanged | Unchanged (proposal path fixed by M0) | Suites green |

**Deliberate behaviour changes:** no evidence → no item; no transcript → no analysis; nothing is sent by the system.

---

## 4. Design

### 4.1 Personas, identity, delegation (Rules 16, 17; master §5.5, §6)

| Persona | Change | Ceiling | Never (non-delegable) |
| --- | --- | --- | --- |
| `meeting_prep` | + `rbac:operations.meetings.view` | L0 | Any write |
| `meeting_analyst` (new) | Domains: meetings_conversations, tasks_productivity, crm_contacts (proposals), knowledge_memory (read) | L1 autonomous; L2 by approved proposal; drafts only | Send; approve; decide inbox items; change consent/retention; delete transcripts; read `restricted` memory; cross-workspace reads |

- Every run and step carries `organizationId, workspaceId, userId, agentId, agentVersion, runId, delegationId, policyVersion, toolInvocationId`. Authority = user ∩ agent ∩ workspace ∩ tool ∩ delegation ∩ policy, **re-derived live per step** (M0 T1 live standing).
- A highly privileged user never widens the persona.
- Sub-agents attenuate monotonically (test).
- Persona count 15 → 16 (`knowledge_agent` → 17 in M4).

### 4.2 Capabilities (all via `executeCapability`)

| Capability | Risk (enforced) | Delegable | MCP annotations (hints only) | Server-side enforcement |
| --- | --- | --- | --- | --- |
| `meeting.generate_prep_brief` | L0 | Yes | readOnly | meetings view; per-source authorization; budget |
| `meeting.extract_intelligence` | L1 | Yes | idempotent | meetings edit; consent `ai_read`; `aiUse`; data policy; quota |
| `meeting.summarize` | L1 | Yes | idempotent | same + validated items only |
| `meeting.get_intelligence` | L0 | Yes | readOnly | view; agents only when `aiUse` allowed + consent |
| `meeting.create_followup_tasks` | L1 | Yes | idempotent | tasks create; from validated items only |
| `meeting.propose_crm_update` | L2 proposal | Proposal yes, **approve/execute no** | — | binding §4.12; allowed targets D17 |
| `meeting.draft_followup` | L1 storing an L3-class draft | Yes (draft only) | openWorld false (no send) | recipients §4.7; egress check; consent; `aiUse` |
| `meeting.delete_followup_draft` | L1 | Yes | — | owner or meetings edit |

- **Annotations are advisory.** A "lying annotation" test proves enforcement doesn't rely on them (Rule 12).
- Each tool gets a fingerprint baseline (Rule 14).
- Capability versions are `1.0.0`; the prompt version is recorded on every output (Rule 36).
- **Flags (Rule 64):** `defaultEnabled: false` for automated surfaces until T8; human surface on behind `FF_MEETING_AGENT` per workspace.

### 4.3 Post-meeting pipeline `meeting_postprocess_v2` (static steps; F8)

```text
1 load      L0  get transcript pages (≤ 20) + consent ai_read + aiUse + data policy          (checkpoint)
2 extract   L1  ONE step: chunk (speaker turns, ≤ 6k tokens, ≤ 25 chunks, 1-turn overlap);
                for each chunk (≤ 4 concurrent) call the model; per-chunk result stored under
                `mtg_ext_{transcriptId}_{chunk}_{promptVersion}` so a retry resumes, never redoes  (checkpoint per chunk)
3 validate  pure: schema → business → evidence → dedupe (itemHash)                           (checkpoint)
4 summarize L1  validated items only                                                          (checkpoint)
5 store     header-last write of v2 intelligence; emit meeting.intelligence.completed (ids/counts only)
```

- **Durability (Rules 25, 26):**
  - leases + recovery service;
  - step retries ×3 with backoff and jitter → `dead_lettered` + Backoffice recovery;
  - cancellation checked between chunks and steps.
- **Concurrency:**
  - one run per transcript (a duplicate trigger returns the running run);
  - a newer transcript cancels the older run, whose output is never stored over newer data;
  - queue `meeting-intelligence` ≤ 10 concurrent.

### 4.4 Evidence and validation (Rules 30, 31, 47, 48)

**Item:**
```text
{ type: topic|decision|commitment|action_item|buying_signal|objection|risk|question,
  text, owner?{name, participantId?, userId?}, dueDate?{iso, resolvedFrom, timeZone},
  amount?{value, currency|null}, confidence, contradicts?: itemHash[],
  evidence: [{ segmentIds[], quote }], needsReview: boolean }
```

**Validation:**
1. Schema (Zod).
2. Every segment id is in the chunk.
3. Every quote (normalised) is a substring of the cited segments, ≥ 3 words.
4. Dates are resolved against the meeting date and workspace time zone; unresolvable dates are dropped.
5. Amounts need a currency or are flagged ambiguous.
6. Owners map to a speaker or participant, else "Unassigned".
7. Low-confidence evidence (< 0.6) or an injection-flagged transcript → `needsReview` (no one-click action).
8. Contradictory items are kept and linked.

**Counts are kept for the "why" view:** dropped (reason), kept, `needsReview`.

### 4.5 Prep brief with a context budget (Rules 28, 47, 56)

- **Retrieval budget:**
  - Account360 ≤ 30 sourced items;
  - last 5 meetings with this entity (validated items only);
  - open tasks ≤ 20;
  - open deals ≤ 10.
- **Ranking and selection:** dedupe by source id; temporal decay (newer first, commitments by due date); source diversity (≥ 1 item per available source type).
- **Context cap:** 30k tokens. "Found N, using M" is recorded and shown.
- **Output:** `{objective, history[], openDeals[], openCommitments[], risks[], agenda[], questions[], citations}`. Every element carries `sourceIds` that must exist in the assembled set; uncited elements are dropped.
- **Facts-only mode:** model down, quota reached or policy disallows → deterministic brief from the same sources, labelled.
- **Per-item authorization:** each source is re-checked against the caller's workspace (no cross-workspace ids; red-team test).

### 4.6 Tasks (Rules 19, 27)

- **Created from:** validated `action_item` / `commitment` items, via `createTaskCore`.
- **Fields:** `origin {meetingId, transcriptId, itemHash}`; `source: 'system'`; owner = mapped workspace user else unassigned (assignee shown, never guessed).
- **Undo (compensation):**
  - `deleteTaskCore` only if the task is unchanged since creation (`updatedAt` = `createdAt`, version-checked);
  - otherwise "This task was edited, so it wasn't removed. Remove it from Tasks if needed."

### 4.7 Follow-up draft (PRD draft → approval → send; Rules 32, 33)

- **Content:** validated items only; uncited sentences are removed.
- **Recipients:** meeting participants with emails + contacts of the linked entity. Others are refused.
- **Egress:** `evaluateEgress(draft, 'email', tenant, { allowedSensitivityCeiling: 'confidential' })`. Restricted/financial/credential detections block the draft. Personal data about anyone other than the recipients is removed or blocked (cross-domain exfiltration, Rule 32).
- **Stored, never sent:** in `meeting_followup_drafts` (server-only, versioned).
- **"Open in composer":** `/admin/messaging/composer?meetingId=…&draftId=…`. The composer loads the draft server-side after a permission check. A person sends from there.
- **Stops:** `aiUse: 'restricted'`, missing `aiProcessing` consent, or a data policy that allows no model.

### 4.8 Storage

```text
meeting_intelligence/{meetingId}                    v2 header (transcriptId, transcriptHash, version,
                                                    schemaVersion 2, status, summary, counts, dropped counts,
                                                    provider{model, modelVersion, promptVersion, inputHash,
                                                    outputHash}, costUnits, runId)
meeting_intelligence/{meetingId}/items/{itemHash}   validated items with evidence
meeting_intelligence_runs/{runId}/chunks/{i}        per-chunk checkpoints (raw validated output)
meeting_followup_drafts/{draftId}                   draft, recipients, version, sourceItemHashes
meeting_agent_shadow_runs/{runId}                   shadow outputs + metrics (never shown)
```

- **Rules:** all of the above are server-only (client read only for the header and items of one's own workspace, like M1).
- **Retention (M1 R7 fix):** the transcript cascade deletes intelligence, items, runs and drafts.
- **TTL (T0.9 list):** chunk checkpoints 30 d; shadow runs 90 d.

### 4.9 Trust-boundary matrix (Rule 13)

| Data | Class | Instructions? | Handling |
| --- | --- | --- | --- |
| Persona prompts, prompt templates | SYSTEM TRUST | Yes (only these) | Versioned; never concatenated with data outside a delimited block |
| Operator actions (UI) | USER TRUST | No | Authorized; never widen the persona |
| Consent, compliance, data policy | TENANT TRUST | No | Server-read |
| CRM records, tasks, deals, Account360 | INTERNAL DATA | No | Per-item authorization before context |
| Transcript text, quotes | CUSTOMER DATA (untrusted) | **Never** | `<untrusted_reference_data>` delimiting; injection flag → review |
| Model output (items, summary, brief, draft) | MODEL-GENERATED (untrusted) | Never | Schema → business → evidence → permission → policy |
| Capability results inside the pipeline | UNTRUSTED TOOL OUTPUT | Never | Parsed and validated before the next step (Rule 48) |
| Third-party MCP / web | Not used | — | N/A: no external sources in M2 |

### 4.10 `unknown` boundaries (Rule 4)

`unknown` appears only at these boundaries, each followed immediately by a schema:
- model responses;
- workflow step inputs/outputs;
- Firestore reads (intelligence v1/v2, drafts, checkpoints, Account360 records);
- Server Action arguments;
- composer `draftId` loading.

No `any` and no unchecked casts; the existing prep-brief casts are removed.

### 4.11 Mutation contracts (Rules 18–20)

| Mutation | Idempotency key | Retry | Duplicate | Lost response | TOCTOU token |
| --- | --- | --- | --- | --- | --- |
| Extract chunk | `mtg_ext_{transcriptId}_{chunk}_{promptVersion}` | Safe | Cached result | Re-run reads checkpoint | Transcript `version` |
| Summarize | `mtg_sum_{transcriptId}_{itemsHash}_{promptVersion}` | Safe | Cached | Same | Items hash |
| Store intelligence | run id + transcript version | Safe | Older run refused | Re-read header | Header `version` |
| Create task | `mtg_task_{meetingId}_{itemHash}` (legacy: `…_{actionItemId}`) | Safe | Same task | Re-call returns it | Item hash + intelligence version |
| Undo task | `mtg_task_undo_{taskId}` | Safe | No-op | Re-check existence | Task `updatedAt` |
| Propose CRM update | `mtg_crm_{meetingId}_{targetId}_{fieldHash}` | Safe | Same proposal | Same | Target `updatedAt` at propose and execute |
| Execute approved proposal | approval id | Safe (bridge) | Already executed | Verify postcondition | Target version in binding |
| Draft | `mtg_draft_{meetingId}_{intelligenceVersion}` | Safe | Same draft | Same | Intelligence version |

Execution records carry `runId, toolCallId, executionId, idempotencyKey, status (first|retry|duplicate|already_completed|unknown_outcome), attempt, agentVersion, toolVersion, schemaVersion, policyVersion, modelVersion, promptVersion` (master §5.3).

### 4.12 Two-phase actions and approval binding (Rules 21, 22)

| Action | Preview shows | Bound to (in the hashed canonical payload) | Invalidated by |
| --- | --- | --- | --- |
| CRM update | Field, current → proposed value, evidence quotes | target id + `updatedAt`, field, value, transcriptHash, intelligence version, policy and tool version, expiry 24 h | Record edited, re-analysis, policy change, expiry |
| Task creation (bulk) | Number of tasks + titles | itemHashes + intelligence version | Re-analysis |
| Draft | Recipients + text | draft version | Edit (creates a new version) |

- **Approvers:** `approvals:decide` + workspace membership; never the proposer.
- **Verify after execute:** re-read the target, assert the change, record the result. A mismatch is surfaced and audited.

### 4.13 Cancellation (Rule 26)

| Operation | Cancellable | When | In-flight | Partial state |
| --- | --- | --- | --- | --- |
| Pipeline | Yes | Between chunks and steps | The current model call finishes; its result is discarded | Run `cancelled`; checkpoints kept 30 d for reuse; nothing stored as intelligence |
| Brief | Request-scoped | Client abort | Server finishes, result dropped | None |
| Draft generation | Request-scoped | Same | Same | None |
| Approved proposal | Before execute only | — | — | Execution is atomic per proposal |

### 4.14 Saga / compensation (Rule 27)

| Flow | Failure point | Compensation |
| --- | --- | --- |
| Pipeline | After some chunks | Resume from checkpoints; on abandon, nothing stored |
| Store | Items written, header fails | Header-last; next attempt overwrites items under the same run |
| Bulk tasks | Some created | Idempotent retry completes the rest; undo per task |
| CRM proposal executed | Wrong in hindsight | Rollback through the bridge's compensating capability (M0 T3), version-checked |
| Draft | Recipients changed after generation | New version; old version kept for audit |

---

## 5. Budgets, Quotas, Backpressure (Rules 9, 23, 24)

| Field (Rule 23) | Pipeline (per meeting) | Brief | Draft |
| --- | --- | --- | --- |
| maxDuration | 180 s/step, 30 min total | 20 s | 20 s |
| maxTokens | 120k | 30k context, 4k out | 8k |
| maxToolCalls / maxParallelCalls | 40 / 4 | 8 / 4 | 4 / 1 |
| maxExternalRequests | 26 model calls (≤ 25 chunks + 1 summary) | 1 | 1 |
| maxRecordsRead / maxRecordsMutated | 500 / 0 (store only) | 100 / 0 | 50 / 1 draft |
| maxMessageCount | 0 | 0 | 0 sends |
| maxFinancialValue | 0 | 0 | 0 |
| maxRetryCount | 3 per step | 1 | 1 |

- **Limits:** queue concurrency 10; per-workspace 50 pipelines/day; per-org model cost ceiling (Backoffice); per-user 60 briefs/hour.
- **Exceeded:** a clear message ("Daily meeting-analysis limit reached. Resets at 00:00.").
- **Circuit breakers:** per model tier and provider. When open, the brief falls back to facts-only, and the pipeline answers "retry later" (503 semantics) without burning attempts.

---

## 6. Model routing (Rules 38, 57, 58)

| Task | Tier | Fallback |
| --- | --- | --- |
| Chunk extraction | Fast/default (Flash) | Next allowed model in the same tier; else retry later |
| Summary, brief, draft | Reasoning (Pro) | Default tier; brief → facts-only |

- **Data policy:** `resolveAiDataPolicy` before every call; `dataClass: 'personal'` for transcript content. No allowed model → a clear refusal.
- **No MCP Sampling;** everything goes through `src/ai/genkit.ts`.
- **Prompts** are versioned files with a recorded hash. A new prompt version goes through shadow and canary (Rule 65).

---

## 7. Matrices (Rule 66: Phase 9–13 deliverables)

### 7.1 Permission matrix

| Capability | Human view | Human edit | `meeting_prep` | `meeting_analyst` | MCP |
| --- | --- | --- | --- | --- | --- |
| generate_prep_brief | ✓ | ✓ | ✓ | ✓ | off until T8 |
| extract / summarize | — | ✓ | ✗ | ✓ | off |
| get_intelligence | ✓ | ✓ | ✓ (consent) | ✓ (consent) | off |
| create_followup_tasks | — | ✓ | ✗ | ✓ (L1) | off |
| propose_crm_update | — | ✓ | ✗ | propose only | off |
| approve / execute proposal | approvers only | approvers only | ✗ | ✗ | ✗ |
| draft_followup | — | ✓ | ✗ | ✓ (draft) | off |
| send | composer (human) | composer (human) | ✗ | ✗ | ✗ |

### 7.2 Egress matrix (Rules 32, 33)

| Data | Destination | Allowed when |
| --- | --- | --- |
| Transcript chunks | Allowed model provider | Consent `ai_read`, `aiUse` allowed, data policy, flag on |
| Account360 items | Allowed model provider (brief) | Per-item authorization; `restricted` excluded |
| Draft text | Composer (internal) | Egress check passed |
| Draft text | External email | Only when a person sends from the composer |

### 7.3 Failure matrix

| Failure | Behaviour | Person sees |
| --- | --- | --- |
| Model 429/5xx/timeout | Breaker; retry ×3; DLQ | "Analysis is delayed. We'll keep trying." |
| Malformed model JSON | Chunk fails schema → retry once → chunk skipped with count | "Some parts couldn't be analysed." |
| All items dropped | Store an empty result with reasons | "No clear decisions or actions were found." |
| Consent withdrawn mid-run | Stop before store | "AI analysis is off for this meeting." |
| Quota / cost ceiling | Refuse | Plain limit message |
| Stale proposal | Refuse; offer re-proposal | "This record changed. Review the update again." |
| Model unavailable (brief) | Facts-only | Labelled |

### 7.4 Rollback plan

Flags off (per capability, persona, trigger) · undo tasks · proposal rollback · drafts deletable · prompt version rollback in Backoffice.

---

## 8. Tasks (TDD, small local commits; M1 conventions)

### T0: M1 review fixes (prerequisite) · Rules 9, 18, 23, 25, 57

R1 (24 h retention interval), R2a/R2b, R3, R4, R5, R6, R7, each with the tests named in the M1 review.

### T1: Personas, identity and matrices · Rules 16, 17, 59, 66

| Step | Action |
| --- | --- |
| 1.1 | Tests: persona count 16; `meeting_prep` can read meetings, can't write; `meeting_analyst` refused for send/approve/decide/consent/delete/restricted; intersection authority; sub-agent attenuation; live standing per step |
| 1.2 | Persona changes; `src/platform/agents/meetings/personas/meeting-agent-matrix.ts` (§7) |
| 1.3 | Registered-id guard for every matrix capability |

### T2: Grounded prep brief · Rules 28, 31, 47, 56, 58

| Step | Action |
| --- | --- |
| 2.1 | Context7: Genkit structured output + Gemini tiers + token counting; record versions |
| 2.2 | Tests (fake model): citations exist; uncited dropped; cross-workspace source id rejected; budget "found N, using M"; ranking (recency, diversity); facts-only on model down / breaker open / quota / policy; no linked entity |
| 2.3 | `src/lib/meetings/prep-brief-service.ts` + `meeting.generate_prep_brief`; action delegates (no casts) |

### T3: Extraction pipeline · Rules 23–27, 30, 31, 39, 43

| Step | Action |
| --- | --- |
| 3.1 | Pure modules + property tests: chunker, evidence validator, date resolver (time zones), currency, itemHash, contradiction linker |
| 3.2 | Capabilities `extract_intelligence`, `summarize`, `get_intelligence`; prompt files with versions; replay record |
| 3.3 | `meeting_postprocess_v2` (static steps; per-chunk checkpoints); retire v1 after a zero-instance check |
| 3.4 | Tests: happy path; fabricated quote dropped; foreign segment id dropped; injection → `needsReview`; chunk retry → resume from checkpoint (no repeat model call); DLQ; cancel between chunks; supersede by a newer transcript; duplicate trigger; quota/cost refusal; consent withdrawn mid-run; breaker open → retry later |
| 3.5 | `generateMeetingIntelligenceAction` runs the pipeline; legacy adapter; OTel spans per step/chunk |

### T4: Actions from items · Rules 18–22, 27, 32, 33

| Step | Action |
| --- | --- |
| 4.1 | `create_followup_tasks` + undo (version-checked delete); legacy "Convert to task" keeps its key |
| 4.2 | `draft_followup` + recipient restriction + `evaluateEgress` + consent/`aiUse` stops; drafts store; composer `draftId` loading (server-side, permission-checked) |
| 4.3 | *(after M0 T3/T4/T6)* `propose_crm_update` with canonical payload binding; execute via the fixed bridge; postcondition verify; rollback |
| 4.4 | Tests: double-click → one task; undo refused after edit; recipient outside meeting refused; another contact's PII blocked; restricted content blocked; stale target → re-propose; self-approval denied; approval invalidated by re-analysis; lost response → key replay |

### T5: Evaluation and shadow · Rules 42, 44, 59

| Step | Action |
| --- | --- |
| 5.1 | ≥ 20 transcripts with gold items + spans (sales, onboarding, support, EN/FR/Twi-mixed, no-decision, injection-laced, contradictory, relative dates, ambiguous currency) |
| 5.2 | Scorer: per-type P/R/F1, span validity, fabricated items, uncited claims, unnecessary tool calls (Rule 59) |
| 5.3 | CI: hermetic (scripted fake model). Offline: `scripts/eval-meeting-agent.ts` with the real model under a capped budget (D18). Gates: decision/commitment F1 ≥ 0.8, span validity 100%, fabricated = 0 |
| 5.4 | Shadow (Rule 42): ladder shadow → internal beta → canary workspace → limited → delegated. Shadow writes `meeting_agent_shadow_runs` (never shown) and compares with heuristic and human tasks; blast-radius report |

### T6: Minimal UI (theme.md §8, mobile-first) · Rules 7, 41, 52, 54

| Step | Action |
| --- | --- |
| 6.1 | Outcomes panel: items grouped, quote + "Line N" jump; `needsReview` badge; actions per item |
| 6.2 | "Why?" sheet per item/proposal/draft: goal, evidence, prompt/model version, policy, actor, result, verification (Rule 41; no chain-of-thought) |
| 6.3 | Brief card with citations; facts-only label |
| 6.4 | Draft sheet (recipients restricted, editable, "Open in composer"; no Send) |
| 6.5 | Performance (Rule 54): panel JS ≤ 40 KB gz lazy-loaded; first item paint ≤ 300 ms after data; lists > 100 items paged. Boundary tests: new server modules `server-only`, not imported by clients |

### T7: Backoffice and operations · Rules 60–63

| Step | Action |
| --- | --- |
| 7.1 | Monitor: runs, DLQ reprocess, per-workspace usage vs quota, per-org cost vs ceiling, shadow results, latest eval |
| 7.2 | Dead-man controls: disable persona, each capability, auto-trigger; pause the pipeline queue |
| 7.3 | Prompt versions: list, pin, roll back (canary) |
| 7.4 | Security feed: injection-flagged meetings, dropped-for-fabrication counts, egress blocks, refused recipients, self-approval attempts, cross-workspace source rejections |
| 7.5 | Runbook update: model outage, cost spike, bad prompt version, wrong CRM change (rollback) |

### T8: Verification and report · Rules 45, 46, 66, 67

- **Emulator E2E (workflow A):** transcript → items → task → proposal → approve → verified change → rollback.
- **Red team:** instructions in transcripts, fabricated quotes, cross-workspace source ids, recipient injection, self-approval, approval replay after re-analysis, confused deputy (agent acting beyond the user).
- **Chaos** (expected behaviour per §7.3): model 429/500/timeout, malformed JSON, Cloud Run restart mid-pipeline, Firestore contention on store.
- **Load:** 20 concurrent pipelines.
- **Close-out:** gate answers + report.

---

## 9. Ordering, Flags, Rollout

```text
M2·T0 ─► M0·T2 ─► T1 ─► T2 ─┐
                       T3 ─┼─► T5 ─► T6 ─► T7 ─► T8
        M0·T3/T4/T6 ─► T4 ─┘
```

- **Flags (Rule 64):** `FF_MEETING_AGENT` (global/org/workspace) + per-capability + per-persona; automated surfaces off until T8; auto-trigger off (D15).
- **Canary (Rule 65):** prompt or model changes go 5 → 20 → 50 → 100%. Roll back if fabricated > 0, span validity < 100%, failure > 10%/h, or cost > 120% of forecast.

---

## 10. Rules Conformance Matrix

### 10.1 Important Rules 1–10

| Rule | Conformance | Verified by |
| --- | --- | --- |
| 1 | Skills (`.agents/skills`): next-best-practices, vercel-react-best-practices, emilkowal-animations, frontend-design, backend-patterns, firebase-ai-logic, cybersecurity-analyst, test-driven-development, verification-before-completion. Preservation §3; tracker §18 | Review |
| 2 | Risks §12; refactors: one prep-brief service, one evidence validator, legacy delegation; TDD; local typecheck/lint/commit; no push | Commit log |
| 3 | Affected features §14; Backoffice T7 | Backoffice tests |
| 4 | §4.10 | Lint + review |
| 5 | Rules, indexes and queue staged with written approval; no auto-deploy | Approval record |
| 6 | No new dependencies; Context7 before Genkit/Gemini work (T2.1) | Report |
| 7 | Minimal mobile-first UI, plain copy, reuse of M1 components | Viewport tests |
| 8 | Injection, fabrication, exfiltration, self-approval, cross-workspace: red team T8 | Security suite |
| 9 | §5 budgets; bounded reads; queue limits; edge cases §12 | Load tests |
| 10 | `@fileOverview` + `// CAUTION:` + testability notes at validators, binding, recipients, budgets | Review |

### 10.2 Rules 11–69

| Rule | Conformance |
| --- | --- |
| 11 | No MCP code changes in M2; spec 2026-07-28 / SDK ^2.1.0 unchanged (recorded) |
| 12 | §4.2 annotations advisory; lying-annotation test |
| 13 | §4.9 |
| 14 | Fingerprint baseline extended for each new tool |
| 15 | N/A: no external MCP servers |
| 16, 17 | §4.1 identity fields, intersection, live per step, non-delegable list |
| 18–20 | §4.11 |
| 21, 22 | §4.12 |
| 23 | §5 |
| 24 | Breakers per tier/provider |
| 25 | Retry → DLQ → manual recovery; terminal states `completed/failed/cancelled/dead_lettered` |
| 26 | §4.13 |
| 27 | §4.14 |
| 28 | §4.5 retrieval/context budgets, ranking, dedupe, temporal decay, diversity, "found N, using M" |
| 29 | Memory writes belong to M3 (Inbox); M2 items carry provenance, confidence and dates ready for it |
| 30 | Injection flag → review; source trust recorded; instruction-like content never acted on |
| 31, 47 | Model → validator → policy → permission → executor → verifier |
| 32, 33 | §7.2; `evaluateEgress`; recipient allow-list; no sends |
| 34 | No URL fetching (N/A beyond M1 rules) |
| 35–38 | Unchanged MCP; no Sampling; generation via the gateway |
| 39 | Spans: load, chunk[i], validate, summarize, store, brief, draft, propose, execute, verify |
| 40 | Append-only audit via M0 T6; drafts and proposals versioned, never edited in place |
| 41 | "Why?" view T6.2 |
| 42 | Shadow ladder T5.4 |
| 43 | Replay record (inputs hash, prompt/model version, retrieval set ids, outputs hash) + fake-model replay |
| 44–46 | Fake model; chaos and red team T8 |
| 48 | Pipeline step outputs validated before the next step |
| 49, 50 | Nothing public; no caching of intelligence or drafts across requests |
| 51 | Every new/changed action authorized first (sweep stays green) |
| 52 | Boundary tests T6.5 |
| 53 | No new dependencies |
| 54 | Budgets T6.5; pipeline p95 ≤ 4 min for a 1 h meeting; brief p95 ≤ 8 s |
| 55 | N/A: no graph UI (M3/M5) |
| 56 | Summaries and briefs keep source ids, dates, entities, decisions and uncertainty |
| 57, 58 | §6 |
| 59 | Tool-selection guard + eval of unnecessary calls |
| 60–63 | T7 |
| 64, 65 | §9 |
| 66 | §7 deliverables |
| 67 | §11 |
| 68 | Model not the boundary; tool output untrusted; every mutation idempotent + authorized + version-checked + audited; bounded authority/resources; operable without code |
| 69 | Everything through capabilities (UI, agents, workflows) |

---

## 11. Implementation Gate (Rule 67), answered

```text
ARCHITECTURE
□ Capability       §4.2 via executeCapability
□ Duplication?     No: reuses transcript store, consent, gateway, data policy, Account360, task core,
                   workflows, approvals/bridge, egress engine, composer
□ Source of truth  Firestore (intelligence v2, drafts, checkpoints); CRM records unchanged except via approved proposals
□ Events           meeting.intelligence.completed / .failed / .cancelled, meeting.followup.drafted,
                   meeting.crm_update.proposed (ids/counts only)
AUTHORITY
□ Who              §7.1
□ Agent may        L0 reads, L1 extract/summarize/tasks/drafts, propose L2
□ Agent never      send, approve, execute proposals, decide inbox, consent, delete, read restricted
□ Sub-agent        attenuated; cannot inherit non-delegable
DATA
□ In               transcript pages, Account360 items, prior validated items
□ Out              model calls to allowed providers; draft to composer
□ Trusted          system prompts; validated operator input
□ Untrusted        transcripts, model outputs, step outputs
□ Sensitive        transcripts (personal), drafts (personal), restricted CRM excluded
EXECUTION
□ Idempotent       §4.11
□ Retry            yes, bounded
□ Cancel           §4.13
□ Duplicate        detected by keys / one run per transcript
□ Record changed   version tokens + binding; re-propose
□ Response lost    replay by key; postcondition verify
MCP
□ Version / SDK    unchanged (2026-07-28 / ^2.1.0); no new MCP surface in M2
□ Annotations      §4.2 (advisory)
□ Definition change fingerprint drift blocks
FAILURE            §7.3 (timeout, 429, 500, partial, provider down, stale approval, concurrent edit)
SECURITY           injection · fabrication · tool poisoning (fingerprints) · confused deputy (intersection) ·
                   SSRF N/A (no URL fetching) · exfiltration (egress) · escalation (non-delegable) · cross-tenant
OPERATIONS         disable, inspect, replay, rollback, policy without code: T7
TESTING            unit · integration · contract · workflow · E2E · security · tenant isolation · adversarial ·
                   load · chaos · evaluation
MIGRATION          legacy intelligence readable; v1 template retired after zero-instance check; no backfill;
                   restore via PITR (runbook); rollback = flags off + compensations
N/A                11 (no MCP change), 15, 34 (beyond M1), 35–38 (unchanged), 55: reasons in §10.2
```

---

## 12. What Could Go Wrong & Edge Cases

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | Hallucinated decisions/commitments | Evidence validation; zero-fabrication gate; review for low confidence |
| R2 | Instructions in transcripts trigger actions | No actions in the pipeline; actions from items via people or approvals; injection → review |
| R3 | Building on fake proposal execution | Prerequisite ordering (D14) |
| R4 | Cost spikes | Chunk caps, checkpoint reuse, quotas, cost ceiling, canary cost gate |
| R5 | Wrong dates/time zones | Meeting date + workspace TZ; drop unresolved; TZ tests |
| R6 | Multilingual/code-switched speech | Keep original language; eval coverage |
| R7 | Stale approvals | Binding incl. versions; 24 h expiry |
| R8 | Pipeline killed mid-run | Leases, checkpoints, resume |
| R9 | Retiring v1 breaks something | Zero-instance check; non-instantiable first |
| R10 | Draft leaks other customers' data | Recipient allow-list + egress scan + source restriction |
| R11 | Undo deletes a task someone already used | Version-checked delete; refuse after edits |

**Edge cases** (each has a test):
- no transcript;
- restricted transcript or consent withdrawn mid-run;
- no decisions;
- single speaker;
- no linked entity;
- entity deleted mid-pipeline;
- deal closed between proposal and approval;
- two approvers at once;
- approver loses permission;
- flag off mid-run;
- spans outside the chunk;
- contradictions;
- ambiguous currency;
- duplicate trigger;
- newer transcript;
- 25+ chunk transcript (truncated with a clear note);
- brief with zero sources;
- recipients with no email.

---

## 13. UX Notes (Rule 7)

"Analyse meeting", "Line 42", "Needs review", "Create task", "Undo", "Propose update", "Draft follow-up", "Open in composer", "AI summary unavailable; showing facts only.", "Why?". Guidance lives in `CardInfoTooltip`; bottom sheets on phones; 44 px targets.

## 14. Affected Features

Meeting detail (intelligence tab, action items, brief), Tasks (origin), CRM proposals/approvals, workflow template registry, messaging composer (`draftId`), Backoffice meetings monitor + security feed, AI usage/cost reporting, retention cascade.

## 15. Backoffice

T7, plus per-org cost ceiling, per-workspace quota, prompt version control, shadow and eval results.

## 16. Deployment (Rule 5)

Needs written approval:
- rules for the new collections;
- indexes (items by type; drafts by meeting; runs by status/time; shadow runs by time);
- Cloud Tasks queue `meeting-intelligence`;
- flags;
- TTL policies (chunks 30 d, shadow 90 d).

## 17. Decisions

| # | Decision | Recommended |
| --- | --- | --- |
| D14 | Prerequisite order | M2·T0 + M0·T2 first; M0·T3/T4/T6 before CRM proposals |
| D15 | Automatic analysis on transcript completion | Off by default; per-workspace switch after shadow |
| D16 | Follow-up delivery | Draft only; person sends from the composer |
| D17 | CRM fields the agent may propose | Deal stage, next step, expected close date, entity note, tags; never amounts/owners |
| D18 | Real-model evaluation spend | Offline capped run before canary; CI hermetic |
| D19 | Model tiers | Flash for chunks; Pro for summary, brief, draft, within tenant policy |
| D20 | Task undo after edits | Refuse with explanation (no silent deletion of edited work) |

## 18. Tracker

| ID | Task | Status | Evidence |
| --- | --- | --- | --- |
| P11-M2-T0 | M1 review fixes R1–R7 | ☐ | |
| (M0) | T2 · T3 · T4 · T6 | ☐ | M0 plan |
| P11-M2-T1 | Personas, identity, matrices | ☐ | |
| P11-M2-T2 | Grounded prep brief | ☐ | |
| P11-M2-T3 | Extraction pipeline + v2 template | ☐ | |
| P11-M2-T4 | Tasks · drafts · CRM proposals | ☐ | |
| P11-M2-T5 | Evaluation + shadow | ☐ | |
| P11-M2-T6 | Minimal UI + "Why?" + performance/boundary | ☐ | |
| P11-M2-T7 | Backoffice + runbook | ☐ | |
| P11-M2-T8 | Verification + report | ☐ | |

## 19. Next Step

1. Confirm D14–D20.
2. Approve deploying the M1 T0 hotfixes.
3. Start M2·T0 → M0·T2.
