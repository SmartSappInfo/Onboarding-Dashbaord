# Phase 11 · Milestone 1: Completion Report

**Date:** 2026-10-05 · **Plan:** [`agents_mcp_phase_11_milestone_1_plan.md`](agents_mcp_phase_11_milestone_1_plan.md) v1.1 · **Status:** code complete locally, **not pushed, not deployed**

**Decisions applied (recommended defaults):**
- D10: compliance edits use the existing `meetings_manage`.
- D11: 120 minutes per workspace per day.
- D12: security hotfixes first.
- D13: retention starts in preview-only (shadow) mode.

## 1. Commits (local, `main`)

| Commit | Task |
| --- | --- |
| `4acf167a` | **M0 · T1** governed gateway defaults + review fixes R1 (tenant-namespaced idempotency), R2 (undefined → default), and a claimant-only lease fix found during the work |
| `795a1c41` | **M1 · T0** security hotfixes (G1, G2, G3, G4) |
| `aed768a4` | **T1** `meeting.*` read capabilities on a shared read service |
| `ba64d86c` | **T2** transcript storage v2, server-only rules, `meeting.get_transcript` |
| `79e7db0d` | **T3 + T5** ingestion (VTT/SRT/TXT/DOCX/paste) and per-meeting consent |
| `45a78397` | **T7** fail-closed intelligence + real signed playback |
| `52740087` | **T6** retention (shadow first), legal hold, bound previews |
| `4a060054` | **T4** recording transcription behind data policy, consent and quota |
| `eaec957e` | **T8** honest intelligence tab, add-transcript flow, consent + retention controls |
| `1887a7fe` | **T9** Backoffice control plane + runbook |

## 2. Verification (2026-10-05)

- `pnpm typecheck`: **0 errors**.
- Full Vitest run: **1,039 files / 7,909 tests passed** (164 skipped = emulator-only suites, unchanged).
- ESLint clean on every touched file.

## 3. Tracker

| ID | Status | Evidence |
| --- | --- | --- |
| P11-M1-T0 | ✅ | `meeting-actions-security.test.ts`; sweep baseline 477 → 475 |
| P11-M1-T1 | ✅ | `meetings-conversations.test.ts` (contract suites, NOT_FOUND masking, no URL leakage, MCP JSON Schema, fingerprints, tool-selection guard) |
| P11-M1-T2 | ✅ | `transcript-store.test.ts` (4 h transcript, header-last, compensation, legacy reader); `meeting-knowledge.rules.test.ts` (runs in CI) |
| P11-M1-T3 | ✅ | parsers (property tests), DOCX guard (zip bomb, lying headers), ingest (concurrency, 100 parallel), upload, actions |
| P11-M1-T4 | ✅ with limit | `ai-data-policy.test.ts`, `transcription-service.test.ts` (fake provider). Inline audio ≤ 14 MB (see §4) |
| P11-M1-T5 | ✅ | `consent-store.test.ts`, `meetings-consent.test.ts` |
| P11-M1-T6 | ✅ | `retention-service.test.ts` |
| P11-M1-T7 | ✅ | intelligence/playback cases in the security suite |
| P11-M1-T8 | ✅ | `meeting-transcript-ui.test.tsx`, `meetings-boundary.test.ts` |
| P11-M1-T9 | ✅ | `backoffice-meeting-ops-actions.test.ts`; `docs/runbooks/meetings-transcription.md` |
| P11-M1-T10 | ◐ | Unit/contract/integration/red-team/chaos/load done with fakes. **Not done:** Firestore-emulator E2E and rules run locally (local Java 11; emulator needs 21; the rules suite runs in CI), browser verification (needs a real signed-in session on the production project) |

## 4. Additional defects found and fixed during execution

| Defect | Fix |
| --- | --- |
| Gateway failed the idempotency lease of an **in-flight** call when a duplicate was refused, so a third call could re-run the operation | Only the claimant completes or fails a lease (`4acf167a`) |
| `meeting_compliance_policies` was **publicly readable** and member-writable, bypassing the server check | Server-only rules (`ba64d86c`) |
| Intelligence action invented the **entire record** (fake quotes as buying signals) when the AI call failed | Fail closed (`45a78397`) |
| UI showed a hard-coded "Ask AI" answer, a fixed "88% intent" banner, a fixed coach card, and claimed outcomes were logged to the CRM | Removed; real computed data only (`eaec957e`) |
| Action-item conversion created duplicate tasks on double-click and wrote `tasks` directly | Transactional claim + task core (`795a1c41`) |
| `evaluateRetentionPurgeAction` read every meeting unbounded | Shared bounded planner (`52740087`) |
| Compliance save overwrote the whole document, wiping fields it didn't own | Merge of page fields + history (`795a1c41`) |
| Concurrent identical uploads could delete each other's chunks | Header created inside the claim transaction (`79e7db0d`) |
| Gemini API key sent in the URL query | `x-goog-api-key` header (`45a78397`) |
| CRM agent matrix referenced a non-existent `meetings.transcript.get` | Aligned and guarded by a test (`ba64d86c`) |

