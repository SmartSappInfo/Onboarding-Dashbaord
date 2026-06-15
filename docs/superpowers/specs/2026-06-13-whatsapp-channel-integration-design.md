# WhatsApp Channel Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL — use `executing-plans` (or `subagent-driven-development`) to implement this task-by-task. Steps use checkbox (`- [ ]`) syntax. **Conform to** `next-best-practices`, `vercel-react-best-practices`, `frontend-design`, `crm-builder`, `test-driven-development`. Every server action authenticates internally; every phase is TDD; commit after each green step.

**Goal:** Add WhatsApp (Meta Cloud API) as a first-class fourth messaging channel with per-organization credentials, Meta-approved template management, and full two-way conversations — reusing the existing `messaging-engine` dispatch path end-to-end.

**Architecture:** Hexagonal (ports & adapters). Pure domain logic (payload builders, session-window math, param mapping) is unit-tested with no I/O. Server-only adapters wrap the Graph API and Firestore. WhatsApp is one new branch in `messaging-engine.ts` — **no parallel send path**. Inbound + status callbacks arrive via a Node-runtime Route Handler (webhooks are external → Route Handler, per `next-best-practices/route-handlers`); all credential/template mutations are authenticated Server Actions (per `vercel-react-best-practices/server-auth-actions`).

**Tech Stack:** Next.js 15 (App Router, RSC), TypeScript, Firestore (Admin SDK), Node `crypto` (AES-256-GCM), Zod (boundary validation — already used in `src/lib/validation/`), Meta Graph API v21.0, Vitest/Jest (existing `__tests__`), SWR/`useCollection` for client reads.

**Date**: 2026-06-13 · **Status**: Plan (v3 — failure-mode + blast-radius analysis; channel-abstraction refactor added) · **Author**: Engineering

> **Build/verify note:** This plan never runs `npm run build`, `typecheck`, `lint`, or `test` for you — those are flagged for **you to run locally** to conserve credits. Look for **▶ RUN LOCALLY** callouts.

---

## 0. What changed in v2 (code review of v1)

The v1 spec was directionally sound but not yet industry-standard. Findings, by severity, each tied to a skill rule:

| # | Severity | Finding | Skill rule | Fix in this plan |
|---|----------|---------|-----------|------------------|
| R1 | **CRITICAL** | Credential/template **Server Actions had no auth check**. Existing actions (e.g. [messaging-actions.ts](src/lib/messaging-actions.ts)) rely on page guards — but actions are public endpoints. For secret-handling actions this is exploitable. | `vercel:server-auth-actions` | §6: every action calls `requireOrgAdmin(orgId)` first; Zod-validates input. |
| R2 | **CRITICAL** | Webhook had **no idempotency**. Meta retries deliveries; double-processing corrupts logs/stats. | `next:route-handlers` + industry standard | §5: `webhook_events` dedup on Meta `id`; signature compared with `crypto.timingSafeEqual`. |
| R3 | **HIGH** | Webhook side-effects (campaign stat updates, activity logs) **blocked the 200 response**. Meta penalizes slow webhooks → disables the subscription. | `vercel:server-after-nonblocking` | §5: ack 200 immediately, run side-effects in `after()`. |
| R4 | **HIGH** | No **runtime pin** on webhook. AES-256-GCM + Admin SDK need full Node `crypto`. | `next:runtime-selection` | §5: `export const runtime = 'nodejs'`. |
| R5 | **HIGH** | Token decryption happened ad-hoc; risk of leaking into logs/client props. | `vercel:server-serialization` | §4/§6: secrets never cross the RSC→client boundary; redacted projection only; decrypt at call site, never logged. |
| R6 | MEDIUM | No **send concurrency / rate-limit** model; bulk WhatsApp would exceed Meta tier and waterfall. | `vercel:async-parallel` | §7: bounded-concurrency dispatch respecting `messagingLimit`. |
| R7 | MEDIUM | Heavy template-authoring UI would ship in the main bundle. | `vercel:bundle-dynamic-imports` | §8: `next/dynamic` for template panel/param editor (`ssr:false`). |
| R8 | MEDIUM | Client read patterns unspecified → risk of waterfalls / over-fetch. | `vercel:client-swr-dedup`, `rerender-derived-state` | §8: `useCollection`/SWR with redacted projections; derive status pills during render. |
| R9 | MEDIUM | Plan lacked **TDD task granularity** and per-task file maps. | `writing-plans`, `test-driven-development` | §6–§10: bite-sized `- [ ]` steps, failing-test-first. |
| R10 | LOW | No **token rotation / revocation** or connection health backoff. | industry standard | §6: rotate + `disconnect`; §5: exponential backoff on Meta 5xx/429. |
| R11 | LOW | Frontend direction unspecified ("AI-slop" risk). | `frontend-design` | §8: committed aesthetic + WhatsApp-native cues. |

---

## 1. Locked Decisions

1. **Onboarding = "manual now, Embedded Signup later."** v1 ships per-org manual credentials. Storage carries `connectionType: 'manual' | 'embedded_signup'` so OAuth layers on without schema rework.
2. **Full two-way in v1** — outbound (templates/campaigns/automations) + inbound (threaded into Conversations) with the **24-hour customer-service window** enforced.
3. **Credentials encrypted at rest** — AES-256-GCM, env-derived master key, decrypt server-side at send time only.
4. **WhatsApp is a first-class fourth `MessageChannel`**, dispatched through the existing `messaging-engine.ts` chokepoint.

---

## 2. Overview

Today: `MessageChannel = 'email' | 'sms' | 'in_app' | 'push'` ([types.ts:2301](src/lib/types.ts:2301)); SMS→mNotify, email→Resend, both on **platform-global** env creds. WhatsApp introduces three things that model can't express:

