# Phase 11 · Milestone 2 Implementation Plan
## Meeting Agent: Grounded Prep Briefs and Evidence-Backed Post-Meeting Intelligence

**Version:** 1.0.0
**Status:** PLANNING. Decisions D14–D19 in §15.
**Date:** 2026-10-05
**Parent:** [`agents_mcp_phase_11_master_plan.md`](agents_mcp_phase_11_master_plan.md) §1.1 (workflow A), §5.3–5.6, §5.9, §6, §8, §13 (P11-M2-T1…T5).
**Depends on** (details in §2.3):
- M1 (done locally) plus its review fixes R1–R7.
- M0 T2 (gateway everywhere), T3 (real proposal execute), T4 (durable permissioned approvals) and T6 (approval binding).

**Rules:** [`agents_mcp_rules.md`](../agents_mcp_rules.md) Important 1–10 (as amended) and 11–69; `.agents/AGENTS.md`; `theme.md` §8.

**Documents reviewed for this milestone:**

| Document | Used for |
| --- | --- |
| Phase 11 master plan §1.1, §2, §5.2–5.6, §5.9, §6, §8, §9, §13 | Workflow A, contracts, budgets, routing, personas, deliverables, risks R1/R2/R5/R11/R13, edge cases |
| [M1 plan](agents_mcp_phase_11_milestone_1_plan.md), [completion report](agents_mcp_phase_11_milestone_1_completion_report.md), [M1 code review](agents_mcp_phase_11_milestone_1_code_review.md) | What M2 builds on; open R1–R7 |
| [M0 plan](agents_mcp_phase_11_milestone_0_plan.md), [M0 review](agents_mcp_phase_11_milestone_0_code_review.md) | Prerequisites T2–T4, T6; open R3, T0.9 |
| `agents_mcp_tools.md` Domain 6 | `meeting.generate_prep_brief`, `summarize`, `extract_action_items`, `create_followup_tasks`, `capture_decisions`, `link_to_crm`, `analyze_coaching` |
| `agents_mcp_roadmap.md` Phase 11 · Meeting agent | Before: research, interactions, deals, commitments, risks, agenda, questions. After: topics → signals → decisions → commitments → tasks → CRM updates → follow-up draft |
| `agents_mcp_prd.md` §80 (meeting-to-memory), "Meeting follow-up" (draft → **approval** → send), §127 metrics | Pipeline order; human approval before any send; success metrics |
| `agents_mcp_ui.md` §35 + Phase 11 | Brief fields; outcomes panel with Apply CRM updates / Create tasks / Draft follow-up |
| `docs/meetings/meetings_prd.md` §27, §60, §61, §97 | Insight model; prep inputs/outputs; post-meeting chain; "human approval configurable before AI updates sensitive CRM data" |
| `docs/meetings/meetings_ui.md` §30–31 | Intelligence and assistant layouts ("destructive CRM actions must require confirmation") |
| Code (verified 2026-10-05) | §2 |

---

## 1. Goal

**Before a meeting**, a person or agent can get a **prep brief in which every statement cites its source**:
- the client, history and open deals (Account360);
- previous meetings and open commitments from earlier meetings;
- risks, a suggested agenda and questions.

If the model is unavailable, the brief shows **facts only, labelled as such**, never invented prose.

**After a meeting**, a durable pipeline turns the transcript into topics, decisions, commitments, action items, buying signals, objections, risks and questions, then a grounded summary:
- **Every item points to the exact transcript lines it came from** (span-validated); items without valid evidence are dropped.
- From the items, people can create tasks (idempotent), propose CRM updates (approved before execution) and produce a follow-up **draft** that is never sent automatically.

**Non-goals (owned elsewhere):**
- Knowledge Inbox / memory writes (M3; M2 emits the items event M3 consumes).
- The Knowledge agent and MCP resources/prompts (M4).
- The full meeting UI (M5; M2 ships a minimal outcomes panel).
- Sending messages (people send from the existing composer).

---

## 2. Verified Baseline (code as of `c56d06e1`)

### 2.1 Reuse (Rules 7, 69)

