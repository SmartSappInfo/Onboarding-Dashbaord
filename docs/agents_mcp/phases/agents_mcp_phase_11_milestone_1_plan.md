# Phase 11 · Milestone 1 Implementation Plan
## Meetings Capability Layer, Transcript Ingestion, Consent & Retention

**Version:** 1.1.0 (full `agents_mcp_rules.md` conformance; no functionality removed)
**Status:** PLANNING. Uses master default D1 (upload/paste + transcription of the workspace's own recordings; Meet/Zoom deferred). Decisions D10–D13 in §15.
**Date:** 2026-10-05
**Parent:** [`agents_mcp_phase_11_master_plan.md`](agents_mcp_phase_11_master_plan.md) §2.2 (B1–B4, B12), §5.7, §13 (P11-M1-T1…T5).
**Depends on:**
- M0 **T0** (persistent stores) and **T1** (governed gateway, after review fixes R1/R2).
- The **residency gate from M0 T6.0**, which M1 T4 needs before any audio leaves SmartSapp. If M0 T6 hasn't started, M1 T4.0 builds the gate and M0 T6 reuses it (one implementation, Rule 7).

M1 does **not** need M0 T2–T5/T7: it creates no L2+ agent mutations.

**Rules:** [`agents_mcp_rules.md`](../agents_mcp_rules.md): Important 1–10 (Rules 4 and 5 as amended) and Rules 11–69, applied in full; see §9 for the conformance matrix. Also [`.agents/AGENTS.md`](../../../.agents/AGENTS.md) and `theme.md` §8.

### Change log v1.0 → v1.1

| # | Change | Rule |
| --- | --- | --- |
| C1 | **Corrected facts:** `legalHold` does **not** exist (now added, T6). Tenant residency metadata (`allowedModels`/`allowedExternalProviders`/`region`) does **not** exist yet (T4.0). `getModel` has no audio tier (T4.0 adds modality-aware routing). Recording `shareToken` has **no public consumer** (safe to retire). | 2, 57, 58 |
| C2 | Compliance edits require the existing `meetings_manage` permission in that workspace, instead of a new permission, so no role migration and nobody who manages meetings loses access (D10 revised) | 1, 3 |
| C3 | Trust-boundary matrix (§4.9), `unknown` boundary table (§4.10), MCP annotation table (§4.2) | 4, 12, 13 |
| C4 | Per-mutation idempotency/retry/duplicate/lost-response table; TOCTOU tokens; non-delegable list | 17–20 |
| C5 | Two-phase **preview → approve → execute → verify** with approval binding for retention purges, transcript deletion and retention-shortening policy changes | 21, 22 |
| C6 | Terminal states (`cancelled`, `dead_lettered`), a manual recovery queue, a cancellation table and a saga/compensation table | 25–27 |
| C7 | DOCX decompression-bomb and DoS defence (mammoth performs no sanitization; Context7, 2026-10-05); `https:`-only external links (no `javascript:` XSS); transcript text always rendered as text | 8, 34 |
| C8 | Egress: signed media URLs only to human browser sessions, never to agents or MCP clients; transcript content to MCP clients is size-capped, consent-checked and classified `personal` | 32, 33 |
| C9 | **Retention shadow mode**: report-only before deletes are enabled per workspace; audit never stores transcript text, so audit survives a purge | 40, 42 |
| C10 | Replay record, tool-selection eval cases, dead-man controls, security events, incident runbook, capability-level flags, canary thresholds | 43, 59–65 |
| C11 | Full Rule 67 gate with every question answered (§10) | 67 |

**Documents reviewed:**

| Document | Used for |
| --- | --- |
| `agents_mcp_rules.md` (full, 1–69) | This revision |
| Phase 11 master plan §2.2, §5.2, §5.3, §5.6, §5.7, §9 | Scope, trust matrix, contracts, budgets, ingestion design, risks |
| M0 plan v1.1 + [M0 interim code review](agents_mcp_phase_11_milestone_0_code_review.md) | Dependencies; R1 (namespaced idempotency), R2 (default deps), T6.0 residency gate |
| `docs/meetings/meetings_prd.md` §25–27, §39–41, §58, §61, §96–98 | Models; **PRD event names**; large transcripts outside one doc; recording security (private storage, signed URLs, short expiry, access audit, retention); AI governance; **four independent consents** |
| `docs/meetings/meetings_ui.md` §30–33, Journey E | Intelligence/recording UX; transcript search; immutable activity timeline |
| `docs/feature_meetings.md` | Recording management today (external/YouTube URLs); meetings shared across workspaces (`workspaceIds`) |
| `agents_mcp_tools.md` Domain 6 · `agents_mcp_prd.md` §27–28, §66–76 | `meeting.*` tools; consent rule; permissions, sensitivity, injection defence, audit, retention, deletion |
| `docs/agentic/02, 04, 05, 08, 11` | Catalog, boundary validation, risk levels, untrusted isolation, trust classes |
| Context7 (2026-10-05) | **Genkit** `/websites/genkit_dev_js`: audio via `ai.generate` `media` part + `output.schema`. **mammoth** `/mwilliamson/mammoth.js`: `extractRawText({ buffer })`; *no sanitization; crafted documents can cause DoS; external file access off by default*. **@google-cloud/storage** `/googleapis/nodejs-storage`: v4 signed URLs, max 7 days; query params added after signing are unsigned |

---

## 1. Goal

At the end of M1:
- Every meeting read used by agents and UI goes through governed `meeting.*` capabilities that prove the meeting belongs to the caller's workspace.
- Transcripts can enter SmartSapp safely: upload or paste, or transcription of the workspace's own recording.
  - Stored server-side only, in a model that scales past 1 MiB.
  - Gated by per-meeting consent.
  - Scanned for injection.
  - Classified as personal data.
  - Removed on schedule by a retention policy that is previewed before it deletes anything.
- The fabricated-transcript path and the recording/compliance security holes are gone.
- **Nothing that works today stops working** (§3).

**Non-goals:**
- Extraction, summaries, tasks, CRM proposals (M2).
- The Knowledge Inbox (M3).
- Large UI work (M5).
- Google Meet/Zoom provider transcripts (deferred, D1).

---

## 2. Verified Findings (code as of `e642c858`)

| # | Finding | Evidence | Severity |
| --- | --- | --- | --- |
| G1 | **`getMeetingRecordingsAction` and `attachMeetingRecordingAction` have no authentication.** Server Actions are public endpoints: anyone with a meeting id + workspace id can list recordings (media URLs, share tokens) or attach a recording (any URL, including `javascript:`) to any meeting. | `src/app/actions/meeting-recording-actions.ts:27, 96` | **Critical** |
| G2 | **`saveWorkspaceCompliancePolicyAction` checks only `requireAuth()`.** Any signed-in user of any organization can overwrite any workspace's compliance policy. | `meeting-compliance-actions.ts:62-69` | **Critical** |
| G3 | `convertActionItemToCrmTaskAction` doesn't verify the intelligence record's workspace (IDOR) and writes `tasks` directly via `adminDb` (Rule 69). It also uses `as MeetingIntelligence` (Rule 4). | `meeting-intelligence-actions.ts:195-260` | High |
| G4 | `generateMeetingIntelligenceAction` **fabricates a transcript** when none exists (B1) and never checks the meeting's workspace (B2). `generateMeetingPrepBriefAction` has the same ownership gap. | `meeting-intelligence-actions.ts:39-150, 267-317` | High |
| G5 | `meeting_transcripts`, `meeting_intelligence`, `meeting_recordings` are client-writable by workspace members (B3). No client code writes them (verified). | `firestore.rules:755-768` | High |
| G6 | No production transcript source; only `seed-meetings-v2.ts` writes transcripts (B4). | grep | High |
| G7 | Segments stored inline; long meetings exceed 1 MiB (B12). PRD §26 prescribes storage outside one document. | `types/intelligence.ts:50-64` | Medium |
| G8 | Recording "signed URL" = `mediaUrl + ?token=…&expires=…`. This is not a real signature, and any `mediaUrl` is accepted. `shareToken` has **no consumer** outside the action (verified). | `meeting-recording-actions.ts:151-175` | High |
| G9 | No per-meeting consent. The policy has only `enforceHostConsentForAI` (default off). PRD §98 requires four independent consents. | `types/compliance.ts:13-18` | High |
| G10 | Retention is **evaluated, never enforced**. **No `legalHold` field exists** for meetings. | `meeting-compliance-actions.ts:121-150`; grep | High |
| G11 | No `meeting.*` capability; the `meetings_conversations` domain folder doesn't exist (domains: crm_contacts, deals_revenue, experience_portal, identity_access, tasks_productivity). | `src/platform/domains/` | High |
| G12 | Meetings use both `workspaceIds[]` and a scalar `workspaceId`; there's no shared ownership helper. | `src/lib/types.ts:3641` | Medium |
| G13 | Meeting intelligence calls the Gemini REST API directly (`?key=` in the URL), bypassing the AI gateway. **M2** replaces it; M1 only removes the fabricated fallback. | `meeting-intelligence-actions.ts:92-105` | Medium (M2) |
| G14 | **No tenant residency metadata** (`allowedModels`, `allowedExternalProviders`, `region`) exists anywhere; M0 T6.0 plans it. **`getModel` routes by tier only** (`reasoning`/`fast`/`default`), with no modality, so nothing guarantees an audio-capable model. | grep; `src/ai/genkit.ts:144-206` | High (for T4) |

**Reuse inventory (Rule 7, no duplication):**

| Need | Reuse |
| --- | --- |
| Transcript formatting/search/stats | `src/lib/meetings/transcript-service.ts` |
| Retention candidate selection | `evaluateGDPRRetentionPurge` (`compliance-service.ts:64`) |
| Media formats | `isValidMediaFormat` (`recording-service.ts:50`) |
| Activity timeline | `logMeetingActivity` (`activity-logger.ts`) |
| Injection detection | `evaluateMemoryContentRisk` (`platform/memory/governance/anti-poisoning.ts:62`) |
| SSRF guard (future URL import only) | `validateSafeEgressUrl` (`lib/security/ssrf-guard.ts:285`) |
| Sensitivity levels and egress policy | `platform/mcp/security/egress-data-policy*.ts` (`personal`, `confidential`, …) |
| Tool fingerprints | `platform/mcp/security/tool-fingerprint-service.ts` |
| Signed Storage URLs | The pattern in `src/lib/pdf-actions.ts:901` (already working in production) |
| Permissions | `meetings_view` / `meetings_manage` (`lib/permissions-engine.ts:424-425`) |
| Backoffice | `meetings-monitor` page + `backoffice-meetings-actions.ts` (idToken pattern) |
| Workers | Cloud Tasks HMAC + OIDC pattern (`api/tasks/workflow-step`) |
| Cron | `api/cron/automation-heartbeat` |

---

## 3. Functionality Preservation (nothing lost)

| Area | Today | After M1 | Guarantee & proof |
| --- | --- | --- | --- |
| Recording list/attach in the meeting UI | Works (unauthenticated) | Same UI, authenticated + ownership-checked | UI already passes workspace ids; tests for member OK / other workspace refused / anonymous refused |
| External recordings (YouTube etc.) | Played via `mediaUrl` | Still play, labelled "External link". Existing `https:` links unchanged; only *new* non-`https:` links are refused | Classification test over the existing shapes; no migration |
| Uploaded recordings | Fake-token URL | Real 15-minute v4 signed URL | Playback test; access audit |
| Recording share token | Generated, never consumed | Field kept on old docs; no longer generated | Verified no consumer (grep); type keeps it optional |
| Compliance page | Saves for anyone signed in | Saves for users with `meetings_manage` in that workspace (an existing permission; no new role setup) | Parity test over role templates; same page, same fields |
| Compliance auto-purge toggle | Saved, never enforced | Enforced **after** a shadow (report-only) period; the page shows "Next purge would remove N items" | No surprise deletes (§4.7) |
| Meeting intelligence tab | Shows fabricated output with no transcript | Shows "Add a transcript to analyse this meeting" | Snapshot test; existing `meeting_intelligence` docs still display |
| Convert action item to task | Writes `tasks` directly | `task.create` through the gateway, same task fields + `origin` | Contract test on the resulting task shape; repeat click → same task |
| Prep brief | Works | Same output, ownership-checked | Existing tests + IDOR test |
| Existing transcripts (seed/legacy inline) | Read inline | v2 reader reads inline legacy or the segments subcollection | Legacy-reader test; no migration |
| Meetings shared across workspaces | Ad hoc checks | One helper honours both shapes | Both shapes tested |
| Compliance export / purge evaluation actions | Work | Unchanged signatures; evaluation now calls the shared planner | Existing tests |

**Deliberate behaviour changes (each is a security or integrity fix):**
- No transcript → no intelligence (B1).
- Compliance edits need `meetings_manage`.
- External links can't be transcribed.
- New external links must be `https:`.

---

## 4. Design

### 4.1 Meeting ownership (G12)

`assertMeetingInWorkspace(meetingId, workspaceId)`, `import 'server-only'`:
- Loads a minimal projection.
- Passes when `workspaceIds` includes the workspace **or** the scalar `workspaceId` equals it.
- Otherwise throws `NOT_FOUND` (never reveals existence; Rule 8).

It's used by every capability's `resolveResourceScope` (gateway step 07) and returns `{ resourceId, workspaceId, organizationId, resourceVersion: updatedAt }`, which also feeds TOCTOU checks (§4.11).

### 4.2 Capabilities (domain `meetings_conversations`; all via `executeCapability`)

| Capability | Risk | Delegable to agents? | MCP annotations (hints only, Rule 12) | Server-side enforcement |
| --- | --- | --- | --- | --- |
| `meeting.search` | L0 | Yes | `readOnlyHint: true` | Permission `meetings_view`; workspace scope; ≤ 50 results |
| `meeting.get` | L0 | Yes | `readOnlyHint: true` | Same + ownership |
| `meeting.list_recordings` | L0 | Yes (**metadata only**) | `readOnlyHint: true` | Signed URLs only for `surface: 'ui'` human principals (Rule 32) |
| `meeting.get_transcript` | L0 | Yes | `readOnlyHint: true`, `openWorldHint: false` | Ownership; **`aiProcessing` consent for agent/MCP principals**; ≤ 500 segments per page; ≤ 20 pages per run (Rule 23) |
| `meeting.ingest_transcript` | L1 | Yes | `idempotentHint: true` | `meetings_manage`; `transcription` consent; limits; injection scan |
| `meeting.transcribe_recording` | L1 | Yes | `idempotentHint: true`, `openWorldHint: true` | `meetings_manage`; consents; residency gate; quota |
| `meeting.record_consent` | L2 | **No (non-delegable)** | — | Human `ui` principal only |
| `meeting.delete_transcript` | L2 | **No** | `destructiveHint: true` | Human; preview → confirm (§4.12) |
| `meeting.update_compliance_policy` | L2 | **No** | `destructiveHint: true` | Human with `meetings_manage`; retention-shortening needs an impact preview + confirm |
| `meeting.set_legal_hold` | L2 | **No** | — | Human with `meetings_manage`; audited |
| `meeting.run_retention` | L2 | **No** | `destructiveHint: true` | System cron (shadow → enforced) or a human Backoffice "Run now" bound to a previewed candidate set |

- Annotations are advisory. Every row's risk is enforced by the gateway policy, permission and principal checks regardless of hints (Rule 12). A test asserts that a capability with a lying hint is still refused.
- Each new tool gets a fingerprint baseline. A change to name, description, schema, risk or permissions fails the fingerprint test until it's reviewed (Rule 14).
- Legacy server actions delegate to these capabilities with the same signatures (Strangler Fig, Rule 69).

### 4.3 Transcript storage v2 (G7, B12)

```text
meeting_transcripts/{transcriptId}
  workspaceId, organizationId, meetingId, recordingId?, source: 'upload'|'paste'|'recording',
  status: 'pending'|'processing'|'completed'|'failed'|'cancelled'|'dead_lettered',
  version (int, incremented per status change), language, speakers[], wordCount, segmentCount,
  durationMs, contentHash (sha256 of normalized text), schemaVersion: 2,
  dataClass: 'personal', region?, retentionPolicy: { source: 'workspace', days? },
  aiUse: 'allowed'|'restricted' (restricted when consent is withdrawn),
  injection: { flagged, patterns[] }, provenance: { createdBy, principalKind, agentId?, runId? },
  provider?: { modelId, modelVersion, promptVersion, inputHash }, costUnits?, error?: { code, message },
  createdAt, completedAt?, updatedAt
meeting_transcripts/{transcriptId}/segments/{chunkIndex}   // ≤ 500 segments per doc
  index, segments: TranscriptSegment[]
```

- **Reader** `readTranscript(transcriptId, page)`: schema v2 → subcollection; legacy (no `schemaVersion`) → inline `segments`. Every read is Zod-validated (Rule 4).
- **Writes:** chunk batches ≤ 250 docs; **header last** (`completed`), so readers never see partial content.
- **Events** (PRD §39): `transcript.processing_started`, `transcript.completed`, `transcript.failed`, `transcript.cancelled`, `transcript.deleted`, `recording.processing_started`, `recording.processing_completed`, `recording.accessed`, `meeting.consent.recorded`, `meeting.consent.refused`, `meeting.retention.previewed`, `meeting.retention.purged`. Events carry ids, counts and hashes, **never transcript text** (Rules 32, 40).

### 4.4 Ingestion (G6)

- **Parsers** (pure, `src/lib/meetings/transcript-parsers.ts`, `server-only`, no new dependency):
  - VTT/SRT: timestamps, `<v Speaker>`, `Speaker:` prefixes, multi-line cues, BOM/CRLF. HTML tags in cue text are stripped to plain text.
  - TXT: `Speaker:` lines or untimed paragraphs.
  - Paste: TXT parser.
- **DOCX** (mammoth, existing `^1.12.3`). mammoth does no sanitization (Context7), so (Rule 8):
  - ZIP signature check (`PK`).
  - Compressed ≤ 5 MB; declared **uncompressed total ≤ 25 MB, checked from the ZIP central directory before extraction** (decompression-bomb guard).
  - `extractRawText({ buffer })` only (no HTML conversion); external file access left off.
  - 10 s timeout; output ≤ 60k words.
- **Limits:** ≤ 5 MB text, ≤ 60k words, ≤ 4 h span, UTF-8 only. Errors are plain: "This file is larger than 5 MB. Split it and try again."
- **Upload path:**
  1. The client uploads to `workspaces/{ws}/meetings/{meetingId}/transcripts/{uuid}.{ext}`. Storage rules: workspace member, ≤ 5 MB, allowed content types, create-only.
  2. The server action re-validates the path (exact prefix, no `..`, our bucket only, Rule 34), the object size and the content type, then reads, parses and ingests.
  3. The upload object is deleted after success (and by a 24 h janitor if abandoned).
- **Speaker mapping:** match names/emails to meeting participants (case-insensitive); unmatched speakers kept as labels.
- **Injection & poisoning** (Rule 30): `evaluateMemoryContentRisk` runs per segment. `injection.flagged` + patterns are stored. Content is never interpreted. `flagged` forces human review in M2/M3 (human review threshold). Source trust is `CUSTOMER DATA` (upload/paste) or `MODEL-GENERATED DATA` (transcription).
- **Rendering:** transcript text is always rendered as React text nodes, never `dangerouslySetInnerHTML` (XSS, Rule 8).
- **Duplicates:** the same `contentHash` for the same meeting → replay of the existing transcript.

### 4.5 Recording transcription (D1)

- **Eligibility:** only recordings with a `storagePath` under `workspaces/{ws}/meetings/{meetingId}/recordings/` in our bucket. External links get "This recording is an external link and can't be transcribed. Upload the file instead." No URL fetching (Rule 34).
- **Model routing (Rule 58, G14):** T4.0 adds `modalities` to `AiModelRegistry` entries and `getModel({ modality: 'audio', workspaceId, organizationId })`. Routing picks only audio-capable models allowed by the tenant's data policy. If none is allowed, the request is refused with a clear reason (no silent fallback to a disallowed provider).
- **Residency/egress gate (Rules 32, 33, 57):** `assertProviderAllowed({ dataClass: 'personal', provider, region })` runs before the signed URL is created, using the M0 T6.0 tenant data policy.
  - **Default policy = today's configured providers allowed**, so behaviour is preserved.
  - Backoffice can restrict per org or workspace.
- **Flow:** the capability validates, writes the header (`pending`) and enqueues a Cloud Task (`/api/tasks/meeting-transcription`; HMAC + OIDC; payload Zod-validated). The worker then:
  1. Runs a dead-man check (global switch + capability flag, Rule 60).
  2. Re-checks consent, residency, quota, the recording's `updatedAt` (TOCTOU) and `cancelRequested`.
  3. Creates a 15-minute v4 signed URL (never logged; Rule 32).
  4. Calls `ai.generate` with a `media` part and `output.schema` (segments) through the gateway.
  5. Runs schema validation, then business validation: timestamps monotonic, within the recording duration ± 2 %, text non-empty, ≤ 60k words (Rule 31).
  6. Re-checks consent and cancellation, then stores (header last).
- **Limits:** ≤ 4 h audio, ≤ 500 MB. **Re-verify Gemini audio limits via Context7 at T4.1.**
- **Budgets per run (Rule 23):** `maxDuration` 15 min · `maxExternalRequests` 1 model call (+ ≤ 2 retries) · `maxRecordsMutated` ≤ 20 docs · queue concurrency 5 per workspace / 20 global · per-workspace daily audio cap (D11).
- **Resilience:** breaker on the provider (Rule 24); 3 retries with backoff → `dead_lettered` + manual recovery queue in Backoffice (Rule 25); idempotent per recording version.
- **Metering:** `costUnits` (audio minutes) on the header and in usage telemetry.

### 4.6 Consent (G9; PRD §98)

- `meeting_consents/{meetingId}/records/{consentId}` is **append-only** (Rule 40). Each record: `{ type: 'recording'|'transcription'|'aiProcessing'|'marketing', granted, recordedBy, method: 'verbal'|'written'|'form'|'policy', at, supersedes? }`.
- The current state is derived from the latest record per type and cached on `meeting_consents/{meetingId}.current` with a `version`.

Enforcement applies only when the workspace policy `enforceHostConsentForAI` is on; when it's off, today's behaviour stands.

| Operation | Requires |
| --- | --- |
| Upload/paste transcript | `transcription` |
| Transcribe recording | `recording` + `transcription` |
| Agent/MCP transcript read, AI use (M2+) | `aiProcessing` |
| Human transcript view | Workspace permission only |

- Withdrawal sets `aiUse: 'restricted'` on the meeting's transcripts (version-checked) and queues M2-derived data for purge.
- Refusals are audited and appear in the security feed.

### 4.7 Retention (G10), shadow first

- **Policy:** `retentionPeriodDays`, `autoPurgeTranscripts`, `autoPurgeRecordings`, plus new **`retentionMode: 'shadow' | 'enforced'`** (default `shadow`).
- **Legal hold:** new `legalHold: { on, by, at, reason }` on meetings, set via `meeting.set_legal_hold`; held meetings are always skipped.
- **Planner:** reuses `evaluateGDPRRetentionPurge`. It produces a **candidate set** (ids + counts) and its `candidateSetHash`.
- **Shadow mode** (Rule 42; the default for every workspace):
  - Each run records `meeting.retention.previewed` (what *would* be deleted).
  - The Compliance page and Backoffice show "Next purge would remove N transcripts and M recordings".
  - Nothing is deleted.
- **Enforced mode:** set per workspace by a human (D13). From then on the cron executes the plan using the same bound candidate set: **preview → approve (policy) → execute → verify** (Rules 21–22).
- **Cascade (saga, Rule 27):**
  1. Tombstone the header (`status: 'deleting'`).
  2. Delete segments (≤ 250 per batch).
  3. Delete the Storage objects.
  4. Delete the recording doc.
  5. Delete `meeting_intelligence`.
  6. Run registered cascades (`registerRetentionCascade(sourceType, handler)` for M3 memory/inbox/graph).
  7. Delete the header.
  8. Verify: re-query shows none.

  Each step is idempotent and resumable from the tombstone. A partial failure leaves a tombstone that the next run finishes.
- **Bounded:** ≤ 50 meetings per run in `automation-heartbeat` (no new scheduler).
- **Audit:** deletions record ids, counts, reason (`retention`|`manual`|`consent_withdrawn`), policy version and `candidateSetHash`, never content. Audit is not subject to transcript retention.

### 4.8 Security fixes

| Finding | Fix |
| --- | --- |
| G1 | `requireWorkspace` + `assertMeetingInWorkspace` on list/attach. Attach accepts either a validated workspace Storage path or `{ kind: 'external_link', url }`, where the URL must be `https:`, ≤ 2,048 chars, with no credentials in the URL. |
| G2 | Through `meeting.update_compliance_policy`: `requireWorkspace` + `meetings_manage` in that workspace + `expectedUpdatedAt` + before/after audit. Shortening retention or enabling auto-purge returns an impact preview first. |
| G3 | Ownership check; `task.create` via the gateway with `origin: { type: 'meeting_action_item', meetingId, actionItemId }`, key `mtg_task_{meetingId}_{actionItemId}`; the cast replaced by Zod parsing. |
| G4 | Ownership on both actions; fabricated transcript removed (→ `NO_TRANSCRIPT`). |
| G5 | Rules: client **write false** on `meeting_transcripts` (+ `segments`), `meeting_intelligence`, `meeting_recordings`, `meeting_consents` (+ `records`); reads unchanged for members; unauthenticated denied. |
| G8 | v4 signed URLs (15 min) for uploaded recordings, `Cache-Control: no-store`; `recording.accessed` audit; share-token generation removed. |

### 4.9 Trust-boundary matrix (Rule 13)

| Data | Class | May become instructions? | Handling |
| --- | --- | --- | --- |
| Capability inputs from UI | USER TRUST | No | Zod + permission |
| Capability inputs from agents/MCP | MODEL-GENERATED DATA | No | Zod → business → permission → policy (Rule 31) |
| Uploaded/pasted transcript text | CUSTOMER DATA (untrusted) | **Never** | Parsed, scanned, flagged, stored as data |
| DOCX file bytes | EXTERNAL DATA (untrusted) | Never | Signature/size/bomb checks; raw-text extraction only |
| Model transcription output | MODEL-GENERATED DATA | Never | Schema + business validation |
| Firestore meeting/transcript docs | INTERNAL DATA | No | Zod on read |
| Cloud Task payloads | SYSTEM TRUST after HMAC/OIDC | No | Zod; re-load state, never trust payload state |
| External recording links | UNTRUSTED WEB CONTENT | Never | Not fetched; `https:` only; rendered as a link |

### 4.10 `unknown` boundaries (Rule 4)

`unknown` appears only at these boundaries, each followed immediately by a schema:
- Upload object metadata.
- mammoth result.
- Model output.
- Cloud Task body.
- Firestore snapshots (transcripts, consents, policies, legacy inline segments).
- Server action arguments.

No `any`, `any[]` or unchecked casts (the existing `as MeetingIntelligence` / `as MeetingRecording` in touched files are replaced).

### 4.11 Mutation contracts: idempotency, replay, TOCTOU (Rules 18–20)

| Mutation | Idempotency key (gateway-namespaced) | Retry | Duplicate | Lost response | TOCTOU token |
| --- | --- | --- | --- | --- | --- |
| Ingest transcript | `mtg_tx_{meetingId}_{contentHash}` | Safe | Replays the stored result | Client retries → same transcript | Meeting `updatedAt` (must still exist) |
| Transcribe recording | `mtg_stt_{recordingId}_{recordingUpdatedAt}` | Safe | Second enqueue → same transcript id; duplicate task delivery → worker sees a non-`pending` status and exits | Re-call returns the current status | Recording `updatedAt` re-checked in the worker |
| Record consent | `mtg_consent_{meetingId}_{type}_{expectedVersion}` | Safe | Same record | Same | `meeting_consents.version` |
| Delete transcript | `mtg_txdel_{transcriptId}` | Safe (tombstone) | No-op once deleted | Re-call → "already deleted" | Transcript `version` + preview hash |
| Update compliance policy | `mtg_policy_{workspaceId}_{expectedUpdatedAt}` | Safe | Same | Same | Policy `updatedAt` |
| Set legal hold | `mtg_hold_{meetingId}_{on}_{expectedUpdatedAt}` | Safe | Same | Same | Meeting `updatedAt` |
| Run retention | `mtg_ret_{workspaceId}_{candidateSetHash}` | Resumable | Same set → no-op | Next run finishes from tombstones | `candidateSetHash` + policy version |
| Attach recording | `mtg_rec_{meetingId}_{sha256(storagePath|url)}` | Safe | Same doc | Same | Meeting `updatedAt` |
| Convert action item | `mtg_task_{meetingId}_{actionItemId}` | Safe | Same task | Same | Intelligence `updatedAt` |

Every invocation records `runId?`, `toolCallId?`, `executionId`, `idempotencyKey`, `status` and `attempt` in the execution store (Rule 20).

### 4.12 Two-phase actions and approval binding (Rules 21, 22)

| Action | Preview shows | Bound to | Invalidated when |
| --- | --- | --- | --- |
| Delete transcript (human) | Items in the cascade (segments, intelligence, derived items) | `transcriptId`, `version`, cascade-count hash | Transcript changes |
| Shorten retention / enable auto-purge / switch to enforced | "N transcripts and M recordings will be removed on the next run" | `policyVersion`, `candidateSetHash` | Policy or candidates change before confirm |
| Backoffice "Run now" | Candidate list | `candidateSetHash`, `policyVersion`, operator | Set changes → re-preview |

Verification after execution re-queries and reports the actual counts against the previewed counts. A mismatch is surfaced and audited.

### 4.13 Cancellation (Rule 26)

| Operation | Cancellable? | When | In-flight | Partial state |
| --- | --- | --- | --- | --- |
| Transcription | Yes (`cancelRequested`) | Until storing begins | Model call completes but its result is discarded | Header → `cancelled`; no segments written |
| Ingestion | No (seconds long) | — | — | Header-last write; failure deletes written chunks |
| Retention run | Yes (global pause/dead-man) | Between meetings | The current meeting's cascade finishes | Remaining meetings left; tombstones resumable |

### 4.14 Saga / compensation (Rule 27)

| Flow | Failure point | Compensation |
| --- | --- | --- |
| Ingest | After chunks, before header | Delete written chunks; header `failed` |
| Transcription | Model OK, store fails | Delete chunks; header `failed`; retry |
| Transcription | Consent withdrawn mid-run | Discard output; header `cancelled` (`consent_withdrawn`) |
| Retention cascade | Any step | Tombstone remains; next run resumes; nothing un-deleted |
| Convert action item | Task created, intelligence update fails | Idempotent retry links the same task (key) |

---

## 5. Tasks (TDD, small local commits)

**Conventions:**
- Failing test first; `pnpm typecheck` + `pnpm lint` + affected Vitest; commit locally; **no push unless asked**; no local `next build` (CI builds).
- `@fileOverview` + `// CAUTION:` comments at ownership, consent, retention, storage-path and egress code, each with a testability note (Rule 10).
- Zod at every boundary (§4.10); OTel spans with `traceId/spanId/runId/toolCallId/correlationId/causationId` (Rule 39).

### T0: Security hotfixes (G1, G2, G3, G4-IDOR) · Rules 8, 49, 51 · ship first, independently

| Step | Action | Files |
| --- | --- | --- |
| 0.1 | Tests: anonymous / other-workspace / member for list + attach; attach with `javascript:` / `http:` link refused, existing `https:` link OK; compliance save by non-member, member without `meetings_manage`, member with it; stale `expectedUpdatedAt` refused; convert action item across workspaces; intelligence + prep brief across workspaces | `src/lib/__tests__/meetings/meeting-actions-security.test.ts` |
| 0.2 | `assertMeetingInWorkspace` (both shapes, `server-only`) + tests | `src/lib/meetings/meeting-access.ts` |
| 0.3 | Guard the four actions; compliance → `meetings_manage` + before/after audit + `expectedUpdatedAt` (optional for now: when absent, behaviour as today, so the current page keeps working until T8.3 sends it) | recording, compliance, intelligence actions |
| 0.4 | Strict server-action sweep: these actions drop out of the unguarded list; the count must not rise (baseline 477) | inventory script |

**Acceptance:** security tests green; sweep clean for these actions. *Deployable alone (D12).*

### T1: Meeting capabilities & ownership (G11, G12) · Rules 12, 14, 16, 47, 69

| Step | Action | Files |
| --- | --- | --- |
| 1.1 | Contract suites for `meeting.search/get/list_recordings/get_transcript`: valid; invalid; wrong tenant → `NOT_FOUND`; revoked agent; payload too large; agent principal gets **no signed URL**; agent transcript read without `aiProcessing` consent (enforcement on) refused; lying annotation still enforced | `src/platform/__tests__/domains/meetings/*.test.ts` |
| 1.2 | `src/platform/domains/meetings_conversations/`: contracts, registrar, `resolveResourceScope`, minimal output projections | new |
| 1.3 | Register in `DOMAIN_REGISTRARS`; tool fingerprint baselines; MCP v2 `meetings` domain server lists them (existing factory; spec 2026-07-28, `@modelcontextprotocol/server` ^2.1.0 recorded) | `register-capabilities.ts`, fingerprint baseline |
| 1.4 | Legacy actions delegate (same return shapes) | actions |
| 1.5 | Tool-selection eval cases (Rule 59): "what did they say about pricing in yesterday's demo?" → `meeting.search` then `meeting.get_transcript`; no transcript reads for a scheduling question | `src/platform/__tests__/evals/meetings-tool-selection.test.ts` |

### T2: Transcript storage v2 + server-only rules (G5, G7) · Rules 4, 5, 9, 40, 49, 50

| Step | Action | Files |
| --- | --- | --- |
| 2.1 | Tests: 4 h (≈ 7,000 segments) write/read across chunks; legacy inline read; header-last (no partial reads); version increments; rules tests (member write denied on all collections and subcollections, member read allowed, anonymous denied); Storage rules (size, content type, create-only, wrong path denied) | storage + rules tests |
| 2.2 | `transcript-store.ts` (`server-only`): schema v2 (Zod), chunked writer, paged reader, legacy adapter, status machine incl. `cancelled`/`dead_lettered`/`deleting` | `src/lib/meetings/transcript-store.ts` |
| 2.3 | `firestore.rules` + `storage.rules` changes (§4.8 G5; §4.4 paths) | rules files |
| 2.4 | Indexes: `meeting_transcripts` (workspaceId, meetingId, createdAt desc), (workspaceId, status, updatedAt); `meeting_recordings` (workspaceId, meetingId); index-coverage test | `firestore.indexes.json` |
| 2.5 | No caching of transcript reads or signed URLs (`no-store`, no `'use cache'`); test asserts headers (Rule 50) | actions/route |

### T3: Transcript ingestion (G6) · Rules 4, 8, 9, 13, 19, 30, 31

| Step | Action | Files |
| --- | --- | --- |
| 3.1 | Parser tests: VTT (voice tags, multi-line, BOM, CRLF, HTML in cues stripped), SRT (gaps, comma ms), TXT, DOCX fixture, paste; malformed → clear error; property tests (never throw unhandled, timestamps monotonic after normalization) | `transcript-parsers.test.ts` |
| 3.2 | `transcript-parsers.ts` (pure, `server-only`) | new |
| 3.3 | DOCX guard: ZIP signature, compressed/uncompressed caps from the central directory, 10 s timeout; tests with a zip-bomb fixture and a non-ZIP file | `src/lib/meetings/docx-guard.ts` |
| 3.4 | `meeting.ingest_transcript`: consent gate, limits, parse, speaker mapping, injection scan, `dataClass`, provenance, `contentHash` idempotency, store, events | domain |
| 3.5 | Upload server action: path/bucket/size/type validation, delegate, delete upload; janitor for abandoned uploads (24 h) | `meeting-transcript-actions.ts` |
| 3.6 | Tests: injection transcript stored `flagged`; duplicate upload → same transcript; `../` path refused; foreign bucket refused; > 5 MB refused; 100 concurrent ingestions (Rule 9) | tests |

### T4: Recording transcription (D1) · Rules 23–26, 31–34, 43, 57, 58, 60

| Step | Action | Files |
| --- | --- | --- |
| 4.0 | **Prerequisites:** (a) tenant data policy + `assertProviderAllowed` (shared with M0 T6.0; default = current providers allowed); (b) `modalities` on `AiModelRegistry` + `getModel({ modality: 'audio' })` that only returns allowed audio-capable models. Tests: disallowed provider refused; no audio model → clear refusal; existing `getModel` callers unchanged (regression suite) | `src/ai/*`, `src/platform/policy/data-policy.ts` |
| 4.1 | Context7: current Gemini audio limits (duration/size/formats) and Genkit `media` with signed URLs; record versions in the report | — |
| 4.2 | Tests (fake provider, Rule 44): eligible → transcript; external link refused; residency refused; 429 → breaker + retry; 3 failures → `dead_lettered` + recovery queue; duplicate delivery → idempotent; cancel before/after model call; consent withdrawn mid-run → `cancelled`; quota exceeded; invalid output (timestamps past duration) → `failed`, nothing stored; dead-man on → task exits without a model call | `src/platform/__tests__/meetings/transcription.test.ts` |
| 4.3 | `meeting.transcribe_recording` (enqueue, `dryRun` support, Rule 42) + worker route (HMAC + OIDC, dead-man, 503 semantics) | domain + `src/app/api/tasks/meeting-transcription/route.ts` |
| 4.4 | `transcription-service.ts` (`server-only`): signed URL (v4, 15 min, never logged), `ai.generate` with `media` + `output.schema`, validation, cost metering, replay record (model/prompt version, input hash, output hash; Rule 43) | `src/lib/meetings/transcription-service.ts` |

### T5: Per-meeting consent (G9) · Rules 17, 18, 21, 40, 57

| Step | Action | Files |
| --- | --- | --- |
| 5.1 | Tests: enforcement off → today's behaviour; on → each operation needs its consent; withdrawal → `aiUse: 'restricted'`; agent/MCP can't record consent; stale version refused; history append-only (no update/delete path) | consent tests |
| 5.2 | Append-only `meeting_consents` model + `meeting.record_consent` + `consent-gate.ts` used by ingest, transcribe and get_transcript | domain + `src/lib/meetings/consent-gate.ts` |

### T6: Retention (G10), shadow first · Rules 9, 21, 22, 25, 27, 40, 42, 57

| Step | Action | Files |
| --- | --- | --- |
| 6.1 | Tests: shadow run deletes nothing and records the preview; enforced run deletes exactly the bound set; legal hold skipped; changed candidates → re-preview; bounded per run; tombstone resume after a mid-cascade failure; re-run idempotent; cascade hook called with `sourceId`; audit has no content | retention tests |
| 6.2 | `legalHold` on meetings + `meeting.set_legal_hold`; `retentionMode` on the policy (default `shadow`) | types, domain |
| 6.3 | `retention-service.ts` (planner reuses `evaluateGDPRRetentionPurge`; saga cascade; `registerRetentionCascade`); `meeting.run_retention`; heartbeat step (≤ 50 meetings) | `src/lib/meetings/retention-service.ts`, heartbeat route |
| 6.4 | `meeting.update_compliance_policy` with impact preview for retention-shortening / enforce switches (§4.12); legacy action delegates | domain, compliance actions |

### T7: Fail-closed intelligence + real signed playback (G4-B1, G8) · Rules 21, 41, 47, 50

| Step | Action | Files |
| --- | --- | --- |
| 7.1 | Tests: no transcript → `NO_TRANSCRIPT`, no model call, nothing stored; uploaded recording → v4 signed URL (15 min) + `recording.accessed` audit + `no-store`; external link returned unsigned and labelled; restricted transcript (`aiUse`) → intelligence refused with a clear message | tests |
| 7.2 | Remove the fabricated transcript; read via `readTranscript`; keep the existing extraction call until M2 (G13) | `meeting-intelligence-actions.ts` |
| 7.3 | Playback via Storage signed URL (reuse the `pdf-actions` pattern); stop generating `shareToken` | `meeting-recording-actions.ts` |

### T8: Minimal UI (theme.md §8, mobile-first) · Rules 7, 52, 54

| Step | Action | Files |
| --- | --- | --- |
| 8.1 | Intelligence tab empty state: "Add a transcript to analyse this meeting" with **Upload file** / **Paste text** / **Transcribe recording** (only when eligible); status chip (Processing / Ready / Failed + Retry / Cancel); actionable toasts | `MeetingIntelligenceTab.tsx`, `AddTranscriptModal.tsx` (lazy-loaded) |
| 8.2 | Consent row (4 toggles, who/when) when enforcement is on | meeting detail |
| 8.3 | Compliance page: Save disabled without permission (server still enforces); sends `expectedUpdatedAt`; impact preview dialog ("This will remove 42 transcripts on the next run. Continue?"); shadow/enforced switch; legal hold toggle on the meeting | `ComplianceClient.tsx`, meeting detail |
| 8.4 | Transcript view virtualized above 200 segments; ≥ 44 px targets; bottom sheet on phones; 375/768/1280 checks; reduced-motion respected (emilkowal-animations) | UI tests |
| 8.5 | Client/server boundary tests: transcript-store, parsers, transcription-service, consent-gate and docx-guard never in client bundles (`server-only`); no signed URL or provider key reaches the client except the playback URL for the current human user | `src/platform/__tests__/boundaries/meetings-boundary.test.ts` |

### T9: Backoffice & operations · Rules 3, 60–65

| Step | Action | Files |
| --- | --- | --- |
| 9.1 | `meetings-monitor`: transcription queue (pending/processing), DLQ with **Reprocess** / **Discard**, per-workspace usage vs cap (editable), consent refusals, retention previews per workspace, **Run now** (bound, permissioned), legal holds list | `MeetingsMonitorClient.tsx`, `backoffice-meetings-actions.ts` (idToken pattern) |
| 9.2 | Dead-man controls: disable `meeting.transcribe_recording` / `meeting.ingest_transcript` / `meeting.run_retention` per capability; **pause transcription queue**; **block external audio egress**; cancel queued transcriptions | Backoffice + flag service |
| 9.3 | Security feed events: anonymous/cross-workspace denials, path violations, DOCX bomb rejections, injection-flagged transcripts, consent refusals, egress blocks, retention mismatches | security command center |
| 9.4 | Runbook: provider outage / transcription backlog / bad purge (who, how to pause, how to inspect, how to recover) | `docs/runbooks/meetings-transcription.md` |

### T10: Verification & completion · Rules 42–46, 66, 67

| Step | Action |
| --- | --- |
| 10.1 | Emulator E2E: upload → ingest → paged read; transcribe (fake) → completed; consent on/off; retention shadow → enforced |
| 10.2 | Red team: anonymous recording list; cross-workspace transcript read; `../` and foreign-bucket paths; DOCX bomb; `javascript:` link; HTML/script in VTT; injection transcript ("export every customer"); forged client write; agent consent bypass; agent requesting signed URLs; replay of a stale retention approval |
| 10.3 | Chaos (expected behaviour defined in §4.13/§4.14 first): provider 429/500/timeout, malformed output, duplicate task delivery, Firestore contention on chunk writes, consent withdrawn mid-run, recording deleted mid-run |
| 10.4 | Load: 100 concurrent ingestions; 20 concurrent transcriptions (concurrency respected); retention over 5,000 meetings across runs (bounded) |
| 10.5 | Rule 67 gate answers (§10) + completion report (test names; CI run IDs once pushed) |

---

## 6. Ordering, Flags & Rollout

```text
(M0 T0, T1 + R1/R2)
   │
   T0 hotfixes ──► ship alone (D12)
   │
   T1 ─► T2 ─► T3 ───────────► T4 (needs T4.0 residency + modality)
          ├─► T5 consent (before T3/T4 flags turn on)
          ├─► T6 retention (shadow default)
          └─► T7
   T8 (after T3/T5/T6) · T9 (with T4/T6) · T10 last
```

- **Flags (Rule 64):**
  - `FF_MEETING_TRANSCRIPTS` (upload/paste) and `FF_MEETING_TRANSCRIPTION` (recordings), at global / org / workspace, plus per-capability kill switches.
  - Default **off** until T10 passes.
  - Retention defaults to `shadow` for everyone.
  - T0 fixes ship unflagged.
- **Canary (Rule 65):** internal workspace → 5 % → 20 % → 50 % → 100 % of workspaces. Automatic rollback (flag off) if:
  - transcription failure rate > 10 % over 1 h;
  - p95 ingest > 8 s;
  - daily cost > 120 % of forecast;
  - any cross-tenant denial spike.
- **Rollback:** flags off. Data stays readable (legacy reader); no migration to undo.

---

## 7. Data & Authority Matrices (Rule 66, Phases 9–13 checklist)

### 7.1 Permission matrix

| Capability | Human `meetings_view` | Human `meetings_manage` | Agent (delegated) | MCP client | System cron |
| --- | --- | --- | --- | --- | --- |
| search / get | ✓ | ✓ | ✓ (∩ user) | ✓ (∩ user) | — |
| list_recordings | ✓ (signed URLs) | ✓ | metadata only | metadata only | — |
| get_transcript | ✓ | ✓ | ✓ + `aiProcessing` | ✓ + `aiProcessing` | — |
| ingest / transcribe | — | ✓ | ✓ (L1, ∩ user) | ✓ (L1) | — |
| record_consent, delete_transcript, update_compliance_policy, set_legal_hold | — | ✓ | ✗ non-delegable | ✗ | — |
| run_retention | — | Backoffice "Run now" only | ✗ | ✗ | ✓ (shadow/enforced per policy) |

Agent authority = user ∩ agent ∩ workspace ∩ tool ∩ delegation ∩ policy (Rule 16). A highly privileged user never widens an agent beyond this table.

### 7.2 Egress matrix (Rules 32, 33)

| Data | Destination | Allowed when |
| --- | --- | --- |
| Audio (via signed URL) | Allowed model provider | Residency gate passes, consents present, flag on, external audio egress not blocked |
| Transcript text | Our AI gateway (M2+) | `aiUse: 'allowed'`, `aiProcessing` consent (if enforced) |
| Transcript text | MCP client | Same + ≤ 500 segments per page, ≤ 20 pages per run |
| Signed playback URL | Current human browser session | Never to agents, MCP, logs, events or audit |

### 7.3 Failure matrix

| Failure | Behaviour | User sees |
| --- | --- | --- |
| Provider 429/500/timeout | Breaker; retry ×3; then DLQ | "Transcription is delayed. We'll keep trying." → after DLQ: "Couldn't transcribe. Try again." |
| Malformed model output | `failed`, nothing stored | "Couldn't transcribe this recording." |
| Residency/egress blocked | Refused before any upload | "Your workspace doesn't allow this recording to be sent for transcription." |
| Quota reached | Refused | "Daily transcription limit reached. Try again tomorrow." |
| Consent missing | Refused + audited | "Record transcription consent first." (button → consent row) |
| Oversize / bomb / bad encoding | Refused | Plain specific message |
| Firestore contention | Batch retry; header-last | Nothing partial visible |

---

## 8. Test Plan Summary

| Layer | Suites |
| --- | --- |
| Unit | parsers (incl. property tests), docx-guard, ownership, consent gate, transcript store, retention planner, model modality routing, data-policy gate |
| Contract | all `meeting.*` capabilities via `defineContractSuite`; fingerprint baselines |
| Integration (emulator) | chunked storage, Firestore + Storage rules, signed URLs, purge cascade |
| E2E | §T10.1 |
| Security / tenant isolation / adversarial | §T10.2; server-action sweep; boundary tests |
| Chaos / load | §T10.3, §T10.4 |
| Evaluation | tool-selection cases (T1.5) |

---

## 9. Rules Conformance Matrix

### 9.1 Important Rules 1–10

| Rule | M1 conformance | Verified by |
| --- | --- | --- |
| 1 | Skills (`.agents/skills`): `next-best-practices`, `vercel-react-best-practices`, `emilkowal-animations` (T8), `frontend-design`, `backend-patterns` (backend design), `firebase-security-rules-auditor`, `cybersecurity-analyst`, `firebase-ai-logic`, `mcp-builder`, `test-driven-development`, `verification-before-completion`. Preservation §3; trackable §16 | Review checklist |
| 2 | Risks §11; refactor = one ownership helper, one transcript store, legacy actions delegate; TDD; local typecheck/lint/commit; no push | Commit log |
| 3 | Affected features §12; Backoffice T9/§13 | Backoffice E2E |
| 4 | §4.10 boundaries; casts removed in touched files | Lint + review |
| 5 | Rules, storage rules and indexes emulator-tested; staging = production project (D5) → written approval per deploy; security-sensitive rules never auto-deployed | Approval record |
| 6 | No new dependencies. Context7 checked 2026-10-05 for Genkit, mammoth and Storage; re-check Gemini audio limits at T4.1 | Report |
| 7 | Mobile-first T8; plain short copy; reuse inventory §2 | Viewport tests |
| 8 | G1–G5, G8; DOCX bomb; XSS; path traversal; red team T10.2 | Security suite |
| 9 | Caps, chunked writes, paged reads, bounded purge, queue concurrency, quotas; edge cases §11.2 | Load tests |
| 10 | `@fileOverview` + `// CAUTION:` + testability notes at listed hotspots | Review |

### 9.2 Rules 11–69

| Rule | Conformance in M1 |
| --- | --- |
| 11 | MCP 2026-07-28, `@modelcontextprotocol/server` ^2.1.0 (existing v2 Streamable HTTP server); versions recorded in the report |
| 12 | §4.2: annotations advisory; lying-hint test |
| 13 | §4.9 trust matrix |
| 14 | Fingerprint baselines for every new tool (T1.3) |
| 15 | N/A: no external MCP servers are added or connected |
| 16 | §7.1; live standing via M0 T1 |
| 17 | Consent, delete, compliance policy, legal hold, run retention: non-delegable |
| 18 | §4.11 TOCTOU tokens |
| 19, 20 | §4.11 per-mutation table; execution records |
| 21, 22 | §4.12 preview/approve/execute/verify with binding |
| 23 | §4.5 budgets; transcript read caps; quotas |
| 24 | Provider breaker |
| 25 | `failed`/`cancelled`/`dead_lettered`; DLQ + manual recovery in Backoffice |
| 26 | §4.13 |
| 27 | §4.14 |
| 28 | N/A: no context assembly (M2/M4); read caps prepare for it |
| 29 | N/A: no memory facts (M3); provenance and retention fields prepared |
| 30 | Injection scan; source trust; `flagged` → human review threshold; `dataClass: personal` |
| 31 | Model output → schema → business → permission → policy → store |
| 32, 33 | §7.2 egress matrix; signed URLs never to agents/logs |
| 34 | No URL fetching; path/bucket validation; `https:`-only external links; `validateSafeEgressUrl` mandatory for any future URL import |
| 35, 36, 37 | Existing discovery cache + fingerprints invalidate on change; capability semver `1.0.0`; MCP compatibility suite re-run with the new tools |
| 38 | No Roots/Sampling/Logging/SSE; transcription uses our Genkit gateway, not the client's model |
| 39 | Spans: ingest, parse, scan, store, enqueue, transcribe, validate, purge-plan, purge-step |
| 40 | Append-only consent history; audit with ids/hashes only; audit survives purges |
| 41 | Decision trace for transcription and purges: goal, policy, capability, arguments (ids), result, evidence (counts/hashes), verification, actor |
| 42 | `dryRun` transcription; retention shadow mode by default |
| 43 | Replay record (model/prompt version, input/output hash) + fake-provider replay |
| 44, 45, 46 | Fake provider + emulator; chaos T10.3; red team T10.2 |
| 47, 48 | Model and tool outputs validated; never instructions |
| 49 | Nothing public; share tokens retired; unauthenticated rules tests |
| 50 | No caching of transcripts/URLs; `no-store` |
| 51 | Every new/changed action: `'use server'` + auth + permission + ownership |
| 52 | T8.5 boundary tests; `server-only` modules |
| 53 | No new dependencies (mammoth ^1.12.3, firebase-admin ^12.7.0, genkit ^1.42.0 already locked); lockfile unchanged |
| 54 | Parse ≤ 1 s per 60k words; ingest p95 ≤ 4 s; transcript page ≤ 300 ms; add-transcript modal lazy-loaded; virtualize > 200 segments |
| 55 | N/A: no graph/canvas UI |
| 56 | N/A: no context compression in M1 |
| 57 | Residency gate before transcription (T4.0); `dataClass`/`region`/`retentionPolicy` on transcripts; retention enforced |
| 58 | Modality-aware routing (T4.0) |
| 59 | Tool-selection eval cases (T1.5) |
| 60 | T9.2 dead-man controls; worker checks |
| 61, 62, 63 | T9.1 control plane; T9.3 security feed; T9.4 runbook |
| 64, 65 | §6 flags and canary thresholds |
| 66 | Phase 1 contracts (idempotency, risk, version, concurrency, audit, egress), Phase 4 (provenance, sensitivity, retention, deletion), Phase 7 (cancel, retry, DLQ, recovery, compensation, replay), Phase 9–13 checklist (§7, §6 rollback) |
| 67 | §10 gate |
| 68 | Model isn't the boundary; tool/model output untrusted; every mutation idempotent + authorized + version-checked + audited; bounded authority/resources; operable from Backoffice |
| 69 | Every behaviour is a capability used by UI, agents, MCP and Backoffice alike |

---

## 10. Implementation Gate (Rule 67), answered

```text
ARCHITECTURE
□ Capability       meeting.* (§4.2) via executeCapability
□ Duplication?     No: reuses transcript-service, compliance-service, recording-service, activity-logger,
                   anti-poisoning, egress policy, fingerprints, pdf-actions signing, Cloud Tasks pattern
□ Source of truth  Firestore (headers, segments, consents, policy) + Storage (files)
□ Events           §4.3 list (ids/counts/hashes only)
AUTHORITY
□ Who              §7.1
□ Agent may        L0 reads (metadata-only recordings), L1 ingest/transcribe
□ Agent never      consent, delete, policy, legal hold, retention, signed URLs
□ Sub-agent        Cannot inherit non-delegable capabilities; authority is an intersection
DATA
□ In               transcript files/text, audio (via signed URL), model output
□ Out              audio to an allowed provider; transcript text to the AI gateway/MCP per §7.2
□ Trusted          System/user inputs after validation
□ Untrusted        All transcript content, DOCX bytes, model output, external links
□ Sensitive        Transcripts = personal; signed URLs = credential-like
EXECUTION
□ Idempotent       Yes, §4.11
□ Retry            Yes (safe)
□ Cancel           §4.13
□ Duplicate        Replays/no-ops, §4.11
□ Record changed   Version tokens; worker re-checks
□ Response lost    Re-call returns the stored result/status
MCP
□ Protocol         2026-07-28
□ SDK              @modelcontextprotocol/server ^2.1.0
□ Capabilities     tools only (no resources/prompts added)
□ Annotations      §4.2 (advisory)
□ Server identity  existing meetings domain server
□ Schema version   capability 1.0.0; transcript schemaVersion 2
□ Definition change Fingerprint mismatch blocks until reviewed
FAILURE
□ Timeout/429/500  Breaker + retry + DLQ
□ Partial          Header-last; tombstones; compensation §4.14
□ Provider down    Clear message; nothing committed
□ Stale approval   Bound previews invalidate on change
□ Concurrent edit  Version check → conflict message
SECURITY
□ Prompt injection Scanned, flagged, never interpreted
□ Tool poisoning   Fingerprints
□ Confused deputy  Ownership + intersection authority; no signed URLs to agents
□ SSRF             No URL fetching; path validation
□ Exfiltration     Egress matrix; read caps; consent
□ Escalation       Non-delegable list
□ Cross-tenant     assertMeetingInWorkspace + rules tests
OPERATIONS
□ Disable          Per-capability kill switch; pause queue; block audio egress
□ Inspect          meetings-monitor queue/DLQ/usage/previews
□ Replay           DLQ reprocess; fake-provider replay
□ Rollback         Flags off; legacy reader
□ Policy w/o code  Caps, data policy, retention mode, legal hold in Backoffice/Compliance page
TESTING            Unit · Integration · Contract · E2E · Security · Tenant isolation · Adversarial · Load · Chaos · Evaluation
MIGRATION
□ Behaviour        §3 preserved
□ Routes           Unchanged; one new worker route
□ Data             Preserved; no backfill (legacy reader)
□ Restore          Firestore PITR/export procedure referenced in the runbook
□ Rollback         Flags off; retention shadow by default
N/A                15, 28, 29, 55, 56 (reasons in §9.2)
```

---

## 11. What Could Go Wrong & Edge Cases

### 11.1 Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | Hotfixes break a screen that relied on unauthenticated calls | UI already passes workspace ids; member-path tests; sweep |
| R2 | Someone loses compliance access | Uses the existing `meetings_manage`; parity test; Backoffice grant |
| R3 | Transcription cost spikes | Daily cap; metering; flags off by default; canary auto-rollback |
| R4 | Poor transcription quality (accents, crosstalk, Twi/English mix) | Per-segment confidence; editable speakers; low confidence excluded from M2 auto-actions |
| R5 | Long audio exceeds provider limits | Caps + clear message; verify at T4.1 |
| R6 | Rules tightening breaks a writer | Verified none; rules tests; approval |
| R7 | Consent enforcement surprises teams | Only when the workspace enables it; actionable refusal copy |
| R8 | Retention deletes something wanted | Shadow default; bound previews; legal hold; audit |
| R9 | Storage upload abuse | Size/type rules; create-only; path validation; janitor; quota |
| R10 | Residency default too strict or too loose | Default = today's providers (no change); Backoffice restricts; egress blocks visible in the security feed |
| R11 | Modality routing changes existing `getModel` results | `modality` optional; regression suite over current callers |

### 11.2 Edge cases

| Case | Expected |
| --- | --- |
| Empty/whitespace transcript | "This file has no transcript text." |
| VTT without speakers | Single "Speaker 1" |
| Overlapping/unsorted timestamps | Sorted; overlaps kept |
| Non-UTF-8 file | Refused with guidance |
| DOCX with images only | "This document has no transcript text." |
| Password-protected or corrupt DOCX | "We couldn't read this document." |
| Same transcript twice | Same transcript returned |
| Meeting in two workspaces | Both may read; ingest records the uploading workspace |
| Meeting deleted mid-transcription | Worker stops; `failed` (`meeting_deleted`) |
| Consent withdrawn mid-run | `cancelled` (`consent_withdrawn`); nothing stored |
| Recording replaced mid-run | `updatedAt` mismatch → `cancelled` (`recording_changed`); new run on request |
| Output beyond recording duration | Rejected; `failed` |
| 7,000+ segments | 14+ chunk docs; header last |
| Retention run overlaps a manual delete | Idempotent; audited once each |
| Policy changed between preview and confirm | Approval invalid → re-preview |
| No compliance policy doc | Defaults: enforcement off, shadow retention, no auto-purge |
| Legal hold set mid-purge | Checked per meeting just before its cascade; skipped |

---

## 12. Affected Features (Rule 3)

| Feature | Effect |
| --- | --- |
| Meeting detail (recordings, intelligence tab, action items drawer) | Secured; empty state; add-transcript flow; legal hold toggle |
| Compliance page | Permissioned save; impact preview; shadow/enforced; next-purge summary |
| Tasks | Action items via `task.create` with `origin` |
| AI gateway (`getModel`) | Optional `modality`; tenant data policy (shared with M0 T6) |
| MCP v2 `meetings` domain | New tools; fingerprints |
| Firestore + Storage rules | Server-only writes; upload paths |
| Heartbeat cron | Retention step (bounded) |
| Backoffice meetings-monitor & security feed | Queue, DLQ, usage, previews, controls, events |

---

## 13. Backoffice (operable without code, Rules 15/61)

`meetings-monitor` (T9.1–9.3) plus:
- **Flags:** `FF_MEETING_TRANSCRIPTS`, `FF_MEETING_TRANSCRIPTION` (global/org/workspace) and per-capability kill switches in `features`.
- **Data policy:** allowed providers/models/region per org or workspace (shared with M0 T6).
- **Caps:** daily audio minutes per workspace.
- **Retention:** mode, previews, Run now, legal holds.
- **Recovery:** DLQ reprocess/discard.

---

## 14. Deployment (Rule 5)

Nothing below happens without explicit approval:

| # | Change |
| --- | --- |
| I7 | `firestore.rules` (server-only meeting collections) + `storage.rules` (upload paths) |
| I8 | New indexes (T2.4) |
| I9 | Code deploy: **T0 hotfixes first** (D12); flagged features after T10 |
| I10 | Cloud Tasks queue `meeting-transcription` (concurrency 20, max attempts 3) |

---

## 15. Decisions

| # | Decision | Recommended |
| --- | --- | --- |
| D10 | Who may change compliance settings | **Existing `meetings_manage` in that workspace** (revised: no new permission, no role migration) |
| D11 | Default daily transcription cap per workspace | 2 hours (Backoffice-editable) |
| D12 | Ship T0 security hotfixes ahead of the rest (and before finishing M0)? | **Yes**: G1/G2 are live exposures |
| D13 | Retention default | **Shadow** for all workspaces; a workspace admin switches to enforced after reviewing the preview |

---

## 16. Tracker

| ID | Task | Steps | Status | Evidence |
| --- | --- | --- | --- | --- |
| P11-M1-T0 | Security hotfixes | 0.1–0.4 | ☐ | |
| P11-M1-T1 | Meeting capabilities & ownership | 1.1–1.5 | ☐ | |
| P11-M1-T2 | Transcript storage v2 + rules | 2.1–2.5 | ☐ | |
| P11-M1-T3 | Transcript ingestion | 3.1–3.6 | ☐ | |
| P11-M1-T4 | Recording transcription (+ residency/modality) | 4.0–4.4 | ☐ | |
| P11-M1-T5 | Per-meeting consent | 5.1–5.2 | ☐ | |
| P11-M1-T6 | Retention (shadow first) + legal hold + policy capability | 6.1–6.4 | ☐ | |
| P11-M1-T7 | Fail-closed intelligence + signed playback | 7.1–7.3 | ☐ | |
| P11-M1-T8 | Minimal UI + boundary tests | 8.1–8.5 | ☐ | |
| P11-M1-T9 | Backoffice & operations | 9.1–9.4 | ☐ | |
| P11-M1-T10 | Verification & report | 10.1–10.5 | ☐ | |

**Mapping to master §13:** P11-M1-T1 → T1 (+T0 IDOR) · P11-M1-T2 → T2, T3 · P11-M1-T3 → T4 · P11-M1-T4 → T5, T6 · P11-M1-T5 → T7 + T2.3. New: T0, T8, T9, T10.

---

## 17. Next Step

1. Confirm D10–D13.
2. Finish the M0 review fixes (R1/R2) and commit M0 T1.
3. Start **M1 T0** (security hotfixes) with failing tests.