| New requirement | Why it's different |
|---|---|
| **Per-org credentials** | Each org sends from its own WABA; existing channels share one account. |
| **Approval-gated templates** | Outside a session, only Meta-reviewed templates (`APPROVED`/`PENDING`/`REJECTED`, positional `{{1}}` params, fixed language) may send. |
| **Session window** | Free-form text only ≤24h after the user's last inbound message; templates otherwise. |

**Goals:** org-scoped connect/health-check; backoffice registry of every org's connection; template sync + approval visibility + selection everywhere templates are picked; WhatsApp selectable in composer/campaigns/automations/scheduled/conversations/logs; inbound + delivery/read status threaded in.

**Non-Goals (v1):** Embedded Signup OAuth (schema-ready only); WhatsApp Flows authoring; payments/catalog; migrating email/SMS to per-org creds.

---

## 3. Architecture

```
 UI (client)        WhatsAppSettings, TemplateSyncPanel, ChannelBadge,   — React; channel pickers extended;
                    Conversations(WA threads)                              heavy editors via next/dynamic
   │ Server Action (authenticated, Zod-validated)
 Application        whatsapp-actions / whatsapp-template-actions          — 'use server'; requireOrgAdmin() first
   │ uses
 Domain (pure)      buildTemplatePayload, isSessionOpen, mapParams,       — 100% unit-testable, no I/O
                    normalizeWaPhone, classifyTemplateStatus
   │ via ports
 Adapters (server)  WhatsAppCredentialRepository (crypto-vault),          — Firestore Admin SDK + Graph API;
                    WhatsAppTemplateRepository, MetaCloudApiClient         ret/backoff, never logs secrets
   ▲ external
 Webhook            /api/webhooks/whatsapp/route.ts (Node runtime)        — verify + idempotent + after()
```

**Boundaries (per `writing-plans` "files that change together live together"):**
- `src/lib/whatsapp/` — new module: `crypto-vault.ts`, `meta-cloud-client.ts`, `whatsapp-domain.ts` (pure), `whatsapp-credential-repository.ts`, `whatsapp-template-repository.ts`.
- `src/lib/whatsapp-actions.ts`, `src/lib/whatsapp-template-actions.ts` — `'use server'` application layer.
- `src/app/api/webhooks/whatsapp/route.ts` — inbound/status.
- UI extends existing pages; no new top-level layout.

---

## 3A. What could go wrong → design resolution

Concrete failure modes (not generic risks), each with the mechanism that prevents it. Items marked **BUG** already exist in the codebase and break the moment WhatsApp is added.

| # | Failure mode | Consequence | Resolution (where) |
|---|---|---|---|
| F1 **BUG** | [campaign-dispatch.ts:94](src/lib/campaign-dispatch.ts:94) collapses `channel` to `email ? 'email' : 'sms'` | WhatsApp campaigns **silently dispatch as SMS** | Phase R: replace ternary with `CHANNEL_REGISTRY` lookup; characterization test pins current email/sms behavior first. |
| F2 **BUG** | [bulk-messaging.ts:50](src/lib/bulk-messaging.ts:50) coerces unknown channels to `'email'` | WhatsApp bulk sends go out **as email** | Phase R: registry-driven channel resolution; test asserts WA stays WA. |
| F3 **BUG** | [suppression-service.ts:10](src/lib/suppression-service.ts:10) + engine cast `as 'email' | 'sms'` ([messaging-engine.ts:581](src/lib/messaging-engine.ts:581)) | WhatsApp opt-outs never checked; no STOP handling → **compliance/legal exposure** | Phase 5: widen suppression channel; inbound "STOP/UNSUBSCRIBE" → `suppressRecipient({channel:'whatsapp'})`; engine checks it. |
| F4 | New channel added later misses one of ~90 branch sites | Silent drift, wrong icon/route | Phase R: central `CHANNEL_REGISTRY` + `assertNever()` in switches so the **compiler** flags every unhandled channel. |
| F5 | Meta pauses/rejects an adopted template after first use | Sends fail mid-campaign | Status webhook updates `whatsapp_templates.status`; engine refuses non-`APPROVED`; campaign surfaces a blocked-template warning before launch. |
| F6 | Session expires between "compose" and "send" (race) | Free-form text rejected by Meta with opaque error | `isSessionOpen` re-checked at send time in the engine, not at compose; fall back to template-required structured error. |
| F7 | Bulk WhatsApp exceeds Meta messaging tier / 80 msg-s⁻¹ | 429 storm, throttling, quality-rating drop | Phase 4: bounded concurrency sized to `messagingLimit`; backoff on 429/5xx; pause campaign on `RED` quality. |
| F8 | One org's decrypted token used for another (tenant bleed) | Cross-tenant send, account ban | Credentials keyed strictly by `organizationId`; engine resolves connection from the message's org; repository tests assert isolation. |
| F9 | Encryption key rotated/lost | All tokens undecryptable | `WHATSAPP_ENCRYPTION_KEY` versioned (`keyId` stored on cipher record); `rotateToken` re-encrypts; documented key-custody runbook. |
| F10 | Phone formatting mismatch (local vs E.164) | Messages to wrong/no number; dedup misses | Single `normalizeWaPhone` (E.164) reused by send + session + suppression keys; unit-tested against GH/intl cases, building on [phone-utils.ts](src/lib/phone-utils.ts). |
| F11 | Webhook double-delivery / slow ack (covered v2: R2/R3) | Double-counted stats; Meta disables webhook | `webhook_events` idempotency + `after()` fast-200 (§5). |
| F12 | WhatsApp conversation-pricing cost surprise | Unbudgeted spend on marketing categories | Log `whatsappConversationId` + category on `MessageLog`; surface per-org send counts in backoffice; consent-gate marketing. |

## 3B. Blast radius — existing features affected (must not regress)

