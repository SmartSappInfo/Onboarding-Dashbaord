# WhatsApp Review Fixes — Implementation Plan

> **For agentic workers:** implement task-by-task with `executing-plans`. **TDD** (`test-driven-development`): failing test → watch fail → implement. **Verification gate** (`verification-before-completion`): a task is done only when its command shows 0 failures. Steps use `- [ ]`.
>
> **Build/test/lint/commit are run by the human, locally.** The agent does NOT run `next build`, `tsc`, `vitest`, `eslint`, or `git commit`. Each phase ends with the human's verify commands + commit message.

**Goal:** Resolve the accepted findings from the WhatsApp code review — make media upload work for real-size files via a route handler, stop unsendable templates from entering campaign flows, and clear the smaller correctness/DRY/UX nits.

**Scope (from review triage):** H1→(c) route handler · H2→guard · M2→server guard · M3→DRY constant · L1/L2/L3→fix all. **M1 (unverified-webhook hardening) intentionally skipped.**

**Architecture:** Keep pure logic in `whatsapp-domain.ts` (unit-tested); move only the media *transport* off the 2mb Server-Action cap onto a multipart **route handler**. Reuse the existing `validateHeaderMedia` + `uploadResumable`.

---

## Cross-cutting standards (the code-review of this plan)
Verified against `next-best-practices` (route-handlers), `vercel-react-best-practices`, `frontend-design`, plus integration checks (no middleware, no `/api/whatsapp` conflict, `whatsapp-domain.ts` is type-only/client-safe, `uploadWhatsAppHeaderMedia` imported only by the panel).

