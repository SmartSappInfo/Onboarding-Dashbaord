# Survey AI Messaging Template Generation Resilience & Multi-Provider Architecture Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate survey messaging template generation failures (e.g. `ref: a5556799de99`), establish multi-provider fallback resilience between Anthropic, Google Gemini, and OpenRouter in Genkit, route AI requests dynamically through workspace/organization AI settings, and protect all downstream AI flows from cascading quota/auth failures.

**Architecture:**
1. **Model Wire Prefix Harmonization**: Align Anthropic model wire identifiers in `AiModelRegistry` (`providerModelString`) to include the mandatory `anthropic/` namespace required by `@genkit-ai/anthropic` (`anthropic/claude-3-5-sonnet-20241022`, `anthropic/claude-3-5-haiku-20241022`).
2. **Contextual Workspace Scoping**: Propagate `workspaceId` through all survey AI actions (`generateSurveyMessagingTemplatesAction`) into `SurveyMessagingContextInputSchema`, `generateSurveyMessagingFlow`, and `getModel({ workspaceId, organizationId })`, respecting workspace preferred models and tenant organization keys.
3. **Dynamic Platform Defaults**: Remove hardcoded `provider = 'anthropic'` defaults in survey messaging flows; resolve dynamically through `WorkspaceAiService` $\rightarrow$ `system_settings/ai_config` (managed via Backoffice without code) $\rightarrow$ platform flagship Gemini Flash.
4. **Resilient Cross-Provider Proxy Fallback**: Enhance the `wrappedAi` proxy in `src/ai/genkit.ts` so that when a primary provider (e.g. Anthropic) encounters 401/404/quota errors, cross-provider fallback models (e.g. `googleai/gemini-2.5-flash`) execute on a `googleai`-configured Genkit instance rather than crashing on an Anthropic-only instance.
5. **Actionable User Experience**: Provide clear, accessible toast feedback and actionable navigation (`actionConfig`) on mobile and desktop if credentials or quotas are exhausted.

**Tech Stack:** Next.js 16 (Turbopack, Server Actions), Genkit 0.9 (`genkit`, `@genkit-ai/google-genai`, `@genkit-ai/anthropic`), TypeScript 5.8 (Strict Typing, zero `any/any[]`), Vitest.

---

## 1. Risk Analysis & Failure Modes ("What Could Go Wrong & Resolutions")

| Risk / Failure Mode | Root Mechanism | Resolution & Defense |
| :--- | :--- | :--- |
| **1. Wire String Mismatch for Non-Genkit Callers** | Direct Anthropic SDK or OpenRouter callers might fail if they expect a bare model ID rather than `anthropic/claude-3-5-sonnet`. | In `AiModelRegistry`, `providerModelString` is specifically the wire string passed to Genkit. For raw API endpoints (e.g. OpenRouter in `generate-survey-flow.ts`), raw callers already extract or override their target strings. We ensure `AiModelRegistry.getModelById` returns the exact Genkit-compliant string. |
| **2. Infinite Fallback Cascade or Quota Throttling** | If Anthropic fails and Gemini is also rate-limited, the system could spin or timeout the user's browser request. | Hardcap fallback attempts to a strict array of 3 candidates (`gemini-2.5-flash`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`). If all fail, fail fast with a sanitized, friendly error and actionable toast. |
| **3. Cross-Tenant Key Leakage** | A tenant's failing request might accidentally inherit another tenant's custom key during fallback. | Strict isolation hierarchy: `Tenant Custom Key` $\rightarrow$ `Backoffice Platform Key` $\rightarrow$ `Environment Key`. Tenant keys are scoped strictly by `organizationId`. Cross-tenant lookups are architecturally prevented. |
| **4. Gemini Output Schema Incompatibilities** | Gemini's JSON schema parser might reject complex or polymorphic Zod types that Claude previously accepted. | `GenerateSurveyMessagingOutputSchema` uses flat enums, optional strings, and standard typed arrays. We run integration tests with Gemini to verify schema parsing without `400 INVALID_ARGUMENT`. |
| **5. Mobile Latency & Frozen Modals** | A 2-3 second fallback delay might make mobile users think the UI has frozen. | Ensure UI modal in `internal-notification-config.tsx` displays progressive step text ("Analyzing survey context...", "Optimizing copy for channels..."), and wraps all promises in `try/catch/finally` so `setIsGeneratingAi(false)` always fires. |