Widening `MessageChannel` touches code that assumes exactly email/sms. These features stay functional **only if** explicitly handled:

| Feature | Where | Effect of WhatsApp | Plan |
|---|---|---|---|
| **Campaign dispatch** | [campaign-dispatch.ts](src/lib/campaign-dispatch.ts), [bulk-messaging.ts](src/lib/bulk-messaging.ts) | F1/F2 misrouting | Phase R fixes coercions. |
| **Suppression / unsubscribe** | [suppression-service.ts](src/lib/suppression-service.ts), `unsubscribe/[id]`, [bulk-messaging.ts:181](src/lib/bulk-messaging.ts:181) (`&c=${channel}`) | WA not represented; STOP unhandled | Phase 5: add WA suppression channel + STOP intake. |
| **Notification engine** (meeting/form/survey reminders) | [notification-engine.ts:18](src/lib/notification-engine.ts:18) `'email'|'sms'|'both'|'all'`, `emailTemplateId`/`smsTemplateId` | Can't send WA reminders | Phase 4b: add `whatsappTemplateId` + widen `channel` union; opt-in per feature. |
| **Meeting messaging** (reminder/registration-ack/facilitator/post-event/reschedule/cancel channels) | [types.ts:1347-1453](src/lib/types.ts:1347), `MeetingMessagingTab.tsx`, `MessagingChannelBlock.tsx` | `('email'|'sms')[]` excludes WA | Phase 4b: optionally extend arrays + channel pickers. |
| **Form / Survey / QR notifications** | `form-notification-settings.tsx`, survey `*-notification-config.tsx`, `qr-notification-settings.tsx` (`('email'|'sms')[]`, type 2090) | WA absent from pickers | Phase 4b: add WA option where desired. |
| **Internal/external alerts** | [types.ts:1725/1731/1961](src/lib/types.ts:1725) `'email'|'sms'|'both'` | WA absent | Phase 4b (optional). |
| **Conversations** | `conversations/MessageThread.tsx` | Inbound WA must thread + render | Phase 5. |
| **Campaign analytics** | [campaign-analytics.tsx:419](src/app/admin/messaging/campaigns/components/campaign-analytics.tsx:419) binary `email ? : ` | WA renders SMS branch | Phase 4: registry-driven metric panel. |
| **Channel icon/badge switches** (logs, scheduled, profiles, ~30 UI sites) | `getChannelIcon`-style `switch` w/ `default` | No crash, but wrong/missing WA icon | Phase R: `<ChannelBadge channel>` from registry replaces ad-hoc switches incrementally. |
| **Sender profiles** | [profiles/page.tsx](src/app/admin/messaging/profiles/page.tsx), `SenderProfile.channel` | WA profile type | Phase 1/0. |
| **QR `whatsapp` type collision** | `QRCodeType`/`InteractionChannel` ([types.ts:3390](src/lib/types.ts:3390)) already use `'whatsapp'` for chat deep-links | **Unrelated** — do not conflate with `MessageChannel` | Note only; keep types distinct. |

## 3C. Channel abstraction — the scalability refactor (clean / testable / no functionality loss)

Today, channel logic is an `if/else` ladder duplicated across ~90 files. Adding a channel means hunting every site (F4). Replace with **two primitives**, introduced in **Phase R** as a behavior-preserving refactor (characterization tests first — `test-driven-development`):

1. **`CHANNEL_REGISTRY`** (`src/lib/messaging/channel-registry.ts`) — single source of truth:
   ```ts
   interface ChannelMeta { key: MessageChannel; label: string; icon: LucideIcon;
     isContactChannel: boolean; recipientField: 'email'|'phone'|'userId';
     suppressionKey: 'email'|'sms'|'whatsapp'; supportsFreeform: boolean; }
   export const CHANNEL_REGISTRY: Record<MessageChannel, ChannelMeta>;
   ```
   UI badges/pickers and the `recipientField`/coercion bugs (F1/F2) read from this — no per-file ternaries.

2. **`ChannelAdapter` strategy** (`src/lib/messaging/adapters/`) — `email` / `sms` / `whatsapp` each implement:
   ```ts
   interface ChannelAdapter { send(ctx): Promise<SendResult>;
     checkHygiene(recipient): Promise<HygieneVerdict>;
     resolveRecipient(contact): string | null; }
   ```
   `messaging-engine.ts` delegates `engine → CHANNEL_REGISTRY[channel] → adapter.send()` instead of the `if (channel==='sms') … else if …` chain ([messaging-engine.ts:666](src/lib/messaging-engine.ts:666)). Email/SMS adapters wrap **existing** `sendSms`/`sendEmail` verbatim (no behavior change, guaranteed by characterization tests). WhatsApp is then **a new adapter, not a new branch** — scalability without touching the ladder.

3. **`assertNever(channel)`** in remaining switches → compiler enforces exhaustiveness on future channels (F4).

**Why this preserves functionality:** Phase R ships *before* any WhatsApp send path. Its only deliverable is "email and SMS behave identically, now routed through the registry/adapter." Characterization tests captured from current behavior must stay green.

---

## 4. Data Model

### 4.1 `whatsapp_connections` (top-level, one per org; secrets server-only)
```ts
interface WhatsAppConnection {
  id: string;                      // = organizationId
  organizationId: string;
  connectionType: 'manual' | 'embedded_signup';
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  businessName?: string;
  // Secrets — encrypted; NEVER serialized to client
  accessTokenCipher: string; accessTokenIv: string; accessTokenTag: string;
  appSecretCipher?: string; appSecretIv?: string; appSecretTag?: string;
  webhookVerifyToken: string;
  // Health
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  qualityRating?: 'GREEN' | 'YELLOW' | 'RED';
  messagingLimit?: string;         // TIER_250 | TIER_1K | TIER_10K | TIER_100K | UNLIMITED
  lastHealthCheckAt?: string; lastError?: string;
  tokenRotatedAt?: string;
  createdAt: string; updatedAt: string; createdBy?: string;
}
// Redacted projection returned to clients — the ONLY shape that crosses the boundary:
type WhatsAppConnectionPublic = Omit<WhatsAppConnection,
  'accessTokenCipher'|'accessTokenIv'|'accessTokenTag'|'appSecretCipher'|'appSecretIv'|'appSecretTag'|'webhookVerifyToken'>
  & { hasToken: boolean; tokenLast4?: string };
```

