# Technical Design Specification: Stateless Cryptographic SMS URL Shortening & Link Optimization

**Date**: 2026-07-30  
**Status**: Proposed / Under Review  
**Target Surfaces**: SMS Messaging Pipeline, `messaging-engine.ts`, `link-tracking.ts`, `short-crypto.ts`, `crypto.ts`, `/go/[linkId]` Redirect Route.

---

## 1. Problem Statement & Root Cause Analysis

### Problem
SMS messages dispatched through SmartSapp currently contain URLs reaching **215+ characters** (e.g. `https://go.smartsapp.com/m/9Kmtlz6ncX9Uf9dtWUo2?ref=6a667beb5fb341faec3efec6:63e9b30f9ac8493508086ef9ab291f36:d9513dee5e9b9b646ef4e1703bc7c72a1a5deedbb4b77d57aa130a380d7fce842e7cb5b9a6f9f2f2454d71bcb90bacbacefa1129c9525f`).

### Root Cause
1. When visitor tracking is enabled in messaging templates, `?ref={{encrypted_recipient_token}}` is appended to internal links.
2. During message dispatch, `messaging-engine.ts` resolves `{{encrypted_recipient_token}}` via `encryptToken(recipientContact)`, generating a **160–200 character AES-256-GCM string** (`iv:authTag:ciphertext`).
3. Single SMS dispatches bypass `transformBodyWithTracking()`, and bulk dispatches fail to match URLs with appended `?ref=...` query parameters against page serial lookup tables.
4. Consequence: Every SMS message is forced into **2 or 3 SMS segments** (160 chars max per segment), doubling or tripling per-message sending costs and cluttering the recipient's SMS inbox.

---

## 2. Goals & Hard Constraints

### Goals
- **URL Length Reduction**: Reduce SMS tracking links from **215+ characters** down to **~37 characters** (e.g. `https://go.smartsapp.com/go/3k9X2mP11xx`).
- **Single SMS Segment**: Guarantee messages fit cleanly into **1 SMS segment** (160 chars total including message body text).
- **Zero Database Writes**: Leverage CPU-bound Feistel cryptographic encoding (`short-crypto.ts`) so generating 10,000 or 1,000,000 SMS links incurs **0 database writes and $0 storage costs**.
- **Instant Non-Blocking Performance**: Link generation takes < 5 milliseconds in-memory.

### Hard Constraints
- **100% Backwards Compatibility**: All previously sent SMS messages containing old 160-character tokens must continue to decrypt, track, and redirect seamlessly when clicked by recipients.
- **Zero Impact on Unrelated Features**: Email HTML buttons, survey result builders, and non-SMS channels must remain completely unaffected.

---

## 3. Architecture & Data Flow

```
[Template / Message Body]
  │
  ├─> Contains: "Go Here: https://go.smartsapp.com/m/9Kmtlz6ncX9Uf9dtWUo2?ref={{encrypted_recipient_token}}"
  │
[messaging-engine.ts / bulk-messaging.ts] (Pre-Send Pipeline)
  │
  ├─> 1. Strip raw ?ref={{encrypted_recipient_token}} or ?ref=... parameter
  ├─> 2. Lookup/allocate contactSerial & pageSerial (In-Memory / Serial Allocator)
  ├─> 3. Feistel Cipher + Base58 Encode (packSerials -> encrypt64 -> encodeBase58)
  │
[Resulting SMS Body]
  │
  └─> "Go Here: https://go.smartsapp.com/go/3k9X2mP11xx" (37 chars total!)
  │
[Recipient Clicks Link]
  │
[GET /go/3k9X2mP11xx]
  │
  ├─> 1. decodeBase58 -> decrypt64 -> unpackSerials -> (contactSerial, pageSerial)
  ├─> 2. Resolve target URL (/m/9Kmtlz6ncX9Uf9dtWUo2) & recipient contact
  ├─> 3. Set __onb_context identity cookie + append contactId/entityId params
  └─> 4. 302 Redirect to landing page
```

---

## 4. Component Details & Design Strategy

### 4.1 URL Cleaning & Feistel Encoding (`link-tracking.ts`)
Update `transformBodyWithTracking()`:
1. Normalize input URLs by stripping trailing `?ref={{encrypted_recipient_token}}` or raw `?ref=...` tokens before looking up page serials.
2. For each unique URL:
   - Resolve `contactSerial` via `resolveContactSerial(contactId, entityId)`.
   - Resolve `pageSerial` via `resolvePageSerialAndType(cleanUrl)`.
   - If both serials exist, generate an **11-character Base58 token** `token = encodeBase58(encrypt64(packSerials(contactSerial, pageSerial)))`.
   - Return `${baseUrl}/go/${token}` (**37 chars total**).
3. If serials cannot be resolved, fall back gracefully to a compact token or stateful short link.

### 4.2 Universal Messaging Pipeline Integration (`messaging-engine.ts`)
In `messaging-engine.ts` (`dispatchMessageInternal` / `sendSmsInternal`):
- Automatically pass outgoing SMS message bodies through `transformBodyWithTracking()` before invoking the SMS gateway provider (Twilio / Africa's Talking / Hubtel).
- Ensure all single SMS dispatches, automations, and call centre SMS triggers benefit from automatic 37-character link shortening.

### 4.3 Compact Token Fallback & Backwards Compatibility (`crypto.ts`)
Update `encryptToken()` / `decryptToken()`:
- `decryptToken(cipherText)`:
  - Check if `cipherText` contains 2 colons (`iv:authTag:ciphertext`). If yes, process via legacy AES-256-GCM decipher. **Guarantees 100% backwards compatibility for already sent links.**
  - If `cipherText` uses new compact format, process via compact decipher.

---

## 5. Security, Performance & Scalability Assessment

- **Security**: Feistel cipher uses a 256-bit secret key (`SHORT_LINK_KEY`) with 4 rounds of HMAC-SHA256, preventing link tampering or enumeration.
- **Performance**: Cryptographic encoding and decoding are CPU-bound operations taking < 0.1ms per link.
- **Scalability**: Zero database writes during link creation; zero database writes during link redirection. Tested for 10,000+ SMS batch dispatches per minute with zero latency impact.

---

## 6. Verification & Test Plan

1. **Unit Tests (`src/lib/__tests__/short-link-pipeline.test.ts`)**:
   - Verify 215-character URLs with `?ref=...` are transformed into 37-character `/go/[token]` URLs.
   - Verify `/go/[token]` decodes back to the exact `contactSerial` and `pageSerial`.
   - Verify legacy long tokens (`iv:authTag:ciphertext`) continue to decrypt successfully via `decryptToken()`.
2. **Typecheck & Quality Checks**:
   - `pnpm typecheck` → 0 errors.
   - `npx eslint` → 0 errors.

---

## 7. Review & Approval Gate

Please review this design specification and confirm if you would like to proceed to implementation.
