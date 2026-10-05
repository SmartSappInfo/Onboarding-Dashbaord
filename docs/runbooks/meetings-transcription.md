# Runbook: Meeting Transcripts, Transcription & Retention

**Owner:** Platform on-call · **Introduced:** Phase 11 M1 (2026-10-05) · **Rules:** 25, 60–63

All controls below are in **Backoffice → Meetings monitor → Transcription & retention**. None of them needs a deploy.

## 1. What runs where

| Piece | Where | Notes |
| --- | --- | --- |
| Upload/paste transcript | Server Actions → `meeting.ingest_transcript` | Synchronous; idempotent by content |
| Transcribe recording | `meeting.transcribe_recording` → Cloud Tasks queue `meeting-transcription-queue` → `/api/tasks/meeting-transcription` | Off by default; enable per workspace/org via the capability flag |
| Retention | Heartbeat cron (`/api/cron/automation-heartbeat`) | ≤ 5 workspaces, ≤ 50 meetings per run; preview-only unless the workspace chose "Delete on schedule" |
| Data | `meeting_transcripts` (+ `segments`), `meeting_consents`, `meeting_transcription_usage`, `meeting_transcription_dlq`, `meeting_retention_runs` | Server-write-only |

## 2. Incidents

### A. AI provider outage or overload (transcriptions stuck or failing)

1. Look at **In progress** and **Failed jobs**. Retries are automatic (3 attempts, then a failed job).
2. If failures keep growing, switch on **Pause transcription**. Queued tasks answer 503 and Cloud Tasks retries them later; nothing is lost.
3. When the provider recovers, switch the pause off, then **Retry** failed jobs one by one, or **Discard** the ones people no longer need.

### B. Suspected data leaving SmartSapp that shouldn't

1. Switch on **Block audio leaving SmartSapp**. New requests are refused at once, and running jobs stop before the provider call.
2. Restrict the workspace's AI data policy (allowed providers, or providers blocked for personal data). The policy is checked at request time and again in the worker.
3. Review the audit chain for `meeting.transcribe_recording`; it records ids and hashes only.

### C. Retention removed too much, or not what was expected

1. Retention only deletes in workspaces set to **Delete on schedule**, and every change that deletes more had to be confirmed against an exact preview.
2. Check **Retention** runs: `planned` vs `deleted` and `verified`. A `verified: false` run means items remained, usually a resumable tombstone; the next run finishes it.
3. To stop deletion for one workspace, set it back to preview-only on its Compliance page, or put specific meetings on **legal hold**.
4. Restore: Firestore point-in-time recovery or export (platform backup procedure). Storage objects follow the bucket's versioning/retention settings.

### D. A transcript contains instructions ("ignore previous instructions…")

These transcripts are stored and shown with **Needs review**. They are data, never instructions: agents receive them labelled `untrusted_customer_content`, and actions based on them need human review (M2/M3).

### E. A workspace hits its daily limit

People see "Daily transcription limit reached." Raise the workspace's **Daily limit** if justified. Usage resets per UTC day.

## 3. Common messages people see

| Message | Meaning / fix |
| --- | --- |
| "This recording is an external link and can't be transcribed." | Upload the file instead of a link |
| "This recording is larger than 14 MB." | Upload a smaller audio export (MP3); large-file support is a planned follow-up |
| "Record … consent for this meeting first." | The workspace requires consent; record it on the meeting page |
| "Your workspace doesn't allow any AI service that can transcribe audio." | The AI data policy blocks every audio-capable provider |
| "The data this change would remove has changed." | Re-open the retention preview and confirm again |

## 4. Before enabling transcription for a workspace

- [ ] Rules and indexes deployed (staging first; production with written approval).
- [ ] Cloud Tasks queue `meeting-transcription-queue` exists (concurrency 20, max attempts 3).
- [ ] Bucket CORS allows browser POST uploads (`cors.json`).
- [ ] Workspace consent setting reviewed with the customer.
- [ ] Canary: internal workspace → 5% → 20% → 50% → 100%. Roll back (flag off) if failures exceed 10% over 1 h, p95 ingest exceeds 8 s, or cost exceeds 120% of forecast.