### 4.2 `whatsapp_templates` (top-level, org-scoped mirror of Meta)
```ts
interface WhatsAppTemplate {
  id: string;                      // `${orgId}_${name}_${language}`
  organizationId: string;
  metaTemplateId: string;
  name: string; language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  components: WhatsAppComponent[]; // HEADER/BODY/FOOTER/BUTTONS verbatim from Meta
  paramCount: number;              // derived from BODY {{n}}
  exampleParams?: string[]; rejectedReason?: string;
  syncedAt: string;
}
```

### 4.3 `whatsapp_sessions` (24h window) & `webhook_events` (idempotency)
```ts
interface WhatsAppSession { id: string; /* `${orgId}_${e164}` */ organizationId: string;
  contactPhone: string; lastInboundAt: string; expiresAt: string; entityId?: string; }
interface WebhookEvent { id: string; /* Meta message/status id */ provider: 'whatsapp';
  processedAt: string; } // presence = already handled
```

### 4.4 Extended existing types
- `MessageChannel` += `'whatsapp'` ([types.ts:2301](src/lib/types.ts:2301)).
- `SenderProfile.channel` += `'whatsapp'`; add `whatsappPhoneNumberId?`, `whatsappStatus?` ([types.ts:2839](src/lib/types.ts:2839)).
- `MessageLog`/`MessageJob`/`ScheduledMessage` `channel` unions += `'whatsapp'`; `MessageLog` += `direction?: 'inbound'|'outbound'`, `whatsappTemplateName?`, `metaMessageId?`, `whatsappConversationId?` ([types.ts:2851](src/lib/types.ts:2851)).
- `MessageTemplate` (when `channel==='whatsapp'`) += `whatsappTemplateName?`, `whatsappLanguage?`, `whatsappParamMap?: string[]` (positional `{{1..n}}` → existing variable keys, reusing the variable registry).

### 4.5 Firestore rules / indexes
- `whatsapp_connections`, `whatsapp_sessions`, `webhook_events`: `allow read, write: if false;` (Admin SDK only; clients use authenticated actions).
- `whatsapp_templates`: `allow read: if isOrgMember(orgId); allow write: if false;`.
- Composite indexes: `whatsapp_templates(organizationId, status)`, `(organizationId, category, status)`; `message_logs(organizationId, channel, sentAt desc)` for WA conversation queries.

---

## 5. Webhook (Route Handler — external integration)

`src/app/api/webhooks/whatsapp/route.ts` — **`export const runtime = 'nodejs'`** (R4):

- **GET** (verification handshake): compare `hub.verify_token` to the org's `webhookVerifyToken` with `crypto.timingSafeEqual`; echo `hub.challenge`.
- **POST**:
  1. Read raw body; validate `X-Hub-Signature-256` HMAC-SHA256 against decrypted `appSecret` using `timingSafeEqual` (R2). Reject 401 on mismatch.
  2. **Idempotency (R2):** for each entry's message/status `id`, `create()` a `webhook_events/{id}` doc with a precondition; if it exists, skip.
  3. **Ack fast (R3):** return `200` immediately; do all work in `after(async () => …)`:
     - `messages` (inbound): upsert `MessageLog` (`direction:'inbound'`), refresh `whatsapp_sessions` (`lastInboundAt`, `expiresAt = now+24h`), `logActivity`.
     - `statuses`: update `MessageLog.providerStatus` by `metaMessageId`; feed `updateCampaignRealtimeStat` exactly like [resend/route.ts](src/app/api/webhooks/messaging/resend/route.ts).
- **Never wrap `redirect`/`notFound` in try/catch** (none used here, but noted per `next:error-handling`).

Outbound calls to Meta use exponential backoff on 429/5xx (R10) and **never log the bearer token** (R5).

---

## 6. Phase Plan (TDD, bite-sized)

> Each task: failing test → run/confirm fail → minimal impl → run/confirm pass → **commit**. `requireOrgAdmin(orgId)` is the shared auth guard added in Phase 1.

### Phase 0 — Crypto vault + type widening
**Files:** Create `src/lib/whatsapp/crypto-vault.ts`, `src/lib/whatsapp/__tests__/crypto-vault.test.ts`; Modify [types.ts:2301](src/lib/types.ts:2301) + the 5 channel unions.
- [ ] Failing test: `decrypt(encrypt(x)) === x`; tampering the tag throws.
- [ ] Run → fail.
- [ ] Implement AES-256-GCM (`WHATSAPP_ENCRYPTION_KEY`, 32-byte hex); `encrypt→{cipher,iv,tag}`, `decrypt` with auth-tag verify.
- [ ] Run → pass. Widen `MessageChannel` + unions.
- [ ] **▶ RUN LOCALLY:** `npm run typecheck` (compiler enumerates every `'email'|'sms'` site to fix). Commit.

