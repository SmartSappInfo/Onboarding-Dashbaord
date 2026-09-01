'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Evidence-Backed Natural Language Research Assistant Flow
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Evidence-Backed Response Attribution:
 *    - Answering natural language questions over survey data with explicit response IDs and verbatim citations.
 *    - Zero-hallucination discipline: Every assertion must be linked to quantifiable data or direct quotes.
 * 2. Strict Zero-Any Invariant.
 */

import { ai, getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import {
  SurveyResearchAssistantInputSchema,
  SurveyResearchAssistantOutputSchema,
  type SurveyResearchAssistantInput,
  type SurveyResearchAssistantOutput,
} from '../schemas/survey-intelligence-schemas';

function renderResearchQueryPrompt(input: {
  surveyTitle: string;
  elementsJson: string;
  responsesJson: string;
  userQuery: string;
}): string {
  return `You are a Senior Principal Research Methodologist and SmartSapp Survey AI Copilot. Your mission is to answer the user's research query with rigorous, evidence-backed findings.

--- CONTEXT ---
Survey Title: ${input.surveyTitle}

--- SURVEY STRUCTURE ---
--- ELEMENTS JSON ---\n${input.elementsJson}\n--- END ELEMENTS ---

--- RESPONSE DATASET SAMPLE ---
--- RESPONSES JSON ---\n${input.responsesJson}\n--- END RESPONSES ---

--- USER RESEARCH QUERY ---
"${input.userQuery}"

--- STRICT EVIDENCE & GROUNDING INSTRUCTIONS ---
1. answerHtml: Provide a clear, nuanced, highly structured HTML answer (<p>, <strong>, <ul>, <li>, <blockquote>). Highlight critical patterns. Do NOT use inline styles or <style> tags.
2. confidenceScore (0-100): Assign a score reflecting certainty based on sample size and clarity of evidence.
3. sampleSizeAnalyzed: Number of survey responses relevant to this answer.
4. keyMetrics: Extract 2-4 critical quantitative metric data points (e.g. label: "Detractor Rate", value: "38%", comparison: "vs 14% campus benchmark").
5. evidenceCitations: Supply 2-5 explicit citations backing your assertions. Each citation MUST provide:
   - responseId: Exact response ID from the dataset.
   - questionTitle: Related survey question title.
   - evidenceText: Exact verbatim quote or quantitative answer.
   - context: Optional respondent channel or role.
6. suggestedFollowUpQuestions: Suggest 2-3 logical next analytical questions the researcher should investigate.
`;
}

export const querySurveyDataFlow = ai.defineFlow(
  {
    name: 'querySurveyDataFlow',
    inputSchema: SurveyResearchAssistantInputSchema,
    outputSchema: SurveyResearchAssistantOutputSchema,
  },
  async (input) => {
    const { surveyTitle, elementsJson, responsesJson, userQuery, organizationId, provider = 'anthropic' } = input;
    const modelId = input.modelId || (provider === 'openrouter' ? 'openrouter/free' : 'claude-3-5-sonnet');

    const promptText = renderResearchQueryPrompt({
      surveyTitle,
      elementsJson,
      responsesJson,
      userQuery,
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
                content: 'You are a senior survey researcher. Output ONLY valid JSON conforming to the requested schema.',
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
          return SurveyResearchAssistantOutputSchema.parse(parsed);
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
        schema: SurveyResearchAssistantOutputSchema,
      },
    });

    const output = response.output;
    if (!output) {
      throw new Error('AI failed to generate research assistant answer');
    }

    return output;
  }
);

/**
 * Exported wrapper for backward compatibility with existing callers.
 */
export async function querySurveyData(input: {
  survey: { title: string; elements: unknown[] };
  responses: unknown[];
  query: string;
  organizationId?: string;
  provider?: string;
  modelId?: string;
}): Promise<SurveyResearchAssistantOutput> {
  return querySurveyDataFlow({
    surveyTitle: input.survey.title,
    elementsJson: JSON.stringify(input.survey.elements, null, 2),
    responsesJson: JSON.stringify(input.responses.slice(0, 100), null, 2),
    userQuery: input.query,
    organizationId: input.organizationId,
    provider: input.provider || 'anthropic',
    modelId: input.modelId,
  });
}
