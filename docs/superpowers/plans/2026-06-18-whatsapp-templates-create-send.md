# WhatsApp Templates: Create → Send Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `executing-plans` (or `subagent-driven-development`) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. **TDD is mandatory** (`test-driven-development`): write the failing test, watch it fail, then implement. **Verification gate** (`verification-before-completion`): no task is "done" until its command shows 0 failures.
>
> **Build/test/lint/commit are run by the human, locally.** Do NOT run `next build`, `tsc`, `vitest`, `eslint`, or `git commit` from the agent. Each phase ends with the exact commands the human runs + the commit message.

**Goal:** Let an org admin author WhatsApp templates in-app, verify the full create→approve→adopt→send loop against a live number, keep template status in sync automatically, and extend authoring to buttons/media — without regressing the existing messaging stack.

**Architecture:** Pure domain logic (parse/build/validate) in `whatsapp-domain.ts` (no I/O, fully unit-tested) → server actions (`'use server'`, auth-inside via `requireOrgAdmin`) → thin Meta client methods → client components that are dynamically imported and state-minimal. The webhook route acks fast and processes in `after()`.

**Tech Stack:** Next.js (App Router, Server Actions), React 18, Firebase Admin SDK, Zod, Vitest, Meta Graph API v21.0.

---

## Cross-Cutting Standards (the code-review of the approach)

These apply to **every** phase. They are the result of reviewing the original a/b/c sketch against `next-best-practices`, `vercel-react-best-practices`, and `frontend-design`.

