import 'server-only';

/**
 * @fileOverview Production model for meeting intelligence (Phase 11 M2 · T3; plan §6; Rules 38, 57, 58).
 *
 * - Data policy first: transcript content is personal data, so only providers allowed for
 *   `personal` are used; none → `IntelligencePolicyError` (the run stops, nothing is sent).
 * - Chunk extraction on the fast tier, the summary on the reasoning tier, via the central gateway
 *   `getModel` (no MCP Sampling).
 * - Genkit 1.42 structured output; `response.output` may be null (the validator counts it as a
 *   schema drop). Token usage (`response.usage`) is returned for metering. `abortSignal` stops a
 *   call past its deadline.
 *
 * CAUTION: Google is preferred when allowed so `getModel`'s fallbacks stay within one provider;
 * its cross-provider fallback is not yet policy-aware (tracked separately).
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';
import type { Firestore } from 'firebase-admin/firestore';
import type { AiModelTier } from '@/lib/ai/model-registry';
import { providersAllowedFor, resolveAiDataPolicy } from '@/platform/policy/ai-data-policy';
import { IntelligencePolicyError, type IntelligenceModel, type IntelligenceModelRequest, type IntelligenceModelResponse } from './pipeline';

const ExtractOutputSchema = z.object({
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

const SummaryOutputSchema = z.object({
  sentences: z.array(z.object({ text: z.string(), itemIds: z.array(z.string()) })),
});

export function createIntelligenceModel(db: Firestore): IntelligenceModel {
  async function call(
    request: IntelligenceModelRequest,
    tier: AiModelTier,
    schema: typeof ExtractOutputSchema | typeof SummaryOutputSchema,
    maxOutputTokens: number
  ): Promise<IntelligenceModelResponse> {
    const policy = await resolveAiDataPolicy(db, { workspaceId: request.workspaceId, ...(request.organizationId ? { organizationId: request.organizationId } : {}) });
    const allowed = providersAllowedFor(policy, 'personal');
    const provider = allowed.includes('googleai') ? 'googleai' : allowed[0];
    if (!provider) throw new IntelligencePolicyError();
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
  }

  return {
    breakerKey: 'meeting_intelligence',
    extract: (request) => call(request, 'fast', ExtractOutputSchema, 8_192),
    summarize: (request) => call(request, 'reasoning', SummaryOutputSchema, 2_048),
  };
}
