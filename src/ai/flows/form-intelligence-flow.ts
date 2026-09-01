'use server';

/**
 * SmartSapp Forms 2.0: AI Response Intelligence & Qualitative Research Flows
 * 
 * Provides automated submission classification, sentiment extraction,
 * thematic topic clustering, and qualitative research synthesis.
 */

import { ai, getModel } from '@/ai/genkit';
import { adminDb } from '@/lib/firebase-admin';
import { getBaseUrl } from '@/lib/utils/url-helpers';
import {
  ClassifySubmissionInputSchema,
  ClassifySubmissionOutputSchema,
  ClusterFormTopicsInputSchema,
  ClusterFormTopicsOutputSchema,
  type ClassifySubmissionInput,
  type ClassifySubmissionOutput,
  type ClusterFormTopicsInput,
  type ClusterFormTopicsOutput,
} from '@/ai/schemas/form-intelligence-schemas';

/**
 * Redacts common sensitive tokens (e.g. credit card numbers, passwords) prior to LLM submission.
 */
function sanitizeQualitativeText(text: string): string {
  if (!text) return '';
  return text
    // Redact 13-16 digit card numbers
    .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CARD]')
    // Redact SSN-like patterns
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
    // Redact password hints
    .replace(/(?:password|secret|pin)\s*[:=]\s*\S+/gi, '[REDACTED_SECRET]');
}

/**
 * Helper to call AI with OpenRouter / Native Genkit dual-tier fallback.
 */
async function callIntelligenceAI<T>(params: {
  prompt: string;
  schema: import('genkit').z.ZodTypeAny;
  organizationId?: string;
  provider?: string;
  modelId?: string;
}): Promise<T> {
  const { prompt, schema, organizationId, provider = 'openrouter', modelId = 'google/gemini-2.5-flash' } = params;

  try {
    let apiKey = process.env.OPENROUTER_API_KEY;
    if (organizationId) {
      const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
      if (orgDoc.exists && orgDoc.data()?.openRouterApiKey) {
        apiKey = orgDoc.data()?.openRouterApiKey;
      }
    }

    if (apiKey) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': getBaseUrl(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are an elite Response Intelligence & CRM Analyst. Return strictly well-formed JSON matching the specified schema.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          return schema.parse(parsed) as T;
        }
      }
    }

    // Fallback to Native Genkit (Gemini 2.5 Flash / Claude)
    const { modelString, customAi } = await getModel({
      organizationId,
      provider: 'googleai',
      modelId: 'gemini-2.5-flash',
    });

    const activeAi = customAi || ai;
    const result = await activeAi.generate({
      model: modelString,
      prompt,
      output: { schema },
    });

    if (!result.output) {
      throw new Error('AI Intelligence output was empty.');
    }

    return result.output as T;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AI-INTELLIGENCE-FLOW] Call failed:', msg);
    throw new Error(`AI Intelligence Error: ${msg}`);
  }
}

// ──────────────────────────────────────────────────────────
// 1. Single Submission Classification Flow
// ──────────────────────────────────────────────────────────