| Asset | Location | State / use in M2 |
| --- | --- | --- |
| Transcript store, paging, legacy reader | `src/lib/meetings/transcript-store.ts` | Real (M1). Source for chunking |
| Ingestion, consent, AI-use gates | `transcript-ingestion.ts`, `consent-store.ts` | Real (M1). `ai_read` gate before any model call |
| AI gateway + data policy + audio routing | `src/ai/genkit.ts`, `src/platform/policy/ai-data-policy.ts`, `model-registry.ts` | Real. Extend routing with text tiers per policy |
| Intelligence prompt + parser | `src/lib/meetings/ai-intelligence-service.ts` | Real but no evidence spans; replaced by a v2 schema (kept for legacy display) |
| Heuristic action items | `src/lib/meetings/action-items-service.ts` | Real; used only as a shadow-mode baseline for evaluation |
| Account360 assembler | `src/platform/agents/crm/context/account-context-assembler.ts` | Real; items carry `sourceRef` (citations for the brief) |
| Durable workflows + Cloud Tasks worker | `src/platform/workflows/*` | Executes; **steps call `capability.handler` directly** (`workflow-step-runner.ts:394`, B6) |
| Proposal bridge + approval store | `src/platform/agents/crm/actions/crm-proposal-bridge.ts`, `capabilities/storage/approval-store.ts` | **Execute changes nothing** (only status + event, B7) |
| Persona registry | `src/platform/identity/agent-registry.ts` (15 personas; `meeting_prep` exists) | `meeting_prep` lacks `rbac:operations.meetings.view` |
| Phase 9/10 agent patterns | `agents/crm/{personas,evaluation}`, `agents/sales/{personas,evaluation}` | Matrices, eval datasets, shadow mode, blast radius: same shapes reused |
| Registered capabilities | `crm.note.create`, `crm.activity.create`, `deal.update`, `deal.advance_stage`, `task.*`, `meeting.*` (M1) | Execution targets for tasks and proposals |
| Egress policy engine | `src/platform/mcp/security/egress-data-policy.ts` | Applied to follow-up drafts (recipients + payload classes) |

### 2.2 Findings that shape M2

| # | Finding | Evidence | Consequence |
| --- | --- | --- | --- |
| F1 | `meeting_followup_v1` references 4 capabilities that don't exist (`meetings.get_transcript`, `memory.create_item` as a direct write, `crm.create_note`, `messaging.send_email`) and **auto-sends** an email to attendees | `src/platform/workflows/templates/meeting-followup-template.ts` | Retire it; replace with `meeting_postprocess_v2` (no sends, no direct memory writes) |
| F2 | Workflow steps bypass the gateway | `workflow-step-runner.ts:394` | M0 T2 must land first, or the pipeline would skip auth, flags, idempotency and audit |
| F3 | Proposal execute performs no mutation | `crm-proposal-bridge.ts` (~L250–300) | M0 T3 must land first; otherwise "Apply CRM update" would report success while changing nothing |
| F4 | Meeting intelligence still uses a direct Gemini REST call, has no evidence spans and is one record per meeting | `meeting-intelligence-actions.ts` (G13) | Replaced by the governed pipeline; the legacy record stays readable |
| F5 | Prep brief is template text ("No blocking issues identified", generic talking points) and uses casts | `generateMeetingPrepBriefAction` | Replaced by the grounded brief; same action signature |
| F6 | No draft or messaging capability is registered | registry listing | New `meeting.draft_followup` (draft only) |
| F7 | `meeting_prep` persona can't call meeting tools (missing view scope) | `agent-registry.ts:145` | Fix in T1 |
| F8 | M1 review R3 (declared duration) and R7 (deleting a transcript leaves derived intelligence) directly affect M2 outputs | M1 review | Fix in T0 before building on them |

### 2.3 Prerequisites (decision D14)

| Prerequisite | Why M2 needs it | Plan |
| --- | --- | --- |
| M1 review R1–R7 | R7: intelligence must disappear with its transcript; R3: transcription validation; R2b/R5: operations | **M2 · T0** |
| M0 T2: everything through `executeCapability` | Pipeline steps must be authorized, flagged, idempotent and audited | Execute the M0 plan task as-is before M2 · T3 |
| M0 T3: real proposal execute + compensation | "Apply CRM update" must change the record and be undoable | Before M2 · T4 (CRM part) |
| M0 T4 + T6: durable, permissioned approvals with binding | No self-approval; approval bound to the exact payload, target version, transcript hash and intelligence version | Before M2 · T4 (CRM part) |

