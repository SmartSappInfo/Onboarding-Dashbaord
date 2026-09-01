'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Pre-Publish AI Survey Quality Auditor Flow
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Deep Psychometric & Structural Survey Evaluation:
 *    - Audits survey blueprint for leading/biased questions, double-barreled prompts, excessive cognitive load, and mobile fatigue.
 *    - Generates overall quality score (0-100), sub-category ratings, and concrete question-level replacement proposals.
 * 2. Strict Zero-Any Invariant.
 */

import { ai, getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import {
  SurveyQualityAuditInputSchema,
  SurveyQualityAuditOutputSchema,
  type SurveyQualityAuditInput,
  type SurveyQualityAuditOutput,
} from '../schemas/survey-intelligence-schemas';

function renderAuditPrompt(input: {
  surveyTitle: string;
  surveyDescription?: string;
  elementsJson: string;
  targetAudience?: string;
}): string {
  return `You are an expert psychometrician and survey design methodologist. Your task is to perform an exhaustive, rigorous pre-launch quality audit of the following survey blueprint.

--- SURVEY DETAILS ---
Title: ${input.surveyTitle}
Description: ${input.surveyDescription || 'None provided'}
Target Demographic / Persona: ${input.targetAudience || 'General Audience'}

--- SURVEY BLUEPRINT (Elements & Questions) ---
--- ELEMENTS JSON ---\n${input.elementsJson}\n--- END ELEMENTS ---

--- EVALUATION CRITERIA ---
1. Clarity & Readability (0-100): Are questions free of jargon, ambiguity, and complex nested clauses?
2. Neutrality & Bias Guard (0-100): Are questions strictly neutral and non-leading? Are Likert/choice options balanced (e.g. not only positive choices)?
3. Fatigue & Length Risk (0-100): Is the question count and matrix width suitable for mobile respondents without causing drop-off?
4. Flow & Structural Coherence (0-100): Is the logical order natural? Are section transitions smooth?

--- REQUIRED OUTPUT ---
1. overallScore (0-100) and grade (A+, A, B, C, Needs Improvement).
2. Category sub-scores: clarityScore, neutralityScore, fatigueRiskScore, flowCoherenceScore.
3. estimatedCompletionMinutes (e.g. 3, 5, 8).
4. executiveSummary: High-level methodology review.
5. strengths: Top 2-4 design strengths.
6. suggestions: Concrete, actionable question-by-question improvements identifying the specific questionId, currentTitle, issueType, issueDescription, improvedTitle, optional improvedDescription, and optional improvedOptions.
`;
}

export const auditSurveyQualityFlow = ai.defineFlow(
  {
    name: 'auditSurveyQualityFlow',
    inputSchema: SurveyQualityAuditInputSchema,
    outputSchema: SurveyQualityAuditOutputSchema,
  },
  async (input) => {
    const { surveyTitle, surveyDescription, elements, targetAudience, organizationId, provider = 'anthropic' } = input;
    const modelId = input.modelId || (provider === 'openrouter' ? 'openrouter/free' : 'claude-3-5-sonnet');

    const promptText = renderAuditPrompt({
      surveyTitle,
      surveyDescription,
      elementsJson: JSON.stringify(elements, null, 2),
      targetAudience,
    });

    // 1. OpenRouter Custom Path
    if (provider === 'openrouter') {
      let apiKey: string | undefined;
      if (organizationId) {
        try {
          const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
          apiKey = orgDoc.data()?.apiKeys?.openrouter;
        } catch {
          // ignore
        }
      }
      if (!apiKey) {
        apiKey = process.env.OPENROUTER_API_KEY;
      }

      if (apiKey) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelId.replace('openrouter/', '') || 'meta-llama/llama-3.3-70b-instruct:free',
            messages: [
              {
                role: 'system',
                content: 'You are an expert psychometrician. Output ONLY valid JSON conforming to the requested schema.',
              },
              { role: 'user', content: promptText },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const contentStr = data.choices?.[0]?.message?.content || '{}';
          const parsed = JSON.parse(contentStr);
          return SurveyQualityAuditOutputSchema.parse(parsed);
        }
      }
    }

    // 2. Standard Genkit Path
    const resolvedModel = await getModel({ organizationId, provider, modelId });
    const generatorAi = resolvedModel.customAi || ai;
    const response = await generatorAi.generate({
      model: resolvedModel.modelString,
      prompt: promptText,
      output: {
        schema: SurveyQualityAuditOutputSchema,
      },
    });

    const output = response.output;
    if (!output) {
      throw new Error('AI failed to generate a valid survey quality audit');
    }

    return output;
  }
);