### Phase R — Channel abstraction refactor ✅ DONE (behavior-preserving, shipped BEFORE any WhatsApp send)
**Goal:** replace the scattered `=== 'email' ? : 'sms'` ternaries with a single source of truth so a new channel slots in cleanly; fix the silent-misroute bug F2.
**Decision (locked):** the full `ChannelAdapter` strategy *rewrite* of the 856-line `messaging-engine.ts` was **descoped** — high regression risk for low marginal gain, since the engine already has a clean per-channel `if/else`. Instead the **registry** carries the shared metadata, and Phase 3 adds a focused `whatsapp` engine branch that *uses* it. Working email/SMS dispatch is left untouched.
**Files:** Created [channel-registry.ts](src/lib/messaging/channel-registry.ts), [channel-registry.test.ts](src/lib/messaging/__tests__/channel-registry.test.ts); Modified [campaign-dispatch.ts](src/lib/campaign-dispatch.ts), [bulk-messaging.ts](src/lib/bulk-messaging.ts).
- [x] `CHANNEL_REGISTRY` (label/`recipientField`/`suppressionKey`/`supportsFreeform`/`isContactChannel`) covering all 5 channels, + `contactResolutionChannel()` + `getChannelMeta()`.
- [x] `assertNever(value, context)` exhaustiveness guard for channel `switch`es (F4).
- [x] Campaign-dispatch contact-resolution ternaries → `contactResolutionChannel()` / `CHANNEL_REGISTRY[].recipientField` (behavior-preserving for email/sms; correct phone routing for whatsapp).
- [x] **F2 fix** ([bulk-messaging.ts](src/lib/bulk-messaging.ts)): replaced silent coercion-to-email with an explicit `email|sms`-only guard that throws for unsupported channels — fail loud, not misroute.
- [x] 9 registry unit tests pin the mappings; **full `tsc --noEmit` clean.**
- [x] **VERIFIED LOCALLY:** `vitest run` (21/21 new tests) + `npm run typecheck` clean. *(Two unrelated pre-existing failures: `bulk-hygiene` timeout + `campaign-integrations` mock-hoisting TDZ — both fail identically without these changes.)*
- [ ] Commit (deferred — working tree was already dirty on `main` pre-session; branch + stage WhatsApp files when ready).

### Phase 1 — Credentials + auth guard + backoffice registry
**Files:** Create `src/lib/whatsapp/whatsapp-credential-repository.ts`, `src/lib/whatsapp/meta-cloud-client.ts`, `src/lib/whatsapp-actions.ts`, `src/lib/auth/require-org-admin.ts`; `src/app/admin/settings/components/WhatsAppSettings.tsx`; backoffice connections table under `src/app/(backoffice)/backoffice/organizations/`. Modify `firestore.rules`, `firestore.indexes.json`.
- [ ] Failing tests (domain): redacted projection strips all `*Cipher/*Iv/*Tag/webhookVerifyToken`, exposes `tokenLast4`.
- [ ] `requireOrgAdmin(orgId)` — verifies session + org-admin role **inside** the action (R1, `vercel:server-auth-actions`); Zod-validate every input.
- [ ] Actions: `saveConnection`, `getConnectionPublic`, `testConnection` (→ `getPhoneNumberHealth`), `rotateToken`, `disconnect` (R10). Tokens encrypted before write (R5); never returned.
- [ ] Org UI: credential form (masked token, "Test connection" → live quality/tier/status pill) — derive pill during render, not effect (`vercel:rerender-derived-state`). Mount near `FeatureManager`.
- [ ] Backoffice: read-only table of every org's `WhatsAppConnectionPublic` + force-disconnect.
- [ ] Rules + indexes + add `WHATSAPP_ENCRYPTION_KEY` to env docs.
- [ ] **▶ RUN LOCALLY:** `npm run typecheck && npm run lint && npm run test`. Commit.

### Phase 2 — Template sync + management + MessageTemplate bridge
**Files:** Create `src/lib/whatsapp/whatsapp-template-repository.ts`, `src/lib/whatsapp/whatsapp-domain.ts`, `src/lib/whatsapp-template-actions.ts`, tests; `src/app/admin/messaging/templates/components/WhatsAppTemplatePanel.tsx`.
- [ ] Failing tests (pure domain): `extractParamCount('Hi {{1}}, {{2}}')===2`; `validateParamMap` rejects count mismatch; status classifier.
- [ ] `MetaCloudApiClient.listMessageTemplates` (paginated); `syncTemplates(orgId)` upserts + derives `paramCount`.
- [ ] Actions authenticated; `listTemplates(orgId,{status})`.
- [ ] UI (lazy via `next/dynamic`, `ssr:false`, R7): approved/pending/rejected groups, "Sync from Meta", rejection reasons; long lists use `content-visibility` (`vercel:rendering-content-visibility`).
- [ ] Bridge: "adopt" → create `channel:'whatsapp'` `MessageTemplate` with `whatsappTemplateName/Language/ParamMap`; param-map picker reuses variable registry.
- [ ] **▶ RUN LOCALLY:** `npm run typecheck && npm run test`. Commit.

### Phase 3 — Outbound dispatch (focused engine branch using the registry)
**Files:** Create `src/lib/whatsapp/whatsapp-send.ts` (pure payload/session helpers + `sendWhatsApp` orchestration), `src/lib/whatsapp/__tests__/payload.test.ts`; Modify the dispatch section of [messaging-engine.ts:666](src/lib/messaging-engine.ts:666).
- [ ] Failing tests (pure): `buildTemplatePayload(conn,to,tmpl,params)` shape; `isSessionOpen(lastInboundAt,now)` boundary at exactly 24h; F6 race — session checked at send time.
- [ ] `MetaCloudApiClient.sendTemplateMessage` / `sendTextMessage` with backoff (R10, F7).
- [ ] Add a `whatsapp` branch to the engine's existing `if (channel === 'sms') … else if (email) …` chain (email/SMS paths untouched): resolve org connection (keyed by orgId — F8) → **re-check** session open at send time; if open AND plain text, send text; else require `APPROVED` template (F5) → build params from resolved variables → send → capture `metaMessageId`. Structured error (same shape as SMS hygiene block) if no connection / decrypt fails / template not approved.
- [ ] The branch reads `CHANNEL_REGISTRY['whatsapp']` for recipient field / suppression key / session rules (shared logic, not duplicated).
- [ ] **▶ RUN LOCALLY:** `npm run typecheck && npm run test`. Manual: send a test template to your own number. Commit.