---

## 2. Blast Radius & Cross-Feature Impact

### A. Affected Survey Feature Entry Points (Included in Plan)
1. **Internal Team Alerts** (`src/app/admin/components/internal-notification-config.tsx`):
   - Triggered by `[✨ AI Generate Team Alerts]`.
   - Passes `workspaceId: activeWorkspaceId`, `organizationId: activeOrganizationId`.
2. **External Stakeholder Alerts** (`src/app/admin/surveys/components/external-notification-config.tsx`):
   - Triggered by `[✨ AI Generate Stakeholder Alerts]`.
   - Passes `workspaceId: activeWorkspaceId`, `organizationId: activeOrganizationId`.
3. **Respondent Outcome Rules** (`src/app/admin/surveys/components/result-rule-manager.tsx`):
   - Triggered by `[✨ AI Generate Outcome Messages]`.
   - Passes `workspaceId: activeWorkspaceId`, `organizationId: activeOrganizationId`.

### B. Downstream AI Flows Protected by the Proxy Fallback Fix
The hardening of `src/ai/genkit.ts` immediately protects all 11 flows that default to Anthropic when an organization only has Gemini keys configured:
- `generate-email-template-flow.ts`
- `generate-automation-flow.ts`
- `bulk-mapping-flow.ts`
- `bulk-normalization-flow.ts`
- `generate-script-flow.ts`
- `generate-survey-summary-flow.ts`
- `query-survey-data-flow.ts`
- `survey-ai-reviewer-flow.ts`
- `survey-anomaly-detection-flow.ts`
- `survey-sentiment-theme-flow.ts`

### C. Backoffice Integration (Zero Code Configuration)
- The Backoffice already provides `system_settings/ai_config` and `system_settings/ai_keys` (managed via `src/lib/backoffice/backoffice-ai-actions.ts`).
- By updating `generate-survey-messaging-flow.ts` to call `getModel({ workspaceId, organizationId, tier: 'default' })`, super-admins can switch default providers or models directly in the Backoffice UI, and the change takes effect immediately without code redeployments.

---

## 3. Engineering Rules & Invariants Checklist

- [x] **Rule 1 (Strict Typing):** Zero `any` or `any[]` throughout modified code.
- [x] **Rule 2 (SSOT):** Centralized model resolution via `AiModelRegistry` and `WorkspaceAiService`.
- [x] **Rule 3 (SSOT Variables):** Variable tokens strictly aligned with `FieldsVariablesService`.
- [x] **Rule 4 (Actionable Error & Toast):** Toasts carry safe relative paths starting with single `/` (`/admin/settings?tab=ai`).
- [x] **Rule 5 (Git Protocol):** All changes committed strictly to local `main`. Zero remote pushes.
- [x] **Rule 6 (Mobile Ergonomics):** Touch targets `min-h-[44px]`, tactile click feedback `active:scale-[0.97]`.
- [x] **Rule 7 (Animations):** Emil Kowalski smooth transitions on modal and buttons.
- [x] **Rule 8 (Multi-Tenancy & Security):** Tenant keys strictly isolated; server actions authenticated with `canUser`.
- [x] **Rule 9 (Scale & High Load):** In-memory cache with 5-minute TTL and LRU bounds (`MAX_CACHE_SIZE = 500`); bounded fallback retry loops (max 3 candidates).
- [x] **Rule 10 (Inline Documentation):** Explanatory architectural comments and caution pointers left in all edited files.

---

## 4. Phase-by-Phase Implementation Tasks

### Phase 1: Model Registry Wire Prefix Harmonization

**Files:**
- Modify: `src/lib/ai/model-registry.ts:105-135`
- Test: `src/lib/ai/__tests__/model-registry-wire-strings.test.ts`

- [ ] **Step 1.1: Write failing unit test for Anthropic wire strings**

