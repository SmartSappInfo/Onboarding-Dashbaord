'use server';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Anomaly & Outlier Detection Flow
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Statistical & Psychometric Anomaly Detection:
 *    - Cross-evaluates metric distributions, speeder ratios, straight-lining clusters, and contradictory feedback.
 *    - Recommends actionable investigative steps.
 * 2. Strict Zero-Any Invariant.
 */

import { ai, getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import {
  SurveyAnomalyDetectionInputSchema,
  SurveyAnomalyDetectionOutputSchema,
  type SurveyAnomalyDetectionInput,
  type SurveyAnomalyDetectionOutput,
} from '../schemas/survey-intelligence-schemas';

function renderAnomalyPrompt(input: {
  surveyTitle: string;
  elementsJson: string;
  metricsJson: string;
  responsesJson: string;
}): string {
  return `You are a senior data scientist and survey methodology auditor. Your task is to detect statistical anomalies, psychometric contradictions, facility rating collapses, and sampling irregularities in the following survey dataset.

--- SURVEY DETAILS ---
Survey Title: ${input.surveyTitle}

--- SURVEY STRUCTURE ---
--- ELEMENTS JSON ---\n${input.elementsJson}\n--- END ELEMENTS ---

--- AGGREGATE METRICS OVERVIEW ---
--- METRICS JSON ---\n${input.metricsJson}\n--- END METRICS ---

--- SAMPLE RESPONSES & METADATA ---
--- RESPONSES JSON ---\n${input.responsesJson}\n--- END RESPONSES ---

--- ANOMALY DETECTION CRITERIA ---
1. Contradictory Feedback: High numerical satisfaction (e.g. NPS 10) accompanied by severe negative verbatim complaints, or vice versa.
2. Facility / Department Rating Collapse: Sudden localized drop in satisfaction ratings for a specific campus facility, teacher, or department compared to general baseline.
3. Temporal Spikes / Channel Surges: Unusual volume clustering from a single channel or short time window indicating potential bot activity or campaign saturation.
4. Bimodal Polarization: Severe split in responses (everyone voting 1 or 5 with no consensus) indicating contentious topics.

--- REQUIRED OUTPUT ---
1. anomaliesDetectedCount: Number of distinct anomalies found.
2. healthStatus: 'healthy' | 'minor_anomalies' | 'action_required' | 'critical_investigation'.
3. anomalies: Array of detected anomalies with anomalyId, type, severity, title, description, affectedQuestionIds, optional affectedResponseIds, and recommendedAction.
4. dataIntegrityAssessment: Overall synthesis of sampling reliability.
`;
}

export const detectSurveyAnomaliesFlow = ai.defineFlow(
  {
    name: 'detectSurveyAnomaliesFlow',
    inputSchema: SurveyAnomalyDetectionInputSchema,
    outputSchema: SurveyAnomalyDetectionOutputSchema,
  },
  async (input) => {
    const { surveyTitle, elements, metricsOverview, responsesSample, organizationId, provider = 'anthropic' } = input;
    const modelId = input.modelId || (provider === 'openrouter' ? 'openrouter/free' : 'claude-3-5-sonnet');

    const promptText = renderAnomalyPrompt({
      surveyTitle,
      elementsJson: JSON.stringify(elements, null, 2),
      metricsJson: JSON.stringify(metricsOverview, null, 2),
      responsesJson: JSON.stringify(responsesSample.slice(0, 50), null, 2),
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
                content: 'You are an expert data auditor. Output ONLY valid JSON conforming to the requested schema.',
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
          return SurveyAnomalyDetectionOutputSchema.parse(parsed);
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
        schema: SurveyAnomalyDetectionOutputSchema,
      },
    });

    const output = response.output;
    if (!output) {
      throw new Error('AI failed to detect survey anomalies');
    }

    return output;
  }
);
