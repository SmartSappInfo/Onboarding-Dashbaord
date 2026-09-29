# Specialized Agent Models & Runtime State Machine (Phase 0)
**Document 07 in the Agentic Architecture Suite**

---

## 1. Multi-Agent Specialization over Monolithic Agents

SmartSapp deploys a coordinated family of specialized agents rather than a single ungoverned monolithic assistant:

```
                                  SUPERVISOR AGENT
                                         │
       ┌─────────────────┬───────────────┼───────────────┬─────────────────┐
       ▼                 ▼               ▼               ▼                 ▼
  CRM Researcher    Lead SDR Agent   Deal Coach   Portal Guide Agent  Meeting Prep
  (Account History) (Enrich & Score) (Risk/Next)  (Courses/Community) (Dossier/Agenda)
```

---

## 2. Specialized Agent Profiles

### 2.1 CRM Researcher Agent
* **Purpose**: Reconstruct comprehensive 360-degree account histories across entities, notes, meetings, and communications.
* **Allowed Domains**: `crm_contacts`, `knowledge_memory`, `meetings_conversations`.
* **Execution Boundary**: Autonomous `L0_READ` queries; drafts internal summaries (`L1_INTERNAL_DRAFT`). Zero mutating authority.

### 2.2 Autonomous Lead SDR Agent
* **Purpose**: Discover, enrich, technographically profile, score, and draft tailored outreach.
* **Allowed Domains**: `lead_intelligence`, `crm_contacts`, `communication_messaging`.
* **Execution Boundary**: Autonomous `L0_READ` and `L2_STATE_MUTATION` (enrichment writes); `L3` outbound message dispatch requires human approval (Rule 21).

### 2.3 Deal Strategy & Coach Agent
* **Purpose**: Monitor pipeline velocity, identify stalled opportunities, detect competitor objections, and propose win strategies.
* **Allowed Domains**: `deals_revenue`, `crm_contacts`, `knowledge_memory`, `tasks_productivity`.
* **Execution Boundary**: Autonomous `L0_READ`; creates proposed follow-up tasks (`L1/L2`).

### 2.4 Portal Experience Guide Agent
* **Purpose**: Assist members and students inside Experience Portals, answer lesson questions (AI Tutor), track course progress, and guide onboarding.
* **Allowed Domains**: `experience_portal`, `knowledge_memory`.
* **Execution Boundary**: Autonomous read on published portal content and student progress; generates contextual learning assistance.

---

## 3. Agent Runtime State Machine

Every agent run transitions through an explicit, auditable state machine:

```
  CREATED ──► QUEUED ──► PLANNING ──► EXECUTING ──► VERIFYING ──► COMPLETED
                             │             │              ▲
                             ▼             ▼              │
                    WAITING_FOR_APPROVAL   RETRY_RECOVERY ┘
                             │
                             ▼
                    CANCELLED / FAILED
```

---

## 4. Resource Budgets & Guardrails (Rule 23)

Every agent run is bound by strict resource limits:
* `maxDurationMs`: 120,000 ms (2 minutes for synchronous steps; Cloud Tasks for long runs).
* `maxTokens`: 50,000 total tokens per run.
* `maxToolCalls`: 15 tool calls per single goal execution.
* `maxRecordsMutated`: 25 records per run (bulk mutations require explicit operator override).
* `maxOutboundMessages`: 0 autonomous (all outbound dispatches require approval unless bounded delegation policy is active).