Create `src/lib/ai/__tests__/model-registry-wire-strings.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { AiModelRegistry } from '../model-registry';

describe('AiModelRegistry Wire String Alignment', () => {
  it('ensures all Anthropic models have providerModelString starting with anthropic/', () => {
    const claudeSonnet = AiModelRegistry.getModelById('claude-3-5-sonnet');
    expect(claudeSonnet?.providerModelString).toBe('anthropic/claude-3-5-sonnet-20241022');

    const claudeHaiku = AiModelRegistry.getModelById('claude-3-5-haiku');
    expect(claudeHaiku?.providerModelString).toBe('anthropic/claude-3-5-haiku-20241022');
  });

  it('ensures all Google AI models have providerModelString starting with googleai/', () => {
    const geminiFlash = AiModelRegistry.getModelById('gemini-2.5-flash');
    expect(geminiFlash?.providerModelString).toBe('googleai/gemini-2.5-flash');
  });
});
```

- [ ] **Step 1.2: Run test to verify failure**

Run: `npx vitest run src/lib/ai/__tests__/model-registry-wire-strings.test.ts`
Expected: FAIL (`claude-3-5-sonnet-20241022` !== `anthropic/claude-3-5-sonnet-20241022`)

- [ ] **Step 1.3: Update wire strings in `src/lib/ai/model-registry.ts`**

Update `providerModelString` for `claude-3-5-sonnet` and `claude-3-5-haiku` to prepend `anthropic/`. Add inline documentation explaining Genkit plugin namespace requirements.

- [ ] **Step 1.4: Run test to verify pass**

Run: `npx vitest run src/lib/ai/__tests__/model-registry-wire-strings.test.ts`
Expected: PASS

- [ ] **Step 1.5: Local commit**

```bash
git add src/lib/ai/model-registry.ts src/lib/ai/__tests__/model-registry-wire-strings.test.ts
git commit -m "fix(ai): prefix anthropic wire model identifiers with anthropic namespace for genkit compatibility"
```

---

### Phase 2: Schema & Action Context Propagation (`workspaceId`)

**Files:**
- Modify: `src/ai/schemas/survey-messaging-schemas.ts:66-101`
- Modify: `src/lib/survey-ai-messaging-actions.ts:120-145`
- Test: `src/lib/__tests__/survey-ai-messaging-actions.test.ts`

- [ ] **Step 2.1: Write failing test verifying `workspaceId` forwarding**

In `src/lib/__tests__/survey-ai-messaging-actions.test.ts`, assert that `generateSurveyMessagingFlow` is called with `{ workspaceId: 'ws_test', organizationId: 'org_test', ... }`.

- [ ] **Step 2.2: Run test to verify failure**

Run: `npx vitest run src/lib/__tests__/survey-ai-messaging-actions.test.ts`
Expected: FAIL (mismatch: `workspaceId` is missing from the flow invocation payload)

- [ ] **Step 2.3: Add `workspaceId` to schema and action invocation**

1. In `src/ai/schemas/survey-messaging-schemas.ts`:
   Add `workspaceId: z.string().optional()` to `SurveyMessagingContextInputSchema`.
2. In `src/lib/survey-ai-messaging-actions.ts`:
   Inject `workspaceId` into `aiInput: SurveyMessagingContextInput`.

- [ ] **Step 2.4: Run test to verify pass**

Run: `npx vitest run src/lib/__tests__/survey-ai-messaging-actions.test.ts`
Expected: PASS

- [ ] **Step 2.5: Local commit**

```bash
git add src/ai/schemas/survey-messaging-schemas.ts src/lib/survey-ai-messaging-actions.ts src/lib/__tests__/survey-ai-messaging-actions.test.ts
git commit -m "feat(ai): forward workspaceId from survey messaging action into flow context"
```

---

### Phase 3: Dynamic Model Resolution in `generateSurveyMessagingFlow`

**Files:**
- Modify: `src/ai/flows/generate-survey-messaging-flow.ts:136-165`
- Test: `src/ai/__tests__/generate-survey-messaging-flow.test.ts`

- [ ] **Step 3.1: Write test for dynamic provider/model resolution**

In `src/ai/__tests__/generate-survey-messaging-flow.test.ts`, add test verifying that when `provider` and `modelId` are omitted from input, `getModel` is called with `{ workspaceId, organizationId, tier: 'default' }`.

- [ ] **Step 3.2: Run test to verify failure**

Run: `npx vitest run src/ai/__tests__/generate-survey-messaging-flow.test.ts`
Expected: FAIL

- [ ] **Step 3.3: Implement dynamic model resolution in flow**