**Recommended order:** M2·T0 → M0 T2 → M2·T1–T3 (briefs, extraction and tasks need only T2) → M0 T3/T4/T6 → M2·T4 CRM proposals → T5–T8. That way M2 value arrives early without building on the broken proposal path.

---

## 3. Functionality Preservation

| Area | Today | After M2 | Guarantee & proof |
| --- | --- | --- | --- |
| "Analyse meeting" button | Calls the direct REST action, one record | Same button, runs the governed pipeline; legacy records still display | Legacy-record display test; the action keeps its signature and return shape |
| Existing `meeting_intelligence` docs | Shown in the tab | Shown, marked "Earlier analysis (no line references)" until re-analysed | Snapshot test |
| Action item "Convert to task" | Task core (M1) | `meeting.create_followup_tasks` (same key, same task shape) | Same task id for the same item (idempotency test across old and new paths) |
| Prep brief action | Template text | Grounded brief; on model failure, a facts-only brief labelled as such | Same return type extended with `citations`, `mode` |
| `meeting_followup_v1` template | Listed; would fail on missing capabilities | Marked deprecated, not instantiable; v2 replaces it | Template registry test; no existing runs (verify count = 0 before removal) |
| Phase 9/10 agents and CRM proposals | Unchanged | Unchanged; the proposal path is fixed by M0 T3 | Their suites stay green |

---

## 4. Design

### 4.1 Personas (Rules 16, 17; master §6)

| Persona | Change | Ceiling | Never |
| --- | --- | --- | --- |
| `meeting_prep` | Add `rbac:operations.meetings.view`; domains unchanged | L0 | Any write |
| `meeting_analyst` (new) | Domains: meetings_conversations, tasks_productivity, crm_contacts (proposals), knowledge_memory (read). Permissions: meetings view/edit, tasks create, CRM proposals | L1 autonomous; L2 only by approved proposal; drafts only | Send; mutate CRM without approval; decide inbox items; read restricted memory; cross-workspace reads |

- Persona count goes 15 → 16 in M2. `knowledge_agent` (→ 17) arrives in M4, so the master plan's "17" is updated to happen across milestones.
- Matrices follow the Phase 9/10 file shapes: `meeting-agent-matrix.ts` with permission, tool, failure and rollback matrices.

### 4.2 Capabilities (all via `executeCapability`; master §5.3)

| Capability | Risk | Idempotency key | Notes |
| --- | --- | --- | --- |
| `meeting.generate_prep_brief` | L0 | n/a | Account360 + prior meetings + open commitments + open tasks; Pro tier; citation-constrained |
| `meeting.extract_intelligence` | L1 | `mtg_ext_{transcriptId}_{chunkIndex}_{promptVersion}` | One chunk; Flash tier; items with evidence |
| `meeting.summarize` | L1 | `mtg_sum_{transcriptId}_{itemsHash}_{promptVersion}` | Pro tier; input = validated items only |
| `meeting.create_followup_tasks` | L1 | `mtg_task_{meetingId}_{itemHash}` | Task core; compensating `task.complete` + `cancelled` marker (undo) |
| `meeting.propose_crm_update` | L2 (proposal) | `mtg_crm_{meetingId}_{targetId}_{fieldHash}` | Creates a bound proposal; execution through M0 T3 bridge targets `deal.update`, `deal.advance_stage`, `crm.note.create`, `crm.entity.add_tag` |
| `meeting.draft_followup` | L1 storing an L3-class draft (never sends) | `mtg_draft_{meetingId}_{intelligenceVersion}` | Recipients restricted (§4.7); egress policy applied |
| `meeting.get_intelligence` | L0 | n/a | Items + evidence + summary; agents get it only when `aiUse` is allowed and consent passes |

These capabilities ship with `defaultEnabled: false` for automated surfaces (`agentEnabled/mcpEnabled` false) until T8 passes, which closes the M1 review R6 pattern.

### 4.3 Post-meeting pipeline: workflow template `meeting_postprocess_v2`