### Phase 4 — Composer, Campaigns, Automations, Scheduled
**Files:** Modify composer channel selector + components; [campaign-wizard.tsx](src/app/admin/messaging/campaigns/components/campaign-wizard.tsx); automation send-message action UI + [types.ts:2450](src/lib/types.ts:2450) `supportedChannels`; verify scheduled flush.
- [ ] Composer: WhatsApp channel → swap free-form editor for approved-template picker + param inputs.
- [ ] Campaigns: add WhatsApp (template-only at bulk scale); analytics flow via existing `MessageLog`/webhook path; **bounded-concurrency** dispatch honoring `messagingLimit` (R6, `vercel:async-parallel` — `Promise.all` over a capped batch, not unbounded).
- [ ] Automations: `whatsapp` channel option; template selector filtered to approved.
- [ ] Scheduled: confirm WA reached via adapter on flush (already channel-generic, [types.ts:2393](src/lib/types.ts:2393)).
- [ ] Campaign analytics: replace binary `email ? :` ([campaign-analytics.tsx:419](src/app/admin/messaging/campaigns/components/campaign-analytics.tsx:419)) with registry-driven metric panel (F3B).
- [ ] **▶ RUN LOCALLY:** `npm run typecheck && npm run lint && npm run build`. Commit.

### Phase 4b — Adjacent features (regression guard for §3B)
**Goal:** WhatsApp reaches the features that share the channel model, and **none of them regress**. Each sub-item is independently shippable/optional.
**Files:** Modify [notification-engine.ts:18](src/lib/notification-engine.ts:18); `MeetingMessagingTab.tsx`/`MessagingChannelBlock.tsx` + [types.ts:1347-1453](src/lib/types.ts:1347); `form-notification-settings.tsx`, survey `*-notification-config.tsx`, `qr-notification-settings.tsx`; alert-channel types [1725/1731/1961](src/lib/types.ts:1725).
- [ ] `notification-engine`: widen `channel` union; add optional `whatsappTemplateId`; dispatch WA when contact has phone + WA template + prefs allow. Test: existing email/sms reminders unchanged.
- [ ] Meeting messaging: extend reminder/registration-ack/facilitator/post-event/reschedule/cancel channel arrays + UI pickers (opt-in; default unchanged so existing meetings keep behavior).
- [ ] Form / Survey / QR notifications: add WA to channel pickers where desired.
- [ ] Internal/external alerts: optionally add WA.
- [ ] **Note:** `QRCodeType`/`InteractionChannel` `'whatsapp'` ([types.ts:3390](src/lib/types.ts:3390)) is a **separate** concept (chat deep-link) — do not merge with `MessageChannel`.
- [ ] **▶ RUN LOCALLY:** `npm run typecheck && npm run test`. Commit.

### Phase 5 — Inbound + status webhook + Conversations + STOP/opt-out
**Files:** Create `src/app/api/webhooks/whatsapp/route.ts`, tests; Modify Conversations components, [suppression-service.ts:10](src/lib/suppression-service.ts:10), `unsubscribe` flow.
- [ ] Failing tests: signature reject on bad HMAC; idempotent double-delivery → one log; GET handshake echoes challenge; inbound "STOP" → suppression written.
- [ ] Implement per §5 (Node runtime, `timingSafeEqual`, `webhook_events` dedup, `after()` side-effects).
- [ ] **Compliance (F3):** widen `suppression-service` channel to include `'whatsapp'`; inbound "STOP/UNSUBSCRIBE/CANCEL" → `suppressRecipient({channel:'whatsapp'})`; engine checks WA suppression (remove the `as 'email'|'sms'` cast at [messaging-engine.ts:581](src/lib/messaging-engine.ts:581)). Reuse `normalizeWaPhone` for the suppression key (F10).
- [ ] Conversations: WA threads slot into existing entity grouping; channel filter/badge; reply box shows "session expired — template required" (derive from `expiresAt` during render).
- [ ] **▶ RUN LOCALLY:** `npm run typecheck && npm run test`. Manual: reply from WhatsApp → threads; send "STOP" → suppressed; fake-expire `expiresAt` → reply restricts to templates. Commit.

### Phase 6 — Channel badges, health dashboard, docs ✅ DONE
**Files:** logs/conversations/profiles/template lists badges (extend `Mail`/`Smartphone` pattern, [profiles/page.tsx](src/app/admin/messaging/profiles/page.tsx)); backoffice health view; org runbook.
- [x] WhatsApp icon in scheduled-page channel switch.
- [x] Runbook `docs/whatsapp-setup-runbook.md` (Meta System User token, webhook config, troubleshooting).
- [ ] Backoffice connection-health dashboard (quality/tier/last error) — optional follow-up.

---

## 6A. Phase 7 — Conversations entity-threading (inbound ↔ entity)

**Status:** Plan (v1, code-reviewed). **Skills applied:** `next-best-practices` (route handlers / data-patterns / runtime), `vercel-react-best-practices` (`server-cache-react`, `async-parallel`, `rerender-derived-state-no-effect`, `client-swr-dedup`), `frontend-design`, `test-driven-development`, `crm-builder`. *(Firestore data-modeling skill `firebase/agent-skills@firebase-firestore-standard` identified via find-skills; install blocked by safety classifier — patterns below follow its conventions: server-only secondary index, batched writes, single-field auto-indexed lookups.)*

