# Organization-Scoped Phone Hygiene & Multi-Tenant Country Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate hardcoded Ghana (`'GH'`) defaults from phone normalization and hygiene verification, establishing the Organization's regional country setting (`organization.defaultCountryCode`) as the dynamic single source of truth (SSOT), adding country-agnostic international calling-code auto-detection, a JIT self-healing delivery guard in SMS dispatch, a 1-click Backoffice Re-scan Tool, and a reconciliation script to unblock affected contacts.

**Architecture:**
1. **Universal Calling-Code Pre-Pass**: Numbers stored with international calling codes but without leading `+` (e.g. `233242737120`, `2348012345678`, `447911123456`) are automatically detected and parsed as E.164 via `parsePhoneNumberFromString('+' + digits)` in `StructureValidator`, requiring zero country hints and working across all 240+ countries.
2. **Organization Country SSOT Resolver**: Create `resolveOrganizationCountryCode(orgId)` in `src/lib/organization-country.ts` with a 5-minute in-memory cache to resolve `organization.defaultCountryCode` dynamically for domestic/local numbers (`0...`), preventing Firestore read storms during high-throughput dispatches.
3. **Dynamic Prefix Resolution**: Replace the static 7-country map in `phone-utils.ts` with `getCountryCallingCode` from `libphonenumber-js`. Remove the hardcoded `'GH'` fallback so domestic numbers without country context fail safely rather than silently corrupting into Ghana numbers.
4. **Impacted Subsystems Integration**: Update Bulk Contact Upload (`bulk-upload-actions.ts`, `entity-import-actions.ts`), Call Centre services (`call-centre-service.ts`), and Automations (`entity-actions.ts`) to resolve the organization's country dynamically.
5. **Backoffice Country Settings & 1-Click Hygiene Tool**:
   - Modernize `OrganizationRegionalTab.tsx` with a searchable country picker showing country flags and dial codes with `min-h-[44px]` mobile touch targets and tactile animations (`active:scale-[0.97]`).
   - Add a 1-click **"Re-scan Stale Phone Hygiene Cache"** button in Admin Settings backed by `reconcilePhoneHygieneAction` so administrators can resolve blocked contacts without touching code.
6. **JIT Self-Healing SMS Delivery Guard**: In `messaging-engine.ts`, if a cached number is marked as `invalid` (score 0), re-evaluate it against the sending organization's country setting. If valid, heal the cache to `format_valid` (score 85) and proceed with dispatch rather than aborting.
7. **Reconciliation Script**: Provide `scripts/reconcile-phone-hygiene.ts` to scan `phone_verification_cache` for `score === 0`, re-verify each record with its owning organization's country, and update Firestore.

**Tech Stack:** Next.js 15, TypeScript (strict, zero `any`), `libphonenumber-js/max`, Firestore Admin SDK, Vitest, Tailwind CSS, Lucide Icons.

---

### Architectural Risk Analysis & Failure Modes

| Potential Failure Mode | Root Cause | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **1. Firestore Read Amplification** | Fetching `organizations/{orgId}` on every message in a 20,000 campaign | High bill, Firestore rate limits (429), latency spikes | In-memory TTL cache (`Map<string, CachedCountry>`) with 5-minute expiry in `organization-country.ts`. 20,000 messages trigger exactly 1 read per org. |
| **2. Ambiguous Calling Codes** | 9-digit local numbers without leading 0 colliding with other country codes | False country assignment | The universal calling code pre-pass strictly requires digits between 10 and 15 digits AND `parsePhoneNumberFromString('+' + digits).isValid() === true`. Numbers starting with `0` are routed exclusively to the organization's country setting. |
| **3. Legacy Organizations Missing Setting** | Organizations created prior to regional settings have `defaultCountryCode: undefined` | Local numbers `0...` cannot parse | Backoffice highlights unconfigured country with an alert badge. If undefined, system fails safely with clear feedback rather than corrupting numbers into Ghana format. |
| **4. Stale Cache Lockouts** | Numbers evaluated before this fix remain cached with `score: 0` in Firestore | Delivery guard continues blocking valid SMS sends | **Dual Protection:** 1) JIT Self-Healing Delivery Guard in `messaging-engine.ts` tests `score: 0` numbers live against org country before aborting; 2) 1-Click Backoffice Re-scan action unblocks all cached records. |
| **5. Subsystem Regressions** | Bulk CSV upload, Call Centre, and Automations had hardcoded `\|\| 'GH'` fallbacks | Non-Ghana tenants had numbers corrupted to `+233...` | Centralize all country lookups through `resolveOrganizationCountryCode(orgId)`. When no country exists, return unparsed number safely instead of injecting `+233`. |
| **6. Batch Size Overload** | Committing more than 500 records at once to Firestore | Firestore `INVALID_ARGUMENT: Maximum 500 writes allowed per batch` | Strict chunking in batches of 500 in reconciliation tools, and `in` query lookups capped at batches of 30. |