```text
trigger: "Analyse meeting" (human) | transcript.completed event (D15, default off)
  1 load_transcript      L0  meeting.get_transcript (all pages ≤ 20) + consent ai_read + aiUse
  2 chunk                pure: speaker-turn chunks ≤ 6k tokens, ≤ 25 chunks, 1-turn overlap
  3 extract[i]           L1  meeting.extract_intelligence per chunk (≤ 4 in parallel)
  4 validate_merge       pure: schema → business → evidence-span validation → dedupe by stable itemHash
  5 summarize            L1  meeting.summarize (validated items only)
  6 store                pure+write: meeting_intelligence v2 (header + items subcollection), header-last
  7 emit                 meeting.intelligence.completed {meetingId, transcriptId, version, itemCount}
  (no task creation, CRM change or draft here: those are explicit human/agent actions on items)
```

- **Durability (Rule 25, master R13):** each step is a workflow step with leases, checkpointing, retries ×3 with backoff and jitter, DLQ, cancellation between steps, and resume after Cloud Run restarts.
- **Queue:** `meeting-intelligence` (max 10 concurrent).
- **Budgets (master §5.6):**
  - 120k tokens and ≤ 40 tool calls per meeting;
  - 180 s per step, 30 min per pipeline;
  - quota of 50 pipelines per workspace per day and a per-org cost ceiling.
- **Concurrency:** a new pipeline for the same transcript while one runs returns the running one. A newer transcript supersedes: the old run is cancelled and its output is never stored over newer output.

### 4.4 Evidence and validation (Rules 30, 31, 47; master R1)

**Item schema:**
```text
{ type: topic|decision|commitment|action_item|buying_signal|objection|risk|question,
  text, owner?{name, participantId?}, dueDate?{iso, resolvedFrom}, amount?{value, currency},
  confidence, evidence: [{ segmentIds[], quote }] }
```

**Validation pipeline** (an item failing any step is dropped and counted, never "fixed" by guessing):
1. **Schema:** Zod.
2. **Evidence:** every `segmentId` exists in the chunk; each `quote` (whitespace- and case-normalised) is a substring of the concatenated cited segments; quotes are ≥ 3 words.
3. **Business rules:**
   - Relative dates ("next Friday") are resolved against the **meeting date and the workspace time zone**, and unresolvable dates are dropped.
   - Amounts need an explicit currency (GHS/NGN/USD…) or are flagged ambiguous.
   - Owners must match a speaker or participant, or become "Unassigned".
4. **Trust:**
   - Items whose evidence is only low-confidence segments (< 0.6), or from an injection-flagged transcript, are marked `needsReview: true` and can't be acted on in one click.
   - Instruction-like quotes are kept as data and are never executed.

**Stable `itemHash`** = sha256(type, normalised text, sorted segmentIds). Used for dedupe across chunks and for idempotency downstream.

### 4.5 Prep brief (master §1; meetings PRD §60)

- **Inputs** (bounded, per-item authorization):
  - meeting and participants;
  - Account360 for the linked entity (≤ 30 sourced items);
  - the last 5 meetings with this entity, with their validated decisions and commitments;
  - open tasks (≤ 20);
  - open deals.
- **Output schema:** `{ objective, history[], openDeals[], openCommitments[], risks[], agenda[], questions[], citations }`. Each list item carries `sourceIds[]` that must exist in the assembled context. Uncited items are dropped and "found N, used M" is shown (Rule 28).
- **Model down or quota reached:** `mode: 'facts_only'`. The brief is built deterministically from the same sourced items (no generated prose) and labelled "AI summary unavailable; showing facts only."
- **No linked entity:** the brief says so plainly and covers only participants and prior meetings.

### 4.6 Tasks and CRM proposals (Rules 18, 19, 21, 22)

- **Tasks:** from validated `action_item` and `commitment` items. Due date from the resolved date; owner mapped to a workspace user when the participant is a user, otherwise unassigned. `origin: { meetingId, transcriptId, itemHash }`. Undo marks the task cancelled (compensation).
- **CRM proposals** (after M0 T3/T4/T6):
  - Allowed targets (D17): deal stage, next step, expected close date, a note on the entity, tags.
  - Never amounts or owners from meetings in M2.
  - Each proposal carries its evidence spans for the reviewer.
  - Binding: `payloadHash, targetId, targetVersion, transcriptHash, intelligenceVersion, policyVersion, toolVersion, expiresAt (24 h)`.
  - At execute time the target version is re-checked (TOCTOU), the change is applied through the existing capability (`deal.update` etc.), and the postcondition is verified.
  - No self-approval.