### Problem (verified in code, not assumed)
Conversations already groups by `key = log.entityId || log.recipient` ([ConversationsClient.tsx](src/app/admin/messaging/conversations/ConversationsClient.tsx)). So inbound WhatsApp logs (no `entityId`) **already thread by phone** — but as a *separate* thread from the entity's outbound thread, and the thread query is `where('workspaceIds','array-contains', activeWorkspaceId)` while inbound logs are written with `workspaceIds:['onboarding']` ([webhooks/whatsapp/route.ts](src/app/api/webhooks/whatsapp/route.ts)). **Two real gaps:** (1) inbound not merged with the entity's thread; (2) inbound invisible in the contact's actual workspace. Both are fixed by resolving the entity from the sender's phone at inbound time and stamping `entityId` + correct `workspaceIds`.

The blocker: `entityContacts` is an **embedded array** on `workspace_entities` ([entity-contact-helpers.ts:43](src/lib/entity-contact-helpers.ts)); Firestore can't query a phone inside it. We need a **phone→entity secondary index**.

### Architecture (hexagonal; reuses the existing denormalization path)
```
 Maintenance (server)   entity create/update/delete  ──hooks──▶  PhoneIndexRepository.sync(entity)
   (extend denormalization-sync.ts — same hook points that already denormalize primaryPhone)
 Index (server-only)    contact_phone_index/{orgId}_{e164}  →  { entityId, workspaceId, displayName, contactName, updatedAt }
 Lookup (server)        webhook handleInbound  ──▶  PhoneIndexRepository.lookup(orgId, fromDigits)
 Backfill (server)      one-time batched job over workspace_entities (bounded concurrency, resumable cursor)
 UI (client)            Conversations merges threads automatically (shared entityId); inbound/outbound
                        bubble styling from `direction`; session-expired reply state derived during render
```

**Key decision — index key = `${organizationId}_${normalizeWaPhone(phone)}`.** The webhook knows `organizationId` (from the connection) but not the workspace, so the index *returns* `workspaceId`. One shared `normalizeWaPhone` (already in [whatsapp-send.ts](src/lib/whatsapp/whatsapp-send.ts)) normalizes BOTH the stored E.164 (`+233…`) and the inbound `from` to digits — eliminating format-mismatch (F1).

### Data model
```ts
// contact_phone_index/{`${orgId}_${e164digits}`}  — server-only
interface PhoneIndexEntry {
  organizationId: string;
  phone: string;            // normalized digits
  entityId: string;
  workspaceId: string;
  displayName: string;
  contactName?: string;
  updatedAt: string;        // last-write-wins for shared-phone collisions
}
```

### 6A. Failure modes → resolution (Phase-7-specific code review)
| # | Failure mode | Consequence | Resolution |
|---|---|---|---|
| P1 | Phone format mismatch (stored `+233…` vs inbound `233…`) | Lookup never matches | Single shared `normalizeWaPhone` for index keys AND webhook `from`; unit-tested on GH/intl + `+`/space/paren cases. |
| P2 | Index staleness (contact phone edited/removed; entity deleted) | Threads to the wrong/old entity | Maintenance **diffs** old vs new phones on every entity write (only writes deltas, F8); entity delete removes its entries; lookup **defensively re-verifies** the entity still has the phone before threading; backfill is a repair job. |
| P3 | Shared phone across entities (family/org) | Ambiguous mapping | Last-write-wins by `updatedAt` (documented); entry may keep a `candidates[]` for future disambiguation — never silently threads to two. |
| P4 | Cross-tenant bleed | One org sees another's contact | Key is org-scoped; lookup always passes the connection's `organizationId`; repository test asserts isolation. |
| P5 | Backfill at scale (10k+ entities) | Timeout / write storm | Batched (≤400/commit), **bounded-concurrency** (`async-parallel`, capped), resumable cursor, runs server-side via `after()`/job — never blocks a request. |
| P6 | Unbounded inbound floods the client query (`limit(1000)`) | Conversations truncates/slows | Pre-existing limit; note + follow-up: server-side pagination / per-thread lazy load. Not a Phase-7 regression. |
| P7 | Inbound body readable beyond intent | Privacy | Inbound log scoped by resolved `workspaceIds`; if unresolved, stays in a fallback workspace (not leaked org-wide). Rules already gate `message_logs` by `workspaceIds`. |
| P8 | Index write amplification (many contacts) | Cost/latency on entity save | Diff-only writes + a single Firestore batch per entity save; maintenance runs in `after()` so it never blocks the entity-save response (`server-after-nonblocking`). |
| P9 | Unresolved inbound (no matching entity) | Message lost from view | Falls back to today's behavior (threads by `recipient` phone in the fallback workspace) — strictly no worse than current; surfaced as an "unmatched" thread. |

### Clean / testable / scalable (no functionality loss)
- **Pure, unit-tested:** `buildPhoneIndexKey(orgId, phone)`, `diffEntityPhones(prevContacts, nextContacts) → {added, removed}`, reuse of `normalizeWaPhone`. Zero I/O.
- **`PhoneIndexRepository`** (server-only adapter, Admin SDK): `syncEntity(entity)`, `removeEntity(entityId, phones)`, `lookup(orgId, phone)`. Mirrors `WhatsAppCredentialRepository` shape.
- **Reuse, don't duplicate:** maintenance hooks the *existing* `extractDenormalizedFields` / entity create+update+delete — the same places that already denormalize `primaryPhone`. No new write path scattered across the app.
- **`React.cache`** the lookup if ever called from RSC (`server-cache-react`); **`after()`** for index maintenance (`server-after-nonblocking`).
- **Conversations UI:** session-expired state and inbound/outbound styling **derived during render** (`rerender-derived-state-no-effect`); reads via existing `useCollection` (`client-swr-dedup`); no new effects.
- **No regression:** all changes are additive — unresolved inbound keeps today's recipient-keyed threading (P9).