## 5. Deviations from the plan (with reasons)

- **No 7th MCP domain:** meetings are served by the existing `knowledge` domain server (MCP has 6 domains).
- **Reads stay membership-based in the UI:** the legacy permission list has no meetings-view permission; requiring one would lock out legacy roles. UI and capabilities share one read service.
- **`meeting.delete_transcript`, `set_legal_hold`, `update_compliance_policy`, `run_retention`** are human-only Server Actions / Backoffice actions, not agent capabilities. That makes them non-delegable by construction; each is authorized, version- or preview-bound, and audited.
- **`meeting.ingest_transcript` is on by default** (internal data only, no external side effect); **`meeting.transcribe_recording` is off by default** (audio leaves SmartSapp). The plan had both off.
- **Inline audio ≤ 14 MB:** Gemini allows ≤ 20 MB per inline request and base64 adds a third (Context7, 2026-10-05). Larger files need the Gemini Files API, a follow-up (needs tenant-key resolution outside `getModel`).
- **Legal hold** is a field on meetings set via an action (the field did not exist before).

## 6. Red-team coverage (Rule 46)

| Attack | Covered by |
| --- | --- |
| Anonymous recording list/attach | `meeting-actions-security.test.ts` |
| Cross-workspace meeting/transcript/consent/recording access | security, `meetings-conversations`, `transcript-store`, `consent-store`, `retention-service` tests |
| Forged workspace id in input | `meetings-ingest.test.ts` (TENANT_SCOPE_VIOLATION) |
| Path traversal / foreign bucket path | `transcript-upload`, security tests |
| DOCX zip bomb / lying ZIP headers / encrypted | `docx-guard.test.ts` |
| `javascript:` / `http:` / credentialed links | security tests |
| HTML/script in transcripts | parsers (stripped) + UI test (rendered as text) |
| Prompt injection in transcripts/audio | ingest + transcription tests (stored, flagged, labelled untrusted) |
| Forged client writes | `meeting-knowledge.rules.test.ts` (CI) |
| Agent consent bypass / agent signed URLs | `meetings-ingest`, `meetings-consent`, `meetings-conversations` tests |
| Stale approvals (retention, delete, policy) | retention, actions, Backoffice tests |
| Lying MCP annotations | `meetings-conversations.test.ts` |
| Duplicate task delivery / provider 429 / malformed output / cancel / consent withdrawn mid-run / TOCTOU | `transcription-service.test.ts` |

## 7. Needs your approval before anything ships (Rule 5)

Nothing is deployed. Staging is the production project (D5), so each item needs written approval:

| # | Item |
| --- | --- |
| I7 | `firestore.rules`: server-only meeting collections; compliance policy no longer public |
| I8 | 6 new composite indexes in `firestore.indexes.json` |
| I9 | Code deploy: **T0 hotfixes are the urgent part** (G1, G2 are live exposures) |
| I10 | Cloud Tasks queue `meeting-transcription-queue` (concurrency 20, max attempts 3) |
| I11 | Confirm the bucket CORS (`cors.json`) is applied, for browser uploads |
| I12 | Enabling `meeting.transcribe_recording` per workspace (flag), then canary |

## 8. Follow-ups (not in M1)

- Gemini Files API path for audio > 14 MB.
- M0 remaining: R3 (audit tail truncation), T0.9 (TTL/retention for newly persisted collections), T2–T7; decisions D5–D9.
- Spawned tasks: fake-success fallbacks in 10 capabilities; hard-coded Backoffice meeting telemetry.
- Other unguarded meeting actions still in the sweep baseline (e.g. `endMeetingAction`, `deleteRegistrantAction`).
- `pdf-actions.ts` issues 1-year signed URLs with a public fallback.
- Prep brief still uses casts and template text (M2 with extraction).
- Local disk: `.next` is 12 GB; free space keeps falling under 1 GB.