### 4.7 Follow-up draft (PRD "draft → approval → send"; Rules 32, 33)

- **Content:** grounded in validated items only (decisions, commitments with owners and dates, next steps). Uncited sentences are removed.
- **Recipients:** only meeting participants with emails, plus contacts on the linked CRM entity. Any other address is refused. Personal data from other records never enters the draft (egress policy, payload class `personal` → only to the people it concerns).
- **Stored, never sent:** in `meeting_followup_drafts` (server-only), versioned. "Open in composer" hands it to the existing messaging composer, where a person sends it (D16).
- **Restricted transcripts** (`aiUse: 'restricted'`) and missing `aiProcessing` consent stop draft generation.

### 4.8 Storage

```text
meeting_intelligence/{meetingId}                    v2 header: workspaceId, transcriptId, transcriptHash,
                                                    version, schemaVersion 2, status, summary, counts,
                                                    provider{model, promptVersion, inputHash}, costUnits
meeting_intelligence/{meetingId}/items/{itemHash}   validated items with evidence
meeting_followup_drafts/{draftId}                   draft, recipients, version, sourceItemHashes
meeting_agent_shadow_runs/{runId}                   shadow outputs + metrics (never shown to users)
```

- Header-last writes; legacy v1 documents are read by an adapter.
- The M1 retention cascade (R7 fix) deletes intelligence, items and drafts with the transcript.
- Rules: server-only for all of the above.

---

## 5. Tasks (TDD, small local commits; same conventions as M1)

### T0: Close M1 review findings (prerequisite) · Rules 9, 18, 23, 25, 57

| Step | Action |
| --- | --- |
| 0.1 | R1 retention 24 h minimum interval · R2a schedule-failure → restartable · R2b retention cursor + flag clearing · R3 don't trust declared duration · R4 consent keyed by workspace+meeting · R5 stale-processing reaper + quota reservation · R6 automated-surface flag defaults + legal-hold UI · R7 transcript delete cascades to intelligence (and v2 items/drafts once they exist) |
| 0.2 | Tests for each (named in the M1 review) |

### T1: Personas and matrices · Rules 16, 17, 59, 66

| Step | Action |
| --- | --- |
| 1.1 | Tests: persona count 16; `meeting_prep` can call `meeting.get/search/get_transcript`, can't write; `meeting_analyst` can't send, approve, decide inbox items or read restricted memory; sub-agent attenuation |
| 1.2 | `meeting_prep` scope fix; `meeting_analyst` definition; `src/platform/agents/meetings/personas/meeting-agent-matrix.ts` (permission, tool, failure, rollback matrices) |
| 1.3 | Guard test: every capability id in the matrices is registered (extends the M1 T1.5 guard) |

### T2: Grounded prep brief · Rules 28, 31, 47, 58

| Step | Action |
| --- | --- |
| 2.1 | Context7: Genkit structured output + Gemini Pro tier, token counting for budgets; record versions |
| 2.2 | Tests (fake model): every item cites existing sources; an uncited item is dropped; a cross-workspace source id is rejected; model down → `facts_only` with no invented text; no linked entity; budget counts "found N, used M" |
| 2.3 | `meeting.generate_prep_brief` + `src/lib/meetings/prep-brief-service.ts`; `generateMeetingPrepBriefAction` delegates (same signature) |

### T3: Extraction pipeline · Rules 23–27, 30, 31, 39, 43

| Step | Action |
| --- | --- |
| 3.1 | Pure modules + property tests: chunker (≤ 6k tokens, turn-aligned, overlap), evidence validator (quote ⊂ segments), date resolver (meeting date + time zone), currency detector, dedupe/itemHash |
| 3.2 | `meeting.extract_intelligence`, `meeting.summarize`, `meeting.get_intelligence` with prompt versions and the replay record (model, prompt version, input/output hashes) |
| 3.3 | `meeting_postprocess_v2` template; retire `meeting_followup_v1` (not instantiable; verify zero runs) |
| 3.4 | Tests (fake model, workflow fakes): happy path; fabricated quote dropped; segment id outside chunk dropped; injection transcript → `needsReview`; chunk failure → retry → DLQ; cancel between steps; newer transcript supersedes; duplicate trigger returns the running pipeline; quota/cost ceiling refusal; consent withdrawn mid-run stops before store |
| 3.5 | `generateMeetingIntelligenceAction` runs the pipeline (G13 removed); legacy v1 display adapter |

