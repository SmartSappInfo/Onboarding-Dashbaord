# Runbook: Meeting analysis (`meeting_postprocess_v2`)

Phase 11 M2 · T3. Turns a meeting transcript into evidence-checked outcomes (decisions, commitments, action items, risks, questions, buying signals, objections) and a short cited summary.

The Backoffice views and emergency controls are available at `/backoffice/meetings-monitor` (`MeetingAgentOpsPanel`).

## 1. What runs where

| Piece | Where | Notes |
| --- | --- | --- |
| Start / rejoin analysis | "Analyse meeting" → `meeting.extract_intelligence` → Cloud Tasks queue `meeting-intelligence-queue` → `/api/tasks/meeting-intelligence` | One run per (workspace, transcript, prompt version); asking again returns the same run |
| Steps | `load → extract → validate → summarize → store` (fixed order) | Each chunk's model result is checkpointed, so a retry never repeats a finished chunk |
| Read | Meeting page (Server Action) / `meeting.get_intelligence` (agents, MCP) | Agents also need AI use allowed and `ai_read` consent |
| Re-summarize | `meeting.summarize` | Uses checked outcomes only; version-checked |
| Stuck runs | Heartbeat cron (`/api/cron/automation-heartbeat`) | Runs with no progress for > 30 min: `running` → dead-lettered, `pending` → failed |
| Backoffice Panel | `/backoffice/meetings-monitor` (`MeetingAgentOpsPanel`) | Code-free operator control plane (Rules 60–63) |
| Data | `meeting_intelligence_runs` (+ `chunks` checkpoints), `meeting_intelligence` (+ `items`), `meeting_intelligence_usage`, `meeting_intelligence_dlq`, `meeting_item_conversions`, `meeting_agent_security_feed` | All server-write-only (base deny-all rule) |

**Limits:**
- 50 analyses per workspace per day (UTC);
- ≤ 25 chunks of ≈ 6k tokens per transcript (longer transcripts are analysed in part and marked `truncated` with `coverage`);
- ≤ 4 model calls at a time per run;
- 90 s per chunk call, 60 s for the summary;
- 3 attempts, then dead-lettered.

**Flags & Controls (Rule 60):**
- People are on.
- Agents and MCP need an explicit flag per workspace or organization (`automatedRequiresExplicitFlag`), off until M2 · T8 verification.
- Emergency Kill Switches (instant in Backoffice, no deployment needed):
  - `meetingAnalystPaused`: immediately stops autonomous meeting analyst persona executions.
  - `pipelineQueuePaused`: halts Cloud Tasks pipeline worker processing.
  - `autoTriggerDisabled`: disables automatic analysis kick-off on completed transcripts.
  - `proposalsPaused`: blocks generation of new CRM update proposals from meetings.
  - `transcriptionPaused` & `blockAudioEgress`: stops audio transcription and external audio transfer.

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

## 3. Incidents & Operations Playbook

### A. AI provider outage or overload
- **Symptoms:**
  - runs sit in `pending` / `running` with `attempts` rising;
  - `extract` traces show `CircuitBreakerOpenError` or a deadline error.
- **Behaviour:**
  - the worker answers 503 and Cloud Tasks backs off;
  - finished chunks are kept, and a breaker-open retry doesn't use an attempt.
- **Action:**
  - Flip `pipelineQueuePaused` to `true` in `/backoffice/meetings-monitor`.
  - Once provider recovers, unpause the queue.
  - Retry dead-lettered runs from the Backoffice DLQ panel using "Retry" (`reprocessPipelineDeadLetterAction`).

### B. Dead-lettered runs (`meeting_intelligence_dlq`)
1. In `/backoffice/meetings-monitor`, review the Failed Runs / DLQ list.
2. Read `code`:
   - `attempts_exhausted` / `provider_error` / `timeout`: provider trouble;
   - `stalled`: worker died mid-run.
3. Click "Retry" to reset attempt count to 0, increment version, and reschedule Cloud Task.
4. If an invalid or unresolvable transcript caused the failure, click "Discard" to clear the DLQ record.

### C. Prompt Canary Rollback & Pinning (Rules 58, 65)
- If a new prompt version (e.g. canary) exhibits degraded extraction quality or hallucinations:
  - In `/backoffice/meetings-monitor`, under "Prompt Pinning & Overrides", enter the workspace ID, select the stable fallback prompt version (e.g. `mi_extract_v1`), and click "Pin".
  - This overrides the workspace prompt without requiring code deployment or restarting server containers.
  - To return to canonical defaults after resolution, click "Reset" (`unpinMeetingPromptVersionAction`).

### D. Unauthorized or Mistaken CRM Proposal Execution (Rule 27)
- If an approved proposal modified a deal stage mistakenly:
  - The bridge maintains compensating capability `deal.advance_stage` with the previous stage.
  - In Backoffice or Governance desk, trigger reverse-LIFO saga rollback (`rollbackAction`), which verifies the entity hasn't changed since execution and restores the previous stage.

### E. Security Alerts & Adversarial Injections (Rules 30, 46, 62)
- Inspect the Security & Poisoning Feed in `/backoffice/meetings-monitor`.
- `injection_flagged`: Transcript contains adversarial directive tokens (`IGNORE PREVIOUS INSTRUCTIONS`). The pipeline automatically tags all extracted items as `needsReview: true`, preventing one-click task creation or proposals.
- `fabrication_detected`: Model hallucinated quotes or line numbers not found in chunk. Automatically dropped at validation.
- `egress_blocked`: Outbound follow-up draft attempted to include credit card numbers, passwords, or PII. Egress policy engine blocked draft generation.
- `self_approval_blocked`: A proposing user attempted to approve their own CRM update. Bridge returned HTTP 403.

### F. "Couldn't start the analysis" for everyone
- The queue is missing or paused, or the endpoint is unreachable.
- Such runs are failed with `schedule_failed`, so asking again restarts them once the queue works.

### G. Consent withdrawn / AI use restricted
- An in-flight run stops before storing (`cancelled`, `consent_withdrawn`).
- Withdrawal also deletes stored analysis, runs and checkpoints through the derived-data cascade.

### H. Wrong or invented outcomes reported
- Each item carries `evidence` (segment ids + quote). Quotes that aren't in the cited lines are dropped at validation; check `counts.dropped` on the header.
- If an item looks wrong despite valid evidence, record it for the evaluation set (M2 · T5). Do not hand-edit items.

## 4. Data and deletion

- **Checkpoints** (`chunks/{i}.rawOutput`) contain quotes from customer speech. They are deleted with the transcript, on consent withdrawal and by retention.
- **Conversions** (`meeting_item_conversions`) hold ids only.
- **Traces** are content-free JSON lines (`pipeline`, `runId`, `step`, `chunk`, `durationMs`, `outcome`). The project has no OpenTelemetry SDK yet; each line maps 1:1 to a span when it lands.
