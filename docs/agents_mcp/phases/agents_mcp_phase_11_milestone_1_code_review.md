# Phase 11 · Milestone 1: Code Review

**Reviewer role:** Senior Principal Systems & AI Agent Architect
**Date:** 2026-10-05
**Scope:** `4acf167a` (M0 · T1) and `795a1c41..c53daf26` (M1 · T0–T10), against [plan v1.1](agents_mcp_phase_11_milestone_1_plan.md), the [completion report](agents_mcp_phase_11_milestone_1_completion_report.md) and `agents_mcp_rules.md`.

**Verdict: on track, not yet shippable as a whole.**
- **T0 (security hotfixes)** is correct and should be deployed **now**, independently.
- The feature work is structurally sound: shared read service, governed capabilities, header-last storage, shadow retention, bound previews, fake-provider tests.
- Review found **3 High** and **4 Medium** defects that tests did not catch, mostly operational (cadence, stuck states, cursors) and data-protection completeness. Fix R1–R3 before enabling retention enforcement or transcription for any customer, and R4–R7 within M1.

---

## 1. Evidence checked

| Check | Result |
| --- | --- |
| Typecheck / full Vitest | 0 errors / 1,039 files, 7,909 tests passed (from T10) |
| Heartbeat cadence | **Every minute** (`docs/automations_deploy_checklist.md`, `scripts/setup-automation-heartbeat-scheduler.sh`) |
| CSP for browser → Storage POST | No `connect-src` restriction (`src/proxy.ts`), so uploads aren't blocked |
| Agent approval for L1 | Not required (`requiresAgentApproval` = human flag or high risk); relevant to R6 |
| Code paths below | Read directly; each finding cites the line |

---

## 2. Plan conformance

| Task | Status | Notes |
| --- | --- | --- |
| T0 hotfixes | ✅ | Correct; sweep 477 → 475. Deploy independently |
| T1 capabilities | ✅ (deviation accepted) | Shared read service instead of delegating UI reads to the gateway (legacy roles lack a view scope). Sound |
| T2 storage + rules | ✅ | Rules test runs only in CI (local Java 11) |
| T3 ingestion | ✅ | DOCX guard is strong (real inflate against a budget) |
| T4 transcription | ◐ | R2, R3, R5 below; Files API > 14 MB deferred (documented) |
| T5 consent | ◐ | R4 (shared meetings); withdrawal doesn't purge derived intelligence (R7) |
| T6 retention | ◐ | **R1** (cadence), **R2b** (planner window), legal-hold UI missing (R6b) |
| T7 fail-closed | ✅ | |
| T8 UI | ◐ | Legal hold toggle (plan §8.3) not built; "Replace transcript" label misleading (L2) |
| T9 Backoffice | ✅ | Reaper for stuck jobs missing (R3) |
| T10 verification | ◐ | Emulator E2E + browser pending (documented) |

---

## 3. Findings

Severity: **High** = fix before enabling the feature for any customer · **Medium** = fix within M1 · **Low** = polish.

### R1 · High · Retention runs every minute per workspace (cost + unbounded growth)

- **Where:** `runRetentionSweep` (`retention-service.ts`) is called by the minute-by-minute heartbeat, picking the 5 least recently run opted-in workspaces with no minimum interval.
- **Effect:** with ≤ 5 opted-in workspaces, each is planned **every minute**. Each run does up to ~100 meeting reads plus 3 queries per candidate and **writes a `meeting_retention_runs` document**: about 1,440 docs per workspace per day, with no TTL. That violates Rule 9 and the M0 review's R4/T0.9 concern.
- **Fix:** add `.where('retentionLastRunAt', '<', now − 24 h)` to the sweep query (the same index works: equality + range on the orderBy field). Test: a second sweep within 24 h touches nothing.

### R2 · High · Two ways a request can silently never finish