### T4: Actions from items · Rules 18–22, 27, 32, 33

| Step | Action |
| --- | --- |
| 4.1 | `meeting.create_followup_tasks` (idempotent by itemHash, undo); migrate "Convert to task" to it (same key) |
| 4.2 | `meeting.draft_followup` + recipient restriction + egress policy + restricted/consent stops; drafts store |
| 4.3 | *(after M0 T3/T4/T6)* `meeting.propose_crm_update` with binding; execute via the fixed bridge; postcondition verify; compensation |
| 4.4 | Tests: double-click → one task; undo; recipient outside the meeting refused; PII from another record never in a draft; stale target version → re-propose; self-approval denied; approval invalidated by a re-analysis |

### T5: Evaluation and shadow mode · Rules 42, 44, 59 (master §8.1)

| Step | Action |
| --- | --- |
| 5.1 | Dataset ≥ 20 transcripts with gold items and spans: sales, onboarding, support, EN/FR/Twi-mixed, no-decision, injection-laced, contradictory, relative dates, ambiguous currency |
| 5.2 | Deterministic scorer: per-type precision/recall/F1, span validity, fabricated-item count, uncited-claim count |
| 5.3 | CI: hermetic run with a scripted fake model (pipeline correctness, scorer correctness). Offline: `scripts/eval-meeting-agent.ts` runs the real model (D18) and writes a report. Gates: decision/commitment F1 ≥ 0.8, span validity 100%, zero fabricated items |
| 5.4 | Shadow mode: pipeline `dryRun` stores to `meeting_agent_shadow_runs`, never shown; compares with the heuristic baseline and any human-created tasks; blast-radius report |

### T6: Minimal UI (theme.md §8, mobile-first) · Rules 7, 41, 54

| Step | Action |
| --- | --- |
| 6.1 | Outcomes panel: items grouped by type, each with its quote and a tap-to-jump to the transcript line; `needsReview` badge; per-item actions (Create task · Propose CRM update · add to draft) |
| 6.2 | Prep brief card with numbered citations (tap → source); `facts_only` label |
| 6.3 | Draft sheet: editable text, recipients (restricted), "Open in composer"; no Send button |
| 6.4 | Pipeline progress chip with cancel; mobile checks 375/768/1280 |

### T7: Backoffice · Rules 60–65

Pipeline monitor (queue, DLQ reprocess, per-workspace usage vs quota, per-org cost vs ceiling); prompt version pinning and rollback; kill switches (persona, each capability, automatic trigger); shadow toggle and latest eval results.

### T8: Verification and report · Rules 45, 46, 66, 67

Emulator E2E for workflow A (transcript → items → task → proposal → approve → verified change → undo); red team (injected instructions, fabricated quotes, cross-workspace source ids in briefs, recipient injection, self-approval, approval replay after re-analysis); chaos (model 429/500/timeout, malformed JSON, Cloud Run restart mid-pipeline); load (20 concurrent pipelines, queue limits respected); Rule 67 gate + completion report.

---

## 6. Ordering, Flags, Rollout

```text
M2·T0 ─► M0·T2 ─► T1 ─► T2 ─┐
                       T3 ─┼─► T5 (shadow) ─► T6 ─► T7 ─► T8
          M0·T3/T4/T6 ─► T4┘
```

- **Flags:** `FF_MEETING_AGENT` (global/org/workspace) plus per-capability flags. Automated surfaces stay off until T8. The automatic trigger stays off by default (D15).
- **Rollout:** shadow on internal workspaces → internal beta → canary 5/20/50/100. Automatic rollback (flags off) if fabricated items > 0 in shadow, span validity < 100%, failure rate > 10% per hour, or cost > 120% of forecast.

---

## 7. Rules Conformance (summary; full matrix pattern as M1 §9)

