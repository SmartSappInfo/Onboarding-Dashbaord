# Runbook: Meeting analysis (`meeting_postprocess_v2`)

Phase 11 M2 · T3. Turns a meeting transcript into evidence-checked outcomes (decisions, commitments, action items, risks, questions, buying signals, objections) and a short cited summary.

The Backoffice views and alerts arrive in M2 · T7. Until then, use the Firestore collections listed below.

## 1. What runs where

| Piece | Where | Notes |
| --- | --- | --- |
| Start / rejoin analysis | "Analyse meeting" → `meeting.extract_intelligence` → Cloud Tasks queue `meeting-intelligence-queue` → `/api/tasks/meeting-intelligence` | One run per (workspace, transcript, prompt version); asking again returns the same run |
| Steps | `load → extract → validate → summarize → store` (fixed order) | Each chunk's model result is checkpointed, so a retry never repeats a finished chunk |
| Read | Meeting page (Server Action) / `meeting.get_intelligence` (agents, MCP) | Agents also need AI use allowed and `ai_read` consent |
| Re-summarize | `meeting.summarize` | Uses checked outcomes only; version-checked |
| Stuck runs | Heartbeat cron (`/api/cron/automation-heartbeat`) | Runs with no progress for > 30 min: `running` → dead-lettered, `pending` → failed |
| Data | `meeting_intelligence_runs` (+ `chunks` checkpoints), `meeting_intelligence` (+ `items`), `meeting_intelligence_usage`, `meeting_intelligence_dlq`, `meeting_item_conversions` | All server-write-only (base deny-all rule) |

**Limits:**
- 50 analyses per workspace per day (UTC);
- ≤ 25 chunks of ≈ 6k tokens per transcript (longer transcripts are analysed in part and marked `truncated` with `coverage`);
- ≤ 4 model calls at a time per run;
- 90 s per chunk call, 60 s for the summary;
- 3 attempts, then dead-lettered.

**Flags:**
- People are on.
- Agents and MCP need an explicit flag per workspace or organization (`automatedRequiresExplicitFlag`), off until M2 · T8 verification.

## 2. Before enabling for a workspace

- [ ] Indexes deployed (staging first; production with written approval):
  - `meeting_intelligence_runs (status, updatedAt)`;
  - `meetings (workspaceIds CONTAINS, entityId, meetingTime DESC)`.
- [ ] Cloud Tasks queue `meeting-intelligence-queue`:
  - max concurrent dispatches 10;
  - max attempts 5 (the pipeline caps its own attempts at 3; a breaker-open retry doesn't use one);
  - min backoff 30 s.
- [ ] `/api/tasks/meeting-intelligence` reachable by the Cloud Tasks service account (HMAC + OIDC).
- [ ] Workspace AI data policy allows at least one provider for personal data.
- [ ] Consent setting reviewed with the customer (enforced → each meeting needs `aiProcessing` consent).
- [ ] **Time zone:** set `timezone` (IANA) on the workspace document. Otherwise deadlines resolve in UTC and items with dates are flagged for review (`default_time_zone`).

## 3. Incidents

### A. AI provider outage or overload

- **Symptoms:**
  - runs sit in `pending` / `running` with `attempts` rising;
  - `extract` traces show `CircuitBreakerOpenError` or a deadline error.
- **Behaviour:**
  - the worker answers 503 and Cloud Tasks backs off;
  - finished chunks are kept, and a breaker-open retry doesn't use an attempt.
- **Action:** usually none. If the outage lasts over an hour, pause the queue, resume afterwards, and re-trigger dead-lettered runs from the meeting page (it resumes from checkpoints).

### B. Dead-lettered runs (`meeting_intelligence_dlq`)

1. Read `code`:
   - `attempts_exhausted` / `provider_error` / `timeout`: provider trouble;
   - `stalled`: the worker died.
2. Fix the cause, then ask for analysis again from the meeting page. The run restarts and reuses its checkpoints.
3. Mark the DLQ record `resolved: true`.

### C. "Couldn't start the analysis" for everyone

- The queue is missing or paused, or the endpoint is unreachable.
- Such runs are failed with `schedule_failed`, so asking again restarts them once the queue works.

### D. Consent withdrawn / AI use restricted

- An in-flight run stops before storing (`cancelled`, `consent_withdrawn`).
- Withdrawal also deletes stored analysis, runs and checkpoints through the derived-data cascade.

### E. Wrong or invented outcomes reported

- Each item carries `evidence` (segment ids + quote). Quotes that aren't in the cited lines are dropped at validation; check `counts.dropped` on the header.
- If an item looks wrong despite valid evidence, record it for the evaluation set (M2 · T5). Do not hand-edit items.

## 4. Data and deletion

- **Checkpoints** (`chunks/{i}.rawOutput`) contain quotes from customer speech. They are deleted with the transcript, on consent withdrawal and by retention.
- **Conversions** (`meeting_item_conversions`) hold ids only.
- **Traces** are content-free JSON lines (`pipeline`, `runId`, `step`, `chunk`, `durationMs`, `outcome`). The project has no OpenTelemetry SDK yet; each line maps 1:1 to a span when it lands.
