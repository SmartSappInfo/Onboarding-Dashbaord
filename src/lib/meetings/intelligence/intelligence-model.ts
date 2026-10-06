import 'server-only';

/**
 * @fileOverview Production models for meeting intelligence (Phase 11 M2 · T3/T4; plan §6; Rules 38, 57, 58).
 *
 * Chunk extraction on the fast tier, the summary and follow-up drafts on the reasoning tier, all
 * through the policy-checked caller in `model-caller.ts` (data policy first; no MCP Sampling).
 * "No allowed provider" becomes `IntelligencePolicyError`: the run stops and nothing is sent.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { IntelligencePolicyError, type IntelligenceModel, type IntelligenceModelRequest, type IntelligenceModelResponse } from './pipeline';
import type { FollowupDraftModel } from './followup-drafts';
import {
  EXTRACT_MAX_OUTPUT_TOKENS,
  EXTRACT_TIER,
  ExtractOutputSchema,
  FollowupDraftOutputSchema,
  NoAllowedProviderError,
  SummaryOutputSchema,
  createMeetingModelCaller,
  type MeetingModelCall,
} from './model-caller';

function policyChecked(db: Firestore): MeetingModelCall {
  const call = createMeetingModelCaller(db);
  return async (request: IntelligenceModelRequest, tier, schema, maxOutputTokens): Promise<IntelligenceModelResponse> => {
    try {
      return await call(request, tier, schema, maxOutputTokens);
    } catch (err) {
      if (err instanceof NoAllowedProviderError) throw new IntelligencePolicyError();
      throw err;
    }
  };
}

export function createIntelligenceModel(db: Firestore): IntelligenceModel {
  const call = policyChecked(db);
  return {
    breakerKey: 'meeting_intelligence',
    extract: (request) => call(request, EXTRACT_TIER, ExtractOutputSchema, EXTRACT_MAX_OUTPUT_TOKENS),
    summarize: (request) => call(request, 'reasoning', SummaryOutputSchema, 2_048),
  };
}

/** Follow-up drafts (M2 · T4.2): reasoning tier, same data policy as the analysis (D19). */
export function createFollowupDraftModel(db: Firestore): FollowupDraftModel {
  const call = policyChecked(db);
  return {
    breakerKey: 'meeting_intelligence',
    draft: (request) => call(request, 'reasoning', FollowupDraftOutputSchema, 2_048),
  };
}