| Rule(s) | M2 conformance |
| --- | --- |
| 1–3 | Skills: backend-patterns, next-best-practices, vercel-react-best-practices, frontend-design, emilkowal-animations, firebase-ai-logic, test-driven-development, verification-before-completion. Preservation §3, affected features §12, Backoffice T7 |
| 4 | Zod at every boundary (model output, Account360 items, workflow inputs, stored docs); no casts (removes the prep-brief casts) |
| 5 | Rules and indexes staged with approval; nothing auto-deployed |
| 6 | Context7 before Genkit/Gemini changes (T2.1); no new dependencies planned |
| 7 | Minimal mobile-first UI; plain copy; reuse panels from M1 |
| 8, 13, 30, 47, 48 | Transcripts and model output untrusted; evidence validation; injection → review; nothing executes from model text |
| 9, 23 | Budgets and quotas §4.3; bounded reads; chunk caps |
| 10 | `@fileOverview` + `// CAUTION:` at validators, binding, recipient rules |
| 12, 14 | Risk enforced server-side; fingerprints for each new tool |
| 16, 17 | Personas §4.1; send, approve and inbox decisions non-delegable |
| 18–22 | Idempotency keys §4.2; TOCTOU at execute; preview → approve → execute → verify with binding |
| 24–27 | Breaker per provider; retries → DLQ; cancel between steps; compensation for tasks and proposals |
| 28, 56 | Context budget with "found N, used M"; summaries keep source references |
| 29 | Memory writes are M3's (Knowledge Inbox); M2 only emits events |
| 31 | Schema → business → evidence → permission → policy before store or act |
| 32, 33 | Draft recipients restricted; egress policy; no sends |
| 39–41, 43 | OTel spans per step; append-only audit; "why" view = item → evidence → prompt version; replay record |
| 42, 44–46 | Shadow mode; fake model; chaos; red team |
| 49, 50, 52 | Nothing public; no caching of intelligence; server-only modules + boundary test |
| 53 | No new dependencies |
| 57, 58 | Data policy before every model call; Flash for chunks, Pro for summary and brief, within allowed providers |
| 59 | Tool-selection guard + eval items for brief vs extraction tools |
| 60–65 | Kill switches, Backoffice, runbook update, flags at three levels, canary thresholds |
| 66 | Phase 9–13 deliverables: shadow, eval, permission/tool/failure matrices, security tests, rollback plan |
| 67–69 | Gate §10; non-negotiables; everything through capabilities |
| 11, 15, 35–38, 55 | N/A in M2 with reason: no MCP surface changes (M4), no external servers, no graph UI |

---

## 8. Test Plan

| Layer | Suites |
| --- | --- |
| Unit / property | chunker, evidence validator, date resolver, currency, itemHash, citation filter |
| Contract | each new capability via `defineContractSuite`; fingerprint baseline |
| Workflow | `meeting_postprocess_v2` with fake model: retries, DLQ, cancel, supersede, resume |
| Integration (emulator) | storage, rules, approvals with binding, proposal execute + verify + undo |
| Evaluation | hermetic (CI) + offline real-model report |
| Security / chaos / load | T8 |

---

## 9. What Could Go Wrong

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | Hallucinated decisions or commitments | Evidence validation; drop unverifiable items; zero-fabrication gate; review for low confidence |
| R2 | Instructions in transcripts trigger actions | No actions inside the pipeline; actions only from items by a person or through approval; injection → review |
| R3 | Building on fake proposal execution | M0 T3/T4/T6 before T4.3 (D14) |
| R4 | Cost spikes (long transcripts, re-runs) | Chunk caps, quotas, cost ceiling, idempotent chunk keys (re-runs reuse results) |
| R5 | Relative dates and time zones wrong | Resolve against meeting date + workspace time zone; drop unresolved; tests across time zones |
| R6 | Multilingual and code-switched transcripts | Keep the original language; eval includes EN/FR/Twi-mixed |
| R7 | Stale approvals after re-analysis or record edits | Binding includes intelligence version and target version; 24 h expiry |
| R8 | Pipeline killed mid-run | Durable steps, leases, checkpoint resume |
| R9 | Retiring v1 template breaks something | Verify zero instances; mark non-instantiable first; remove later |