- **Route-handler conformance** (`next-best-practices`): `POST` only, `export const runtime = 'nodejs'`, `Response.json(...)` with proper status codes, `await req.formData()`. Auth **inside** the handler via `requireOrgAdmin(idToken, orgId)` — idToken from the `Authorization: Bearer` header (header-based, so no CSRF surface; never trust a cookie or the body for identity).
- **Deviation noted:** the skill says "prefer Server Actions for UI mutations." We deviate **only** for the binary media transport, because Server Actions are capped at `bodySizeLimit: 2mb`; binary upload to an external API is the documented route-handler use case. All *non-binary* mutations stay Server Actions.
- **`server-serialization` / memory:** validate `file.size` against the cap **before** `await file.arrayBuffer()` — never buffer an oversized file into server memory just to reject it.
- **`client-*` / frontend-design:** upload UI shows determinate progress (XHR `upload.onprogress`, since `fetch` can't report upload progress), disables the file input while in flight, and aborts on dialog close (no setState-after-unmount).
- Pure helpers tested first; thin I/O (route/action/engine) untested per codebase convention — but every decision they call is pure + tested.
- DRY/YAGNI: reuse `uploadResumable`/`validateHeaderMedia`; no chunked upload (unneeded under the Cloud Run ~32MB ceiling — see L2).
- **No change to `serverActions.bodySizeLimit`** — moving media to the route means other Server Actions are unaffected (keep 2mb).

**Human verify commands (per phase):**
```bash
npx vitest run src/lib/whatsapp/__tests__/ src/lib/auth/__tests__/
npm run typecheck
npm run lint
```

---

## Phase 1 — Quick wins: M2 (server category guard) + M3 (DRY button cap)

### M2 — Reject AUTHENTICATION at the create action
The builder UI already excludes it; the action schema still allows it, yielding a confusing Meta rejection.
- [ ] In [whatsapp-template-actions.ts](src/lib/whatsapp-template-actions.ts), change `CreateSchema.category` from `z.enum(['MARKETING','UTILITY','AUTHENTICATION'])` to `z.enum(['MARKETING','UTILITY'])`. (The `WhatsAppTemplateCategory` *type* keeps AUTHENTICATION — synced Meta-Manager templates still display.)
- [ ] No new test needed (zod-level); confirm existing create tests unaffected.

### M3 — Reuse `MAX_TEMPLATE_BUTTONS`
- [ ] In [WhatsAppTemplatePanel.tsx](src/app/admin/messaging/templates/components/WhatsAppTemplatePanel.tsx), import `MAX_TEMPLATE_BUTTONS` and replace the three hardcoded `10` / `buttons.length >= 10` checks.
- [ ] In `whatsapp-template-actions.ts`, change `z.array(ButtonSchema).max(10)` → `.max(MAX_TEMPLATE_BUTTONS)`.

**Commit:** `refactor(whatsapp): reject AUTHENTICATION at create + reuse button-cap constant`

---

## Phase 2 — H2: block unsendable templates from campaign flows

**Problem:** templates with a media header or dynamic `{{1}}` URL button can only be sent via *test-send*; adopting them into `MessageTemplate` lets them flow into campaigns/automations where runtime media isn't collected → every send fails at Meta.

**Approach:** guard at the boundary (adopt) + signal in UI. (Full engine wiring is deferred — out of scope.)

### 2.1 Pure predicate (TDD)
- [ ] Add `hasRuntimeNeeds(needs: TemplateRuntimeNeeds): boolean` to `whatsapp-domain.ts` (`!!needs.mediaFormat || needs.dynamicUrlButtons.length > 0`).
- [ ] Test: true for media/dynamic-button needs, false for body-only.

### 2.2 Server guard in `adoptWhatsAppTemplate`
- [ ] After loading `wa`, compute `getTemplateRuntimeNeeds(wa.components)`; if `hasRuntimeNeeds`, return `{ success:false, error:'This template needs a media header or dynamic URL value at send time, which campaigns don\'t support yet — use “Send test”.' }`.

### 2.3 UI signal in the panel
- [ ] For an APPROVED template where `hasRuntimeNeeds`, hide/disable **Adopt** and show a small **“Test-send only”** badge (reuse the panel's `Badge` + an amber `STATUS_META`-style class for visual consistency); keep **Send test**. (Compute `needs` per card during render — derived, no effect.)

### 2.4 Send-side guard in the engine (defense-in-depth, for already-adopted data)
The adopt guard only prevents *new* adoptions; a `MessageTemplate` adopted **before** this change would still fail cryptically at send. (Likely zero such rows today — the feature shipped this session — but guard anyway.)
- [ ] In the WhatsApp send orchestration ([whatsapp-send.ts](src/lib/whatsapp/whatsapp-send.ts) `SendWhatsAppInput` path / [messaging-engine.ts](src/lib/messaging-engine.ts) whatsapp branch), when sending a template, look up its mirror by `buildWhatsAppTemplateId(org, name, lang)` and if `hasRuntimeNeeds` **and** no `headerMedia`/`buttonParams` were supplied, fail the send with a clear status (`error`, surfaced on the `MessageLog`) instead of letting Meta reject it.
- [ ] Regression check: body-only and static-button templates have empty needs → guard is a no-op (assert in a pure test via `hasRuntimeNeeds`).

**Commit:** `feat(whatsapp): keep media/dynamic templates out of campaign adoption + send guard`

---

## Phase 3 — H1: media upload via multipart route handler (off the 2mb action cap)

**Problem:** base64 media through a Server Action hits `serverActions.bodySizeLimit: '2mb'` (~1.4MB raw after base64), while `validateHeaderMedia` advertises 5/16/100MB.

**Approach:** a dedicated `POST` route handler accepts `multipart/form-data` (not subject to the action cap), reusing `validateHeaderMedia` + `uploadResumable`. Align caps to the **Cloud Run request ceiling (~32MB)** so limits are honest (this also resolves **L2** — single-POST upload stays fine under 32MB; no chunking).

### 3.1 Align media caps to the transport (L2)
- [ ] In `whatsapp-domain.ts` `HEADER_MEDIA`, lower the document cap from 100MB to **30MB** (under Cloud Run's 32MB). Keep image 5MB / video 16MB. Update the UI helper text in the create dialog.
- [ ] Update the affected `validateHeaderMedia` test expectation if it asserted the 100MB doc cap (it doesn't currently — confirm).

### 3.2 Route handler (new) — `src/app/api/whatsapp/upload-media/route.ts`
Verified: no middleware intercepts it, no `/api/whatsapp` path conflict.
- [ ] `export const runtime = 'nodejs'`. Auth-inside; **size-check before buffering**; proper status codes:
```ts
export async function POST(req: NextRequest) {
  const idToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ success:false, error:'Bad form data.' }, { status:400 }); }
  const organizationId = String(form.get('organizationId') ?? '');
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ success:false, error:'No file.' }, { status:400 });
  try {
    await requireOrgAdmin(idToken, organizationId);                 // throws → 401 below
    const appId = process.env.META_APP_ID;
    if (!appId) return Response.json({ success:false, error:'Media headers require META_APP_ID.' }, { status:400 });
    // Validate against file.size FIRST — never buffer an oversized file (memory).
    const pre = validateHeaderMedia(file.type, file.size);
    if (!pre.valid || !pre.format) return Response.json({ success:false, error: pre.error }, { status:400 });
    const creds = await WhatsAppCredentialRepository.getCredentials(organizationId);
    if (!creds) return Response.json({ success:false, error:'No WhatsApp connection configured.' }, { status:400 });
    const data = new Uint8Array(await file.arrayBuffer());
    const handle = await new MetaCloudApiClient(creds).uploadResumable({ appId, fileName:file.name, fileType:file.type, data });
    return Response.json({ success:true, handle, format: pre.format });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    const status = /unauthor|forbidden/i.test(msg) ? 401 : 500;     // requireOrgAdmin messages
    return Response.json({ success:false, error: msg }, { status });
  }
}
```
- [ ] **MIME note (documented, not fixed):** `file.type` is client-supplied; Meta validates actual content on use, so a spoofed type → Meta rejection. No magic-byte sniffing (YAGNI).
- [ ] Remove the dead `uploadWhatsAppHeaderMedia` Server Action + `UploadMediaSchema` from `whatsapp-template-actions.ts` (confirmed: only the panel imported it).

### 3.3 UI: upload via XHR with progress (frontend-design)
- [ ] Add an `uploadMediaWithProgress(file, organizationId, idToken, onProgress)` helper using `XMLHttpRequest` (so `upload.onprogress` drives a real progress bar — `fetch` can't). Returns the parsed `{ success, handle, format, error }`.
- [ ] In `handleMediaFile`: call it, track `uploadPct` state for a determinate bar; **disable the file input** while uploading; keep an `AbortController`/XHR `.abort()` on dialog close and guard against setState-after-unmount.
- [ ] Delete the unused `fileToBase64` helper + the `uploadWhatsAppHeaderMedia` import.

### 3.4 Verify (human, manual)
- [ ] Upload a ~4MB image → succeeds with a progress bar (previously failed at the 2mb cap).
- [ ] Upload a >30MB file → rejected client- and server-side with the size message (not a generic framework error).

**Commit:** `feat(whatsapp): media upload via multipart route (off the 2mb action cap)`

---

## Phase 4 — L1 (client URL validation) + L3 (test coverage for new helpers)

### L1 — Validate media/button URLs client-side
- [ ] Add a tiny pure `isLikelyHttpUrl(s: string): boolean` to `whatsapp-domain.ts` (protocol http/https, has host). Test it.
- [ ] Send-test dialog: gate `canSend` on `isLikelyHttpUrl(mediaUrl)` when a media header is needed; show an inline error otherwise.
- [ ] Create dialog `buttonValid`: for URL buttons, also require `isLikelyHttpUrl(b.url)` (mirrors server; server still authoritative).

### L3 — Cover the new pure logic
- [ ] Ensure `hasRuntimeNeeds` (Phase 2) and `isLikelyHttpUrl` have unit tests.
- [ ] Document the untested integration boundary: the upload **route** and the Server **actions** remain integration-untested (firebase-admin coupling) — consistent with the codebase; all decision logic they call is pure + tested.

**Commit:** `feat(whatsapp): client-side URL validation + helper tests`

---

## What could go wrong → mitigation (Risk Register)

| # | Risk | Phase | Mitigation |
|---|---|---|---|
| RF1 | Oversized file buffered into server memory before rejection | 3 | Validate `file.size` **before** `arrayBuffer()` (3.2). |
| RF2 | Route is a public endpoint — unauthorized upload | 3 | `requireOrgAdmin` first; header-bearer token (no CSRF surface); errors map to 401. |
| RF3 | Spoofed `file.type` bypasses MIME check | 3 | Accepted: Meta validates real content → rejects; documented, no sniffing (YAGNI). |
| RF4 | Already-adopted media template fails cryptically at send | 2 | Send-side engine guard (2.4); current data likely empty but guarded. |
| RF5 | Cloud Run 32MB request ceiling on large docs | 3 | Cap doc at 30MB; document that raising it requires bumping Cloud Run + the cap together. |
| RF6 | `fetch` can't show upload progress → user thinks it hung on big files | 3 | XHR with `upload.onprogress` + determinate bar; disable input while uploading. |
| RF7 | Setting state after the dialog unmounts mid-upload | 3 | AbortController/`xhr.abort()` on close + mounted guard. |
| RF8 | Removing the upload action breaks a hidden caller | 3 | Verified only the panel imports it; grep again before deleting. |
| RF9 | Token expiry (1h) during a long upload | 3 | Token sent at request start, verified on receipt — single request, no refresh needed. |
| RF10 | M2 enum change rejects a legitimate AUTHENTICATION create | 1 | None exist (UI never offered it; builder can't produce valid auth templates). Sync still displays Meta-Manager auth templates (type unchanged). |

## Affected / at-risk existing features

| Area | Impact | Covered by |
|---|---|---|
| **Composer / automation / notification pickers** | Media/dynamic templates won't appear (can't be adopted) — intended; non-media unchanged | Phase 2 |
| **Messaging engine (whatsapp send)** | New send-side guard must no-op for body-only/static-button templates | Phase 2.4 + regression test |
| **Other Server Actions app-wide** | None — `bodySizeLimit` stays 2mb (media moved off it) | Cross-cutting note |
| **`whatsapp-domain.ts` consumers** | New pure exports (`hasRuntimeNeeds`, `isLikelyHttpUrl`, `MAX_TEMPLATE_BUTTONS` reuse) — module stays type-only/client-safe | Verified |
| **Create dialog category** | Already excludes AUTHENTICATION — now matches server | Phase 1 (M2) |
| **Synced AUTHENTICATION templates** | Still display (type unchanged); only *create* is blocked | Phase 1 |
| **WhatsApp setup runbook / docs** | Mentions media limits? Update doc caps (100→30MB) if referenced | Phase 3 (doc-string + runbook check) |

## Sequencing
Phase 1 (trivial) → Phase 2 (guards) → Phase 3 (route, largest) → Phase 4 (nits). Each independently shippable; Phase 3 is the only one needing a fresh `npm run build` (new route) before deploy. `META_APP_ID` remains required for media upload.

## Done-definition
Per `verification-before-completion`: a phase is done only when the human runs vitest (0 failures) + typecheck (0 errors) + lint (0 errors) and commits with the stated message. **The agent does not run build/tsc/lint/git.**