export const classifyFormSubmissionFlow = ai.defineFlow(
  {
    name: 'classifyFormSubmissionFlow',
    inputSchema: ClassifySubmissionInputSchema,
    outputSchema: ClassifySubmissionOutputSchema,
  },
  async (input: ClassifySubmissionInput): Promise<ClassifySubmissionOutput> => {
    const formattedAnswers = input.answers
      .map(a => {
        const rawVal = typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value || '');
        const cleanVal = sanitizeQualitativeText(rawVal);
        return `- ${a.label}: "${cleanVal}"`;
      })
      .join('\n');

    const prompt = `You are an elite Lead & Response Intelligence Specialist for SmartSapp CRM.
Analyze the following form submission and perform a complete sentiment, intent, lead quality, and qualitative intelligence extraction.

FORM TITLE: "${input.formTitle}"
FORM PURPOSE: "${input.formPurpose || 'lead_capture'}"

CAPTURED RESPONSES:
${formattedAnswers || 'No responses provided'}

DIRECTIVES:
1. **Sentiment Analysis**:
   - Determine overall sentiment ('positive', 'neutral', 'negative').
   - Assign a continuous sentimentScore from -1.0 (extremely negative/critical) to +1.0 (enthusiastic/positive).
2. **Intent Classification**:
   - Identify the respondent's primary intent (e.g. "High Purchase Intent", "Admissions Ingestion", "Technical Support Request", "Pricing & Discount Inquiry", "Job Application", "Feature Feedback").
3. **Urgency & Lead Quality**:
   - Classify urgency ('low', 'medium', 'high').
   - Calculate a lead quality score (0-100) assessing depth, decision-maker status, budget viability, and completeness.
4. **Topics & Entities**:
   - Extract 2-5 relevant topic keywords (e.g. "Boarding Housing", "Fee Collection", "Scholarships").
   - Extract structured entities (organizations, roles, budgets, pain points).
5. **Executive Summary**:
   - Provide a clear 1-2 sentence executive overview for CRM account executives or admissions counselors.
6. **Recommended Actions**:
   - Provide 1-3 concrete next steps with actionType (assign_lead_owner, apply_crm_tag, update_submission_status, create_crm_task, create_pipeline_deal, send_email_followup, mark_priority).
7. **Confidence Policy**:
   - Provide a confidence score (0.0 to 1.0). If confidence < 0.70, flag needsHumanReview: true.
`;

    return callIntelligenceAI<ClassifySubmissionOutput>({
      prompt,
      schema: ClassifySubmissionOutputSchema,
      organizationId: input.organizationId,
    });
  }
);

// ──────────────────────────────────────────────────────────
// 2. Form-Level Aggregate Topic Clustering Flow
// ──────────────────────────────────────────────────────────

export const clusterFormTopicsFlow = ai.defineFlow(
  {
    name: 'clusterFormTopicsFlow',
    inputSchema: ClusterFormTopicsInputSchema,
    outputSchema: ClusterFormTopicsOutputSchema,
  },
  async (input: ClusterFormTopicsInput): Promise<ClusterFormTopicsOutput> => {
    const submissionsText = input.submissions
      .slice(0, 50) // Process up to 50 representative submissions to avoid context overflow
      .map((s, idx) => `[Submission #${idx + 1} (${s.submissionId}) | Sentiment: ${s.sentiment || 'unclassified'} | Intent: ${s.intent || 'unknown'}]\n"${sanitizeQualitativeText(s.qualitativeText)}"`)
      .join('\n\n');

    const prompt = `You are a Principal Qualitative Research & Voice-of-Customer Analyst for SmartSapp Forms 2.0.
Analyze the following batch of ${input.submissions.length} respondent submissions for "${input.formTitle}" and perform comprehensive thematic topic clustering, sentiment aggregation, and strategic synthesis.

SUBMISSIONS DATASET:
${submissionsText || 'No qualitative submissions available.'}

ANALYTICAL OBJECTIVES:
1. **Sentiment Distribution**:
   - Calculate counts and percentages for positive, neutral, and negative responses.
   - Compute the overall mean sentiment score (-1.0 to +1.0).
2. **Thematic Topic Clusters**:
   - Identify top 3 to 6 distinct thematic topics/pain points.
   - For each theme: provide mention count, percentage share (% of respondents who discussed this), dominant sentiment, 2-3 direct representative sample quotes, and a pain point summary.
3. **Cross-Submission Executive Narrative**:
   - Write a rich, executive summary synthesizing common trends, emerging opportunities, and operational bottlenecks across all responses.
4. **Key Pain Points & Strategic Recommendations**:
   - List top 3-5 concrete pain points and 3-5 actionable recommendations for product, operations, or leadership teams.
`;

    return callIntelligenceAI<ClusterFormTopicsOutput>({
      prompt,
      schema: ClusterFormTopicsOutputSchema,
      organizationId: input.organizationId,
    });
  }
);