**a) Transcription stuck in `pending` if scheduling fails.**
- **Where:** `requestRecordingTranscription` creates the header in a transaction, then calls `schedule(...)` outside it (`transcription-request.ts:151`).
- **Effect:** if Cloud Tasks is unavailable, the header stays `pending`. Every later request sees `pending`, returns `replayed: true` and **never schedules again**, so the job hangs forever.
- **Fix:** on schedule failure, mark the header `failed` (`schedule_failed`) so a retry restarts it. Also treat a `pending` header older than 10 minutes as restartable.

**b) Retention can stop reaching older data.**
- **Where:** `planWorkspaceRetention` reads the 100 newest meetings older than the cutoff (`limit(max * 2)`, no cursor), and purges don't clear `hasTranscript`/`hasRecording`.
- **Effect:** after the newest old meetings are purged, every run reads the same 100 now-empty meetings and **never reaches older meetings that still hold data**. The run reports nothing to delete while data remains.
- **Fix:** store a per-workspace cursor (`retentionCursorMeetingTime`, cleared when a pass finds nothing) and paginate with `startAfter`. Also clear `hasTranscript`/`hasRecording` when a meeting's last transcript or recording is removed.

### R3 · High · Declared recording duration is trusted for validation and billing

- **Where:** `validateProviderTranscript` rejects segments beyond `durationSeconds × 1.02 + 5 s` (`transcription-service.ts:124`). The recording upload UI fills `durationSeconds` from a free-text field that **defaults to 30 minutes** (`MeetingIntelligenceTab.tsx:105, 229`).
- **Effect:** a real 60-minute recording uploaded with the default is transcribed and then **rejected as `invalid_output`**, which looks like a model failure. A user who declares less can also bypass the quota estimate.
- **Fix:** for uploaded files, don't trust the declared duration. Validate against `MAX_AUDIO_SECONDS` (plus monotonic and non-overlapping sanity), bill from the transcript's actual end time, and drop the duration field for uploads (or read it from file metadata in the browser and treat it as display-only).

### R4 · Medium · Consent on shared meetings is blocked for the second workspace

- **Where:** `consentRef` keys consent by `meetingId` only (`consent-store.ts:83`). `recordConsent` refuses when the doc belongs to another workspace.
- **Effect:** for a meeting shared by workspaces A and B, once A records consent, B can **never** record its own. With enforcement on, B can't transcribe or ingest at all.
- **Fix:** key consent by `${workspaceId}__${meetingId}` (rules stay server-only) and read through one helper. No migration is needed: no production consent data exists yet.

### R5 · Medium · No reaper for jobs stuck in `processing`; quota check is not atomic

- **Jobs:** if the worker dies after claiming (`processing`) and Cloud Tasks gives up before our attempt limit, the job stays `processing`. Backoffice shows it, but nothing moves it to `dead_lettered`. **Fix:** a heartbeat step (bounded, using the existing `(workspaceId, status, updatedAt)` index): `processing` older than 30 minutes → `dead_lettered` + DLQ entry.
- **Quota:** usage is read at request time and written at completion, so concurrent requests can exceed the daily cap (Rule 23). **Fix:** reserve estimated minutes in the usage doc transactionally at request time; settle (or refund) on completion or failure.

### R6 · Medium · Automation and governance gaps

**a) MCP and agent access to transcription.**
- MCP "meeting" keys receive `rbac:operations.meetings.edit`.
- When an operator enables `meeting.transcribe_recording` for a workspace without restricting agent or MCP surfaces, automated callers can spend quota and send audio out (L1 needs no approval).
- **Fix:** set `agentEnabled: false` / `mcpEnabled: false` in the capability's default flag record (or the enablement checklist) until the agent milestones; add to the runbook checklist.

**b) Legal hold has no UI.**
- `setMeetingLegalHoldAction` exists but nothing calls it (plan §8.3).
- Once a workspace enforces retention, people cannot place holds.
- **Fix:** a toggle on the meeting page (permissioned) and a holds list in Backoffice, before any workspace switches to "Delete on schedule".

