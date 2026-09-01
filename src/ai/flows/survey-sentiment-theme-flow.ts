'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Sentiment Analysis & Thematic Clustering Flow
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Qualitative Synthesis & Thematic Discovery:
 *    - Ingests open-ended survey text responses and extracts latent topics, polarity distributions, and representative citations.
 *    - Links verbatim quotes to specific response IDs to ensure data fidelity.
 * 2. Strict Zero-Any Invariant.
 */

import { ai, getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import {
  SurveySentimentThemeInputSchema,
  SurveySentimentThemeOutputSchema,
  type SurveySentimentThemeInput,
  type SurveySentimentThemeOutput,
} from '../schemas/survey-intelligence-schemas';

function renderSentimentThemePrompt(input: {
  surveyTitle: string;
  elementsJson: string;
  responsesJson: string;
}): string {
  return `You are a senior qualitative research analyst and natural language processing specialist. Your task is to perform an exhaustive sentiment and thematic cluster analysis over the following qualitative survey responses.

--- SURVEY DETAILS ---
Survey Title: ${input.surveyTitle}

--- SURVEY STRUCTURE ---
--- ELEMENTS JSON ---\n${input.elementsJson}\n--- END ELEMENTS ---

--- QUALITATIVE RESPONSES (Verbatims) ---
--- RESPONSES JSON ---\n${input.responsesJson}\n--- END RESPONSES ---

--- ANALYSIS REQUIREMENTS ---
1. Overall Sentiment Breakdown:
   - Compute the proportion of positive, neutral, negative, and mixed responses (summing to 100%).
   - Calculate the Net Sentiment Score (% Positive - % Negative, between -100 and +100).
2. Thematic Clustering:
   - Identify 3 to 6 major distinct themes expressed across the verbatims.
   - For each theme: assign a clear title, description, dominant sentimentPolarity, prevalencePercentage, normalized sentimentScore (-1.0 to +1.0), keywords, and 2-4 supporting verbatim quote citations citing the exact responseId and excerpt.
3. Key Highlights & Urgent Pain Points:
   - Extract top positive highlights (what is working exceptionally well).
   - Extract top urgent pain points (what needs immediate leadership/management attention).
4. Executive Narrative:
   - Provide a clear, actionable 2-3 paragraph executive summary synthesising the voice of respondents.
`;
}

export const generateSurveySentimentThemesFlow = ai.defineFlow(
  {
    name: 'generateSurveySentimentThemesFlow',
    inputSchema: SurveySentimentThemeInputSchema,
    outputSchema: SurveySentimentThemeOutputSchema,
  },
  async (input) => {
    const { surveyTitle, elements, textResponses, organizationId, provider = 'anthropic' } = input;
    const modelId = input.modelId || (provider === 'openrouter' ? 'openrouter/free' : 'claude-3-5-sonnet');

    const promptText = renderSentimentThemePrompt({
      surveyTitle,
      elementsJson: JSON.stringify(elements, null, 2),
      responsesJson: JSON.stringify(textResponses.slice(0, 100), null, 2), // Guard against payload limit
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
                content: 'You are an expert qualitative researcher. Output ONLY valid JSON conforming to the requested schema.',
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
          return SurveySentimentThemeOutputSchema.parse(parsed);
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
        schema: SurveySentimentThemeOutputSchema,
      },
    });

    const output = response.output;
    if (!output) {
      throw new Error('AI failed to generate sentiment and thematic clusters');
    }

    return output;
  }
);