| Rule (skill) | How this plan complies |
|---|---|
| `server-auth-actions` | Every new server action calls `requireOrgAdmin(idToken, orgId)` as its first statement before any I/O. No action trusts client-passed identity. |
| `bundle-dynamic-imports` | `WhatsAppTemplatePanel` stays `next/dynamic`. The media-upload UI (Phase C) is its own `next/dynamic` chunk, loaded only when a media header is chosen (`bundle-conditional`). |
| `rerender-derived-state-no-effect` | Builder param/example state is **derived during render**, not synced via `useEffect`. (Phase 0 refactors the version I already shipped.) |
| `rerender-no-inline-components` | Dialog components are declared at module scope, never inside a parent's render. |
| `rerender-functional-setstate` | All multi-field updates use functional `setState`. |
| `client-localstorage-schema` | Any localStorage payload carries a `v` schema version and stores only minimal fields. (Phase 0 retrofits the credential-form draft.) |
| `after()` route handlers (Next) | The webhook returns `200` immediately and does template-status work in `after()`, like the existing message/status path. |
| Node runtime | Webhook + actions stay on Node runtime (they use `crypto` / firebase-admin). No Edge. |
| `frontend-design` | Builder gets a live WhatsApp-bubble preview, inline validation, character counters, `htmlFor`/`aria-invalid` accessibility. Distinctive but consistent with the QR-Studio theme already in the panel. |
| TDD | Pure functions get tests first. UI gets a render/interaction smoke test where practical; server actions get a unit test with a mocked Meta client + repo. |
| DRY / YAGNI | Reuse `whatsapp-send` builders for the test-send (don't fork a second send path). Don't build media upload until Phase C actually needs it. |

**Local verification commands (human runs after each phase):**
```bash
npx vitest run src/lib/whatsapp/__tests__/ src/lib/auth/__tests__/
npm run typecheck     # or: npx tsc --noEmit
npm run lint
npm run build         # only before deploy, not per-task
```

---

## Phase 0 — Harden what already shipped (debt paydown before new features)

Two pieces already merged in this session need to meet the standards above before we build on them. `code-refactoring`: clean before adding features.

### 0.1 Version + slim the credential-form localStorage draft (`client-localstorage-schema`)
The draft persistence in `WhatsAppCredentialForm.tsx` writes raw JSON with no version key. A future field rename would deserialize stale/garbage into the form.

- [ ] Write failing test for a pure `serializeDraft`/`parseDraft` pair (new `whatsapp-draft.ts`): round-trips, and `parseDraft` returns `null` when `v` is missing or mismatched.
- [ ] Implement `whatsapp-draft.ts` with `const DRAFT_VERSION = 1` and `{ v, wabaId, phoneNumberId, displayPhoneNumber, businessName, appSecret }`. (Keep excluding the access token.)
- [ ] Refactor `WhatsAppCredentialForm.tsx` to use these helpers; drop draft when `v` mismatches.
- [ ] Verify tests pass.

### 0.2 Remove the derived-state effect in the template builder (`rerender-derived-state-no-effect`)
`CreateTemplateDialog` currently syncs `examples` to `paramCount` via `useEffect`. Derive during render instead.

- [ ] Refactor: store examples as `Record<number, string>` (keyed by param index); render `Array.from({ length: paramCount })` and read `examples[i] ?? ''`. No effect. `bodyExample` for submit = map indices `1..paramCount`.
- [ ] Add accessibility: `id`/`htmlFor` on every Label/Input pair; `aria-invalid` + `role="alert"` on the name error.
- [ ] (No new behavior — covered by Phase A's interaction test.)

**Commit:** `refactor(whatsapp): version cred-draft + derive builder state (no effect)`

---

## Phase A — Verify create→send end-to-end + reusable test-send

**Goal:** prove the loop works on the live number, and leave behind a one-click "Send test" so re-verifying is trivial. Highest value, lowest risk.

**Files:** `src/lib/whatsapp-actions.ts` (+1 action), `src/lib/whatsapp/__tests__/whatsapp-actions-testsend.test.ts` (new), `WhatsAppTemplatePanel.tsx` (button + dialog, module-scope).

### A.1 `sendWhatsAppTestMessage` server action (reuses existing send builders — DRY)
- [ ] Failing test: with a mocked `MetaCloudApiClient` + creds repo, asserts it (1) rejects when not org admin, (2) builds a **template** payload via `buildTemplatePayload` for an APPROVED template, (3) returns the `metaMessageId`.
- [ ] Implement: `requireOrgAdmin` → load creds → Zod-validate `{ organizationId, templateName, language, to, params }` → `buildTemplatePayload` → `client.sendMessage`. No new send logic.
- [ ] Verify tests pass.

### A.2 "Send test" UI on APPROVED templates
- [ ] Add a `SendTestDialog` (module scope) opened from each APPROVED card: recipient (E.164) + one input per `paramCount`. Calls `sendWhatsAppTestMessage`.
- [ ] `frontend-design`: show a live WhatsApp-bubble preview that substitutes the entered params into the body text as the user types (derived during render).
- [ ] Toast success with the wamid; destructive toast on Meta error.

### A.3 Manual end-to-end verification (human, with the live number)
- [ ] Create `order_update` (`{{1}}`,`{{2}}`) → confirm it shows PENDING.
- [ ] After Meta approval, **Sync from Meta** → confirms APPROVED.
- [ ] **Adopt** → map params → confirm a `MessageTemplate (channel: whatsapp)` appears.
- [ ] **Send test** to a real number → message arrives; webhook flips status sent→delivered→read on the `MessageLog`.

**Commit:** `feat(whatsapp): in-app test-send for approved templates`

---

## Phase B — Template-status webhook (auto-sync approval state)

**Goal:** when Meta approves/rejects/pauses a template (or recategorizes it), the local mirror updates without a manual Sync.

**Why a new path:** the webhook resolves org via `getByPhoneNumberId`; template events carry a **WABA** context with no phone-number id, so they need a WABA→org lookup and a different change `field`.

**Files:** `whatsapp-credential-repository.ts` (+`getByWabaId`), `whatsapp-template-repository.ts` (+`updateStatusByMetaId`), `whatsapp-domain.ts` (+`parseTemplateStatusEvent`), `app/api/webhooks/whatsapp/route.ts` (new branch), tests for the parser + a route test, `firestore.indexes.json` (wabaId).

### B.1 Pure parser (TDD)
- [ ] Failing test for `parseTemplateStatusEvent(change)` covering `message_template_status_update` (APPROVED/REJECTED w/ reason) and `template_category_update`.
- [ ] Implement (sketch):
```ts
export interface TemplateStatusEvent {
  metaTemplateId: string;
  name: string;
  language?: string;
  status: WhatsAppTemplateStatus;
  rejectedReason?: string;
  category?: WhatsAppTemplateCategory;
}
export function parseTemplateStatusEvent(change: unknown): TemplateStatusEvent | null { /* ... */ }
```
- [ ] Verify tests pass.

### B.2 Repository methods
- [ ] `WhatsAppCredentialRepository.getByWabaId(wabaId)` — mirror of `getByPhoneNumberId` (single `where('wabaId','==',…)` limit 1).
- [ ] `WhatsAppTemplateRepository.updateStatusByMetaId(orgId, metaTemplateId, patch)` — **idempotent** merge of `{ status, rejectedReason?, category?, syncedAt }`.

### B.3 Webhook branch (acks fast, processes in `after()`)
- [ ] In `route.ts`, before message/status handling, detect `change.field === 'message_template_status_update' | 'template_category_update'`. Resolve org via `getByWabaId`. In `after()`, parse → `updateStatusByMetaId`. Same HMAC validation as the existing path. Return `200` immediately.
- [ ] Route test: a signed template-status payload updates the mirror; an unsigned one is rejected; an unknown WABA is a no-op (no throw).

### B.4 Meta config + index (human)
- [ ] Subscribe the app's WhatsApp webhook to the `message_template_status_update` (and `template_category_update`) fields in the Meta app dashboard. **Without this, events never arrive — manual Sync remains the fallback.**
- [ ] Add the `whatsapp_connections.wabaId` index if the query needs it; deploy `firestore.indexes.json`.

**Commit:** `feat(whatsapp): auto-update template status via webhook`

---

## Phase C — Buttons & media headers in the builder (authoring **and** send)

**Goal:** author templates with image/video/document headers and buttons (quick-reply, URL, phone). The largest phase because it touches authoring, media upload, **and** the send payload.

**Files:** `whatsapp-domain.ts` (payload builder + new component types), `meta-cloud-client.ts` (resumable upload), `whatsapp-send.ts` (header/button params at send), `whatsapp-template-actions.ts` (adopt mapping for non-body vars), `WhatsAppTemplatePanel.tsx` + a new `next/dynamic` media-upload sub-component, tests across domain/send.

### C.1 Authoring model (TDD, pure)
- [ ] Extend `CreateTemplateInput` + `buildCreateTemplatePayload` for `HEADER format: IMAGE|VIDEO|DOCUMENT` (`example.header_handle`) and a `BUTTONS` component (`QUICK_REPLY`, `URL` with optional `{{1}}` suffix, `PHONE_NUMBER`), enforcing Meta's count/type rules in `validateCreateTemplateInput`.

### C.2 Media upload (the chunky bit)
- [ ] `meta-cloud-client.uploadResumable(file)` → Resumable Upload API (`/{app-id}/uploads`) → returns the `header_handle`. Needs `META_APP_ID` (already an env for OAuth). Validate MIME + size before upload.
- [ ] `bundle-conditional`: the uploader UI loads only when a media header is selected.

### C.3 Send-side (regression-critical)
- [ ] Extend `buildTemplatePayload` to emit `header` (media) and `button` URL components **only when present**, keeping body-only templates byte-identical (snapshot test the existing shape first to lock it).
- [ ] Extend the adopt param-map to capture header/button variables, not just body.

### C.4 Builder UI
- [ ] Header-type selector + uploader; dynamic buttons editor; preview reflects header/buttons.

**Commit:** `feat(whatsapp): media headers + buttons in template builder`

---

## Risk Register (what could go wrong → mitigation)

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R1 | **Webhook field not subscribed** → Phase B silently never fires | High | Keep manual **Sync from Meta** as the always-available fallback; document the subscription step (B.4); add a one-line note in the panel ("Status updates hourly or on Sync"). |
| R2 | **Meta approval is async** — PENDING templates can't send | Certain | Already handled: only APPROVED templates expose Adopt/Send-test; copy states it plainly. |
| R3 | **Duplicate name+language** → Meta 400 on create | Medium | Surface Meta's error verbatim in the toast; pre-check the local mirror for an existing `buildWhatsAppTemplateId` and warn before submit. |
| R4 | **Category auto-reclassified** by Meta (e.g. MARKETING→UTILITY) | Medium | `template_category_update` webhook (B) + Sync reconcile the stored category; never assume the requested category is final. |
| R5 | **Send breaks for templates with media/URL-button vars** if send fills only body | High (Phase C) | C.3 extends `buildTemplatePayload` + adopt mapping together; snapshot test guarantees body-only path is unchanged. |
| R6 | **WABA→org ambiguity / missing** in webhook | Low | `getByWabaId` returns first match; unknown WABA = no-op (tested), never throws (keeps the 200 ack). |
| R7 | **Duplicate webhook delivery** | Medium | `updateStatusByMetaId` is an idempotent merge; reprocessing is a no-op. Reuse the existing webhook idempotency guard. |
| R8 | **Meta rate limits** (template create ~ per-hour cap; max templates/WABA) | Low–Med | Don't batch-create; one submit per click; surface Meta's rate-limit message; no retry storm (the client already backs off only on 429/5xx). |
| R9 | **Resumable upload handle expiry / large files** (Phase C) | Med | Validate size/MIME client-side; upload immediately before submit; handle the "handle expired" error with a re-upload prompt. |
| R10 | **HMAC/timing regression** in webhook | Low | New branch sits behind the same signature check and `after()`; route test asserts unsigned payloads are rejected. |

---

## Affected / At-Risk Existing Features (must be covered, not just the new code)

| Area | Impact | Plan item |
|---|---|---|
| **Credential-form draft (this session)** | Unversioned localStorage; fragile to schema change | Phase **0.1** |
| **Template builder (this session)** | Derived-state-via-effect; missing a11y | Phase **0.2** |
| **TemplateGallery / `MessageTemplate` editing** | A user can edit an *adopted* WhatsApp template's body in the gallery; send ignores body (uses `whatsappTemplateName`+`paramMap`), so edits are silently cosmetic and misleading | Add a task in Phase A: render adopted WhatsApp templates as **read-only / "managed by Meta"** in the gallery (badge + disabled body edit). |
| **Send path `buildTemplatePayload`** | Phase C must not change the body-only output | R5 + C.3 snapshot test |
| **Composer / automations / notification pickers** | Already select WhatsApp templates; Phase C templates with non-body vars would fail to send if not mapped | C.3 adopt-mapping covers header/button vars before they're selectable |
| **Webhook (messages + statuses)** | New branch must not disturb existing handling or the fast 200 ack | B.3 route test runs the existing message/status cases too |
| **TestDispatchDialog** | Reused/extended for Phase A | Reuse, don't fork; existing dispatch test must still pass |
| **Firestore rules/indexes** | New `wabaId` lookup | B.4 index; confirm rules still deny direct client writes to `whatsapp_templates` (writes stay Admin-SDK only) |
| **Cross-org `system_admin` (this session)** | Template/test-send actions inherit the widened `canManageOrgIntegrations` — intended | No change; covered by existing `require-org-admin` tests |

---

## Execution Order & Done-Definition

1. **Phase 0** (debt) → 2. **Phase A** (verify + test-send) → 3. **Phase B** (webhook) → 4. **Phase C** (buttons/media).

A phase is **done** only when, per `verification-before-completion`, the human has run and reported:
`vitest` (0 failures) + `typecheck` (0 errors) + `lint` (0 errors), then committed with the stated message. Build runs once before deploy, not per task.