### Phase 7 task plan (TDD, bite-sized)
- **7.1 — Pure helpers.** Create `src/lib/whatsapp/phone-index-domain.ts` + tests: `buildPhoneIndexKey`, `diffEntityPhones`. ▶ **RUN LOCALLY:** `npx vitest run src/lib/whatsapp/__tests__/phone-index-domain.test.ts`.
- **7.2 — Repository + maintenance.** Create `phone-index-repository.ts` (`syncEntity`/`removeEntity`/`lookup`, batched, diff-only). Hook into [denormalization-sync.ts](src/lib/denormalization-sync.ts) + entity create/update/delete in [entity-actions.ts](src/lib/entity-actions.ts), wrapped in `after()`. ▶ **RUN LOCALLY:** `npm run typecheck`.
- **7.3 — Backfill.** `backfillPhoneIndex()` server action: batched, bounded concurrency, resumable cursor, idempotent. Unit-test the pure batching/cursor logic. ▶ **RUN LOCALLY:** `npm run typecheck && vitest run`.
- **7.4 — Webhook resolution.** `handleInbound` → `PhoneIndexRepository.lookup(conn.organizationId, ev.from)`; on hit, stamp `entityId`, `workspaceIds:[workspaceId]`, `displayName`, and the session doc's `entityId`; defensive entity re-check (P2). ▶ **RUN LOCALLY:** `npm run typecheck`.
- **7.5 — Conversations UI.** Inbound/outbound bubble styling from `direction`; WhatsApp channel rendering; **session-expired reply state** ("Outside 24h window — template required") derived from the latest inbound timestamp / session doc; WhatsApp send via the existing engine path. Conform to `frontend-design` (operator-console tone, status-driven). ▶ **RUN LOCALLY:** `npm run build`.
- **7.6 — Rules + index.** `contact_phone_index`: `allow read, write: if false` (Admin SDK only). Lookup is a single-field doc-id `get` — no composite index needed. ▶ **RUN LOCALLY:** none (rules deploy).

### Open questions (Phase 7)
1. Shared-phone policy: last-write-wins (v1) vs always show an "ambiguous — N entities" chooser?
2. Backfill trigger: backoffice button vs automatic on first WhatsApp connect?
3. Should unresolved inbound auto-create a lightweight contact, or stay an "unmatched" thread (v1)?

---

## 7. Performance & Dispatch (vercel-react)
- **Bulk sends:** bounded concurrency (e.g. p-limit / chunked `Promise.all`) sized to Meta `messagingLimit`; never fire unbounded parallel requests (`async-parallel` done right).
- **RSC/Server Actions:** `requireOrgAdmin` wrapped in `React.cache()` for per-request dedup (`server-cache-react`); webhook side-effects in `after()` (`server-after-nonblocking`).
- **Serialization:** only `WhatsAppConnectionPublic` crosses to client; secrets never in props/logs (`server-serialization`).

## 8. Frontend (frontend-design + vercel-react)
- **Aesthetic direction:** WhatsApp settings/template surfaces adopt a *crisp, "operator console"* tone — restrained, high-contrast, status-driven (quality-rating chips as the visual anchor), not a generic card grid. Match the existing admin design language; no Inter/purple-gradient defaults. Status semantics use WhatsApp-native cues (GREEN/YELLOW/RED quality) so operators read health at a glance.
- **Heavy authoring UI** (template panel, param editor) lazy-loaded via `next/dynamic` `ssr:false` (`bundle-dynamic-imports`).
- **Client reads** via `useCollection`/SWR with redacted projections (`client-swr-dedup`); status pills derived during render, not in effects (`rerender-derived-state-no-effect`); long template lists use `content-visibility`.
- **Error UX:** segment `error.tsx` (Client Component) for settings/templates routes (`next:error-handling`).

## 9. Security & Compliance
- Tokens AES-256-GCM at rest; master key in env/secret manager; rotation + revocation (`rotateToken`/`disconnect`).
- Webhook: per-org `appSecret` HMAC, `timingSafeEqual`, idempotency dedup, Node runtime.
- `whatsapp_connections`/`sessions`/`webhook_events` never client-readable; clients use authenticated actions only.
- Every Server Action: `requireOrgAdmin(orgId)` + Zod at boundary.
- Meta **opt-in** consent gating for `MARKETING` templates — reuse existing suppression/consent checks the engine already applies for SMS/email; respect messaging tier in dispatch.

## 10. Risks
| Risk | Mitigation |
|---|---|
| Meta App Review gating Embedded Signup | v1 manual creds — no review dependency. |
| **Silent channel misrouting** (F1/F2) | Phase R fixes coercions; characterization tests prevent reintroduction. |
| **Refactor regresses email/SMS** | Characterization tests written first; Phase R ships before WhatsApp. |
| **Compliance: no WA opt-out** (F3) | Phase 5 STOP intake + WA suppression channel. |
| **Tenant credential bleed** (F8) | Connections keyed by orgId; isolation tests. |
| **Channel quality-rating drop** (F7) | Tier-aware bounded concurrency; pause campaign on RED. |
| Template rejection / drift | Sync surfaces status + reason; engine refuses non-`APPROVED`. |
| Webhook disabled by Meta for slow acks | `after()` + fast 200 (R3). |
| Duplicate webhook processing | `webhook_events` idempotency (R2). |
| Token leakage | Encrypted, server-only, redacted projections, never logged (R5). |

## 11. Open Questions
1. One WABA per org (assumed) or multiple phone numbers? (v1 = one; schema extends to a subcollection later.)
2. Separate per-entity WhatsApp marketing opt-in vs reuse SMS consent?
3. Embedded Signup timeline → whether to start Meta App Review now.