Update `generateSurveyMessagingFlow` in `src/ai/flows/generate-survey-messaging-flow.ts`:
- Remove hardcoded `provider = 'anthropic', modelId = 'claude-3-5-sonnet'`.
- Call `getModel({ workspaceId, organizationId, provider: input.provider as ... , modelId: input.modelId, tier: 'default' })`.
- Add inline architectural comments explaining the multi-tenant key resolution order.

- [ ] **Step 3.4: Run test to verify pass**

Run: `npx vitest run src/ai/__tests__/generate-survey-messaging-flow.test.ts`
Expected: PASS

- [ ] **Step 3.5: Local commit**

```bash
git add src/ai/flows/generate-survey-messaging-flow.ts src/ai/__tests__/generate-survey-messaging-flow.test.ts
git commit -m "refactor(ai): dynamically resolve model and tier in survey messaging flow"
```

---

### Phase 4: Harden Multi-Provider Cross-Fallback Proxy in `genkit.ts`

**Files:**
- Modify: `src/ai/genkit.ts:285-400`
- Test: `src/ai/__tests__/genkit-cross-provider-fallback.test.ts`

- [ ] **Step 4.1: Write unit test for cross-provider fallback routing**

Create `src/ai/__tests__/genkit-cross-provider-fallback.test.ts`:
Verify that when an Anthropic or custom-instance generation throws an auth or 404 error, the proxy resolves a Google AI Genkit instance to execute `googleai/gemini-2.5-flash` instead of crashing on the Anthropic instance.

- [ ] **Step 4.2: Run test to verify failure**

Run: `npx vitest run src/ai/__tests__/genkit-cross-provider-fallback.test.ts`
Expected: FAIL

- [ ] **Step 4.3: Implement cross-provider dispatch in `wrappedAi` proxy**

In `src/ai/genkit.ts`:
1. In the fallback loop:
   ```typescript
   if (candidate.startsWith('googleai/') && finalProvider !== 'googleai') {
     // Retrieve Gemini key (tenant org key -> backoffice key -> env)
     const targetKey = orgGeminiKey || backofficeGeminiKey || process.env.GEMINI_API_KEY;
     const fallbackAi = getOrCreateGenkitInstance('googleai', targetKey);
     return await fallbackAi.generate({ ...resolvedOptions, model: candidate });
   }
   ```
2. Wrap candidate executions in localized try/catch with clear diagnostic logging.
3. Add explanatory inline comments.

- [ ] **Step 4.4: Run test to verify pass**

Run: `npx vitest run src/ai/__tests__/genkit-cross-provider-fallback.test.ts`
Expected: PASS

- [ ] **Step 4.5: Local commit**

```bash
git add src/ai/genkit.ts src/ai/__tests__/genkit-cross-provider-fallback.test.ts
git commit -m "fix(ai): route cross-provider fallback models to matching genkit plugin instance"
```

---

### Phase 5: UI Resilience & Actionable Error Navigation

**Files:**
- Modify: `src/app/admin/components/internal-notification-config.tsx:125-145`
- Modify: `src/app/admin/surveys/components/external-notification-config.tsx:105-125`
- Modify: `src/app/admin/surveys/components/result-rule-manager.tsx:105-125`

- [ ] **Step 5.1: Enhance error handling with actionable navigation**

When `res.error` indicates API key or configuration failure:
1. Provide actionable toast with `actionConfig: { label: 'Configure AI Keys', path: '/admin/settings?tab=ai' }` (safe relative path conforming to Rule 4).
2. Ensure touch targets meet `min-h-[44px]` and tactile click states `active:scale-[0.97]` conforming to Rule 6 & 7.

- [ ] **Step 5.2: Local commit**

```bash
git add src/app/admin/components/internal-notification-config.tsx src/app/admin/surveys/components/external-notification-config.tsx src/app/admin/surveys/components/result-rule-manager.tsx
git commit -m "feat(ui): add actionable settings navigation to survey ai error toasts"
```

---

### Phase 6: Full Verification, Typecheck, and Linting

- [ ] **Step 6.1: Run targeted Vitest suites**

Run: `npx vitest run src/ai/ src/lib/__tests__/survey-ai-messaging-actions.test.ts`
Expected: 100% passing tests.

- [ ] **Step 6.2: Run TypeScript check**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 6.3: Run Linter**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 6.4: Verify Git Status**

Run: `git status`
Expected: Clean working tree on `main`, zero pushes to origin.