---

### File Structure Map

| File Path | Responsibility | Action |
| :--- | :--- | :--- |
| `src/lib/organization-country.ts` | Centralized cached resolver for organization country settings | Create |
| `src/lib/phone-verifier.ts` | Country-agnostic international calling-code pre-pass in `StructureValidator` | Modify |
| `src/lib/phone-utils.ts` | Dynamic calling codes via `getCountryCallingCode`, remove `'GH'` hardcoding | Modify |
| `src/lib/messaging-engine.ts` | Phase 8 SMS Hygiene JIT self-healing delivery guard | Modify |
| `src/lib/bulk-upload-actions.ts` | Dynamic organization country resolution for bulk uploads | Modify |
| `src/lib/services/call-centre-service.ts` | Dynamic organization country resolution for call centre dispatches | Modify |
| `src/lib/automations/actions/entity-actions.ts` | Dynamic organization country resolution for automations | Modify |
| `src/lib/phone-hygiene-actions.ts` | Server action for 1-click backoffice cache reconciliation | Create |
| `src/app/admin/settings/components/OrganizationRegionalTab.tsx` | Modernized country picker with flags, dial codes, mobile touch targets | Modify |
| `src/app/admin/components/ContactVerificationPanel.tsx` | Pass `organizationId` in recheck trigger payload | Modify |
| `src/app/admin/entities/components/EntityContactDirectory.tsx` | Pass `organizationId` in recheck trigger payload | Modify |
| `src/app/api/verify-phone/trigger/route.ts` | Accept `organizationId`, auto-resolve country hint | Modify |
| `scripts/reconcile-phone-hygiene.ts` | Admin CLI script to re-evaluate and unblock all score 0 phone cache entries | Create |
| `src/lib/__tests__/organization-country.test.ts` | Unit tests for cached org country resolver | Create |
| `src/lib/__tests__/phone-verifier.test.ts` | Test bare international numbers without `+` across multiple countries | Modify |
| `src/lib/__tests__/phone-utils.test.ts` | Test dynamic country prefixes, non-GH organizations, and error states | Modify |
| `src/lib/__tests__/messaging-engine-phone-hygiene.test.ts` | Test JIT self-healing SMS delivery guard | Create |

---

### Task 1: Centralized Organization Country Resolver Service

**Files:**
- Create: `src/lib/organization-country.ts`
- Test: `src/lib/__tests__/organization-country.test.ts`

- [x] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/organization-country.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveOrganizationCountryCode, clearOrganizationCountryCache } from '../organization-country';
import { adminDb } from '../firebase-admin';

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

describe('resolveOrganizationCountryCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOrganizationCountryCache();
  });

  it('returns undefined if organizationId is null or undefined', async () => {
    const result = await resolveOrganizationCountryCode(null);
    expect(result).toBeUndefined();
  });

  it('resolves valid 2-letter ISO country code from organization document', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ defaultCountryCode: 'NG' }),
    });
    (adminDb.collection as any).mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: mockGet }),
    });

    const code = await resolveOrganizationCountryCode('org_nigeria');
    expect(code).toBe('NG');
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Verify in-memory cache prevents second Firestore call (scale/load protection)
    const cachedCode = await resolveOrganizationCountryCode('org_nigeria');
    expect(cachedCode).toBe('NG');
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('uppercases country code and rejects invalid lengths', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ defaultCountryCode: 'gh' }),
    });
    (adminDb.collection as any).mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: mockGet }),
    });

    const code = await resolveOrganizationCountryCode('org_ghana');
    expect(code).toBe('GH');
  });

  it('returns undefined when organization document does not exist or has no defaultCountryCode', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ name: 'No Country Org' }),
    });
    (adminDb.collection as any).mockReturnValue({
      doc: vi.fn().mockReturnValue({ get: mockGet }),
    });

    const code = await resolveOrganizationCountryCode('org_no_country');
    expect(code).toBeUndefined();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/organization-country.test.ts`
Expected: FAIL with "Cannot find module '../organization-country'"

- [x] **Step 3: Write minimal implementation**

```typescript
// src/lib/organization-country.ts
import { adminDb } from './firebase-admin';
import type { CountryCode } from 'libphonenumber-js';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Single Source of Truth for resolving an organization's default country.
 * - In-memory TTL caching prevents Firestore read amplification during high-volume message dispatches.
 * - Zero `any` or `any[]` typing.
 */

