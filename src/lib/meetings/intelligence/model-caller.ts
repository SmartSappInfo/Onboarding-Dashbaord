/**
 * @fileOverview Policy-checked model call for meeting intelligence (Phase 11 M2 · T3/T5; plan §6; Rules 38, 57, 58).
 *
 * Shared by the production models (`intelligence-model.ts`, server-only) and the offline evaluation
 * script (`scripts/eval-meeting-agent.ts`), so both send content the same way:
 * - data policy first: transcript-derived content is personal data, so only providers allowed for
 *   `personal` are used; none → `NoAllowedProviderError` (nothing is sent);
 * - the central gateway `getModel` picks the model for the tier (no MCP Sampling);
 * - Genkit structured output; `response.output` may be null (validators count it as a drop);
 *   token usage is returned for metering; `abortSignal` stops a call past its deadline.
 *
 * Deliberately NOT `server-only` (the offline script runs under tsx). Never import from client code.
 *
 * CAUTION: Google is preferred when allowed so `getModel`'s fallbacks stay within one provider;
 * its cross-provider fallback is not yet policy-aware (tracked separately).
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';
import type { Firestore } from 'firebase-admin/firestore';
import type { AiModelTier } from '@/lib/ai/model-registry';
import { providersAllowedFor, resolveAiDataPolicy } from '@/platform/policy/ai-data-policy';
import type { IntelligenceModelRequest, IntelligenceModelResponse } from './pipeline';

export class NoAllowedProviderError extends Error {
  constructor() {
    super("Your workspace doesn't allow AI analysis of meeting content.");
    this.name = 'NoAllowedProviderError';
  }
}

export const ExtractOutputSchema = z.object({
  items: z.array(z.object({
    type: z.string(),
    text: z.string(),
    ownerName: z.string().optional(),
    dueText: z.string().optional(),
    amountValue: z.number().optional(),
    amountCurrency: z.string().optional(),
    confidence: z.number(),
    evidence: z.array(z.object({ segmentIds: z.array(z.string()), quote: z.string() })),
  })),
});

export const SummaryOutputSchema = z.object({
  sentences: z.array(z.object({ text: z.string(), itemIds: z.array(z.string()) })),
});

export const FollowupDraftOutputSchema = z.object({
  subject: z.string(),
  sentences: z.array(z.object({ text: z.string(), itemIds: z.array(z.string()) })),
});

type OutputSchema = typeof ExtractOutputSchema | typeof SummaryOutputSchema | typeof FollowupDraftOutputSchema;

export type MeetingModelCall = (
  request: IntelligenceModelRequest,
  tier: AiModelTier,
  schema: OutputSchema,
  maxOutputTokens: number
) => Promise<IntelligenceModelResponse>;

export function createMeetingModelCaller(db: Firestore): MeetingModelCall {
  return async function call(request, tier, schema, maxOutputTokens) {
    const policy = await resolveAiDataPolicy(db, { workspaceId: request.workspaceId, ...(request.organizationId ? { organizationId: request.organizationId } : {}) });
    const allowed = providersAllowedFor(policy, 'personal');
    const provider = allowed.includes('googleai') ? 'googleai' : allowed[0];
    if (!provider) throw new NoAllowedProviderError();
    const { modelString, customAi } = await getModel({ workspaceId: request.workspaceId, organizationId: request.organizationId, provider, tier });
    const response = await (customAi || ai).generate({
      model: modelString,
      prompt: request.prompt,
      output: { schema },
      config: { temperature: 0, maxOutputTokens },
      ...(request.signal ? { abortSignal: request.signal } : {}),
    });
    return {
      output: response.output ?? null,
      modelId: modelString,
      ...(response.usage?.inputTokens !== undefined ? { inputTokens: response.usage.inputTokens } : {}),
      ...(response.usage?.outputTokens !== undefined ? { outputTokens: response.usage.outputTokens } : {}),
    };
  };
}

/** Extraction on the fast tier (shared by the production model and the offline evaluation). */
export const EXTRACT_TIER: AiModelTier = 'fast';
export const EXTRACT_MAX_OUTPUT_TOKENS = 8_192;
