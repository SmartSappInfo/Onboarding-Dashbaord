# Phase 11 · Milestone 1 Implementation Plan
## Meetings Capability Layer, Transcript Ingestion, Consent & Retention

**Version:** 1.0.0
**Status:** PLANNING. Uses master default D1 (upload/paste + transcription of the workspace's own recordings; Meet/Zoom deferred). New decisions D10–D12 in §14.
**Date:** 2026-10-05
**Parent:** [`agents_mcp_phase_11_master_plan.md`](agents_mcp_phase_11_master_plan.md) §2.2 (B1–B4, B12), §5.7, §13 (P11-M1-T1…T5).
**Depends on:** M0 **T0** (persistent stores) and **T1** (governed gateway, after review fixes R1/R2) from [`agents_mcp_phase_11_milestone_0_plan.md`](agents_mcp_phase_11_milestone_0_plan.md). M1 does **not** need M0 T2–T7: it creates no L2+ agent mutations.
**Rules:** [`agents_mcp_rules.md`](../agents_mcp_rules.md) (Important 1–10 as amended, 11–69); [`.agents/AGENTS.md`](../../../.agents/AGENTS.md); `theme.md` §8.

**Documents reviewed for this milestone:**

| Document | Used for |
| --- | --- |
| Phase 11 master plan §2.2, §5.2, §5.3, §5.6, §5.7, §9 | Scope, trust matrix, capability contracts, budgets, ingestion design, risks |
| M0 plan v1.1 + [M0 interim code review](agents_mcp_phase_11_milestone_0_code_review.md) | Dependencies; R1 (namespaced idempotency) and R2 (default deps) must land first |
| `docs/meetings/meetings_prd.md` §25–27, §39–41, §58, §61, §96–98 | Recording/transcript/insight models; **PRD event names**; "large transcripts in object storage"; recording security (private storage, signed URLs, short expiry, access audit, retention); AI governance; **four independent consents** |
| `docs/meetings/meetings_ui.md` §30–33, Journey E | Intelligence and recording UX; transcript search; immutable activity timeline |
| `docs/feature_meetings.md` | Recording management today (external/YouTube URLs); meetings shared across workspaces (`workspaceIds`) |
| `agents_mcp_tools.md` Domain 6 | `meeting.*` tool list; consent and permission rule before ingestion/retrieval |
| `agents_mcp_prd.md` §27–28, §66–76 | Meeting ingestion source; permissions, sensitivity, injection defense, audit, retention, deletion |
| `agents_mcp_rules.md` (full) | §7 matrix |
| `docs/agentic/02, 04, 05, 08, 11` | `meetings_conversations` catalog; boundary validation; risk levels; untrusted isolation; trust classes |
| Genkit docs (Context7 `/websites/genkit_dev_js`, 2026-10-05) | Gemini audio input via `ai.generate` with a `media` part (`contentType` + URL); structured output via `output: { schema }` |

---

## 1. Goal

At the end of M1:
- Every meeting read used by agents and UI goes through governed `meeting.*` capabilities that prove the meeting belongs to the caller's workspace.
- Transcripts can enter SmartSapp safely: upload or paste, or transcription of the workspace's own recording.
  - Stored server-side only, in a model that scales past 1 MiB.
  - Gated by per-meeting consent.
  - Scanned for injection.
  - Removed on schedule by retention policy.
- The fabricated-transcript path and the recording/compliance security holes are gone.

**Non-goals:**
- Extraction, summaries, tasks, CRM proposals (M2).
- The Knowledge Inbox (M3).
- Large UI work (M5): M1 ships only the minimal "Add transcript" and consent controls needed to use the feature.
- Google Meet/Zoom provider transcripts (deferred, D1).

---

## 2. Verified Findings (code as of `b3771a0a`)

| # | Finding | Evidence | Severity |
| --- | --- | --- | --- |
| G1 | **`getMeetingRecordingsAction` and `attachMeetingRecordingAction` have no authentication.** Server Actions are public endpoints: anyone with a meeting id + workspace id can list recordings (media URLs, share tokens) or attach a recording to any meeting. | `src/app/actions/meeting-recording-actions.ts:27, 96` (only lines 126/156 call `requireWorkspace`) | **Critical** |
| G2 | **`saveWorkspaceCompliancePolicyAction` checks only `requireAuth()`.** Any signed-in user of any organization can overwrite any workspace's compliance policy (consent enforcement, retention, auto-purge). | `src/app/actions/meeting-compliance-actions.ts:62-69` | **Critical** |
| G3 | `convertActionItemToCrmTaskAction` doesn't verify the intelligence record's workspace (IDOR) and writes `tasks` directly via `adminDb`, bypassing the task core and gateway (Rule 69). | `meeting-intelligence-actions.ts:195-260` | High |
| G4 | `generateMeetingIntelligenceAction` **fabricates a transcript** when none exists (B1) and never checks the meeting's workspace (B2). `generateMeetingPrepBriefAction` has the same ownership gap. | `meeting-intelligence-actions.ts:39-150, 267-317` | High |
| G5 | `meeting_transcripts`, `meeting_intelligence`, `meeting_recordings` are client-writable by workspace members (B3). No client code writes them (verified). | `firestore.rules:755-768` | High |
| G6 | No production transcript source; only `seed-meetings-v2.ts` writes transcripts (B4). | grep | High |
| G7 | Transcript segments are stored inline; long meetings exceed 1 MiB (B12). The meetings PRD §26 already prescribes object storage for large transcripts. | `types/intelligence.ts:50-64`; PRD §26 | Medium |
| G8 | Recording "signed URL" = `mediaUrl + ?token=…&expires=…`. This is not a real signed URL; any `mediaUrl` (including arbitrary external URLs) is accepted. PRD §96 requires private storage, signed URLs and short expiry. | `meeting-recording-actions.ts:151-175` | High |
| G9 | No per-meeting consent record. The policy has only `enforceHostConsentForAI` (default off). PRD §98 requires independent `recordingConsent`, `transcriptionConsent`, `aiProcessingConsent`, `marketingConsent`. | `types/compliance.ts:13-18` | High |
| G10 | Retention is **evaluated, never enforced**: `evaluateRetentionPurgeAction` returns candidates; nothing deletes transcripts or recordings. | `meeting-compliance-actions.ts:121-150` | High |
| G11 | No `meeting.*` capability is registered: the `meetings_conversations` domain is empty in the registry. | `src/platform/domains/*` | High |
| G12 | Meetings are shared across workspaces (`workspaceIds[]`), and newer code also uses a scalar `workspaceId`. There's no shared ownership helper; checks are ad hoc. | `src/lib/types.ts:3641`; `feature_meetings.md` | Medium |
| G13 | Meeting intelligence calls the Gemini REST API directly (`?key=` in the URL), bypassing the AI gateway (`src/ai/genkit.ts`), model routing and residency checks. **Fixed in M2** (extraction capability); M1 removes only the fabricated fallback. | `meeting-intelligence-actions.ts:92-105` | Medium (M2) |

---

## 3. Functionality Preservation

| Area | Today | After M1 | Guarantee & proof |
| --- | --- | --- | --- |
| Recording list/attach in the meeting UI | Works (unauthenticated) | Same UI, now authenticated + ownership-checked | UI calls already pass the workspace id; the signed-in path is unchanged. Tests: member OK, other workspace refused, anonymous refused |
| External recordings (e.g. YouTube links) | Played via `mediaUrl` | Still play, labelled "External link"; never transcribed, never "signed" | Classification test; existing recordings untouched (no migration) |
| Uploaded recordings | Fake-token URL | Real 15-minute signed Storage URL | Playback test; access audit entry |
| Compliance page | Saves for anyone signed in | Saves for workspace admins (`meetings_compliance_manage` permission, default to workspace admins) | Parity test with role templates; Backoffice can grant without code |
| Meeting intelligence tab | Shows fabricated output when there's no transcript | Shows "Add a transcript to analyse this meeting" | Snapshot test; existing `meeting_intelligence` docs still display |
| Convert action item to task | Writes `tasks` directly | `task.create` through the gateway (same task fields + `origin`) | Same resulting task shape (contract test); IDOR closed |
| Prep brief | Works | Same output, ownership-checked | Existing tests + IDOR test |
| Existing transcripts (seed/legacy inline segments) | Read inline | Read by the v2 reader (inline legacy or segments subcollection) | Legacy-reader test; no migration needed |
| Meetings shared across workspaces | Ad hoc checks | One helper honours `workspaceIds[]` and scalar `workspaceId` | Both shapes tested |

**Deliberate behaviour changes:** no transcript → no intelligence (B1); compliance edits need a permission; external recordings can't be transcribed.

---

## 4. Design

### 4.1 Meeting ownership (G12)

`assertMeetingInWorkspace(meetingId, workspaceId)`, server-only:
- Loads the meeting.
- Passes when `workspaceIds` includes the workspace **or** the scalar `workspaceId` equals it.
- Otherwise throws `NOT_FOUND` (never reveals existence).

It's used by every capability's `resolveResourceScope` (gateway step 07), returning `{ resourceId, workspaceId, organizationId, resourceVersion: updatedAt }`.

### 4.2 Capabilities (domain `meetings_conversations`; all via `executeCapability`)

| Capability | Risk | Idempotency key (namespaced by gateway, M0 R1) | Notes |
| --- | --- | --- | --- |
| `meeting.search` | L0 | — | Workspace-scoped list; bounded (≤ 50); filters: date range, status, entity |
| `meeting.get` | L0 | — | Meeting + participants (minimal projection) |
| `meeting.list_recordings` | L0 | — | Signed URL generated on request only |
| `meeting.get_transcript` | L0 | — | Consent-checked (retrieval); paged segments (≤ 500 per page) |
| `meeting.ingest_transcript` | L1 | `mtg_tx_{meetingId}_{contentHash}` | Upload/paste; parse, scan, store; events below |
| `meeting.transcribe_recording` | L1 | `mtg_stt_{recordingId}_{recordingUpdatedAt}` | Enqueues the Cloud Task; returns the transcript id in `processing` |
| `meeting.record_consent` | L2, **human only, non-delegable** | `mtg_consent_{meetingId}_{type}_{version}` | Records/withdraws one of the four consents |
| `meeting.delete_transcript` | L2, human only | `mtg_txdel_{transcriptId}` | Manual deletion + cascade |

Legacy server actions delegate to these capabilities (Strangler Fig, same signatures).

### 4.3 Transcript storage v2 (G7, B12)

```text
meeting_transcripts/{transcriptId}
  workspaceId, organizationId, meetingId, recordingId?, source: 'upload'|'paste'|'recording',
  status: 'pending'|'processing'|'completed'|'failed', language, speakers[], wordCount,
  segmentCount, durationMs, contentHash (sha256 of normalized text), schemaVersion: 2,
  injection: { flagged: boolean, patterns: string[] }, provider? (transcription model + version),
  costUnits?, error?, createdBy, createdAt, completedAt?, updatedAt
meeting_transcripts/{transcriptId}/segments/{chunkIndex}   // ≤ 500 segments per doc
  index, segments: TranscriptSegment[]
```

- **Reader** `readTranscript(transcriptId, page)`: schema v2 → segments subcollection; legacy docs (no `schemaVersion`) → inline `segments`.
- **Writes:** batched ≤ 250 docs; header last (status `completed`), so readers never see partial content.
- **Events** (PRD §39): `transcript.processing_started`, `transcript.completed`, `transcript.failed`, `recording.processing_started`, `recording.processing_completed`, `transcript.deleted`.

### 4.4 Ingestion (G6)

- **Parsers** (pure, `src/lib/meetings/transcript-parsers.ts`, no new dependency):
  - VTT and SRT: timestamps, `<v Speaker>` voice tags, `Speaker: text` prefixes, multi-line cues.
  - TXT: `Speaker: text` lines, or untimed paragraphs.
  - DOCX: `mammoth` (already installed) → TXT parser.
  - Paste: TXT parser.
  - All normalize to `TranscriptSegment[]`.
- **Limits:** ≤ 5 MB text, ≤ 60k words, ≤ 4 h span; clear errors ("This file is larger than 5 MB. Split it and try again.").
- **Upload path:**
  1. The client uploads to `workspaces/{ws}/meetings/{meetingId}/transcripts/{uuid}.{ext}`. Storage rules: workspace members, ≤ 5 MB, allowed content types.
  2. The server action receives the `storagePath`, re-checks that the path prefix matches the workspace + meeting, reads, parses and ingests.
  3. The upload object is deleted after successful ingestion.
- **Speaker mapping:** match speaker names/emails to meeting participants (case-insensitive); unmatched speakers kept as labels; mapping editable later (M5).
- **Injection scan** (Rule 30): the existing `evaluateMemoryContentRisk` runs over segments. Flagged content is still stored as data with `injection.flagged = true`, which M2/M3 use to force human review. Raw text is never interpreted.
- **Duplicates:** the same `contentHash` for the same meeting → replay of the existing transcript (idempotent).

### 4.5 Recording transcription (D1)

- **Eligibility:** only recordings with a workspace Storage `storagePath` under `workspaces/{ws}/meetings/{meetingId}/recordings/`. External `mediaUrl` (YouTube etc.) → "This recording is an external link and can't be transcribed. Upload the file instead." (Rule 34: no URL fetching.)
- **Flow:** the capability enqueues a Cloud Task (`/api/tasks/meeting-transcription`, HMAC + OIDC like the other workers). The worker then:
  1. Re-checks consent, residency and quota.
  2. Creates a 15-minute signed URL.
  3. Calls `ai.generate` through the gateway (`getModel`, audio-capable Gemini tier) with a `media` part and `output.schema` = segments schema.
  4. Validates the output, then stores it (§4.3).
- **Limits:** ≤ 4 h audio, ≤ 500 MB. Longer audio is rejected with guidance. Chunking long audio is a follow-up if needed; **verify the current Gemini audio duration/size limits via Context7 at implementation**.
- **Resilience:** circuit breaker on the provider; retries with backoff (max 3); DLQ after that; idempotent per recording version; cancellable (a `cancelRequested` flag checked before the model call).
- **Residency/model gate** (Rule 57): the tenant's `allowedModels`/`allowedExternalProviders`/`region` are checked before any audio leaves SmartSapp. Disallowed → refused with a clear reason.
- **Metering:** `costUnits` (audio minutes) recorded per transcript; per-workspace daily cap (default 2 h, Backoffice-editable, master §5.6).

### 4.6 Consent (G9; PRD §98, tools Domain 6)

`meeting_consents/{meetingId}` holds one record per consent type: `recording`, `transcription`, `aiProcessing`, `marketing`. Each record has `{ granted, recordedBy, method: 'verbal'|'written'|'form'|'policy', at, withdrawnAt?, version }`.

Enforcement (only when the workspace policy `enforceHostConsentForAI` is on; when it's off, today's behaviour stands):

| Operation | Requires |
| --- | --- |
| Upload/paste transcript | `transcription` |
| Transcribe recording | `recording` + `transcription` |
| Read transcript for AI use (M2+) | `aiProcessing` |
| Human transcript view | Workspace permission only (consent governs processing, not viewing) |

- Withdrawing `transcription` or `aiProcessing` marks the transcript `restricted` for AI use and schedules M2-derived data for purge.
- Refusals are audited (`meeting.consent.refused`).

### 4.7 Retention (G10)

- The policy (`retentionPeriodDays`, `autoPurgeTranscripts`, `autoPurgeRecordings`) is enforced by a bounded purge job: ≤ 50 meetings per run, in the existing heartbeat cron (no new scheduler).
- **Cascade, dry-run first:**
  - Transcript header + segments, recording Storage objects + docs, `meeting_intelligence`.
  - A **`registerRetentionCascade(sourceType, handler)` hook** so M3 (inbox, memory, graph) attaches without changing M1.
- Every deletion is audited (`transcript.deleted`, `recording.deleted`, with reason `retention` | `manual` | `consent_withdrawn`).
- Legal hold: meetings flagged `legalHold` are skipped. The flag exists in the compliance types; enforce it.

### 4.8 Security fixes

| Finding | Fix |
| --- | --- |
| G1 | `requireWorkspace` + `assertMeetingInWorkspace` on list/attach. Attach accepts either a workspace Storage path (validated prefix) or an explicit external link (`kind: 'external_link'`). |
| G2 | `saveWorkspaceCompliancePolicyAction`: `requireWorkspace(policy.workspaceId)` + permission `meetings_compliance_manage` (new; default-granted to workspace admins) + audit of before/after. |
| G3 | Ownership check; task creation via `task.create` with `origin: { type: 'meeting_action_item', meetingId, actionItemId }` and idempotency key `mtg_task_{meetingId}_{actionItemId}`. |
| G4 | Ownership checks on both actions; remove the fabricated transcript (no transcript → `NO_TRANSCRIPT` result the UI renders). |
| G5 | Rules: `meeting_transcripts` (+ `segments`), `meeting_intelligence`, `meeting_recordings`, `meeting_consents` → client **write false**; reads unchanged (workspace members). |
| G8 | Real signed URLs (Storage `getSignedUrl`, 15 min) for uploaded recordings; access audit (`recording.accessed`); the share-token pseudo-URL is removed. |

---

## 5. Tasks (TDD, small local commits)

**Conventions:** same as M0.
- Failing test first; `pnpm typecheck` + `pnpm lint` + affected Vitest; commit locally; **no push unless asked**.
- `@fileOverview` + `// CAUTION:` comments; Zod at every boundary; no `any`/unchecked casts; OTel spans with correlation/causation ids.

### T0: Security hotfixes (G1, G2, G3, G4-IDOR) · Rules 8, 49, 51 · ship first, independently

| Step | Action | Files |
| --- | --- | --- |
| 0.1 | Tests: anonymous / other-workspace / member for list + attach recordings; compliance save by non-member, member without permission, admin; convert action item across workspaces; intelligence + prep brief across workspaces | `src/lib/__tests__/meetings/meeting-actions-security.test.ts` |
| 0.2 | `assertMeetingInWorkspace` helper (both shapes) + tests | `src/lib/meetings/meeting-access.ts` (new) |
| 0.3 | Guard the four actions; compliance permission `meetings_compliance_manage` (PR-2 `permission-refs`) default to workspace admins; before/after audit | recording, compliance, intelligence actions; `permission-refs.ts` |
| 0.4 | Run the strict server-action sweep; the unguarded count must not rise (baseline 477) and these actions must drop out of it | inventory script |

**Acceptance:** all security tests green; the sweep shows the actions guarded. *Deployable on its own; recommended to ship immediately (D12).*

### T1: Meeting capabilities & ownership (G11, G12) · Rules 12, 16, 47, 69

| Step | Action | Files |
| --- | --- | --- |
| 1.1 | Contract suites (`defineContractSuite`) for `meeting.search/get/list_recordings/get_transcript` (valid, invalid, wrong tenant → `NOT_FOUND`, revoked agent, payload too large) | `src/platform/__tests__/domains/meetings/*.test.ts` |
| 1.2 | `src/platform/domains/meetings_conversations/` contracts + registrar; `resolveResourceScope` via `assertMeetingInWorkspace`; output projections (no internal fields) | new domain folder |
| 1.3 | Add the registrar to `DOMAIN_REGISTRARS`; MCP `meetings` domain server lists them automatically (existing factory) | `register-capabilities.ts` |
| 1.4 | Legacy actions delegate to the read capabilities (same return shapes) | `meeting-recording-actions.ts`, `meeting-intelligence-actions.ts` |

### T2: Transcript storage v2 + server-only rules (G5, G7) · Rules 5, 9, 40, 49

| Step | Action | Files |
| --- | --- | --- |
| 2.1 | Tests: write/read 4 h (≈ 7,000 segments) transcript across chunk docs; legacy inline read; header written last (no partial reads); rules tests (member write denied on all four collections, member read allowed, anonymous denied) | storage + rules tests |
| 2.2 | `transcript-store.ts`: schema v2 (Zod), chunked writer (batches ≤ 250), paged reader, legacy adapter, status transitions | `src/lib/meetings/transcript-store.ts` (new) |
| 2.3 | `firestore.rules`: client writes → false for `meeting_transcripts` (+ `segments`), `meeting_intelligence`, `meeting_recordings`, `meeting_consents`; `storage.rules`: transcript/recording upload paths (member, size, content type) | rules files |
| 2.4 | Indexes: `meeting_transcripts` (workspaceId, meetingId, createdAt desc); `meeting_recordings` (workspaceId, meetingId) if missing; coverage test entries | `firestore.indexes.json`, index test |

### T3: Transcript ingestion (G6) · Rules 4, 9, 13, 19, 30, 31

| Step | Action | Files |
| --- | --- | --- |
| 3.1 | Parser tests: VTT (voice tags, multi-line cues, BOM, CRLF), SRT (numbering gaps, comma ms), TXT (speaker prefixes, untimed), DOCX (fixture via mammoth), paste; malformed → clear error; property tests (no throw on random input; monotonic timestamps) | `src/lib/__tests__/meetings/transcript-parsers.test.ts` |
| 3.2 | `transcript-parsers.ts` (pure; normalized `TranscriptSegment[]`) | new |
| 3.3 | `meeting.ingest_transcript` capability: consent gate, limits, parse, speaker mapping, injection scan, `contentHash` idempotency, store, events | domain folder |
| 3.4 | Upload server action: workspace/meeting path validation, read from Storage, delegate to the capability, delete upload | `meeting-transcript-actions.ts` (new) |
| 3.5 | Tests: injection-laced transcript stored with `flagged`; duplicate upload → same transcript; wrong path prefix → refused; 5 MB+ refused; 100 concurrent ingestions (load, Rule 9) | tests |

### T4: Recording transcription (D1) · Rules 23, 24, 25, 26, 34, 57, 58

| Step | Action | Files |
| --- | --- | --- |
| 4.1 | Context7: current Gemini audio limits (duration, size, formats) and Genkit `media` usage with signed URLs; record versions in the report | — |
| 4.2 | Tests (fake provider): eligible recording → transcript; external link refused; residency-disallowed refused; provider 429 → breaker + retry; 3 failures → DLQ; duplicate task delivery → idempotent; cancel before model call; quota exceeded → clear message; invalid model output → failed (no partial transcript) | `src/platform/__tests__/meetings/transcription.test.ts` |
| 4.3 | `meeting.transcribe_recording` capability (enqueue) + worker route (HMAC + OIDC, dead-man check, 503 semantics like the workflow worker) | domain + `src/app/api/tasks/meeting-transcription/route.ts` |
| 4.4 | Transcription service via `src/ai/genkit.ts` (`getModel` audio tier), structured segments schema, signed URL ≤ 15 min, cost metering | `src/lib/meetings/transcription-service.ts` (new) |

### T5: Per-meeting consent (G9) · Rules 17, 21, 40, 57

| Step | Action | Files |
| --- | --- | --- |
| 5.1 | Tests: enforcement off → today's behaviour; on → each operation needs its consent; withdrawal restricts AI use; agents can't record consent (non-delegable); audit entries | consent tests |
| 5.2 | `meeting_consents` model + `meeting.record_consent` capability + `consent-gate.ts` used by ingest/transcribe/get_transcript | domain + `src/lib/meetings/consent-gate.ts` |

### T6: Retention enforcement (G10) · Rules 9, 25, 40, 57

| Step | Action | Files |
| --- | --- | --- |
| 6.1 | Tests: dry run lists exactly what would be deleted; run deletes transcript + segments + recording object + doc + intelligence; legal hold skipped; bounded per run; re-run idempotent; cascade hook invoked with `sourceId` | retention tests |
| 6.2 | `retention-service.ts` + `registerRetentionCascade` hook; heartbeat cron step (≤ 50 meetings per run); audit | `src/lib/meetings/retention-service.ts`, heartbeat route |

### T7: Fail-closed intelligence + real signed playback (G4-B1, G8) · Rules 21, 41, 47

| Step | Action | Files |
| --- | --- | --- |
| 7.1 | Tests: no transcript → `NO_TRANSCRIPT`, no model call, nothing stored; uploaded recording → real signed URL (15 min) + access audit; external link → returned as an external link (unsigned, labelled) | tests |
| 7.2 | Remove the fabricated transcript; read via `readTranscript`; keep the current extraction call until M2 replaces it (G13) | `meeting-intelligence-actions.ts` |
| 7.3 | `generateRecordingPlaybackUrlAction` → Storage signed URL; remove the pseudo-token | `meeting-recording-actions.ts` |

### T8: Minimal UI (theme.md §8, mobile-first) · Rules 7, 52

| Step | Action | Files |
| --- | --- | --- |
| 8.1 | Meeting Intelligence tab: an empty state "Add a transcript to analyse this meeting" with **Upload file** / **Paste text** / **Transcribe recording** (only when an eligible recording exists); status chip (Processing / Ready / Failed + retry); actionable toasts | `MeetingIntelligenceTab.tsx`, new `AddTranscriptModal.tsx` |
| 8.2 | Consent row (4 toggles, who/when) shown when enforcement is on; plain one-line copy | meeting detail component |
| 8.3 | Compliance page: disable Save for users without the permission (server still enforces) | `ComplianceClient.tsx` |
| 8.4 | Mobile checks at 375/768/1280; ≥ 44 px; bottom sheet on phones | UI tests |

### T9: Verification & completion · Rules 42–46, 67

| Step | Action |
| --- | --- |
| 9.1 | Emulator E2E: upload → ingest → read paged; transcribe (fake provider) → completed; consent on/off; retention purge |
| 9.2 | Red team: anonymous recording list, cross-workspace transcript read, path-traversal upload path, foreign bucket path, injection transcript, forged client write, consent bypass by agent |
| 9.3 | Chaos: provider 429/500/timeout, malformed model output, duplicate task delivery, Firestore contention on chunk writes |
| 9.4 | Load: 100 concurrent ingestions; 20 concurrent transcriptions (queue concurrency respected) |
| 9.5 | Rule 67 gate answers + completion report (test names; CI run IDs once pushed) |

---

## 6. Ordering

```text
(M0 T0, T1 + R1/R2 fixes)
   │
   T0 security hotfixes ──► (can ship alone)
   │
   T1 capabilities ─► T2 storage/rules ─► T3 ingestion ─► T4 transcription
                                  └────► T5 consent (gates T3/T4 before they're enabled)
                                  └────► T6 retention
   T7 (after T2) · T8 (after T3/T5) · T9 last
```

Feature flags: `FF_MEETING_TRANSCRIPTS` (upload/paste) and `FF_MEETING_TRANSCRIPTION` (recordings) at global/org/workspace, default **off** until T9 passes. T0 security fixes ship unflagged.

---

## 7. Rules Conformance Matrix

### 7.1 Important Rules 1–10

| Rule | M1 conformance | Verified by |
| --- | --- | --- |
| 1 | Skills: `next-best-practices`, `backend-patterns`, `vercel-react-best-practices`, `frontend-design`, `emilkowal-animations` (T8), `firebase-security-rules-auditor`, `cybersecurity-analyst`, `firebase-ai-logic`, `test-driven-development`, `verification-before-completion`; preservation §3; tracker §15 | Review checklist |
| 2 | Risks §10; TDD; local typecheck/lint/commit; no push until asked | Commit log |
| 3 | Affected features §12; Backoffice §13 | Backoffice E2E |
| 4 | Zod for uploads, parsed segments, model output, Cloud Task payloads, Firestore reads; no casts | Lint + review |
| 5 | Rules/storage rules/indexes emulator-tested; staging = production project (D5) → written approval per deploy | Approval record |
| 6 | No new dependencies (`mammoth` present; parsers in-house); Context7 checked for Genkit audio (§2 header), re-checked at T4.1 | Report |
| 7 | Minimal UI with plain short copy, ≥ 44 px, bottom sheets on phones, theme.md §8 modals, reuse existing tab/components | Viewport tests |
| 8 | Fixes G1–G5, G8; red team T9.2 | Security suite |
| 9 | Size/word/duration caps; chunked writes ≤ 250; paged reads; bounded purge; queue concurrency; quotas; edge cases §10.2 | Load tests |
| 10 | `@fileOverview` + `// CAUTION:` at ownership, consent, retention, storage-path code | Review |

### 7.2 Rules 11–69

| Rule | M1 conformance |
| --- | --- |
| 11, 35–38 | New tools served by the existing v2 Streamable HTTP `meetings` domain server; no deprecated MCP features; discovery cache unchanged |
| 12 | Risk enforced server-side (consent + human-only for L2) |
| 13 | Transcripts, uploads, model transcription output = untrusted customer/model data |
| 14 | New tools fingerprinted by the existing factory |
| 15 | N/A: no external MCP servers |
| 16 | Live standing via M0 T1 defaults |
| 17 | `meeting.record_consent`, `meeting.delete_transcript` non-delegable |
| 18 | Consent records versioned; transcript status transitions version-checked |
| 19, 20 | Keys per §4.2 (namespaced by the gateway); duplicate task delivery idempotent |
| 21, 22 | No L3 actions in M1; L2 consent/delete are direct human actions (not agent proposals) |
| 23 | Transcription quotas, duration/size caps, queue concurrency |
| 24, 25, 26 | Provider breaker; retries → DLQ; cancel before the model call |
| 27 | Compensation: a failed transcription leaves no partial transcript (header-last write); a failed ingestion deletes written chunks |
| 28, 56 | N/A: no context assembly in M1 (M2/M4) |
| 29 | N/A: memory facts not created in M1 (M3) |
| 30 | Injection scan + `flagged` marker; content never interpreted |
| 31, 47, 48 | Model transcription output → schema → business checks (monotonic timestamps, non-empty text, duration within the recording) → store |
| 32, 33 | Only egress: audio to an allowed provider via a short-lived signed URL, after the residency gate |
| 34 | No URL fetching; Storage paths validated against the workspace/meeting prefix |
| 39 | Spans: ingest, parse, scan, store, enqueue, transcribe, purge |
| 40 | Audit: consent changes, deletions, recording access, compliance policy changes |
| 41 | Transcript header records source, provider and model version |
| 42 | Transcription can run with `dryRun` (validates eligibility/consent/quota, no provider call) |
| 43 | Provider/model version, prompt version, input hash stored |
| 44, 45, 46 | Fake provider; chaos T9.3; red team T9.2 |
| 49 | Transcripts/recordings never public; signed URLs only |
| 50 | No caching of transcript content across requests |
| 51 | Every new/changed action: `'use server'` + auth + permission + ownership |
| 52 | Parsers that run in the browser (none planned) would be browser-safe; server modules `import 'server-only'` |
| 53 | No new dependencies |
| 54 | Budgets: parse ≤ 1 s for 60k words; ingest p95 ≤ 4 s (excluding upload); transcript page read ≤ 300 ms |
| 55 | N/A: no graph UI |
| 57 | Residency gate before transcription; retention enforced |
| 58 | Audio model via `getModel` (gateway routing and fallbacks) |
| 59 | N/A: no planner |
| 60 | Flags + dead-man check in the worker |
| 61, 62, 63 | Backoffice §13; security feed: anonymous access blocked, consent refusals, path violations; runbook: transcription backlog/provider outage |
| 64, 65 | Two flags at three levels; canary after T9 |
| 66 | Phase 4 gates (retention, deletion, sensitivity) for transcripts; Phase 7 (retry, DLQ, cancel) for transcription |
| 67, 68, 69 | Gate §9; non-negotiables (model not the boundary, untrusted output, idempotent/auditable writes, bounded resources, operable without code); all behaviour behind capabilities |

---

## 8. Test Plan Summary

| Layer | Suites |
| --- | --- |
| Unit | parsers (incl. property tests), ownership helper, consent gate, transcript store, retention planner |
| Contract | `meeting.*` capabilities via `defineContractSuite` |
| Integration (emulator) | chunked storage, rules + storage rules, signed URLs, purge cascade |
| E2E | upload → ingest → read; transcribe → completed; consent; retention |
| Security | §9.2 red team; server-action sweep |
| Chaos / load | §9.3, §9.4 |

---

## 9. Implementation Gate (Rule 67)

```text
ARCHITECTURE  Capabilities §4.2; reuse transcript-service, compliance-service, mammoth, AI gateway,
              Cloud Tasks worker pattern; SoT Firestore + Storage. Events: transcript.processing_started,
              transcript.completed, transcript.failed, transcript.deleted, recording.processing_started,
              recording.processing_completed, recording.accessed, meeting.consent.recorded/refused.
AUTHORITY     meetings view/manage permissions; meetings_compliance_manage; agents: L0 reads + L1 ingest/
              transcribe only; never consent or delete.
DATA          In: files, pasted text, audio. Out: audio to an allowed model provider (signed URL, 15 min).
              Untrusted: all transcript content and model output. Sensitive: transcripts (restricted
              when consent is withdrawn).
EXECUTION     Idempotent keys; retries; cancel; header-last writes; duplicate delivery safe.
MCP           Existing v2 meetings domain server; fingerprints; no deprecated features.
FAILURE       Provider 429/500/timeout → breaker/retry/DLQ; malformed output → failed, nothing stored;
              oversize → refused with guidance; consent missing → refused + audited.
SECURITY      G1/G2 closed; IDOR closed; path validation; injection flagged; no URL fetch; signed URLs.
OPERATIONS    Flags; quotas; DLQ reprocess; purge dry-run; all from Backoffice.
TESTING       Unit · contract · integration · E2E · rules · security · chaos · load.
MIGRATION     No data migration (legacy transcript reader); external recordings preserved; rollback = flags off.
N/A           15, 28, 29, 55, 56, 59 (reasons in §7.2).
```

---

## 10. What Could Go Wrong & Edge Cases

### 10.1 Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | The hotfixes break a screen that relied on unauthenticated calls | UI already passes workspace ids; tests for the member path; sweep |
| R2 | Admins can't change compliance after the permission change | Default-grant to workspace admins; parity test; Backoffice grant |
| R3 | Transcription cost spikes | Per-workspace daily cap; metering; flag default off; canary |
| R4 | Poor transcription quality (accents, crosstalk, Twi/English mix) | Confidence kept per segment; speaker mapping editable; low-confidence spans excluded from M2 auto-actions |
| R5 | Long audio exceeds provider limits | Caps + clear message; verify limits at T4.1; chunking follow-up |
| R6 | Rules tightening breaks a writer | Verified no client writers; rules tests; written approval |
| R7 | Consent enforcement blocks teams unexpectedly | Only when the workspace turns it on; clear refusal copy with an action path to the consent row |
| R8 | Retention deletes something wanted | Dry run first; legal hold honoured; audit; Backoffice shows the next purge list |
| R9 | Storage upload abuse | Size/content-type rules; path validation; quota |

### 10.2 Edge cases (expected behaviour defined up front)

| Case | Expected |
| --- | --- |
| Empty or whitespace transcript | Refused: "This file has no transcript text." |
| VTT without speakers | Single "Speaker 1"; editable later |
| Overlapping/unsorted timestamps | Sorted; overlaps kept; property test |
| Non-UTF-8 file | Refused with guidance |
| Same transcript uploaded twice | Same transcript returned (idempotent) |
| Meeting shared across two workspaces | Both may read; ingest records the uploading workspace |
| Meeting deleted mid-transcription | Worker stops; transcript marked failed (`meeting_deleted`) |
| Consent withdrawn mid-transcription | Worker re-checks before the model call and before storing; refuses |
| Recording deleted before the task runs | Task fails cleanly; nothing stored |
| Provider returns segments beyond the recording duration | Business validation rejects; transcript failed |
| 7,000+ segments | Chunked across 14+ docs; header last |
| Retention run overlaps a manual delete | Idempotent; both audited once |
| Workspace has no compliance policy doc | Defaults (enforcement off, no auto-purge), today's behaviour |

---

## 11. UX Notes (Rule 7)

- **Copy:** "Add transcript", "Upload file", "Paste text", "Transcribe recording", "Processing…", "Ready", "Couldn't process this file. Try again."
- **Layout:** guidance in `CardInfoTooltip`; modals per theme.md §8 (demarcated header/footer); bottom sheet on phones; ≥ 44 px targets.
- **Feedback:** progress chip with retry; actionable toasts (relative `actionConfig.path`).
- No new pages in M1.

---

## 12. Affected Features (Rule 3)

| Feature | Effect |
| --- | --- |
| Meeting detail (recordings, intelligence tab, action items drawer) | Authenticated/ownership-checked; empty state replaces fake intelligence; add-transcript flow |
| Compliance page | Permissioned save; retention now enforced |
| Tasks | Tasks from action items via `task.create` with `origin` |
| MCP v2 `meetings` domain | New read/ingest tools listed |
| Firestore + Storage rules | Server-only writes; upload paths |
| Heartbeat cron | Retention purge step (bounded) |
| Backoffice meetings-monitor | Transcription queue, DLQ, quotas |

---

## 13. Backoffice (operable without code)

`meetings-monitor` gains:
- The transcription queue and DLQ with **Reprocess**.
- Per-workspace usage and caps.
- Consent refusals.
- The next retention purge list (dry run) with a **Run now** button (permissioned).

Flags `FF_MEETING_TRANSCRIPTS` and `FF_MEETING_TRANSCRIPTION` live in `features`. Permission grants (`meetings_compliance_manage`) live in roles.

---

## 14. Deployment & Decisions (Rule 5)

Nothing below happens without explicit approval:

| # | Change |
| --- | --- |
| I7 | `firestore.rules` (server-only meeting collections) + `storage.rules` (upload paths) |
| I8 | New indexes (T2.4) |
| I9 | Code deploy: **T0 hotfixes first** (D12), then flagged features after T9 |

| # | Decision | Recommended |
| --- | --- | --- |
| D10 | Default holders of `meetings_compliance_manage` | Workspace admins |
| D11 | Default daily transcription cap per workspace | 2 hours (Backoffice-editable) |
| D12 | Ship T0 security hotfixes ahead of the rest of M1 (and before finishing M0)? | **Yes**: G1/G2 are live exposures |

---

## 15. Tracker

| ID | Task | Steps | Status | Evidence |
| --- | --- | --- | --- | --- |
| P11-M1-T0 | Security hotfixes | 0.1–0.4 | ☐ | |
| P11-M1-T1 | Meeting capabilities & ownership | 1.1–1.4 | ☐ | |
| P11-M1-T2 | Transcript storage v2 + rules | 2.1–2.4 | ☐ | |
| P11-M1-T3 | Transcript ingestion | 3.1–3.5 | ☐ | |
| P11-M1-T4 | Recording transcription | 4.1–4.4 | ☐ | |
| P11-M1-T5 | Per-meeting consent | 5.1–5.2 | ☐ | |
| P11-M1-T6 | Retention enforcement | 6.1–6.2 | ☐ | |
| P11-M1-T7 | Fail-closed intelligence + signed playback | 7.1–7.3 | ☐ | |
| P11-M1-T8 | Minimal UI | 8.1–8.4 | ☐ | |
| P11-M1-T9 | Verification & report | 9.1–9.5 | ☐ | |

**Mapping to the master plan:** P11-M1-T1 → T1 (+T0 IDOR); P11-M1-T2 → T2, T3; P11-M1-T3 → T4; P11-M1-T4 → T5, T6; P11-M1-T5 → T7 + T2.3. New: T0 (G1/G2 found in review), T8, T9.

---

## 16. Next Step

1. Free disk space (≈ 275 MB free at planning time).
2. Confirm D10–D12.
3. Finish the M0 review fixes (R1/R2) and commit M0 T1.
4. Then start **M1 T0** (security hotfixes) with its failing tests.