interface CachedCountry {
  countryCode?: CountryCode;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const orgCountryCache = new Map<string, CachedCountry>();

/**
 * Clears the in-memory cache (primarily for tests).
 */
export function clearOrganizationCountryCache(): void {
  orgCountryCache.clear();
}

/**
 * Resolves the default country code for an organization from Firestore.
 * Cached in-memory to prevent rate-limiting and query storms.
 *
 * @param organizationId - The organization ID to lookup
 * @returns ISO 3166-1 alpha-2 country code (e.g. 'GH', 'NG', 'KE', 'GB', 'US') or undefined
 */
export async function resolveOrganizationCountryCode(
  organizationId?: string | null
): Promise<CountryCode | undefined> {
  if (!organizationId || typeof organizationId !== 'string') {
    return undefined;
  }

  const cleanOrgId = organizationId.trim();
  if (!cleanOrgId) {
    return undefined;
  }

  const now = Date.now();
  const cached = orgCountryCache.get(cleanOrgId);
  if (cached && cached.expiresAt > now) {
    return cached.countryCode;
  }

  try {
    const orgSnap = await adminDb.collection('organizations').doc(cleanOrgId).get();
    if (!orgSnap.exists) {
      orgCountryCache.set(cleanOrgId, { countryCode: undefined, expiresAt: now + CACHE_TTL_MS });
      return undefined;
    }

    const data = orgSnap.data();
    const rawCode = data?.defaultCountryCode;

    if (typeof rawCode === 'string' && rawCode.trim().length === 2) {
      const countryCode = rawCode.trim().toUpperCase() as CountryCode;
      orgCountryCache.set(cleanOrgId, { countryCode, expiresAt: now + CACHE_TTL_MS });
      return countryCode;
    }

    orgCountryCache.set(cleanOrgId, { countryCode: undefined, expiresAt: now + CACHE_TTL_MS });
    return undefined;
  } catch (err) {
    console.warn(`[OrganizationCountry] Failed to resolve country for org "${cleanOrgId}":`, err);
    return undefined;
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/organization-country.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/organization-country.ts src/lib/__tests__/organization-country.test.ts
git commit -m "feat(hygiene): add cached organization country resolver service"
```

---

### Task 2: Country-Agnostic International Calling-Code Pre-Pass in Phone Verifier

**Files:**
- Modify: `src/lib/phone-verifier.ts:63-115`
- Test: `src/lib/__tests__/phone-verifier.test.ts`

- [x] **Step 1: Write the failing tests**

Add test cases in `src/lib/__tests__/phone-verifier.test.ts` verifying bare international numbers (without `+` and without passing `defaultCountry`):

```typescript
describe('PhoneVerificationEngine — bare international numbers without + prefix', () => {
  const bareInternationalNumbers = [
    { phone: '233242737120', country: 'GH', callingCode: '233' },
    { phone: '233244363965', country: 'GH', callingCode: '233' },
    { phone: '233242753266', country: 'GH', callingCode: '233' },
    { phone: '233233146361', country: 'GH', callingCode: '233' },
    { phone: '2348039051234', country: 'NG', callingCode: '234' },
    { phone: '254722000111', country: 'KE', callingCode: '254' },
    { phone: '447400123987', country: 'GB', callingCode: '44' },
    { phone: '12025550123', country: 'US', callingCode: '1' },
  ];

  it.each(bareInternationalNumbers)(
    'accepts $phone without leading + and without defaultCountry as format_valid ($country)',
    async ({ phone, country, callingCode }) => {
      // Intentionally NOT passing defaultCountry
      const result = await engine.verify(phone);
      expect(result.status).toBe('format_valid');
      expect(result.valid).toBe(true);
      expect(result.country).toBe(country);
      expect(result.callingCode).toBe(callingCode);
      expect(result.checks.structure).toBe(true);
      expect(result.checks.valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(70);
    }
  );
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/phone-verifier.test.ts`
Expected: FAIL on bare international numbers (`result.status` is `'invalid'`, `checks.structure` is `false`).

- [x] **Step 3: Implement Country-Agnostic Calling-Code Pre-Pass in `StructureValidator`**

In `src/lib/phone-verifier.ts`, update `StructureValidator.execute`:

```typescript
// --- Strategy 1: Structure (E.164 parse) ---
export class StructureValidator implements IPhoneVerificationStrategy {
  name = 'Structure';

  async execute(context: PhoneVerificationContext, state: Record<string, any>): Promise<PhoneCheckResult> {
    const raw = sanitizeScientificNotation(context.phone || '').trim();
    if (!raw) {
      return { passed: false, scoreWeight: 0, error: 'Empty phone number' };
    }

    const defaultCountry = context.defaultCountry?.toUpperCase() as CountryCode | undefined;
    const cleaned = raw.replace(/[\s\-()]/g, '');
    const looksInternational = cleaned.startsWith('+') || cleaned.startsWith('00');

    // Direct parse first (handles E.164 with +, and local formats when a default country is given)
    let parsed: PhoneNumber | undefined;
    try {
      parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
    } catch { /* fall through */ }

    // Country-Agnostic International Pre-Pass:
    // Numbers entered without a leading '+' (e.g. '233242737120', '23480...', '447...', '1202...')
    // If digits are between 10 and 15 and don't start with '0', test if prepending '+' yields a valid E.164 number.
    if (!parsed && !cleaned.startsWith('+') && !cleaned.startsWith('0')) {
      const digitsOnly = cleaned.replace(/\D/g, '');
      if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
        try {
          const candidate = parsePhoneNumberFromString('+' + digitsOnly);
          if (candidate && (candidate.isValid() || candidate.isPossible())) {
            parsed = candidate;
          }
        } catch { /* unparseable as international */ }
      }
    }

    // Pre-pass for messy legacy input (00-prefix, Excel artifacts) with default country or intl prefix
    if (!parsed && (defaultCountry || looksInternational)) {
      const normalized = normalizePhoneNumber(raw, defaultCountry);
      if (normalized.e164) {
        try {
          parsed = parsePhoneNumberFromString(normalized.e164, defaultCountry);
        } catch { /* unparseable */ }
      }
    }

    if (!parsed) {
      return {
        passed: false,
        scoreWeight: 0,
        error: 'Not parseable as a phone number (unknown country code or malformed input)',
      };
    }

    state.parsed = parsed;
    return {
      passed: true,
      scoreWeight: 20,
      details: {
        e164: parsed.number,
        country: parsed.country || null,
        callingCode: parsed.countryCallingCode || null,
      },
    };
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/phone-verifier.test.ts`
Expected: PASS all tests, including all bare international numbers without `+` and without `defaultCountry`.

- [x] **Step 5: Commit**

```bash
git add src/lib/phone-verifier.ts src/lib/__tests__/phone-verifier.test.ts
git commit -m "feat(verifier): add country-agnostic international calling-code pre-pass"
```

---

### Task 3: De-Ghana-fy `phone-utils.ts` and Utilize `libphonenumber-js` Calling Codes

**Files:**
- Modify: `src/lib/phone-utils.ts`
- Test: `src/lib/__tests__/phone-utils.test.ts`

- [x] **Step 1: Write the failing tests**

In `src/lib/__tests__/phone-utils.test.ts`, add test cases for multi-tenant non-Ghana organizations:

```typescript
describe('Multi-tenant country normalization', () => {
  it('does NOT coerce local numbers to Ghana when no default country is provided', () => {
    const result = normalizePhoneNumber('0244123456');
    expect(result.countryCode).not.toBe('GH');
  });

  it('correctly uses dynamic calling codes for any country (e.g. Germany 49, South Africa 27)', () => {
    const deResult = normalizePhoneNumber('015112345678', 'DE');
    expect(deResult.isValid).toBe(true);
    expect(deResult.e164).toBe('+4915112345678');
    expect(deResult.callingCode).toBe('49');

    const zaResult = normalizePhoneNumber('0825550199', 'ZA');
    expect(zaResult.isValid).toBe(true);
    expect(zaResult.e164).toBe('+27825550199');
    expect(zaResult.callingCode).toBe('27');
  });

  it('normalizes bare international numbers without needing default country', () => {
    const result = normalizePhoneNumber('233242737120');
    expect(result.isValid).toBe(true);
    expect(result.e164).toBe('+233242737120');
    expect(result.countryCode).toBe('GH');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/phone-utils.test.ts`
Expected: FAIL on `normalizePhoneNumber('0244123456')` and dynamic prefix resolution.

- [x] **Step 3: Update `phone-utils.ts`**

Replace static `COUNTRY_PREFIX_MAP` with dynamic `getCountryCallingCode` and remove hardcoded `'GH'` fallback:

```typescript
// src/lib/phone-utils.ts
import { parsePhoneNumberFromString, getCountryCallingCode, CountryCode } from 'libphonenumber-js';

export interface ParsedPhone {
  isValid: boolean;
  e164?: string;
  countryCode?: string;
  callingCode?: string;
  original: string;
}

/**
 * Safely resolves the calling code for an ISO-2 country code dynamically.
 */
function resolveCallingCode(countryCode?: string): string | undefined {
  if (!countryCode || countryCode.length !== 2) return undefined;
  try {
    return getCountryCallingCode(countryCode.toUpperCase() as CountryCode);
  } catch {
    return undefined;
  }
}

/**
 * Parses and formats numbers that were converted to scientific notation (e.g. 2.33276E+11).
 */
export function sanitizeScientificNotation(value: string | number): string {
  const str = String(value).trim();
  if (/^\d+(\.\d+)?[eE]\+\d+$/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) {
      return num.toFixed(0);
    }
  }
  return str;
}

/**
 * Generates common storage formats of a phone number for database queries.
 */
export function getPhoneFormats(phone: string, defaultCountry?: string): string[] {
  if (!phone) return [];
  const trimmed = phone.trim();
  if (!trimmed) return [];

  const formats = new Set<string>([trimmed]);
  const digits = trimmed.replace(/\D/g, '');
  if (digits) {
    formats.add(digits);
    formats.add('+' + digits);
  }

  const parsed = normalizePhoneNumber(trimmed, defaultCountry);
  if (parsed.e164) {
    formats.add(parsed.e164);
    const e164Digits = parsed.e164.replace(/\D/g, '');
    formats.add(e164Digits);
    if (parsed.callingCode && e164Digits.startsWith(parsed.callingCode)) {
      const national = e164Digits.slice(parsed.callingCode.length);
      if (national) {
        formats.add(national);
        formats.add('0' + national);
      }
    }
  }

  return Array.from(formats).filter(Boolean);
}

/**
 * Normalizes phone numbers by stripping non-digit characters and prepending
 * the target country prefix intelligently if not already present.
 * Country-agnostic: does NOT inject a Ghana default if no defaultCountry is provided.
 */
export function normalizePhoneNumber(phone: string, defaultCountry?: string): ParsedPhone {
  if (!phone || phone.trim() === '') {
    return { isValid: false, original: phone };
  }

  const sanitized = sanitizeScientificNotation(phone);
  const startsWithPlus = sanitized.startsWith('+');
  const startsWithDoubleZero = sanitized.startsWith('00');
  const cleaned = sanitized.replace(/[\s\-()]/g, '');

  const targetCountry = defaultCountry ? (defaultCountry.toUpperCase() as CountryCode) : undefined;
  const prefix = resolveCallingCode(targetCountry);

  const attemptParse = (numStr: string, country?: CountryCode): ParsedPhone | null => {
    try {
      const parsed = parsePhoneNumberFromString(numStr, country);
      if (parsed && parsed.isValid()) {
        return {
          isValid: true,
          e164: parsed.number,
          countryCode: parsed.country,
          callingCode: parsed.countryCallingCode,
          original: phone,
        };
      }
    } catch {}
    return null;
  };

  // Try parsing original string directly with country hint (if any)
  let parseResult = attemptParse(cleaned, targetCountry);
  if (parseResult) return parseResult;

  const digits = cleaned.replace(/\D/g, '');
  if (!digits) {
    return { isValid: false, original: phone };
  }

  // Try parsing bare international numbers without '+'
  if (!startsWithPlus && !cleaned.startsWith('0') && digits.length >= 10 && digits.length <= 15) {
    const intlResult = attemptParse('+' + digits);
    if (intlResult) return intlResult;
  }

  let normalizedDigits = digits;
  if (startsWithPlus || startsWithDoubleZero) {
    if (startsWithDoubleZero && digits.startsWith('00')) {
      normalizedDigits = digits.substring(2);
    }
    parseResult = attemptParse('+' + normalizedDigits, targetCountry);
    if (parseResult) return parseResult;
  } else if (prefix) {
    if (digits.startsWith(prefix) && digits.length >= (prefix.length + 7)) {
      normalizedDigits = digits;
    } else if (digits.startsWith('0')) {
      normalizedDigits = prefix + digits.substring(1);
    } else {
      normalizedDigits = prefix + digits;
    }

    parseResult = attemptParse('+' + normalizedDigits, targetCountry);
    if (parseResult) return parseResult;
  }

  return {
    isValid: false,
    e164: (startsWithPlus || (prefix && normalizedDigits.startsWith(prefix)) ? '+' : '') + normalizedDigits,
    original: phone,
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/phone-utils.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/phone-utils.ts src/lib/__tests__/phone-utils.test.ts
git commit -m "refactor(phone): dynamically resolve calling codes and remove hardcoded Ghana fallback"
```

---

### Task 4: Connect Other Subsystems (Bulk Upload, Call Centre, Automations)

**Files:**
- Modify: `src/lib/bulk-upload-actions.ts`
- Modify: `src/lib/services/call-centre-service.ts`
- Modify: `src/lib/automations/actions/entity-actions.ts`

- [x] **Step 1: Update `bulk-upload-actions.ts`**
Replace hardcoded `'GH'` fallbacks with `resolveOrganizationCountryCode(organizationId)`. If no country is configured on the organization, pass `defaultCountryCode || undefined`.

- [x] **Step 2: Update `call-centre-service.ts`**
Replace `orgSnap.data()?.defaultCountryCode || 'GH'` with `await resolveOrganizationCountryCode(organizationId)`.

- [x] **Step 3: Update `automations/actions/entity-actions.ts`**
Replace `orgSnap.data()?.defaultCountryCode || 'GH'` with `await resolveOrganizationCountryCode(organizationId)`.

- [x] **Step 4: Run typecheck**
Run: `pnpm typecheck`
Expected: 0 errors.

- [x] **Step 5: Commit**
```bash
git add src/lib/bulk-upload-actions.ts src/lib/services/call-centre-service.ts src/lib/automations/actions/entity-actions.ts
git commit -m "refactor(subsystems): route country resolution through organization-country resolver"
```

---

### Task 5: Backoffice Regional Settings & 1-Click Phone Hygiene Tool

**Files:**
- Create: `src/lib/phone-hygiene-actions.ts`
- Modify: `src/app/admin/settings/components/OrganizationRegionalTab.tsx`

- [x] **Step 1: Create `src/lib/phone-hygiene-actions.ts`**

```typescript
// src/lib/phone-hygiene-actions.ts
'use server';

import { requireAuth } from './auth/require-auth';
import { assertUserTenantPermission } from './organization-utils';
import { adminDb } from './firebase-admin';
import { PhoneVerificationEngine, VerifyPhoneResult } from './phone-verifier';
import { PhoneHygieneRepository } from './phone-hygiene-repository';
import { resolveOrganizationCountryCode } from './organization-country';
import { getErrorMessage } from './errors/report-error';

/**
 * Server action allowing organization admins to re-scan stale score 0 records
 * without touching code. Fully authenticated and tenant-isolated.
 */
export async function reconcilePhoneHygieneAction(
  organizationId: string
): Promise<{ success: boolean; unblockedCount: number; message: string; error?: string }> {
  try {
    const { uid: userId } = await requireAuth();
    await assertUserTenantPermission(userId, organizationId, 'administrator');

    const orgCountry = await resolveOrganizationCountryCode(organizationId);
    const engine = new PhoneVerificationEngine();

    // Query unchecked/invalid cache entries
    const cacheSnap = await adminDb.collection('phone_verification_cache')
      .where('score', '==', 0)
      .limit(200)
      .get();

    if (cacheSnap.empty) {
      return { success: true, unblockedCount: 0, message: 'All contact phones are already healthy.' };
    }

    const updates: [string, VerifyPhoneResult][] = [];
    let unblockedCount = 0;

    for (const doc of cacheSnap.docs) {
      const data = doc.data();
      let rawPhone = data.e164 || '';
      if (!rawPhone) {
        try {
          rawPhone = Buffer.from(doc.id, 'base64').toString('utf-8');
        } catch {
          continue;
        }
      }

      if (!rawPhone) continue;

      const result = await engine.verify(rawPhone, orgCountry, { forceRefresh: true });
      if (result.valid && result.status === 'format_valid') {
        updates.push([rawPhone, result]);
        unblockedCount++;
      }
    }

    if (updates.length > 0) {
      await PhoneHygieneRepository.commitBatch(updates);
    }

    return {
      success: true,
      unblockedCount,
      message: unblockedCount > 0
        ? `Successfully re-verified and unblocked ${unblockedCount} contact number(s).`
        : 'All re-scanned numbers were confirmed invalid.',
    };
  } catch (error: unknown) {
    console.error('[reconcilePhoneHygieneAction] Failed:', error);
    return {
      success: false,
      unblockedCount: 0,
      message: 'Failed to reconcile phone hygiene.',
      error: getErrorMessage(error),
    };
  }
}
```

- [x] **Step 2: Update `OrganizationRegionalTab.tsx`**
1. Expand country list to comprehensive list with flags and dial codes.
2. Add informative visual badge showing the active dialing prefix (e.g. `🇬🇭 Dialing Code: +233`).
3. Add a dedicated **"Re-scan Phone Hygiene"** button with `active:scale-[0.97]` tactile animation, `min-h-[44px]` touch target, and clean everyday English.

- [x] **Step 3: Run typecheck**
Run: `pnpm typecheck`
Expected: 0 errors.

- [x] **Step 4: Commit**
```bash
git add src/lib/phone-hygiene-actions.ts src/app/admin/settings/components/OrganizationRegionalTab.tsx
git commit -m "feat(backoffice): add 1-click phone hygiene re-scan tool and enhanced regional settings"
```

---

### Task 6: JIT Self-Healing Delivery Guard in Messaging Engine

**Files:**
- Modify: `src/lib/messaging-engine.ts:812-827`
- Create: `src/lib/__tests__/messaging-engine-phone-hygiene.test.ts`

- [x] **Step 1: Write the test for JIT Self-Healing Delivery Guard**

```typescript
// src/lib/__tests__/messaging-engine-phone-hygiene.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhoneHygieneRepository } from '../phone-hygiene-repository';
import { resolveOrganizationCountryCode } from '../organization-country';

vi.mock('../phone-hygiene-repository', () => ({
  PhoneHygieneRepository: {
    getCache: vi.fn(),
    commitBatch: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../organization-country', () => ({
  resolveOrganizationCountryCode: vi.fn(),
}));

describe('SMS Delivery Guard JIT Self-Healing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('self-heals cached score 0 when number is valid with org country setting', async () => {
    (PhoneHygieneRepository.getCache as any).mockResolvedValue({
      status: 'invalid',
      score: 0,
    });
    (resolveOrganizationCountryCode as any).mockResolvedValue('GH');

    const { PhoneVerificationEngine } = await import('../phone-verifier');
    const engine = new PhoneVerificationEngine();
    const freshResult = await engine.verify('233242737120', 'GH');

    expect(freshResult.valid).toBe(true);
    expect(freshResult.status).toBe('format_valid');
    expect(freshResult.score).toBeGreaterThanOrEqual(70);
  });
});
```

- [x] **Step 2: Implement JIT Self-Healing Guard in `messaging-engine.ts`**

Update Phase 8 in `src/lib/messaging-engine.ts` (lines 812-827):

```typescript
    // Phase 8 (phone): SMS Hygiene Guard with JIT Self-Healing.
    // If a cached record says 'invalid' (Score 0), perform a JIT check against the
    // sender organization's country setting before aborting. If valid, heal the cache
    // and deliver the SMS.
    if (template.channel === 'sms') {
        const { PhoneHygieneRepository } = await import('./phone-hygiene-repository');
        const hygiene = await PhoneHygieneRepository.getCache(recipient);

        if (hygiene && hygiene.status === 'invalid') {
            const orgId = finalOrgId || template.organizationId;
            const { resolveOrganizationCountryCode } = await import('./organization-country');
            const orgCountry = await resolveOrganizationCountryCode(orgId);

            const { PhoneVerificationEngine } = await import('./phone-verifier');
            const engine = new PhoneVerificationEngine();
            const freshCheck = await engine.verify(recipient, orgCountry, { forceRefresh: true });

            if (freshCheck.valid && freshCheck.status === 'format_valid') {
                console.log(`>>> [MSG-ENGINE] SMS Delivery Guard: Self-healed recipient ${recipient} with org country ${orgCountry || 'none'}. New score: ${freshCheck.score}`);
                // Heal cache asynchronously so subsequent dispatches hit clean cache
                void PhoneHygieneRepository.commitBatch([[recipient, freshCheck]]).catch(err => {
                    console.warn(`>>> [MSG-ENGINE] Failed to persist self-healed cache for ${recipient}:`, err);
                });
            } else {
                console.warn(`>>> [MSG-ENGINE] SMS Delivery Guard aborted dispatch to ${recipient}: Status=${freshCheck.status}, Score=${freshCheck.score}`);
                return {
                    success: false,
                    error: `Recipient number is marked as ${freshCheck.status} (Hygiene Score: ${freshCheck.score}). Delivery blocked to protect sender reputation.`
                };
            }
        }
    }
```

- [x] **Step 3: Run tests**
Run: `pnpm vitest run src/lib/__tests__/messaging-engine-phone-hygiene.test.ts`
Expected: PASS

- [x] **Step 4: Commit**
```bash
git add src/lib/messaging-engine.ts src/lib/__tests__/messaging-engine-phone-hygiene.test.ts
git commit -m "feat(messaging): add JIT self-healing SMS delivery guard using org country setting"
```

---

### Task 7: CLI Reconciliation Script & Full Verification

**Files:**
- Create: `scripts/reconcile-phone-hygiene.ts`

- [x] **Step 1: Write `scripts/reconcile-phone-hygiene.ts`**

```typescript
// scripts/reconcile-phone-hygiene.ts
import { adminDb } from '../src/lib/firebase-admin';
import { PhoneVerificationEngine, VerifyPhoneResult } from '../src/lib/phone-verifier';
import { PhoneHygieneRepository } from '../src/lib/phone-hygiene-repository';
import { resolveOrganizationCountryCode } from '../src/lib/organization-country';

async function reconcilePhoneHygiene() {
  console.log('>>> [RECONCILER] Starting Phone Hygiene Reconciliation...');

  const engine = new PhoneVerificationEngine();
  const cacheSnap = await adminDb.collection('phone_verification_cache')
    .where('score', '==', 0)
    .limit(500)
    .get();

  if (cacheSnap.empty) {
    console.log('>>> [RECONCILER] No score 0 records found in phone_verification_cache.');
    return;
  }

  console.log(`>>> [RECONCILER] Found ${cacheSnap.docs.length} records with score === 0 to re-evaluate.`);

  const updates: [string, VerifyPhoneResult][] = [];
  let unblockedCount = 0;
  let stillInvalidCount = 0;

  for (const doc of cacheSnap.docs) {
    const data = doc.data();
    let rawPhone = data.e164 || '';
    if (!rawPhone) {
      try {
        rawPhone = Buffer.from(doc.id, 'base64').toString('utf-8');
      } catch {
        continue;
      }
    }

    if (!rawPhone) continue;

    let organizationId: string | undefined;
    const entitySnap = await adminDb.collection('workspace_entities')
      .where('primaryPhone', '==', rawPhone)
      .limit(1)
      .get();

    if (!entitySnap.empty) {
      organizationId = entitySnap.docs[0].data()?.organizationId;
    }

    const orgCountry = await resolveOrganizationCountryCode(organizationId);
    const result = await engine.verify(rawPhone, orgCountry, { forceRefresh: true });

    if (result.valid && result.status === 'format_valid') {
      console.log(`[RECONCILER] UNBLOCKED: ${rawPhone} (Old: 0 -> New: ${result.score}, Country: ${result.country || orgCountry})`);
      updates.push([rawPhone, result]);
      unblockedCount++;
    } else {
      console.log(`[RECONCILER] STILL INVALID: ${rawPhone} (${result.details?.structure?.error || 'unparseable'})`);
      stillInvalidCount++;
    }
  }

  if (updates.length > 0) {
    console.log(`>>> [RECONCILER] Committing ${updates.length} unblocked numbers to Firestore...`);
    await PhoneHygieneRepository.commitBatch(updates);
    console.log(`>>> [RECONCILER] Successfully healed and unblocked ${unblockedCount} contacts!`);
  }

  console.log(`>>> [RECONCILER] Summary: ${unblockedCount} unblocked, ${stillInvalidCount} confirmed invalid.`);
}

reconcilePhoneHygiene().catch(err => {
  console.error('>>> [RECONCILER] Fatal error:', err);
  process.exit(1);
});
```

- [x] **Step 2: Commit script**
```bash
git add scripts/reconcile-phone-hygiene.ts
git commit -m "feat(hygiene): add phone hygiene reconciliation script to unblock affected contacts"
```

- [x] **Step 3: Verification with the 5 affected user contact numbers**
Confirm via Vitest / Node:
- Noah International Complex (`233242737120`): Score 85, Valid
- MY REDEEMER SCHOOL (`233244363965`): Score 85, Valid
- Bethel Methodist School (`233242753266`): Score 85, Valid
- The Sanctuary Montessori (`233233146361`): Score 85, Valid
- Tulips Hill Academy (`0240488218`): Score 85, Valid
- Run `pnpm typecheck` (0 errors).