### R7 · Medium · Deleting a transcript leaves data derived from it

- **Where:** `deleteTranscriptCascade` deletes chunks, runs registered cascades and deletes the header. Nothing removes `meeting_intelligence` built from that transcript, and **no cascade is registered**. Only the retention path deletes intelligence. Consent withdrawal (`aiProcessing`) likewise leaves existing intelligence in place (the plan said "queue derived data for purge").
- **Effect:** the delete dialog says "removes the transcript and anything made from it", which isn't true. This is a data-protection completeness gap (Rule 57, PRD §76).
- **Fix:** register a built-in cascade that deletes `meeting_intelligence/{meetingId}` when its `transcriptId` matches. On `aiProcessing` withdrawal, delete or mark that intelligence restricted. Test both.

### Low

- **L1:** the paste limit is 1.5 M characters, but multi-byte text can exceed the 2 MB Server Action body. Cap by UTF-8 bytes (~1.8 MB) on the client.
- **L2:** the "Replace transcript" button adds another transcript; the latest is shown and older ones remain. Rename it "Add another transcript", or delete the previous one with a confirmation.
- **L3:** retention and Backoffice audit entries use `organizationId: ''`. Resolve from the workspace.
- **L4:** policies saved before M1 have no `updatedBy`, so the page sends no `expectedUpdatedAt` and the first save isn't stale-protected. Send `updatedAt` whenever the doc exists.
- **L5:** `meeting_retention_runs`, `meeting_transcription_usage`, `meeting_transcription_dlq` and `meeting_compliance_policies/*/history` add to the T0.9 TTL list (usage 90 d, runs 90 d, resolved DLQ 30 d; history kept).

---

## 4. What is good

- **Security first, shipped as one deployable commit**, with a ratcheting sweep baseline.
- **One implementation per concern:** ownership helper, read service, cue normalizer shared by files and model output, retention planner shared by preview, evaluation and runs.
- **Untrusted content handled correctly end to end:** stored as data, flagged, labelled for agents, rendered as text, never in events or audit.
- **Fail-closed everywhere it matters:** no fabricated intelligence; a malformed data policy is most restrictive; policy read errors retry; consent re-checked before storing.
- **Approval binding is real:** retention enforcement, Backoffice "Run now" and transcript deletion are bound to an exact preview or version.
- **Race found and fixed during the work** (concurrent identical uploads), with a regression test.
- **Honest reporting:** deviations, unverified items and fabricated UI were called out, not hidden.

---

## 5. Required actions

| # | Action | Blocks |
| --- | --- | --- |
| 1 | **Deploy T0 hotfixes** (`795a1c41`) after approval (G1/G2 are live) | Nothing; do now |
| 2 | Fix R1 (24 h minimum interval) + test | Enabling retention anywhere |
| 3 | Fix R2a (schedule failure) and R2b (cursor + flag clearing) + tests | Enabling transcription / enforced retention |
| 4 | Fix R3 (don't trust declared duration) + test | Enabling transcription |
| 5 | Fix R4, R5, R7 + tests | M1 sign-off |
| 6 | R6: agent/MCP flag defaults; legal-hold UI | Enabling for customers |
| 7 | Run the rules suite in CI and emulator E2E (or install JDK 21 locally once disk allows) | M1 sign-off |
| 8 | L1–L5 | Ride along |

---

## 6. Overall

M1 achieves the milestone goal in structure: meetings are a governed capability layer, transcripts can enter safely, consent and retention exist, and the fabricated paths are gone. The defects found are the kind that only show under real operation (minute-level cadence, scheduler outages, user-entered metadata, shared meetings). None weakens the security fixes. With items 2–5 done, M1 can be signed off and M2 (extraction on the AI gateway, replacing the direct Gemini REST call) can start on solid ground.