**Edge cases** (expected behaviour defined in tests):
- no transcript;
- transcript restricted or consent withdrawn mid-run;
- no decisions;
- single speaker;
- meeting linked to no entity;
- entity deleted mid-pipeline;
- deal closed between extraction and approval;
- two people approving at once;
- approver loses permission;
- flag turned off mid-run;
- spans outside the transcript;
- contradictory statements in one meeting (both kept, marked contradictory);
- currency ambiguity;
- duplicate trigger;
- newer transcript arrives.

---

## 10. Implementation Gate (Rule 67), summary

```text
ARCHITECTURE  §4.2 capabilities; reuse §2.1; SoT Firestore; events meeting.intelligence.completed/failed
AUTHORITY     personas §4.1; non-delegable: send, approve, inbox decide, consent, delete
DATA          in: transcript pages, Account360 items; out: model calls via gateway (policy-checked);
              untrusted: transcripts, model output; sensitive: transcripts (personal), drafts
EXECUTION     idempotent keys; retries; cancel between steps; supersede; lost response → key replay
MCP           unchanged in M2 (M4)
FAILURE       model 429/500/timeout/malformed → retry/DLQ/drop; partial chunks → merge what validated
SECURITY      injection, fabrication, cross-workspace sources, recipient injection, self-approval
OPERATIONS    Backoffice T7; flags; kill switches; prompt pinning; replay
TESTING       unit · contract · workflow · integration · eval · security · chaos · load
MIGRATION     legacy intelligence readable; v1 template retired after zero-run check; rollback = flags off
```

---

## 11. UX Notes (Rule 7)

Plain copy: "Analyse meeting", "Line 42" (evidence link), "Needs review", "Create task", "Propose update", "Draft follow-up", "Open in composer", "AI summary unavailable; showing facts only."

---

## 12. Affected Features

Meeting detail (intelligence tab, action items), tasks (origin field), CRM proposals and approvals (after M0), workflow templates registry, Backoffice meetings monitor, AI usage/cost reporting, retention cascade.

---

## 13. Backoffice (operable without code)

See T7. Also: per-org model cost ceiling, per-workspace pipeline quota, prompt version list with pin/rollback, shadow results.

---

## 14. Deployment (Rule 5)

Needs approval: rules for the new collections; indexes (items by type; drafts by meeting; shadow runs by time); Cloud Tasks queue `meeting-intelligence`; flags.

---

## 15. Decisions

| # | Decision | Recommended |
| --- | --- | --- |
| D14 | Prerequisites order | **M2·T0 + M0·T2 first; M0·T3/T4/T6 before CRM proposals** (tasks, briefs and extraction don't wait) |
| D15 | Run analysis automatically when a transcript completes? | **Off by default**; per-workspace switch after shadow results are good |
| D16 | Follow-up delivery | **Draft only** + "Open in composer"; people send |
| D17 | CRM fields the agent may propose | **Deal stage, next step, expected close date, entity note, tags**; never amounts or owners in M2 |
| D18 | Real-model evaluation spend | Offline run with a capped budget before canary; CI stays hermetic |
| D19 | Model tiers | Flash for chunk extraction, Pro for summary and brief, both within the tenant data policy |

---

## 16. Tracker

| ID | Task | Status | Evidence |
| --- | --- | --- | --- |
| P11-M2-T0 | M1 review fixes R1–R7 | ☐ | |
| (M0) | T2 gateway everywhere · T3 real proposal execute · T4 approvals · T6 binding | ☐ | M0 plan |
| P11-M2-T1 | Personas + matrices | ☐ | |
| P11-M2-T2 | Grounded prep brief | ☐ | |
| P11-M2-T3 | Extraction pipeline + v2 template | ☐ | |
| P11-M2-T4 | Tasks · CRM proposals · follow-up drafts | ☐ | |
| P11-M2-T5 | Evaluation + shadow | ☐ | |
| P11-M2-T6 | Minimal UI | ☐ | |
| P11-M2-T7 | Backoffice | ☐ | |
| P11-M2-T8 | Verification + report | ☐ | |

**Mapping to master §13:** P11-M2-T1 → T1 · T2 → T2 · T3 → T3 · T4 → T4 · T5 → T5. New: T0, T6–T8.

---

## 17. Next Step

1. Confirm D14–D19.
2. Approve deploying M1 T0 hotfixes (still live exposures).
3. Start **M2·T0** (M1 review fixes), then **M0·T2**.
