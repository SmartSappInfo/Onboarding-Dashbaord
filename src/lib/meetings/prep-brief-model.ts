import 'server-only';

/**
 * @fileOverview Production model for the grounded prep brief (Phase 11 M2 · T2; Rules 38, 57, 58).
 *
 * - Data policy first: the brief contains personal data, so only providers allowed for `personal`
 *   are used. None allowed → `PrepBriefPolicyError` (the brief goes facts-only).
 * - Reasoning tier via the central gateway `getModel` (tenant keys, routing); no MCP Sampling.
 * - Genkit structured output (Context7, Genkit JS 1.42 docs 2026-10-05): `response.output` can be
 *   null, which the service treats as unusable output. The schema here only shapes the request;
 *   the service re-validates every item and its citations.
 *
 * CAUTION: Google is preferred when allowed so the gateway's fallbacks stay within one provider.
 * The `getModel` proxy can fall back ACROSS providers on auth/quota errors; that path is not yet
 * policy-aware (tracked separately), so do not widen provider choice here without fixing it.
 */

import { ai, getModel } from '@/ai/genkit';
import { z } from 'genkit';
import type { Firestore } from 'firebase-admin/firestore';
import { providersAllowedFor, resolveAiDataPolicy } from '@/platform/policy/ai-data-policy';
import { PrepBriefPolicyError, type PrepBriefModel } from './prep-brief-service';

const Item = z.object({ text: z.string(), sourceIds: z.array(z.string()) });
const OutputSchema = z.object({
  objective: Item.nullable().optional(),
  history: z.array(Item).optional(),
  openDeals: z.array(Item).optional(),
  openCommitments: z.array(Item).optional(),
  risks: z.array(Item).optional(),
  agenda: z.array(Item).optional(),
  questions: z.array(Item).optional(),
});

export function createPrepBriefModel(db: Firestore): PrepBriefModel {
  return {
    breakerKey: 'reasoning',
    async generate({ prompt, workspaceId, organizationId }) {
      const policy = await resolveAiDataPolicy(db, { workspaceId, ...(organizationId ? { organizationId } : {}) });
      const allowed = providersAllowedFor(policy, 'personal');
      const provider = allowed.includes('googleai') ? 'googleai' : allowed[0];
      if (!provider) throw new PrepBriefPolicyError();
      const { modelString, customAi } = await getModel({ workspaceId, organizationId, provider, tier: 'reasoning' });
      const response = await (customAi || ai).generate({
        model: modelString,
        prompt,
        output: { schema: OutputSchema },
        config: { temperature: 0.2, maxOutputTokens: 4096 },
      });
      return { output: response.output ?? null, modelId: modelString };
    },
  };
}
